import React from 'react';
import { InventoryItem, ActivityLog, AppRoute, PettyCashTransaction, Order, User, PriceItem } from '../types';
import { DailyReport } from '../types/dailyReport';
import DashboardAnalytics from './DashboardAnalytics';

interface DashboardProps {
    inventory: InventoryItem[];
    logs: ActivityLog[];
    dailyReports: DailyReport[];
    pettyCashHistory: PettyCashTransaction[];
    orders?: Order[];
    users?: User[];
    prices?: PriceItem[];
    t: (key: string) => string;
    onNavigate: (route: AppRoute, subTab?: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ inventory, dailyReports, pettyCashHistory, orders = [], users = [], prices = [], t, onNavigate }) => {

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    };

    // Featured prices
    const featuredPrices = prices.filter(p => p.isFeatured && (p.type || 'individual') === 'individual');

    // Quick Actions
    const quickActions = [
        { icon: 'fa-boxes-stacked', label: 'Inventory', route: AppRoute.INVENTORY, color: 'text-blue-500' },
        { icon: 'fa-truck', label: 'Orders', route: AppRoute.ORDERS, color: 'text-amber-500' },
        { icon: 'fa-file-invoice-dollar', label: 'Billing', route: AppRoute.BILLING_WIZARD, color: 'text-emerald-500' },
        { icon: 'fa-chart-pie', label: 'Reports', route: AppRoute.REPORTS, color: 'text-purple-500' },
    ];

    // Color palette for price cards
    const cardColors = [
        { bg: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/30', light: 'bg-emerald-400/20' },
        { bg: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/30', light: 'bg-blue-400/20' },
        { bg: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/30', light: 'bg-violet-400/20' },
        { bg: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-500/30', light: 'bg-amber-400/20' },
        { bg: 'from-rose-500 to-pink-600', shadow: 'shadow-rose-500/30', light: 'bg-rose-400/20' },
        { bg: 'from-cyan-500 to-sky-600', shadow: 'shadow-cyan-500/30', light: 'bg-cyan-400/20' },
    ];

    return (
        <div className="page-container space-y-8 pb-24 md:pb-8">

            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-display text-slate-900 dark:text-white">
                        {getGreeting()}
                    </h1>
                    <p className="text-subheading text-slate-500 dark:text-slate-400 mt-1">
                        Your clinic is <span className="text-emerald-500 font-semibold">online</span> • {inventory.length} items tracked
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => onNavigate(AppRoute.INVENTORY)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <i className="fa-solid fa-plus text-sm"></i>
                        Add Item
                    </button>
                </div>
            </header>

            {/* Quick Actions Moved to Top */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 mb-8">
                {quickActions.map(action => (
                    <button
                        key={action.route}
                        onClick={() => onNavigate(action.route)}
                        className="flex flex-col items-center gap-4 p-5 rounded-3xl bg-white dark:bg-[#151b23] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 transition-all duration-300 group"
                    >
                        <div className={`w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10 transition-all duration-300`}>
                            <i className={`fa-solid ${action.icon} text-2xl ${action.color} group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors`}></i>
                        </div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{action.label}</span>
                    </button>
                ))}
            </div>

            {/* Featured Prices */}
            {featuredPrices.length > 0 && (
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <i className="fa-solid fa-star text-amber-500 text-lg"></i>
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Quick Reference Prices</h2>
                                <p className="text-xs text-slate-400 font-bold">{featuredPrices.length} pinned services</p>
                            </div>
                        </div>
                        <button
                            onClick={() => onNavigate(AppRoute.PRICELIST)}
                            className="text-xs font-bold text-medical-500 hover:text-medical-400 transition-colors flex items-center gap-1"
                        >
                            Manage <i className="fa-solid fa-arrow-right text-[10px]"></i>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {featuredPrices.map((item, idx) => {
                            const color = cardColors[idx % cardColors.length];
                            return (
                                <div
                                    key={item.id}
                                    className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${color.bg} p-5 shadow-xl ${color.shadow} hover:scale-[1.03] hover:shadow-2xl transition-all duration-300 cursor-default group`}
                                >
                                    {/* Decorative circle */}
                                    <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full ${color.light} blur-sm group-hover:scale-150 transition-transform duration-500`}></div>
                                    <div className={`absolute -bottom-4 -left-4 w-16 h-16 rounded-full ${color.light} blur-sm`}></div>

                                    <div className="relative z-10">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1">{item.category}</p>
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

            {/* Main Analytics Content */}
            <DashboardAnalytics
                dailyReports={dailyReports}
                inventory={inventory}
                orders={orders}
                users={users}
                t={t}
                onNavigate={onNavigate}
            />

        </div>
    );
};

export default Dashboard;
