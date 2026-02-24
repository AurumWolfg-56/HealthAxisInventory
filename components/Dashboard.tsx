import React from 'react';
import { InventoryItem, ActivityLog, AppRoute, PettyCashTransaction, Order, User } from '../types';
import { DailyReport } from '../types/dailyReport';
import DashboardAnalytics from './DashboardAnalytics';

interface DashboardProps {
    inventory: InventoryItem[];
    logs: ActivityLog[];
    dailyReports: DailyReport[];
    pettyCashHistory: PettyCashTransaction[];
    orders?: Order[];
    users?: User[];
    t: (key: string) => string;
    onNavigate: (route: AppRoute, subTab?: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ inventory, dailyReports, pettyCashHistory, orders = [], users = [], t, onNavigate }) => {

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    };

    // Quick Actions
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
                    {/* Additional top-level actions could go here */}
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
