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

export const ScheduleReportDocument: React.FC<ScheduleReportDocumentProps> = ({ data }) => {
    const { users, shifts, timeOffRequests, startDate, endDate, reportDate, author, facilityName } = data;

    // Build array of dates from startDate to endDate
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

    const providers = users.filter(u => ['DOCTOR'].includes(u.role));
    const supportStaff = users.filter(u => ['MANAGER', 'OWNER', 'MA', 'FRONT_DESK'].includes(u.role));

    // UI helper for time formatting
    const formatTime = (timeStr: string) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':');
        const d = new Date();
        d.setHours(parseInt(h), parseInt(m));
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    };

    const renderUserRow = (u: User, index: number) => {
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
                    textAlign: 'left'
                }}>
                    <div style={{ fontSize: '11px', lineHeight: '1.2' }}>{displayName}</div>
                    <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', marginTop: '2px', fontWeight: '600' }}>
                        {(u.role || '').replace('_', ' ')}
                    </div>
                </td>
                {/* Dates Columns */}
                {dates.map(d => {
                    const dStrLocal = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                    const dStr = d.toISOString().split('T')[0];
                    
                    const shift = shifts.find(s => s.user_id === u.id && (s.date === dStr || s.date === dStrLocal));
                    const timeOff = timeOffRequests.find(t => t.user_id === u.id && t.status === 'approved' && t.start_date <= dStrLocal && t.end_date >= dStrLocal);

                    return (
                        <td key={d.toISOString()} style={{ 
                            padding: '6px 4px', 
                            textAlign: 'center', 
                            border: '1px solid #cbd5e1',
                            verticalAlign: 'middle'
                        }}>
                            {timeOff ? (
                                <div style={{ 
                                    backgroundColor: '#fef2f2', 
                                    color: '#dc2626', 
                                    border: '1px solid #fecaca', 
                                    borderRadius: '5px', 
                                    padding: '3px 2px', 
                                    fontSize: '8px', 
                                    fontWeight: '700',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.02em',
                                    lineHeight: '1.2'
                                }}>
                                    <div>OFF</div>
                                    <div style={{ fontSize: '7px', fontWeight: '500', opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {timeOff.reason || 'Approved'}
                                    </div>
                                </div>
                            ) : shift ? (
                                <div style={{ 
                                    color: '#0f172a', 
                                    fontWeight: '700', 
                                    fontSize: '9px', 
                                    lineHeight: '1.3' 
                                }}>
                                    <div style={{ color: '#0284c7' }}>{formatTime(shift.start_time)}</div>
                                    <div style={{ color: '#64748b', fontSize: '8px', fontWeight: '400', margin: '1px 0' }}>to</div>
                                    <div style={{ color: '#0284c7' }}>{formatTime(shift.end_time)}</div>
                                    {shift.notes && (
                                        <div style={{ 
                                            fontSize: '7px', 
                                            color: '#64748b', 
                                            fontWeight: 'normal', 
                                            marginTop: '2px',
                                            fontStyle: 'italic',
                                            whiteSpace: 'nowrap', 
                                            overflow: 'hidden', 
                                            textOverflow: 'ellipsis',
                                            maxWidth: '100%'
                                        }} title={shift.notes}>
                                            {shift.notes}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ color: '#cbd5e1', fontWeight: '300' }}>-</div>
                            )}
                        </td>
                    );
                })}
            </tr>
        );
    };

    return (
        <div
            id="schedule-report-document"
            className="bg-white text-slate-900 font-sans box-border relative leading-normal"
            style={{
                width: '297mm',
                minHeight: '210mm',
                margin: '0',
                padding: '0',
                backgroundColor: '#ffffff'
            }}
        >
            {/* Header Strip */}
            <div className="bg-[#0f172a] text-white px-8 pt-8 pb-6 flex justify-between items-center print-color-adjust" style={{ backgroundColor: '#0f172a', color: 'white', WebkitPrintColorAdjust: 'exact' }}>
                <div>
                    <h1 className="text-3xl font-black tracking-tight uppercase m-0 leading-none">
                        Health<span className="text-[#38bdf8]" style={{ color: '#38bdf8' }}>Axis</span>
                    </h1>
                    <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-slate-400 mt-2">
                        Official Operations Roster
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1 text-sky-400" style={{color: '#38bdf8'}}>Facility Roster</div>
                    <div className="text-lg font-black text-white uppercase tracking-tight">{facilityName || 'Main Clinic'}</div>
                </div>
            </div>

            {/* Meta Bar */}
            <div className="bg-[#f1f5f9] border-b border-slate-200 px-8 py-2 flex justify-between text-[9px] uppercase font-bold tracking-wide text-slate-500" style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                <div>Schedule Period: <span className="text-[#0ea5e9] ml-2">{startDate} TO {endDate}</span></div>
                <div>Author: <span className="text-slate-900 ml-2">{author}</span></div>
                <div>Generated: <span className="text-slate-900 ml-2">{reportDate} {new Date().toLocaleTimeString()}</span></div>
            </div>

            <div className="p-8">
                {/* Unified Table */}
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
                            {dates.map(d => (
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
                                <tr style={{ backgroundColor: '#e2e8f0' }}>
                                    <td colSpan={dates.length + 1} style={{ 
                                        padding: '8px 12px', 
                                        fontWeight: '800', 
                                        fontSize: '10px', 
                                        color: '#0f172a', 
                                        textTransform: 'uppercase', 
                                        letterSpacing: '0.1em',
                                        border: '1px solid #cbd5e1',
                                        backgroundColor: '#e2e8f0'
                                    }}>
                                        Clinical Providers
                                    </td>
                                </tr>
                                {providers.map((u, idx) => renderUserRow(u, idx))}
                            </>
                        )}

                        {/* Support Staff Section */}
                        {supportStaff.length > 0 && (
                            <>
                                <tr style={{ backgroundColor: '#e2e8f0' }}>
                                    <td colSpan={dates.length + 1} style={{ 
                                        padding: '8px 12px', 
                                        fontWeight: '800', 
                                        fontSize: '10px', 
                                        color: '#0f172a', 
                                        textTransform: 'uppercase', 
                                        letterSpacing: '0.1em',
                                        border: '1px solid #cbd5e1',
                                        backgroundColor: '#e2e8f0'
                                    }}>
                                        Support Staff
                                    </td>
                                </tr>
                                {supportStaff.map((u, idx) => renderUserRow(u, idx))}
                            </>
                        )}
                    </tbody>
                </table>

                {/* Footer Disclaimers */}
                <div className="mt-8 pt-4 border-t border-slate-100 text-[8px] text-slate-400 text-center uppercase tracking-widest font-bold">
                    This document is strictly confidential. Any unauthorized copying, disclosure, or distribution of the material in this document is strictly forbidden.
                </div>
            </div>
        </div>
    );
};
