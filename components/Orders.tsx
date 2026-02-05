
import React, { useState, useMemo } from 'react';
import { Order, OrderItem, InventoryItem, User, Permission } from '../types';
import OrderForm from './OrderForm';
import OrderScannerModal from './OrderScannerModal';
import OrdersAnalytics from './OrdersAnalytics';

interface OrdersProps {
    orders: Order[];
    inventory: InventoryItem[];
    user: User;
    hasPermission: (permission: Permission) => boolean;
    onSaveOrder: (order: Order) => Promise<void>;
    onReceiveOrder: (order: Order) => void;
    isLoadingOrders?: boolean;
    onDeleteOrder: (orderId: string) => void;
    onAddToInventory: (item: Omit<InventoryItem, 'id'>) => void;
    t: (key: string) => string;
}

// Premium vendor presets with accurate brand identities and polished styling
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
        initials: 'L',
        color: 'from-[#00AADF] to-blue-600',
        bgColor: 'bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/30 dark:to-blue-900/30',
        glowColor: 'shadow-[#00AADF]/40',
        borderActive: 'border-[#00AADF]',
        textColor: 'text-[#00AADF] dark:text-cyan-400'
    },
    {
        name: 'Henry Schein',
        initials: 'HS',
        color: 'from-red-600 to-blue-700',
        bgColor: 'bg-gradient-to-br from-red-50 to-blue-50 dark:from-red-900/30 dark:to-blue-900/30',
        glowColor: 'shadow-red-500/40',
        borderActive: 'border-red-500',
        textColor: 'text-red-600 dark:text-red-400'
    },
    {
        name: 'Medline',
        initials: 'M',
        color: 'from-[#004b87] to-indigo-700',
        bgColor: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30',
        glowColor: 'shadow-[#004b87]/40',
        borderActive: 'border-[#004b87]',
        textColor: 'text-[#004b87] dark:text-blue-300'
    },
    {
        name: 'McKesson',
        initials: 'MC',
        color: 'from-[#002d72] to-slate-800',
        bgColor: 'bg-gradient-to-br from-blue-50 to-slate-100 dark:from-blue-900/30 dark:to-slate-900/30',
        glowColor: 'shadow-[#002d72]/40',
        borderActive: 'border-[#002d72]',
        textColor: 'text-[#002d72] dark:text-blue-300'
    }
];

// Order Details Modal Component
const OrderDetailsModal: React.FC<{
    order: Order | null;
    onClose: () => void;
    inventory: InventoryItem[];
    onDelete?: (orderId: string) => void;
    canDelete?: boolean;
    t: (key: string) => string;
}> = ({ order, onClose, inventory, onDelete, canDelete, t }) => {
    if (!order) return null;

    const getVendorInfo = (vendorName: string) => {
        if (!vendorName) return undefined;
        return VENDOR_PRESETS.find(v =>
            vendorName.toLowerCase().includes(v.name.toLowerCase()) ||
            v.name.toLowerCase().includes(vendorName.toLowerCase())
        );
    };

    const vendorInfo = getVendorInfo(order.vendor);

    const getInventoryItemName = (inventoryItemId?: string) => {
        if (!inventoryItemId) return null;
        const item = inventory.find(i => i.id === inventoryItemId);
        return item?.name || null;
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-fade-in">
            <div className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-slate-800 overflow-hidden flex flex-col">

                {/* Header with Vendor Logo */}
                <div className={`p-6 ${vendorInfo?.bgColor || 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {vendorInfo?.logo ? (
                                <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border border-white/50 dark:border-slate-700 p-2 shadow-xl flex items-center justify-center overflow-hidden">
                                    <img src={vendorInfo.logo} alt={order.vendor} className="w-full h-full object-contain" />
                                </div>
                            ) : (
                                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${vendorInfo?.color || 'from-slate-400 to-slate-600'} flex items-center justify-center text-white text-2xl font-black shadow-xl border border-white/20`}>
                                    {vendorInfo?.initials || order.vendor.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{order.vendor}</h2>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-sm font-mono text-slate-500 dark:text-slate-400">{order.poNumber}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${order.status === 'RECEIVED' ? 'bg-emerald-100 text-emerald-600' :
                                        order.status === 'PENDING' ? 'bg-orange-100 text-orange-600' :
                                            order.status === 'CANCELLED' ? 'bg-red-100 text-red-600' :
                                                'bg-gray-100 text-gray-600'
                                        }`}>
                                        {order.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-12 h-12 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-lg flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all"
                        >
                            <i className="fa-solid fa-xmark text-xl"></i>
                        </button>
                    </div>
                </div>

                {/* Order Info Bar */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <div className="text-center">
                        <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Order Date</div>
                        <div className="text-lg font-extrabold text-slate-900 dark:text-white">{order.orderDate}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Expected</div>
                        <div className="text-lg font-extrabold text-slate-900 dark:text-white">{order.expectedDate || '—'}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Items</div>
                        <div className="text-lg font-extrabold text-slate-900 dark:text-white">{order.items.length}</div>
                    </div>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar">
                    <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <i className="fa-solid fa-list text-medical-500"></i>
                        Line Items
                    </h3>
                    <div className="space-y-3">
                        {order.items.map((item, idx) => {
                            const linkedItem = getInventoryItemName(item.inventoryItemId);
                            return (
                                <div key={item.id || idx} className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 shadow-sm transition-all hover:border-medical-500/30">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <span className="w-7 h-7 rounded-lg bg-medical-50 dark:bg-medical-900/30 flex items-center justify-center text-xs font-extrabold text-medical-600">
                                                    {idx + 1}
                                                </span>
                                                <h4 className="font-extrabold text-slate-900 dark:text-white text-lg tracking-tight">{item.name}</h4>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 mt-2 ml-10">
                                                {linkedItem && (
                                                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 border border-emerald-100 dark:border-emerald-800/50">
                                                        <i className="fa-solid fa-link"></i>
                                                        Linked
                                                    </span>
                                                )}
                                                <span className="text-sm font-bold text-slate-500">
                                                    {t(item.unitType) || item.unitType}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                                                <span className="text-slate-900 dark:text-slate-200">{item.quantity}</span>
                                                <span className="opacity-50">×</span>
                                                <span className="text-slate-900 dark:text-slate-200">${item.unitCost.toFixed(2)}</span>
                                            </div>
                                            <div className="text-xl font-extrabold text-medical-600 dark:text-medical-400 mt-1">
                                                ${item.total.toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Totals Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-md">
                    <div className="grid grid-cols-4 gap-4">
                        <div className="text-center">
                            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Subtotal</div>
                            <div className="text-lg font-bold text-slate-700 dark:text-slate-300">${order.subtotal.toFixed(2)}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Tax</div>
                            <div className="text-lg font-bold text-slate-700 dark:text-slate-300">${order.totalTax.toFixed(2)}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Shipping</div>
                            <div className="text-lg font-bold text-slate-700 dark:text-slate-300">${order.shippingCost.toFixed(2)}</div>
                        </div>
                        <div className="text-center p-3 rounded-2xl bg-gradient-to-br from-medical-600 to-teal-600 text-white shadow-xl shadow-medical-500/30">
                            <div className="text-[10px] font-extrabold uppercase tracking-widest opacity-80">Total</div>
                            <div className="text-2xl font-black">${order.grandTotal.toFixed(2)}</div>
                        </div>
                    </div>

                    {order.notes && (
                        <div className="mt-4 p-4 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/50">
                            <div className="text-[10px] font-extrabold text-amber-600 uppercase tracking-widest mb-1">Notes</div>
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200 leading-relaxed">{order.notes}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const Orders: React.FC<OrdersProps> = ({ orders, inventory, user, hasPermission, onSaveOrder, onReceiveOrder, onDeleteOrder, onAddToInventory, t, isLoadingOrders }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showScanner, setShowScanner] = useState(false);
    const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'analytics'>('list');

    // Filter State
    const [vendorFilter, setVendorFilter] = useState('All');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Extract unique vendors from existing orders + defaults
    const availableVendors = useMemo(() => {
        const defaultVendors = VENDOR_PRESETS.map(v => v.name);
        const existingVendors = Array.from(new Set(orders.map(o => o.vendor))).filter(Boolean);
        return Array.from(new Set([...defaultVendors, ...existingVendors])).sort();
    }, [orders]);

    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            const matchesVendor = vendorFilter === 'All' ||
                order.vendor.toLowerCase().includes(vendorFilter.toLowerCase()) ||
                vendorFilter.toLowerCase().includes(order.vendor.toLowerCase());

            let matchesDate = true;
            if (startDate) {
                matchesDate = matchesDate && order.orderDate >= startDate;
            }
            if (endDate) {
                matchesDate = matchesDate && order.orderDate <= endDate;
            }

            return matchesVendor && matchesDate;
        });
    }, [orders, vendorFilter, startDate, endDate]);

    const handleCreate = () => {
        setSelectedOrder(null);
        setIsEditing(true);
    };

    const handleEdit = (order: Order) => {
        if (order.status === 'RECEIVED') return;
        setSelectedOrder(order);
        setIsEditing(true);
    };

    const handleSave = async (formData: Partial<Order>) => {
        const finalOrder: Order = {
            ...formData as Order,
            id: selectedOrder?.id || Date.now().toString(),
        };
        await onSaveOrder(finalOrder);
        setIsEditing(false);
    };

    const clearFilters = () => {
        setVendorFilter('All');
        setStartDate('');
        setEndDate('');
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'DRAFT': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
            case 'PENDING': return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400';
            case 'RECEIVED': return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'CANCELLED': return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const getVendorInfo = (vendorName: string) => {
        if (!vendorName) return undefined;
        return VENDOR_PRESETS.find(v =>
            vendorName.toLowerCase().includes(v.name.toLowerCase()) ||
            v.name.toLowerCase().includes(vendorName.toLowerCase())
        );
    };

    if (isEditing) {
        return (
            <div className="animate-fade-in-up pb-20">
                <OrderForm
                    onSave={handleSave}
                    onCancel={() => setIsEditing(false)}
                    existingInventory={inventory}
                    initialData={selectedOrder || undefined}
                    t={t}
                    isSaving={isLoadingOrders}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 md:pb-10 animate-fade-in-up">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-display text-slate-900 dark:text-white">{t('ord_title')}</h2>
                    <p className="text-caption mt-1">{t('ord_subtitle')}</p>
                </div>
                {hasPermission('orders.create') && (
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => setViewMode(viewMode === 'list' ? 'analytics' : 'list')}
                            className={`h-14 px-6 rounded-2xl font-extrabold shadow-xl flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95 ${viewMode === 'analytics'
                                ? 'bg-white text-medical-600 shadow-medical-500/10 ring-2 ring-medical-500/30'
                                : 'bg-gradient-to-r from-medical-600 to-teal-600 text-white shadow-medical-500/30'
                                }`}
                        >
                            <i className={`fa-solid ${viewMode === 'list' ? 'fa-chart-pie' : 'fa-list'} text-lg`}></i>
                            <span className="tracking-tight">{viewMode === 'list' ? 'Analytics' : 'Orders List'}</span>
                        </button>
                        <button
                            onClick={() => setShowScanner(true)}
                            className="h-14 px-6 bg-gradient-to-r from-medical-50 to-teal-50 dark:from-medical-900/10 dark:to-teal-900/10 border-medical-200/40 dark:border-medical-800/40 text-medical-700 dark:text-medical-300 rounded-2xl font-extrabold shadow-xl flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95 group"
                            title="Scan Order"
                        >
                            <i className="fa-solid fa-wand-magic-sparkles text-lg group-hover:rotate-12 transition-transform"></i>
                            <span className="tracking-tight hidden sm:inline">Scan</span>
                        </button>
                        <button
                            onClick={handleCreate}
                            className="h-14 px-8 bg-medical-600 text-white rounded-2xl font-extrabold shadow-2xl shadow-medical-500/40 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95 group"
                        >
                            <i className="fa-solid fa-plus text-lg group-hover:rotate-90 transition-transform"></i>
                            <span className="tracking-tight">{t('btn_new_order')}</span>
                        </button>
                    </div>
                )}
            </header>

            {/* Premium Vendor Logos Quick Filter */}
            {viewMode === 'list' && (
                <>
                    <div className="flex flex-wrap gap-4">
                        {/* All Vendors Button */}
                        <button
                            onClick={() => setVendorFilter('All')}
                            className={`group relative h-16 px-6 rounded-2xl font-extrabold text-sm transition-all duration-300 overflow-hidden ${vendorFilter === 'All'
                                ? 'bg-gradient-to-r from-medical-600 to-teal-600 text-white shadow-2xl shadow-medical-500/50 scale-105 ring-2 ring-white/30'
                                : 'glass-panel text-slate-700 dark:text-white hover:shadow-xl hover:scale-[1.02] border-slate-200 dark:border-slate-800'
                                }`}
                        >
                            <div className="flex items-center gap-3 relative z-10">
                                <div className={`w-10 h-10 rounded-xl ${vendorFilter === 'All' ? 'bg-white/20' : 'bg-medical-500/10'} flex items-center justify-center transition-all`}>
                                    <i className="fa-solid fa-boxes-stacked text-lg"></i>
                                </div>
                                <span className="font-extrabold">All Vendors</span>
                            </div>
                            {vendorFilter === 'All' && (
                                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent animate-pulse"></div>
                            )}
                        </button>

                        {/* Vendor Buttons */}
                        {VENDOR_PRESETS.map(vendor => (
                            <button
                                key={vendor.name}
                                onClick={() => setVendorFilter(vendor.name)}
                                className={`group relative h-16 px-5 rounded-2xl font-extrabold text-sm transition-all duration-300 flex items-center gap-3 overflow-hidden ${vendorFilter === vendor.name
                                    ? `bg-gradient-to-r ${vendor.color} text-white shadow-2xl ${vendor.glowColor} scale-105 ring-2 ring-white/30`
                                    : `${vendor.bgColor} ${vendor.textColor} hover:shadow-xl hover:scale-[1.02] border-2 ${vendor.borderActive} border-opacity-30 hover:border-opacity-100`
                                    }`}
                            >
                                {vendor.logo ? (
                                    <div className={`relative w-12 h-12 rounded-xl overflow-hidden ${(vendor as any).logoBg} ${vendorFilter === vendor.name
                                        ? 'shadow-lg ring-2 ring-white/50'
                                        : 'shadow-sm'
                                        } p-1.5 transition-all group-hover:shadow-lg`}>
                                        <img
                                            src={vendor.logo}
                                            alt={vendor.name}
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                ) : (
                                    <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${vendor.color} text-white font-extrabold text-lg transition-all shadow-md group-hover:shadow-lg border border-white/10 ${vendorFilter === vendor.name ? 'ring-2 ring-white/50' : ''}`}>
                                        {(vendor as any).initials || vendor.name.charAt(0).toUpperCase()}
                                    </div>
                                )}

                                {/* Vendor Name */}
                                <span className="hidden sm:inline font-extrabold">{vendor.name}</span>

                                {/* Active Glow Effect */}
                                {vendorFilter === vendor.name && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent animate-pulse"></div>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Date Filters - Glass Toolbar */}
                    <div className="glass-panel p-4 rounded-[2.5rem] luxury-shadow flex flex-col md:flex-row gap-4 items-center sticky top-24 z-20 border-white/50 dark:border-slate-800/80">
                        <div className="flex-1 relative group">
                            <i className="fa-solid fa-calendar-day absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-medical-500 transition-colors z-10 pointer-events-none"></i>
                            <input
                                type={startDate ? 'date' : 'text'}
                                value={startDate}
                                placeholder={t('filter_start_date')}
                                onFocus={(e) => (e.target.type = 'date')}
                                onBlur={(e) => {
                                    if (!e.target.value) e.target.type = 'text';
                                }}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full h-14 pl-12 pr-6 bg-slate-50/50 dark:bg-slate-900/50 border-none rounded-2xl font-bold text-sm text-slate-700 dark:text-slate-200 focus:ring-4 ring-medical-500/10 transition-all outline-none placeholder:text-slate-400"
                            />
                        </div>
                        <div className="flex-1 relative group">
                            <i className="fa-solid fa-calendar-check absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-medical-500 transition-colors z-10 pointer-events-none"></i>
                            <input
                                type={endDate ? 'date' : 'text'}
                                value={endDate}
                                placeholder={t('filter_end_date')}
                                onFocus={(e) => (e.target.type = 'date')}
                                onBlur={(e) => {
                                    if (!e.target.value) e.target.type = 'text';
                                }}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full h-14 pl-12 pr-6 bg-slate-50/50 dark:bg-slate-900/50 border-none rounded-2xl font-bold text-sm text-slate-700 dark:text-slate-200 focus:ring-4 ring-medical-500/10 transition-all outline-none placeholder:text-slate-400"
                            />
                        </div>
                        {(vendorFilter !== 'All' || startDate || endDate) && (
                            <button
                                onClick={clearFilters}
                                className="h-14 px-8 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500 font-extrabold text-sm hover:bg-red-100 dark:hover:bg-red-900/40 transition-all flex items-center gap-2 shadow-sm hover:shadow-red-500/20"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                                {t('btn_clear_filters')}
                            </button>
                        )}
                    </div>

                    {/* Orders List - Floating Cards Layout */}
                    <div className="mt-8 overflow-visible">
                        <div className="p-4 flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                {t('lbl_filtered_results')} • {filteredOrders.length}
                            </span>
                        </div>
                        <div className="overflow-visible">
                            <table className="w-full text-left border-separate border-spacing-y-4">
                                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                                    <tr>
                                        <th className="p-6 text-xs font-extrabold text-gray-400 uppercase tracking-wider">{t('lbl_vendor')}</th>
                                        <th className="p-6 text-xs font-extrabold text-gray-400 uppercase tracking-wider">{t('lbl_po')}</th>
                                        <th className="p-6 text-xs font-extrabold text-gray-400 uppercase tracking-wider">{t('lbl_date')}</th>
                                        <th className="p-6 text-xs font-extrabold text-gray-400 uppercase tracking-wider">Items</th>
                                        <th className="p-6 text-xs font-extrabold text-gray-400 uppercase tracking-wider">{t('lbl_total')}</th>
                                        <th className="p-6 text-xs font-extrabold text-gray-400 uppercase tracking-wider">{t('lbl_status')}</th>
                                        <th className="p-6 text-xs font-extrabold text-gray-400 uppercase tracking-wider text-right">{t('th_controls')}</th>
                                    </tr>
                                </thead>
                                <tbody className="space-y-4">
                                    {filteredOrders.length === 0 ? (
                                        <tr><td colSpan={7} className="p-20 text-center">
                                            <div className="flex flex-col items-center justify-center opacity-40">
                                                <i className="fa-solid fa-file-invoice text-6xl mb-4 text-slate-300"></i>
                                                <p className="text-xl font-bold text-slate-400">No orders found</p>
                                            </div>
                                        </td></tr>
                                    ) : filteredOrders.map((order, index) => {
                                        const vendorInfo = getVendorInfo(order.vendor);
                                        return (
                                            <tr
                                                key={order.id}
                                                className="group relative transition-all duration-300 hover:scale-[1.01] hover:-translate-y-1 block md:table-row"
                                                style={{ animationDelay: `${index * 50}ms` }}
                                                onClick={() => setViewingOrder(order)}
                                            >
                                                <td className="p-5 bg-white dark:bg-slate-900 border-y border-l border-white dark:border-slate-800 rounded-l-[1.5rem] shadow-sm group-hover:shadow-xl group-hover:shadow-medical-500/10 group-hover:border-medical-500/20 transition-all cursor-pointer align-middle block md:table-cell">
                                                    <div className="flex items-center gap-4">
                                                        {vendorInfo?.logo ? (
                                                            <div className={`w-14 h-14 rounded-2xl ${(vendorInfo as any).logoBg || 'bg-white'} p-2 shadow-md flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                                                <img src={vendorInfo.logo} alt={order.vendor} className="w-full h-full object-contain" />
                                                            </div>
                                                        ) : (
                                                            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${vendorInfo?.color || 'from-slate-400 to-slate-600'} flex items-center justify-center text-white font-extrabold text-xl shadow-md group-hover:scale-110 transition-transform border border-white/10`}>
                                                                {(vendorInfo as any)?.initials || order.vendor.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="font-extrabold text-slate-900 dark:text-slate-100 text-lg group-hover:text-medical-600 transition-colors uppercase tracking-tight">{order.vendor}</div>
                                                            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mt-0.5">{order.items.length} items</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-5 bg-white dark:bg-slate-900 border-y border-white dark:border-slate-800 shadow-sm group-hover:shadow-xl group-hover:shadow-medical-500/10 group-hover:border-medical-500/20 transition-all cursor-pointer align-middle block md:table-cell">
                                                    <div className="font-mono font-extrabold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-3 py-1 rounded-lg inline-block text-[11px] border border-slate-100 dark:border-slate-700/50">
                                                        #{order.poNumber}
                                                    </div>
                                                </td>
                                                <td className="p-5 bg-white dark:bg-slate-900 border-y border-white dark:border-slate-800 shadow-sm group-hover:shadow-xl group-hover:shadow-medical-500/10 group-hover:border-medical-500/20 transition-all cursor-pointer align-middle block md:table-cell">
                                                    <div className="font-extrabold text-slate-700 dark:text-slate-300 text-sm">
                                                        {new Date(order.orderDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </div>
                                                    {order.expectedDate && (
                                                        <div className="text-[10px] font-extrabold text-medical-500 mt-1 uppercase tracking-widest">
                                                            ETA: {new Date(order.expectedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-5 bg-white dark:bg-slate-900 border-y border-white dark:border-slate-800 shadow-sm group-hover:shadow-xl group-hover:shadow-medical-500/10 group-hover:border-medical-500/20 transition-all cursor-pointer align-middle block md:table-cell">
                                                    <div className="flex -space-x-2.5 overflow-hidden py-1">
                                                        {order.items.slice(0, 3).map((item, i) => (
                                                            <div key={i} className="w-9 h-9 rounded-full bg-slate-50 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-extrabold text-slate-600 shadow-sm" title={item.name}>
                                                                {item.name.charAt(0)}
                                                            </div>
                                                        ))}
                                                        {order.items.length > 3 && (
                                                            <div className="w-9 h-9 rounded-full bg-medical-50 dark:bg-medical-900/30 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-extrabold text-medical-600 shadow-sm">
                                                                +{order.items.length - 3}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-5 bg-white dark:bg-slate-900 border-y border-white dark:border-slate-800 shadow-sm group-hover:shadow-xl group-hover:shadow-medical-500/10 group-hover:border-medical-500/20 transition-all cursor-pointer align-middle block md:table-cell">
                                                    <div className="font-black text-slate-900 dark:text-slate-200 text-xl tracking-tight">
                                                        ${order.grandTotal.toFixed(2)}
                                                    </div>
                                                </td>
                                                <td className="p-5 bg-white dark:bg-slate-900 border-y border-white dark:border-slate-800 shadow-sm group-hover:shadow-xl group-hover:shadow-medical-500/10 group-hover:border-medical-500/20 transition-all cursor-pointer align-middle block md:table-cell">
                                                    <span className={`px-4 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-widest ${getStatusBadge(order.status)} transform group-hover:scale-110 transition-transform inline-block border border-white/20 shadow-sm`}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className="p-5 bg-white dark:bg-slate-900 border-y border-r border-white dark:border-slate-800 rounded-r-[1.5rem] shadow-sm group-hover:shadow-xl group-hover:shadow-blue-500/10 group-hover:border-blue-500/20 transition-all cursor-pointer text-right align-middle block md:table-cell" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => setViewingOrder(order)}
                                                            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-all shadow-sm hover:shadow-blue-500/30"
                                                            title="View Details"
                                                        >
                                                            <i className="fa-solid fa-eye"></i>
                                                        </button>
                                                        {order.status !== 'RECEIVED' && (
                                                            <>
                                                                {hasPermission('orders.create') && (
                                                                    <button
                                                                        onClick={() => handleEdit(order)}
                                                                        className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center shadow-sm hover:shadow-amber-500/30"
                                                                    >
                                                                        <i className="fa-solid fa-pen"></i>
                                                                    </button>
                                                                )}
                                                                {hasPermission('orders.receive') && (
                                                                    <button
                                                                        onClick={() => {
                                                                            if (window.confirm(t('msg_receive_confirm'))) onReceiveOrder(order);
                                                                        }}
                                                                        className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center shadow-sm hover:shadow-emerald-500/30"
                                                                        title={t('btn_receive')}
                                                                    >
                                                                        <i className="fa-solid fa-box-open"></i>
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                        {hasPermission('orders.delete') && (
                                                            <button
                                                                onClick={() => {
                                                                    if (window.confirm(t('msg_delete_confirm') || 'Are you sure you want to delete this order?')) {
                                                                        onDeleteOrder(order.id);
                                                                    }
                                                                }}
                                                                className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center shadow-sm hover:shadow-red-500/30"
                                                                title="Delete Order"
                                                            >
                                                                <i className="fa-solid fa-trash"></i>
                                                            </button>
                                                        )}
                                                    </div>
                                                    {/* Mobile visible controls trigger */}
                                                    <div className="md:hidden text-slate-400">
                                                        <i className="fa-solid fa-ellipsis-vertical"></i>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )
            }

            {
                viewMode === 'analytics' && (
                    <OrdersAnalytics
                        orders={filteredOrders}
                        inventory={inventory}
                        t={t}
                    />
                )
            }

            {/* Order Details Modal */}
            <OrderDetailsModal
                order={viewingOrder}
                onClose={() => setViewingOrder(null)}
                inventory={inventory}
                onDelete={onDeleteOrder}
                canDelete={hasPermission('orders.delete')}
                t={t}
            />

            {/* Order Scanner Modal */}
            <OrderScannerModal
                isOpen={showScanner}
                onClose={() => setShowScanner(false)}
                onCreateOrder={(orderData) => {
                    const newOrder: Order = {
                        ...orderData as Order,
                        id: Date.now().toString(),
                    };
                    onSaveOrder(newOrder);
                }}
                onAddToInventory={onAddToInventory}
                existingInventory={inventory}
                t={t}
            />
        </div >
    );
};

export default Orders;
