
import React, { useState, useEffect, useRef } from 'react';
import { InventoryItem, User, Permission } from '../types';
import * as XLSX from 'xlsx';

interface InventoryProps {
  items: InventoryItem[];
  user: User;
  hasPermission: (permission: Permission) => boolean;
  onAddItem: () => void;
  onEditItem: (item: InventoryItem) => void;
  onUpdateItem: (id: string, updates: Partial<InventoryItem>) => void;
  onDeleteItem: (id: string) => void;
  onAuditItem: (id: string) => void;
  onScanClick: () => void;
  onImport: (file: File) => void;
  onMergeDuplicates: () => void;
  searchOverride?: string;
  t: (key: string) => string;
}

import { CATEGORIES, LOCATIONS } from '../utils/constants';

type SortOption = 'name' | 'stockAsc' | 'stockDesc' | 'expiry';

const Inventory: React.FC<InventoryProps> = ({ items, user, hasPermission, onAddItem, onEditItem, onUpdateItem, onDeleteItem, onAuditItem, onScanClick, onImport, onMergeDuplicates, searchOverride, t }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [isAuditMode, setIsAuditMode] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<InventoryItem>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Duplicate Tracking
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  // Async Loading States
  const [loadingItemIds, setLoadingItemIds] = useState<Set<string>>(new Set());

  const handleAsyncAction = async (id: string, action: () => Promise<void>) => {
    setLoadingItemIds(prev => new Set(prev).add(id));
    const timeoutId = setTimeout(() => {
      setLoadingItemIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      // Optionally show toast here if we could import it, but cleaner to let logic handle it.
      console.error(`[Inventory] Action for ${id} timed out.`);
    }, 10000); // 10s timeout safeguard

    try {
      await action();
    } catch (e) {
      console.error(e);
    } finally {
      clearTimeout(timeoutId);
      setLoadingItemIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  useEffect(() => {
    // Simple duplicate check logic
    const groups: Record<string, number> = {};
    items.forEach(item => {
      const key = `${item.name.toLowerCase()}-${item.batchNumber}`;
      groups[key] = (groups[key] || 0) + 1;
    });
    setDuplicateCount(Object.values(groups).filter(count => count > 1).length);
  }, [items]);

  useEffect(() => {
    if (searchOverride) setSearchTerm(searchOverride);
  }, [searchOverride]);

  const categories = ['All', ...Array.from(new Set(items.map(i => i.category)))];

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.batchNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case 'name': return a.name.localeCompare(b.name);
      case 'stockAsc': return a.stock - b.stock;
      case 'stockDesc': return b.stock - a.stock;
      case 'expiry':
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      default: return 0;
    }
  });

  const getStockStatus = (item: InventoryItem) => {
    if (item.stock <= item.minStock) return 'critical';
    if (item.stock <= item.minStock * 1.5) return 'warning';
    return 'healthy';
  };

  const getStatusColor = (item: InventoryItem) => {
    const status = getStockStatus(item);
    if (status === 'critical') return 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
    if (status === 'warning') return 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800';
    return 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800';
  };

  const isCheckedToday = (lastChecked?: string) => {
    if (!lastChecked) return false;
    const today = new Date().toISOString().split('T')[0];
    return lastChecked.startsWith(today);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      e.target.value = '';
    }
  };

  const stats = {
    total: items.length,
    lowStock: items.filter(i => i.stock <= i.minStock).length,
    expiring: items.filter(i => i.expiryDate && new Date(i.expiryDate).getTime() < new Date().getTime() + (30 * 24 * 60 * 60 * 1000)).length
  };

  return (
    <div className="space-y-10 animate-fade-in-up">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx,.xls,.csv" />

      {/* Header & Stats */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-medical-500 flex items-center justify-center shadow-lg shadow-medical-500/20">
            <i className="fa-solid fa-box-open text-xl text-white"></i>
          </div>
          <div>
            <h2 className="text-display text-slate-900 dark:text-white">{t('inv_title')}</h2>
            <p className="text-caption mt-0.5">{t('inv_subtitle')}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 pt-4">
          <div className="glass-panel px-6 py-3 rounded-2xl flex items-center gap-3 border shadow-sm group hover:scale-105 transition-transform">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
              <i className="fa-solid fa-layer-group"></i>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Items</div>
              <div className="text-lg font-black text-slate-900 dark:text-white leading-none">{stats.total}</div>
            </div>
          </div>
          {stats.lowStock > 0 && (
            <div className="glass-panel px-6 py-3 rounded-2xl flex items-center gap-3 border border-amber-200/50 bg-amber-50/10 dark:border-amber-900/30 group hover:scale-105 transition-transform">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-500">Low Stock</div>
                <div className="text-lg font-black text-amber-600 dark:text-amber-400 leading-none">{stats.lowStock}</div>
              </div>
            </div>
          )}
          {stats.expiring > 0 && (
            <div className="glass-panel px-6 py-3 rounded-2xl flex items-center gap-3 border border-red-200/50 bg-red-50/10 dark:border-red-900/30 group hover:scale-105 transition-transform">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                <i className="fa-solid fa-clock-rotate-left"></i>
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-red-500">Expiring Soon</div>
                <div className="text-lg font-black text-red-600 dark:text-red-400 leading-none">{stats.expiring}</div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          {hasPermission('inventory.audit') && (
            <button
              onClick={() => setIsAuditMode(!isAuditMode)}
              className={`h-14 px-8 rounded-2xl font-bold shadow-xl flex items-center gap-4 transition-all active:scale-95 group relative overflow-hidden ${isAuditMode ? 'bg-medical-600 text-white shadow-medical-500/30' : 'glass-panel text-slate-900 dark:text-white'}`}
            >
              <i className={`fa-solid ${isAuditMode ? 'fa-check-double' : 'fa-clipboard-check'} text-xl group-hover:rotate-12 transition-transform`}></i>
              <span className="tracking-tight font-extrabold">{isAuditMode ? t('btn_exit_audit') : t('btn_audit_mode')}</span>
              {isAuditMode && <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse"></span>}
            </button>
          )}

          <div className="flex gap-2">
            {hasPermission('inventory.edit') && !isAuditMode && (
              <button onClick={() => fileInputRef.current?.click()} className="w-14 h-14 glass-panel text-slate-900 dark:text-white rounded-2xl font-bold shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95 hover:bg-slate-50 dark:hover:bg-slate-700" title={t('btn_import')}>
                <i className="fa-solid fa-file-import text-xl text-medical-600"></i>
              </button>
            )}
            {hasPermission('inventory.edit') && !isAuditMode && (
              <button
                onClick={onScanClick}
                className="h-14 px-6 glass-panel text-slate-900 dark:text-white rounded-2xl font-bold shadow-lg flex items-center gap-3 transition-all hover:scale-105 active:scale-95 group bg-gradient-to-r from-medical-50 to-teal-50 dark:from-medical-900/10 dark:to-teal-900/10 border-medical-200/40 dark:border-medical-800/40"
                title="AI Scan"
              >
                <i className="fa-solid fa-wand-magic-sparkles text-xl text-medical-600 dark:text-medical-400 group-hover:rotate-12 transition-transform"></i>
                <span className="tracking-tight font-extrabold hidden sm:inline text-medical-700 dark:text-medical-300">Scan</span>
              </button>
            )}
            {hasPermission('inventory.edit') && !isAuditMode && (
              <button
                onClick={onAddItem}
                className="h-14 px-8 bg-medical-600 text-white rounded-2xl font-bold shadow-2xl shadow-medical-500/40 flex items-center gap-3 transition-all hover:scale-105 active:scale-95 group"
              >
                <i className="fa-solid fa-plus text-xl group-hover:rotate-90 transition-transform"></i>
                <span className="tracking-tight font-extrabold">{t('btn_add')}</span>
              </button>
            )}
          </div>
        </div>
      </header >

      {/* Search & Filter - Luxury Design */}
      < div className="sticky top-4 z-40 mx-[-1rem] px-4 md:mx-0 md:px-0" >
        <div className="glass-panel p-3 rounded-[2.5rem] luxury-shadow flex flex-col md:flex-row gap-3 border-white/50 dark:border-slate-800/80">
          <div className="relative flex-1 group">
            <div className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none transition-transform group-focus-within:scale-110">
              <i className="fa-solid fa-magnifying-glass text-xl text-slate-400 group-focus-within:text-medical-500 transition-colors"></i>
            </div>
            <input
              type="text"
              placeholder={t('search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-16 pr-8 h-14 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:outline-none font-bold text-lg placeholder-slate-400 rounded-[1.5rem] border-none focus:ring-4 ring-medical-500/10 transition-all font-sans"
            />
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1 md:pb-0 px-1 custom-scrollbar">
            <div className="relative min-w-[180px]">
              <i className="fa-solid fa-filter absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full h-14 pl-12 pr-10 bg-slate-50/50 dark:bg-slate-900/50 border-none rounded-[1.5rem] text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer appearance-none ring-medical-500/10 focus:ring-4 transition-all"
              >
                <option value="All">{t('cat_all')}</option>
                {categories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <i className="fa-solid fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]"></i>
            </div>

            <div className="relative min-w-[180px]">
              <i className="fa-solid fa-sort absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full h-14 pl-12 pr-10 bg-slate-50/50 dark:bg-slate-900/50 border-none rounded-[1.5rem] text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer appearance-none ring-medical-500/10 focus:ring-4 transition-all"
              >
                <option value="name">Name (A-Z)</option>
                <option value="stockAsc">Low Stock First</option>
                <option value="stockDesc">High Stock First</option>
                <option value="expiry">Expiry Date</option>
              </select>
              <i className="fa-solid fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]"></i>
            </div>
          </div>
        </div>
      </div >

      {/* Desktop Table - Luxury Overhaul */}
      < div className="hidden md:block glass-panel rounded-[2rem] luxury-shadow overflow-hidden border-white/40 dark:border-slate-800/50" >
        <table className="w-full text-left border-separate border-spacing-0">
          <thead className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-8 py-6">{t('th_details')}</th>
              <th className="px-8 py-6">{t('th_category')}</th>
              <th className="px-8 py-6">{t('th_batch')}</th>
              <th className="px-8 py-6 text-center">{t('th_expiry')}</th>
              <th className="px-8 py-6 text-center">{t('th_stock')}</th>
              <th className="px-8 py-6 text-right">{isAuditMode ? t('th_status') : t('th_controls')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {sortedItems.map((item, idx) => (
              <tr
                key={item.id}
                className={`group hover:bg-white/70 dark:hover:bg-slate-800/40 transition-all duration-300 ${editingRowId === item.id ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <td className="px-8 py-6 cursor-pointer" onClick={() => {
                  if (editingRowId !== item.id) {
                    setEditingRowId(item.id);
                    setEditForm({ ...item });
                  }
                }}>
                  {editingRowId === item.id ? (
                    <div className="space-y-2 max-w-[200px]">
                      <input
                        type="text"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl border border-medical-200 dark:border-medical-800 bg-white dark:bg-slate-800 text-sm font-bold shadow-inner focus:ring-2 focus:ring-medical-500 transition-all"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                      <select
                        value={editForm.location || ''}
                        onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] font-extrabold focus:ring-2 focus:ring-medical-500 appearance-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-12 rounded-full ${getStockStatus(item) === 'critical' ? 'bg-red-500' : getStockStatus(item) === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'} opacity-20 group-hover:opacity-100 transition-opacity`}></div>
                      <div>
                        <div className="font-extrabold text-slate-900 dark:text-white text-lg tracking-tight group-hover:text-medical-600 transition-colors">{item.name}</div>
                        <div className="text-[10px] font-extrabold text-slate-400 mt-1 uppercase tracking-widest flex items-center gap-1.5 pt-1">
                          <i className="fa-solid fa-location-dot text-medical-500/60"></i> {item.location}
                        </div>
                      </div>
                    </div>
                  )}
                </td>
                <td className="px-8 py-6">
                  {editingRowId === item.id ? (
                    <select
                      value={editForm.category || ''}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-xs font-bold focus:ring-2 focus:ring-indigo-500 appearance-none"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  ) : (
                    <span className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                      {item.category}
                    </span>
                  )}
                </td>
                <td className="px-8 py-6">
                  {editingRowId === item.id ? (
                    <input
                      type="text"
                      value={editForm.batchNumber || ''}
                      onChange={(e) => setEditForm({ ...editForm, batchNumber: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="text-xs font-bold text-slate-400 font-mono tracking-tighter bg-slate-50 dark:bg-slate-900/50 px-3 py-1 rounded-lg border border-slate-100 dark:border-slate-800">
                      {item.batchNumber}
                    </span>
                  )}
                </td>
                <td className="px-8 py-6 text-center">
                  {editingRowId === item.id ? (
                    <input
                      type="date"
                      value={editForm.expiryDate ? new Date(editForm.expiryDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-[10px] font-bold focus:ring-2 focus:ring-indigo-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : item.expiryDate ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl tracking-tighter uppercase ${new Date(item.expiryDate) < new Date() ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                        {new Date(item.expiryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      {new Date(item.expiryDate) < new Date() && <span className="text-[8px] font-black text-red-500 uppercase tracking-widest animate-pulse">Expired</span>}
                    </div>
                  ) : <span className="text-slate-300">-</span>}
                </td>
                <td className="px-8 py-6 text-center">
                  {editingRowId === item.id ? (
                    <input
                      type="number"
                      value={editForm.stock || 0}
                      onChange={(e) => setEditForm({ ...editForm, stock: parseInt(e.target.value) || 0 })}
                      className="w-24 px-4 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-center text-lg font-black focus:ring-2 focus:ring-indigo-500 shadow-inner"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 group/stock">
                      <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-[1.5rem] border shadow-sm transition-all group-hover/stock:scale-110 ${getStatusColor(item)}`}>
                        <span className="font-black text-2xl leading-none tracking-tighter">{item.stock}</span>
                        <span className="text-[10px] uppercase font-black tracking-widest opacity-60">{t(item.unit || 'unit_each')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${getStockStatus(item) === 'critical' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)] animate-pulse' : getStockStatus(item) === 'warning' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'}`}></div>
                        <span className={`text-[10px] font-black uppercase tracking-tighter ${getStockStatus(item) === 'critical' ? 'text-red-600' : getStockStatus(item) === 'warning' ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {getStockStatus(item) === 'critical' ? 'Critical' : getStockStatus(item) === 'warning' ? 'Low' : 'Healthy'}
                        </span>
                      </div>
                    </div>
                  )}
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex flex-col items-end gap-4">
                    {editingRowId === item.id ? (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            onUpdateItem(item.id, editForm);
                            setEditingRowId(null);
                          }}
                          className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 shadow-xl shadow-emerald-500/30 transition-all hover:scale-110 active:scale-95"
                        >
                          <i className="fa-solid fa-check text-lg"></i>
                        </button>
                        <button
                          onClick={() => setEditingRowId(null)}
                          className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-all active:scale-95"
                        >
                          <i className="fa-solid fa-xmark text-lg"></i>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-3">
                        {isAuditMode && (
                          <div className="mr-4">
                            {item.lastChecked && isCheckedToday(item.lastChecked) && item.stock > item.minStock ? (
                              <div className="flex flex-col items-end gap-2 group/audit">
                                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-800 shadow-sm animate-fade-in">
                                  <i className="fa-solid fa-check-double text-emerald-500 text-xs"></i>
                                  <div className="text-right">
                                    <div className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none">Verified</div>
                                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tight mt-0.5 whitespace-nowrap">
                                      {item.lastCheckedBy} @ {new Date(item.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => onAuditItem(item.id)}
                                  className="text-[9px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest flex items-center gap-1.5 px-2 active:scale-95"
                                >
                                  <i className="fa-solid fa-rotate-right text-[8px]"></i>
                                  {t('btn_reverify')}
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleAsyncAction(item.id, async () => onAuditItem(item.id))}
                                disabled={loadingItemIds.has(item.id)}
                                className={`h-11 px-6 text-white rounded-xl text-[11px] font-black shadow-lg active:scale-95 transition-all flex items-center gap-3 relative overflow-hidden group/auditbtn ${getStockStatus(item) === 'critical' ? 'bg-red-600 hover:bg-red-700 shadow-red-500/30' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'} ${loadingItemIds.has(item.id) ? 'opacity-75 cursor-wait' : ''}`}
                              >
                                {loadingItemIds.has(item.id) ? (
                                  <i className="fa-solid fa-circle-notch fa-spin text-base"></i>
                                ) : (
                                  <>
                                    <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover/auditbtn:translate-x-[100%] transition-transform duration-1000"></div>
                                    <i className={`fa-solid ${getStockStatus(item) === 'critical' ? 'fa-triangle-exclamation animate-bounce' : 'fa-clipboard-check'} text-base`}></i>
                                  </>
                                )}
                                <span className="tracking-widest uppercase">{loadingItemIds.has(item.id) ? 'Saving...' : (getStockStatus(item) === 'critical' ? 'Verify Now' : (t('btn_verify_now') || 'Verify Now'))}</span>
                              </button>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded-[1.5rem] border border-slate-100 dark:border-slate-800">
                          <button
                            onClick={() => handleAsyncAction(item.id, async () => onUpdateItem(item.id, { stock: Math.max(0, item.stock - 1) }))}
                            disabled={loadingItemIds.has(item.id)}
                            className="w-10 h-10 rounded-xl hover:bg-red-500 hover:text-white flex items-center justify-center transition-all text-sm active:scale-90 disabled:opacity-50"
                          >
                            <i className="fa-solid fa-minus"></i>
                          </button>
                          <button
                            onClick={() => handleAsyncAction(item.id, async () => onUpdateItem(item.id, { stock: item.stock + 1 }))}
                            disabled={loadingItemIds.has(item.id)}
                            className="w-10 h-10 rounded-xl hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-all text-sm active:scale-90 disabled:opacity-50"
                          >
                            <i className="fa-solid fa-plus"></i>
                          </button>
                          {hasPermission('inventory.edit') && (
                            <button
                              onClick={() => onEditItem(item)}
                              className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-all text-sm active:scale-90 ml-1"
                            >
                              <i className="fa-solid fa-pen-to-square"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div >

      {/* Mobile Grid - Luxury Overhaul */}
      < div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-6 pb-24" >
        {
          filteredItems.map((item, idx) => (
            <div
              key={item.id}
              className="glass-panel rounded-[2.5rem] luxury-shadow overflow-hidden border-white/50 dark:border-slate-800/60 p-6 flex flex-col gap-6 animate-fade-in"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="flex justify-between items-start">
                <div className="flex gap-5">
                  <div className={`w-16 h-16 rounded-[2rem] flex flex-col items-center justify-center shrink-0 border-2 relative ${getStatusColor(item)}`}>
                    <div className={`w-3 h-3 rounded-full absolute -top-1 -right-1 border-2 border-white dark:border-slate-900 ${getStockStatus(item) === 'critical' ? 'bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]' : getStockStatus(item) === 'warning' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'}`}></div>
                    <span className="text-2xl font-black leading-none tracking-tighter">{item.stock}</span>
                    <span className="text-[9px] uppercase font-black opacity-60 mt-1 tracking-widest">{t(item.unit || 'unit_each').slice(0, 3)}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white leading-tight tracking-tight">{item.name}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-wider text-slate-500 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                        {item.category}
                      </span>
                      <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-[9px] font-black uppercase tracking-wider text-indigo-500 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                        <i className="fa-solid fa-location-dot mr-1"></i> {item.location}
                      </span>
                    </div>
                  </div>
                </div>
                {hasPermission('inventory.edit') && (
                  <button
                    onClick={() => onEditItem(item)}
                    className="w-10 h-10 glass-panel rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-500 transition-all active:scale-95"
                  >
                    <i className="fa-solid fa-ellipsis-vertical"></i>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Batch #</span>
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300 font-mono italic">
                    {item.batchNumber || 'N/A'}
                  </span>
                </div>
                <div className="bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Expiry</span>
                  <span className={`text-xs font-black ${item.expiryDate && new Date(item.expiryDate) < new Date() ? 'text-red-500 animate-pulse' : 'text-slate-700 dark:text-slate-300'}`}>
                    {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleAsyncAction(item.id, async () => onUpdateItem(item.id, { stock: Math.max(0, item.stock - 1) }))}
                  disabled={loadingItemIds.has(item.id)}
                  className="flex-1 h-14 bg-white dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-95 flex items-center justify-center border border-slate-100 dark:border-slate-700 shadow-sm disabled:opacity-50"
                >
                  <i className="fa-solid fa-minus text-lg"></i>
                </button>
                <button
                  onClick={() => handleAsyncAction(item.id, async () => onUpdateItem(item.id, { stock: item.stock + 1 }))}
                  disabled={loadingItemIds.has(item.id)}
                  className="flex-1 h-14 bg-white dark:bg-slate-800 rounded-2xl text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-all active:scale-95 flex items-center justify-center border border-slate-100 dark:border-slate-700 shadow-sm disabled:opacity-50"
                >
                  <i className="fa-solid fa-plus text-lg"></i>
                </button>
              </div>

              {isAuditMode && (
                <div className="pt-2">
                  {item.lastChecked && isCheckedToday(item.lastChecked) && item.stock > item.minStock ? (
                    <div className="space-y-3">
                      <div className="w-full py-5 flex flex-col items-center justify-center bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 rounded-3xl border border-emerald-100 dark:border-emerald-800 shadow-inner group/verified">
                        <div className="flex items-center gap-2 mb-1">
                          <i className="fa-solid fa-check-circle text-2xl animate-pulse"></i>
                          <span className="font-black text-sm uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Verified Today</span>
                        </div>
                        <span className="text-[10px] font-bold opacity-80 italic">
                          {item.lastCheckedBy} at {new Date(item.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <button
                        onClick={() => handleAsyncAction(item.id, async () => onAuditItem(item.id))}
                        disabled={loadingItemIds.has(item.id)}
                        className="w-full h-12 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-xs flex items-center justify-center gap-3 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-75 disabled:cursor-wait"
                      >
                        {loadingItemIds.has(item.id) ? (
                          <i className="fa-solid fa-circle-notch fa-spin"></i>
                        ) : (
                          <i className="fa-solid fa-rotate-right"></i>
                        )}
                        {loadingItemIds.has(item.id) ? 'Saving...' : t('btn_reverify')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAsyncAction(item.id, async () => onAuditItem(item.id))}
                      disabled={loadingItemIds.has(item.id)}
                      className={`w-full h-16 text-white rounded-3xl font-black text-base shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4 relative overflow-hidden group/mbaudit ${getStockStatus(item) === 'critical' ? 'bg-red-600 shadow-red-500/40' : 'bg-indigo-600 shadow-indigo-500/40'} ${loadingItemIds.has(item.id) ? 'opacity-75 cursor-wait' : ''}`}
                    >
                      {loadingItemIds.has(item.id) ? (
                        <i className="fa-solid fa-circle-notch fa-spin text-xl"></i>
                      ) : (
                        <>
                          <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover/mbaudit:translate-x-[100%] transition-transform duration-1000"></div>
                          <i className={`fa-solid ${getStockStatus(item) === 'critical' ? 'fa-triangle-exclamation animate-bounce text-xl' : 'fa-clipboard-check text-xl'}`}></i>
                        </>
                      )}
                      <span className="uppercase tracking-widest">{loadingItemIds.has(item.id) ? 'Saving...' : (getStockStatus(item) === 'critical' ? 'Critical: Verify Now' : (t('btn_verify_now') || 'Mark Verified'))}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        }
      </div >
    </div >
  );
};

export default Inventory;
