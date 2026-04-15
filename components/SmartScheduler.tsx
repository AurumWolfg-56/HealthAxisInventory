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
            themeColor: u.themeColor || SHIFT_COLORS[i % SHIFT_COLORS.length]
        }));
    }, [users]);
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
        if (existingShift) {
            const action = window.prompt(`Options:\n1. Copy\n2. Delete\n3. Edit time (HH:MM-HH:MM)`);
            if (action === '1') setClipboardShift(existingShift);
            else if (action === '2') {
                await ScheduleService.deleteShift(existingShift.id);
                setShifts(prev => prev.filter(s => s.id !== existingShift.id));
            } else if (action === '3') {
                const newTime = window.prompt('Enter new time e.g., 08:00-17:00');
                if (newTime && newTime.includes('-')) {
                    const [start, end] = newTime.split('-');
                    const updated = await ScheduleService.updateShift(existingShift.id, { start_time: start.trim(), end_time: end.trim() });
                    if (updated) setShifts(prev => prev.map(s => s.id === updated.id ? updated : s));
                }
            }
        } else {
            const timeStr = window.prompt("Enter Shift Time (e.g., 08:00-17:00)");
            if (timeStr && timeStr.includes('-')) {
                const [start, end] = timeStr.split('-');
                const saved = await ScheduleService.createShift({
                    user_id: user.id,
                    date: dateStr,
                    start_time: start.trim(),
                    end_time: end.trim(),
                    role_type: providers.find(p => p.id === user.id) ? 'provider' : 'staff'
                });
                if (saved) setShifts(prev => [...prev, saved]);
            }
        }
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
    const getThemeClasses = (colorName: string) => {
        const map: any = {
            blue: 'bg-blue-50/50 text-blue-700 border-l-blue-500',
            emerald: 'bg-emerald-50/50 text-emerald-700 border-l-emerald-500',
            rose: 'bg-rose-50/50 text-rose-700 border-l-rose-500',
            amber: 'bg-amber-50/50 text-amber-700 border-l-amber-500',
            purple: 'bg-purple-50/50 text-purple-700 border-l-purple-500',
            indigo: 'bg-indigo-50/50 text-indigo-700 border-l-indigo-500',
            teal: 'bg-teal-50/50 text-teal-700 border-l-teal-500',
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
                                                        <div className="font-bold tracking-tight text-[11px] leading-none mb-1">{shift.start_time}</div>
                                                        <div className="font-bold tracking-tight text-[11px] leading-none opacity-80">{shift.end_time}</div>
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
