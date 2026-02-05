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

            {/* Main Analytics Content */}
            <DashboardAnalytics
                dailyReports={dailyReports}
                inventory={inventory}
                orders={orders}
                users={users}
                t={t}
                onNavigate={onNavigate}
            />

            {/* Quick Actions (Keep as Footer or Secondary) */}
            <div className="glass-panel p-6">
                <div className="section-title mb-5">
                    <span className="section-title-bar"></span>
                    <span className="text-slate-900 dark:text-white">Quick Actions</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {quickActions.map(action => (
                        <button
                            key={action.route}
                            onClick={() => onNavigate(action.route)}
                            className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group"
                        >
                            <div className={`w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                <i className={`fa-solid ${action.icon} ${action.color}`}></i>
                            </div>
                            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{action.label}</span>
                        </button>
                    ))}
                </div>
            </div>

        </div>
    );
};

export default Dashboard;
