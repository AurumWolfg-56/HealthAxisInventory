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

    // State to track manual overrides before generating order
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

    const getStatusColor = (status: ItemMetrics['status']) => {
        switch (status) {
            case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
            case 'ORDER_SOON': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'HEALTHY': return 'bg-green-100 text-green-800 border-green-200';
            case 'OVERSTOCK': return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'DORMANT': return 'bg-gray-100 text-gray-800 border-gray-200';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    // Strict Filter Logic - No Magic Numbers in UI
    const criticalItems = metrics.filter(m => m.status === 'CRITICAL');
    const warningItems = metrics.filter(m => m.status === 'ORDER_SOON');
    const anomalyItems = metrics.filter(m => m.anomaliesDetected > 0 || m.isVolatile);

    // Financial Health
    const totalInventoryValue = metrics.reduce((sum, m) => sum + (m.currentStock * (inventory.find(i => i.id === m.itemId)?.averageCost || 0)), 0);
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

            // Only order if > 0
            if (finalQty > 0) {
                toOrder.push({ itemId: m.itemId, quantity: finalQty });

                // Check for override logging
                if (override && override.qty !== m.recommendedQuantity) {
                    if (!override.reason || override.reason.trim().length < 3) {
                        alert(`Please provide a reason for overriding ${m.itemName} (min 3 chars)`);
                        return; // Stop processing
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
            // Log overrides
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
        <div className="flex justify-center items-center p-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mr-3"></div>
            <span className="text-gray-500 font-medium">Analyzing Inventory Intelligence...</span>
        </div>
    );

    const renderRows = (items: ItemMetrics[]) => {
        if (items.length === 0) return (
            <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500 border-b border-gray-100">
                    <div className="flex flex-col items-center">
                        <i className="fa-solid fa-check-circle text-green-400 text-4xl mb-3"></i>
                        <p className="text-lg font-medium">No items found in this view.</p>
                        <p className="text-sm">Everything looks good!</p>
                    </div>
                </td>
            </tr>
        );

        return items.map((m) => {
            const override = overrides[m.itemId];
            const currentQty = override ? override.qty : m.recommendedQuantity;
            const isOverridden = override && override.qty !== m.recommendedQuantity;

            // Highlight suggested reorders
            const isReorder = m.recommendedQuantity > 0;

            return (
                <tr key={m.itemId} className={`hover:bg-gray-50 transition-colors ${isReorder ? 'bg-blue-50/10' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{m.itemName}</div>
                        <div className="text-xs text-gray-500">Current Stock: {m.currentStock}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-bold rounded-full border ${getStatusColor(m.status)}`}>
                            {m.status.replace('_', ' ')}
                        </span>
                        {m.leadTime && <div className="text-[10px] text-gray-400 mt-1">Lead Time: {m.leadTime}d</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {m.daysRemaining === Infinity ? '∞' : Math.round(m.daysRemaining)} days
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                            <div className="flex items-center">
                                <span className={`text-xs font-bold ${m.confidence === 'HIGH' ? 'text-green-600' : m.confidence === 'MEDIUM' ? 'text-yellow-600' : 'text-gray-400'}`}>
                                    {m.confidence}
                                </span>
                                {m.confidence === 'LOW' && <i className="fa-solid fa-circle-info ml-1 text-gray-400 text-[10px]" title="Collecting more data..."></i>}
                            </div>
                            {m.stabilityIndex > 0 && <span className="text-[10px] text-gray-400">Var: {Math.round(m.stabilityIndex)}%</span>}
                        </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 group">
                        <div className="flex items-center space-x-2">
                            <input
                                type="number"
                                min="0"
                                className={`w-20 p-1.5 text-center border rounded-md font-bold transition-all focus:ring-2 focus:ring-blue-500 outline-none
                                    ${isOverridden ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-700'}
                                    ${currentQty > 0 ? 'bg-white' : 'bg-gray-50/50 text-gray-400'}
                                `}
                                value={currentQty}
                                onChange={(e) => handleQtyChange(m.itemId, parseInt(e.target.value) || 0)}
                            />
                            <div className="flex flex-col text-[10px] text-gray-400 leading-tight">
                                <span>Rec: {m.recommendedQuantity}</span>
                                {isOverridden && <span className="text-orange-500 font-bold">Manual</span>}
                            </div>
                        </div>

                        {/* Inline Justification Input - Visible if overridden */}
                        <div className={`overflow-hidden transition-all duration-300 ${isOverridden ? 'max-h-20 mt-2 opacity-100' : 'max-h-0 opacity-0'}`}>
                            <input
                                type="text"
                                placeholder="Why change quantity?"
                                className="w-full text-xs p-2 border border-orange-200 rounded-md text-gray-600 placeholder-gray-400 focus:border-orange-400 focus:ring-1 focus:ring-orange-400 bg-white"
                                value={override?.reason || ''}
                                onChange={(e) => handleReasonChange(m.itemId, e.target.value)}
                            />
                        </div>
                    </td>
                    {activeTab === 'anomalies' && (
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-red-500">
                            {m.isVolatile && <div className="flex items-center gap-1"><i className="fa-solid fa-bolt"></i> High Volatility</div>}
                            {m.anomaliesDetected > 0 && <div className="flex items-center gap-1"><i className="fa-solid fa-triangle-exclamation"></i> {m.anomaliesDetected} Anomalies Excluded</div>}
                        </td>
                    )}
                </tr>
            );
        });
    };

    return (
        <div className="space-y-8 animate-fade-in-up">

            {/* Header / Financial Health */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Inventory Value</h3>
                        <p className="text-3xl font-black text-slate-800 tracking-tight">{formatCurrency(totalInventoryValue)}</p>
                        <p className="text-xs text-slate-400 mt-2 font-medium">As of today</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Capital Risk</h3>
                        <p className="text-3xl font-black text-purple-600 tracking-tight">{formatCurrency(overstockValue)}</p>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[10px] font-bold uppercase">Overstocked</span>
                            <p className="text-xs text-slate-400">Potential wasted capital</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Actionable Items</h3>
                        <div className="flex items-baseline gap-1">
                            <p className="text-3xl font-black text-slate-800 tracking-tight">{criticalItems.length + warningItems.length}</p>
                            <span className="text-sm font-bold text-slate-400">Total</span>
                        </div>
                        <div className="flex space-x-3 mt-3">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-white bg-red-500 px-2 py-1 rounded-md shadow-sm">
                                <i className="fa-solid fa-triangle-exclamation"></i> {criticalItems.length} Critical
                            </span>
                            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-md">
                                <i className="fa-solid fa-clock"></i> {warningItems.length} Order Soon
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Smart Actions Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/50 p-4 rounded-2xl border border-white/60 shadow-sm backdrop-blur-sm">
                <div className="flex p-1 bg-slate-100/80 rounded-xl">
                    <button
                        onClick={() => setActiveTab('actionable')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'actionable' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Actionable
                    </button>
                    <button
                        onClick={() => setActiveTab('anomalies')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'anomalies' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Anomalies
                    </button>
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        All Items
                    </button>
                </div>

                <button
                    onClick={handleGeneratePurchaseList}
                    className="w-full md:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-xl text-sm font-bold hover:shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 group shadow-emerald-500/20 shadow-md"
                >
                    <i className="fa-solid fa-cart-shopping group-hover:animate-bounce"></i>
                    Generate Purchase List
                </button>
            </div>

            {/* Data Table */}
            <div className="bg-white shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden border border-slate-100">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50/80">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Item Details</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Health Status</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Coverage</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Confidence</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-40">Reorder Qty</th>
                                {activeTab === 'anomalies' && <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Detected Issues</th>}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {renderRows(activeTab === 'actionable' ? [...criticalItems, ...warningItems] : activeTab === 'anomalies' ? anomalyItems : metrics)}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
