
import React, { useState, useEffect } from 'react';
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
    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 ml-1">{label}</label>
    {children}
  </div>
);

const ProductModal: React.FC<ProductModalProps> = ({ isOpen, onClose, onSave, initialData, t }) => {
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    name: '',
    category: 'General',
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
        category: 'General',
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
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-md transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up border border-gray-100 dark:border-gray-800">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${initialData?.id ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20'}`}>
              <i className={`fa-solid ${initialData?.id ? 'fa-pen' : 'fa-plus'}`}></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {initialData?.id ? t('modal_edit_title') : t('modal_add_title')}
            </h3>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-red-500 transition-all">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto space-y-6 custom-scrollbar">

          <InputGroup label={t('lbl_name')}>
            <input
              required
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full h-14 px-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none font-bold"
              placeholder={t('ph_name')}
            />
          </InputGroup>

          <div className="grid grid-cols-2 gap-6">
            <InputGroup label={t('lbl_cat')}>
              <div className="relative">
                <select
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="w-full h-14 px-5 appearance-none rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none cursor-pointer font-bold text-sm"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down absolute right-5 top-5 text-gray-400 pointer-events-none text-xs"></i>
              </div>
            </InputGroup>

            <InputGroup label={t('lbl_loc')}>
              <div className="relative">
                <select
                  value={formData.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  className="w-full h-14 px-5 appearance-none rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none cursor-pointer font-bold text-sm"
                >
                  <option value="">Select Location...</option>
                  {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down absolute right-5 top-5 text-gray-400 pointer-events-none text-xs"></i>
              </div>
            </InputGroup>
          </div>

          {/* STOCK CONTROLS */}
          <div className="bg-gray-50 dark:bg-gray-800/40 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <InputGroup label={t('lbl_current_stock')}>
                <input
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => handleChange('stock', parseInt(e.target.value) || 0)}
                  className="w-full h-14 pl-5 pr-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none font-mono font-bold text-lg"
                />
              </InputGroup>

              <InputGroup label={t('lbl_unit')}>
                <div className="relative">
                  <select
                    value={formData.unit}
                    onChange={(e) => handleChange('unit', e.target.value)}
                    className="w-full h-14 px-5 appearance-none rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none cursor-pointer font-bold text-sm"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{t(u)}</option>)}
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-5 top-5 text-gray-400 pointer-events-none text-xs"></i>
                </div>
              </InputGroup>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <InputGroup label="Unit Cost ($)">
                <div className="relative">
                  <span className="absolute left-4 top-4 text-gray-400 font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.averageCost}
                    onChange={(e) => handleChange('averageCost', parseFloat(e.target.value) || 0)}
                    className="w-full h-12 pl-8 pr-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none font-mono font-bold"
                    placeholder="0.00"
                  />
                </div>
              </InputGroup>

              {/* Visual spacer or calc */}
              <div className="flex items-center justify-end px-2">
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-gray-400">Total Value</p>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    ${((formData.stock || 0) * (formData.averageCost || 0)).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-2 border-t border-gray-200 dark:border-gray-700">
              <InputGroup label={t('lbl_min_alert')}>
                <input
                  type="number"
                  min="0"
                  value={formData.minStock}
                  onChange={(e) => handleChange('minStock', parseInt(e.target.value) || 0)}
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none font-mono font-bold"
                />
              </InputGroup>

              <InputGroup label={t('lbl_max_limit')}>
                <input
                  type="number"
                  min="0"
                  value={formData.maxStock}
                  onChange={(e) => handleChange('maxStock', parseInt(e.target.value) || 0)}
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-mono font-bold"
                />
              </InputGroup>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <InputGroup label={t('lbl_batch_num')}>
              <input
                type="text"
                value={formData.batchNumber}
                onChange={(e) => handleChange('batchNumber', e.target.value)}
                className="w-full h-14 px-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none font-mono font-bold"
                placeholder={t('ph_batch')}
              />
            </InputGroup>

            <InputGroup label={t('lbl_expiry')}>
              <input
                type="date"
                value={formData.expiryDate}
                onChange={(e) => handleChange('expiryDate', e.target.value)}
                className="w-full h-14 px-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none font-bold"
              />
            </InputGroup>
          </div>

          <div className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-14 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              {t('btn_cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 h-14 bg-gradient-to-r from-medical-600 to-medical-500 hover:from-medical-700 hover:to-medical-600 text-white rounded-2xl font-bold shadow-xl shadow-medical-500/30 transition-all transform hover:scale-[1.02]"
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
