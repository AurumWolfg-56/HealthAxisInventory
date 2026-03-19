import React, { useState, useMemo } from 'react';
import { useAppData } from '../contexts/AppDataContext';
import { useInventory } from '../contexts/InventoryContext';
import { Budget, Order, User } from '../types';
import { BudgetService } from '../services/BudgetService';
import { CATEGORIES } from '../utils/constants';

interface BudgetsProps {
    user: User | null;
    t: (key: string) => string;
}

const Budgets: React.FC<BudgetsProps> = ({ user, t }) => {
    const { budgets, setBudgets } = useAppData();
    const { orders } = useInventory();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBudget, setEditingBudget] = useState<Partial<Budget> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Modal Form State
    const [formData, setFormData] = useState<Partial<Budget>>({
        category: CATEGORIES[0],
        amount: 0,
        period: 'MONTHLY',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0]
    });

    const openModal = (budget?: Budget) => {
        if (budget) {
            setEditingBudget(budget);
            setFormData(budget);
        } else {
            setEditingBudget(null);
            setFormData({
                category: CATEGORIES[0],
                amount: 0,
                period: 'MONTHLY',
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0]
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !user.id) return;

        setIsSaving(true);
        try {
            if (editingBudget && editingBudget.id) {
                const updated = await BudgetService.updateBudget(editingBudget.id, formData);
                if (updated) {
                    setBudgets(prev => prev.map(b => b.id === updated.id ? updated : b));
                }
            } else {
                const created = await BudgetService.createBudget(formData as any, user.id);
                if (created) {
                    setBudgets(prev => [created, ...prev]);
                }
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error("Failed to save budget", error);
            alert("Failed to save budget. Check console.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this budget limit?")) return;
        try {
            await BudgetService.deleteBudget(id);
            setBudgets(prev => prev.filter(b => b.id !== id));
        } catch (error) {
            console.error("Failed to delete budget", error);
            alert("Failed to delete budget.");
        }
    };

    // Calculate Budget Utilization
    const budgetStats = useMemo(() => {
        return budgets.map(budget => {
            const budgetStart = new Date(budget.startDate).getTime();
            const budgetEnd = new Date(budget.endDate).getTime();

            // Scan all orders to find items matching the category and date range
            const spent = orders.reduce((total, order) => {
                if (order.status === 'CANCELLED') return total;

                const orderDate = new Date(order.orderDate).getTime();
                // Check if order falls within budget period
                if (orderDate >= budgetStart && orderDate <= budgetEnd) {
                    // Sum up line items matching the category
                    const matchingItemsTotal = order.items.reduce((itemSum, item) => {
                        if ((item.category && item.category === budget.category) || (!item.category && budget.category === 'Uncategorized')) {
                            return itemSum + (item.total || (item.quantity * item.unitCost) || 0);
                        }
                        return itemSum;
                    }, 0);
                    return total + matchingItemsTotal;
                }
                return total;
            }, 0);

            const percentUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
            let statusColor = 'bg-emerald-500';
            if (percentUsed >= 90) statusColor = 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]';
            else if (percentUsed >= 75) statusColor = 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]';

            return {
                ...budget,
                spent,
                percentUsed: Math.min(percentUsed, 100), // Cap visually at 100%
                truePercentUsed: percentUsed, // For text readout
                statusColor
            };
        });
    }, [budgets, orders]);

    const totalBudgeted = budgetStats.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = budgetStats.reduce((sum, b) => sum + b.spent, 0);

    return (
        <div className="space-y-8 animate-fade-in-up pb-24 h-full">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white">
                        <i className="fa-solid fa-wallet text-2xl"></i>
                    </div>
                    <div>
                        <h2 className="text-display text-slate-900 dark:text-white">Budget Control</h2>
                        <p className="text-caption mt-1">Manage departmental limits and track real-time spending.</p>
                    </div>
                </div>

                <button
                    onClick={() => openModal()}
                    className="h-14 px-8 rounded-full bg-gradient-to-r from-medical-600 to-medical-500 text-white font-black shadow-xl shadow-medical-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                    <i className="fa-solid fa-plus text-lg"></i>
                    <span>New Budget Limit</span>
                </button>
            </header>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-panel p-6 md:p-8 rounded-3xl border border-white/50 dark:border-slate-800/50 flex flex-col justify-between overflow-hidden relative group">
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-colors"></div>
                    <div className="flex items-center gap-3 mb-6 relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <i className="fa-solid fa-vault"></i>
                        </div>
                        <h3 className="font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-sm">Total Allocated</h3>
                    </div>
                    <p className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter relative z-10">${totalBudgeted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>

                <div className="glass-panel p-6 md:p-8 rounded-3xl border border-white/50 dark:border-slate-800/50 flex flex-col justify-between overflow-hidden relative group">
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-medical-500/10 dark:bg-medical-500/5 rounded-full blur-3xl group-hover:bg-medical-500/20 transition-colors"></div>
                    <div className="flex items-center gap-3 mb-6 relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-medical-100 dark:bg-medical-900/30 flex items-center justify-center text-medical-600 dark:text-medical-400">
                            <i className="fa-solid fa-chart-line"></i>
                        </div>
                        <h3 className="font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-sm">Total Spent (Active Periods)</h3>
                    </div>
                    <p className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter relative z-10">${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
            </div>

            {/* Budgets List */}
            <h3 className="text-xl font-black text-slate-800 dark:text-white mt-10 mb-4 px-2">Active Budgets</h3>

            {budgetStats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center glass-panel rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
                    <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-4xl mb-6 shadow-inner">
                        <i className="fa-solid fa-piggy-bank"></i>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">No Budgets Setup</h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-8">Establish your first financial boundaries to start tracking expenses automatically against your purchasing orders.</p>
                    <button onClick={() => openModal()} className="px-8 h-12 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:scale-105 transition-transform">Create First Budget</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {budgetStats.map(budget => (
                        <div key={budget.id} className="glass-panel p-6 md:p-8 rounded-[2.5rem] border border-white/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/20 dark:shadow-none flex flex-col group">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="px-4 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-500/20">
                                            {budget.category}
                                        </span>
                                        <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                            {budget.period}
                                        </span>
                                    </div>
                                    <h4 className="text-slate-500 dark:text-slate-400 font-bold text-sm tracking-wide">
                                        {new Date(budget.startDate).toLocaleDateString()} — {new Date(budget.endDate).toLocaleDateString()}
                                    </h4>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openModal(budget)} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex items-center justify-center transition-all">
                                        <i className="fa-solid fa-pen-to-square"></i>
                                    </button>
                                    <button onClick={() => handleDelete(budget.id)} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center justify-center transition-all">
                                        <i className="fa-solid fa-trash-can"></i>
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-end justify-between mb-4">
                                <div>
                                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Spent</p>
                                    <p className="text-3xl font-black text-slate-900 dark:text-white leading-none">${budget.spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Total Limit</p>
                                    <p className="text-xl font-bold text-slate-500 dark:text-slate-400 leading-none">/ ${budget.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                            </div>

                            <div className="relative h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-auto">
                                <div
                                    className={`absolute left-0 top-0 bottom-0 rounded-full transition-all duration-1000 ease-out ${budget.statusColor}`}
                                    style={{ width: `${budget.percentUsed}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between mt-3 text-xs font-bold font-mono">
                                <span className={budget.truePercentUsed >= 100 ? 'text-red-500 animate-pulse' : 'text-slate-500 dark:text-slate-400'}>
                                    {budget.truePercentUsed.toFixed(1)}% Used
                                </span>
                                <span className="text-slate-400">
                                    ${Math.max(0, budget.amount - budget.spent).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Remaining
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add / Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSaving && setIsModalOpen(false)}></div>
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 flex flex-col overflow-hidden animate-scale-in border border-slate-100 dark:border-slate-800">
                        <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl">
                                    <i className={`fa-solid ${editingBudget ? 'fa-pen' : 'fa-wallet'}`}></i>
                                </div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                                    {editingBudget ? 'Edit Budget Limit' : 'New Budget Limit'}
                                </h3>
                            </div>
                            <button disabled={isSaving} onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 md:p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category</label>
                                        <div className="relative">
                                            <select
                                                required
                                                value={formData.category}
                                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                                className="w-full h-14 px-5 appearance-none rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 cursor-pointer"
                                            >
                                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <i className="fa-solid fa-chevron-down absolute right-5 top-5 text-slate-400 pointer-events-none text-xs"></i>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Period</label>
                                        <div className="relative">
                                            <select
                                                required
                                                value={formData.period}
                                                onChange={e => setFormData({ ...formData, period: e.target.value as any })}
                                                className="w-full h-14 px-5 appearance-none rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 cursor-pointer"
                                            >
                                                <option value="MONTHLY">Monthly</option>
                                                <option value="QUARTERLY">Quarterly</option>
                                                <option value="YEARLY">Yearly</option>
                                            </select>
                                            <i className="fa-solid fa-chevron-down absolute right-5 top-5 text-slate-400 pointer-events-none text-xs"></i>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Limit Amount ($)</label>
                                    <div className="relative">
                                        <span className="absolute left-5 top-4 text-slate-400 font-black">$</span>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            step="0.01"
                                            value={formData.amount || ''}
                                            onFocus={e => e.target.select()}
                                            onChange={e => setFormData({ ...formData, amount: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
                                            className="w-full h-14 pl-9 pr-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-black text-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                                            placeholder="Enter budget amount"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Start Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={formData.startDate}
                                            onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                            className="w-full h-14 px-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">End Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={formData.endDate}
                                            onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                            className="w-full h-14 px-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full h-16 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-black text-lg shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70 disabled:scale-100 flex items-center justify-center gap-3 mt-4"
                            >
                                {isSaving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                                {isSaving ? 'Saving...' : 'Save Budget Limit'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Budgets;
