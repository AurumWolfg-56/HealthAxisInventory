import React from 'react';
import { InventoryItem } from '../types';

interface InventoryReportDocumentProps {
    data: {
        inventory: InventoryItem[];
        reportDate: string;
        author: string;
        facilityName: string;
    };
}

export const InventoryReportDocument: React.FC<InventoryReportDocumentProps> = ({ data }) => {
    const { inventory, reportDate, author, facilityName } = data;

    const totalItems = inventory.length;
    const totalStock = inventory.reduce((acc, item) => acc + item.stock, 0);
    const estimatedValue = inventory.reduce((acc, item) => acc + (item.stock * (item.averageCost || 0)), 0);

    const lowStockItems = inventory.filter(item => item.stock <= item.minStock);
    
    // Items that are completely expired (not just expiring soon)
    const expiredItems = inventory.filter(item => {
        if (!item.expiryDate) return false;
        const diffTime = new Date(item.expiryDate).getTime() - new Date().getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 0;
    });

    const hasLowStock = lowStockItems.length > 0;
    const hasExpired = expiredItems.length > 0;

    const formatCurrency = (val: number) => `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div
            id="inventory-report-document"
            className="bg-white text-slate-900 font-sans box-border relative leading-normal"
            style={{
                width: '215.9mm',
                minHeight: '279.4mm',
                margin: '0',
                padding: '0',
                backgroundColor: '#ffffff'
            }}
        >
            {/* Header Strip */}
            <div className="bg-[#0f172a] text-white px-12 pt-10 pb-8 flex justify-between items-center print-color-adjust" style={{ backgroundColor: '#0f172a', color: 'white', WebkitPrintColorAdjust: 'exact' }}>
                <div>
                    <h1 className="text-4xl font-black tracking-tight uppercase m-0 leading-none">
                        Health<span className="text-[#38bdf8]" style={{ color: '#38bdf8' }}>Axis</span>
                    </h1>
                    <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-slate-400 mt-2">
                        Inventory Status Report
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 text-sky-400" style={{color: '#38bdf8'}}>Facility</div>
                    <div className="text-xl font-black text-white uppercase tracking-tight">{facilityName || 'Main Clinic'}</div>
                </div>
            </div>

            {/* Meta Bar */}
            <div className="bg-[#f1f5f9] border-b border-slate-200 px-12 py-3 flex justify-between text-[10px] uppercase font-bold tracking-wide text-slate-500" style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                <div>Snapshot Date: <span className="text-slate-900 ml-2">{reportDate}</span></div>
                <div>Author: <span className="text-slate-900 ml-2">{author}</span></div>
                <div>Generated: <span className="text-slate-900 ml-2">{new Date().toLocaleTimeString()}</span></div>
            </div>

            <div className="p-12">
                {/* Executive Summary Cards */}
                <div className="flex justify-between gap-6 mb-10">
                    <div className="w-1/3 border border-slate-200 rounded-xl p-5 shadow-sm" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Total SKUs Tracked</div>
                        <div className="text-4xl font-black text-slate-900">{totalItems}</div>
                        <div className="text-[10px] font-medium text-slate-500 mt-2">Representing {totalStock} total physical units</div>
                    </div>
                    
                    <div className="w-1/3 border border-slate-200 rounded-xl p-5 shadow-sm" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Estimated Value</div>
                        <div className="text-4xl font-black text-slate-900">{formatCurrency(estimatedValue)}</div>
                        <div className="text-[10px] font-medium text-slate-500 mt-2">Based on weighted average costs</div>
                    </div>

                    <div
                        className="w-1/3 rounded-xl p-5 shadow-sm flex flex-col justify-center"
                        style={{
                            backgroundColor: hasExpired ? '#fef2f2' : hasLowStock ? '#fffbeb' : '#ecfdf5',
                            border: `1px solid ${hasExpired ? '#fecaca' : hasLowStock ? '#fde68a' : '#a7f3d0'}`
                        }}
                    >
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: hasExpired ? '#dc2626' : hasLowStock ? '#d97706' : '#059669' }}>
                            Security Posture
                        </div>
                        <div className="text-3xl font-black flex items-center gap-2" style={{ color: hasExpired ? '#b91c1c' : hasLowStock ? '#b45309' : '#047857' }}>
                            {hasExpired ? `${expiredItems.length} EXPIRED` : hasLowStock ? `${lowStockItems.length} ALERTS` : 'OPTIMAL'}
                        </div>
                        <div className="text-[10px] font-medium mt-2" style={{ color: hasExpired ? '#991b1b' : hasLowStock ? '#92400e' : '#065f46' }}>
                            {hasExpired ? 'Requires immediate disposal' : hasLowStock ? 'Requires immediate restock' : 'All systems normal'}
                        </div>
                    </div>
                </div>

                {/* Section 1: Critical Action Items (Only shows if there are alerts) */}
                {(hasLowStock || hasExpired) ? (
                    <div className="mb-10 min-h-[300px]">
                        <div className="flex items-center gap-3 border-b-2 border-slate-900 pb-2 mb-4" style={{borderBottom: '2px solid #0f172a'}}>
                            <div className="w-6 h-6 flex items-center justify-center text-xs font-bold rounded" style={{ backgroundColor: '#0f172a', color: 'white' }}>!</div>
                            <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Critical Action Required</h3>
                        </div>
                        
                        <div className="space-y-6">
                            {/* Expired Items */}
                            {expiredItems.length > 0 && (
                                <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#fca5a5' }}>
                                    <div className="px-4 py-2 font-bold text-[10px] uppercase tracking-wider bg-red-50 text-red-700" style={{backgroundColor: '#fef2f2', color: '#b91c1c'}}>
                                        EXPIRED INVENTORY ({expiredItems.length} SKUs) - DO NOT USE
                                    </div>
                                    <div className="p-4" style={{backgroundColor: '#ffffff'}}>
                                    <table className="w-full text-[10px] border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="text-left pb-2 text-slate-400 uppercase">Item Name</th>
                                                <th className="text-left pb-2 text-slate-400 uppercase">Batch</th>
                                                <th className="text-right pb-2 text-slate-400 uppercase">Expired On</th>
                                                <th className="text-right pb-2 text-slate-400 uppercase">Qty Affected</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {expiredItems.slice(0, 10).map(item => (
                                                <tr key={`exp-${item.id}`} className="border-t border-slate-100" style={{borderTop: '1px solid #f1f5f9'}}>
                                                    <td className="py-2 pr-4 font-bold text-slate-900">{item.name}</td>
                                                    <td className="py-2 pr-4 font-mono text-slate-500">{item.batchNumber}</td>
                                                    <td className="py-2 text-right text-red-600 font-bold">{new Date(item.expiryDate!).toLocaleDateString()}</td>
                                                    <td className="py-2 text-right font-black text-red-600">{item.stock} {item.unit}</td>
                                                </tr>
                                            ))}
                                            {expiredItems.length > 10 && (
                                                <tr>
                                                    <td colSpan={4} className="py-3 text-center text-red-500 font-bold italic border-t border-slate-100" style={{borderTop: '1px solid #f1f5f9'}}>
                                                        + {expiredItems.length - 10} more expired items. Please check dashboard for full list.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                    </div>
                                </div>
                            )}

                            {/* Low Stock Items (excluding ones that are already listed as expired) */}
                            {lowStockItems.filter(item => !expiredItems.some(e => e.id === item.id)).length > 0 && (
                                <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#fcd34d' }}>
                                    <div className="px-4 py-2 font-bold text-[10px] uppercase tracking-wider bg-amber-50 text-amber-700" style={{backgroundColor: '#fffbeb', color: '#b45309'}}>
                                        LOW STOCK ALERTS ({lowStockItems.filter(item => !expiredItems.some(e => e.id === item.id)).length} SKUs)
                                    </div>
                                    <div className="p-4" style={{backgroundColor: '#ffffff'}}>
                                    <table className="w-full text-[10px] border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="text-left pb-2 text-slate-400 uppercase">Item Name</th>
                                                <th className="text-left pb-2 text-slate-400 uppercase">Location</th>
                                                <th className="text-right pb-2 text-slate-400 uppercase">Min Req</th>
                                                <th className="text-right pb-2 text-slate-400 uppercase">Current Stock</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lowStockItems.filter(item => !expiredItems.some(e => e.id === item.id)).slice(0, 10).map(item => (
                                                <tr key={`low-${item.id}`} className="border-t border-slate-100" style={{borderTop: '1px solid #f1f5f9'}}>
                                                    <td className="py-2 pr-4 font-bold text-slate-900">{item.name}</td>
                                                    <td className="py-2 pr-4 text-slate-500">{item.location}</td>
                                                    <td className="py-2 text-right text-slate-500">{item.minStock}</td>
                                                    <td className="py-2 text-right font-black text-amber-600">{item.stock} {item.unit}</td>
                                                </tr>
                                            ))}
                                            {lowStockItems.filter(item => !expiredItems.some(e => e.id === item.id)).length > 10 && (
                                                <tr>
                                                    <td colSpan={4} className="py-3 text-center text-amber-600 font-bold italic border-t border-slate-100" style={{borderTop: '1px solid #f1f5f9'}}>
                                                        + {lowStockItems.filter(item => !expiredItems.some(e => e.id === item.id)).length - 10} more low stock items. Please check dashboard.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="mb-10 min-h-[250px] flex flex-col items-center justify-center p-10 border border-green-200 rounded-xl bg-green-50" style={{ borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }}>
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#dcfce7', color: '#166534', fontSize: '24px' }}>✓</div>
                        <h3 className="text-xl font-black text-green-800" style={{ color: '#166534' }}>Inventory is Healthy</h3>
                        <p className="text-sm font-medium text-green-700 mt-2" style={{ color: '#15803d' }}>There are no expired items or low stock alerts at this time.</p>
                    </div>
                )}

                {/* Signatures */}
                <div className="flex justify-between items-end mt-20 pt-8 break-inside-avoid">
                    <div className="w-[40%]">
                        <div className="border-b-2 border-slate-900 mb-2" style={{ borderBottom: '2px solid #0f172a' }}></div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Inventory Coordinator: {author}</div>
                        <div className="text-[8px] text-slate-400 mt-1 uppercase">Date & Signature</div>
                    </div>
                    <div className="w-[40%]">
                        <div className="border-b-2 border-slate-900 mb-2" style={{ borderBottom: '2px solid #0f172a' }}></div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Management Approval</div>
                        <div className="text-[8px] text-slate-400 mt-1 uppercase">Date & Signature</div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 bg-[#0f172a] px-12 py-4 flex justify-between text-[9px] text-slate-400 font-bold uppercase tracking-widest print-color-adjust" style={{ backgroundColor: '#0f172a', color: '#94a3b8', WebkitPrintColorAdjust: 'exact' }}>
                <div>Confidential Medical Records • Internal Use Only</div>
                <div>ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</div>
            </div>
        </div>
    );
};

