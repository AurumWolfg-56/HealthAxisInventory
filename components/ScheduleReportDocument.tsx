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
        }
    };
    return map[colorName] || map['blue'];
};

export const ScheduleReportDocument: React.FC<ScheduleReportDocumentProps> = ({ data }) => {
    const { users, shifts, timeOffRequests, startDate, endDate, reportDate, author, facilityName } = data;

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
                    border: '1px solid #cbd5e1', 
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
                            border: '1px solid #cbd5e1',
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

        // Metrics for the whole month
        const monthShifts = shifts.filter(s => dates.some(d => {
            const dStrLocal = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            return s.date === dStrLocal;
        }));
        
        const activeStaffCount = new Set(monthShifts.map(s => s.user_id)).size;
        const monthTotalHours = monthShifts.reduce((sum, s) => sum + getShiftHours(s), 0);
        
        const weekdays = dates.filter(d => d.getDay() >= 1 && d.getDay() <= 5);
        const unstaffedDays = weekdays.filter(d => {
            const dStrLocal = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            return !shifts.some(s => s.date === dStrLocal && users.some(u => u.id === s.user_id && ['DOCTOR', 'OWNER'].includes(u.role)));
        });

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
                            page-break-after: avoid !important;
                            break-after: avoid !important;
                            page-break-inside: avoid !important;
                            break-inside: avoid !important;
                            box-sizing: border-box !important;
                            background-color: #ffffff !important;
                            width: 297mm !important;
                            min-height: 200mm !important;
                            padding: 10mm 12mm !important;
                            margin: 0 !important;
                        }
                        * {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                    }
                    .month-page {
                        box-sizing: border-box;
                        background-color: #ffffff;
                        width: 297mm;
                        min-height: 210mm;
                        padding: 12mm 15mm;
                        margin: 0 auto 20px auto;
                        border: 1px solid #e2e8f0;
                        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                        border-radius: 8px;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                    }
                    @media print {
                        .month-page {
                            border: none !important;
                            box-shadow: none !important;
                            margin: 0 !important;
                            border-radius: 0 !important;
                        }
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
                                Health<span style={{ color: '#38bdf8' }}>Axis</span>
                            </h1>
                            <span style={{ fontSize: '7.5px', fontWeight: 'bold', color: '#94a3b8', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '3px' }}>
                                Official Operations Calendar
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
                                <div style={{ fontSize: '7.5px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Scheduled Staff</div>
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
                            backgroundColor: unstaffedDays.length === 0 ? '#f0fdf4' : '#fffbeb',
                            border: unstaffedDays.length === 0 ? '1px solid #bbf7d0' : '1px solid #fde68a',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}>
                            <span style={{ fontSize: '12px' }}>{unstaffedDays.length === 0 ? '🛡️' : '⚠️'}</span>
                            <div>
                                <div style={{ fontSize: '7.5px', color: unstaffedDays.length === 0 ? '#166534' : '#92400e', fontWeight: 'bold', textTransform: 'uppercase' }}>Coverage Status</div>
                                <div style={{ fontSize: '11px', fontWeight: '800', color: unstaffedDays.length === 0 ? '#14532d' : '#78350f' }}>
                                    {unstaffedDays.length === 0 ? 'Fully Provider Staffed' : `Understaffed: ${unstaffedDays.length} Weekdays`}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Calendar Grid Table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', flex: 1, margin: '8px 0' }}>
                        <thead>
                            <tr>
                                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(dayName => (
                                    <th key={dayName} style={{
                                        padding: '5px',
                                        backgroundColor: '#0f172a',
                                        color: '#ffffff',
                                        fontSize: '8.5px',
                                        fontWeight: '800',
                                        textAlign: 'center',
                                        border: '1px solid #334155',
                                        letterSpacing: '0.05em'
                                    }}>
                                        {dayName}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {weekRows.map((weekDates, weekIdx) => (
                                <tr key={weekIdx} style={{ height: '23mm' }}>
                                    {weekDates.map(d => {
                                        const dStrLocal = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                                        const dayShifts = shifts.filter(s => s.date === dStrLocal && users.some(u => u.id === s.user_id));
                                        const dayTimeOffs = timeOffRequests.filter(t => t.status === 'approved' && t.start_date <= dStrLocal && t.end_date >= dStrLocal && users.some(u => u.id === t.user_id));
                                        
                                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                        const isDayInPrimaryMonth = d.getMonth() === primaryMonthIndex;

                                        return (
                                            <td key={d.toISOString()} style={{
                                                border: '1px solid #cbd5e1',
                                                padding: '4px 6px',
                                                verticalAlign: 'top',
                                                backgroundColor: isWeekend ? '#f8fafc' : '#ffffff',
                                                opacity: isDayInPrimaryMonth ? 1 : 0.45,
                                                height: '23mm',
                                                position: 'relative'
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
                                                        color: isDayInPrimaryMonth ? '#1e293b' : '#94a3b8' 
                                                    }}>
                                                        {d.getDate()}
                                                    </span>
                                                    {d.getDate() === 1 && (
                                                        <span style={{ 
                                                            fontSize: '7px', 
                                                            fontWeight: '800', 
                                                            color: '#64748b', 
                                                            textTransform: 'uppercase' 
                                                        }}>
                                                            {d.toLocaleDateString('en-US', { month: 'short' })}
                                                        </span>
                                                    )}
                                                </div>

                                                <div style={{ 
                                                    display: 'flex', 
                                                    flexDirection: 'column', 
                                                    gap: '2px'
                                                }}>
                                                    {dayShifts.map(s => {
                                                        const u = users.find(user => user.id === s.user_id);
                                                        if (!u) return null;
                                                        const theme = getPrintTheme(u.themeColor || 'blue');
                                                        return (
                                                            <div key={s.id} style={{
                                                                backgroundColor: theme.bg,
                                                                borderLeft: `2.5px solid ${theme.border}`,
                                                                borderRadius: '2px',
                                                                padding: '1.5px 3px',
                                                                fontSize: '7px',
                                                                fontWeight: '700',
                                                                color: theme.text,
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center'
                                                            }} title={`${u.username}: ${formatCompactTime(s.start_time)} - ${formatCompactTime(s.end_time)}`}>
                                                                <span style={{ fontWeight: '800', marginRight: '3px' }}>
                                                                    {u.username}
                                                                </span>
                                                                <span style={{ fontSize: '6.5px', opacity: 0.9 }}>
                                                                    {formatCompactTime(s.start_time)}-{formatCompactTime(s.end_time)}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}

                                                    {dayTimeOffs.map(t => {
                                                        const u = users.find(user => user.id === t.user_id);
                                                        if (!u) return null;
                                                        return (
                                                            <div key={t.id} style={{
                                                                backgroundColor: '#fff1f2',
                                                                borderLeft: '2.5px solid #f43f5e',
                                                                borderRadius: '2px',
                                                                padding: '1.5px 3px',
                                                                fontSize: '7px',
                                                                fontWeight: '700',
                                                                color: '#9f1239',
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis'
                                                            }} title={`${u.username} Off: ${t.reason || 'Approved'}`}>
                                                                🚫 {u.username} Off
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
        const weekChunks: Date[][] = [dates]; // since it's <= 7 days, there's only 1 chunk

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
                        .weekly-page {
                            page-break-after: always !important;
                            break-after: page !important;
                            box-sizing: border-box !important;
                            background-color: #ffffff !important;
                            width: 297mm !important;
                            min-height: 200mm !important;
                            padding: 10mm 12mm !important;
                            margin: 0 !important;
                        }
                        .weekly-page:last-child {
                            page-break-after: auto !important;
                            break-after: auto !important;
                        }
                        * {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                    }
                    
                    .weekly-page {
                        box-sizing: border-box;
                        background-color: #ffffff;
                        width: 297mm;
                        min-height: 210mm;
                        padding: 12mm 15mm;
                        margin: 0 auto 20px auto;
                        border: 1px solid #e2e8f0;
                        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                        border-radius: 8px;
                    }
                    @media print {
                        .weekly-page {
                            border: none !important;
                            box-shadow: none !important;
                            margin: 0 !important;
                            border-radius: 0 !important;
                        }
                    }
                `}} />

                {weekChunks.map((weekDates, chunkIdx) => {
                    const weekRangeStr = formatWeekRange(weekDates);

                    // Compute KPI variables for this specific week chunk
                    const weekShifts = shifts.filter(s => {
                        return weekDates.some(d => {
                            const dStrLocal = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                            return s.date === dStrLocal;
                        });
                    });

                    const uniqueStaffIds = new Set(weekShifts.map(s => s.user_id));
                    const activeStaffCount = uniqueStaffIds.size;

                    const weekTotalHours = weekShifts.reduce((sum, s) => sum + getShiftHours(s), 0);

                    const weekdays = weekDates.filter(d => d.getDay() >= 1 && d.getDay() <= 5);
                    const unstaffedDays = weekdays.filter(d => {
                        const dStrLocal = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                        const hasProvider = shifts.some(s => s.date === dStrLocal && users.some(u => u.id === s.user_id && ['DOCTOR', 'OWNER'].includes(u.role)));
                        return !hasProvider;
                    });

                    return (
                        <div key={chunkIdx} className="weekly-page">
                            {/* Header Strip */}
                            <div style={{ 
                                backgroundColor: '#0f172a', 
                                color: '#ffffff', 
                                padding: '16px 20px', 
                                borderRadius: '6px', 
                                display: 'flex', 
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '16px'
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', color: '#ffffff' }}>
                                        Health<span style={{ color: '#38bdf8' }}>Axis</span>
                                    </h1>
                                    <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#94a3b8', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '4px' }}>
                                        Official Operations Roster
                                    </span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
                                padding: '8px 12px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '8.5px',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                color: '#64748b',
                                marginBottom: '16px'
                            }}>
                                <div>Period: <span style={{ color: '#0ea5e9' }}>{startDate} to {endDate}</span></div>
                                <div>Generated By: <span style={{ color: '#0f172a' }}>{author}</span></div>
                                <div>Timestamp: <span style={{ color: '#0f172a' }}>{reportDate} {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span></div>
                            </div>

                            {/* Dashboard KPIs Strip */}
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
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
                                        <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scheduled Staff</div>
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
                                    backgroundColor: unstaffedDays.length === 0 ? '#f0fdf4' : '#fffbeb',
                                    border: unstaffedDays.length === 0 ? '1px solid #bbf7d0' : '1px solid #fde68a',
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
                                        backgroundColor: unstaffedDays.length === 0 ? '#dcfce7' : '#fef3c7',
                                        color: unstaffedDays.length === 0 ? '#15803d' : '#d97706',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '14px'
                                    }}>{unstaffedDays.length === 0 ? '🛡️' : '⚠️'}</div>
                                    <div>
                                        <div style={{ fontSize: '8px', color: unstaffedDays.length === 0 ? '#166534' : '#92400e', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coverage Status</div>
                                        <div style={{ fontSize: '11px', fontWeight: '800', color: unstaffedDays.length === 0 ? '#14532d' : '#78350f', marginTop: '2px' }}>
                                            {unstaffedDays.length === 0 ? 'Fully Provider Staffed' : `Understaffed: ${unstaffedDays.map(d => d.toLocaleDateString('en-US', { weekday: 'short' })).join(', ')}`}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Week Table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
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
                                            border: '1px solid #334155'
                                        }}>
                                            Staff Member
                                        </th>
                                        {weekDates.map(d => (
                                            <th key={d.toISOString()} style={{ 
                                                padding: '10px 6px', 
                                                textAlign: 'center', 
                                                backgroundColor: '#0f172a', 
                                                color: '#ffffff',
                                                border: '1px solid #334155',
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
                                    {/* Clinical Providers Section */}
                                    {providers.length > 0 && (
                                        <>
                                            <tr style={{ backgroundColor: '#f1f5f9' }}>
                                                <td colSpan={weekDates.length + 1} style={{ 
                                                    padding: '8px 12px', 
                                                    fontWeight: '800', 
                                                    fontSize: '9px', 
                                                    color: '#475569', 
                                                    textTransform: 'uppercase', 
                                                    letterSpacing: '0.08em',
                                                    border: '1px solid #cbd5e1',
                                                    borderLeft: '4px solid #64748b',
                                                    backgroundColor: '#f1f5f9',
                                                    textAlign: 'left'
                                                }}>
                                                    Clinical Providers
                                                </td>
                                            </tr>
                                            {providers.map((u, idx) => renderUserRow(u, idx, weekDates))}
                                        </>
                                    )}

                                    {/* Support Staff Section */}
                                    {supportStaff.length > 0 && (
                                        <>
                                            <tr style={{ backgroundColor: '#f1f5f9' }}>
                                                <td colSpan={weekDates.length + 1} style={{ 
                                                    padding: '8px 12px', 
                                                    fontWeight: '800', 
                                                    fontSize: '9px', 
                                                    color: '#475569', 
                                                    textTransform: 'uppercase', 
                                                    letterSpacing: '0.08em',
                                                    border: '1px solid #cbd5e1',
                                                    borderLeft: '4px solid #64748b',
                                                    backgroundColor: '#f1f5f9',
                                                    textAlign: 'left'
                                                }}>
                                                    Support Staff
                                                </td>
                                            </tr>
                                            {supportStaff.map((u, idx) => renderUserRow(u, idx, weekDates))}
                                        </>
                                    )}
                                </tbody>
                            </table>

                            {/* Page Footer */}
                            <div style={{
                                marginTop: '24px',
                                paddingTop: '12px',
                                borderTop: '1px solid #f1f5f9',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '8px',
                                color: '#94a3b8',
                                textTransform: 'uppercase',
                                fontWeight: 'bold',
                                letterSpacing: '0.05em'
                            }}>
                                <div>CONFIDENTIAL - FOR INTERNAL USE ONLY</div>
                                <div>Page {chunkIdx + 1} of {weekChunks.length}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }
};

