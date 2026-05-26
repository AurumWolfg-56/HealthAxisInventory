import React from 'react';
import { User, Shift, TimeOffRequest } from '../types';

interface ScheduleReportDocumentProps {
    data: {
        users: User[];
        shifts: Shift[];
        timeOffRequests: TimeOffRequest[];
        startDate: string; // YYYY-MM-DD
        endDate: string; // YYYY-MM-DD
        reportDate: string;
        author: string;
        facilityName: string;
        viewType?: 'providers' | 'staff' | 'all';
    };
}

interface PrintTheme {
    bg: string;
    border: string;
    text: string;
    timeText: string;
}

const getPrintTheme = (colorName: string): PrintTheme => {
    const map: Record<string, PrintTheme> = {
        blue: {
            bg: '#eff6ff',
            border: '#3b82f6',
            text: '#1e3a8a',
            timeText: '#2563eb'
        },
        emerald: {
            bg: '#ecfdf5',
            border: '#10b981',
            text: '#064e3b',
            timeText: '#059669'
        },
        rose: {
            bg: '#fff1f2',
            border: '#f43f5e',
            text: '#881337',
            timeText: '#e11d48'
        },
        amber: {
            bg: '#fffbeb',
            border: '#f59e0b',
            text: '#78350f',
            timeText: '#d97706'
        },
        purple: {
            bg: '#faf5ff',
            border: '#a855f7',
            text: '#581c87',
            timeText: '#9333ea'
        },
        indigo: {
            bg: '#eef2ff',
            border: '#6366f1',
            text: '#312e81',
            timeText: '#4f46e5'
        },
        teal: {
            bg: '#f0fdfa',
            border: '#14b8a6',
            text: '#115e59',
            timeText: '#0d9488'
        },
        cyan: {
            bg: '#ecfeff',
            border: '#06b6d4',
            text: '#164e63',
            timeText: '#0891b2'
        },
        fuchsia: {
            bg: '#fdf4ff',
            border: '#d946ef',
            text: '#701a75',
            timeText: '#c084fc'
        },
        orange: {
            bg: '#fff7ed',
            border: '#f97316',
            text: '#7c2d12',
            timeText: '#ea580c'
        },
        pink: {
            bg: '#fdf2f8',
            border: '#ec4899',
            text: '#9d174d',
            timeText: '#db2777'
        },
        sky: {
            bg: '#f0f9ff',
            border: '#0ea5e9',
            text: '#075985',
            timeText: '#0284c7'
        },
        violet: {
            bg: '#f5f3ff',
            border: '#8b5cf6',
            text: '#5b21b6',
            timeText: '#7c3aed'
        },
        lime: {
            bg: '#f7fee7',
            border: '#84cc16',
            text: '#3f6212',
            timeText: '#65a30d'
        },
        red: {
            bg: '#fef2f2',
            border: '#ef4444',
            text: '#991b1b',
            timeText: '#dc2626'
        },
        slate: {
            bg: '#f8fafc',
            border: '#64748b',
            text: '#334155',
            timeText: '#475569'
        }
    };
    return map[colorName] || map['blue'];
};

export const ScheduleReportDocument: React.FC<ScheduleReportDocumentProps> = ({ data }) => {
    const { users, shifts, timeOffRequests, startDate, endDate, reportDate, author, facilityName, viewType } = data;

    // Parse date range without UTC offset shifting
    const [sYr, sMo, sDa] = startDate.split('-').map(Number);
    const [eYr, eMo, eDa] = endDate.split('-').map(Number);
    
    const sDate = new Date(sYr, sMo - 1, sDa);
    const eDate = new Date(eYr, eMo - 1, eDa);
    
    const dates: Date[] = [];
    const current = new Date(sDate);
    while (current <= eDate) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }

    const providers = users.filter(u => ['DOCTOR', 'OWNER'].includes(u.role));
    const supportStaff = users.filter(u => ['MANAGER', 'MA', 'FRONT_DESK'].includes(u.role));

    // UI helper for time formatting
    const formatTime = (timeStr: string) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':');
        const d = new Date();
        d.setHours(parseInt(h), parseInt(m));
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    };

    // Compact time format for calendar cells (saves space)
    const formatCompactTime = (timeStr: string) => {
        if (!timeStr) return '';
        const [hStr, mStr] = timeStr.split(':');
        const h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10);
        const ampm = h >= 12 ? 'p' : 'a';
        const hour12 = h % 12 || 12;
        const minStr = m === 0 ? '' : `:${String(m).padStart(2, '0')}`;
        return `${hour12}${minStr}${ampm}`;
    };

    // Calculate duration in hours
    const getShiftHours = (s: Shift) => {
        if (!s.start_time || !s.end_time) return 0;
        const sStart = new Date(`1970-01-01T${s.start_time}`);
        let sEnd = new Date(`1970-01-01T${s.end_time}`);
        if (sEnd.getTime() < sStart.getTime()) {
            sEnd = new Date(`1970-01-02T${s.end_time}`); // overnight shift
        }
        return (sEnd.getTime() - sStart.getTime()) / (1000 * 60 * 60);
    };

    const formatWeekRange = (weekDates: Date[]) => {
        if (weekDates.length === 0) return '';
        const first = weekDates[0];
        const last = weekDates[weekDates.length - 1];
        
        const options1: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
        const options2: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
        
        return `${first.toLocaleDateString('en-US', options1)} - ${last.toLocaleDateString('en-US', options2)}`;
    };

    // Primary month selection for Month Calendar view
    const primaryMonthIndex = sDate.getDate() > 15 ? (sDate.getMonth() + 1) % 12 : sDate.getMonth();
    const primaryMonthName = new Date(sDate.getFullYear(), primaryMonthIndex, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();

    const renderUserRow = (u: User, index: number, weekDates: Date[]) => {
        const displayName = u.username || (u as any).full_name || 'Unknown';
        return (
            <tr key={u.id} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                {/* Staff Member Info Column */}
                <td style={{ 
                    padding: '10px 12px', 
                    borderBottom: '1px solid #cbd5e1',
                    borderLeft: '1px solid #cbd5e1',
                    borderRight: '1px solid #cbd5e1',
                    fontWeight: 'bold', 
                    color: '#334155',
                    verticalAlign: 'middle',
                    textAlign: 'left',
                    width: '160px'
                }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b' }}>{displayName}</div>
                    <div style={{ 
                        display: 'inline-block',
                        fontSize: '7.5px', 
                        color: '#475569', 
                        backgroundColor: '#e2e8f0',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        textTransform: 'uppercase', 
                        marginTop: '4px', 
                        fontWeight: '700',
                        letterSpacing: '0.03em'
                    }}>
                        {(u.role || '').replace('_', ' ')}
                    </div>
                </td>
                
                {/* Dates Columns */}
                {weekDates.map(d => {
                    const dStrLocal = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                    
                    const shift = shifts.find(s => s.user_id === u.id && s.date === dStrLocal);
                    const timeOff = timeOffRequests.find(t => t.user_id === u.id && t.status === 'approved' && t.start_date <= dStrLocal && t.end_date >= dStrLocal);

                    return (
                        <td key={d.toISOString()} style={{ 
                            padding: '6px 6px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #cbd5e1',
                            borderRight: '1px solid #cbd5e1',
                            verticalAlign: 'middle',
                            backgroundColor: d.getDay() === 0 || d.getDay() === 6 ? '#f8fafc' : '#ffffff'
                        }}>
                            {timeOff ? (
                                <div style={{ 
                                    backgroundColor: '#fff1f2', 
                                    borderLeft: '4px solid #f43f5e',
                                    borderRadius: '4px', 
                                    padding: '6px 8px', 
                                    fontSize: '9px', 
                                    textAlign: 'left',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                    margin: '2px 0'
                                }}>
                                    <div style={{ color: '#9f1239', fontWeight: '800', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                        🚫 OFF
                                    </div>
                                    <div style={{ 
                                        fontSize: '7.5px', 
                                        color: '#9f1239', 
                                        fontWeight: '500', 
                                        marginTop: '3px',
                                        fontStyle: 'italic',
                                        lineHeight: '1.2',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }} title={timeOff.reason || 'Approved'}>
                                        {timeOff.reason || 'Approved'}
                                    </div>
                                </div>
                            ) : shift ? (
                                <div style={{ 
                                    backgroundColor: getPrintTheme(u.themeColor || 'blue').bg, 
                                    borderLeft: `4px solid ${getPrintTheme(u.themeColor || 'blue').border}`,
                                    borderRadius: '4px', 
                                    padding: '6px 8px', 
                                    fontSize: '9px', 
                                    textAlign: 'left',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                    margin: '2px 0'
                                }}>
                                    <div style={{ color: getPrintTheme(u.themeColor || 'blue').text, fontWeight: '800', fontSize: '9.5px', whiteSpace: 'nowrap' }}>
                                        {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                                    </div>
                                    {shift.notes && (
                                        <div style={{ 
                                            fontSize: '7.5px', 
                                            color: '#475569', 
                                            fontWeight: '500', 
                                            marginTop: '3px',
                                            fontStyle: 'italic',
                                            lineHeight: '1.2',
                                            wordBreak: 'break-word',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden'
                                        }} title={shift.notes}>
                                            {shift.notes}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ color: '#cbd5e1', fontWeight: '300', fontSize: '12px' }}>-</div>
                            )}
                        </td>
                    );
                })}
            </tr>
        );
    };

    // Render Month Grid View if date range is longer than 7 days (usually 42 days)
    if (dates.length > 7) {
        const weekRows: Date[][] = [];
        for (let i = 0; i < dates.length; i += 7) {
            weekRows.push(dates.slice(i, i + 7));
        }

        // Calibrate primary month limits
        const primaryYear = sDate.getDate() > 15 && sDate.getMonth() === 11 ? sDate.getFullYear() + 1 : sDate.getFullYear();

        // Metrics for the primary month only, filtered by active users
        const primaryMonthShifts = shifts.filter(s => {
            const [y, m, d] = s.date.split('-').map(Number);
            const sDateObj = new Date(y, m - 1, d);
            return sDateObj.getMonth() === primaryMonthIndex &&
                   sDateObj.getFullYear() === primaryYear &&
                   users.some(u => u.id === s.user_id);
        });
        
        const activeStaffCount = new Set(primaryMonthShifts.map(s => s.user_id)).size;
        const monthTotalHours = primaryMonthShifts.reduce((sum, s) => sum + getShiftHours(s), 0);
        
        // Calculate understaffed days and total hours short based on the 10h/8h rules in the primary month
        let understaffedDaysCount = 0;
        let totalUncoveredHours = 0;

        // Get all days in the primary month
        const daysInMonth: Date[] = [];
        const tempDate = new Date(primaryYear, primaryMonthIndex, 1);
        while (tempDate.getMonth() === primaryMonthIndex) {
            daysInMonth.push(new Date(tempDate));
            tempDate.setDate(tempDate.getDate() + 1);
        }

        daysInMonth.forEach(d => {
            const dStrLocal = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const dayShifts = shifts.filter(s => s.date === dStrLocal && users.some(u => u.id === s.user_id));
            const dayScheduledHours = dayShifts.reduce((sum, s) => sum + getShiftHours(s), 0);
            
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const requiredHours = isWeekend ? 8 : 10;

            if (dayScheduledHours < requiredHours) {
                understaffedDaysCount++;
                totalUncoveredHours += (requiredHours - dayScheduledHours);
            }
        });

        const cellHeight = weekRows.length === 6 ? 90 : 108;

        return (
            <div id="schedule-report-document" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <style dangerouslySetInnerHTML={{ __html: `
                    @media print {
                        body {
                            background-color: #ffffff !important;
                            color: #0f172a !important;
                        }
                        #schedule-report-document-container {
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 297mm !important;
                            background-color: #ffffff !important;
                            z-index: 9999 !important;
                        }
                        .month-page {
                            width: 297mm !important;
                            height: 210mm !important;
                            min-height: 210mm !important;
                            padding: 10mm 12mm !important;
                        }
                        tr {
                            page-break-inside: avoid !important;
                            break-inside: avoid !important;
                        }
                        * {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                    }
                    .month-page {
                        box-sizing: border-box;
                        background-color: #ffffff;
                        width: 1122px;
                        height: 793px;
                        padding: 24px 32px 48px 32px;
                        margin: 0;
                        position: relative;
                        overflow: hidden;
                    }
                `}} />

                <div className="month-page">
                    {/* Header Strip */}
                    <div style={{ 
                        backgroundColor: '#0f172a', 
                        color: '#ffffff', 
                        padding: '14px 20px', 
                        borderRadius: '6px', 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', color: '#ffffff' }}>
                                Immediate Care <span style={{ color: '#38bdf8' }}>Plus</span>
                            </h1>
                            <span style={{ fontSize: '7.5px', fontWeight: 'bold', color: '#94a3b8', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '3px' }}>
                                {viewType === 'providers' ? 'Clinical Providers Calendar' : viewType === 'staff' ? 'Support Staff Calendar' : 'Official Operations Calendar'}
                            </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '7.5px', fontWeight: 'bold', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {facilityName || 'Immediate Care Plus'}
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: '800', color: '#ffffff', marginTop: '2px' }}>
                                {primaryMonthName}
                            </div>
                        </div>
                    </div>

                    {/* Meta Bar */}
                    <div style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '8px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: '#64748b',
                        marginTop: '8px'
                    }}>
                        <div>Period: <span style={{ color: '#0ea5e9' }}>{startDate} to {endDate}</span></div>
                        <div>Generated By: <span style={{ color: '#0f172a' }}>{author}</span></div>
                        <div>Timestamp: <span style={{ color: '#0f172a' }}>{reportDate} {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span></div>
                    </div>

                    {/* Dashboard KPIs Strip */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                        <div style={{
                            flex: 1,
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}>
                            <span style={{ fontSize: '12px' }}>👥</span>
                            <div>
                                <div style={{ fontSize: '7.5px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                    {viewType === 'providers' ? 'Scheduled Providers' : 'Scheduled Staff'}
                                </div>
                                <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>{activeStaffCount} Active</div>
                            </div>
                        </div>

                        <div style={{
                            flex: 1,
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}>
                            <span style={{ fontSize: '12px' }}>⏱️</span>
                            <div>
                                <div style={{ fontSize: '7.5px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Hours</div>
                                <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>{monthTotalHours.toFixed(1)} hrs</div>
                            </div>
                        </div>

                        <div style={{
                            flex: 1.2,
                            backgroundColor: understaffedDaysCount === 0 ? '#f0fdf4' : '#fffbeb',
                            border: understaffedDaysCount === 0 ? '1px solid #bbf7d0' : '1px solid #fde68a',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}>
                            <span style={{ fontSize: '12px' }}>{understaffedDaysCount === 0 ? '🛡️' : '⚠️'}</span>
                            <div>
                                <div style={{ fontSize: '7.5px', color: understaffedDaysCount === 0 ? '#166534' : '#92400e', fontWeight: 'bold', textTransform: 'uppercase' }}>Coverage Status</div>
                                <div style={{ fontSize: '11px', fontWeight: '800', color: understaffedDaysCount === 0 ? '#14532d' : '#78350f' }}>
                                    {understaffedDaysCount === 0 
                                        ? (viewType === 'providers' ? 'Fully Provider Staffed' : 'Fully Staffed') 
                                        : `Understaffed: ${understaffedDaysCount} Days (${totalUncoveredHours.toFixed(0)} hrs short)`
                                    }
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Calendar Grid Table */}
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', margin: '12px 0 0 0' }}>
                        <thead>
                            <tr>
                                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((dayName, dayIdx) => (
                                    <th key={dayName} style={{
                                        padding: '5px',
                                        backgroundColor: '#0f172a',
                                        color: '#ffffff',
                                        fontSize: '8.5px',
                                        fontWeight: '800',
                                        textAlign: 'center',
                                        borderTop: '1px solid #334155',
                                        borderBottom: '1px solid #334155',
                                        borderRight: '1px solid #334155',
                                        borderLeft: dayIdx === 0 ? '1px solid #334155' : 'none',
                                        letterSpacing: '0.05em'
                                    }}>
                                        {dayName}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {weekRows.map((weekDates, weekIdx) => (
                                <tr key={weekIdx} style={{ height: `${cellHeight}px` }}>
                                    {weekDates.map((d, dayIdx) => {
                                        const dStrLocal = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                                        const dayShifts = shifts.filter(s => s.date === dStrLocal && users.some(u => u.id === s.user_id));
                                        const dayTimeOffs = timeOffRequests.filter(t => t.status === 'approved' && t.start_date <= dStrLocal && t.end_date >= dStrLocal && users.some(u => u.id === t.user_id));
                                        
                                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                        const isDayInPrimaryMonth = d.getMonth() === primaryMonthIndex;
                                        const isUncovered = viewType === 'providers' && isDayInPrimaryMonth && dayShifts.length === 0;

                                        return (
                                            <td key={d.toISOString()} style={{
                                                borderBottom: '1px solid #cbd5e1',
                                                borderRight: '1px solid #cbd5e1',
                                                borderLeft: dayIdx === 0 ? '1px solid #cbd5e1' : 'none',
                                                padding: '4px 6px',
                                                verticalAlign: 'top',
                                                backgroundColor: isUncovered
                                                    ? '#fef2f2'
                                                    : !isDayInPrimaryMonth
                                                        ? (isWeekend ? '#f1f5f9' : '#f8fafc')
                                                        : (isWeekend ? '#f8fafc' : '#ffffff'),
                                                height: `${cellHeight}px`,
                                                position: 'relative',
                                                boxSizing: 'border-box'
                                            }}>
                                                <div style={{ 
                                                    display: 'flex', 
                                                    justifyContent: 'space-between', 
                                                    alignItems: 'center', 
                                                    marginBottom: '3px' 
                                                }}>
                                                    <span style={{ 
                                                        fontSize: '10.5px', 
                                                        fontWeight: '800', 
                                                        color: isUncovered
                                                            ? '#991b1b'
                                                            : isDayInPrimaryMonth 
                                                                ? '#1e293b' 
                                                                : '#94a3b8' 
                                                    }}>
                                                        {d.getDate()}
                                                    </span>
                                                    {d.getDate() === 1 && (
                                                        <span style={{ 
                                                            fontSize: '7px', 
                                                            fontWeight: '800', 
                                                            color: isUncovered ? '#b91c1c' : '#64748b', 
                                                            textTransform: 'uppercase' 
                                                        }}>
                                                            {d.toLocaleDateString('en-US', { month: 'short' })}
                                                        </span>
                                                    )}
                                                </div>

                                                {isUncovered && (
                                                    <div style={{
                                                        backgroundColor: '#fee2e2',
                                                        border: '1px solid #fca5a5',
                                                        color: '#991b1b',
                                                        borderRadius: '3px',
                                                        padding: '2px 4px',
                                                        fontSize: '8px',
                                                        fontWeight: '800',
                                                        textAlign: 'center',
                                                        marginTop: '4px'
                                                    }}>
                                                        ⚠️ UNCOVERED
                                                    </div>
                                                )}

                                                <div style={{ display: 'block' }}>
                                                    {dayShifts.map(s => {
                                                        const u = users.find(user => user.id === s.user_id);
                                                        if (!u) return null;
                                                        const theme = getPrintTheme(u.themeColor || 'blue');
                                                        const uName = u.username || (u as any).full_name || 'Unknown';
                                                        return (
                                                            <div key={s.id} style={{
                                                                backgroundColor: theme.bg,
                                                                borderLeft: `3px solid ${theme.border}`,
                                                                borderRadius: '3px',
                                                                padding: '2px 4px',
                                                                fontSize: '8px',
                                                                fontWeight: '700',
                                                                color: theme.text,
                                                                display: 'block',
                                                                marginBottom: '2px',
                                                                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                                                textAlign: 'left',
                                                                boxSizing: 'border-box',
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                lineHeight: '1.2'
                                                            }} title={`${uName}: ${formatCompactTime(s.start_time)} - ${formatCompactTime(s.end_time)}`}>
                                                                <span style={{ fontWeight: '800' }}>{uName}</span>
                                                                <span style={{ fontSize: '7.5px', opacity: 0.85, marginLeft: '3px' }}>
                                                                    ({formatCompactTime(s.start_time)}-{formatCompactTime(s.end_time)})
                                                                </span>
                                                            </div>
                                                        );
                                                    })}

                                                    {dayTimeOffs.map(t => {
                                                        const u = users.find(user => user.id === t.user_id);
                                                        if (!u) return null;
                                                        const uName = u.username || (u as any).full_name || 'Unknown';
                                                        return (
                                                            <div key={t.id} style={{
                                                                backgroundColor: '#fff1f2',
                                                                borderLeft: '3px solid #f43f5e',
                                                                borderRadius: '3px',
                                                                padding: '2px 4px',
                                                                fontSize: '8px',
                                                                fontWeight: '700',
                                                                color: '#9f1239',
                                                                display: 'block',
                                                                marginBottom: '2px',
                                                                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                                                textAlign: 'left',
                                                                boxSizing: 'border-box',
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                lineHeight: '1.2'
                                                            }} title={`${uName} Off: ${t.reason || 'Approved'}`}>
                                                                <span style={{ fontWeight: '800' }}>🚫 {uName}</span>
                                                                <span style={{ fontSize: '7.5px', opacity: 0.85, marginLeft: '3px' }}>
                                                                    ({t.reason || 'Off'})
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Footer */}
                    <div style={{
                        position: 'absolute',
                        bottom: '24px',
                        left: '32px',
                        right: '32px',
                        paddingTop: '8px',
                        borderTop: '1px solid #f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '7.5px',
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                        fontWeight: 'bold',
                        letterSpacing: '0.05em'
                    }}>
                        <div>CONFIDENTIAL - FOR INTERNAL USE ONLY</div>
                        <div>Page 1 of 1</div>
                    </div>
                </div>
            </div>
        );
    } else {
        // Week Roster View (existing weekly paginated layout)
        const combinedUsers = [
            ...providers.map(u => ({ ...u, isProvider: true })),
            ...supportStaff.map(u => ({ ...u, isProvider: false }))
        ];

        const USERS_PER_PAGE = 8;
        const userChunks: typeof combinedUsers[] = [];
        if (combinedUsers.length === 0) {
            userChunks.push([]);
        } else {
            for (let i = 0; i < combinedUsers.length; i += USERS_PER_PAGE) {
                userChunks.push(combinedUsers.slice(i, i + USERS_PER_PAGE));
            }
        }
        
        const totalPages = userChunks.length;

        return (
            <div id="schedule-report-document" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <style dangerouslySetInnerHTML={{ __html: `
                    @media print {
                        body {
                            background-color: #ffffff !important;
                            color: #0f172a !important;
                        }
                        #schedule-report-document-container {
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 297mm !important;
                            background-color: #ffffff !important;
                            z-index: 9999 !important;
                        }
                        * {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .weekly-page {
                            width: 297mm !important;
                            height: 210mm !important;
                            min-height: 210mm !important;
                            padding: 10mm 12mm !important;
                        }
                    }
                    
                    .weekly-page {
                        box-sizing: border-box;
                        background-color: #ffffff;
                        width: 1122px;
                        height: 793px;
                        padding: 24px 32px 48px 32px;
                        margin: 0;
                        position: relative;
                        overflow: hidden;
                        page-break-after: always;
                        break-after: page;
                    }
                    .weekly-page:last-child {
                        page-break-after: auto;
                        break-after: auto;
                    }
                `}} />

                {userChunks.map((userChunk, pageIdx) => {
                    const weekRangeStr = formatWeekRange(dates);

                    // Compute KPI variables for this week, filtered by active users
                    const weekShifts = shifts.filter(s => 
                        users.some(u => u.id === s.user_id) &&
                        dates.some(d => {
                            const dStrLocal = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                            return s.date === dStrLocal;
                        })
                    );

                    const uniqueStaffIds = new Set(weekShifts.map(s => s.user_id));
                    const activeStaffCount = uniqueStaffIds.size;

                    const weekTotalHours = weekShifts.reduce((sum, s) => sum + getShiftHours(s), 0);

                    // Calculate understaffed days and total hours short based on the 10h/8h rules in the week
                    let understaffedDaysCount = 0;
                    let totalUncoveredHours = 0;

                    dates.forEach(d => {
                        const dStrLocal = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                        const dayShifts = shifts.filter(s => s.date === dStrLocal && users.some(u => u.id === s.user_id));
                        const dayScheduledHours = dayShifts.reduce((sum, s) => sum + getShiftHours(s), 0);
                        
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        const requiredHours = isWeekend ? 8 : 10;

                        if (dayScheduledHours < requiredHours) {
                            understaffedDaysCount++;
                            totalUncoveredHours += (requiredHours - dayScheduledHours);
                        }
                    });

                    return (
                        <div key={pageIdx} className="weekly-page">
                            {/* Header Strip */}
                            <div style={{ 
                                backgroundColor: '#0f172a', 
                                color: '#ffffff', 
                                padding: '16px 20px', 
                                borderRadius: '6px', 
                                display: 'flex', 
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '12px'
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', color: '#ffffff' }}>
                                        Immediate Care <span style={{ color: '#38bdf8' }}>Plus</span>
                                    </h1>
                                    <span style={{ fontSize: '7.5px', fontWeight: 'bold', color: '#94a3b8', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '3px' }}>
                                        {viewType === 'providers' ? 'Clinical Providers Roster' : viewType === 'staff' ? 'Support Staff Roster' : 'Official Operations Roster'}
                                    </span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '7.5px', fontWeight: 'bold', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {facilityName || 'Immediate Care Plus'}
                                    </div>
                                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#ffffff', marginTop: '2px' }}>
                                        {weekRangeStr}
                                    </div>
                                </div>
                            </div>

                            {/* Meta Bar */}
                            <div style={{
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '8px',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: '#64748b',
                                marginBottom: '12px'
                            }}>
                                <div>Period: <span style={{ color: '#0ea5e9' }}>{startDate} to {endDate}</span></div>
                                <div>Generated By: <span style={{ color: '#0f172a' }}>{author}</span></div>
                                <div>Timestamp: <span style={{ color: '#0f172a' }}>{reportDate} {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span></div>
                            </div>

                            {/* Dashboard KPIs Strip - only on pageIdx === 0 */}
                            {pageIdx === 0 && (
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                                    <div style={{
                                        flex: 1,
                                        backgroundColor: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        padding: '10px 14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px'
                                    }}>
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            backgroundColor: '#e0f2fe',
                                            color: '#0284c7',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '14px'
                                        }}>👥</div>
                                        <div>
                                            <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                {viewType === 'providers' ? 'Scheduled Providers' : 'Scheduled Staff'}
                                            </div>
                                            <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>{activeStaffCount} Active</div>
                                        </div>
                                    </div>

                                    <div style={{
                                        flex: 1,
                                        backgroundColor: '#f8fafc',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        padding: '10px 14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px'
                                    }}>
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            backgroundColor: '#f3e8ff',
                                            color: '#7e22ce',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '14px'
                                        }}>⏱️</div>
                                        <div>
                                            <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Hours</div>
                                            <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>{weekTotalHours.toFixed(1)} hrs</div>
                                        </div>
                                    </div>

                                    <div style={{
                                        flex: 1.2,
                                        backgroundColor: understaffedDaysCount === 0 ? '#f0fdf4' : '#fffbeb',
                                        border: understaffedDaysCount === 0 ? '1px solid #bbf7d0' : '1px solid #fde68a',
                                        borderRadius: '8px',
                                        padding: '10px 14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px'
                                    }}>
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            backgroundColor: understaffedDaysCount === 0 ? '#dcfce7' : '#fef3c7',
                                            color: understaffedDaysCount === 0 ? '#15803d' : '#d97706',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '14px'
                                        }}>{understaffedDaysCount === 0 ? '🛡️' : '⚠️'}</div>
                                        <div>
                                            <div style={{ fontSize: '8px', color: understaffedDaysCount === 0 ? '#166534' : '#92400e', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coverage Status</div>
                                            <div style={{ fontSize: '11px', fontWeight: '800', color: understaffedDaysCount === 0 ? '#14532d' : '#78350f', marginTop: '2px' }}>
                                                {understaffedDaysCount === 0 
                                                    ? (viewType === 'providers' ? 'Fully Provider Staffed' : 'Fully Staffed')
                                                    : `Understaffed: ${understaffedDaysCount} Days (${totalUncoveredHours.toFixed(0)} hrs short)`
                                                }
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Week Table */}
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
                                <thead>
                                    <tr>
                                        <th style={{ 
                                            width: '160px', 
                                            padding: '12px 12px', 
                                            textAlign: 'left', 
                                            backgroundColor: '#0f172a', 
                                            color: '#f8fafc', 
                                            fontSize: '10px', 
                                            textTransform: 'uppercase', 
                                            letterSpacing: '0.05em',
                                            borderTop: '1px solid #334155',
                                            borderBottom: '1px solid #334155',
                                            borderLeft: '1px solid #334155',
                                            borderRight: '1px solid #334155'
                                        }}>
                                            Staff Member
                                        </th>
                                        {dates.map(d => (
                                            <th key={d.toISOString()} style={{ 
                                                padding: '10px 6px', 
                                                textAlign: 'center', 
                                                backgroundColor: '#0f172a', 
                                                color: '#ffffff',
                                                borderTop: '1px solid #334155',
                                                borderBottom: '1px solid #334155',
                                                borderRight: '1px solid #334155',
                                                verticalAlign: 'middle'
                                            }}>
                                                <div style={{ fontSize: '8px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                                                    {d.toLocaleDateString('en-US', { weekday: 'short' })}
                                                </div>
                                                <div style={{ fontSize: '15px', fontWeight: '800', marginTop: '2px', color: '#38bdf8' }}>
                                                    {d.getDate()}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {userChunk.map((u, idx) => {
                                        const showProviderHeader = u.isProvider && (idx === 0 || !userChunk[idx - 1].isProvider);
                                        const showSupportHeader = !u.isProvider && (idx === 0 || userChunk[idx - 1].isProvider);
                                        
                                        return (
                                            <React.Fragment key={u.id}>
                                                {showProviderHeader && (
                                                    <tr style={{ backgroundColor: '#f1f5f9' }}>
                                                        <td colSpan={dates.length + 1} style={{ 
                                                            padding: '8px 12px', 
                                                            fontWeight: '800', 
                                                            fontSize: '9px', 
                                                            color: '#475569', 
                                                            textTransform: 'uppercase', 
                                                            letterSpacing: '0.08em',
                                                            borderBottom: '1px solid #cbd5e1',
                                                            borderRight: '1px solid #cbd5e1',
                                                            borderLeft: '4px solid #64748b',
                                                            backgroundColor: '#f1f5f9',
                                                            textAlign: 'left'
                                                        }}>
                                                            Clinical Providers
                                                        </td>
                                                    </tr>
                                                )}
                                                {showSupportHeader && (
                                                    <tr style={{ backgroundColor: '#f1f5f9' }}>
                                                        <td colSpan={dates.length + 1} style={{ 
                                                            padding: '8px 12px', 
                                                            fontWeight: '800', 
                                                            fontSize: '9px', 
                                                            color: '#475569', 
                                                            textTransform: 'uppercase', 
                                                            letterSpacing: '0.08em',
                                                            borderBottom: '1px solid #cbd5e1',
                                                            borderRight: '1px solid #cbd5e1',
                                                            borderLeft: '4px solid #64748b',
                                                            backgroundColor: '#f1f5f9',
                                                            textAlign: 'left'
                                                        }}>
                                                            Support Staff
                                                        </td>
                                                    </tr>
                                                )}
                                                {renderUserRow(u, idx, dates)}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Page Footer */}
                            <div style={{
                                position: 'absolute',
                                bottom: '24px',
                                left: '32px',
                                right: '32px',
                                paddingTop: '8px',
                                borderTop: '1px solid #f1f5f9',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '7.5px',
                                color: '#94a3b8',
                                textTransform: 'uppercase',
                                fontWeight: 'bold',
                                letterSpacing: '0.05em'
                            }}>
                                <div>CONFIDENTIAL - FOR INTERNAL USE ONLY</div>
                                <div>Page {pageIdx + 1} of {totalPages}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }
};

