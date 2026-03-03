
import React from 'react';

export type DateRange = 'all' | 'month' | 'quarter' | 'semester' | 'year';

interface DateRangeFilterProps {
    currentRange: DateRange;
    onRangeChange: (range: DateRange) => void;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ currentRange, onRangeChange }) => {
    return (
        <div className="flex overflow-x-auto hide-scrollbar bg-slate-100 dark:bg-slate-800 p-1 rounded-xl max-w-full">
            <button
                onClick={() => onRangeChange('all')}
                className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${currentRange === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
            >
                All Time
            </button>
            <button
                onClick={() => onRangeChange('month')}
                className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${currentRange === 'month'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
            >
                Month
            </button>
            <button
                onClick={() => onRangeChange('quarter')}
                className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${currentRange === 'quarter'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
            >
                Quarter
            </button>
            <button
                onClick={() => onRangeChange('semester')}
                className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${currentRange === 'semester'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
            >
                Semester
            </button>
            <button
                onClick={() => onRangeChange('year')}
                className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${currentRange === 'year'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
            >
                Year
            </button>
        </div>
    );
};

export default DateRangeFilter;
