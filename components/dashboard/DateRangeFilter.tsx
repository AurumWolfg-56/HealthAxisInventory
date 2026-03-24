
import React from 'react';

export type DateRange = 'all' | 'month' | 'quarter' | 'semester' | 'year' | 'custom';

export interface DateFilterPayload {
    range: DateRange;
    specificMonth?: string; // YYYY-MM
    customStart?: string; // YYYY-MM-DD
    customEnd?: string; // YYYY-MM-DD
}

interface DateRangeFilterProps {
    currentRange: DateRange;
    onRangeChange: (payload: DateFilterPayload) => void;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ currentRange, onRangeChange }) => {
    // Local state for the specific inputs to avoid trigger firing on every keystroke/change until ready
    const [localMonth, setLocalMonth] = React.useState<string>(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const [localStart, setLocalStart] = React.useState<string>('');
    const [localEnd, setLocalEnd] = React.useState<string>('');

    const handleBasicClick = (range: DateRange) => {
        if (range === 'month') {
            onRangeChange({ range: 'month', specificMonth: localMonth });
        } else {
            onRangeChange({ range });
        }
    };

    const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalMonth(val);
        onRangeChange({ range: 'month', specificMonth: val });
    };

    const handleCustomChange = (field: 'start' | 'end', val: string) => {
        let newStart = localStart;
        let newEnd = localEnd;
        if (field === 'start') {
            newStart = val;
            setLocalStart(val);
        } else {
            newEnd = val;
            setLocalEnd(val);
        }

        // Only trigger up if both are set
        if (newStart && newEnd) {
            onRangeChange({ range: 'custom', customStart: newStart, customEnd: newEnd });
        } else {
            onRangeChange({ range: 'custom' }); // Sets UI state but might not filter yet
        }
    };

    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex overflow-x-auto hide-scrollbar bg-slate-100 dark:bg-slate-800 p-1 rounded-xl max-w-full">
                {['all', 'month', 'quarter', 'semester', 'year', 'custom'].map((r) => (
                    <button
                        key={r}
                        onClick={() => handleBasicClick(r as DateRange)}
                        className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${currentRange === r
                            ? 'bg-white dark:bg-medical-500/15 text-slate-900 dark:text-medical-400 shadow-sm ring-1 ring-medical-500/10'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        {r === 'all' ? 'All Time' : r}
                    </button>
                ))}
            </div>

            {/* Contextual Inputs based on Selection */}
            {currentRange === 'month' && (
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl animate-fade-in-up">
                    <input
                        type="month"
                        value={localMonth}
                        onChange={handleMonthChange}
                        className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-200 outline-none px-2"
                    />
                </div>
            )}

            {currentRange === 'custom' && (
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl animate-fade-in-up">
                    <input
                        type="date"
                        value={localStart}
                        onChange={(e) => handleCustomChange('start', e.target.value)}
                        className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-200 outline-none px-2"
                    />
                    <span className="text-slate-400 text-xs">-</span>
                    <input
                        type="date"
                        value={localEnd}
                        onChange={(e) => handleCustomChange('end', e.target.value)}
                        className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-200 outline-none px-2"
                    />
                </div>
            )}
        </div>
    );
};

export default DateRangeFilter;
