
import React, { useState, useRef, useEffect } from 'react';
import { Order, OrderItem, InventoryItem } from '../types';
import { parseInvoiceFromImage, ParsedOrderData } from '../services/geminiService';

interface OrderScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateOrder: (order: Partial<Order>) => void;
    onAddToInventory: (item: Omit<InventoryItem, 'id'>) => void;
    existingInventory: InventoryItem[];
    t: (key: string) => string;
}

type ScannerState = 'idle' | 'camera' | 'processing' | 'preview' | 'error';

interface ExtractedItem {
    id: string;
    name: string;
    sku: string;
    quantity: number;
    unitCost: number;
    category?: string;
    packSize: string;
    total: number;
    matchedInventoryId?: string;
    isNew: boolean;
    addToInventory: boolean;
}

const OrderScannerModal: React.FC<OrderScannerModalProps> = ({
    isOpen,
    onClose,
    onCreateOrder,
    onAddToInventory,
    existingInventory,
    t
}) => {
    const [state, setState] = useState<ScannerState>('idle');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [scannedData, setScannedData] = useState<ParsedOrderData | null>(null);
    const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
    const [orderDetails, setOrderDetails] = useState({
        poNumber: '',
        vendor: '',
        orderDate: new Date().toISOString().split('T')[0],
        subtotal: 0,
        shippingCost: 0,
        totalTax: 0
    });
    const [errorMessage, setErrorMessage] = useState('');

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        if (!isOpen) {
            resetState();
            stopCamera();
        }
    }, [isOpen]);

    const resetState = () => {
        setState('idle');
        setCapturedImage(null);
        setScannedData(null);
        setExtractedItems([]);
        setOrderDetails({
            poNumber: '',
            vendor: '',
            orderDate: new Date().toISOString().split('T')[0],
            subtotal: 0,
            shippingCost: 0,
            totalTax: 0
        });
        setErrorMessage('');
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const startCamera = async () => {
        setState('camera');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (error) {
            console.error('Camera error:', error);
            setErrorMessage('Could not access camera. Please try uploading a file.');
            setState('error');
        }
    };

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0);
            const imageData = canvas.toDataURL('image/jpeg', 0.9);
            setCapturedImage(imageData);
            stopCamera();
            processImage(imageData);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const imageData = event.target?.result as string;
            setCapturedImage(imageData);
            processImage(imageData);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const matchInventoryItem = (itemName: string): InventoryItem | undefined => {
        const lowerName = itemName.toLowerCase();
        return existingInventory.find(inv => {
            const invLower = inv.name.toLowerCase();
            // Check for exact match or partial match
            return invLower === lowerName ||
                invLower.includes(lowerName) ||
                lowerName.includes(invLower) ||
                // Check for significant word overlap
                lowerName.split(' ').filter(w => w.length > 3).some(word => invLower.includes(word));
        });
    };

    const processImage = async (imageData: string) => {
        setState('processing');
        try {
            const result = await parseInvoiceFromImage(imageData);

            if (!result || !result.items || result.items.length === 0) {
                throw new Error('Could not extract order data from image');
            }

            setScannedData(result);

            // Process items and match with inventory
            const processed: ExtractedItem[] = result.items.map((item, idx) => {
                const match = matchInventoryItem(item.name);
                return {
                    id: `extracted-${Date.now()}-${idx}`,
                    name: item.name,
                    category: item.category || (match ? match.category : 'General'),
                    sku: item.sku || '',
                    quantity: item.quantity || 1,
                    unitCost: item.unitCost || 0,
                    packSize: item.packSize || 'Each',
                    total: (item.quantity || 1) * (item.unitCost || 0),
                    matchedInventoryId: match?.id,
                    isNew: !match,
                    addToInventory: false
                };
            });

            setExtractedItems(processed);
            const calculatedSubtotal = processed.reduce((sum, item) => sum + item.total, 0);

            setOrderDetails({
                poNumber: result.poNumber || '',
                vendor: result.vendor || '',
                orderDate: result.orderDate || new Date().toISOString().split('T')[0],
                // Use scanned subtotal if available and non-zero, otherwise fallback to calculated sum
                subtotal: result.subtotal || calculatedSubtotal,
                shippingCost: result.shippingCost || 0,
                totalTax: result.totalTax || 0
            });

            setState('preview');
        } catch (error: any) {
            console.error('Processing error:', error);
            setErrorMessage(error.message || 'Failed to process order image');
            setState('error');
        }
    };

    const toggleAddToInventory = (itemId: string) => {
        setExtractedItems(prev => prev.map(item =>
            item.id === itemId ? { ...item, addToInventory: !item.addToInventory } : item
        ));
    };

    const updateItemField = (itemId: string, field: keyof ExtractedItem, value: any) => {
        setExtractedItems(prev => prev.map(item => {
            if (item.id === itemId) {
                const updated = { ...item, [field]: value };
                if (field === 'quantity' || field === 'unitCost') {
                    updated.total = updated.quantity * updated.unitCost;
                }
                return updated;
            }
            return item;
        }));
    };

    const removeItem = (itemId: string) => {
        setExtractedItems(prev => prev.filter(item => item.id !== itemId));
    };

    const calculateTotals = () => {
        // Use the manual subtotal from state instead of recalculating from items
        const subtotal = orderDetails.subtotal;
        const grandTotal = subtotal + orderDetails.shippingCost + orderDetails.totalTax;
        return { subtotal, grandTotal };
    };

    const handleCreateOrder = () => {
        const { subtotal, grandTotal } = calculateTotals();

        // First, add new items to inventory if selected
        extractedItems.filter(item => item.isNew && item.addToInventory).forEach(item => {
            onAddToInventory({
                name: item.name,
                category: 'Consumables',
                stock: 0, // Will be updated when order is received
                unit: 'each',
                averageCost: item.unitCost,
                minStock: 5,
                maxStock: 50,
                expiryDate: '',
                batchNumber: item.sku,
                location: 'Storage'
            });
        });

        // Create the order
        const orderItems: OrderItem[] = extractedItems.map(item => ({
            id: item.id,
            inventoryItemId: item.matchedInventoryId,
            name: item.name,
            quantity: item.quantity,
            unitCost: item.unitCost,
            unitType: 'unit_each',
            total: item.total
        }));

        const order: Partial<Order> = {
            poNumber: orderDetails.poNumber || `PO-${Date.now()}`,
            vendor: orderDetails.vendor,
            orderDate: orderDetails.orderDate,
            expectedDate: '',
            status: 'PENDING',
            items: orderItems,
            subtotal,
            shippingCost: orderDetails.shippingCost,
            totalTax: orderDetails.totalTax,
            grandTotal,
            attachmentUrl: capturedImage || undefined,
            notes: `AI-scanned order with ${extractedItems.length} items`
        };

        onCreateOrder(order);
        onClose();
    };

    const handleClose = () => {
        stopCamera();
        resetState();
        onClose();
    };

    if (!isOpen) return null;

    const { subtotal, grandTotal } = calculateTotals();
    const newItemsCount = extractedItems.filter(i => i.isNew).length;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-fade-in">
            <canvas ref={canvasRef} className="hidden" />
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />

            <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-slate-800 overflow-hidden flex flex-col">

                {/* Header */}
                <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-medical-50 to-teal-50 dark:from-medical-900/10 dark:to-teal-900/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-medical-600 to-teal-600 flex items-center justify-center shadow-2xl shadow-medical-500/30">
                                <i className="fa-solid fa-wand-magic-sparkles text-3xl text-white"></i>
                            </div>
                            <div>
                                <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">
                                    AI Vision Transcribe
                                </h2>
                                <p className="text-sm font-extrabold text-slate-500 mt-2">
                                    {state === 'idle' && 'Intelligent invoice data extraction'}
                                    {state === 'camera' && 'Syncing camera lens...'}
                                    {state === 'processing' && 'Neural pattern analysis...'}
                                    {state === 'preview' && <span className="text-medical-600 uppercase tracking-widest text-[10px]">{extractedItems.length} entities detected</span>}
                                    {state === 'error' && 'System transmission error'}
                                </p>
                            </div>
                        </div>
                        <button onClick={handleClose} className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all active:scale-95">
                            <i className="fa-solid fa-xmark text-xl"></i>
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">

                    {/* Idle State - Options */}
                    {state === 'idle' && (
                        <div className="p-8 flex flex-col items-center justify-center min-h-[400px] gap-8">
                            <div className="text-center">
                                <div className="w-24 h-24 rounded-3xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-6">
                                    <i className="fa-solid fa-receipt text-5xl text-indigo-500"></i>
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Scan Your Order</h3>
                                <p className="text-slate-500 mt-2 max-w-md">
                                    Take a photo or upload an image of your order confirmation, invoice, or packing slip
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                                <button
                                    onClick={startCamera}
                                    className="flex-1 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-bold shadow-xl shadow-indigo-500/30 flex items-center justify-center gap-3 hover:scale-105 transition-all"
                                >
                                    <i className="fa-solid fa-camera text-xl"></i>
                                    Take Photo
                                </button>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 h-16 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-3 hover:scale-105 transition-all"
                                >
                                    <i className="fa-solid fa-image text-xl text-indigo-500"></i>
                                    Upload Image
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Camera State */}
                    {state === 'camera' && (
                        <div className="relative bg-black">
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-[50vh] object-cover" />
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute inset-8 border-2 border-white/40 rounded-2xl"></div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border-2 border-white/60 rounded-full"></div>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex justify-center gap-4">
                                <button onClick={() => setState('idle')} className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center">
                                    <i className="fa-solid fa-xmark text-2xl"></i>
                                </button>
                                <button onClick={capturePhoto} className="w-20 h-20 rounded-full bg-white shadow-2xl flex items-center justify-center hover:scale-110 transition-transform">
                                    <div className="w-16 h-16 rounded-full bg-indigo-600"></div>
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center">
                                    <i className="fa-solid fa-image text-xl"></i>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Processing State */}
                    {state === 'processing' && (
                        <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
                            <div className="relative">
                                <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center animate-pulse">
                                    <i className="fa-solid fa-wand-magic-sparkles text-5xl text-white"></i>
                                </div>
                                <div className="absolute -inset-4 rounded-[2rem] border-4 border-indigo-500/30 animate-ping"></div>
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-8">Analyzing Order...</h3>
                            <p className="text-slate-500 mt-2">AI is extracting order details</p>
                            <div className="flex gap-2 mt-6">
                                {[0, 1, 2].map(i => (
                                    <div key={i} className="w-3 h-3 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}></div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {state === 'error' && (
                        <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
                            <div className="w-24 h-24 rounded-3xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
                                <i className="fa-solid fa-triangle-exclamation text-5xl text-red-500"></i>
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white">Extraction Failed</h3>
                            <p className="text-slate-500 mt-2 text-center max-w-md">{errorMessage}</p>
                            <button
                                onClick={resetState}
                                className="mt-6 h-14 px-8 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:scale-105 transition-all"
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    {/* Preview State */}
                    {state === 'preview' && (
                        <div className="p-6 space-y-6">

                            {/* Order Details */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vendor</label>
                                    <input
                                        type="text"
                                        value={orderDetails.vendor}
                                        onChange={(e) => setOrderDetails(prev => ({ ...prev, vendor: e.target.value }))}
                                        className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">PO Number</label>
                                    <input
                                        type="text"
                                        value={orderDetails.poNumber}
                                        onChange={(e) => setOrderDetails(prev => ({ ...prev, poNumber: e.target.value }))}
                                        className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Order Date</label>
                                    <input
                                        type="date"
                                        value={orderDetails.orderDate}
                                        onChange={(e) => setOrderDetails(prev => ({ ...prev, orderDate: e.target.value }))}
                                        className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div className="flex items-end">
                                    {scannedData?.confidence && (
                                        <div className={`h-12 px-5 rounded-2xl flex items-center gap-3 border shadow-sm ${scannedData.confidence >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                            scannedData.confidence >= 50 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                'bg-red-50 text-red-700 border-red-100'
                                            }`}>
                                            <i className="fa-solid fa-microchip text-xs"></i>
                                            <span className="font-extrabold text-[10px] uppercase tracking-widest">{scannedData.confidence}% Accuracy</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="border border-slate-100 dark:border-slate-800 rounded-[2rem] overflow-hidden luxury-shadow">
                                <div className="bg-slate-50/50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-100 dark:border-slate-800 backdrop-blur-xl">
                                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-widest">
                                        <i className="fa-solid fa-list-check text-medical-600"></i>
                                        Transcription Layer ({extractedItems.length} units)
                                    </h4>
                                </div>
                                <div className="divide-y divide-slate-50 dark:divide-slate-800/50 max-h-[350px] overflow-y-auto custom-scrollbar">
                                    {extractedItems.map((item) => (
                                        <div key={item.id} className={`p-6 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${item.isNew ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''}`}>
                                            <div className="flex items-center gap-6">
                                                {/* Status Badge */}
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm border ${item.isNew
                                                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 border-amber-200/50'
                                                    : 'bg-medical-100 dark:bg-medical-900/30 text-medical-600 border-medical-200/50'
                                                    }`}>
                                                    <i className={`fa-solid ${item.isNew ? 'fa-plus' : 'fa-check-double'} text-lg`}></i>
                                                </div>

                                                {/* Item Details */}
                                                <div className="flex-1 min-w-0">
                                                    <input
                                                        type="text"
                                                        value={item.name}
                                                        onChange={(e) => updateItemField(item.id, 'name', e.target.value)}
                                                        className="w-full font-extrabold text-lg text-slate-900 dark:text-white bg-transparent border-none focus:ring-0 p-0 tracking-tight"
                                                    />
                                                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                                        {item.sku && (
                                                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-extrabold text-slate-500 uppercase tracking-tight shadow-sm">
                                                                #{item.sku}
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{item.packSize}</span>
                                                        {item.isNew && (
                                                            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 text-[9px] font-extrabold uppercase tracking-[0.15em] border border-amber-200/50">
                                                                Unknown Entity
                                                            </span>
                                                        )}
                                                        {!item.isNew && (
                                                            <span className="px-3 py-1 rounded-full bg-medical-100 text-medical-700 dark:bg-medical-900/50 dark:text-medical-300 text-[9px] font-extrabold uppercase tracking-[0.15em] border border-medical-200/50">
                                                                Manifest Verified
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Quantity & Price */}
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl p-1 shadow-inner">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={item.quantity}
                                                            onChange={(e) => updateItemField(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                                            className="w-14 h-10 text-center bg-transparent font-extrabold text-slate-900 dark:text-white border-none focus:ring-0"
                                                        />
                                                        <span className="text-slate-400 font-extrabold px-1">×</span>
                                                        <div className="relative">
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold">$</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={item.unitCost}
                                                                onChange={(e) => updateItemField(item.id, 'unitCost', parseFloat(e.target.value) || 0)}
                                                                className="w-24 h-10 text-right pr-4 pl-6 bg-transparent font-extrabold text-slate-900 dark:text-white border-none focus:ring-0"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="w-28 text-right">
                                                        <div className="text-xl font-extrabold text-medical-600 dark:text-medical-400 tracking-tight">
                                                            ${item.total.toFixed(2)}
                                                        </div>
                                                    </div>

                                                    {/* Contextual Actions */}
                                                    <div className="flex items-center gap-2 border-l border-slate-100 dark:border-slate-800 pl-4 ml-2">
                                                        {item.isNew && (
                                                            <button
                                                                onClick={() => toggleAddToInventory(item.id)}
                                                                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${item.addToInventory
                                                                    ? 'bg-medical-600 text-white shadow-lg shadow-medical-500/30'
                                                                    : 'bg-white dark:bg-slate-900 text-slate-400 border border-slate-100 dark:border-slate-800 hover:text-medical-600'
                                                                    }`}
                                                                title="Register to Manifest"
                                                            >
                                                                <i className="fa-solid fa-plus-circle text-lg"></i>
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => removeItem(item.id)}
                                                            className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors border border-red-100/50"
                                                        >
                                                            <i className="fa-solid fa-trash-alt"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Totals */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4">
                                <div className="p-5 rounded-[2rem] bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 shadow-inner group">
                                    <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Subtotal</div>
                                    <div className="relative">
                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-900 dark:text-white font-extrabold text-2xl">$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={orderDetails.subtotal}
                                            onChange={(e) => setOrderDetails(prev => ({ ...prev, subtotal: parseFloat(e.target.value) || 0 }))}
                                            className="w-full h-10 pl-6 pr-2 rounded-xl border-none bg-transparent text-2xl text-slate-900 dark:text-white font-extrabold focus:ring-0 p-0 tracking-tight"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2 group">
                                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">Taxation</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold">$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={orderDetails.totalTax}
                                            onChange={(e) => setOrderDetails(prev => ({ ...prev, totalTax: parseFloat(e.target.value) || 0 }))}
                                            className="w-full h-14 pl-10 pr-6 rounded-2xl border-none bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white font-extrabold focus:ring-4 ring-medical-500/10 transition-all outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2 group">
                                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">Logistics</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold">$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={orderDetails.shippingCost}
                                            onChange={(e) => setOrderDetails(prev => ({ ...prev, shippingCost: parseFloat(e.target.value) || 0 }))}
                                            className="w-full h-14 pl-10 pr-6 rounded-2xl border-none bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white font-extrabold focus:ring-4 ring-medical-500/10 transition-all outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="p-5 rounded-[2rem] bg-gradient-to-br from-medical-600 to-teal-600 shadow-2xl shadow-medical-500/30">
                                    <div className="text-[10px] font-extrabold text-white/70 uppercase tracking-widest mb-1">Combined Total</div>
                                    <div className="text-3xl font-extrabold text-white tracking-tighter">${grandTotal.toFixed(2)}</div>
                                </div>
                            </div>

                            {/* New Items Alert */}
                            {newItemsCount > 0 && (
                                <div className="flex items-center gap-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                                    <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600">
                                        <i className="fa-solid fa-box-open text-xl"></i>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-amber-800 dark:text-amber-200">{newItemsCount} New Items Detected</h4>
                                        <p className="text-sm text-amber-700 dark:text-amber-300">Click the <i className="fa-solid fa-plus-circle"></i> icon to add them to your inventory</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {state === 'preview' && (
                    <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex gap-6">
                        <button
                            onClick={resetState}
                            className="flex-1 h-16 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-extrabold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-3 tracking-tight"
                        >
                            <i className="fa-solid fa-camera-rotate text-lg"></i>
                            Re-Scan Document
                        </button>
                        <button
                            onClick={handleCreateOrder}
                            disabled={extractedItems.length === 0}
                            className="flex-1 h-16 rounded-[1.25rem] bg-gradient-to-r from-medical-600 to-teal-600 text-white font-extrabold shadow-2xl shadow-medical-500/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-4 text-lg tracking-tight"
                        >
                            <i className="fa-solid fa-file-circle-check text-xl"></i>
                            Finalize Order Entry
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrderScannerModal;
