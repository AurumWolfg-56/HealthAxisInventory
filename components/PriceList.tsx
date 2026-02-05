
import React, { useState, useRef, useMemo } from 'react';
import { PriceItem, User, Permission } from '../types';
import * as XLSX from 'xlsx';

interface PriceListProps {
    prices: PriceItem[];
    user: User;
    hasPermission: (permission: Permission) => boolean;
    onAddPrice?: (price: Omit<PriceItem, 'id'>) => Promise<void>;
    onUpdatePrice?: (price: PriceItem) => Promise<void>;
    onDeletePrice?: (id: string) => Promise<void>;
    onImportPrices?: (prices: Omit<PriceItem, 'id'>[]) => Promise<void>;
    isLoadingPrices?: boolean;
    t: (key: string) => string;
}

const PriceList: React.FC<PriceListProps> = ({ prices, user, hasPermission, onAddPrice, onUpdatePrice, onDeletePrice, onImportPrices, isLoadingPrices, t }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<PriceItem | null>(null);
    const [formData, setFormData] = useState<Partial<PriceItem>>({});
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const canManage = hasPermission('prices.manage');

    // Extract unique categories from data
    const categories = useMemo(() => {
        const cats = new Set(prices.map(p => p.category || 'General'));
        return ['All', ...Array.from(cats).sort()];
    }, [prices]);

    // Filter Logic
    const filteredPrices = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return prices.filter(item => {
            const matchesSearch =
                item.serviceName.toLowerCase().includes(term) ||
                (item.code && item.code.toLowerCase().includes(term));
            const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [prices, searchTerm, selectedCategory]);

    // Stats
    const stats = useMemo(() => ({
        total: prices.length,
        categories: new Set(prices.map(p => p.category)).size,
        avgPrice: prices.length > 0 ? prices.reduce((sum, p) => sum + p.price, 0) / prices.length : 0
    }), [prices]);

    const localIsLoading = isLoading || isLoadingPrices;

    // CSV Import
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (prices.length > 0 && !window.confirm('This will replace all existing prices. Continue?')) {
            e.target.value = '';
            return;
        }

        setIsLoading(true);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rawData = XLSX.utils.sheet_to_json(sheet);

            const newPrices: PriceItem[] = rawData.map((row: any, idx) => {
                const cleanRow: Record<string, any> = {};
                Object.keys(row).forEach(key => {
                    cleanRow[key.trim().toLowerCase()] = row[key];
                });

                let rawName = String(cleanRow['name'] || cleanRow['service'] || cleanRow['description'] || '').trim();
                const rawPrice = cleanRow['price'] || cleanRow['cost'] || cleanRow['amount'] || '0';
                const category = String(cleanRow['category'] || cleanRow['group'] || 'General').trim();
                let code = cleanRow['code'] ? String(cleanRow['code']).trim() : undefined;

                if (!code) {
                    const codeMatch = rawName.match(/^(\d{4,5}[A-Z]?)\s+(.*)/);
                    if (codeMatch) {
                        code = codeMatch[1];
                        rawName = codeMatch[2];
                    }
                }

                return {
                    id: `p-${Date.now()}-${idx}`,
                    serviceName: rawName,
                    price: parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0,
                    category: category,
                    code: code
                };
            }).filter(p => p.serviceName && p.price >= 0);

            if (newPrices.length > 0) {
                if (onImportPrices) {
                    // Remove IDs for import
                    await onImportPrices(newPrices.map(({ id, ...rest }) => rest));
                }
            }
        } catch (error) {
            console.error("Import failed", error);
        } finally {
            setIsLoading(false);
            e.target.value = '';
        }
    };

    const handleAddNew = () => {
        setEditingItem(null);
        setFormData({ serviceName: '', price: 0, category: 'General', code: '' });
        setIsModalOpen(true);
    };

    const handleEdit = (item: PriceItem) => {
        setEditingItem(item);
        setFormData({ ...item });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.serviceName || formData.price === undefined || formData.price < 0) return;

        setIsLoading(true);
        try {
            if (editingItem && onUpdatePrice) {
                await onUpdatePrice({ ...editingItem, ...formData } as PriceItem);
            } else if (onAddPrice) {
                await onAddPrice({
                    serviceName: formData.serviceName!,
                    price: formData.price!,
                    category: formData.category || 'General',
                    code: formData.code
                });
            }
            setIsModalOpen(false);
            setFormData({});
            setEditingItem(null);
        } catch (e) {
            console.error(e);
            alert('Failed to save price');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Delete this service?') && onDeletePrice) {
            try {
                setIsLoading(true);
                await onDeletePrice(id);
            } catch (e) {
                alert('Failed to delete');
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="space-y-10 animate-fade-in-up">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".csv,.xlsx,.xls" />

            {/* Header with Stats */}
            <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-medical-500 flex items-center justify-center shadow-lg shadow-medical-500/20">
                            <i className="fa-solid fa-tags text-xl text-white"></i>
                        </div>
                        <div>
                            <h2 className="text-display text-slate-900 dark:text-white">{t('pl_title')}</h2>
                            <p className="text-caption mt-0.5">{t('pl_subtitle')}</p>
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="flex flex-wrap gap-4 pt-4">
                        <div className="glass-panel px-6 py-3 rounded-2xl flex items-center gap-3 border shadow-sm group hover:scale-105 transition-transform">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <i className="fa-solid fa-list-check"></i>
                            </div>
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Services</div>
                                <div className="text-lg font-black text-slate-900 dark:text-white leading-none">{stats.total}</div>
                            </div>
                        </div>
                        <div className="glass-panel px-6 py-3 rounded-2xl flex items-center gap-3 border shadow-sm group hover:scale-105 transition-transform">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <i className="fa-solid fa-layer-group"></i>
                            </div>
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Categories</div>
                                <div className="text-lg font-black text-slate-900 dark:text-white leading-none">{stats.categories}</div>
                            </div>
                        </div>
                        <div className="glass-panel px-6 py-3 rounded-2xl flex items-center gap-3 border shadow-sm group hover:scale-105 transition-transform">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                <i className="fa-solid fa-chart-line"></i>
                            </div>
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Avg. Price</div>
                                <div className="text-lg font-black text-slate-900 dark:text-white leading-none">${stats.avgPrice.toFixed(0)}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                {canManage && (
                    <div className="flex gap-3">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                            className="h-14 px-6 glass-panel text-slate-900 dark:text-white rounded-2xl font-bold shadow-lg flex items-center gap-3 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                        >
                            {isLoading ? (
                                <i className="fa-solid fa-spinner animate-spin text-lg"></i>
                            ) : (
                                <i className="fa-solid fa-cloud-arrow-up text-lg text-emerald-600"></i>
                            )}
                            <span className="hidden sm:inline">Import CSV</span>
                        </button>
                        <button
                            onClick={handleAddNew}
                            className="h-14 px-8 bg-emerald-600 text-white rounded-2xl font-black shadow-2xl shadow-emerald-500/40 flex items-center gap-3 transition-all hover:scale-105 active:scale-95 group"
                        >
                            <i className="fa-solid fa-plus text-xl group-hover:rotate-90 transition-transform"></i>
                            <span className="tracking-tight">Add Service</span>
                        </button>
                    </div>
                )}
            </header>

            {/* Search & Filter Bar */}
            <div className="sticky top-4 z-40 mx-[-1rem] px-4 md:mx-0 md:px-0">
                <div className="glass-panel p-3 rounded-[2.5rem] luxury-shadow flex flex-col md:flex-row gap-3 border-white/50 dark:border-slate-800/80">
                    <div className="relative flex-1 group">
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none transition-transform group-focus-within:scale-110">
                            <i className="fa-solid fa-magnifying-glass text-xl text-slate-400 group-focus-within:text-emerald-500 transition-colors"></i>
                        </div>
                        <input
                            type="text"
                            placeholder="Search services, codes..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-14 pl-16 pr-12 bg-transparent text-lg font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none rounded-2xl"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500 flex items-center justify-center transition-colors"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        )}
                    </div>
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="h-14 px-6 bg-white dark:bg-slate-800 rounded-2xl font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer min-w-[180px]"
                    >
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Results Table */}
            <div className="glass-panel rounded-[2.5rem] luxury-shadow overflow-hidden border border-white/50 dark:border-slate-800/60">
                {filteredPrices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6">
                            <i className="fa-solid fa-receipt text-4xl opacity-30"></i>
                        </div>
                        <p className="text-xl font-bold">No services found</p>
                        <p className="text-sm mt-2 text-slate-400">Try adjusting your search or add a new service</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-auto max-h-[60vh] custom-scrollbar">
                            <table className="w-full">
                                <thead className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 sticky top-0 backdrop-blur-xl z-10">
                                    <tr>
                                        <th className="p-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Service</th>
                                        <th className="p-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                                        <th className="p-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Price</th>
                                        {canManage && <th className="p-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-32">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                    {filteredPrices.map((item, idx) => (
                                        <tr
                                            key={item.id}
                                            className="group hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all"
                                            style={{ animationDelay: `${idx * 20}ms` }}
                                        >
                                            <td className="p-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-black text-lg shadow-sm">
                                                        {item.serviceName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors leading-tight">
                                                            {item.serviceName}
                                                        </div>
                                                        {item.code && (
                                                            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-500 border border-slate-200 dark:border-slate-700">
                                                                CPT: {item.code}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <span className="inline-flex px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50">
                                                    {item.category}
                                                </span>
                                            </td>
                                            <td className="p-6 text-right">
                                                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                                    ${item.price.toFixed(2)}
                                                </div>
                                            </td>
                                            {canManage && (
                                                <td className="p-6">
                                                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                                        <button
                                                            onClick={() => handleEdit(item)}
                                                            className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800/60 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm"
                                                        >
                                                            <i className="fa-solid fa-pen text-sm"></i>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(item.id)}
                                                            className="w-11 h-11 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/60 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm"
                                                        >
                                                            <i className="fa-solid fa-trash text-sm"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto max-h-[65vh] custom-scrollbar">
                            {filteredPrices.map(item => (
                                <div
                                    key={item.id}
                                    className="p-5 flex items-center gap-4 active:bg-slate-50 dark:active:bg-slate-800 transition-colors"
                                    onClick={() => canManage && handleEdit(item)}
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-black text-xl shadow-sm flex-shrink-0">
                                        {item.serviceName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-900 dark:text-white truncate">{item.serviceName}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">{item.category}</span>
                                            {item.code && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                    <span className="text-[10px] font-mono text-slate-400">{item.code}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                                            ${item.price.toFixed(2)}
                                        </div>
                                    </div>
                                    {canManage && (
                                        <i className="fa-solid fa-chevron-right text-slate-300 dark:text-slate-600"></i>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-fade-in">
                    <div
                        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-slate-800 overflow-hidden animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
                                        <i className={`fa-solid ${editingItem ? 'fa-pen-to-square' : 'fa-plus'} text-2xl text-white`}></i>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                            {editingItem ? 'Edit Service' : 'New Service'}
                                        </h2>
                                        <p className="text-sm text-slate-500">
                                            {editingItem ? 'Update the service details below' : 'Add a new price listing'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30 transition-all"
                                >
                                    <i className="fa-solid fa-xmark text-xl"></i>
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                                    <i className="fa-solid fa-tag mr-2"></i>Service Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.serviceName || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, serviceName: e.target.value }))}
                                    className="w-full h-14 px-5 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-lg font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                    placeholder="e.g., Blood Panel - Complete"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                                        <i className="fa-solid fa-dollar-sign mr-2"></i>Price *
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.price ?? ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                                        className="w-full h-14 px-5 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-lg font-black text-emerald-600 dark:text-emerald-400 focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                                        <i className="fa-solid fa-folder mr-2"></i>Category
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.category || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full h-14 px-5 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-lg font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                        placeholder="General"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                                    <i className="fa-solid fa-barcode mr-2"></i>CPT Code (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={formData.code || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                                    className="w-full h-14 px-5 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 font-mono text-lg font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                    placeholder="88304"
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex gap-4">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 h-14 rounded-2xl bg-slate-200 dark:bg-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all active:scale-[0.98]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={(!formData.serviceName || formData.price === undefined || formData.price < 0) || localIsLoading}
                                className="flex-1 h-14 rounded-2xl bg-emerald-600 text-white font-black shadow-xl shadow-emerald-500/30 hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                            >
                                {localIsLoading ? <i className="fa-solid fa-spinner animate-spin text-xl"></i> : <i className={`fa-solid ${editingItem ? 'fa-check' : 'fa-plus'} text-xl`}></i>}
                                {editingItem ? 'Save Changes' : 'Add Service'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PriceList;
