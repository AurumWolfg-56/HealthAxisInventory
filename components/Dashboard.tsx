import React from 'react';
import { InventoryItem, ActivityLog, AppRoute, PettyCashTransaction, Order, User, PriceItem } from '../types';
import { DailyReport } from '../types/dailyReport';
import DashboardAnalytics from './DashboardAnalytics';
import AIBriefingCard from './dashboard/AIBriefing';

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

    const quickActions = [
        { icon: 'fa-boxes-stacked', label: 'Inventory', route: AppRoute.INVENTORY, color: 'text-blue-500' },
        { icon: 'fa-truck', label: 'Orders', route: AppRoute.ORDERS, color: 'text-amber-500' },
        { icon: 'fa-file-invoice-dollar', label: 'Billing', route: AppRoute.BILLING_WIZARD, color: 'text-emerald-500' },
        { icon: 'fa-chart-pie', label: 'Reports', route: AppRoute.REPORTS, color: 'text-purple-500' },
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

            {/* AI Morning Briefing */}
            <AIBriefingCard
                inventory={inventory}
                dailyReports={dailyReports}
                orders={orders}
                pettyCash={pettyCashHistory}
            />

            {/* Quick Actions — compact horizontal cards */}
            <div className="grid grid-cols-4 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                {quickActions.map(action => (
                    <button
                        key={action.route}
                        onClick={() => onNavigate(action.route)}
                        className="flex flex-col sm:flex-row justify-center sm:justify-start items-center gap-1.5 sm:gap-3 p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#0c1511] border border-slate-200 dark:border-slate-800/60 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-medical-500/30 dark:hover:border-medical-500/20 transition-all duration-300 group"
                    >
                        <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full sm:rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center group-hover:bg-medical-50 dark:group-hover:bg-medical-500/10 transition-all duration-300 flex-shrink-0`}>
                            <i className={`fa-solid ${action.icon} text-sm sm:text-lg ${action.color} group-hover:text-medical-600 dark:group-hover:text-medical-400 transition-colors`}></i>
                        </div>
                        <span className="text-[10px] sm:text-sm font-bold text-slate-700 dark:text-slate-200 text-center sm:text-left leading-tight">{action.label}</span>
                    </button>
                ))}
            </div>

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
