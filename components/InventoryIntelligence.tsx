import React, { useState, useEffect } from 'react';
import { InventoryItem, ItemMetrics } from '../types';
import { InventoryIntelligenceService } from '../services/InventoryIntelligenceService';
import { supabase } from '../src/lib/supabase';

interface InventoryIntelligenceProps {
    inventory: InventoryItem[];
    onAddToOrder: (items: { itemId: string, quantity: number }[]) => void;
}

export const InventoryIntelligenceDashboard: React.FC<InventoryIntelligenceProps> = ({ inventory, onAddToOrder }) => {
    const [metrics, setMetrics] = useState<ItemMetrics[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'actionable' | 'all' | 'anomalies'>('actionable');
    const [overrides, setOverrides] = useState<Record<string, { qty: number; reason: string }>>({});

    useEffect(() => {
        calculateAllMetrics();
    }, [inventory]);

    const calculateAllMetrics = async () => {
        setLoading(true);
        const promises = inventory.map(item => InventoryIntelligenceService.calculateItemMetrics(item));
        const allMetrics = await Promise.all(promises);
        setMetrics(allMetrics);
        setLoading(false);
    };

    const handleQtyChange = (itemId: string, qty: number) => {
        setOverrides(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], qty, reason: prev[itemId]?.reason || '' }
        }));
    };

    const handleReasonChange = (itemId: string, reason: string) => {
        setOverrides(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], qty: prev[itemId]?.qty ?? 0, reason }
        }));
    };

    const getStatusConfig = (status: ItemMetrics['status']) => {
        switch (status) {
            case 'CRITICAL': return {
                badge: 'bg-red-500/15 text-red-400 border border-red-500/20',
                dot: 'bg-red-400',
                icon: 'fa-circle-exclamation'
            };
            case 'ORDER_SOON': return {
                badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
                dot: 'bg-amber-400',
                icon: 'fa-clock'
            };
            case 'HEALTHY': return {
                badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
                dot: 'bg-emerald-400',
                icon: 'fa-circle-check'
            };
            case 'OVERSTOCK': return {
                badge: 'bg-purple-500/15 text-purple-400 border border-purple-500/20',
                dot: 'bg-purple-400',
                icon: 'fa-arrow-up'
            };
            default: return {  // DORMANT
                badge: 'bg-slate-500/15 text-slate-400 border border-slate-500/20',
                dot: 'bg-slate-400',
                icon: 'fa-moon'
            };
        }
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    const criticalItems = metrics.filter(m => m.status === 'CRITICAL');
    const warningItems = metrics.filter(m => m.status === 'ORDER_SOON');
    const anomalyItems = metrics.filter(m => m.anomaliesDetected > 0 || m.isVolatile);

    const totalInventoryValue = metrics.reduce(
        (sum, m) => sum + (m.currentStock * (inventory.find(i => i.id === m.itemId)?.averageCost || 0)), 0
    );
    const overstockValue = metrics
        .filter(m => m.status === 'OVERSTOCK')
        .reduce((sum, m) => sum + (m.currentStock * (inventory.find(i => i.id === m.itemId)?.averageCost || 0)), 0);

    const handleGeneratePurchaseList = async () => {
        const itemsToProcess = activeTab === 'all' ? metrics : [...criticalItems, ...warningItems];
        const toOrder: { itemId: string, quantity: number }[] = [];
        const overridesToLog: { itemId: string, recommended: number, ordered: number, reason: string }[] = [];

        for (const m of itemsToProcess) {
            const override = overrides[m.itemId];
            const finalQty = override !== undefined ? override.qty : m.recommendedQuantity;
            if (finalQty > 0) {
                toOrder.push({ itemId: m.itemId, quantity: finalQty });
                if (override && override.qty !== m.recommendedQuantity) {
                    if (!override.reason || override.reason.trim().length < 3) {
                        alert(`Please provide a reason for overriding ${m.itemName} (min 3 chars)`);
                        return;
                    }
                    overridesToLog.push({
                        itemId: m.itemId,
                        recommended: m.recommendedQuantity,
                        ordered: override.qty,
                        reason: override.reason
                    });
                }
            }
        }

        if (toOrder.length > 0) {
            for (const log of overridesToLog) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await InventoryIntelligenceService.logOverride({
                        item_id: log.itemId,
                        user_id: user.id,
                        recommended_qty: log.recommended,
                        ordered_qty: log.ordered,
                        justification: log.reason
                    });
                }
            }
            onAddToOrder(toOrder);
        } else {
            alert("No items selected for reorder.");
        }
    };

    if (loading) return (
        <div className="page-container space-y-6 pb-24 md:pb-8">
            {/* Skeleton Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse"></div>
                    <div>
                        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse mb-2"></div>
                        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
                    </div>
                </div>
                <div className="h-10 w-44 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse self-start md:self-auto"></div>
            </header>

            {/* Skeleton KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="glass-panel p-5 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse"></div>
                        </div>
                        <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
                        <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                    </div>
                ))}
            </div>

            {/* Skeleton Tabs + Table */}
            <div className="glass-panel overflow-hidden">
                <div className="flex items-center gap-2 p-4 border-b border-slate-100 dark:border-slate-800">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                    ))}
                </div>
                <div className="p-4 space-y-4">
                    {/* Header row */}
                    <div className="flex gap-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <div className="h-4 w-1/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                        <div className="h-4 w-1/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                        <div className="h-4 w-1/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                        <div className="h-4 w-1/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                    </div>
                    {/* Data rows */}
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex gap-4 items-center">
                            <div className="h-12 w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl animate-pulse"></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Centered Floating Spinner for Context */}
            <div className="fixed bottom-8 right-8 z-50 flex items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-full shadow-2xl border border-slate-100 dark:border-slate-700 animate-fade-in-up">
                <div className="relative w-8 h-8">
                    <div className="absolute inset-0 rounded-full border-2 border-medical-500/20"></div>
                    <div className="absolute inset-0 rounded-full border-2 border-medical-500 border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <i className="fa-solid fa-brain text-medical-500 text-[10px]"></i>
                    </div>
                </div>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 pr-2">Analyzing Data...</span>
            </div>
        </div>
    );

    const displayedItems = activeTab === 'actionable'
        ? [...criticalItems, ...warningItems]
        : activeTab === 'anomalies'
            ? anomalyItems
            : metrics;

    return (
        <div className="page-container space-y-6 pb-24 md:pb-8">

            {/* ── Header ── */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-medical-500/15 flex items-center justify-center">
                            <i className="fa-solid fa-brain text-medical-500 text-base"></i>
                        </div>
                        Inventory Intelligence
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 ml-12">
                        AI-powered reorder predictions · {metrics.length} items tracked
                    </p>
                </div>
                <button
                    onClick={handleGeneratePurchaseList}
                    className="btn-primary flex items-center gap-2 self-start md:self-auto"
                >
                    <i className="fa-solid fa-cart-shopping text-sm"></i>
                    Generate Purchase List
                </button>
            </header>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Total Value */}
                <div className="glass-panel p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-label">Total Inventory Value</span>
                        <div className="w-8 h-8 rounded-lg bg-medical-500/10 flex items-center justify-center">
                            <i className="fa-solid fa-warehouse text-medical-500 text-xs"></i>
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalInventoryValue)}</p>
                    <p className="text-caption">As of today</p>
                </div>

                {/* Capital Risk */}
                <div className="glass-panel p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-label">Capital at Risk</span>
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <i className="fa-solid fa-triangle-exclamation text-amber-500 text-xs"></i>
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-amber-500">{formatCurrency(overstockValue)}</p>
                    <div className="flex items-center gap-2">
                        <span className="badge badge-neutral text-[10px]">Overstocked</span>
                        <p className="text-caption">Potential wasted capital</p>
                    </div>
                </div>

                {/* Actionable */}
                <div className="glass-panel p-5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-label">Needs Attention</span>
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                            <i className="fa-solid fa-bell text-red-500 text-xs"></i>
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{criticalItems.length + warningItems.length}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="badge badge-danger">
                            <i className="fa-solid fa-fire text-[9px]"></i>
                            {criticalItems.length} Critical
                        </span>
                        <span className="badge badge-warning">
                            <i className="fa-solid fa-clock text-[9px]"></i>
                            {warningItems.length} Soon
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Tabs + Table ── */}
            <div className="glass-panel overflow-hidden">
                {/* Tab Bar */}
                <div className="flex items-center gap-1 p-4 border-b border-slate-100 dark:border-slate-800">
                    {[
                        { key: 'actionable', label: 'Actionable', count: criticalItems.length + warningItems.length, icon: 'fa-bolt' },
                        { key: 'anomalies', label: 'Anomalies', count: anomalyItems.length, icon: 'fa-triangle-exclamation' },
                        { key: 'all', label: 'All Items', count: metrics.length, icon: 'fa-list' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === tab.key
                                ? 'bg-medical-500 text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            <i className={`fa-solid ${tab.icon} text-xs`}></i>
                            {tab.label}
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${activeTab === tab.key ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    {displayedItems.length === 0 ? (
                        <div className="flex flex-col items-center py-16 gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                                <i className="fa-solid fa-circle-check text-emerald-500 text-xl"></i>
                            </div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">All good here!</p>
                            <p className="text-caption">No items require attention in this view.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-separate border-spacing-y-4 md:border-spacing-0">
                            <thead className="hidden md:table-header-group bg-slate-50/80 dark:bg-slate-800/40">
                                <tr>
                                    <th className="table-header rounded-tl-none">Item</th>
                                    <th className="table-header">Status</th>
                                    <th className="table-header">Coverage</th>
                                    <th className="table-header">Confidence</th>
                                    <th className="table-header w-44">Reorder Qty</th>
                                    {activeTab === 'anomalies' && <th className="table-header">Detected Issues</th>}
                                </tr>
                            </thead>
                            <tbody className="space-y-4 md:space-y-0 md:divide-y md:divide-slate-100 md:dark:divide-slate-800">
                                {displayedItems.map((m) => {
                                    const override = overrides[m.itemId];
                                    const currentQty = override ? override.qty : m.recommendedQuantity;
                                    const isOverridden = override && override.qty !== m.recommendedQuantity;
                                    const statusCfg = getStatusConfig(m.status);

                                    return (
                                        <tr key={m.itemId} className="block md:table-row bg-white dark:bg-slate-900 md:bg-transparent rounded-2xl shadow-sm md:shadow-none border border-slate-100 dark:border-slate-800 md:border-none p-4 md:p-0 md:hover:bg-slate-50/50 md:dark:hover:bg-slate-800/30 transition-colors group">
                                            {/* Item */}
                                            <td className="md:table-cell p-0 md:p-4 block mb-4 md:mb-0 border-b border-slate-100 dark:border-slate-800 md:border-none pb-4 md:pb-0">
                                                <div className="md:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Item</div>
                                                <div className="font-bold text-slate-900 dark:text-white text-base md:text-sm">{m.itemName}</div>
                                                <div className="text-caption mt-0.5">Stock: {m.currentStock} units</div>
                                            </td>

                                            {/* Status */}
                                            <td className="md:table-cell p-0 md:p-4 flex justify-between items-center md:table-cell border-b border-slate-50 dark:border-slate-800/50 md:border-none py-2 md:py-0">
                                                <div className="md:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</div>
                                                <div className="text-right md:text-left">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${statusCfg.badge}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`}></span>
                                                        {m.status.replace('_', ' ')}
                                                    </span>
                                                    {m.leadTime > 0 && (
                                                        <div className="text-[10px] text-slate-500 mt-1">Lead: {m.leadTime}d</div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Coverage */}
                                            <td className="md:table-cell p-0 md:p-4 flex justify-between items-center md:table-cell border-b border-slate-50 dark:border-slate-800/50 md:border-none py-2 md:py-0 text-sm text-slate-600 dark:text-slate-300 font-medium">
                                                <div className="md:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest">Coverage</div>
                                                {m.daysRemaining === Infinity ? (
                                                    <span className="text-slate-400">∞ days</span>
                                                ) : (
                                                    <span>{Math.round(m.daysRemaining)} days</span>
                                                )}
                                            </td>

                                            {/* Confidence */}
                                            <td className="md:table-cell p-0 md:p-4 flex justify-between items-center md:table-cell border-b border-slate-50 dark:border-slate-800/50 md:border-none py-2 md:py-0 py-2 md:py-0">
                                                <div className="md:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confidence</div>
                                                <div className="flex flex-col md:gap-1 text-right md:text-left">
                                                    <span className={`text-xs font-bold ${m.confidence === 'HIGH' ? 'text-emerald-500' :
                                                        m.confidence === 'MEDIUM' ? 'text-amber-500' :
                                                            'text-slate-400'
                                                        }`}>
                                                        {m.confidence}
                                                    </span>
                                                    {m.stabilityIndex > 0 && (
                                                        <span className="text-[10px] text-slate-500">Var: {Math.round(m.stabilityIndex)}%</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Reorder Qty */}
                                            <td className="md:table-cell p-0 md:p-4 block pt-3 md:pt-0">
                                                <div className="md:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Reorder Qty</div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className={`w-20 md:w-24 h-10 md:h-8 px-2 text-center text-sm font-bold rounded-lg border outline-none transition-all focus:ring-2 focus:ring-medical-500/20 focus:border-medical-500
                                                            ${isOverridden
                                                                ? 'border-amber-400/50 bg-amber-500/10 text-amber-500'
                                                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                                                            }`}
                                                        value={currentQty}
                                                        onChange={(e) => handleQtyChange(m.itemId, parseInt(e.target.value) || 0)}
                                                    />
                                                    <div className="flex flex-col text-[10px] md:text-xs leading-tight">
                                                        <span className="text-slate-400">Rec: {m.recommendedQuantity}</span>
                                                        {isOverridden && <span className="text-amber-500 font-bold">Manual</span>}
                                                    </div>
                                                </div>
                                                {isOverridden && (
                                                    <input
                                                        type="text"
                                                        placeholder="Reason for change..."
                                                        className="mt-2 w-full h-8 md:h-7 px-2 text-xs rounded-lg border border-amber-400/30 bg-amber-500/5 text-slate-600 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20"
                                                        value={override?.reason || ''}
                                                        onChange={(e) => handleReasonChange(m.itemId, e.target.value)}
                                                    />
                                                )}
                                            </td>

                                            {/* Anomalies column */}
                                            {activeTab === 'anomalies' && (
                                                <td className="md:table-cell p-0 md:p-4 flex justify-between items-center md:table-cell mt-3 md:mt-0 pt-3 md:pt-0 border-t border-slate-50 dark:border-slate-800/50 md:border-none">
                                                    <div className="md:hidden text-[10px] font-bold text-slate-400 uppercase tracking-widest">Detected Issues</div>
                                                    <div className="flex flex-row md:flex-col gap-1.5 md:gap-1 text-right md:text-left justify-end md:justify-start">
                                                        {m.isVolatile && (
                                                            <span className="badge badge-warning">
                                                                <i className="fa-solid fa-bolt text-[9px]"></i> Volatile
                                                            </span>
                                                        )}
                                                        {m.anomaliesDetected > 0 && (
                                                            <span className="badge badge-danger">
                                                                <i className="fa-solid fa-triangle-exclamation text-[9px]"></i>
                                                                {m.anomaliesDetected} Excluded
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
