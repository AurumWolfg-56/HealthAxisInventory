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
    const start = new Date(startDate);
    // JS dates can be tricky with timezone offsets when parsing YYYY-MM-DD. 
    // Usually it assumes UTC. Let's fix timezone shift by creating it correctly:
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

    const renderGridParamsRow = (usersGroup: User[], title: string) => {
        if(usersGroup.length === 0) return null;
        
        return (
            <div className="mb-6">
                <div className="bg-[#f8fafc] border border-[#e2e8f0] px-4 py-2 font-bold text-[#0f172a] text-xs uppercase tracking-widest" style={{backgroundColor: '#f8fafc', color: '#0f172a', borderColor: '#e2e8f0', borderWidth: '1px', borderStyle: 'solid'}}>
                    {title}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                    <tbody>
                        {usersGroup.map((u, i) => {
                            const displayName = u.username || (u as any).full_name || 'Unknown';
                            return (
                            <tr key={u.id} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '8px 12px', borderRight: '1px solid #e2e8f0', width: '120px', fontWeight: 'bold', color: '#334155' }}>
                                    <div style={{ fontSize: '11px' }}>{displayName}</div>
                                    <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase' }}>{(u.role || '').replace('_', ' ')}</div>
                                </td>
                                {dates.map(d => {
                                    const dStr = d.toISOString().split('T')[0];
                                    const dStrLocal = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                                    
                                    const shift = shifts.find(s => s.user_id === u.id && (s.date === dStr || s.date === dStrLocal));
                                    const timeOff = timeOffRequests.find(t => t.user_id === u.id && t.status === 'approved' && t.start_date <= dStrLocal && t.end_date >= dStrLocal);

                                    return (
                                        <td key={d.toISOString()} style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #e2e8f0', width: `${100 / dates.length}%` }}>
                                            {timeOff ? (
                                                <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '4px', padding: '4px', fontSize: '9px', fontWeight: 'bold' }}>
                                                    OFF: {timeOff.reason || 'Unavailable'}
                                                </div>
                                            ) : shift ? (
                                                <div style={{ color: '#0f172a', fontWeight: 'bold' }}>
                                                    {shift.start_time} - {shift.end_time}
                                                </div>
                                            ) : (
                                                <div style={{ color: '#cbd5e1' }}>-</div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>
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
            <div className="bg-[#0f172a] text-white px-10 pt-8 pb-6 flex justify-between items-center print-color-adjust" style={{ backgroundColor: '#0f172a', color: 'white', WebkitPrintColorAdjust: 'exact' }}>
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
            <div className="bg-[#f1f5f9] border-b border-slate-200 px-10 py-2 flex justify-between text-[9px] uppercase font-bold tracking-wide text-slate-500" style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                <div>Schedule Period: <span className="text-[#0ea5e9] ml-2">{startDate} TO {endDate}</span></div>
                <div>Author: <span className="text-slate-900 ml-2">{author}</span></div>
                <div>Generated: <span className="text-slate-900 ml-2">{reportDate} {new Date().toLocaleTimeString()}</span></div>
            </div>

            <div className="p-8">
                {/* Table Header (Dates) */}
                <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '2px solid #0f172a' }}>
                    <thead>
                        <tr>
                            <th style={{ width: '120px', padding: '10px', textAlign: 'left', color: '#94a3b8', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Staff Member</th>
                            {dates.map(d => (
                                <th key={d.toISOString()} style={{ padding: '10px', textAlign: 'center', color: '#0f172a', width: `${100 / dates.length}%` }}>
                                    <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                        {d.toLocaleDateString('en-US', { weekday: 'short' })}
                                    </div>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                        {d.getDate()}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                </table>

                <div className="mt-4">
                    {renderGridParamsRow(providers, "Clinical Providers")}
                    {renderGridParamsRow(supportStaff, "Support Staff")}
                </div>

                {/* Footer Disclaimers */}
                <div className="mt-8 pt-4 border-t border-slate-100 text-[8px] text-slate-400 text-center uppercase tracking-widest font-bold">
                    This document is strictly confidential. Any unauthorized copying, disclosure, or distribution of the material in this document is strictly forbidden.
                </div>
            </div>
        </div>
    );
};
