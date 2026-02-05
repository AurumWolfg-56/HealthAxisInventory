
import React from 'react';

interface StatCardProps {
    label: string;
    value: string | number;
    icon: string;
    color: 'emerald' | 'blue' | 'amber' | 'purple' | 'red' | 'indigo' | 'teal';
    trend?: {
        value: number;
        isPositive: boolean;
        label?: string;
    };
    onClick?: () => void;
    className?: string; // Additional classes
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, trend, onClick, className = '' }) => {

    const colorClasses = {
        emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
        blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
        amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
        purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
        red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
        indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
        teal: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400',
    };

    return (
        <div
            onClick={onClick}
            className={`glass-panel p-5 relative overflow-hidden group transition-all duration-300 hover:scale-[1.02] ${onClick ? 'cursor-pointer' : ''} ${className}`}
        >
            <div className="flex justify-between items-start mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${colorClasses[color]}`}>
                    <i className={`fa-solid ${icon}`}></i>
                </div>
                {trend && (
                    <div className={`text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1 ${trend.isPositive
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                        <i className={`fa-solid fa-arrow-${trend.isPositive ? 'up' : 'down'}`}></i>
                        {Math.abs(trend.value)}%
                    </div>
                )}
            </div>

            <div>
                <div className="text-3xl font-bold text-slate-800 dark:text-white mb-1 group-hover:translate-x-1 transition-transform">
                    {value}
                </div>
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {label}
                    {trend?.label && <span className="opacity-70 ml-1 font-normal">- {trend.label}</span>}
                </div>
            </div>

            {/* Decorative gradient blob */}
            <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-0 group-hover:opacity-10 transition-opacity blur-2xl ${colorClasses[color].replace('text-', 'bg-').split(' ')[0]}`}></div>
        </div>
    );
};

export default StatCard;
