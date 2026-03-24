
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
    className?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, trend, onClick, className = '' }) => {

    // Map teal -> emerald for brand consistency
    const resolvedColor = color === 'teal' ? 'emerald' : color;

    const colorClasses: Record<string, { icon: string; glow: string }> = {
        emerald: {
            icon: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
            glow: 'group-hover:shadow-emerald-500/10 dark:group-hover:shadow-emerald-500/5',
        },
        blue: {
            icon: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
            glow: 'group-hover:shadow-blue-500/10 dark:group-hover:shadow-blue-500/5',
        },
        amber: {
            icon: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
            glow: 'group-hover:shadow-amber-500/10 dark:group-hover:shadow-amber-500/5',
        },
        purple: {
            icon: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
            glow: 'group-hover:shadow-purple-500/10 dark:group-hover:shadow-purple-500/5',
        },
        red: {
            icon: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
            glow: 'group-hover:shadow-red-500/10 dark:group-hover:shadow-red-500/5',
        },
        indigo: {
            icon: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
            glow: 'group-hover:shadow-indigo-500/10 dark:group-hover:shadow-indigo-500/5',
        },
    };

    const styles = colorClasses[resolvedColor] || colorClasses.emerald;

    return (
        <div
            onClick={onClick}
            className={`glass-panel p-5 relative overflow-hidden group transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${styles.glow} ${onClick ? 'cursor-pointer' : ''} ${className}`}
        >
            <div className="flex justify-between items-start mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${styles.icon}`}>
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
                <div className="text-3xl font-bold text-slate-800 dark:text-white mb-1 tabular-nums group-hover:translate-x-0.5 transition-transform">
                    {value}
                </div>
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {label}
                    {trend?.label && <span className="opacity-70 ml-1 font-normal">- {trend.label}</span>}
                </div>
            </div>
        </div>
    );
};

export default StatCard;
