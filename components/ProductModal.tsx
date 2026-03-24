import React, { useState, useEffect } from 'react';
import { scanItemLabel } from '../services/geminiService';
import { InventoryItem } from '../types';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Partial<InventoryItem>) => void;
  initialData?: Partial<InventoryItem>;
  t: (key: string) => string;
}

import { CATEGORIES, UNITS, LOCATIONS } from '../utils/constants';

const InputGroup = ({ label, children }: { label: string; children?: React.ReactNode }) => (
  <div className="relative group">
    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ml-1">{label}</label>
    {children}
  </div>
);

const ProductModal: React.FC<ProductModalProps> = ({ isOpen, onClose, onSave, initialData, t }) => {
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    name: '',
    category: CATEGORIES[0],
    stock: 0,
    unit: 'unit_each',
    averageCost: 0,
    minStock: 10,
    maxStock: 100,
    batchNumber: '',
    expiryDate: '',
    location: ''
  });

  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({ ...formData, ...initialData });
    } else if (isOpen) {
      setFormData({
        name: '',
        category: CATEGORIES[0],
        stock: 0,
        unit: 'unit_each',
        averageCost: 0,
        minStock: 10,
        maxStock: 100,
        batchNumber: '',
        expiryDate: '',
        location: ''
      });
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleChange = (field: keyof InventoryItem, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Glass Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative bg-white dark:bg-[#0c1511] w-full max-w-lg h-[100dvh] md:h-auto md:max-h-[90vh] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up border border-slate-100 dark:border-slate-800">
        <div className="shrink-0 p-4 md:p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30 z-10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm ${initialData?.id ? 'bg-medical-100 text-medical-600 dark:bg-medical-900/20' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20'} `}>
              <i className={`fa-solid ${initialData?.id ? 'fa-pen' : 'fa-plus'} `}></i>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {initialData?.id ? t('modal_edit_title') : t('modal_add_title')}
            </h3>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-red-500 transition-all">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 custom-scrollbar">

            <InputGroup label={t('lbl_name')}>
              <input
                required
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none font-semibold text-sm"
                placeholder={t('ph_name')}
              />
            </InputGroup>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputGroup label={t('lbl_cat')}>
                <div className="relative">
                  <select
                    value={formData.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                    className="w-full h-12 px-4 appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none cursor-pointer font-semibold text-sm"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-4 top-4 text-slate-400 pointer-events-none text-xs"></i>
                </div>
              </InputGroup>

              <InputGroup label={t('lbl_loc')}>
                <div className="relative">
                  <select
                    value={formData.location}
                    onChange={(e) => handleChange('location', e.target.value)}
                    className="w-full h-12 px-4 appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none cursor-pointer font-semibold text-sm"
                  >
                    <option value="">Select Location...</option>
                    {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-4 top-4 text-slate-400 pointer-events-none text-xs"></i>
                </div>
              </InputGroup>
            </div>

            {/* STOCK CONTROLS */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup label={t('lbl_current_stock')}>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock || ''}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleChange('stock', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                    className="w-full h-12 pl-4 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none font-mono font-semibold text-base"
                  />
                </InputGroup>

                <InputGroup label={t('lbl_unit')}>
                  <div className="relative">
                    <select
                      value={formData.unit}
                      onChange={(e) => handleChange('unit', e.target.value)}
                      className="w-full h-12 px-4 appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none cursor-pointer font-semibold text-sm"
                    >
                      {UNITS.map(u => <option key={u} value={u}>{t(u)}</option>)}
                    </select>
                    <i className="fa-solid fa-chevron-down absolute right-4 top-4 text-slate-400 pointer-events-none text-xs"></i>
                  </div>
                </InputGroup>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup label="Unit Cost ($)">
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-slate-400 font-semibold">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.averageCost || ''}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleChange('averageCost', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                      className="w-full h-12 pl-8 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none font-mono font-semibold"
                      placeholder="0.00"
                    />
                  </div>
                </InputGroup>

                {/* Visual spacer or calc */}
                <div className="flex items-center justify-end px-2">
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-semibold text-slate-400">Total Value</p>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                      ${((formData.stock || 0) * (formData.averageCost || 0)).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5 border-t border-slate-200 dark:border-slate-700">
                <InputGroup label={t('lbl_min_alert')}>
                  <input
                    type="number"
                    min="0"
                    value={formData.minStock || ''}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleChange('minStock', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none font-mono font-semibold"
                  />
                </InputGroup>

                <InputGroup label={t('lbl_max_limit')}>
                  <input
                    type="number"
                    min="0"
                    value={formData.maxStock || ''}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleChange('maxStock', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none font-mono font-semibold"
                  />
                </InputGroup>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputGroup label={t('lbl_batch_num')}>
                <input
                  type="text"
                  value={formData.batchNumber}
                  onChange={(e) => handleChange('batchNumber', e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none font-mono font-semibold"
                  placeholder={t('ph_batch')}
                />
              </InputGroup>

              <InputGroup label={t('lbl_expiry')}>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => handleChange('expiryDate', e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none font-semibold"
                />
              </InputGroup>
            </div>
          </div>

          <div className="shrink-0 p-4 md:p-5 bg-slate-50/90 dark:bg-slate-800/90 backdrop-blur-md border-t border-slate-100 dark:border-slate-700 flex flex-col md:flex-row gap-3 mt-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              {t('btn_cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 h-12 bg-gradient-to-r from-medical-600 to-medical-500 hover:from-medical-700 hover:to-medical-600 text-white rounded-xl font-semibold shadow-xl shadow-medical-500/30 transition-all transform hover:scale-[1.02]"
            >
              {initialData?.id ? t('btn_save_update') : t('btn_save_add')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default ProductModal;
