import React, { useState, useEffect } from 'react';
import { DictationProtocolService } from '@/services/DictationProtocolService';
import { DictationProtocol, InventoryItem } from '@/types';
import { useInventory } from '@/contexts/InventoryContext';
import { useAppData } from '@/contexts/AppDataContext';

interface InventoryDeductionWidgetProps {
    procedures: string[];
    hasDeducted: boolean;
    onDeducted: () => void;
}

const InventoryDeductionWidget: React.FC<InventoryDeductionWidgetProps> = ({ procedures, hasDeducted, onDeducted }) => {
    const { inventory, updateItem } = useInventory();
    const { addLog } = useAppData();
    const [protocols, setProtocols] = useState<DictationProtocol[]>([]);
    const [matchedProtocols, setMatchedProtocols] = useState<DictationProtocol[]>([]);
    const [isDeducting, setIsDeducting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchProtocols = async () => {
            setIsLoading(true);
            try {
                const data = await DictationProtocolService.fetchAll();
                setProtocols(data);
            } catch (error) {
                console.error('Failed to fetch protocols', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProtocols();
    }, []);

    useEffect(() => {
        if (!procedures || procedures.length === 0 || protocols.length === 0) {
            setMatchedProtocols([]);
            return;
        }

        const matched = protocols.filter(protocol => {
            const protocolNameLower = protocol.name.toLowerCase();
            const keywordsLower = (protocol.keywords || []).map(k => k.toLowerCase());
            
            return procedures.some(proc => {
                const procLower = proc.toLowerCase();
                return procLower.includes(protocolNameLower) || 
                       protocolNameLower.includes(procLower) ||
                       keywordsLower.some(k => procLower.includes(k) || k.includes(procLower));
            });
        });

        // Filter out protocols with no items
        setMatchedProtocols(matched.filter(p => p.items && p.items.length > 0));
    }, [procedures, protocols]);

    const handleConfirmDeduction = async () => {
        if (matchedProtocols.length === 0) return;
        setIsDeducting(true);

        try {
            // Flatten all deductions from all matched protocols
            const allDeductions: { inventoryItemId: string, totalQuantity: number }[] = [];
            
            for (const protocol of matchedProtocols) {
                for (const item of (protocol.items || [])) {
                    const existing = allDeductions.find(d => d.inventoryItemId === item.inventoryItemId);
                    if (existing) {
                        existing.totalQuantity += item.quantity;
                    } else {
                        allDeductions.push({ inventoryItemId: item.inventoryItemId, totalQuantity: item.quantity });
                    }
                }
            }

            // Deduct each item sequentially
            for (const deduction of allDeductions) {
                const invItem = inventory.find(i => i.id === deduction.inventoryItemId);
                if (invItem && invItem.stock >= deduction.totalQuantity) {
                    await updateItem(invItem.id, {
                        stock: invItem.stock - deduction.totalQuantity
                    });
                } else if (invItem) {
                     // Deduct whatever is left
                     await updateItem(invItem.id, {
                        stock: 0
                    });
                }
            }

            // Create Audit Logs
            for (const protocol of matchedProtocols) {
                addLog('CONSUMED', `Deducción automática por Protocolo Clínico: ${protocol.name}`, 'Sistema IA');
            }

            onDeducted();
        } catch (error) {
            console.error('Deduction failed', error);
            alert('Failed to deduct inventory. Please check the logs.');
        } finally {
            setIsDeducting(false);
        }
    };

    if (isLoading) return null;
    if (!procedures || procedures.length === 0) return null;
    if (matchedProtocols.length === 0) return null;

    return (
        <div className="mt-4 rounded-xl border border-medical-200 dark:border-medical-800 bg-medical-50/50 dark:bg-medical-900/20 overflow-hidden">
            <div className="px-4 py-2 bg-white/50 dark:bg-gray-800/50 border-b border-inherit flex justify-between items-center">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-medical-600 flex items-center gap-2">
                    <i className="fa-solid fa-box-open"></i> Suggested Inventory Deductions
                </h4>
                {hasDeducted ? (
                    <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-md">
                        <i className="fa-solid fa-check mr-1"></i> Deducted
                    </span>
                ) : (
                    <button 
                        onClick={handleConfirmDeduction}
                        disabled={isDeducting}
                        className="text-xs font-bold bg-medical-600 text-white px-3 py-1 rounded-md shadow hover:bg-medical-700 transition-colors disabled:opacity-50"
                    >
                        {isDeducting ? 'Processing...' : 'Confirm Deduction'}
                    </button>
                )}
            </div>
            
            <div className="p-3">
                <div className="text-xs text-slate-500 mb-3">
                    Based on dictated procedures: <strong>{procedures.join(', ')}</strong>
                </div>
                
                <div className="space-y-3">
                    {matchedProtocols.map(protocol => (
                        <div key={protocol.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2">
                            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 border-b border-slate-100 dark:border-slate-700 pb-1">
                                {protocol.name}
                            </div>
                            <ul className="space-y-1 mt-1">
                                {protocol.items?.map((item, idx) => {
                                    const invItem = inventory.find(i => i.id === item.inventoryItemId);
                                    return (
                                        <li key={idx} className="flex justify-between items-center text-xs">
                                            <span className={!invItem ? "text-red-500 line-through" : "text-slate-600 dark:text-slate-400"}>
                                                {invItem ? invItem.name : 'Unknown Item'}
                                            </span>
                                            <span className="font-bold text-medical-600">
                                                -{item.quantity}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default InventoryDeductionWidget;
