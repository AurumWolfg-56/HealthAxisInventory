import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { auditInventoryData, InventoryAnomaly } from '../services/LocalAIService';

interface InventoryAIAuditorProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  onUpdateItem: (id: string, updates: Partial<InventoryItem>) => void;
  onEditItem: (item: InventoryItem) => void;
  t: (key: string) => string;
}

const BATCH_SIZE = 50;

const InventoryAIAuditor: React.FC<InventoryAIAuditorProps> = ({ isOpen, onClose, items, onUpdateItem, onEditItem, t }) => {
  const [isAuditing, setIsAuditing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [anomalies, setAnomalies] = useState<InventoryAnomaly[]>([]);
  const [resolvedIndices, setResolvedIndices] = useState<Set<number>>(new Set());
  
  // Inline edit state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<InventoryItem>>({});
  const [editingAnomalyIdx, setEditingAnomalyIdx] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && anomalies.length === 0 && !isAuditing) {
      runAudit();
    }
  }, [isOpen]);

  const runAudit = async () => {
    setIsAuditing(true);
    setProgress(0);
    setAnomalies([]);
    setResolvedIndices(new Set());

    let allAnomalies: InventoryAnomaly[] = [];
    const totalBatches = Math.ceil(items.length / BATCH_SIZE);

    for (let i = 0; i < totalBatches; i++) {
      const batch = items.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      const batchAnomalies = await auditInventoryData(batch);
      allAnomalies = [...allAnomalies, ...batchAnomalies];
      setProgress(Math.round(((i + 1) / totalBatches) * 100));
    }

    setAnomalies(allAnomalies);
    setIsAuditing(false);
    setProgress(100);
  };

  const handleApply = (anomaly: InventoryAnomaly, index: number) => {
    if (anomaly.type === 'DUPLICATE' && anomaly.targetItemId && anomaly.itemIds.length > 1) {
      // For duplicates, we normally want to merge. 
      // For now, we'll just update the primary one if suggestedUpdates exist,
      // But full merge logic requires deleting the others, which needs onDeleteItem.
      // We will just apply the updates to the target item.
      if (anomaly.suggestedUpdates) {
        onUpdateItem(anomaly.targetItemId, anomaly.suggestedUpdates);
      }
    } else if (anomaly.suggestedUpdates && anomaly.itemIds.length > 0) {
      // Apply updates to the first item (or all if needed, but usually it's one item per anomaly)
      anomaly.itemIds.forEach(id => {
        onUpdateItem(id, anomaly.suggestedUpdates!);
      });
    }
    setResolvedIndices(new Set(resolvedIndices).add(index));
  };

  const handleDismiss = (index: number) => {
    setResolvedIndices(new Set(resolvedIndices).add(index));
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'DUPLICATE': return 'fa-clone text-blue-500';
      case 'CATEGORY': return 'fa-tags text-purple-500';
      case 'NOMENCLATURE': return 'fa-spell-check text-indigo-500';
      case 'LOGIC': return 'fa-calculator text-amber-500';
      case 'MISSING_DATA': return 'fa-triangle-exclamation text-red-500';
      default: return 'fa-bolt text-medical-500';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'DUPLICATE': return 'Duplicate Items';
      case 'CATEGORY': return 'Miscategorized';
      case 'NOMENCLATURE': return 'Naming Standard';
      case 'LOGIC': return 'Logic Error';
      case 'MISSING_DATA': return 'Missing Data';
      default: return 'Anomaly';
    }
  };

  if (!isOpen) return null;

  const unresolvedAnomalies = anomalies.filter((_, idx) => !resolvedIndices.has(idx));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white dark:bg-[#0f172a] w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl relative flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/60 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-medical-100 dark:bg-medical-900/30 flex items-center justify-center text-medical-600 dark:text-medical-400">
              <i className="fa-solid fa-wand-magic-sparkles"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">AI Inventory Auditor</h2>
              <p className="text-xs text-slate-500 font-medium">Scanning for duplicates, miscategorizations, and logical errors</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-[#0a0f18] custom-scrollbar">
          
          {isAuditing ? (
            <div className="flex flex-col items-center justify-center h-64 text-center space-y-6">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-4 border-slate-200 dark:border-slate-700 rounded-full"></div>
                <div 
                  className="absolute inset-0 border-4 border-medical-500 rounded-full border-t-transparent animate-spin"
                ></div>
                <div className="absolute inset-0 flex items-center justify-center text-medical-600 font-bold text-xl">
                  {progress}%
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Analyzing Inventory...</h3>
                <p className="text-sm text-slate-500 mt-1">Our AI is reading {items.length} items to find anomalies.</p>
              </div>
            </div>
          ) : anomalies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center text-4xl">
                <i className="fa-solid fa-check"></i>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Inventory is Clean!</h3>
                <p className="text-sm text-slate-500 mt-1">No duplicates or logical errors were found in the database.</p>
              </div>
              <button onClick={onClose} className="mt-4 px-6 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                Close Auditor
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                  Found {unresolvedAnomalies.length} Issues to Resolve
                </h3>
                <button 
                  onClick={runAudit} 
                  className="px-4 py-2 text-sm font-bold text-medical-600 bg-medical-50 dark:bg-medical-900/20 rounded-lg hover:bg-medical-100 transition-colors"
                >
                  <i className="fa-solid fa-rotate-right mr-2"></i> Re-scan
                </button>
              </div>

              <div className="grid gap-4">
                {anomalies.map((anomaly, idx) => {
                  if (resolvedIndices.has(idx)) return null;
                  const isEditingThis = editingAnomalyIdx === idx;
                  
                  return (
                    <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-5 animate-fade-in">
                      <div className="flex-shrink-0 pt-1">
                        <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-xl">
                          <i className={`fa-solid ${getIconForType(anomaly.type)}`}></i>
                        </div>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                            {getTypeLabel(anomaly.type)}
                          </span>
                          <p className="font-bold text-slate-800 dark:text-slate-200 mt-2 text-base">
                            {anomaly.reason}
                          </p>
                        </div>
                        
                        <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl p-3 text-sm text-amber-800 dark:text-amber-400">
                          <i className="fa-solid fa-lightbulb mr-2 text-amber-500"></i>
                          {anomaly.suggestion}
                        </div>
                        
                        {/* Show affected items or Edit Form */}
                        {isEditingThis ? (
                          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-medical-200 dark:border-medical-800 space-y-3 mt-4">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-medical-600 dark:text-medical-400 mb-2">Manual Edit</h4>
                            <input
                              type="text"
                              value={editForm.name || ''}
                              onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold"
                              placeholder="Item Name"
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <input
                                type="text"
                                value={editForm.category || ''}
                                onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                                placeholder="Category"
                              />
                              <input
                                type="number"
                                value={editForm.stock || 0}
                                onChange={e => setEditForm({ ...editForm, stock: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                                placeholder="Stock"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2 pt-2">
                            {anomaly.itemIds.map(id => {
                              const item = items.find(i => i.id === id);
                              if (!item) return null;
                              return (
                                <div key={id} className="bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs flex flex-col">
                                  <span className="font-bold text-slate-700 dark:text-slate-300">{item.name}</span>
                                  <span className="text-slate-500">Stock: {item.stock} | Cat: {item.category}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-2 justify-center border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-4 md:pt-0 md:pl-5 min-w-[140px]">
                        {isEditingThis ? (
                          <>
                            <button 
                              onClick={() => {
                                if (editingItemId) onUpdateItem(editingItemId, editForm);
                                setEditingAnomalyIdx(null);
                                setEditingItemId(null);
                                handleDismiss(idx);
                              }}
                              className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                            >
                              <i className="fa-solid fa-check"></i> Save
                            </button>
                            <button 
                              onClick={() => {
                                setEditingAnomalyIdx(null);
                                setEditingItemId(null);
                              }}
                              className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold transition-all active:scale-95 text-sm"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {anomaly.suggestedUpdates && (
                              <button 
                                onClick={() => handleApply(anomaly, idx)}
                                className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                              >
                                <i className="fa-solid fa-check"></i> Apply Fix
                              </button>
                            )}
                            <button 
                              onClick={() => {
                                const itemToEditId = anomaly.targetItemId || anomaly.itemIds[0];
                                const itemToEdit = items.find(i => i.id === itemToEditId);
                                if (itemToEdit) {
                                  setEditingItemId(itemToEdit.id);
                                  setEditForm(itemToEdit);
                                  setEditingAnomalyIdx(idx);
                                }
                              }}
                              className="w-full py-2 bg-medical-50 dark:bg-medical-900/20 text-medical-600 dark:text-medical-400 hover:bg-medical-100 dark:hover:bg-medical-900/40 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                            >
                              <i className="fa-solid fa-pen-to-square"></i> Edit Manually
                            </button>
                            <button 
                              onClick={() => handleDismiss(idx)}
                              className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold transition-all active:scale-95 text-sm"
                            >
                              Ignore
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {unresolvedAnomalies.length === 0 && anomalies.length > 0 && (
                  <div className="text-center py-10">
                    <p className="text-slate-500 font-medium">All found anomalies have been resolved or dismissed!</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
};

export default InventoryAIAuditor;
