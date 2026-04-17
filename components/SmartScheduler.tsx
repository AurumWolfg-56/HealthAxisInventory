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
    const [shiftEditor, setShiftEditor] = useState<{isOpen: boolean, user: ExtendedUser|null, dateObj: Date|null, shift: Shift|null, tmpStart?: string, tmpEnd?: string, tmpColor?: string, tmpDate?: string, applyDays?: Record<number, boolean>}>({isOpen: false, user: null, dateObj: null, shift: null, tmpStart: '08:00', tmpEnd: '17:00', tmpColor: 'blue', applyDays: {}});
    const [userColorOverrides, setUserColorOverrides] = useState<Record<string, string>>(() => {
        try { return JSON.parse(localStorage.getItem('HA_USER_COLORS') || '{}'); } catch { return {}; }
    });
    const [aiQuery, setAiQuery] = useState('');
    const [aiProcessing, setAiProcessing] = useState(false);
    
    // Modals
    const [showTimeOffModal, setShowTimeOffModal] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [activeTab, setActiveTab] = useState<'providers' | 'staff'>('providers');
    const [hoveredCell, setHoveredCell] = useState<{userId: string, date: string} | null>(null);
    const [dragTargetCell, setDragTargetCell] = useState<{userId: string, date: string} | null>(null);

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
    const handleStamp = async (dateStr: string, userId: string) => {
        if (!canManage || !clipboardShift) return;

        // Ensure not clicking on an approved time off
        const hasTimeOff = timeOffRequests.some(t => t.user_id === userId && t.status === 'approved' && t.start_date <= dateStr && t.end_date >= dateStr);
        if (hasTimeOff) {
            alert("This user has approved time off on this date.");
            return;
        }
        
        try {
            const saved = await ScheduleService.createShift({
                user_id: userId,
                date: dateStr,
                start_time: clipboardShift.start_time,
                end_time: clipboardShift.end_time,
                role_type: providers.find(p => p.id === userId) ? 'provider' : 'staff',
                notes: clipboardShift.notes
            });
            if (saved) setShifts(prev => [...prev, saved]);
        } catch (e) {
            console.error('Failed to paste shift', e);
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
        const targetUserId = fd.get('user_id') as string || currentUser!.id;
        const initialStatus = canManage ? 'approved' : 'pending';

        const saved = await ScheduleService.createTimeOffRequest({
            user_id: targetUserId,
            start_date: fd.get('start_date') as string,
            end_date: fd.get('end_date') as string,
            status: initialStatus,
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

        if (!shiftEditor.dateObj) return;

        setIsLoading(true);

        try {
            if (!start || !end) {
                 alert("Start and End times are required");
                 setIsLoading(false);
                 return;
            }

            const targetUserId = fd.get('user_id') as string || shiftEditor.user?.id;
            if (!targetUserId) {
                 alert("Please select a staff member");
                 setIsLoading(false);
                 return;
            }

            const dateStr = fd.get('shift_date') as string || shiftEditor.dateObj.toISOString().split('T')[0];
            
            const selectedUserObj = users.find(u => u.id === targetUserId);
            const baseShiftToCreate = {
                user_id: targetUserId,
                start_time: start,
                end_time: end,
                notes: notes,
                role_type: selectedUserObj?.role === 'DOCTOR' ? 'provider' as const : 'staff' as const
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
            } else if (!repeatMonth && !shiftEditor.applyDays) {
                // Create Single
                const saved = await ScheduleService.createShift({
                    ...baseShiftToCreate,
                    date: dateStr
                });
                if (saved) setShifts(prev => [...prev, saved]);
            } else {
                // Batch create for selected week days [Sun][Mon]...
                const dayOffset = shiftEditor.dateObj.getDay();
                const sunday = new Date(shiftEditor.dateObj);
                sunday.setDate(sunday.getDate() - dayOffset);
                
                const newShifts: Omit<Shift, 'id'>[] = [];
                const daysToApply = shiftEditor.applyDays ? Object.keys(shiftEditor.applyDays).filter(k => shiftEditor.applyDays![Number(k)]).map(Number) : [dayOffset];

                // Fallback to repeat month if the checkbox was somehow activated (for backward compat)
                if (repeatMonth) {
                    const year = shiftEditor.dateObj.getFullYear();
                    const month = shiftEditor.dateObj.getMonth();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    for (let day = 1; day <= daysInMonth; day++) {
                        const d = new Date(year, month, day);
                        if (d.getDay() === dayOffset) {
                            const localDStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                            newShifts.push({ ...baseShiftToCreate, date: localDStr });
                        }
                    }
                } else {
                    for (const targetDayIndex of daysToApply) {
                        const d = new Date(sunday);
                        d.setDate(sunday.getDate() + targetDayIndex);
                        const localDStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                        newShifts.push({ ...baseShiftToCreate, date: localDStr });
                    }
                }
                
                const savedArr = await ScheduleService.bulkCreateShifts(newShifts);
                if (savedArr) setShifts(prev => [...prev, ...savedArr]);
            }
            setShiftEditor({ isOpen: false, user: null, dateObj: null, shift: null, tmpStart: '10:00', tmpEnd: '18:00', tmpColor: 'blue', applyDays: {} });
        } catch (e) {
            console.error(e);
            alert("Failed to save shift");
        }
        setIsLoading(false);
    };

    const handlePrint = () => {
        window.print();
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

    const renderCalendar = () => {
        const filteredUsers = activeTab === 'providers' ? providers : supportStaff;
        const filteredUserIds = new Set(filteredUsers.map(u => u.id));
        
        return (
            <div className="mb-10 animate-fade-in-up">
                <div className="bg-white dark:bg-slate-900 shadow-sm rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="grid grid-cols-7 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                            <div key={day} className={`py-3 px-2 font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px] text-center ${idx > 0 ? 'border-l border-slate-100 dark:border-slate-800' : ''}`}>
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 auto-rows-fr">
                        {activeDates.map((d, i) => {
                            const dStr = d.toISOString().split('T')[0];
                            const dStrLocal = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                            
                            const dayShifts = shifts.filter(s => (s.date === dStr || s.date === dStrLocal) && filteredUserIds.has(s.user_id));
                            
                            // Check for stamp ghosting
                            const isDragTarget = dragTargetCell?.date === dStrLocal;
                            const isHovered = hoveredCell?.date === dStrLocal;

                            return (
                                <div 
                                    key={dStr}
                                    className={`min-h-[140px] border-b border-r border-slate-100/60 dark:border-slate-800/60 p-1.5 relative group transition-colors ${i % 7 === 6 ? 'border-r-0' : ''} ${canManage && clipboardShift ? 'cursor-cell hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20' : 'hover:bg-slate-50/40 dark:hover:bg-slate-800/40'} ${isDragTarget ? 'bg-indigo-50/50 dark:bg-indigo-900/30 shadow-inner' : ''}`}
                                    onClick={() => {
                                        if (!canManage) return;
                                        if (clipboardShift) {
                                            handleStamp(dStrLocal, clipboardShift.user_id);
                                        } else {
                                            setShiftEditor({ isOpen: true, user: null, dateObj: d, shift: null, tmpStart: '10:00', tmpEnd: '18:00', tmpColor: 'blue', tmpDate: dStrLocal, applyDays: { [d.getDay()]: true } });
                                        }
                                    }}
                                    onDragEnter={canManage ? () => setDragTargetCell({userId: '', date: dStrLocal}) : undefined}
                                    onDragLeave={canManage ? () => setDragTargetCell(null) : undefined}
                                    onMouseEnter={canManage && clipboardShift ? () => setHoveredCell({userId: '', date: dStrLocal}) : undefined}
                                    onMouseLeave={canManage && clipboardShift ? () => setHoveredCell(null) : undefined}
                                    onDragOver={canManage ? e => e.preventDefault() : undefined}
                                    onDrop={canManage ? async e => {
                                        e.preventDefault();
                                        setDragTargetCell(null);
                                        try {
                                            const dataStr = e.dataTransfer.getData('application/json');
                                            if (!dataStr) return;
                                            const data = JSON.parse(dataStr);
                                            if (data.action === 'move') {
                                                const movingShift = shifts.find(s => s.id === data.shiftId);
                                                if (movingShift && movingShift.date !== dStrLocal) {
                                                    setIsLoading(true);
                                                    const updated = await ScheduleService.updateShift(movingShift.id, { date: dStrLocal });
                                                    if (updated) {
                                                        setShifts(prev => {
                                                            const filtered = prev.filter(s => s.id !== updated.id);
                                                            return [...filtered, updated];
                                                        });
                                                    }
                                                    setIsLoading(false);
                                                }
                                            }
                                        } catch(err) {}
                                    } : undefined}
                                >
                                    <div className="flex justify-between items-center mb-1.5 px-1">
                                        <span className={`text-xs font-black ${d.getMonth() !== currentDate.getMonth() ? 'text-slate-300 dark:text-slate-600' : 'text-slate-600 dark:text-slate-300'}`}>{d.getDate()}{i < 7 && d.getDate() === 1 ? ` ${d.toLocaleDateString('en-US',{month:'short'})}` : ''}</span>
                                        {canManage && !clipboardShift && (
                                            <button className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-slate-100 hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 dark:bg-slate-800 dark:hover:bg-indigo-900/50 flex items-center justify-center text-[10px] transition-all"><i className="fa-solid fa-plus"></i></button>
                                        )}
                                    </div>
                                    
                                    <div className="flex flex-col gap-1 overflow-y-auto max-h-[110px] scrollbar-thin">
                                        {dayShifts.map(shift => {
                                            const u = filteredUsers.find(user => user.id === shift.user_id) as ExtendedUser;
                                            if (!u) return null;
                                            
                                            const timeOff = timeOffRequests.find(t => t.user_id === u.id && t.status === 'approved' && t.start_date <= dStrLocal && t.end_date >= dStrLocal);

                                            return timeOff ? (
                                                <div key={`off-${shift.id}`} className="w-full p-1 rounded-md border border-red-200 bg-[repeat-x_repeating-linear-gradient(45deg,theme(colors.red.50),theme(colors.red.50)_10px,transparent_10px,transparent_20px)] flex items-center justify-center">
                                                    <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[8px] font-black uppercase rounded shadow-sm truncate max-w-full">{u.username || u.full_name} Off</span>
                                                </div>
                                            ) : (
                                                <div 
                                                    key={shift.id}
                                                    draggable={canManage}
                                                    onDragStart={e => {
                                                        e.stopPropagation();
                                                        e.dataTransfer.setData('application/json', JSON.stringify({ action: 'move', shiftId: shift.id }));
                                                    }}
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        if (!canManage) return;
                                                        const applyDaysMap: Record<number, boolean> = {};
                                                        applyDaysMap[d.getDay()] = true;
                                                        setShiftEditor({ isOpen: true, user: u, dateObj: d, shift, tmpStart: shift.start_time, tmpEnd: shift.end_time, tmpDate: shift.date, applyDays: applyDaysMap });
                                                    }}
                                                    className={`p-1.5 rounded-md border-l-[3px] shrink-0 text-left transition-all ${getThemeClasses(userColorOverrides[u.id] || u.themeColor || 'blue')} ${canManage ? 'cursor-grab active:cursor-grabbing hover:brightness-95 dark:hover:brightness-110' : ''}`}
                                                >
                                                    <div className="font-bold text-[10px] leading-tight truncate mb-0.5">{u.username || u.full_name?.split(' ')[0]}</div>
                                                    <div className="text-[9px] font-medium leading-none opacity-90 truncate">{formatTime(shift.start_time)}-{formatTime(shift.end_time)}</div>
                                                    {clipboardShift?.id === shift.id && <div className="absolute top-1 right-1 animate-pulse"><i className="fa-solid fa-copy opacity-50 text-[10px]"></i></div>}
                                                </div>
                                            );
                                        })}

                                        {/* Ghost Cell Preview */}
                                        {canManage && clipboardShift && isHovered && (
                                            <div className={`p-1.5 rounded-md border-l-[3px] shrink-0 border-dashed opacity-50 scale-95 origin-top transition-all outline-dashed outline-1 outline-indigo-400 relative ${getThemeClasses(userColorOverrides[clipboardShift.user_id] || 'blue')}`}>
                                                <div className="font-bold text-[10px] leading-tight truncate mb-0.5">Paste Shift</div>
                                                <div className="text-[9px] font-medium leading-none opacity-90 truncate">{formatTime(clipboardShift.start_time)}-{formatTime(clipboardShift.end_time)}</div>
                                                <div className="absolute top-1 right-1"><i className="fa-solid fa-stamp opacity-50"></i></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto pb-32">
            
            {/* Header Area */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between mb-8 gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md">Workforce Management</span>
                        {!canManage && <span className="bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md">Staff View</span>}
                    </div>
                    <h1 className="text-xl md:text-3xl font-black tracking-tight">Smart Scheduler</h1>
                    <p className="text-sm text-slate-500 mt-1 font-medium mb-3">Manage clinical shifts, time-off requests, and coverage.</p>
                    {canManage && <div className="inline-flex items-center gap-2 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-indigo-100/50 dark:border-indigo-800/30 shadow-sm"><i className="fa-solid fa-lightbulb text-amber-400"></i> Pro Tip: You can Drag & Drop shifts directly to move them or reassign to another staff member.</div>}
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
                                <div className="flex items-center gap-2 bg-indigo-600 text-white pl-4 pr-1.5 py-1.5 rounded-xl shadow-lg border border-indigo-500 animate-fade-in">
                                    <i className="fa-solid fa-stamp animate-bounce text-sm" />
                                    <span className="text-xs font-bold mr-1">Stamp Mode Active</span>
                                    <button onClick={() => setClipboardShift(null)} className="hover:bg-rose-500 bg-rose-400 text-white rounded-lg px-2.5 py-1 flex items-center justify-center transition ml-1" title="Cancel Stamp Mode">
                                        <i className="fa-solid fa-xmark text-sm"></i>
                                    </button>
                                </div>
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
                <div className={`mt-6 ${viewMode === 'month' ? 'opacity-90' : ''} print:hidden`}>
                    {/* TABS FOR VIEWS */}
                    <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 gap-6 px-4">
                        <button 
                            onClick={() => setActiveTab('providers')}
                            className={`pb-3 text-sm font-black transition-all ${activeTab === 'providers' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Clinical <span className="ml-1 text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{providers.length}</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('staff')}
                            className={`pb-3 text-sm font-black transition-all ${activeTab === 'staff' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Support Staff <span className="ml-1 text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{supportStaff.length}</span>
                        </button>
                    </div>

                    <div className="animate-fade-in px-2">
                        {renderCalendar()}
                    </div>
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
                            {canManage && (
                                <div className="mb-4">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Staff Member</label>
                                    <select name="user_id" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 font-bold text-slate-700">
                                        <option value={currentUser!.id}>Myself</option>
                                        {users.filter(u => u.id !== currentUser!.id).map(u => (
                                            <option key={u.id} value={u.id}>{u.username || u.full_name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
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

            {/* NATIVE CSS PRINT DOCUMENT */}
            <div id="schedule-report-document-container" className="hidden print:block absolute inset-0 w-full min-h-screen bg-white z-[999]">
                 <ScheduleReportDocument data={{
                     users: colorMappedUsers.filter(u => activeTab === 'providers' ? ['DOCTOR'].includes(u.role) : ['MANAGER', 'OWNER', 'MA', 'FRONT_DESK'].includes(u.role)),
                     shifts,
                     timeOffRequests,
                     startDate: startDateStr,
                     endDate: endDateStr,
                     reportDate: new Date().toLocaleDateString(),
                     author: currentUser?.username || 'Unknown',
                     facilityName: 'Immediate Care Plus'
                 }} />
            </div>

            {/* SHIFT EDITOR MODAL (POPOVER STYLE) */}
            {shiftEditor.isOpen && shiftEditor.dateObj && (
                <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm animate-fade-in flex items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col relative overflow-hidden">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 border-b border-slate-100 dark:border-slate-800/50">
                            <h2 className="text-xl font-black text-slate-800 dark:text-white leading-tight mb-1">
                                {shiftEditor.shift ? 'Edit Assignment' : 'Assign Shift'}
                            </h2>
                            <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
                                {shiftEditor.tmpDate ? new Date(shiftEditor.tmpDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : shiftEditor.dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                            </p>
                        </div>

                        <form onSubmit={submitShiftEditor} className="p-5">
                            {/* Employee Selector */}
                            <div className="mb-4">
                                <select 
                                    name="user_id" 
                                    defaultValue={shiftEditor.user?.id || ''}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
                                    onChange={(e) => {
                                        const u = users.find(user => user.id === e.target.value);
                                        if (u) {
                                            setShiftEditor(prev => ({ ...prev, user: u as ExtendedUser, tmpColor: userColorOverrides[u.id] || u.themeColor || 'blue'}));
                                        }
                                    }}
                                >
                                    <option value="" disabled>Select Employee</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.username || u.full_name} ({(u.role || '').replace('_', ' ').toLowerCase()})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div>
                                    <input 
                                        type="time" 
                                        name="start_time" 
                                        value={shiftEditor.tmpStart}
                                        onChange={e => setShiftEditor(prev => ({...prev, tmpStart: e.target.value}))}
                                        required 
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200"
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-slate-400 font-bold">-</span>
                                    <input 
                                        type="time" 
                                        name="end_time" 
                                        value={shiftEditor.tmpEnd}
                                        onChange={e => setShiftEditor(prev => ({...prev, tmpEnd: e.target.value}))}
                                        required 
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200"
                                    />
                                </div>
                            </div>

                            {/* Color & Presets */}
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-1">
                                    {SHIFT_COLORS.slice(0, 5).map(color => (
                                        <button 
                                            key={color} 
                                            type="button"
                                            onClick={() => {
                                                setShiftEditor(prev => ({...prev, tmpColor: color}));
                                                if (shiftEditor.user) {
                                                    const newOverrides = { ...userColorOverrides, [shiftEditor.user.id]: color };
                                                    setUserColorOverrides(newOverrides);
                                                    localStorage.setItem('HA_USER_COLORS', JSON.stringify(newOverrides));
                                                }
                                            }}
                                            className={`w-5 h-5 rounded-full border-2 transition-all ${shiftEditor.tmpColor === color ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent hover:scale-110'} ${getThemeClasses(color).split(' ')[0]}`}
                                        />
                                    ))}
                                </div>
                                <div className="flex gap-1">
                                    <button type="button" onClick={() => setShiftEditor(prev => ({...prev, tmpStart: '10:00', tmpEnd: '20:00'}))} className="px-2 py-1 bg-slate-100 text-[9px] font-bold uppercase rounded text-slate-500">10-8</button>
                                    <button type="button" onClick={() => setShiftEditor(prev => ({...prev, tmpStart: '10:00', tmpEnd: '18:00'}))} className="px-2 py-1 bg-slate-100 text-[9px] font-bold uppercase rounded text-slate-500">10-6</button>
                                </div>
                            </div>

                            {/* Apply Days Multi-Select */}
                            {!shiftEditor.shift && (
                                <div className="mb-5">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Apply to:</label>
                                    <div className="flex justify-between">
                                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, dIdx) => {
                                            const isActive = shiftEditor.applyDays?.[dIdx];
                                            return (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    onClick={() => {
                                                        setShiftEditor(prev => {
                                                            const newDays = { ...prev.applyDays };
                                                            newDays[dIdx] = !newDays[dIdx];
                                                            return { ...prev, applyDays: newDays };
                                                        });
                                                    }}
                                                    className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-black tracking-tighter transition-all ${isActive ? 'bg-indigo-600 text-white shadow-md scale-110' : 'bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100'}`}
                                                >
                                                    {day}
                                                </button>
                                            )
                                        })}
                                    </div>
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
                                            <button 
                                                type="button" 
                                                title="Delete Shift"
                                                onClick={async () => {
                                                    setIsLoading(true);
                                                    await ScheduleService.deleteShift(shiftEditor.shift!.id);
                                                    setShifts(prev => prev.filter(s => s.id !== shiftEditor.shift!.id));
                                                    setShiftEditor({ isOpen: false, user: null, dateObj: null, shift: null });
                                                    setIsLoading(false);
                                                }}
                                                className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-colors shadow-sm border border-rose-100">
                                                <i className="fa-solid fa-trash-can text-sm"></i>
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    setClipboardShift(shiftEditor.shift!);
                                                    setShiftEditor({ isOpen: false, user: null, dateObj: null, shift: null });
                                                }}
                                                className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold text-xs flex items-center gap-2 transition-colors shadow-sm border border-indigo-100 h-10">
                                                <i className="fa-solid fa-stamp text-sm"></i> Stamp Mode
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
