
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
    onToggleFeatured?: (id: string, isFeatured: boolean) => Promise<void>;
    isLoadingPrices?: boolean;
    t: (key: string) => string;
}

const PriceList: React.FC<PriceListProps> = ({ prices, user, hasPermission, onAddPrice, onUpdatePrice, onDeletePrice, onImportPrices, onToggleFeatured, isLoadingPrices, t }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [priceTab, setPriceTab] = useState<'individual' | 'combo'>('individual');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<PriceItem | null>(null);
    const [formData, setFormData] = useState<Partial<PriceItem>>({});
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const canManage = hasPermission('prices.manage');

    // Filter by tab type first
    const tabPrices = useMemo(() => {
        return prices.filter(p => (p.type || 'individual') === priceTab);
    }, [prices, priceTab]);

    // Extract unique categories from filtered data
    const categories = useMemo(() => {
        const cats = new Set(tabPrices.map(p => p.category || 'General'));
        return ['All', ...Array.from(cats).sort()];
    }, [tabPrices]);

    // Reset category filter when switching tabs
    const handleTabChange = (tab: 'individual' | 'combo') => {
        setPriceTab(tab);
        setSelectedCategory('All');
        setSearchTerm('');
    };

    // Filter Logic
    const filteredPrices = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return tabPrices.filter(item => {
            const matchesSearch =
                item.serviceName.toLowerCase().includes(term) ||
                (item.code && item.code.toLowerCase().includes(term));
            const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [tabPrices, searchTerm, selectedCategory]);

    // Featured prices for current tab
    const featuredPrices = useMemo(() => {
        return tabPrices.filter(p => p.isFeatured);
    }, [tabPrices]);

    // Color palette for featured cards
    const cardColors = useMemo(() => [
        { bg: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/30', light: 'bg-emerald-400/20' },
        { bg: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/30', light: 'bg-blue-400/20' },
        { bg: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/30', light: 'bg-violet-400/20' },
        { bg: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-500/30', light: 'bg-amber-400/20' },
        { bg: 'from-rose-500 to-pink-600', shadow: 'shadow-rose-500/30', light: 'bg-rose-400/20' },
        { bg: 'from-cyan-500 to-sky-600', shadow: 'shadow-cyan-500/30', light: 'bg-cyan-400/20' },
    ], []);

    // Stats based on current tab
    const stats = useMemo(() => ({
        total: tabPrices.length,
        categories: new Set(tabPrices.map(p => p.category)).size,
        avgPrice: tabPrices.length > 0 ? tabPrices.reduce((sum, p) => sum + p.price, 0) / tabPrices.length : 0
    }), [tabPrices]);

    // Total counts for tab badges
    const individualCount = useMemo(() => prices.filter(p => (p.type || 'individual') === 'individual').length, [prices]);
    const comboCount = useMemo(() => prices.filter(p => (p.type || 'individual') === 'combo').length, [prices]);

    const localIsLoading = isLoading || isLoadingPrices;

    // CSV Import
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const targetName = priceTab === 'combo' ? 'Packages & Combos' : 'Individual Services';
        if (!window.confirm(`Importing into ${targetName}.\n\nNew items from the CSV will be added to your current list. Existing items will not be deleted.\n\nContinue?`)) {
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
                    code: code,
                    type: priceTab  // Tag with current tab type
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
        setFormData({ serviceName: '', price: 0, category: 'General', code: '', type: priceTab });
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
                            className={`h-14 px-6 glass-panel text-slate-900 dark:text-white rounded-2xl font-bold shadow-lg flex items-center gap-3 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 ${priceTab === 'combo' ? 'border-violet-200 dark:border-violet-800' : 'border-emerald-200 dark:border-emerald-800'}`}
                        >
                            {isLoading ? (
                                <i className="fa-solid fa-spinner animate-spin text-lg"></i>
                            ) : (
                                <i className={`fa-solid fa-cloud-arrow-up text-lg ${priceTab === 'combo' ? 'text-violet-600' : 'text-emerald-600'}`}></i>
                            )}
                            <span className="hidden sm:inline">
                                {priceTab === 'combo' ? 'Import Combos (CSV)' : 'Import Services (CSV)'}
                            </span>
                        </button>
                        <button
                            onClick={handleAddNew}
                            className={`h-14 px-8 text-white rounded-2xl font-black shadow-2xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95 group ${priceTab === 'combo' ? 'bg-violet-600 shadow-violet-500/40' : 'bg-emerald-600 shadow-emerald-500/40'}`}
                        >
                            <i className="fa-solid fa-plus text-xl group-hover:rotate-90 transition-transform"></i>
                            <span className="tracking-tight">
                                {priceTab === 'combo' ? 'Add Combo' : 'Add Service'}
                            </span>
                        </button>
                    </div>
                )}
            </header>

            {/* Individual / Combos Tabs */}
            <div className="glass-panel p-1.5 rounded-2xl flex w-full md:w-fit overflow-x-auto shadow-sm">
                <button
                    onClick={() => handleTabChange('individual')}
                    className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${priceTab === 'individual'
                        ? 'bg-white dark:bg-slate-800 shadow-sm text-emerald-600'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                >
                    <i className="fa-solid fa-tag"></i>
                    Individual Services
                    {individualCount > 0 && (
                        <span className="ml-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-bold">{individualCount}</span>
                    )}
                </button>
                <button
                    onClick={() => handleTabChange('combo')}
                    className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${priceTab === 'combo'
                        ? 'bg-white dark:bg-slate-800 shadow-sm text-violet-600'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                >
                    <i className="fa-solid fa-boxes-stacked"></i>
                    Packages & Combos
                    {comboCount > 0 && (
                        <span className="ml-1 px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-full text-xs font-bold">{comboCount}</span>
                    )}
                </button>
            </div>

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

            {/* Featured Prices Widget */}
            {featuredPrices.length > 0 && (
                <section className="space-y-4 animate-fade-in-up">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <i className="fa-solid fa-star text-amber-500 text-lg"></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                                {priceTab === 'individual' ? 'Quick Reference Services' : 'Quick Reference Packages'}
                            </h2>
                            <p className="text-xs text-slate-400 font-bold">{featuredPrices.length} pinned {priceTab === 'individual' ? 'services' : 'packages'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {featuredPrices.map((item, idx) => {
                            const color = cardColors[idx % cardColors.length];
                            return (
                                <div
                                    key={`featured-${item.id}`}
                                    className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${color.bg} p-5 shadow-xl ${color.shadow} hover:scale-[1.03] hover:shadow-2xl transition-all duration-300 cursor-default group`}
                                >
                                    {/* Decorative circles */}
                                    <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full ${color.light} blur-sm group-hover:scale-150 transition-transform duration-500`}></div>
                                    <div className={`absolute -bottom-4 -left-4 w-16 h-16 rounded-full ${color.light} blur-sm`}></div>

                                    {/* Unpin button (Manage only) */}
                                    {canManage && (
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (onToggleFeatured) await onToggleFeatured(item.id, false);
                                            }}
                                            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white text-white hover:text-red-500 backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 z-20"
                                            title="Unpin"
                                        >
                                            <i className="fa-solid fa-star-half-stroke"></i>
                                        </button>
                                    )}

                                    <div className="relative z-10">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0 pr-8">
                                                <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1 truncate">{item.category}</p>
                                                <h3 className="text-white font-bold text-sm leading-tight line-clamp-2">{item.serviceName}</h3>
                                            </div>
                                            <div className="flex-shrink-0 text-right">
                                                <div className="text-white font-black text-2xl tabular-nums leading-none">
                                                    ${item.price.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                        {item.code && (
                                            <div className="mt-3">
                                                <span className="inline-flex px-2 py-0.5 rounded-md bg-white/15 text-white/80 text-[10px] font-mono font-bold backdrop-blur-sm">
                                                    CPT: {item.code}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

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
                                                    {/* Star toggle for individual tab */}
                                                    {priceTab === 'individual' && canManage && (
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if (onToggleFeatured) {
                                                                    await onToggleFeatured(item.id, !item.isFeatured);
                                                                }
                                                            }}
                                                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-125 active:scale-90 flex-shrink-0 ${item.isFeatured
                                                                ? 'text-amber-400 hover:text-amber-500'
                                                                : 'text-slate-300 dark:text-slate-600 hover:text-amber-400'
                                                                }`}
                                                            title={item.isFeatured ? 'Remove from Dashboard' : 'Pin to Dashboard'}
                                                        >
                                                            <i className={`fa-${item.isFeatured ? 'solid' : 'regular'} fa-star text-lg`}></i>
                                                        </button>
                                                    )}
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
                                            <td className="p-6 text-right whitespace-nowrap">
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
                                >
                                    {/* Star toggle for mobile */}
                                    {priceTab === 'individual' && canManage && (
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (onToggleFeatured) {
                                                    await onToggleFeatured(item.id, !item.isFeatured);
                                                }
                                            }}
                                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0 ${item.isFeatured
                                                ? 'text-amber-400'
                                                : 'text-slate-300 dark:text-slate-600'
                                                }`}
                                        >
                                            <i className={`fa-${item.isFeatured ? 'solid' : 'regular'} fa-star`}></i>
                                        </button>
                                    )}
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
                                    <div className="text-right flex-shrink-0 whitespace-nowrap pl-2">
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
