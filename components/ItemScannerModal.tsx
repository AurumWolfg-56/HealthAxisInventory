import React, { useState, useRef, useCallback } from 'react';
import { ScannedItemData, scanItemLabel } from '../services/geminiService';
import { InventoryItem } from '../types';

interface ItemScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddItem: (item: Omit<InventoryItem, 'id'>) => void;
    t: (key: string) => string;
}

type ScannerState = 'idle' | 'camera' | 'processing' | 'preview' | 'error';

const ItemScannerModal: React.FC<ItemScannerModalProps> = ({ isOpen, onClose, onAddItem, t }) => {
    const [state, setState] = useState<ScannerState>('idle');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [scannedData, setScannedData] = useState<ScannedItemData | null>(null);
    const [editedData, setEditedData] = useState<Partial<ScannedItemData>>({});
    const [errorMessage, setErrorMessage] = useState<string>('');

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const CATEGORIES = [
        'Surgical', 'Pharma', 'PPE', 'Diagnostics', 'Laboratory',
        'Wound Care', 'Respiratory', 'Cardiovascular', 'Orthopedic',
        'Consumables', 'Equipment', 'Office Supplies'
    ];

    const LOCATIONS = [
        'Front Desk', "Manager's Office", 'Nursing Station / Provider Station',
        'Exam Rooms', 'Soiled Utility Room', 'Break Room', 'Laboratory'
    ];

    const UNITS = ['each', 'box', 'pack', 'case', 'vial', 'bottle', 'roll', 'pair'];

    // Start camera
    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setState('camera');
        } catch (err) {
            console.error('Camera error:', err);
            setErrorMessage('Unable to access camera. Please grant permission or use file upload.');
            setState('error');
        }
    }, []);

    // Stop camera
    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    // Capture photo from camera
    const capturePhoto = useCallback(() => {
        if (videoRef.current && canvasRef.current) {
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
        }
    }, [stopCamera]);

    // Handle file upload
    const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageData = e.target?.result as string;
                setCapturedImage(imageData);
                processImage(imageData);
            };
            reader.readAsDataURL(file);
        }
    }, []);

    // Process image with Gemini
    const processImage = async (imageData: string) => {
        setState('processing');
        setErrorMessage('');

        try {
            const result = await scanItemLabel(imageData);
            setScannedData(result);
            setEditedData(result);
            setState('preview');
        } catch (err: any) {
            console.error('Scan error:', err);
            setErrorMessage(err.message || 'Failed to analyze image. Please try again.');
            setState('error');
        }
    };

    // Save item to inventory
    const handleSave = () => {
        if (!editedData.name) return;

        const newItem: Omit<InventoryItem, 'id'> = {
            name: editedData.name || '',
            category: editedData.category || 'Consumables',
            stock: editedData.stock || 1,
            unit: editedData.unit || 'each',
            minStock: editedData.minStock || 5,
            maxStock: editedData.maxStock || 25,
            expiryDate: editedData.expiryDate || '',
            batchNumber: editedData.batchNumber || '',
            location: editedData.location || 'Exam Rooms',
            averageCost: editedData.averageCost || 0,
        };

        onAddItem(newItem);
        handleClose();
    };

    // Reset and close modal
    const handleClose = () => {
        stopCamera();
        setState('idle');
        setCapturedImage(null);
        setScannedData(null);
        setEditedData({});
        setErrorMessage('');
        onClose();
    };

    // Retry scan
    const handleRetry = () => {
        setCapturedImage(null);
        setScannedData(null);
        setEditedData({});
        setErrorMessage('');
        setState('idle');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-fade-in">
            <div className="w-full max-w-2xl max-h-[95vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-slate-800">

                {/* Header */}
                <div className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-6 border-b border-slate-100 dark:border-slate-800 rounded-t-[2.5rem]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/30">
                                <i className="fa-solid fa-wand-magic-sparkles text-2xl text-white"></i>
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">AI Item Scanner</h2>
                                <p className="text-sm text-slate-500">Powered by Gemini 2.0 Flash</p>
                            </div>
                        </div>
                        <button onClick={handleClose} className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all">
                            <i className="fa-solid fa-xmark text-xl"></i>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">

                    {/* IDLE STATE - Selection */}
                    {state === 'idle' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button
                                onClick={startCamera}
                                className="group p-8 rounded-3xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-2 border-dashed border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 transition-all flex flex-col items-center gap-4"
                            >
                                <div className="w-20 h-20 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <i className="fa-solid fa-camera text-3xl text-indigo-600"></i>
                                </div>
                                <div className="text-center">
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white">Take Photo</h3>
                                    <p className="text-sm text-slate-500 mt-1">Use your camera to scan a label</p>
                                </div>
                            </button>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="group p-8 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-2 border-dashed border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 transition-all flex flex-col items-center gap-4"
                            >
                                <div className="w-20 h-20 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <i className="fa-solid fa-cloud-arrow-up text-3xl text-emerald-600"></i>
                                </div>
                                <div className="text-center">
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white">Upload Image</h3>
                                    <p className="text-sm text-slate-500 mt-1">Select a photo from your device</p>
                                </div>
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </div>
                    )}

                    {/* CAMERA STATE */}
                    {state === 'camera' && (
                        <div className="space-y-4">
                            <div className="relative rounded-3xl overflow-hidden bg-black aspect-video">
                                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                                <div className="absolute inset-0 pointer-events-none border-4 border-white/30 rounded-3xl">
                                    <div className="absolute inset-8 border-2 border-dashed border-white/50 rounded-2xl flex items-center justify-center">
                                        <span className="bg-black/50 text-white px-4 py-2 rounded-full text-sm font-bold">
                                            Center the label here
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4 justify-center">
                                <button
                                    onClick={handleRetry}
                                    className="px-6 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all"
                                >
                                    <i className="fa-solid fa-arrow-left mr-2"></i> Back
                                </button>
                                <button
                                    onClick={capturePhoto}
                                    className="px-8 py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-500/30 hover:bg-indigo-700 transition-all flex items-center gap-3"
                                >
                                    <i className="fa-solid fa-camera text-xl"></i> Capture
                                </button>
                            </div>
                            <canvas ref={canvasRef} className="hidden" />
                        </div>
                    )}

                    {/* PROCESSING STATE */}
                    {state === 'processing' && (
                        <div className="py-16 flex flex-col items-center gap-6">
                            <div className="relative">
                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center animate-pulse">
                                    <i className="fa-solid fa-brain text-4xl text-white"></i>
                                </div>
                                <div className="absolute inset-0 rounded-full border-4 border-indigo-300 border-t-transparent animate-spin"></div>
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-black text-slate-900 dark:text-white">Analyzing Image...</h3>
                                <p className="text-slate-500 mt-2">Gemini 2.0 is extracting item data</p>
                            </div>
                            {capturedImage && (
                                <img src={capturedImage} alt="Captured" className="w-48 h-48 object-cover rounded-2xl opacity-50" />
                            )}
                        </div>
                    )}

                    {/* ERROR STATE */}
                    {state === 'error' && (
                        <div className="py-12 flex flex-col items-center gap-6">
                            <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <i className="fa-solid fa-triangle-exclamation text-4xl text-red-500"></i>
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-black text-slate-900 dark:text-white">Scan Failed</h3>
                                <p className="text-slate-500 mt-2 max-w-sm">{errorMessage}</p>
                            </div>
                            <button
                                onClick={handleRetry}
                                className="px-8 py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl hover:bg-indigo-700 transition-all"
                            >
                                <i className="fa-solid fa-rotate-right mr-2"></i> Try Again
                            </button>
                        </div>
                    )}

                    {/* PREVIEW STATE - Editable Form */}
                    {state === 'preview' && scannedData && (
                        <div className="space-y-6">
                            {/* Confidence Badge */}
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                                <div className="flex items-center gap-3">
                                    <img src={capturedImage || ''} alt="Scanned" className="w-16 h-16 object-cover rounded-xl" />
                                    <div>
                                        <p className="text-sm font-bold text-slate-500">Extraction Complete</p>
                                        <p className="text-xs text-slate-400">Review and edit if needed</p>
                                    </div>
                                </div>
                                <div className={`px-4 py-2 rounded-full font-black text-sm ${scannedData.confidence >= 80 ? 'bg-emerald-100 text-emerald-700' :
                                        scannedData.confidence >= 50 ? 'bg-amber-100 text-amber-700' :
                                            'bg-red-100 text-red-700'
                                    }`}>
                                    {scannedData.confidence}% Confidence
                                </div>
                            </div>

                            {/* Editable Fields */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Name */}
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Product Name *</label>
                                    <input
                                        type="text"
                                        value={editedData.name || ''}
                                        onChange={(e) => setEditedData(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full h-14 px-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-lg font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                    />
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Category</label>
                                    <select
                                        value={editedData.category || ''}
                                        onChange={(e) => setEditedData(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full h-14 px-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                                    >
                                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>

                                {/* Location */}
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Location</label>
                                    <select
                                        value={editedData.location || ''}
                                        onChange={(e) => setEditedData(prev => ({ ...prev, location: e.target.value }))}
                                        className="w-full h-14 px-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                                    >
                                        {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                                    </select>
                                </div>

                                {/* Stock */}
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Initial Stock</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editedData.stock || 0}
                                        onChange={(e) => setEditedData(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                                        className="w-full h-14 px-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-lg font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                                    />
                                </div>

                                {/* Unit */}
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Unit</label>
                                    <select
                                        value={editedData.unit || 'each'}
                                        onChange={(e) => setEditedData(prev => ({ ...prev, unit: e.target.value }))}
                                        className="w-full h-14 px-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                                    >
                                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>

                                {/* Batch Number */}
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Batch / Lot #</label>
                                    <input
                                        type="text"
                                        value={editedData.batchNumber || ''}
                                        onChange={(e) => setEditedData(prev => ({ ...prev, batchNumber: e.target.value }))}
                                        className="w-full h-14 px-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                                        placeholder="LOT12345"
                                    />
                                </div>

                                {/* Expiry Date */}
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Expiry Date</label>
                                    <input
                                        type="date"
                                        value={editedData.expiryDate || ''}
                                        onChange={(e) => setEditedData(prev => ({ ...prev, expiryDate: e.target.value }))}
                                        className="w-full h-14 px-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                                    />
                                </div>

                                {/* Min Stock */}
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Min Stock</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editedData.minStock || 0}
                                        onChange={(e) => setEditedData(prev => ({ ...prev, minStock: parseInt(e.target.value) || 0 }))}
                                        className="w-full h-14 px-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-lg font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                                    />
                                </div>

                                {/* Max Stock */}
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Max Stock</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editedData.maxStock || 0}
                                        onChange={(e) => setEditedData(prev => ({ ...prev, maxStock: parseInt(e.target.value) || 0 }))}
                                        className="w-full h-14 px-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-lg font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                                    />
                                </div>

                                {/* Average Cost */}
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Unit Cost ($)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={editedData.averageCost || 0}
                                        onChange={(e) => setEditedData(prev => ({ ...prev, averageCost: parseFloat(e.target.value) || 0 }))}
                                        className="w-full h-14 px-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-lg font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={handleRetry}
                                    className="flex-1 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all"
                                >
                                    <i className="fa-solid fa-rotate-right mr-2"></i> Scan Again
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!editedData.name}
                                    className="flex-1 h-14 rounded-2xl bg-emerald-600 text-white font-black shadow-xl shadow-emerald-500/30 hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                >
                                    <i className="fa-solid fa-check text-xl"></i> Add to Inventory
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ItemScannerModal;
