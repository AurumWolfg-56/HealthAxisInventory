
import React from 'react';
import { InventoryItem, ActivityLog } from '../types';

interface InventoryReportDocumentProps {
    data: {
        inventory: InventoryItem[];
        logs: ActivityLog[];
        startDate: string;
        endDate: string;
        author: string;
        facilityName: string;
    };
}

export const InventoryReportDocument: React.FC<InventoryReportDocumentProps> = ({ data }) => {
    const { inventory, logs, startDate, endDate, author, facilityName } = data;

    const totalItems = inventory.length;
    const totalStock = inventory.reduce((acc, item) => acc + item.stock, 0);
    const lowStockCount = inventory.filter(item => item.stock <= item.minStock).length;

    const formatCurrency = (val: number) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formatDate = (date: Date) => date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

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
            <div className="bg-slate-900 text-white px-12 py-8 flex justify-between items-center print-color-adjust" style={{ backgroundColor: '#0f172a', color: 'white', WebkitPrintColorAdjust: 'exact' }}>
                <div>
                    <h1 className="text-3xl font-black tracking-tight uppercase m-0 leading-none">
                        Health<span className="text-sky-400" style={{ color: '#38bdf8' }}>Axis</span> Inventory
                    </h1>
                    <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400 mt-2">
                        Professional Inventory & Audit Report
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Facility</div>
                    <div className="text-lg font-bold text-white uppercase">{facilityName || 'Main Clinic'}</div>
                </div>
            </div>

            {/* Meta Bar */}
            <div className="bg-slate-100 border-b border-slate-200 px-12 py-3 flex justify-between text-[10px] uppercase font-bold tracking-wide text-slate-500" style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                <div>Period: <span className="text-slate-900 ml-2">{startDate} — {endDate}</span></div>
                <div>Author: <span className="text-slate-900 ml-2">{author}</span></div>
                <div>Generated: <span className="text-slate-900 ml-2">{new Date().toLocaleString()}</span></div>
            </div>

            <div className="p-12">
                {/* Executive Summary Cards */}
                <div className="flex justify-between gap-6 mb-10">
                    <div className="w-[32%] bg-slate-50 border border-slate-200 rounded-lg p-4" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total SKUs</div>
                        <div className="text-3xl font-black text-slate-900 mt-1">{totalItems}</div>
                    </div>
                    <div className="w-[32%] bg-slate-50 border border-slate-200 rounded-lg p-4" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Units</div>
                        <div className="text-3xl font-black text-slate-900 mt-1">{totalStock}</div>
                    </div>
                    <div
                        className={`w-[32%] border rounded-lg p-4 flex flex-col justify-center ${lowStockCount > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}
                        style={{
                            backgroundColor: lowStockCount > 0 ? '#fef2f2' : '#ecfdf5',
                            borderColor: lowStockCount > 0 ? '#fecaca' : '#a7f3d0'
                        }}
                    >
                        <div className={`text-[10px] font-bold uppercase tracking-wider ${lowStockCount > 0 ? 'text-red-600' : 'text-emerald-600'}`} style={{ color: lowStockCount > 0 ? '#dc2626' : '#059669' }}>
                            Critical Alerts
                        </div>
                        <div className={`text-xl font-black mt-1 flex items-center gap-2 ${lowStockCount > 0 ? 'text-red-700' : 'text-emerald-700'}`} style={{ color: lowStockCount > 0 ? '#b91c1c' : '#047857' }}>
                            {lowStockCount} LOW STOCK
                        </div>
                    </div>
                </div>

                {/* Section 1: Inventory Snapshot */}
                <div className="mb-10">
                    <div className="flex items-center gap-3 border-b-2 border-slate-900 pb-2 mb-4">
                        <div className="w-6 h-6 bg-slate-900 text-white flex items-center justify-center text-xs font-bold rounded" style={{ backgroundColor: '#0f172a', color: 'white' }}>1</div>
                        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Current Inventory Status</h3>
                    </div>
                    <table className="w-full text-[10px] border-collapse">
                        <thead>
                            <tr className="border-b border-slate-300">
                                <th className="text-left py-2 font-bold text-slate-500 uppercase">Item Name</th>
                                <th className="text-left py-2 font-bold text-slate-500 uppercase">Category</th>
                                <th className="text-left py-2 font-bold text-slate-500 uppercase">Batch / Lot</th>
                                <th className="text-right py-2 font-bold text-slate-500 uppercase">Stock</th>
                                <th className="text-right py-2 font-bold text-slate-500 uppercase">Min</th>
                            </tr>
                        </thead>
                        <tbody>
                            {inventory.slice(0, 15).map((item) => (
                                <tr key={item.id} className="border-b border-slate-100">
                                    <td className="py-2 pr-4 font-bold text-slate-900">{item.name}</td>
                                    <td className="py-2 pr-4 text-slate-600">{item.category}</td>
                                    <td className="py-2 pr-4 font-mono text-slate-500">{item.batchNumber}</td>
                                    <td className={`py-2 text-right font-black ${item.stock <= item.minStock ? 'text-red-600' : 'text-slate-900'}`}>{item.stock}</td>
                                    <td className="py-2 text-right text-slate-400">{item.minStock}</td>
                                </tr>
                            ))}
                            {inventory.length > 15 && (
                                <tr>
                                    <td colSpan={5} className="py-2 text-center text-slate-400 italic">... showing first 15 items ({inventory.length} total) ...</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Section 2: Audit History */}
                <div className="mb-10 px-0">
                    <div className="flex items-center gap-3 border-b-2 border-slate-900 pb-2 mb-4">
                        <div className="w-6 h-6 bg-slate-900 text-white flex items-center justify-center text-xs font-bold rounded" style={{ backgroundColor: '#0f172a', color: 'white' }}>2</div>
                        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Activity Log (Audit Trail)</h3>
                    </div>
                    {logs.length === 0 ? (
                        <p className="text-slate-400 italic text-xs">No activity recorded for this period.</p>
                    ) : (
                        <div className="space-y-3">
                            {logs.slice(0, 20).map((log) => (
                                <div key={log.id} className="flex gap-4 text-[10px] items-start border-l-2 border-slate-200 pl-4 py-1">
                                    <div className="w-24 shrink-0 font-mono text-slate-400">
                                        {new Date(log.timestamp).toLocaleDateString()}
                                    </div>
                                    <div className="w-20 shrink-0">
                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold uppercase text-[8px]">
                                            {log.action}
                                        </span>
                                    </div>
                                    <div className="flex-1 text-slate-800 font-medium">
                                        {log.details}
                                    </div>
                                    <div className="w-24 shrink-0 text-right text-slate-500 font-bold">
                                        {log.user}
                                    </div>
                                </div>
                            ))}
                            {logs.length > 20 && (
                                <div className="text-center text-slate-400 italic py-2">... showing last 20 actions ({logs.length} total) ...</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Signatures */}
                <div className="flex justify-between items-end mt-16 pt-8 border-t border-slate-200" style={{ borderTop: '1px solid #e2e8f0' }}>
                    <div className="w-[40%]">
                        <div className="border-b border-slate-400 mb-2" style={{ borderBottom: '1px solid #94a3b8' }}></div>
                        <div className="text-[10px] font-bold uppercase text-slate-500">Inventory Coordinator: {author}</div>
                    </div>
                    <div className="w-[40%]">
                        <div className="border-b border-slate-400 mb-2" style={{ borderBottom: '1px solid #94a3b8' }}></div>
                        <div className="text-[10px] font-bold uppercase text-slate-500">Management Approval</div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 bg-slate-50 border-t border-slate-200 px-12 py-4 flex justify-between text-[9px] text-slate-400 font-medium uppercase tracking-wider" style={{ backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <div>Confidential Medical Inventory Records • Internal Use Only</div>
                <div>ID: {Math.random().toString(36).substr(2, 9).toUpperCase()} • Page 1 of 1</div>
            </div>
        </div>
    );
};
