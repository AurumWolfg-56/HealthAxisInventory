
import React, { useState, useEffect, useRef } from 'react';
import { Order, OrderItem, InventoryItem } from '../types';
import { parseInvoiceFromImage, INVENTORY_CATEGORIES } from '../services/geminiService';
import Webcam from 'react-webcam';

interface OrderFormProps {
    onSave: (order: Partial<Order>) => void;
    onCancel: () => void;
    existingInventory: InventoryItem[];
    initialData?: Partial<Order>;
    t: (key: string) => string;
    isSaving?: boolean;
}

const UNITS = ['unit_each', 'unit_box', 'unit_pack', 'unit_bottle', 'unit_vial', 'unit_tube', 'unit_roll', 'unit_kit', 'unit_ream', 'unit_liter', 'unit_gallon', 'unit_ampoule'];

const VENDOR_PRESETS = [
    {
        name: 'Amazon',
        logo: '/logos/amazon_premium.png',
        logoBg: 'bg-[#232f3e]',
        color: 'from-orange-500 to-amber-500',
        bgColor: 'bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900/50 dark:to-slate-800/50',
        glowColor: 'shadow-orange-500/40',
        borderActive: 'border-orange-400',
        textColor: 'text-orange-600 dark:text-orange-400'
    },
    {
        name: 'Labcorp',
        logo: '/logos/labcorp_premium_v2.png',
        logoBg: 'bg-[#002855]',
        color: 'from-[#00AADF] to-blue-600',
        bgColor: 'bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/30 dark:to-blue-900/30',
        glowColor: 'shadow-[#00AADF]/40',
        borderActive: 'border-[#00AADF]',
        textColor: 'text-[#00AADF] dark:text-cyan-400'
    },
    {
        name: 'Henry Schein',
        logo: '/logos/henry_schein_premium_v2.png',
        logoBg: 'bg-[#003da5]',
        color: 'from-red-600 to-blue-700',
        bgColor: 'bg-gradient-to-br from-red-50 to-blue-50 dark:from-red-900/30 dark:to-blue-900/30',
        glowColor: 'shadow-red-500/40',
        borderActive: 'border-red-500',
        textColor: 'text-red-600 dark:text-red-400'
    },
    {
        name: 'Medline',
        logo: '/logos/medline_premium_v2.png',
        logoBg: 'bg-[#004b87]',
        color: 'from-[#004b87] to-indigo-700',
        bgColor: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30',
        glowColor: 'shadow-[#004b87]/40',
        borderActive: 'border-[#004b87]',
        textColor: 'text-[#004b87] dark:text-blue-300'
    },
    {
        name: 'McKesson',
        logo: '/logos/mckesson_premium_v2.png',
        logoBg: 'bg-[#002d72]',
        color: 'from-[#002d72] to-slate-800',
        bgColor: 'bg-gradient-to-br from-blue-50 to-slate-100 dark:from-blue-900/30 dark:to-slate-900/30',
        glowColor: 'shadow-[#002d72]/40',
        borderActive: 'border-[#002d72]',
        textColor: 'text-[#002d72] dark:text-blue-300'
    }
];

const OrderForm: React.FC<OrderFormProps> = ({ onSave, onCancel, existingInventory, initialData, t, isSaving }) => {
    const [formData, setFormData] = useState<Partial<Order>>({
        poNumber: `PO-${Date.now().toString().slice(-6)}`,
        vendor: '',
        orderDate: new Date().toISOString().split('T')[0],
        expectedDate: '',
        status: 'DRAFT',
        items: [],
        subtotal: 0,
        shippingCost: 0,
        totalTax: 0,
        grandTotal: 0,
        notes: ''
    });

    const [showCamera, setShowCamera] = useState(false);
    const [isProcessingAI, setIsProcessingAI] = useState(false);

    // Custom Autocomplete State
    const [activeSearchRow, setActiveSearchRow] = useState<string | null>(null);
    const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);

    const webcamRef = useRef<Webcam>(null);

    const [isSubtotalManual, setIsSubtotalManual] = useState(false);

    // Initialize data
    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({ ...prev, ...initialData }));

            // Check if subtotal was manually edited (differs from sum of items)
            if (initialData.items && initialData.subtotal) {
                const sum = initialData.items.reduce((s, i) => s + (i.total || 0), 0);
                if (Math.abs(sum - initialData.subtotal) > 0.05) { // Small epsilon
                    setIsSubtotalManual(true);
                }
            }
        }
    }, [initialData]);

    // Math: Calculate Totals
    useEffect(() => {
        const itemSum = formData.items?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;

        let effectiveSubtotal = formData.subtotal || 0;
        if (!isSubtotalManual) {
            effectiveSubtotal = parseFloat(itemSum.toFixed(2));
        }

        const tax = formData.totalTax || 0;
        const grand = effectiveSubtotal + tax + (formData.shippingCost || 0);

        if (effectiveSubtotal !== formData.subtotal || grand !== formData.grandTotal) {
            setFormData(prev => ({
                ...prev,
                subtotal: effectiveSubtotal,
                grandTotal: parseFloat(grand.toFixed(2))
            }));
        }
    }, [formData.items, formData.totalTax, formData.shippingCost, isSubtotalManual]);

    const handleAddItem = () => {
        const newItem: OrderItem = {
            id: Date.now().toString(),
            name: '',
            category: 'General',
            quantity: 1,
            unitCost: 0,
            unitType: 'unit_each',
            total: 0
        };
        setFormData(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
    };

    const handleItemChange = (id: string, field: keyof OrderItem, value: any) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items?.map(item => {
                if (item.id === id) {
                    const updated = { ...item, [field]: value };

                    if (field === 'quantity' || field === 'unitCost') {
                        updated.total = parseFloat((updated.quantity * updated.unitCost).toFixed(2));
                    }

                    if (field === 'total') {
                        if (updated.quantity > 0) {
                            updated.unitCost = parseFloat((updated.total / updated.quantity).toFixed(4));
                        } else {
                            updated.unitCost = 0;
                        }
                    }
                    return updated;
                }
                return item;
            })
        }));
    };

    // Special handler when selecting from suggestions
    const handleSelectItem = (rowId: string, inventoryItem: InventoryItem) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items?.map(item => {
                if (item.id === rowId) {
                    return {
                        ...item,
                        name: inventoryItem.name,
                        category: inventoryItem.category,
                        inventoryItemId: inventoryItem.id,
                        unitType: inventoryItem.unit,
                        // We do NOT autofill cost, so user enters current price for comparison
                    };
                }
                return item;
            })
        }));
        setActiveSearchRow(null); // Close dropdown
    };

    const handleRemoveItem = (id: string) => {
        setFormData(prev => ({ ...prev, items: prev.items?.filter(i => i.id !== id) }));
    };

    const handleVendorSelect = (vendor: typeof VENDOR_PRESETS[0]) => {
        setFormData(prev => ({ ...prev, vendor: vendor.name }));
        setShowVendorSuggestions(false);
    };

    const captureInvoice = async () => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (!imageSrc) return;

        setIsProcessingAI(true);
        try {
            const result = await parseInvoiceFromImage(imageSrc);
            if (result) {
                setFormData(prev => ({
                    ...prev,
                    poNumber: result.poNumber || prev.poNumber,
                    vendor: result.vendor || prev.vendor,
                    orderDate: result.orderDate || prev.orderDate,
                    shippingCost: result.shippingCost || prev.shippingCost,
                    totalTax: result.totalTax || prev.totalTax,
                    items: result.items?.map((aiItem: any, idx: number) => ({
                        id: `ai-${Date.now()}-${idx}`,
                        name: aiItem.name || 'Unknown Item',
                        category: aiItem.category || 'General',
                        quantity: aiItem.quantity || 1,
                        unitCost: aiItem.unitCost || 0,
                        unitType: 'unit_each',
                        total: (aiItem.quantity || 1) * (aiItem.unitCost || 0),
                        inventoryItemId: existingInventory.find(inv => inv.name.toLowerCase() === (aiItem.name || '').toLowerCase())?.id
                    })) || prev.items
                }));
            }
        } catch (e) {
            alert("Failed to read invoice");
        } finally {
            setIsProcessingAI(false);
            setShowCamera(false);
        }
    };

    // Helper to calculate price variance
    const getPriceComparison = (item: OrderItem) => {
        if (!item.inventoryItemId) return null;

        const invItem = existingInventory.find(i => i.id === item.inventoryItemId);
        if (!invItem || !invItem.averageCost || invItem.averageCost === 0) return null;

        const currentCost = item.unitCost;
        const historyCost = invItem.averageCost;

        const diff = currentCost - historyCost;
        const percent = (diff / historyCost) * 100;

        const isCheaper = diff < 0;
        const isSame = diff === 0;

        return {
            historyCost,
            diff,
            percent: Math.abs(percent).toFixed(1),
            isCheaper,
            isSame
        };
    };

    if (showCamera) {
        return (
            <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
                {/* @ts-ignore - Usage requires prop override */}
                <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" className="w-full h-full object-cover opacity-60" />
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                    {isProcessingAI ? (
                        <div className="text-white text-xl font-bold animate-pulse">Processing Invoice...</div>
                    ) : (
                        <>
                            <div className="w-64 h-80 border-2 border-medical-500 rounded-lg mb-4 shadow-[0_0_15px_rgba(14,165,233,0.5)]"></div>
                            <button onClick={captureInvoice} className="bg-white w-16 h-16 rounded-full border-4 border-gray-300 hover:scale-105 transition-transform"></button>
                            <button onClick={() => setShowCamera(false)} className="mt-8 text-white bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">Cancel Camera</button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // --- Sub Component for Suggestion List ---
    const Suggestions = ({ searchTerm, rowId }: { searchTerm: string, rowId: string }) => {
        const matches = existingInventory.filter(inv =>
            inv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inv.category.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 5); // Limit to 5 suggestions

        if (matches.length === 0) return null;

        return (
            <div className="absolute z-50 left-0 top-full mt-2 w-[350px] bg-white dark:bg-gray-900/95 backdrop-blur-xl border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Suggested Items
                </div>
                {matches.map(inv => (
                    <div
                        key={inv.id}
                        onMouseDown={(e) => { e.preventDefault(); handleSelectItem(rowId, inv); }} // Use onMouseDown to prevent blur event firing first
                        className="p-3 hover:bg-medical-50 dark:hover:bg-medical-900/20 cursor-pointer flex items-center justify-between group transition-colors border-b border-gray-50 dark:border-gray-800 last:border-0"
                    >
                        <div>
                            <div className="font-bold text-sm text-gray-800 dark:text-gray-200 group-hover:text-medical-600 dark:group-hover:text-medical-400">{inv.name}</div>
                            <div className="flex gap-2 mt-1">
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500">{inv.category}</span>
                                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                    <i className="fa-solid fa-location-dot"></i> {inv.location}
                                </span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className={`text-xs font-bold ${inv.stock <= inv.minStock ? 'text-red-500' : 'text-emerald-500'}`}>
                                {inv.stock} <span className="text-[10px] font-normal text-gray-400">{inv.unit}</span>
                            </div>
                            <div className="text-[10px] text-gray-400">Current Stock</div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const getActiveVendorLogo = () => {
        if (!formData.vendor) return null;
        const match = VENDOR_PRESETS.find(v =>
            formData.vendor!.toLowerCase().includes(v.name.toLowerCase()) ||
            v.name.toLowerCase().includes(formData.vendor!.toLowerCase())
        );
        return match ? match.logo : null;
    };

    const getActiveVendorTheme = () => {
        if (!formData.vendor) return undefined;
        return VENDOR_PRESETS.find(v =>
            formData.vendor!.toLowerCase().includes(v.name.toLowerCase()) ||
            v.name.toLowerCase().includes(formData.vendor!.toLowerCase())
        );
    };

    const activeTheme = getActiveVendorTheme();

    const handleSaveOrder = () => {
        if (!formData.vendor) {
            alert("Please select or enter a vendor.");
            return;
        }
        if (!formData.items || formData.items.length === 0) {
            alert("Please add at least one item to the order.");
            return;
        }
        onSave(formData);
    };

    return (
        <div className={`glass-panel rounded-[2.5rem] p-6 md:p-10 shadow-glass max-w-5xl mx-auto relative overflow-hidden transition-all duration-500 ease-out ${activeTheme ? 'border-2 ' + activeTheme.borderActive : ''}`}>
            {/* Dynamic Background */}
            {activeTheme && (
                <div className={`absolute inset-0 opacity-5 bg-gradient-to-br ${activeTheme.color} pointer-events-none transition-opacity duration-1000`}></div>
            )}

            {/* Decorative Gradients */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-medical-500/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

            <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
                <div>
                    <div className="flex items-center gap-4 mb-3">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-medical-600 to-teal-600 flex items-center justify-center text-white shadow-2xl shadow-medical-500/30">
                            <i className="fa-solid fa-file-invoice text-2xl"></i>
                        </div>
                        <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">{t('ord_form_title')}</h2>
                    </div>
                    <p className="text-sm font-extrabold text-slate-500 dark:text-slate-400 ml-1">
                        <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${formData.status === 'DRAFT' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300' : 'bg-orange-100 text-orange-600'} border border-white/20 shadow-sm`}>
                            <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                            {formData.status}
                        </span>
                    </p>
                </div>
                <button
                    onClick={() => setShowCamera(true)}
                    className="h-14 px-8 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-sm font-extrabold shadow-2xl hover:shadow-medical-500/10 flex items-center gap-3 transition-all transform hover:scale-105 active:scale-95"
                >
                    <i className="fa-solid fa-camera text-lg"></i>
                    <span className="tracking-tight">{t('btn_scan_invoice')}</span>
                </button>
            </div>

            {/* Header Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 bg-white/40 dark:bg-slate-800/40 p-6 rounded-[2.5rem] border border-white/50 dark:border-slate-800/80 backdrop-blur-xl luxury-shadow">
                <div className="space-y-2 group">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">{t('lbl_po')}</label>
                    <div className="relative">
                        <i className="fa-solid fa-hashtag absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-medical-500 transition-colors"></i>
                        <input
                            type="text"
                            value={formData.poNumber}
                            onChange={e => setFormData({ ...formData, poNumber: e.target.value })}
                            className="w-full pl-12 pr-6 h-14 rounded-2xl border-none bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white font-mono font-extrabold focus:ring-4 ring-medical-500/10 transition-all outline-none"
                        />
                    </div>
                </div>

                {/* Enhanced Vendor Autocomplete with Logos */}
                <div className="space-y-2 group relative">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">{t('lbl_vendor')}</label>
                    <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center">
                            {getActiveVendorLogo() ? (
                                <img src={getActiveVendorLogo()!} alt="logo" className="w-full h-full object-contain rounded-lg" />
                            ) : (
                                <i className="fa-solid fa-building text-slate-400 group-focus-within:text-medical-500 transition-colors text-lg"></i>
                            )}
                        </div>
                        <input
                            type="text"
                            value={formData.vendor}
                            onFocus={() => setShowVendorSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowVendorSuggestions(false), 200)}
                            placeholder={t('ph_select_vendor')}
                            onChange={e => setFormData({ ...formData, vendor: e.target.value })}
                            className="w-full pl-14 pr-6 h-14 rounded-2xl border-none bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white font-extrabold focus:ring-4 ring-medical-500/10 transition-all outline-none"
                        />

                        {showVendorSuggestions && (
                            <div className="absolute top-full left-0 right-0 mt-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 dark:border-slate-800 overflow-hidden z-20 animate-fade-in-up">
                                {VENDOR_PRESETS.filter(v => v.name.toLowerCase().includes((formData.vendor || '').toLowerCase())).map(v => (
                                    <div
                                        key={v.name}
                                        onClick={() => handleVendorSelect(v)}
                                        className="flex items-center gap-4 p-4 hover:bg-medical-50 dark:hover:bg-medical-900/20 cursor-pointer transition-colors border-b border-slate-50 dark:border-slate-800 last:border-0"
                                    >
                                        <div className={`w-10 h-10 rounded-xl border border-white/20 ${v.logoBg} p-1.5 flex items-center justify-center shadow-md overflow-hidden transform group-hover:scale-110 transition-transform`}>
                                            <img src={v.logo} alt={v.name} className="max-w-full max-h-full object-contain" />
                                        </div>
                                        <span className="font-extrabold text-slate-700 dark:text-slate-200 tracking-tight">{v.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-2 group">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">{t('lbl_date')}</label>
                    <div className="relative">
                        <i className="fa-solid fa-calendar absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-medical-500 transition-colors"></i>
                        <input
                            type="date"
                            value={formData.orderDate}
                            onChange={e => setFormData({ ...formData, orderDate: e.target.value })}
                            className="w-full pl-12 pr-6 h-14 rounded-2xl border-none bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white font-extrabold focus:ring-4 ring-medical-500/10 transition-all outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Items Table - Redesigned */}
            <div className="mb-6">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-4 mb-3 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                    <div className="col-span-1 text-center">#</div>
                    <div className="col-span-4">{t('th_details')}</div>
                    <div className="col-span-2">{t('lbl_category')}</div>
                    <div className="col-span-1 text-center">{t('th_qty')}</div>
                    <div className="col-span-2 text-right">{t('th_cost')}</div>
                    <div className="col-span-1 text-right">{t('th_total')}</div>
                    <div className="col-span-1"></div>
                </div>

                <div className="space-y-3">
                    {formData.items?.map((item, idx) => {
                        const comparison = getPriceComparison(item);

                        return (
                            <div key={item.id} className="relative group grid grid-cols-12 gap-4 items-center bg-white dark:bg-gray-800/40 p-3 rounded-2xl border border-transparent hover:border-medical-200 dark:hover:border-medical-900 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">

                                {/* Index */}
                                <div className="col-span-1 text-center font-mono text-xs text-gray-400 font-bold">{idx + 1}</div>

                                {/* Autocomplete Item Input */}
                                <div className="col-span-4 relative">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm shadow-md transition-colors ${item.inventoryItemId ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                            <i className={`fa-solid ${item.inventoryItemId ? 'fa-link' : 'fa-box-open'}`}></i>
                                        </div>
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={item.name}
                                                onChange={e => {
                                                    handleItemChange(item.id, 'name', e.target.value);
                                                    setActiveSearchRow(item.id);
                                                }}
                                                onFocus={() => setActiveSearchRow(item.id)}
                                                onBlur={() => setTimeout(() => setActiveSearchRow(null), 200)}
                                                placeholder={t('ph_search_item')}
                                                className="w-full bg-transparent border-none focus:ring-0 p-0 font-bold text-gray-900 dark:text-white placeholder-gray-400 text-sm"
                                            />
                                            {item.inventoryItemId && <div className="text-[10px] text-emerald-500 font-bold mt-0.5 flex items-center gap-1"><i className="fa-solid fa-check"></i> Linked</div>}
                                        </div>
                                    </div>

                                    {/* THE SUGGESTION DROPDOWN */}
                                    {activeSearchRow === item.id && (
                                        <Suggestions searchTerm={item.name} rowId={item.id} />
                                    )}
                                </div>

                                {/* Category Input */}
                                <div className="col-span-2">
                                    <select
                                        value={item.category || 'General'}
                                        onChange={e => handleItemChange(item.id, 'category', e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-gray-900/50 rounded-xl py-2.5 px-2 text-sm font-bold text-gray-700 dark:text-gray-300 focus:bg-white dark:focus:bg-black transition-colors outline-none shadow-inner"
                                    >
                                        <option value="General">General</option>
                                        {INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                {/* Qty & Unit */}
                                <div className="col-span-1 flex flex-col gap-1">
                                    <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={e => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                        className="w-full bg-gray-50 dark:bg-gray-900/50 rounded-xl py-2.5 px-2 text-center font-bold text-gray-900 dark:text-white focus:bg-white dark:focus:bg-black transition-colors outline-none shadow-inner"
                                    />
                                    <select
                                        value={item.unitType}
                                        onChange={e => handleItemChange(item.id, 'unitType', e.target.value)}
                                        className="w-full bg-transparent text-[10px] font-bold text-gray-500 uppercase focus:outline-none text-center"
                                    >
                                        {UNITS.map(u => <option key={u} value={u}>{t(u).substring(0, 6)}..</option>)}
                                    </select>
                                </div>

                                {/* Unit Cost + Comparison */}
                                <div className="col-span-2">
                                    <div className="relative">
                                        <span className="absolute left-2 top-2.5 text-gray-400 text-xs font-bold">$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.0001"
                                            value={item.unitCost}
                                            onChange={e => handleItemChange(item.id, 'unitCost', parseFloat(e.target.value) || 0)}
                                            className="w-full bg-gray-50 dark:bg-gray-900/50 rounded-xl py-2.5 pl-6 pr-2 text-right font-mono text-sm text-gray-900 dark:text-white focus:bg-white dark:focus:bg-black transition-colors outline-none shadow-inner"
                                        />
                                    </div>
                                    {/* Comparison Indicator */}
                                    {comparison && item.unitCost > 0 && (
                                        <div className={`text-[10px] text-right mt-1 font-bold ${comparison.isSame ? 'text-gray-400' : comparison.isCheaper ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {comparison.isSame ? 'Same price' : (
                                                <>
                                                    <i className={`fa-solid ${comparison.isCheaper ? 'fa-arrow-down' : 'fa-arrow-up'} mr-1`}></i>
                                                    {comparison.percent}% vs Avg (${comparison.historyCost})
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Total */}
                                <div className="col-span-1">
                                    <div className="relative">
                                        <span className="absolute left-2 top-2.5 text-gray-400 text-xs font-bold">$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={item.total}
                                            onChange={e => handleItemChange(item.id, 'total', parseFloat(e.target.value) || 0)}
                                            className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-xl py-2.5 pl-6 pr-2 text-right font-mono text-sm font-bold text-gray-900 dark:text-white focus:border-medical-500 transition-colors outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Remove */}
                                <div className="col-span-1 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleRemoveItem(item.id)} className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center">
                                        <i className="fa-solid fa-times"></i>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <button onClick={handleAddItem} className="mb-10 w-full py-5 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl text-gray-400 hover:text-medical-500 hover:border-medical-500 hover:bg-medical-50 dark:hover:bg-medical-900/10 transition-all font-bold flex items-center justify-center gap-2 group">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 group-hover:bg-medical-500 group-hover:text-white flex items-center justify-center transition-colors">
                    <i className="fa-solid fa-plus text-xs"></i>
                </div>
                {t('btn_add_item')}
            </button>

            {/* Footer Financials */}
            <div className="flex flex-col md:flex-row justify-end items-start gap-8 border-t border-gray-200 dark:border-gray-800 pt-8">
                <div className="w-full md:w-96 bg-slate-900 dark:bg-black text-white p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
                    {/* Abstract BG */}
                    <div className="absolute top-0 right-0 w-40 h-40 bg-medical-500/20 rounded-full blur-[60px]"></div>

                    <div className="relative z-10 space-y-5">
                        <div className="flex justify-between items-center text-sm text-gray-400 font-medium group relative">
                            <span className="flex items-center gap-2">
                                {t('lbl_subtotal')}
                                {isSubtotalManual && (
                                    <button
                                        onClick={() => setIsSubtotalManual(false)}
                                        className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded hover:bg-red-500 hover:text-white transition-colors"
                                        title="Reset to auto-calculated sum"
                                    >
                                        Manual (Reset)
                                    </button>
                                )}
                            </span>
                            <div className="flex items-center gap-1 bg-white/10 rounded-lg px-3 py-1.5 backdrop-blur-sm transition-colors focus-within:bg-white/20">
                                <span className="text-xs text-gray-300">$</span>
                                <input
                                    type="number"
                                    value={formData.subtotal}
                                    onChange={e => {
                                        setIsSubtotalManual(true);
                                        setFormData({ ...formData, subtotal: parseFloat(e.target.value) || 0 });
                                    }}
                                    className="w-24 bg-transparent text-right font-mono text-white outline-none font-bold tracking-wide"
                                />
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-sm text-gray-400 font-medium">
                            <span>{t('lbl_ship_cost')}</span>
                            <div className="flex items-center gap-1 bg-white/10 rounded-lg px-3 py-1.5 backdrop-blur-sm">
                                <span className="text-xs text-gray-300">$</span>
                                <input
                                    type="number"
                                    value={formData.shippingCost}
                                    onChange={e => setFormData({ ...formData, shippingCost: parseFloat(e.target.value) || 0 })}
                                    className="w-16 bg-transparent text-right font-mono text-white outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-sm text-gray-400 font-medium">
                            <span>{t('lbl_tax_amount')}</span>
                            <div className="flex items-center gap-1 bg-white/10 rounded-lg px-3 py-1.5 backdrop-blur-sm">
                                <span className="text-xs text-gray-300">$</span>
                                <input
                                    type="number"
                                    value={formData.totalTax}
                                    onChange={e => setFormData({ ...formData, totalTax: parseFloat(e.target.value) || 0 })}
                                    className="w-16 bg-transparent text-right font-mono text-white outline-none"
                                />
                            </div>
                        </div>

                        <div className="h-px bg-white/20 my-2"></div>

                        <div className="flex justify-between text-2xl font-black items-end">
                            <span className="text-medical-400 text-lg uppercase tracking-wider">{t('lbl_grand_total')}</span>
                            <span>${formData.grandTotal?.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 mt-8">
                <button
                    onClick={onCancel}
                    disabled={isSaving}
                    className="flex-1 h-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-extrabold rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-lg disabled:opacity-50 tracking-tight"
                >
                    {t('btn_cancel')}
                </button>
                <button
                    onClick={handleSaveOrder}
                    disabled={isSaving}
                    className="flex-1 h-16 bg-gradient-to-r from-medical-600 to-teal-600 text-white font-extrabold rounded-2xl shadow-2xl shadow-medical-500/30 hover:shadow-medical-500/50 hover:scale-[1.02] active:scale-95 transition-all text-lg flex items-center justify-center gap-3 disabled:opacity-75 disabled:cursor-wait tracking-tight"
                >
                    {isSaving ? <i className="fa-solid fa-circle-notch fa-spin text-xl"></i> : <i className="fa-solid fa-check"></i>}
                    {isSaving ? 'Processing...' : 'Complete Order'}
                </button>
            </div>

        </div >
    );
};

export default OrderForm;
