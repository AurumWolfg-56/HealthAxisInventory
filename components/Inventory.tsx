
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
const ITEMS_PER_PAGE = 50;

const Inventory: React.FC<InventoryProps> = ({ items, user, hasPermission, onAddItem, onEditItem, onUpdateItem, onDeleteItem, onAuditItem, onScanClick, onImport, onMergeDuplicates, searchOverride, t }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [isAuditMode, setIsAuditMode] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<InventoryItem>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  // Clear selection when exiting audit mode
  useEffect(() => {
    if (!isAuditMode) setSelectedItemIds(new Set());
  }, [isAuditMode]);

  const toggleSelection = (id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    // We use sortedItems so it respects filters
    if (selectedItemIds.size === sortedItems.length && sortedItems.length > 0) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(sortedItems.map(i => i.id)));
    }
  };

  const handleBulkVerify = async () => {
    const ids = Array.from(selectedItemIds);
    setLoadingItemIds(prev => new Set([...prev, ...ids]));
    try {
      await Promise.all(ids.map(id => onAuditItem(id)));
      setSelectedItemIds(new Set());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingItemIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }
  };

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
      console.error(`[Inventory] Action for ${id} timed out.`);
    }, 10000);

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

  // Pagination
  const totalPages = Math.ceil(sortedItems.length / ITEMS_PER_PAGE);
  const paginatedItems = sortedItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterCategory, sortBy]);

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

  const getStatusBorderColor = (item: InventoryItem) => {
    const status = getStockStatus(item);
    if (status === 'critical') return 'border-l-red-500';
    if (status === 'warning') return 'border-l-amber-500';
    return 'border-l-emerald-500';
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

  const handleExportExcel = () => {
    const data = sortedItems.map(item => ({
      Name: item.name,
      Category: item.category,
      Location: item.location,
      'Batch #': item.batchNumber || '',
      'Expiry Date': item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '',
      Stock: item.stock,
      Unit: item.unit || 'each',
      'Min Stock': item.minStock,
      'Avg Cost': item.averageCost || 0,
      'Value': ((item.stock || 0) * (item.averageCost || 0)).toFixed(2),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, `Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const stats = {
    total: items.length,
    lowStock: items.filter(i => i.stock <= i.minStock).length,
    expiring: items.filter(i => i.expiryDate && new Date(i.expiryDate).getTime() < new Date().getTime() + (30 * 24 * 60 * 60 * 1000)).length,
    totalValue: items.reduce((sum, i) => sum + (i.stock || 0) * (i.averageCost || 0), 0)
  };

  return (
    <div className="space-y-6 sm:space-y-10 animate-fade-in-up">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx,.xls,.csv" />

      {/* Header & Stats */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-medical-500 flex items-center justify-center shadow-lg shadow-medical-500/20">
            <i className="fa-solid fa-box-open text-lg text-white"></i>
          </div>
          <div>
            <h2 className="text-display text-slate-900 dark:text-white">{t('inv_title')}</h2>
            <p className="text-caption mt-0.5">{t('inv_subtitle')}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 sm:gap-4 pt-4">
          <div className="glass-panel px-4 sm:px-6 py-3 rounded-2xl flex items-center gap-3 border shadow-sm group hover:scale-105 transition-transform flex-1 sm:flex-none min-w-[140px]">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
              <i className="fa-solid fa-layer-group"></i>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Items</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white leading-none">{stats.total}</div>
            </div>
          </div>
          {stats.lowStock > 0 && (
            <div className="glass-panel px-4 sm:px-6 py-3 rounded-2xl flex items-center gap-3 border border-amber-200/50 bg-amber-50/10 dark:border-amber-900/30 group hover:scale-105 transition-transform flex-1 sm:flex-none min-w-[140px]">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Low Stock</div>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400 leading-none">{stats.lowStock}</div>
              </div>
            </div>
          )}
          {stats.expiring > 0 && (
            <div className="glass-panel px-4 sm:px-6 py-3 rounded-2xl flex items-center gap-3 border border-red-200/50 bg-red-50/10 dark:border-red-900/30 group hover:scale-105 transition-transform flex-1 sm:flex-none min-w-[140px]">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                <i className="fa-solid fa-clock-rotate-left"></i>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-red-500">Expiring Soon</div>
                <div className="text-lg font-bold text-red-600 dark:text-red-400 leading-none">{stats.expiring}</div>
              </div>
            </div>
          )}
          <div className="glass-panel px-4 sm:px-6 py-3 rounded-2xl flex items-center gap-3 border shadow-sm group hover:scale-105 transition-transform flex-1 sm:flex-none min-w-[140px]">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <i className="fa-solid fa-sack-dollar"></i>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Value</div>
              <div className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400 leading-none">${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          {hasPermission('inventory.audit') && (
            <button
              onClick={() => setIsAuditMode(!isAuditMode)}
              className={`h-11 px-6 rounded-xl font-semibold shadow-lg flex items-center gap-3 transition-all active:scale-95 group relative overflow-hidden ${isAuditMode ? 'bg-medical-600 text-white shadow-medical-500/30' : 'glass-panel text-slate-900 dark:text-white hover:shadow-xl'}`}
            >
              <i className={`fa-solid ${isAuditMode ? 'fa-check-double' : 'fa-clipboard-check'} text-base group-hover:rotate-12 transition-transform`}></i>
              <span className="tracking-tight font-bold text-sm">{isAuditMode ? t('btn_exit_audit') : t('btn_audit_mode')}</span>
              {isAuditMode && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse"></span>}
            </button>
          )}

          <div className="flex gap-2">
            {hasPermission('inventory.edit') && !isAuditMode && (
              <button onClick={() => fileInputRef.current?.click()} className="w-11 h-11 glass-panel text-slate-900 dark:text-white rounded-xl shadow-md flex items-center justify-center transition-all hover:scale-105 active:scale-95 hover:shadow-lg" title={t('btn_import')}>
                <i className="fa-solid fa-file-import text-base text-medical-600"></i>
              </button>
            )}
            {hasPermission('inventory.edit') && !isAuditMode && (
              <button
                onClick={onScanClick}
                className="h-11 px-5 glass-panel text-slate-900 dark:text-white rounded-xl font-semibold shadow-md flex items-center gap-2.5 transition-all hover:scale-105 hover:shadow-lg active:scale-95 group bg-gradient-to-r from-medical-50 to-emerald-50 dark:from-medical-900/10 dark:to-emerald-900/10 border-medical-200/40 dark:border-medical-800/40"
                title="AI Scan"
              >
                <i className="fa-solid fa-wand-magic-sparkles text-base text-medical-600 dark:text-medical-400 group-hover:rotate-12 transition-transform"></i>
                <span className="tracking-tight font-bold text-sm hidden sm:inline text-medical-700 dark:text-medical-300">Scan</span>
              </button>
            )}
            {hasPermission('inventory.edit') && !isAuditMode && (
              <button
                onClick={onAddItem}
                className="h-11 px-6 bg-medical-600 text-white rounded-xl font-semibold shadow-xl shadow-medical-500/30 flex items-center gap-2.5 transition-all hover:scale-105 hover:shadow-2xl active:scale-95 group"
              >
                <i className="fa-solid fa-plus text-base group-hover:rotate-90 transition-transform"></i>
                <span className="tracking-tight font-bold text-sm">{t('btn_add')}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Audit Mode Banner */}
      {isAuditMode && (
        <div className="bg-medical-600/10 border border-medical-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 mt-[-1rem] mb-6 animate-fade-in shadow-inner">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-medical-500 text-white flex items-center justify-center animate-pulse shadow-lg shadow-medical-500/30">
              <i className="fa-solid fa-clipboard-check text-xl"></i>
            </div>
            <div>
              <h3 className="font-bold text-medical-800 dark:text-medical-200 text-lg leading-tight uppercase tracking-widest">Audit Mode Active</h3>
              <p className="text-xs font-bold text-medical-600/70 dark:text-medical-400/70 tracking-tight">Select multiple items to verify them at once.</p>
            </div>
          </div>
          {selectedItemIds.size > 0 && (
            <button
              onClick={handleBulkVerify}
              disabled={loadingItemIds.size > 0}
              className="px-6 py-3 bg-medical-600 hover:bg-medical-700 text-white rounded-xl font-bold shadow-lg shadow-medical-500/30 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <i className="fa-solid fa-check-double"></i> Verify {selectedItemIds.size} Items
            </button>
          )}
        </div>
      )}

      {/* Search & Filter */}
      <div className="sticky top-4 z-40 mx-[-1rem] px-4 md:mx-0 md:px-0">
        <div className="glass-panel p-2.5 rounded-2xl flex flex-col md:flex-row gap-2.5 border-white/50 dark:border-slate-800/80">
          <div className="relative flex-1 group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-transform group-focus-within:scale-110">
              <i className="fa-solid fa-magnifying-glass text-sm text-slate-400 group-focus-within:text-medical-500 transition-colors"></i>
            </div>
            <input
              type="text"
              placeholder={t('search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 h-11 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:outline-none font-medium text-sm placeholder-slate-400 rounded-xl border-none focus:ring-4 ring-medical-500/10 transition-all"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 px-1 custom-scrollbar">
            <div className="relative min-w-[160px]">
              <i className="fa-solid fa-filter absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full h-11 pl-10 pr-8 bg-slate-50/50 dark:bg-slate-900/50 border-none rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer appearance-none ring-medical-500/10 focus:ring-4 transition-all"
              >
                <option value="All">{t('cat_all')}</option>
                {categories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <i className="fa-solid fa-chevron-down absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]"></i>
            </div>

            <div className="relative min-w-[160px]">
              <i className="fa-solid fa-sort absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full h-11 pl-10 pr-8 bg-slate-50/50 dark:bg-slate-900/50 border-none rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer appearance-none ring-medical-500/10 focus:ring-4 transition-all"
              >
                <option value="name">Name (A-Z)</option>
                <option value="stockAsc">Low Stock First</option>
                <option value="stockDesc">High Stock First</option>
                <option value="expiry">Expiry Date</option>
              </select>
              <i className="fa-solid fa-chevron-down absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]"></i>
            </div>

            <button
              onClick={handleExportExcel}
              className="h-11 px-4 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all whitespace-nowrap"
              title="Export to Excel"
            >
              <i className="fa-solid fa-file-excel"></i>
              <span className="hidden lg:inline">Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block glass-panel rounded-2xl luxury-shadow overflow-hidden border-white/40 dark:border-slate-800/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0 min-w-[800px]">
            <thead className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-10">
              <tr className="border-b border-slate-200 dark:border-slate-800">
                {isAuditMode && (
                  <th className="px-4 py-4 w-12 text-center" title="Select All">
                    <input
                      type="checkbox"
                      checked={selectedItemIds.size > 0 && selectedItemIds.size === sortedItems.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-medical-600 focus:ring-medical-500 cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-5 py-4">{t('th_details')}</th>
                <th className="px-5 py-4">{t('th_category')}</th>
                <th className="px-5 py-4">Lot / Expiry</th>
                <th className="px-5 py-4 text-center">{t('th_stock')}</th>
                <th className="px-5 py-4 text-right">Value</th>
                <th className="px-5 py-4 text-right">{isAuditMode ? t('th_status') : t('th_controls')}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item, idx) => (
                <tr
                  key={item.id}
                  className={`group border-l-[3px] transition-all duration-200 ${getStatusBorderColor(item)} ${idx % 2 === 1 ? 'bg-slate-50/30 dark:bg-slate-800/20' : ''} hover:bg-medical-50/30 dark:hover:bg-medical-900/10 ${editingRowId === item.id ? 'bg-medical-50/50 dark:bg-medical-900/20 !border-l-medical-500' : ''} ${selectedItemIds.has(item.id) ? 'bg-medical-50/30 dark:bg-medical-900/10' : ''}`}
                  style={{ animationDelay: `${idx * 20}ms` }}
                >
                  {isAuditMode && (
                    <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedItemIds.has(item.id)}
                        onChange={() => toggleSelection(item.id)}
                        className="w-4 h-4 rounded border-slate-300 text-medical-600 focus:ring-medical-500 cursor-pointer"
                      />
                    </td>
                  )}
                  {/* Item Details */}
                  <td className="px-5 py-4 cursor-pointer max-w-[280px]" onClick={() => {
                    if (editingRowId !== item.id) {
                      setEditingRowId(item.id);
                      setEditForm({ ...item });
                    }
                  }}>
                    {editingRowId === item.id ? (
                      <div className="space-y-2 max-w-[240px]">
                        <input
                          type="text"
                          value={editForm.name || ''}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-medical-200 dark:border-medical-800 bg-white dark:bg-slate-800 text-sm font-bold shadow-inner focus:ring-2 focus:ring-medical-500 transition-all"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <select
                          value={editForm.location || ''}
                          onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] font-bold focus:ring-2 focus:ring-medical-500 appearance-none"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm leading-snug line-clamp-2 group-hover:text-medical-600 transition-colors" title={item.name}>{item.name}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest flex items-center gap-1.5">
                          <i className="fa-solid fa-location-dot text-medical-500/60"></i> {item.location}
                        </div>
                      </div>
                    )}
                  </td>
                  {/* Category */}
                  <td className="px-5 py-4">
                    {editingRowId === item.id ? (
                      <select
                        value={editForm.category || ''}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-medical-200 dark:border-medical-800 bg-white dark:bg-slate-800 text-xs font-bold focus:ring-2 focus:ring-medical-500 appearance-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    ) : (
                      <span className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                        {item.category}
                      </span>
                    )}
                  </td>
                  {/* Lot / Expiry (merged) */}
                  <td className="px-5 py-4">
                    {editingRowId === item.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editForm.batchNumber || ''}
                          onChange={(e) => setEditForm({ ...editForm, batchNumber: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-lg border border-medical-200 dark:border-medical-800 bg-white dark:bg-slate-800 text-xs font-mono font-bold focus:ring-2 focus:ring-medical-500"
                          placeholder="Batch #"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <input
                          type="date"
                          value={editForm.expiryDate ? new Date(editForm.expiryDate).toISOString().split('T')[0] : ''}
                          onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-lg border border-medical-200 dark:border-medical-800 bg-white dark:bg-slate-800 text-[10px] font-bold focus:ring-2 focus:ring-medical-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {item.batchNumber ? (
                          <span className="text-xs font-bold text-slate-500 font-mono tracking-tighter">{item.batchNumber}</span>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                        )}
                        {item.expiryDate ? (
                          <span className={`text-[10px] font-bold ${new Date(item.expiryDate) < new Date() ? 'text-red-500' : 'text-slate-400'}`}>
                            {new Date(item.expiryDate) < new Date() && <i className="fa-solid fa-circle-exclamation mr-1"></i>}
                            {new Date(item.expiryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300 dark:text-slate-600">No expiry</span>
                        )}
                      </div>
                    )}
                  </td>
                  {/* Stock */}
                  <td className="px-5 py-4 text-center">
                    {editingRowId === item.id ? (
                      <input
                        type="number"
                        value={editForm.stock || 0}
                        onChange={(e) => setEditForm({ ...editForm, stock: parseInt(e.target.value) || 0 })}
                        className="w-20 px-3 py-1.5 rounded-lg border border-medical-200 dark:border-medical-800 bg-white dark:bg-slate-800 text-center text-base font-bold focus:ring-2 focus:ring-medical-500 shadow-inner"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all ${getStatusColor(item)}`}>
                        <span className="font-bold tabular-nums">{item.stock}</span>
                        <span className="text-[9px] uppercase font-semibold tracking-wider opacity-70">{t(item.unit || 'unit_each')}</span>
                      </div>
                    )}
                  </td>
                  {/* Value */}
                  <td className="px-5 py-4 text-right">
                    <span className="font-mono font-bold tabular-nums text-sm text-emerald-600 dark:text-emerald-400">
                      ${((item.stock || 0) * (item.averageCost || 0)).toFixed(2)}
                    </span>
                  </td>
                  {/* Controls / Audit */}
                  <td className="px-5 py-4 text-right">
                    <div className="flex flex-col items-end gap-3">
                      {editingRowId === item.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              onUpdateItem(item.id, editForm);
                              if (isAuditMode) { await onAuditItem(item.id); }
                              setEditingRowId(null);
                            }}
                            className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 shadow-lg shadow-emerald-500/30 transition-all hover:scale-110 active:scale-95"
                            title={isAuditMode ? 'Save & Verify' : 'Save'}
                          >
                            <i className="fa-solid fa-check"></i>
                          </button>
                          <button
                            onClick={() => setEditingRowId(null)}
                            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-all active:scale-95"
                          >
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                          {isAuditMode && <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest whitespace-nowrap">Save & Verify</span>}
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {isAuditMode && (
                            <div className="flex items-center gap-2">
                              {hasPermission('inventory.edit') && (
                                <button
                                  onClick={() => onEditItem(item)}
                                  className="w-8 h-8 rounded-lg bg-medical-50 dark:bg-medical-900/30 text-medical-600 dark:text-medical-400 hover:bg-medical-600 hover:text-white flex items-center justify-center transition-all text-xs active:scale-90"
                                  title="Edit Item"
                                >
                                  <i className="fa-solid fa-pen-to-square"></i>
                                </button>
                              )}
                              {item.lastChecked && isCheckedToday(item.lastChecked) && item.stock > item.minStock ? (
                                <div className="flex flex-col items-end gap-1.5">
                                  <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800 shadow-sm">
                                    <i className="fa-solid fa-check-double text-emerald-500 text-[10px]"></i>
                                    <div className="text-right">
                                      <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none">Verified</div>
                                      <div className="text-[8px] font-bold text-slate-400 tracking-tight mt-0.5 whitespace-nowrap">
                                        {item.lastCheckedBy} @ {new Date(item.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => onAuditItem(item.id)}
                                    className="text-[9px] font-bold text-slate-400 hover:text-medical-600 transition-colors uppercase tracking-widest flex items-center gap-1 px-1 active:scale-95"
                                  >
                                    <i className="fa-solid fa-rotate-right text-[8px]"></i>
                                    {t('btn_reverify')}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleAsyncAction(item.id, async () => onAuditItem(item.id))}
                                  disabled={loadingItemIds.has(item.id)}
                                  className={`h-8 px-3 text-white rounded-lg text-[10px] font-bold shadow-md active:scale-95 transition-all flex items-center gap-1.5 ${getStockStatus(item) === 'critical' ? 'bg-red-600 hover:bg-red-700 shadow-red-500/30' : 'bg-medical-600 hover:bg-medical-700 shadow-medical-500/20'} ${loadingItemIds.has(item.id) ? 'opacity-75 cursor-wait' : ''}`}
                                >
                                  {loadingItemIds.has(item.id) ? (
                                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                                  ) : (
                                    <i className={`fa-solid ${getStockStatus(item) === 'critical' ? 'fa-triangle-exclamation' : 'fa-clipboard-check'}`}></i>
                                  )}
                                  <span className="tracking-widest uppercase">{loadingItemIds.has(item.id) ? '...' : 'Verify'}</span>
                                </button>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-0.5 bg-slate-50 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-100 dark:border-slate-800">
                            <button
                              onClick={() => handleAsyncAction(item.id, async () => onUpdateItem(item.id, { stock: Math.max(0, item.stock - 1) }))}
                              disabled={loadingItemIds.has(item.id)}
                              className="w-8 h-8 rounded-lg hover:bg-red-500 hover:text-white flex items-center justify-center transition-all text-xs active:scale-90 disabled:opacity-50"
                            >
                              <i className="fa-solid fa-minus"></i>
                            </button>
                            <button
                              onClick={() => handleAsyncAction(item.id, async () => onUpdateItem(item.id, { stock: item.stock + 1 }))}
                              disabled={loadingItemIds.has(item.id)}
                              className="w-8 h-8 rounded-lg hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-all text-xs active:scale-90 disabled:opacity-50"
                            >
                              <i className="fa-solid fa-plus"></i>
                            </button>
                            {hasPermission('inventory.edit') && (
                              <button
                                onClick={() => onEditItem(item)}
                                className="w-8 h-8 rounded-lg bg-medical-50 dark:bg-medical-900/30 text-medical-600 dark:text-medical-400 hover:bg-medical-600 hover:text-white flex items-center justify-center transition-all text-xs active:scale-90 ml-0.5"
                                title="Edit Item"
                              >
                                <i className="fa-solid fa-pen-to-square"></i>
                              </button>
                            )}
                            {(user?.role === 'MANAGER' || user?.role === 'OWNER') && (
                              <button
                                onClick={() => onDeleteItem(item.id)}
                                className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all text-xs active:scale-90 ml-0.5"
                                title="Delete Item"
                              >
                                <i className="fa-solid fa-trash-can"></i>
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
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, sortedItems.length)} of {sortedItems.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-xs"
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${page === currentPage ? 'bg-medical-600 text-white shadow-md shadow-medical-500/30' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-xs"
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Grid */}
      <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4 pb-32 sm:pb-24">
        {
          paginatedItems.map((item, idx) => (
            <div
              key={item.id}
              className={`glass-panel rounded-2xl luxury-shadow overflow-hidden border-white/50 dark:border-slate-800/60 p-4 sm:p-5 flex flex-col gap-3 sm:gap-4 animate-fade-in border-l-[3px] ${getStatusBorderColor(item)}`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="flex justify-between items-start">
                <div className="flex gap-4">
                  {isAuditMode && (
                    <div className="pt-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedItemIds.has(item.id)}
                        onChange={() => toggleSelection(item.id)}
                        className="w-5 h-5 rounded border-slate-300 text-medical-600 focus:ring-medical-500 cursor-pointer"
                      />
                    </div>
                  )}
                  <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 border-2 relative ${getStatusColor(item)}`}>
                    <div className={`w-3 h-3 rounded-full absolute -top-1 -right-1 border-2 border-white dark:border-slate-900 ${getStockStatus(item) === 'critical' ? 'bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]' : getStockStatus(item) === 'warning' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'}`}></div>
                    <span className="text-xl font-bold leading-none tracking-tighter">{item.stock}</span>
                    <span className="text-[8px] uppercase font-bold opacity-60 mt-0.5 tracking-widest">{t(item.unit || 'unit_each').slice(0, 3)}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-800 dark:text-white leading-tight tracking-tight line-clamp-2" title={item.name}>{item.name}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[9px] font-bold uppercase tracking-wider text-slate-500 rounded-md border border-slate-200/50 dark:border-slate-700/50">
                        {item.category}
                      </span>
                      <span className="px-2 py-0.5 bg-medical-50 dark:bg-medical-900/20 text-[9px] font-bold uppercase tracking-wider text-medical-500 rounded-md border border-medical-100 dark:border-medical-900/50">
                        <i className="fa-solid fa-location-dot mr-1"></i> {item.location}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5 h-max">
                  {hasPermission('inventory.edit') && (
                    <button
                      onClick={() => onEditItem(item)}
                      className="w-9 h-9 glass-panel rounded-lg flex items-center justify-center text-slate-400 hover:text-medical-500 transition-all active:scale-95 shadow-sm hover:shadow"
                    >
                      <i className={`fa-solid ${isAuditMode ? 'fa-pen-to-square' : 'fa-ellipsis-vertical'} text-sm`}></i>
                    </button>
                  )}
                  {(user?.role === 'MANAGER' || user?.role === 'OWNER') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }}
                      className="w-9 h-9 glass-panel rounded-lg flex items-center justify-center text-red-500 hover:text-white hover:bg-red-600 transition-all active:scale-95 shadow-sm hover:shadow"
                      title="Delete Item"
                    >
                      <i className="fa-solid fa-trash-can text-sm"></i>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="bg-slate-50/50 dark:bg-slate-900/50 p-2.5 sm:p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Batch</span>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 font-mono">
                    {item.batchNumber || '—'}
                  </span>
                </div>
                <div className="bg-slate-50/50 dark:bg-slate-900/50 p-2.5 sm:p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Expiry</span>
                  <span className={`text-[11px] font-bold ${item.expiryDate && new Date(item.expiryDate) < new Date() ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                    {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) : '—'}
                  </span>
                </div>
                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-2.5 sm:p-3 rounded-xl border border-emerald-100 dark:border-emerald-800/50 flex flex-col">
                  <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mb-0.5">Value</span>
                  <span className="text-[11px] font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    ${((item.stock || 0) * (item.averageCost || 0)).toFixed(0)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => handleAsyncAction(item.id, async () => onUpdateItem(item.id, { stock: Math.max(0, item.stock - 1) }))}
                  disabled={loadingItemIds.has(item.id)}
                  className="flex-1 h-12 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-95 flex items-center justify-center border border-slate-100 dark:border-slate-700 shadow-sm disabled:opacity-50"
                >
                  <i className="fa-solid fa-minus text-base"></i>
                </button>
                <button
                  onClick={() => handleAsyncAction(item.id, async () => onUpdateItem(item.id, { stock: item.stock + 1 }))}
                  disabled={loadingItemIds.has(item.id)}
                  className="flex-1 h-12 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-all active:scale-95 flex items-center justify-center border border-slate-100 dark:border-slate-700 shadow-sm disabled:opacity-50"
                >
                  <i className="fa-solid fa-plus text-base"></i>
                </button>
              </div>

              {isAuditMode && (
                <div className="pt-1">
                  {item.lastChecked && isCheckedToday(item.lastChecked) && item.stock > item.minStock ? (
                    <div className="space-y-2">
                      <div className="w-full py-4 flex flex-col items-center justify-center bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-800 shadow-inner">
                        <div className="flex items-center gap-2 mb-1">
                          <i className="fa-solid fa-check-circle text-xl animate-pulse"></i>
                          <span className="font-bold text-sm uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Verified Today</span>
                        </div>
                        <span className="text-[10px] font-bold opacity-80 italic">
                          {item.lastCheckedBy} at {new Date(item.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <button
                        onClick={() => handleAsyncAction(item.id, async () => onAuditItem(item.id))}
                        disabled={loadingItemIds.has(item.id)}
                        className="w-full h-10 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-75 disabled:cursor-wait"
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
                      className={`w-full h-12 text-white rounded-xl font-bold text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 relative overflow-hidden group/mbaudit ${getStockStatus(item) === 'critical' ? 'bg-red-600 shadow-red-500/40' : 'bg-medical-600 shadow-medical-500/40'} ${loadingItemIds.has(item.id) ? 'opacity-75 cursor-wait' : ''}`}
                    >
                      {loadingItemIds.has(item.id) ? (
                        <i className="fa-solid fa-circle-notch fa-spin text-xl"></i>
                      ) : (
                        <>
                          <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover/mbaudit:translate-x-[100%] transition-transform duration-1000"></div>
                          <i className={`fa-solid ${getStockStatus(item) === 'critical' ? 'fa-triangle-exclamation animate-bounce text-lg' : 'fa-clipboard-check text-lg'}`}></i>
                        </>
                      )}
                      <span className="uppercase tracking-widest">{loadingItemIds.has(item.id) ? 'Saving...' : (getStockStatus(item) === 'critical' ? 'Critical: Verify' : (t('btn_verify_now') || 'Verify'))}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        }
      </div>

      {/* Mobile Pagination */}
      {totalPages > 1 && (
        <div className="md:hidden flex items-center justify-between px-2 pb-20">
          <span className="text-xs font-bold text-slate-400">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 transition-all disabled:opacity-30 text-sm"
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-slate-500 transition-all disabled:opacity-30 text-sm"
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
