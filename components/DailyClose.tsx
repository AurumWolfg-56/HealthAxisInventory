import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole } from '../types';

interface DailyCloseProps {
    user: User;
    usersDb: User[];
    onCloseComplete: (details: string) => void;
    onCancel: () => void;
}

const DailyClose: React.FC<DailyCloseProps> = ({ user, usersDb, onCloseComplete, onCancel }) => {
    // --- STATE ---
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const reportRef = useRef<HTMLDivElement>(null);

    // Financials
    const [finMethods, setFinMethods] = useState({ cash: 0, cc: 0, check: 0 });
    const [finTypes, setFinTypes] = useState({ billPay: 0, copay: 0, selfPay: 0 });

    // Volume - Insurances
    const [insCounts, setInsCounts] = useState({
        medicaid: 0,
        bcbs_il: 0,
        meridian: 0,
        commercial: 0,
        medicare: 0,
        workers_comp: 0,
        self_pay_count: 0
    });

    // Volume - Operations
    const [nurseVisits, setNurseVisits] = useState(0);
    const [providerVisits, setProviderVisits] = useState<Record<string, number>>({});

    // Stats
    const [stats, setStats] = useState({ newPts: 0, estPts: 0, xrays: 0 });
    const [notes, setNotes] = useState('');

    // --- DERIVED TOTALS & VALIDATION ---

    // 1. Financial Totals
    const totalMethods = finMethods.cash + finMethods.cc + finMethods.check;
    const totalTypes = finTypes.billPay + finTypes.copay + finTypes.selfPay;
    const isFinBalanced = Math.abs(totalMethods - totalTypes) < 0.01;
    const finDiff = totalMethods - totalTypes;

    // 2. Volume Totals
    const totalInsurance = (Object.values(insCounts) as number[]).reduce((a, b) => a + b, 0);
    const totalProviders = (Object.values(providerVisits) as number[]).reduce((a, b) => a + b, 0);
    const totalOps = nurseVisits + totalProviders;
    const isVolBalanced = totalInsurance === totalOps && totalInsurance > 0;
    const volDiff = totalInsurance - totalOps;

    // Filter valid providers (Doctors/Owners)
    const activeProviders = usersDb.filter(u => u.role === UserRole.DOCTOR || u.role === UserRole.OWNER);

    // --- HANDLERS ---

    const handlePrintAndSave = () => {
        if (!reportRef.current || !(window as any).html2pdf) return;

        const opt = {
            margin: 10,
            filename: `DailyClose_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.80 },
            html2canvas: { scale: 1.5, useCORS: true },
            jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
        };

        // We use html2pdf to build a worker, output as datauristring, THEN save. 
        const worker = (window as any).html2pdf().set(opt).from(reportRef.current);
        
        // 1. Trigger the download immediately so user isn't blocked
        worker.save().then(() => {
            onCloseComplete(`Daily Close completed. Revenue: $${totalMethods.toFixed(2)}. Patients: ${totalInsurance}.`);
        });

        // 2. Try to dispatch email in the background
        try {
            const getPdf = typeof worker.outputPdf === 'function' ? worker.outputPdf('datauristring') : worker.output('datauristring');
            
            getPdf.then(async (pdfDataUri: string) => {
                try {
                    const base64Content = pdfDataUri.split(',')[1];
                    const emailUrl = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/send-email';
                    
                    const res = await fetch(emailUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'daily_close',
                            data: {
                                date: new Date().toLocaleDateString(),
                                totalMethods: totalMethods.toFixed(2),
                                totalInsurance: totalInsurance,
                                closedBy: user.username,
                                pdfBase64: base64Content
                            }
                        })
                    });

                    if (!res.ok && res.status === 413) {
                        // Fallback if PDF too large
                        await fetch(emailUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                type: 'daily_close',
                                data: {
                                    date: new Date().toLocaleDateString(),
                                    totalMethods: totalMethods.toFixed(2),
                                    totalInsurance: totalInsurance,
                                    closedBy: user.username
                                }
                            })
                        });
                    }
                } catch (e) {
                    console.error("Failed executing background email logic:", e);
                }
            });
        } catch (e) {
            console.error("Failed executing html2pdf output:", e);
        }
    };

    // --- RENDER HELPERS ---

    const SectionHeader = ({ title, icon, isValid }: { title: string, icon: string, isValid?: boolean }) => (
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg ${isValid === undefined ? 'bg-slate-500' : isValid ? 'bg-emerald-500' : 'bg-red-500'}`}>
                    <i className={`fa-solid ${icon}`}></i>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
            </div>
            {isValid !== undefined && (
                <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isValid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {isValid ? <><i className="fa-solid fa-check"></i> Balanced</> : <><i className="fa-solid fa-triangle-exclamation"></i> Mismatch</>}
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6 sm:space-y-8 pb-24 sm:pb-20 animate-fade-in-up max-w-5xl mx-auto px-1 sm:px-0">
            {/* Header */}
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-medical-500 flex items-center justify-center shadow-lg shadow-medical-500/20">
                        <i className="fa-solid fa-cash-register text-lg sm:text-xl text-white"></i>
                    </div>
                    <div>
                        <h2 className="text-2xl sm:text-display font-bold text-slate-900 dark:text-white leading-tight">Daily Medical Close</h2>
                        <p className="text-[11px] sm:text-caption mt-0.5">End-of-Day Reconciliation Wizard</p>
                    </div>
                </div>
                <div className="text-right hidden md:block">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Date</div>
                    <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white">{new Date().toLocaleDateString()}</div>
                </div>
            </header>

            {/* --- PANEL A: FINANCIALS --- */}
            <div className={`glass-panel p-5 sm:p-8 rounded-2xl shadow-glass transition-all duration-300 border-l-[6px] sm:border-l-8 ${isFinBalanced ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
                <SectionHeader title="1. Financial Reconciliation" icon="fa-sack-dollar" isValid={isFinBalanced} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12">
                    {/* Drawer Inputs */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Collection Methods (Drawer)</h3>
                        <div className="space-y-3">
                            <label className="flex justify-between items-center text-sm font-bold text-slate-700 dark:text-slate-300">
                                <span>Cash</span>
                                <input type="number" value={finMethods.cash || ''} onChange={e => setFinMethods({ ...finMethods, cash: parseFloat(e.target.value) || 0 })} className="w-20 sm:w-32 bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-right font-mono focus:ring-2 focus:ring-medical-500 outline-none" placeholder="0.00" />
                            </label>
                            <label className="flex justify-between items-center text-sm font-bold text-slate-700 dark:text-slate-300">
                                <span className="truncate pr-2">Credit Cards</span>
                                <input type="number" value={finMethods.cc || ''} onChange={e => setFinMethods({ ...finMethods, cc: parseFloat(e.target.value) || 0 })} className="w-20 sm:w-32 bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-right font-mono focus:ring-2 focus:ring-medical-500 outline-none" placeholder="0.00" />
                            </label>
                            <label className="flex justify-between items-center text-sm font-bold text-slate-700 dark:text-slate-300">
                                <span>Checks</span>
                                <input type="number" value={finMethods.check || ''} onChange={e => setFinMethods({ ...finMethods, check: parseFloat(e.target.value) || 0 })} className="w-20 sm:w-32 bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-right font-mono focus:ring-2 focus:ring-medical-500 outline-none" placeholder="0.00" />
                            </label>
                        </div>
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between font-bold text-slate-900 dark:text-white">
                            <span>Total Drawer</span>
                            <span>${totalMethods.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* System Inputs */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Payment Types (System)</h3>
                        <div className="space-y-3">
                            <label className="flex justify-between items-center text-sm font-bold text-slate-700 dark:text-slate-300">
                                <span>Bill Pay</span>
                                <input type="number" value={finTypes.billPay || ''} onChange={e => setFinTypes({ ...finTypes, billPay: parseFloat(e.target.value) || 0 })} className="w-20 sm:w-32 bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-right font-mono focus:ring-2 focus:ring-medical-500 outline-none" placeholder="0.00" />
                            </label>
                            <label className="flex justify-between items-center text-sm font-bold text-slate-700 dark:text-slate-300">
                                <span>Copay</span>
                                <input type="number" value={finTypes.copay || ''} onChange={e => setFinTypes({ ...finTypes, copay: parseFloat(e.target.value) || 0 })} className="w-20 sm:w-32 bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-right font-mono focus:ring-2 focus:ring-medical-500 outline-none" placeholder="0.00" />
                            </label>
                            <label className="flex justify-between items-center text-sm font-bold text-slate-700 dark:text-slate-300">
                                <span>Self Pay</span>
                                <input type="number" value={finTypes.selfPay || ''} onChange={e => setFinTypes({ ...finTypes, selfPay: parseFloat(e.target.value) || 0 })} className="w-20 sm:w-32 bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-right font-mono focus:ring-2 focus:ring-medical-500 outline-none" placeholder="0.00" />
                            </label>
                        </div>
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between font-bold text-slate-900 dark:text-white">
                            <span>Total Posted</span>
                            <span>${totalTypes.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {!isFinBalanced && (
                    <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30 text-center font-bold text-red-600 dark:text-red-400 animate-pulse">
                        Difference: ${finDiff.toFixed(2)}
                    </div>
                )}
            </div>

            {/* --- PANEL B: VOLUME --- */}
            <div className={`glass-panel p-5 sm:p-8 rounded-2xl shadow-glass transition-all duration-300 border-l-[6px] sm:border-l-8 ${isVolBalanced ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
                <SectionHeader title="2. Patient Volume" icon="fa-users-medical" isValid={isVolBalanced} />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12">
                    {/* Insurance Breakdown */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Insurance Class (Counts)</h3>
                        <div className="grid grid-cols-2 gap-2 sm:gap-4">
                            {['medicaid', 'bcbs_il', 'meridian', 'commercial', 'medicare', 'workers_comp'].map((key) => (
                                <div key={key} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2 sm:p-3 flex flex-col">
                                    <span className="text-[9px] sm:text-[10px] font-bold uppercase text-slate-500 mb-1 truncate" title={key.replace('_', ' ')}>{key.replace('_', ' ')}</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={(insCounts as any)[key] || ''}
                                        onChange={e => setInsCounts({ ...insCounts, [key]: parseInt(e.target.value) || 0 })}
                                        className="bg-transparent font-mono font-bold text-lg sm:text-xl text-slate-900 dark:text-white outline-none w-full"
                                        placeholder="0"
                                    />
                                </div>
                            ))}
                            <div className="col-span-2 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-700/30 rounded-xl p-3 flex items-center justify-between">
                                <span className="text-xs font-bold uppercase text-yellow-700 dark:text-yellow-500">Self Pay (Count)</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={insCounts.self_pay_count || ''}
                                    onChange={e => setInsCounts({ ...insCounts, self_pay_count: parseInt(e.target.value) || 0 })}
                                    className="bg-transparent font-mono font-bold text-2xl text-yellow-700 dark:text-yellow-500 outline-none w-20 text-right"
                                    placeholder="0"
                                />
                            </div>
                        </div>
                        <div className="mt-4 text-right font-bold text-slate-900 dark:text-white">
                            Total Insurance: {totalInsurance}
                        </div>
                    </div>

                    {/* Operations Breakdown */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Operational Split</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-900/30">
                                <span className="font-bold text-purple-900 dark:text-purple-300">Nurse Visits Only</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={nurseVisits || ''}
                                    onChange={e => setNurseVisits(parseInt(e.target.value) || 0)}
                                    className="bg-transparent font-mono font-bold text-xl text-purple-900 dark:text-purple-300 outline-none w-16 text-right"
                                    placeholder="0"
                                />
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-bold text-gray-400 uppercase">Provider Visits</p>
                                {activeProviders.map(prov => (
                                    <div key={prov.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{prov.full_name || prov.username || 'Unknown'}</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={providerVisits[prov.id] || ''}
                                            onChange={e => setProviderVisits({ ...providerVisits, [prov.id]: parseInt(e.target.value) || 0 })}
                                            className="bg-transparent font-mono font-bold text-lg text-slate-900 dark:text-white outline-none w-16 text-right"
                                            placeholder="0"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="mt-4 text-right font-bold text-slate-900 dark:text-white">
                            Total Ops: {totalOps}
                        </div>
                    </div>
                </div>

                {!isVolBalanced && (
                    <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30 text-center font-bold text-red-600 dark:text-red-400 animate-pulse">
                        Count Mismatch: {volDiff}
                    </div>
                )}
            </div>

            {/* --- PANEL C: STATS --- */}
            <div className="glass-panel p-5 sm:p-8 rounded-2xl shadow-glass">
                <SectionHeader title="3. Statistics" icon="fa-chart-simple" />
                <div className="grid grid-cols-3 gap-3 sm:gap-6">
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center shadow-inner border border-slate-100 dark:border-slate-700/50">
                        <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 sm:mb-2">New Pts</div>
                        <input type="number" min="0" value={stats.newPts || ''} onChange={e => setStats({ ...stats, newPts: parseInt(e.target.value) || 0 })} className="w-full text-center bg-transparent font-bold text-2xl sm:text-3xl outline-none text-emerald-600 dark:text-emerald-400" placeholder="0" />
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center shadow-inner border border-slate-100 dark:border-slate-700/50">
                        <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 sm:mb-2">Est.</div>
                        <input type="number" min="0" value={stats.estPts || ''} onChange={e => setStats({ ...stats, estPts: parseInt(e.target.value) || 0 })} className="w-full text-center bg-transparent font-bold text-2xl sm:text-3xl outline-none text-blue-600 dark:text-blue-400" placeholder="0" />
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center shadow-inner border border-slate-100 dark:border-slate-700/50">
                        <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 sm:mb-2">X-Rays</div>
                        <input type="number" min="0" value={stats.xrays || ''} onChange={e => setStats({ ...stats, xrays: parseInt(e.target.value) || 0 })} className="w-full text-center bg-transparent font-bold text-2xl sm:text-3xl outline-none text-amber-600 dark:text-amber-400" placeholder="0" />
                    </div>
                </div>
                <div className="mt-6">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Notes / Discrepancies</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full h-24 bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-medical-500 outline-none" placeholder="Explain any mismatches here..."></textarea>
                </div>
            </div>

            {/* --- ACTIONS --- */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 mt-8">
                <button onClick={onCancel} className="flex-1 h-14 sm:h-16 rounded-xl sm:rounded-2xl border-2 border-slate-200 dark:border-slate-700 font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel Session</button>
                <button
                    onClick={handlePrintAndSave}
                    disabled={!isFinBalanced || !isVolBalanced}
                    className={`flex-1 h-14 sm:h-16 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg shadow-xl flex items-center justify-center gap-2 sm:gap-3 transition-all ${(!isFinBalanced || !isVolBalanced)
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                        : 'bg-emerald-600 dark:bg-emerald-500 text-white hover:bg-emerald-500 dark:hover:bg-emerald-400 hover:scale-[1.02]'
                        }`}
                >
                    <i className={`fa-solid ${(!isFinBalanced || !isVolBalanced) ? 'fa-lock' : 'fa-file-signature'}`}></i>
                    {(!isFinBalanced || !isVolBalanced) ? 'Reconciliation Incomplete' : 'Sign & Generate Report'}
                </button>
            </div>

            {/* --- HIDDEN PRINT LAYOUT (Based on 2026 PDF Spec) --- */}
            <div className="absolute top-0 left-[-10000px] w-[215.9mm] bg-white text-black p-10 font-sans" ref={reportRef}>
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold tracking-tight">IMMEDIATE CARE PLUS</h1>
                    <h2 className="text-lg uppercase tracking-wide mt-1">Daily Medical Close Report</h2>
                </div>

                <div className="flex justify-between text-sm mb-8 border-b-2 border-gray-800 pb-2">
                    <div><span className="font-bold">Date:</span> {new Date().toLocaleDateString()}</div>
                    <div><span className="font-bold">Closed By:</span> {user.username}</div>
                </div>

                {/* 1. Financials */}
                <div className="mb-8">
                    <div className="bg-gray-200 px-4 py-1 mb-4 font-bold text-sm uppercase">1. Financial Reconciliation</div>
                    <div className="flex justify-between mb-4">
                        <div className="w-[45%]">
                            <h4 className="font-bold text-xs uppercase mb-2 border-b border-gray-400 pb-1">Collection Methods</h4>
                            <div className="flex justify-between text-sm py-1"><span>Cash:</span> <span>${finMethods.cash.toFixed(2)}</span></div>
                            <div className="flex justify-between text-sm py-1"><span>Credit Cards:</span> <span>${finMethods.cc.toFixed(2)}</span></div>
                            <div className="flex justify-between text-sm py-1"><span>Checks:</span> <span>${finMethods.check.toFixed(2)}</span></div>
                            <div className="flex justify-between text-sm font-bold border-t border-gray-400 mt-2 pt-1"><span>Total Drawer:</span> <span>${totalMethods.toFixed(2)}</span></div>
                        </div>
                        <div className="w-[45%]">
                            <h4 className="font-bold text-xs uppercase mb-2 border-b border-gray-400 pb-1">Payment Types</h4>
                            <div className="flex justify-between text-sm py-1"><span>Bill Pay:</span> <span>${finTypes.billPay.toFixed(2)}</span></div>
                            <div className="flex justify-between text-sm py-1"><span>Copay:</span> <span>${finTypes.copay.toFixed(2)}</span></div>
                            <div className="flex justify-between text-sm py-1"><span>Self Pay:</span> <span>${finTypes.selfPay.toFixed(2)}</span></div>
                            <div className="flex justify-between text-sm font-bold border-t border-gray-400 mt-2 pt-1"><span>Total Posted:</span> <span>${totalTypes.toFixed(2)}</span></div>
                        </div>
                    </div>
                </div>

                {/* 2. Volume */}
                <div className="mb-8">
                    <div className="bg-gray-200 px-4 py-1 mb-4 font-bold text-sm uppercase">2. Patient Volume Breakdown</div>

                    <table className="w-full text-sm mb-6 border-collapse">
                        <thead>
                            <tr className="bg-gray-100 border-b border-gray-300">
                                <th className="text-left py-1 px-2">Insurance Class</th>
                                <th className="text-right py-1 px-2">Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(insCounts).map(([k, v]) => (
                                <tr key={k} className="border-b border-gray-200">
                                    <td className="py-1 px-2 capitalize">{k.replace(/_/g, ' ')}</td>
                                    <td className="text-right py-1 px-2">{v}</td>
                                </tr>
                            ))}
                            <tr className="bg-gray-800 text-white font-bold">
                                <td className="py-1 px-2">TOTAL PATIENTS</td>
                                <td className="text-right py-1 px-2">{totalInsurance}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="mb-4">
                        <h4 className="font-bold text-xs uppercase mb-2">Operational Split</h4>
                        <div className="text-sm">Nurse Visits: {nurseVisits}</div>
                        {activeProviders.map(p => (
                            <div key={p.id} className="text-sm">{p.full_name || p.username}: {providerVisits[p.id] || 0}</div>
                        ))}
                    </div>
                </div>

                {/* 3. Stats */}
                <div className="mb-12">
                    <div className="bg-gray-200 px-4 py-1 mb-4 font-bold text-sm uppercase">3. Statistics</div>
                    <div className="flex gap-8 text-sm">
                        <div>New Patients: <span className="font-bold">{stats.newPts}</span></div>
                        <div>Established: <span className="font-bold">{stats.estPts}</span></div>
                        <div>X-Rays: <span className="font-bold">{stats.xrays}</span></div>
                    </div>
                </div>

                {/* Notes & Sig */}
                {notes && (
                    <div className="mb-12 p-4 border border-gray-300 rounded text-sm bg-gray-50">
                        <span className="font-bold block mb-1">Notes:</span>
                        {notes}
                    </div>
                )}

                <div className="mt-20 flex justify-end">
                    <div className="text-center w-64">
                        <div className="border-b border-black mb-2"></div>
                        <div className="text-sm font-bold uppercase">Manager Signature</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DailyClose;