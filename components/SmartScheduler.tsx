import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Shift, AppRoute, TimeOffRequest } from '../types';
import { ScheduleService } from '../services/ScheduleService';
import { ScheduleReportDocument } from './ScheduleReportDocument';

type ExtendedUser = User & { full_name?: string };

interface SmartSchedulerProps {
    users: User[];
    currentUser: User | null;
    hasPermission: (perm: string) => boolean;
    t: any;
}

const SHIFT_COLORS = ['blue', 'emerald', 'rose', 'amber', 'purple', 'indigo', 'cyan', 'fuchsia', 'orange', 'teal'];

export const SmartScheduler: React.FC<SmartSchedulerProps> = ({ users, currentUser, hasPermission, t }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Feature States
    const [clipboardShift, setClipboardShift] = useState<Shift | null>(null);
    const [shiftEditor, setShiftEditor] = useState<{isOpen: boolean, user: ExtendedUser|null, dateObj: Date|null, shift: Shift|null, tmpStart?: string, tmpEnd?: string, tmpColor?: string}>({isOpen: false, user: null, dateObj: null, shift: null, tmpStart: '08:00', tmpEnd: '17:00', tmpColor: 'blue'});
    const [userColorOverrides, setUserColorOverrides] = useState<Record<string, string>>(() => {
        try { return JSON.parse(localStorage.getItem('HA_USER_COLORS') || '{}'); } catch { return {}; }
    });
    const [aiQuery, setAiQuery] = useState('');
    const [aiProcessing, setAiProcessing] = useState(false);
    
    // Modals
    const [showTimeOffModal, setShowTimeOffModal] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);

    const canManage = hasPermission('schedule.manage');
    const reportRef = useRef<HTMLDivElement>(null);

    // DATES LOGIC //
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

    const monthDates = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        
        // Find the Monday of the first week
        const startDate = new Date(firstDayOfMonth);
        const startDay = startDate.getDay();
        startDate.setDate(startDate.getDate() - (startDay === 0 ? 6 : startDay - 1));
        
        // Generate exactly 35 days (5 weeks)
        return Array.from({ length: 35 }).map((_, i) => {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            return d;
        });
    }, [currentDate]);

    const activeDates = viewMode === 'week' ? weekDates : monthDates;
    const startDateStr = activeDates[0].toISOString().split('T')[0];
    const endDateStr = activeDates[activeDates.length - 1].toISOString().split('T')[0];

    useEffect(() => {
        loadData();
    }, [startDateStr, endDateStr]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [fetchedShifts, fetchedTimeOff] = await Promise.all([
                ScheduleService.fetchShifts(startDateStr, endDateStr),
                ScheduleService.fetchTimeOffRequests(startDateStr, endDateStr)
            ]);
            setShifts(fetchedShifts);
            setTimeOffRequests(fetchedTimeOff);
        } catch(e) {
            console.error('Data load error', e);
        }
        setIsLoading(false);
    };

    const handlePrev = () => {
        const newDate = new Date(currentDate);
        if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
        else newDate.setMonth(newDate.getMonth() - 1);
        setCurrentDate(newDate);
    };

    const handleNext = () => {
        const newDate = new Date(currentDate);
        if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
        else newDate.setMonth(newDate.getMonth() + 1);
        setCurrentDate(newDate);
    };

    // USERS MAPPING //
    const colorMappedUsers = useMemo(() => {
        return users.map((u, i) => ({
            ...u,
            themeColor: userColorOverrides[u.id] || u.themeColor || SHIFT_COLORS[i % SHIFT_COLORS.length]
        }));
    }, [users, userColorOverrides]);
    const providers = colorMappedUsers.filter(u => ['DOCTOR'].includes(u.role));
    const supportStaff = colorMappedUsers.filter(u => ['MANAGER', 'OWNER', 'MA', 'FRONT_DESK'].includes(u.role));

    const pendingRequests = timeOffRequests.filter(r => r.status === 'pending');

    // ACTIONS //
    const handleCellClick = async (user: User, dateObj: Date) => {
        if (!canManage) return;
        const dateStr = dateObj.toISOString().split('T')[0];

        // Ensure not clicking on an approved time off
        const localDStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
        const hasTimeOff = timeOffRequests.some(t => t.user_id === user.id && t.status === 'approved' && t.start_date <= localDStr && t.end_date >= localDStr);
        if (hasTimeOff) {
            alert("This user has approved time off on this date.");
            return;
        }
        
        if (clipboardShift) {
            try {
                const saved = await ScheduleService.createShift({
                    user_id: user.id,
                    date: dateStr,
                    start_time: clipboardShift.start_time,
                    end_time: clipboardShift.end_time,
                    role_type: providers.find(p => p.id === user.id) ? 'provider' : 'staff',
                    notes: clipboardShift.notes
                });
                if (saved) setShifts(prev => [...prev, saved]);
            } catch (e) {
                console.error('Failed to paste shift', e);
            }
            return;
        }

        const existingShift = shifts.find(s => s.user_id === user.id && s.date === dateStr);
        const uColor = userColorOverrides[user.id] || user.themeColor || SHIFT_COLORS[0];
        
        // Smart Defaults: Detect their most recent shift, otherwise fallback to clinic hours
        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
        let defaultStart = '10:00';
        let defaultEnd = isWeekend ? '18:00' : '20:00';
        
        const userPastShifts = shifts.filter(s => s.user_id === user.id);
        if (userPastShifts.length > 0) {
            const lastShift = userPastShifts.reduce((latest, s) => s.date > latest.date ? s : latest, userPastShifts[0]);
            defaultStart = lastShift.start_time;
            defaultEnd = lastShift.end_time;
        }

        setShiftEditor({ 
            isOpen: true, user, dateObj, shift: existingShift || null, 
            tmpStart: existingShift ? existingShift.start_time : defaultStart, 
            tmpEnd: existingShift ? existingShift.end_time : defaultEnd, 
            tmpColor: uColor 
        });
    };

    const duplicatePriorWeek = async () => {
        if (!canManage) return;
        if (!window.confirm("Overwrite this week with previous 7 days?")) return;

        setIsLoading(true);
        const pStart = new Date(weekDates[0]); pStart.setDate(pStart.getDate() - 7);
        const pEnd = new Date(weekDates[6]); pEnd.setDate(pEnd.getDate() - 7);

        try {
            const previousShifts = await ScheduleService.fetchShifts(pStart.toISOString().split('T')[0], pEnd.toISOString().split('T')[0]);
            const newShiftsToCreate = previousShifts.map(s => {
                const d = new Date(s.date); d.setDate(d.getDate() + 7);
                return {
                    user_id: s.user_id,
                    date: d.toISOString().split('T')[0],
                    start_time: s.start_time, end_time: s.end_time, notes: s.notes, role_type: s.role_type
                };
            });

            for (const s of shifts.filter(sh => sh.date >= startDateStr && sh.date <= endDateStr)) {
                await ScheduleService.deleteShift(s.id);
            }
            const newlyCreated = await ScheduleService.bulkCreateShifts(newShiftsToCreate);
            setShifts(prev => [...prev.filter(sh => sh.date < startDateStr || sh.date > endDateStr), ...newlyCreated]);
        } catch (e) {
            console.error('Time machine failed', e);
        }
        setIsLoading(false);
    };

    const submitTimeOff = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const saved = await ScheduleService.createTimeOffRequest({
            user_id: currentUser!.id,
            start_date: fd.get('start_date') as string,
            end_date: fd.get('end_date') as string,
            status: 'pending',
            reason: fd.get('reason') as string
        });
        if (saved) {
            setTimeOffRequests(prev => [saved, ...prev]);
            setShowTimeOffModal(false);
            alert("Request submitted!");
        }
    };

    const handleTimeOffReview = async (id: string, status: 'approved' | 'rejected') => {
        const saved = await ScheduleService.updateTimeOffRequestStatus(id, status, currentUser!.id);
        if (saved) {
            setTimeOffRequests(prev => prev.map(r => r.id === saved.id ? saved : r));
        }
    };

    const submitShiftEditor = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const start = fd.get('start_time') as string;
        const end = fd.get('end_time') as string;
        const notes = fd.get('notes') as string;
        const repeatMonth = fd.get('repeat_month') as string === 'on';
        const actionType = fd.get('action_type') as string;

        if (!shiftEditor.user || !shiftEditor.dateObj) return;

        setIsLoading(true);

        try {
            if (actionType === 'delete' && shiftEditor.shift) {
                await ScheduleService.deleteShift(shiftEditor.shift.id);
                setShifts(prev => prev.filter(s => s.id !== shiftEditor.shift!.id));
                setShiftEditor({ isOpen: false, user: null, dateObj: null, shift: null });
                setIsLoading(false);
                return;
            }
            if (actionType === 'copy' && shiftEditor.shift) {
                setClipboardShift(shiftEditor.shift);
                setShiftEditor({ isOpen: false, user: null, dateObj: null, shift: null });
                setIsLoading(false);
                return;
            }

            if (!start || !end) {
                 alert("Start and End times are required");
                 setIsLoading(false);
                 return;
            }

            const dateStr = fd.get('shift_date') as string || shiftEditor.dateObj.toISOString().split('T')[0];
            
            const baseShiftToCreate = {
                user_id: shiftEditor.user.id,
                start_time: start,
                end_time: end,
                notes: notes,
                role_type: shiftEditor.user.role === 'DOCTOR' ? 'provider' as const : 'staff' as const
            };

            if (shiftEditor.shift && !repeatMonth) {
                // Update
                const updated = await ScheduleService.updateShift(shiftEditor.shift.id, { date: dateStr, start_time: start, end_time: end, notes });
                if (updated) {
                    setShifts(prev => {
                        const filtered = prev.filter(s => s.id !== updated.id);
                        return [...filtered, updated];
                    });
                }
            } else if (!repeatMonth) {
                // Create Single
                const saved = await ScheduleService.createShift({
                    ...baseShiftToCreate,
                    date: dateStr
                });
                if (saved) setShifts(prev => [...prev, saved]);
            } else {
                // Create Repeating for Month
                const targetDayOfWeek = shiftEditor.dateObj.getDay();
                const year = shiftEditor.dateObj.getFullYear();
                const month = shiftEditor.dateObj.getMonth();
                
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const newShifts: Omit<Shift, 'id'>[] = [];
                
                for (let day = 1; day <= daysInMonth; day++) {
                    const d = new Date(year, month, day);
                    if (d.getDay() === targetDayOfWeek) {
                        const localDStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                        newShifts.push({ ...baseShiftToCreate, date: localDStr });
                    }
                }
                
                const savedArr = await ScheduleService.bulkCreateShifts(newShifts);
                if (savedArr) setShifts(prev => [...prev, ...savedArr]);
            }
            setShiftEditor({ isOpen: false, user: null, dateObj: null, shift: null });
        } catch (e) {
            console.error(e);
            alert("Failed to save shift");
        }
        setIsLoading(false);
    };

    const handlePrint = () => {
        const printContent = document.getElementById('schedule-report-document-container');
        if (printContent) {
            const originalContents = document.body.innerHTML;
            document.body.innerHTML = printContent.innerHTML;
            window.print();
            document.body.innerHTML = originalContents;
            window.location.reload(); // Reload to restore React bindings
        }
    };

    // UI HELPERS //
    const formatTime = (timeStr: string) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':');
        const d = new Date();
        d.setHours(parseInt(h), parseInt(m));
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    };

    const getThemeClasses = (colorName: string) => {
        const map: Record<string, string> = {
            blue: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-l-blue-500 dark:border-l-blue-400',
            emerald: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-l-emerald-500 dark:border-l-emerald-400',
            rose: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-l-rose-500 dark:border-l-rose-400',
            amber: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-l-amber-500 dark:border-l-amber-400',
            purple: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-l-purple-500 dark:border-l-purple-400',
            indigo: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-l-indigo-500 dark:border-l-indigo-400',
            teal: 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border-l-teal-500 dark:border-l-teal-400',
            cyan: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-l-cyan-500 dark:border-l-cyan-400',
            fuchsia: 'bg-fuchsia-100 dark:bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-300 border-l-fuchsia-500 dark:border-l-fuchsia-400',
            orange: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border-l-orange-500 dark:border-l-orange-400',
        };
        return map[colorName] || map['blue'];
    };

    const renderGrid = (groupName: string, groupUsers: typeof colorMappedUsers) => (
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
                                <th className="py-4 px-6 font-bold text-slate-400 uppercase tracking-wider text-[10px] w-48 sticky left-0 bg-white dark:bg-slate-900 z-20">Staff Member</th>
                                {activeDates.map(d => (
                                    <th key={d.toISOString()} className="py-2 px-2 font-bold text-center border-l border-slate-100 dark:border-slate-800 min-w-[120px]">
                                        <div className="text-[10px] uppercase text-slate-400">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                        <div className="text-sm text-slate-800 dark:text-slate-200">{d.getDate()} {viewMode==='month' && d.toLocaleDateString('en-US',{month:'short'})}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {groupUsers.map((u: ExtendedUser) => {
                                const displayName = u.username || u.full_name || 'Unknown';
                                return (
                                <tr key={u.id} className="border-b border-slate-50/50 dark:border-slate-800/50 hover:bg-slate-50/30 transition-colors group">
                                    <td className="py-4 px-6 font-semibold sticky left-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)]">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${getThemeClasses(u.themeColor!).split(' ')[0]} ${getThemeClasses(u.themeColor!).split(' ')[1]}`}>
                                                {(displayName).substring(0,2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="leading-tight text-slate-800 dark:text-slate-200">{displayName}</div>
                                                <div className="text-[10px] text-slate-400 capitalize">{(u.role || '').replace('_', ' ')}</div>
                                            </div>
                                        </div>
                                    </td>
                                    {activeDates.map(d => {
                                        const dStr = d.toISOString().split('T')[0];
                                        const dStrLocal = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                                        
                                        const shift = shifts.find(s => s.user_id === u.id && (s.date === dStr || s.date === dStrLocal));
                                        const timeOff = timeOffRequests.find(t => t.user_id === u.id && t.status === 'approved' && t.start_date <= dStrLocal && t.end_date >= dStrLocal);
                                        
                                        return (
                                            <td key={dStr} className={`py-1 px-1 border-l border-slate-100/50 dark:border-slate-800/50 align-top ${canManage && !timeOff && viewMode==='week' ? (clipboardShift ? 'cursor-cell' : 'cursor-pointer') : ''}`} onClick={() => handleCellClick(u, d)}>
                                                {timeOff ? (
                                                    <div className="h-full w-full p-2 rounded border border-red-200 bg-[repeat-x_repeating-linear-gradient(45deg,theme(colors.red.50),theme(colors.red.50)_10px,transparent_10px,transparent_20px)] flex items-center justify-center min-h-[40px]">
                                                        <span className="px-2 py-1 bg-red-100 text-red-700 text-[9px] font-black uppercase rounded shadow-sm">Blocked</span>
                                                    </div>
                                                ) : shift ? (
                                                    <div className={`p-2 rounded-lg border-l-4 shadow-sm relative ${getThemeClasses(u.themeColor!)}`}>
                                                        <div className="font-bold tracking-tight text-[11px] leading-none mb-1">{formatTime(shift.start_time)}</div>
                                                        <div className="font-bold tracking-tight text-[11px] leading-none opacity-80">{formatTime(shift.end_time)}</div>
                                                        {clipboardShift?.id === shift.id && <div className="absolute top-1 right-1 animate-pulse"><i className="fa-solid fa-copy opacity-50"></i></div>}
                                                    </div>
                                                ) : viewMode === 'week' ? (
                                                    <div className="h-full w-full min-h-[40px] rounded-lg border border-dashed border-transparent hover:border-slate-300 transition flex items-center justify-center">
                                                        {canManage && clipboardShift && <i className="fa-solid fa-paste text-indigo-300 opacity-0 hover:opacity-100 transition text-sm"></i>}
                                                    </div>
                                                ) : <div className="h-full min-h-[40px]"></div>}
                                            </td>
                                        );
                                    })}
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-6 max-w-[1600px] mx-auto pb-32">
            
            {/* Header Area */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between mb-8 gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md">Workforce Management</span>
                        {!canManage && <span className="bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md">Staff View</span>}
                    </div>
                    <h1 className="text-3xl font-black tracking-tight">Smart Scheduler</h1>
                    <p className="text-sm text-slate-500 mt-1 font-medium">Manage clinical shifts, time-off requests, and coverage.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    {/* Perspective Toggle */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button onClick={() => setViewMode('week')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${viewMode === 'week' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Week</button>
                        <button onClick={() => setViewMode('month')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${viewMode === 'month' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Month</button>
                    </div>

                    {/* Date Navigation */}
                    <div className="flex bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-1">
                        <button onClick={handlePrev} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"><i className="fa-solid fa-chevron-left text-xs"></i></button>
                        <div className="px-4 py-1.5 font-bold text-sm flex items-center min-w-[170px] justify-center">
                            {viewMode === 'week' ? 
                                `${activeDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${activeDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` :
                                currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                            }
                        </div>
                        <button onClick={handleNext} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"><i className="fa-solid fa-chevron-right text-xs"></i></button>
                    </div>

                    {/* Time Off & Print Controls */}
                    <button onClick={() => setShowTimeOffModal(true)} className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl transition shadow-sm flex items-center gap-2">
                        <i className="fa-regular fa-calendar-xmark"></i> Request Block
                    </button>
                    <button onClick={handlePrint} className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl transition shadow-sm flex items-center gap-2">
                        <i className="fa-solid fa-print"></i> Export
                    </button>

                    {canManage && (
                        <>
                            <div className="h-6 w-px bg-slate-200 mx-1"></div>
                            {clipboardShift && (
                                <button onClick={() => setClipboardShift(null)} className="px-4 py-2 bg-rose-50 text-rose-600 font-bold text-sm rounded-xl hover:bg-rose-100 transition border border-rose-100">
                                    Cancel
                                </button>
                            )}
                            <button onClick={duplicatePriorWeek} disabled={viewMode==='month'} className="px-4 py-2 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed">
                                <i className="fa-solid fa-copy"></i> Clone
                            </button>
                            
                            {/* Notification Bell */}
                            <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center transition">
                                <i className="fa-solid fa-bell"></i>
                                {pendingRequests.length > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 items-center justify-center text-[8px] font-black text-white">{pendingRequests.length}</span>
                                    </span>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* NOTIFICATIONS DROPDOWN */}
            {showNotifications && canManage && (
                <div className="absolute right-6 mt-1 w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50"><h4 className="font-bold text-sm">Time-Off Requests</h4></div>
                    <div className="max-h-96 overflow-y-auto">
                        {pendingRequests.length === 0 ? <div className="p-6 text-center text-slate-500 font-medium text-sm">No pending requests</div> : (
                            pendingRequests.map(req => {
                                const requester = users.find(u => u.id === req.user_id) as ExtendedUser;
                                const reqName = requester?.username || requester?.full_name || 'Unknown User';
                                return (
                                    <div key={req.id} className="p-4 border-b border-slate-100 hover:bg-slate-50">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-bold text-slate-800">{reqName}</div>
                                            <div className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold">{req.start_date} to {req.end_date}</div>
                                        </div>
                                        <p className="text-xs text-slate-500 italic mb-3">"{req.reason || 'No reason provided'}"</p>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleTimeOffReview(req.id, 'approved')} className="flex-1 bg-emerald-50 text-emerald-600 font-bold text-xs py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition">Approve</button>
                                            <button onClick={() => handleTimeOffReview(req.id, 'rejected')} className="flex-1 bg-rose-50 text-rose-600 font-bold text-xs py-1.5 rounded-lg border border-rose-100 hover:bg-rose-100 transition">Reject</button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            )}

            {/* LOADING STATE */}
            {isLoading ? (
                <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
            ) : (
                <div className={viewMode === 'month' ? 'opacity-80' : ''}>
                    {providers.length > 0 && renderGrid("Clinical Providers", providers)}
                    {supportStaff.length > 0 && renderGrid("Support Staff", supportStaff)}
                </div>
            )}

            {/* AI Assistant Console */}
            {canManage && viewMode === 'week' && (
                <div className="fixed bottom-0 left-0 right-0 p-4 pointer-events-none z-50">
                    <div className="max-w-4xl mx-auto pointer-events-auto">
                        <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-4 group hover:border-indigo-500/50 transition">
                            <div className="bg-indigo-500/20 p-3 rounded-xl"><i className="fa-solid fa-wand-magic-sparkles text-indigo-400"></i></div>
                            <input 
                                type="text"
                                className="flex-1 bg-transparent border-none outline-none text-white placeholder-slate-500 font-medium text-sm"
                                placeholder="E.g. Schedule Dr. Smith 8am-5pm on Monday... (AI Integration Layer Ready)"
                                value={aiQuery}
                                onChange={e => setAiQuery(e.target.value)}
                            />
                            <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold uppercase transition">Generate</button>
                        </div>
                    </div>
                </div>
            )}

            {/* TIME OFF MODAL */}
            {showTimeOffModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <h2 className="text-xl font-black mb-4">Request Time Off / Block</h2>
                        <form onSubmit={submitTimeOff}>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Start Date</label>
                                    <input type="date" name="start_date" required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">End Date</label>
                                    <input type="date" name="end_date" required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                                </div>
                            </div>
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Reason (Optional)</label>
                                <textarea name="reason" rows={3} placeholder="Vacation, Sick leave, Medical appointment..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"></textarea>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setShowTimeOffModal(false)} className="px-4 py-2 bg-slate-100 text-slate-600 font-bold text-sm rounded-lg hover:bg-slate-200 transition">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-medical-500 text-white font-bold text-sm rounded-lg hover:bg-medical-600 transition shadow-md">Submit Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* HIDDEN PRINT DOCUMENT */}
            <div id="schedule-report-document-container" className="hidden">
                 <ScheduleReportDocument data={{
                     users: colorMappedUsers,
                     shifts,
                     timeOffRequests,
                     startDate: startDateStr,
                     endDate: endDateStr,
                     reportDate: new Date().toLocaleDateString(),
                     author: currentUser?.username || 'Unknown',
                     facilityName: 'Immediate Care Plus'
                 }} />
            </div>

            {/* SHIFT EDITOR MODAL */}
            {shiftEditor.isOpen && shiftEditor.user && shiftEditor.dateObj && (
                <div className="fixed inset-0 z-[100] grid place-items-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden relative my-auto">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-100 dark:border-slate-800/50 flex justify-between items-start">
                            <div className="flex-1">
                                <h2 className="text-xl font-black text-slate-800 dark:text-white leading-tight mb-1">
                                    {shiftEditor.shift ? 'Edit Assignment' : 'Assign Shift'}
                                </h2>
                                <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-3">
                                    {shiftEditor.dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                </p>
                                {/* Color Picker Row */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {SHIFT_COLORS.map(color => (
                                        <button 
                                            key={color} 
                                            type="button"
                                            onClick={() => {
                                                setShiftEditor(prev => ({...prev, tmpColor: color}));
                                                const newOverrides = { ...userColorOverrides, [shiftEditor.user!.id]: color };
                                                setUserColorOverrides(newOverrides);
                                                localStorage.setItem('HA_USER_COLORS', JSON.stringify(newOverrides));
                                            }}
                                            className={`w-5 h-5 rounded-full border-2 transition-all ${shiftEditor.tmpColor === color ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent hover:scale-110'} ${getThemeClasses(color).split(' ')[0]}`}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-sm ${getThemeClasses(shiftEditor.tmpColor).split(' ')[0]} ${getThemeClasses(shiftEditor.tmpColor).split(' ')[1]}`}>
                                    {(shiftEditor.user.username || shiftEditor.user.full_name || 'U').substring(0,2).toUpperCase()}
                                </div>
                            </div>
                        </div>

                        <form onSubmit={submitShiftEditor} className="p-6">
                            {/* Quick Time Presets */}
                            <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-thin">
                                <button type="button" onClick={() => setShiftEditor(prev => ({...prev, tmpStart: '10:00', tmpEnd: '20:00'}))} className="whitespace-nowrap px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 rounded-lg transition-colors">Weekday (10-8)</button>
                                <button type="button" onClick={() => setShiftEditor(prev => ({...prev, tmpStart: '10:00', tmpEnd: '18:00'}))} className="whitespace-nowrap px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 rounded-lg transition-colors">Weekend (10-6)</button>
                                <button type="button" onClick={() => setShiftEditor(prev => ({...prev, tmpStart: '10:00', tmpEnd: '16:00'}))} className="whitespace-nowrap px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 rounded-lg transition-colors">Holiday (10-4)</button>
                            </div>
                            <div className="mb-4">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Shift Date (Move)</label>
                                <input 
                                    type="date" 
                                    name="shift_date" 
                                    required 
                                    defaultValue={shiftEditor.dateObj?.toISOString().split('T')[0] || ''} 
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-5">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Start Time</label>
                                    <input 
                                        type="time" 
                                        name="start_time" 
                                        value={shiftEditor.tmpStart}
                                        onChange={e => setShiftEditor(prev => ({...prev, tmpStart: e.target.value}))}
                                        required 
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">End Time</label>
                                    <input 
                                        type="time" 
                                        name="end_time" 
                                        value={shiftEditor.tmpEnd}
                                        onChange={e => setShiftEditor(prev => ({...prev, tmpEnd: e.target.value}))}
                                        required 
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                                    />
                                </div>
                            </div>
                            
                            {!shiftEditor.shift && (
                                <div className="mb-5 bg-indigo-50/50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <div className="mt-0.5">
                                            <input type="checkbox" name="repeat_month" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-indigo-300 shadow-sm cursor-pointer" />
                                        </div>
                                        <div>
                                            <span className="text-sm font-bold text-indigo-900 dark:text-indigo-300 block mb-0.5 group-hover:text-indigo-700 transition-colors">Repeat entire month</span>
                                            <span className="text-[10px] text-indigo-500/80 leading-snug block">Automatically duplicates this exact shift for every {shiftEditor.dateObj.toLocaleDateString('en-US', { weekday: 'long' })} in this month.</span>
                                        </div>
                                    </label>
                                </div>
                            )}

                            <div className="mb-6 border-b border-slate-100 dark:border-slate-800 pb-6">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Shift Notes (Optional)</label>
                                <input 
                                    name="notes" 
                                    defaultValue={shiftEditor.shift?.notes} 
                                    placeholder="e.g. Front desk duty" 
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                                />
                            </div>

                            <div className="flex justify-between items-center">
                                <div className="flex gap-2">
                                    {shiftEditor.shift && (
                                        <>
                                            <button type="submit" name="action_type" value="delete" className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-colors shadow-sm border border-rose-100" title="Delete Shift">
                                                <i className="fa-solid fa-trash-can text-sm"></i>
                                            </button>
                                            <button type="submit" name="action_type" value="copy" className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 flex items-center justify-center transition-colors shadow-sm" title="Copy to Clipboard">
                                                <i className="fa-solid fa-copy text-sm"></i>
                                            </button>
                                        </>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setShiftEditor({ isOpen: false, user: null, dateObj: null, shift: null })} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancel</button>
                                    <button type="submit" name="action_type" value="save" className="px-5 py-2 bg-medical-500 text-white font-bold text-sm rounded-xl hover:bg-medical-600 transition-colors shadow-md shadow-medical-500/20 active:scale-[0.98]">Save Shift</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* PASTE MODE NOTIFICATION TOAST */}
            {clipboardShift && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] bg-indigo-600 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-4 animate-fade-in border border-indigo-400 font-medium">
                    <div className="flex items-center gap-2">
                        <i className="fa-solid fa-paste animate-bounce"></i>
                        <span>Paste Mode Active <span className="font-bold opacity-80 text-xs ml-1">({clipboardShift.start_time} - {clipboardShift.end_time})</span></span>
                    </div>
                    <button onClick={() => setClipboardShift(null)} className="bg-white/20 hover:bg-white/30 text-white w-7 h-7 rounded-full flex items-center justify-center transition">
                        <i className="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>
            )}

            <style>{`
                @media print {
                    @page { size: landscape; margin: 10mm; }
                    body * { visibility: hidden; }
                    #schedule-report-document-container, #schedule-report-document-container * { visibility: visible; }
                    #schedule-report-document-container { position: absolute; left: 0; top: 0; width: 100%; }
                }
            `}</style>
        </div>
    );
};
