import React, { useState, useEffect } from 'react';
import { InventoryIntelligenceService, AIOrderDraftResponse } from '../services/InventoryIntelligenceService';
import { ItemMetrics, InventoryItem } from '../types';

interface AISmartCartModalProps {
    isOpen: boolean;
    onClose: () => void;
    vulnerableItems: ItemMetrics[];
    rawInventory: InventoryItem[];
    onCommitCart: (items: { itemId: string, quantity: number }[]) => void;
}

export const AISmartCartModal: React.FC<AISmartCartModalProps> = ({
    isOpen,
    onClose,
    vulnerableItems,
    rawInventory,
    onCommitCart
}) => {
    const [loading, setLoading] = useState(true);
    const [draft, setDraft] = useState<AIOrderDraftResponse | null>(null);
    const [selectedItems, setSelectedItems] = useState<Record<string, { selected: boolean, quantity: number }>>({});

    useEffect(() => {
        if (isOpen && vulnerableItems.length > 0) {
            generateDraft();
        }
    }, [isOpen]);

    const generateDraft = async () => {
        setLoading(true);
        try {
            const aiResponse = await InventoryIntelligenceService.generateAIOrderDraft(vulnerableItems, rawInventory);
            setDraft(aiResponse);
            
            // Initialize selection state
            const initialSelection: Record<string, { selected: boolean, quantity: number }> = {};
            aiResponse.prioritizedCart.forEach(category => {
                category.items.forEach(item => {
                    // Pre-select everything EXCEPT "Review Only" items
                    const isSelected = category.categoryName !== 'Review Only (Expiring)';
                    initialSelection[item.itemId] = {
                        selected: isSelected,
                        quantity: Math.max(1, item.proposedQuantity)
                    };
                });
            });
            setSelectedItems(initialSelection);
        } catch (error) {
            console.error("AI Error:", error);
            alert("Hubo un error contactando a la IA. Revisa tu consola.");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleItem = (itemId: string) => {
        setSelectedItems(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], selected: !prev[itemId].selected }
        }));
    };

    const handleQtyChange = (itemId: string, qty: number) => {
        setSelectedItems(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], quantity: Math.max(0, qty) }
        }));
    };

    const handleConfirm = () => {
        const finalItems = Object.entries(selectedItems)
            .filter(([_, data]) => data.selected && data.quantity > 0)
            .map(([itemId, data]) => ({ itemId, quantity: data.quantity }));
            
        onCommitCart(finalItems);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
            
            <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-50 dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-medical-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-medical-500/20">
                            <i className="fa-solid fa-robot text-white text-xl"></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">AI Smart Order Draft</h2>
                            <p className="text-sm text-slate-500">Gemma 4 E4B Logistic Analysis</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-6">
                            <div className="relative w-16 h-16">
                                <div className="absolute inset-0 rounded-full border-4 border-medical-500/20"></div>
                                <div className="absolute inset-0 rounded-full border-4 border-medical-500 border-t-transparent animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <i className="fa-solid fa-brain text-medical-500"></i>
                                </div>
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">La IA está evaluando el inventario...</h3>
                                <p className="text-sm text-slate-500 mt-1">Gemma está cruzando niveles médicos y fechas de caducidad.</p>
                            </div>
                        </div>
                    ) : draft ? (
                        <div className="space-y-6">
                            {/* Strategy Notice */}
                            <div className="glass-panel p-5 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 dark:from-blue-500/20 text-blue-900 dark:text-blue-100 border-blue-200/50 dark:border-blue-500/20">
                                <div className="flex items-start gap-4">
                                    <i className="fa-solid fa-lightbulb text-xl text-blue-500 mt-1"></i>
                                    <div>
                                        <h4 className="font-bold text-blue-800 dark:text-blue-200 mb-1">Intelligence Strategy Note</h4>
                                        <p className="text-sm font-medium leading-relaxed opacity-90">{draft.strategyNotes}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Cart Categories */}
                            <div className="space-y-6">
                                {draft.prioritizedCart.map((category, idx) => {
                                    const isVital = category.categoryName.includes('Vital');
                                    const isExpiring = category.categoryName.includes('Review');
                                    
                                    // Visual styling per category
                                    const headerColor = isVital ? 'text-red-600 dark:text-red-400' : isExpiring ? 'text-amber-600 dark:text-amber-400' : 'text-medical-600 dark:text-medical-400';
                                    const icon = isVital ? 'fa-heart-pulse' : isExpiring ? 'fa-calendar-xmark' : 'fa-box';
                                    const bgBadge = isVital ? 'bg-red-500/10' : isExpiring ? 'bg-amber-500/10' : 'bg-medical-500/10';

                                    return (
                                        <div key={idx} className="glass-panel overflow-hidden border border-slate-200 dark:border-slate-800">
                                            <div className={`px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 ${bgBadge}`}>
                                                <i className={`fa-solid ${icon} ${headerColor}`}></i>
                                                <h3 className={`font-bold text-sm uppercase tracking-wider ${headerColor}`}>
                                                    {category.categoryName}
                                                </h3>
                                                <span className="ml-auto text-xs font-bold bg-white/50 dark:bg-black/20 px-2 py-1 rounded-md">{category.items.length} ítems</span>
                                            </div>
                                            
                                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {category.items.map(item => {
                                                    const selection = selectedItems[item.itemId];
                                                    if (!selection) return null;
                                                    
                                                    return (
                                                        <div key={item.itemId} className={`flex items-start gap-4 p-4 transition-colors ${selection.selected ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-900/50 opacity-60'}`}>
                                                            
                                                            <button 
                                                                onClick={() => handleToggleItem(item.itemId)}
                                                                className={`mt-1 shrink-0 w-6 h-6 rounded-md flex items-center justify-center border transition-all ${selection.selected ? 'bg-medical-500 border-medical-500 text-white' : 'border-slate-300 dark:border-slate-600 text-transparent'}`}
                                                            >
                                                                <i className="fa-solid fa-check text-[10px]"></i>
                                                            </button>

                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="font-bold text-slate-900 dark:text-white truncate">{item.itemName}</h4>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                                                    <i className="fa-solid fa-wand-magic-sparkles text-medical-500 mr-1.5 opacity-70"></i>
                                                                    {item.aiJustification}
                                                                </p>
                                                            </div>

                                                            <div className="shrink-0 flex items-center gap-3">
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">Qty</span>
                                                                <input 
                                                                    type="number"
                                                                    min="1"
                                                                    disabled={!selection.selected}
                                                                    className="w-20 text-center font-bold bg-slate-100 dark:bg-slate-800 border-0 rounded-lg h-10 focus:ring-2 focus:ring-medical-500 disabled:opacity-50"
                                                                    value={selection.quantity}
                                                                    onChange={(e) => handleQtyChange(item.itemId, parseInt(e.target.value) || 0)}
                                                                />
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20 text-slate-500">Error: No se pudo generar la lista.</div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex items-center justify-between">
                    <div className="text-sm font-medium text-slate-500">
                        Ítems seleccionados: <strong className="text-slate-900 dark:text-white">
                            {Object.values(selectedItems).filter(s => s.selected).length}
                        </strong>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="btn-secondary">Cancelar</button>
                        <button 
                            onClick={handleConfirm} 
                            disabled={loading || !draft}
                            className="btn-primary shadow-lg shadow-medical-500/20 flex items-center gap-2"
                        >
                            <i className="fa-solid fa-cart-arrow-down"></i>
                            Agregar al Nuevo Pedido
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
