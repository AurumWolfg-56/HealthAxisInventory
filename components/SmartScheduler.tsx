import React, { useState, useEffect, useMemo } from 'react';
import { User, Shift, AppRoute } from '../types';
import { ScheduleService } from '../services/ScheduleService';

interface SmartSchedulerProps {
    users: User[];
    currentUser: User | null;
    hasPermission: (perm: string) => boolean;
    t: any;
}

const SHIFT_COLORS = [
    'blue', 'emerald', 'rose', 'amber', 'purple', 'indigo', 'cyan', 'fuchsia', 'orange', 'teal'
];

export const SmartScheduler: React.FC<SmartSchedulerProps> = ({ users, currentUser, hasPermission, t }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [clipboardShift, setClipboardShift] = useState<Shift | null>(null);
    const [aiQuery, setAiQuery] = useState('');
    const [aiProcessing, setAiProcessing] = useState(false);
    const [unsavedChanges, setUnsavedChanges] = useState<Shift[]>([]);
    
    const canManage = hasPermission('schedule.manage');

    // Get the dates for the current week starting on Monday
    const weekDates = useMemo(() => {
        const date = new Date(currentDate);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff));
        
        return Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            return d;
        });
    }, [currentDate]);

    const startDateStr = weekDates[0].toISOString().split('T')[0];
    const endDateStr = weekDates[6].toISOString().split('T')[0];

    useEffect(() => {
        loadShifts();
    }, [startDateStr, endDateStr]);

    const loadShifts = async () => {
        setIsLoading(true);
        const data = await ScheduleService.fetchShifts(startDateStr, endDateStr);
        setShifts(data);
        setIsLoading(false);
    };

    const handlePrevWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() - 7);
        setCurrentDate(newDate);
    };

    const handleNextWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + 7);
        setCurrentDate(newDate);
    };

    // Derived Users grouping
    // Map theme colors to users who don't have one
    const colorMappedUsers = useMemo(() => {
        return users.map((u, i) => ({
            ...u,
            themeColor: u.themeColor || SHIFT_COLORS[i % SHIFT_COLORS.length]
        }));
    }, [users]);

    const providers = colorMappedUsers.filter(u => ['DOCTOR'].includes(u.role));
    const supportStaff = colorMappedUsers.filter(u => ['MANAGER', 'OWNER', 'MA', 'FRONT_DESK'].includes(u.role));

    const handleCellClick = async (user: User, dateObj: Date) => {
        if (!canManage) return;

        const dateStr = dateObj.toISOString().split('T')[0];
        
        // If we are in "paste mode"
        if (clipboardShift) {
            const newShift: Omit<Shift, 'id'> = {
                user_id: user.id,
                date: dateStr,
                start_time: clipboardShift.start_time,
                end_time: clipboardShift.end_time,
                role_type: providers.find(p => p.id === user.id) ? 'provider' : 'staff',
                notes: clipboardShift.notes
            };
            
            try {
                const saved = await ScheduleService.createShift(newShift);
                if (saved) setShifts(prev => [...prev, saved]);
            } catch (e) {
                console.error('Failed to paste shift', e);
            }
            return;
        }

        // Just ask for a new shift via standard confirm for now.
        // A complex modal could be better, but we are keeping it incredibly efficient.
        const existingShift = shifts.find(s => s.user_id === user.id && s.date === dateStr);
        
        if (existingShift) {
            // Un-assign or copy?
            const action = window.prompt(`Options for this shift:\n1. Copy\n2. Delete\n3. Edit time (Format: HH:MM-HH:MM)`);
            if (action === '1') {
                setClipboardShift(existingShift);
            } else if (action === '2') {
                await ScheduleService.deleteShift(existingShift.id);
                setShifts(prev => prev.filter(s => s.id !== existingShift.id));
            } else if (action === '3') {
                const newTime = window.prompt('Enter new time e.g., 08:00-17:00');
                if (newTime && newTime.includes('-')) {
                    const [start, end] = newTime.split('-');
                    const updated = await ScheduleService.updateShift(existingShift.id, { start_time: start.trim(), end_time: end.trim() });
                    if (updated) {
                         setShifts(prev => prev.map(s => s.id === updated.id ? updated : s));
                    }
                }
            }
        } else {
            const timeStr = window.prompt("Enter Shift Time (e.g., 08:00-17:00)");
            if (timeStr && timeStr.includes('-')) {
                const [start, end] = timeStr.split('-');
                const newShift: Omit<Shift, 'id'> = {
                    user_id: user.id,
                    date: dateStr,
                    start_time: start.trim(),
                    end_time: end.trim(),
                    role_type: providers.find(p => p.id === user.id) ? 'provider' : 'staff'
                };
                const saved = await ScheduleService.createShift(newShift);
                if (saved) setShifts(prev => [...prev, saved]);
            }
        }
    };

    const duplicatePriorWeek = async () => {
        if (!canManage) return;
        if (!window.confirm("This will overwrite this entire week with the exact schedule from the previous 7 days. Proceed?")) return;

        setIsLoading(true);
        // Find previous week dates
        const prevMonday = new Date(weekDates[0]);
        prevMonday.setDate(prevMonday.getDate() - 7);
        const prevSunday = new Date(weekDates[6]);
        prevSunday.setDate(prevSunday.getDate() - 7);

        const pStart = prevMonday.toISOString().split('T')[0];
        const pEnd = prevSunday.toISOString().split('T')[0];

        try {
            const previousShifts = await ScheduleService.fetchShifts(pStart, pEnd);
            
            const newShiftsToCreate = previousShifts.map(s => {
                const oldDate = new Date(s.date);
                // add 7 days using UTC strings to avoid timezone drift if possible, or just raw JS dates if safe
                const newDate = new Date(oldDate);
                newDate.setDate(newDate.getDate() + 7);
                return {
                    user_id: s.user_id,
                    date: newDate.toISOString().split('T')[0],
                    start_time: s.start_time,
                    end_time: s.end_time,
                    notes: s.notes,
                    role_type: s.role_type
                };
            });

            // Cleanup current week before injecting
            // Note: In production you might want a backend RPC for safety, but this works for bulk via REST loop
            for (const s of shifts) {
                await ScheduleService.deleteShift(s.id);
            }

            const newlyCreated = await ScheduleService.bulkCreateShifts(newShiftsToCreate);
            setShifts(newlyCreated);
        } catch (e) {
            console.error('Time machine failed', e);
            alert("Failed to duplicate week.");
        }
        setIsLoading(false);
    };

    const getDayName = (date: Date) => {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    };

    // Theme coloration mappings for Tailwind
    const getThemeClasses = (colorName: string) => {
        const map: any = {
            blue: 'bg-blue-50/50 text-blue-700 border-l-blue-500 border-blue-100',
            emerald: 'bg-emerald-50/50 text-emerald-700 border-l-emerald-500 border-emerald-100',
            rose: 'bg-rose-50/50 text-rose-700 border-l-rose-500 border-rose-100',
            amber: 'bg-amber-50/50 text-amber-700 border-l-amber-500 border-amber-100',
            purple: 'bg-purple-50/50 text-purple-700 border-l-purple-500 border-purple-100',
            indigo: 'bg-indigo-50/50 text-indigo-700 border-l-indigo-500 border-indigo-100',
            cyan: 'bg-cyan-50/50 text-cyan-700 border-l-cyan-500 border-cyan-100',
            fuchsia: 'bg-fuchsia-50/50 text-fuchsia-700 border-l-fuchsia-500 border-fuchsia-100',
            orange: 'bg-orange-50/50 text-orange-700 border-l-orange-500 border-orange-100',
            teal: 'bg-teal-50/50 text-teal-700 border-l-teal-500 border-teal-100',
        };
        return map[colorName] || map['blue'];
    };

    const renderGrid = (groupName: string, groupUsers: typeof colorMappedUsers) => {
        return (
            <div className="mb-10 animate-fade-in-up">
                <h3 className="text-xl font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    {groupName}
                    <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded-full">{groupUsers.length}</span>
                </h3>
                
                <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-800/50 overflow-hidden">
                    <div className="overflow-x-auto min-h-[150px]">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="py-4 px-6 font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px] w-48 sticky left-0 bg-white dark:bg-slate-900">Staff Member</th>
                                    {weekDates.map(d => (
                                        <th key={d.toISOString()} className="py-4 px-4 font-bold text-center border-l border-slate-100 dark:border-slate-800 min-w-[140px]">
                                            <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">{getDayName(d)}</div>
                                            <div className="text-base text-slate-800 dark:text-slate-200">{d.getDate()}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {groupUsers.map(u => (
                                    <tr key={u.id} className="border-b border-slate-50/50 dark:border-slate-800/50 hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors group">
                                        <td className="py-4 px-6 font-semibold text-slate-700 dark:text-slate-300 sticky left-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)]">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${getThemeClasses(u.themeColor!).split(' ')[0]} ${getThemeClasses(u.themeColor!).split(' ')[1]}`}>
                                                    {(u.username || 'U').substring(0,2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="leading-tight">{u.username || 'Unknown'}</div>
                                                    <div className="text-[10px] text-slate-400 capitalize">{u.role || 'Staff'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        {weekDates.map(d => {
                                            const dStr = d.toISOString().split('T')[0];
                                            const shift = shifts.find(s => s.user_id === u.id && s.date === dStr);
                                            
                                            return (
                                                <td 
                                                    key={dStr} 
                                                    className={`py-2 px-2 border-l border-slate-100/50 dark:border-slate-800/50 align-top ${canManage ? (clipboardShift ? 'cursor-cell hover:bg-indigo-50/50' : 'cursor-pointer hover:bg-slate-50') : 'cursor-default'}`}
                                                    onClick={() => handleCellClick(u, d)}
                                                >
                                                    {shift ? (
                                                        <div className={`p-2 rounded-lg border-l-4 shadow-sm group-hover:-translate-y-0.5 transition-transform duration-200 ${getThemeClasses(u.themeColor!)} relative`}>
                                                            <div className="font-bold tracking-tight text-[11px] leading-none mb-1">{shift.start_time}</div>
                                                            <div className="font-bold tracking-tight text-[11px] leading-none opacity-80">{shift.end_time}</div>
                                                            
                                                            {/* Extra hint for clipboard state */}
                                                            {clipboardShift && clipboardShift.id === shift.id && (
                                                                <div className="absolute top-1 right-1 animate-pulse">
                                                                    <i className="fa-solid fa-copy text-[10px] opacity-50"></i>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="h-full w-full min-h-[40px] rounded-lg border border-dashed border-transparent hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex items-center justify-center">
                                                            {canManage && clipboardShift && (
                                                                <i className="fa-solid fa-paste text-indigo-300 opacity-0 hover:opacity-100 transition-opacity text-sm"></i>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 max-w-7xl mx-auto pb-32">
            
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md">
                            Workforce Management
                        </span>
                        {!canManage && (
                           <span className="bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md">
                               Read Only Mode
                           </span>
                        )}
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Smart Scheduler</h1>
                    <p className="text-sm text-slate-500 mt-1 font-medium">Control the operational timeline and clinical shifts.</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-1">
                        <button onClick={handlePrevWeek} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <i className="fa-solid fa-chevron-left text-xs"></i>
                        </button>
                        <div className="px-4 py-1.5 font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center min-w-[170px] justify-center">
                            {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 
                            {' - '} 
                            {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <button onClick={handleNextWeek} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <i className="fa-solid fa-chevron-right text-xs"></i>
                        </button>
                    </div>

                    {canManage && (
                        <div className="flex gap-2">
                            {clipboardShift && (
                                <button 
                                    onClick={() => setClipboardShift(null)}
                                    className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 font-bold text-sm rounded-xl hover:bg-rose-100 transition-colors border border-rose-100"
                                >
                                    Cancel Paste
                                </button>
                            )}
                            <button 
                                onClick={duplicatePriorWeek}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all hover:-translate-y-0.5"
                            >
                                <i className="fa-solid fa-copy"></i> Duplicate Last Week
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <>
                    {/* Render Clinical Providers Grid */}
                    {providers.length > 0 && renderGrid("Clinical Providers", providers)}
                    
                    {/* Render Support Staff Grid */}
                    {supportStaff.length > 0 && renderGrid("Support Staff", supportStaff)}
                </>
            )}

            {/* AI Assistant Console (Fixed at Bottom for Managers) */}
            {canManage && (
                <div className="fixed bottom-0 left-0 right-0 p-4 pointer-events-none z-50">
                    <div className="max-w-4xl mx-auto pointer-events-auto">
                        <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-4 group hover:border-indigo-500/50 transition-colors">
                            <div className="bg-indigo-500/20 p-3 rounded-xl">
                                <i className="fa-solid fa-wand-magic-sparkles text-indigo-400"></i>
                            </div>
                            <input 
                                type="text"
                                className="flex-1 bg-transparent border-none outline-none text-white placeholder-slate-500 font-medium text-sm"
                                placeholder="E.g. Schedule Dr. Smith from 8am to 5pm next Monday, and give Maria Tuesday off... (LM Studio Local AI Assistant)"
                                value={aiQuery}
                                onChange={e => setAiQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if(e.key === 'Enter' && aiQuery.trim()) {
                                        // Mocking the AI hit for visual demonstration before full backend hook
                                        setAiProcessing(true);
                                        setTimeout(() => {
                                            setAiProcessing(false);
                                            setAiQuery('');
                                            alert("AI feature is analyzing intent. Integration layer ready for local LLM gateway.");
                                        }, 1500);
                                    }
                                }}
                            />
                            {aiProcessing ? (
                                <div className="text-indigo-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                                    Thinking
                                </div>
                            ) : (
                                <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors">
                                    Generate
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
