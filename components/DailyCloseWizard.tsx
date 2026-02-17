
import React, { useReducer, useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { User, UserRole } from '../types';
import { DailyReportState, DailyReportAction, DailyReport } from '../types/dailyReport';
import CalculatorModal from './CalculatorModal';
import SmartDictationInput from '../src/components/dictation/SmartDictationInput';
import { DailyReportService } from '../services/DailyReportService';
import { formatDateForFilename, formatDate, formatDateTime } from '../utils/dateUtils';

interface DailyCloseWizardProps {
    user: User;
    usersDb: User[];
    onCloseComplete: (report: DailyReport) => void;
    onCancel: () => void;
    initialData?: DailyReport; // For Edit Mode
}

// --- 1. REUSABLE REPORT DOCUMENT COMPONENT ---
export const DailyReportDocument: React.FC<{
    report: DailyReport;
    usersDb?: User[];
}> = ({ report, usersDb = [] }) => {

    // Helpers
    const formatCurrency = (val: number) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div
            id="daily-report-document"
            className="bg-white text-slate-900 font-sans box-border relative leading-normal"
            style={{
                width: '215.9mm',
                height: '279.4mm', // Fixed height to prevent 2nd page spill
                overflow: 'hidden', // Clip content to single page
                margin: '0',
                padding: '0',
                backgroundColor: '#ffffff'
            }}
        >
            {/* Header Strip */}
            <div className="bg-slate-900 text-white px-12 py-8 flex justify-between items-center print-color-adjust" style={{ backgroundColor: '#0f172a', color: 'white', WebkitPrintColorAdjust: 'exact' }}>
                <div>
                    <h1 className="text-3xl font-black tracking-tight uppercase m-0 leading-none">
                        Health<span className="text-sky-400" style={{ color: '#38bdf8' }}>Axis</span> Inventory
                    </h1>
                    <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400 mt-2">
                        Official Daily Reconciliation
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Report Reference</div>
                    <div className="text-lg font-mono font-bold text-white">{report.id.slice(-8).toUpperCase()}</div>
                </div>
            </div>

            {/* Meta Bar */}
            {/* Meta Bar */}
            <div className="bg-slate-100 border-b border-slate-200 px-12 py-3 flex justify-between text-[10px] uppercase font-bold tracking-wide text-slate-500" style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                <div>Date: <span className="text-slate-900 ml-2">{formatDate(report.timestamp)}</span></div>
                <div>Author: <span className="text-slate-900 ml-2">{report.author}</span></div>
                <div>Generated: <span className="text-slate-900 ml-2">{formatDateTime(new Date())}</span></div>
            </div>

            <div className="p-12">
                {/* Executive Summary Cards - Fixed Widths */}
                <div className="flex justify-between gap-6 mb-10">
                    <div className="w-[32%] bg-slate-50 border border-slate-200 rounded-lg p-4" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Revenue</div>
                        <div className="text-3xl font-black text-slate-900 mt-1">{formatCurrency(report.totals.revenue)}</div>
                    </div>
                    <div className="w-[32%] bg-slate-50 border border-slate-200 rounded-lg p-4" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Patients</div>
                        <div className="text-3xl font-black text-slate-900 mt-1">{report.totals.patients}</div>
                    </div>
                    <div
                        className={`w-[32%] border rounded-lg p-4 flex flex-col justify-center ${report.isBalanced ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}
                        style={{
                            backgroundColor: report.isBalanced ? '#ecfdf5' : '#fef2f2',
                            borderColor: report.isBalanced ? '#a7f3d0' : '#fecaca'
                        }}
                    >
                        <div className={`text-[10px] font-bold uppercase tracking-wider ${report.isBalanced ? 'text-emerald-600' : 'text-red-600'}`} style={{ color: report.isBalanced ? '#059669' : '#dc2626' }}>
                            Reconciliation Status
                        </div>
                        <div className={`text-xl font-black mt-1 flex items-center gap-2 ${report.isBalanced ? 'text-emerald-700' : 'text-red-700'}`} style={{ color: report.isBalanced ? '#047857' : '#b91c1c' }}>
                            {report.isBalanced ? 'BALANCED' : 'VARIANCE DETECTED'}
                        </div>
                    </div>
                </div>

                {/* Section 1: Financials */}
                <div className="mb-10">
                    <div className="flex items-center gap-3 border-b-2 border-slate-900 pb-2 mb-4">
                        <div className="w-6 h-6 bg-slate-900 text-white flex items-center justify-center text-xs font-bold rounded" style={{ backgroundColor: '#0f172a', color: 'white' }}>1</div>
                        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Financial Statement</h3>
                    </div>

                    <div className="flex justify-between gap-10">
                        {/* Drawer Table */}
                        <div className="w-[48%]">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-300">
                                        <th className="text-left py-2 font-bold text-slate-500 uppercase">Drawer Method</th>
                                        <th className="text-right py-2 font-bold text-slate-500 uppercase">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(report.financials.methods).map(([k, v]) => (
                                        <tr key={k} className="border-b border-slate-100">
                                            <td className="py-2 font-medium capitalize text-slate-700">{k.replace(/([A-Z])/g, ' $1').trim()}</td>
                                            <td className="py-2 text-right font-mono font-bold text-slate-900">{formatCurrency(v as number)}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-50" style={{ backgroundColor: '#f8fafc' }}>
                                        <td className="py-3 font-bold text-slate-900">TOTAL DRAWER</td>
                                        <td className="py-3 text-right font-black text-slate-900 text-sm">
                                            {formatCurrency((Object.values(report.financials.methods) as number[]).reduce((a, b) => a + b, 0))}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        {/* System Table */}
                        <div className="w-[48%]">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-300">
                                        <th className="text-left py-2 font-bold text-slate-500 uppercase">System Posting</th>
                                        <th className="text-right py-2 font-bold text-slate-500 uppercase">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(report.financials.types).map(([k, v]) => (
                                        <tr key={k} className="border-b border-slate-100">
                                            <td className="py-2 font-medium capitalize text-slate-700">{k.replace(/([A-Z])/g, ' $1').trim()}</td>
                                            <td className="py-2 text-right font-mono font-bold text-slate-900">{formatCurrency(v as number)}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-50" style={{ backgroundColor: '#f8fafc' }}>
                                        <td className="py-3 font-bold text-slate-900">TOTAL POSTED</td>
                                        <td className="py-3 text-right font-black text-slate-900 text-sm">
                                            {formatCurrency((Object.values(report.financials.types) as number[]).reduce((a, b) => a + b, 0))}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Section 2 & 3: Volume & Operational */}
                <div className="flex justify-between gap-10 mb-10">
                    <div className="w-[48%]">
                        <div className="flex items-center gap-3 border-b-2 border-slate-900 pb-2 mb-4">
                            <div className="w-6 h-6 bg-slate-900 text-white flex items-center justify-center text-xs font-bold rounded" style={{ backgroundColor: '#0f172a', color: 'white' }}>2</div>
                            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Patient Volume</h3>
                        </div>
                        <table className="w-full text-xs border-collapse">
                            <tbody>
                                {Object.entries(report.insurances).map(([k, v]) => (
                                    <tr key={k} className="border-b border-slate-100">
                                        <td className="py-2 text-slate-600 capitalize">{k.replace(/_/g, ' ').replace('Comp', ' Comp')}</td>
                                        <td className="py-2 text-right font-bold text-slate-900">{v as number}</td>
                                    </tr>
                                ))}
                                <tr className="bg-slate-50 border-t border-slate-200" style={{ backgroundColor: '#f8fafc' }}>
                                    <td className="py-2 font-bold text-slate-900">TOTAL PATIENTS</td>
                                    <td className="py-2 text-right font-black text-slate-900 text-sm">{report.totals.patients}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="w-[48%] flex flex-col gap-6">
                        <div>
                            <div className="flex items-center gap-3 border-b-2 border-slate-900 pb-2 mb-4">
                                <div className="w-6 h-6 bg-slate-900 text-white flex items-center justify-center text-xs font-bold rounded" style={{ backgroundColor: '#0f172a', color: 'white' }}>3</div>
                                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Operational Split</h3>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100" style={{ backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                                <div className="flex justify-between text-xs mb-3">
                                    <span className="font-bold text-slate-700">Nurse Visits</span>
                                    <span className="font-bold text-slate-900">{report.operational.nurseVisits}</span>
                                </div>
                                <div className="h-px bg-slate-200 my-2"></div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Provider Breakdown</div>
                                {Object.entries(report.operational.providerVisits).map(([id, val]) => {
                                    const provider = usersDb?.find(u => u.id === id);
                                    return (
                                        <div key={id} className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-600">{provider?.username || 'Unknown'}</span>
                                            <span className="font-medium text-slate-900">{val as number}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-3 border-b-2 border-slate-900 pb-2 mb-4">
                                <div className="w-6 h-6 bg-slate-900 text-white flex items-center justify-center text-xs font-bold rounded" style={{ backgroundColor: '#0f172a', color: 'white' }}>4</div>
                                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Stats</h3>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-slate-100 rounded p-2 text-center" style={{ backgroundColor: '#f1f5f9' }}>
                                    <div className="text-[9px] font-bold text-slate-500 uppercase">New</div>
                                    <div className="text-lg font-black text-slate-900">{report.stats.newPts}</div>
                                </div>
                                <div className="flex-1 bg-slate-100 rounded p-2 text-center" style={{ backgroundColor: '#f1f5f9' }}>
                                    <div className="text-[9px] font-bold text-slate-500 uppercase">Est.</div>
                                    <div className="text-lg font-black text-slate-900">{report.stats.estPts}</div>
                                </div>
                                <div className="flex-1 bg-slate-100 rounded p-2 text-center" style={{ backgroundColor: '#f1f5f9' }}>
                                    <div className="text-[9px] font-bold text-slate-500 uppercase">X-Ray</div>
                                    <div className="text-lg font-black text-slate-900">{report.stats.xrays}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notes */}
                {report.notes && (
                    <div className="mb-10 bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs" style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a' }}>
                        <span className="font-bold text-amber-700 block mb-1 uppercase tracking-wider" style={{ color: '#b45309' }}>Notes / Discrepancies</span>
                        <p className="text-amber-900 italic" style={{ color: '#78350f' }}>{report.notes}</p>
                    </div>
                )}

                {/* Signatures */}
                <div className="flex justify-between items-end mt-16 pt-8 border-t border-slate-200" style={{ borderTop: '1px solid #e2e8f0' }}>
                    <div className="w-[40%]">
                        <div className="border-b border-slate-400 mb-2" style={{ borderBottom: '1px solid #94a3b8' }}></div>
                        <div className="text-[10px] font-bold uppercase text-slate-500">Prepared By: {report.author}</div>
                    </div>
                    <div className="w-[40%]">
                        <div className="border-b border-slate-400 mb-2" style={{ borderBottom: '1px solid #94a3b8' }}></div>
                        <div className="text-[10px] font-bold uppercase text-slate-500">Approved By (Manager)</div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 bg-slate-50 border-t border-slate-200 px-12 py-4 flex justify-between text-[9px] text-slate-400 font-medium uppercase tracking-wider" style={{ backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <div>Confidential Internal Document • Do Not Distribute</div>
                <div>Generated by HealthAxis • Page 1 of 1</div>
            </div>
        </div>
    );
};


const initialState: DailyReportState = {
    step: 1,
    financials: {
        methods: { cash: 0, credit: 0, check: 0, moneyOrder: 0 },
        types: { billPay: 0, copay: 0, selfPay: 0 }
    },
    insurances: {
        medicaid: 0,
        bcbs_il: 0,
        meridian: 0,
        commercial: 0,
        medicare: 0,
        workersComp: 0,
        selfPay: 0
    },
    operational: {
        nurseVisits: 0,
        providerVisits: {}
    },
    stats: {
        newPts: 0,
        estPts: 0,
        xrays: 0
    },
    notes: '',
    errors: []
};

function reducer(state: DailyReportState, action: DailyReportAction): DailyReportState {
    switch (action.type) {
        case 'SET_FIN_METHOD':
            return { ...state, financials: { ...state.financials, methods: { ...state.financials.methods, [action.payload.key]: action.payload.value } } };
        case 'SET_FIN_TYPE':
            return { ...state, financials: { ...state.financials, types: { ...state.financials.types, [action.payload.key]: action.payload.value } } };
        case 'SET_INSURANCE':
            return { ...state, insurances: { ...state.insurances, [action.payload.key]: action.payload.value } };
        case 'SET_OP_NURSE':
            return { ...state, operational: { ...state.operational, nurseVisits: action.payload } };
        case 'SET_OP_PROVIDER':
            return { ...state, operational: { ...state.operational, providerVisits: { ...state.operational.providerVisits, [action.payload.id]: action.payload.value } } };
        case 'REMOVE_OP_PROVIDER':
            const newProviderVisits = { ...state.operational.providerVisits };
            delete newProviderVisits[action.payload];
            return { ...state, operational: { ...state.operational, providerVisits: newProviderVisits } };
        case 'SET_STAT':
            return { ...state, stats: { ...state.stats, [action.payload.key]: action.payload.value } };
        case 'SET_NOTES':
            return { ...state, notes: action.payload };
        case 'NEXT_STEP':
            return { ...state, step: Math.min(state.step + 1, 3), errors: [] };
        case 'PREV_STEP':
            return { ...state, step: Math.max(state.step - 1, 1), errors: [] };
        case 'VALIDATE_AND_SET_ERRORS':
            return { ...state, errors: action.payload };
        case 'LOAD_DATA':
            return { ...state, ...action.payload };
        default:
            return state;
    }
}

const DailyCloseWizard: React.FC<DailyCloseWizardProps> = ({ user, usersDb, onCloseComplete, onCancel, initialData }) => {
    const [state, dispatch] = useReducer(reducer, initialState);
    const reportRef = useRef<HTMLDivElement>(null);

    // UI States
    const [showPreview, setShowPreview] = useState(false);
    const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
    const [calcModal, setCalcModal] = useState<{ isOpen: boolean; title: string; category: 'methods' | 'types'; key: string; initialValue: number }>({
        isOpen: false,
        title: '',
        category: 'methods',
        key: '',
        initialValue: 0
    });

    // Load initial data if editing
    useEffect(() => {
        if (initialData) {
            dispatch({
                type: 'LOAD_DATA',
                payload: {
                    financials: initialData.financials,
                    insurances: initialData.insurances,
                    operational: initialData.operational,
                    stats: initialData.stats,
                    notes: initialData.notes,
                    step: 1
                }
            });
        } else {
            // Check for saved draft
            try {
                const draft = localStorage.getItem('ha_daily_report_draft');
                if (draft) {
                    const parsed = JSON.parse(draft);
                    // Only restore if it looks like valid state
                    if (parsed.financials && parsed.operational) {
                        console.log('Restoring daily report draft...');
                        dispatch({ type: 'LOAD_DATA', payload: parsed });
                    }
                }
            } catch (e) {
                console.error('Failed to load draft', e);
            }
        }
    }, [initialData]);

    // Auto-Save Draft (Debounced)
    useEffect(() => {
        if (!initialData) { // Don't overwrite draft with edit mode data
            const timer = setTimeout(() => {
                localStorage.setItem('ha_daily_report_draft', JSON.stringify(state));
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [state, initialData]);

    const activeProviders = usersDb.filter(u => u.role === UserRole.DOCTOR || u.role === UserRole.OWNER);
    const selectedProviderIds = Object.keys(state.operational.providerVisits);
    const availableProviders = activeProviders.filter(p => !selectedProviderIds.includes(p.id));

    // Derived Calculations
    const totalMethods = (Object.values(state.financials.methods) as number[]).reduce((a, b) => a + b, 0);
    const totalTypes = (Object.values(state.financials.types) as number[]).reduce((a, b) => a + b, 0);
    const finDiff = totalMethods - totalTypes;
    const isFinBalanced = Math.abs(finDiff) < 0.01;

    const totalIns = (Object.values(state.insurances) as number[]).reduce((a, b) => a + b, 0);
    const totalProviders = (Object.values(state.operational.providerVisits) as number[]).reduce((a, b) => a + b, 0);
    const totalOps = state.operational.nurseVisits + totalProviders;
    const volDiff = totalIns - totalOps;
    const isVolBalanced = totalIns === totalOps && totalIns > 0;

    const totalStatsPatients = state.stats.newPts + state.stats.estPts;
    const statsDiff = totalIns - totalStatsPatients;
    const isStatsBalanced = totalIns === totalStatsPatients;

    // Meta data for report construction
    const getTempReport = (): DailyReport => ({
        id: initialData?.id || `RPT-${Date.now().toString().slice(-6)}`,
        author: initialData?.author || user.username,
        timestamp: initialData?.timestamp || new Date().toISOString(),
        financials: state.financials,
        insurances: state.insurances,
        operational: state.operational,
        stats: state.stats,
        notes: state.notes,
        totals: {
            revenue: totalMethods,
            patients: totalIns
        },
        isBalanced: isFinBalanced && isVolBalanced && isStatsBalanced
    });

    const handleNext = () => {
        const errors: string[] = [];
        if (state.step === 1 && !isFinBalanced) {
            errors.push(`Financials unbalanced. Diff: $${finDiff.toFixed(2)}`);
        }
        if (state.step === 2 && !isVolBalanced) {
            errors.push(`Volume mismatch. Insurance: ${totalIns} vs Ops: ${totalOps}. Diff: ${volDiff}`);
        }

        if (errors.length > 0) {
            dispatch({ type: 'VALIDATE_AND_SET_ERRORS', payload: errors });
        } else {
            dispatch({ type: 'NEXT_STEP' });
        }
    };

    const handleSignAndGenerate = async () => {
        if (!isStatsBalanced) {
            dispatch({ type: 'VALIDATE_AND_SET_ERRORS', payload: [`Patient mismatch: New (${state.stats.newPts}) + Est (${state.stats.estPts}) = ${totalStatsPatients}. Must equal Total Patients (${totalIns}).`] });
            return;
        }

        // 1. Generate PDF
        generatePDF();

        // 2. Construct Report Object
        const report = getTempReport();

        // 3. Save to Supabase
        try {
            if (user?.id) {
                await DailyReportService.createReport(report, user.id);
            }

            // 4. Complete (Allow a slight delay for PDF download to start)
            localStorage.removeItem('ha_daily_report_draft'); // Clear draft on success
            setTimeout(() => {
                onCloseComplete(report);
            }, 1500);
        } catch (e: any) {
            console.error("Failed to save report to DB", e);
            dispatch({ type: 'VALIDATE_AND_SET_ERRORS', payload: [`CRITICAL: Failed to save report to database. ${e.message || 'Check connection'}. Data has NOT been saved to history.`] });
        }
    };

    const generatePDF = () => {
        if (!reportRef.current || !(window as any).html2pdf) {
            alert("PDF generator not ready. Please wait.");
            return;
        }

        const opt = {
            margin: 0,
            filename: `DailyClose_${formatDateForFilename(new Date())}.pdf`,
            image: { type: 'jpeg', quality: 1.0 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                scrollY: 0,
                scrollX: 0,
                windowWidth: 816, // Matches 215.9mm at 96 DPI
                width: 816,
                x: 0,
                y: 0
            },
            jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
        };

        (window as any).html2pdf().set(opt).from(reportRef.current).save();
    };

    const openCalculator = (category: 'methods' | 'types', key: string, currentValue: number) => {
        setCalcModal({
            isOpen: true,
            title: category === 'methods' ? key : key.replace(/([A-Z])/g, ' $1').trim(),
            category,
            key,
            initialValue: currentValue
        });
    };

    const handleCalculatorConfirm = (total: number) => {
        if (calcModal.category === 'methods') {
            dispatch({ type: 'SET_FIN_METHOD', payload: { key: calcModal.key as any, value: total } });
        } else {
            dispatch({ type: 'SET_FIN_TYPE', payload: { key: calcModal.key as any, value: total } });
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-20 animate-fade-in-up">
            <CalculatorModal
                isOpen={calcModal.isOpen}
                onClose={() => setCalcModal(prev => ({ ...prev, isOpen: false }))}
                title={calcModal.title}
                initialTotal={calcModal.initialValue}
                onConfirm={handleCalculatorConfirm}
            />

            {/* --- PREVIEW MODAL --- */}
            {showPreview && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm">
                    <div className="bg-gray-100 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-fade-in-up">
                        <div className="p-4 bg-white border-b flex justify-between items-center">
                            <h3 className="font-bold text-gray-900">Report Preview</h3>
                            <button onClick={() => setShowPreview(false)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"><i className="fa-solid fa-xmark"></i></button>
                        </div>
                        <div className="flex-1 overflow-auto p-8 bg-gray-200 flex justify-center">
                            <div className="shadow-2xl origin-top transform scale-75 md:scale-90 lg:scale-100 transition-transform">
                                <DailyReportDocument report={getTempReport()} usersDb={usersDb} />
                            </div>
                        </div>
                        <div className="p-4 bg-white border-t flex justify-end gap-4">
                            <button onClick={() => setShowPreview(false)} className="px-6 py-2 rounded-lg font-bold text-gray-500 hover:bg-gray-100">Close</button>
                            <button onClick={() => { setShowPreview(false); handleSignAndGenerate(); }} className="px-6 py-2 rounded-lg bg-medical-600 text-white font-bold shadow-lg hover:bg-medical-700">Sign & Generate PDF</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header & Wizard Progress */}
            <div className="mb-10">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                            {initialData ? 'Edit Daily Report' : 'Daily Reconciliation'}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{formatDate(new Date())}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/60">
                        <i className="fa-solid fa-clipboard-check text-medical-500"></i>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Step {state.step} of 3</span>
                    </div>
                </div>
                <div className="flex items-center gap-0">
                    {[
                        { num: 1, label: 'Financials', icon: 'fa-dollar-sign' },
                        { num: 2, label: 'Volume', icon: 'fa-users' },
                        { num: 3, label: 'Sign Off', icon: 'fa-file-signature' }
                    ].map((s, i) => (
                        <React.Fragment key={s.num}>
                            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 shadow-sm
                                    ${state.step > s.num ? 'bg-emerald-500 text-white scale-95' : state.step === s.num ? 'bg-medical-600 text-white ring-4 ring-medical-500/20 scale-110' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                                    {state.step > s.num ? <i className="fa-solid fa-check text-xs"></i> : <i className={`fa-solid ${s.icon} text-xs`}></i>}
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${state.step >= s.num ? 'text-medical-600 dark:text-medical-400' : 'text-slate-400'}`}>{s.label}</span>
                            </div>
                            {i < 2 && <div className={`flex-1 h-0.5 rounded-full mx-2 mb-5 transition-all duration-500 ${state.step > s.num ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'}`}></div>}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Validation Banner */}
            {state.errors.length > 0 && (
                <div className="mb-6 bg-red-50 dark:bg-red-900/10 border border-red-200/60 dark:border-red-800/40 border-l-4 border-l-red-500 p-5 rounded-xl shadow-sm animate-shake">
                    <div className="flex items-center gap-3">
                        <i className="fa-solid fa-circle-exclamation text-red-500 text-xl"></i>
                        <div>
                            <h3 className="font-bold text-red-700 dark:text-red-400">Validation Error</h3>
                            <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-300 mt-1">
                                {state.errors.map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 1: FINANCIALS */}
            {state.step === 1 && (
                <div className="relative overflow-hidden bg-white dark:bg-slate-900/80 backdrop-blur-xl p-8 rounded-[2rem] border border-slate-200/60 dark:border-slate-700/50 shadow-xl space-y-8">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-600"></div>
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center text-sm shadow-lg shadow-emerald-500/20"><i className="fa-solid fa-dollar-sign"></i></span>
                            Financial Reconciliation
                        </h3>
                        <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isFinBalanced ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-200 dark:border-red-800'}`}>
                            <i className={`fa-solid ${isFinBalanced ? 'fa-check-circle' : 'fa-exclamation-triangle'} text-[10px]`}></i>
                            {isFinBalanced ? 'Balanced' : `Off by $${finDiff.toFixed(2)}`}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-4">
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700 pb-2">Methods (Drawer)</div>
                            {Object.entries(state.financials.methods).map(([key, val]) => (
                                <div key={key} className="flex justify-between items-center">
                                    <span className="capitalize font-medium text-gray-700 dark:text-gray-300">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg pl-3 pr-1 py-1">
                                        <span className="text-gray-400 text-xs">$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={val || ''}
                                            onChange={e => dispatch({ type: 'SET_FIN_METHOD', payload: { key: key as any, value: parseFloat(e.target.value) || 0 } })}
                                            className="bg-transparent w-24 text-right font-mono font-bold outline-none text-gray-900 dark:text-white"
                                            placeholder="0.00"
                                        />
                                        <button
                                            onClick={() => openCalculator('methods', key, val as number)}
                                            className="w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-400 hover:text-medical-500 shadow-sm flex items-center justify-center transition-colors"
                                            title="Sum receipts"
                                        >
                                            <i className="fa-solid fa-calculator text-xs"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <div className="flex justify-between font-black text-gray-900 dark:text-white pt-2">
                                <span>Total Drawer</span>
                                <span>${totalMethods.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700 pb-2">Types (System)</div>
                            {Object.entries(state.financials.types).map(([key, val]) => (
                                <div key={key} className="flex justify-between items-center">
                                    <span className="capitalize font-medium text-gray-700 dark:text-gray-300">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg pl-3 pr-1 py-1">
                                        <span className="text-gray-400 text-xs">$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={val || ''}
                                            onChange={e => dispatch({ type: 'SET_FIN_TYPE', payload: { key: key as any, value: parseFloat(e.target.value) || 0 } })}
                                            className="bg-transparent w-24 text-right font-mono font-bold outline-none text-gray-900 dark:text-white"
                                            placeholder="0.00"
                                        />
                                        <button
                                            onClick={() => openCalculator('types', key, val as number)}
                                            className="w-8 h-8 rounded-lg bg-white dark:bg-gray-700 text-gray-400 hover:text-medical-500 shadow-sm flex items-center justify-center transition-colors"
                                            title="Sum receipts"
                                        >
                                            <i className="fa-solid fa-calculator text-xs"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <div className="flex justify-between font-black text-gray-900 dark:text-white pt-2">
                                <span>Total Posted</span>
                                <span>${totalTypes.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 2: VOLUME */}
            {state.step === 2 && (
                <div className="relative overflow-hidden bg-white dark:bg-slate-900/80 backdrop-blur-xl p-8 rounded-[2rem] border border-slate-200/60 dark:border-slate-700/50 shadow-xl space-y-8">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-600"></div>
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 text-white flex items-center justify-center text-sm shadow-lg shadow-blue-500/20"><i className="fa-solid fa-users"></i></span>
                            Patient Volume
                        </h3>
                        <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isVolBalanced ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-200 dark:border-red-800'}`}>
                            <i className={`fa-solid ${isVolBalanced ? 'fa-check-circle' : 'fa-exclamation-triangle'} text-[10px]`}></i>
                            {isVolBalanced ? 'Matched' : `Mismatch (${volDiff})`}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        {/* Insurance Column */}
                        <div className="space-y-4">
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700 pb-2">Insurance Breakdown</div>
                            <div className="grid grid-cols-2 gap-3">
                                {Object.entries(state.insurances).map(([key, val]) => (
                                    <div key={key} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">{key.replace('_', ' ').replace('Comp', ' Comp')}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={val || ''}
                                            onChange={e => dispatch({ type: 'SET_INSURANCE', payload: { key: key as any, value: parseInt(e.target.value) || 0 } })}
                                            className="w-full bg-transparent font-mono font-bold text-xl text-gray-900 dark:text-white outline-none"
                                            placeholder="0"
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="text-right font-black text-gray-900 dark:text-white mt-2">Total: {totalIns}</div>
                        </div>

                        {/* Operations Column */}
                        <div className="space-y-4">
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700 pb-2">Operational Split</div>

                            <div className="bg-purple-50 dark:bg-purple-900/10 rounded-xl p-3 flex justify-between items-center border border-purple-100 dark:border-purple-900/30">
                                <span className="font-bold text-purple-900 dark:text-purple-300">Nurse Visits</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={state.operational.nurseVisits || ''}
                                    onChange={e => dispatch({ type: 'SET_OP_NURSE', payload: parseInt(e.target.value) || 0 })}
                                    className="w-20 bg-transparent text-right font-mono font-bold text-xl text-purple-900 dark:text-purple-300 outline-none"
                                    placeholder="0"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Provider Visits</label>

                                {/* List Added Providers */}
                                {selectedProviderIds.map(id => {
                                    const provider = usersDb.find(u => u.id === id);
                                    if (!provider) return null;
                                    return (
                                        <div key={id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 rounded-xl p-3 animate-fade-in-up">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => dispatch({ type: 'REMOVE_OP_PROVIDER', payload: id })}
                                                    className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/20 text-red-500 hover:bg-red-200 dark:hover:bg-red-900/40 flex items-center justify-center transition-colors shadow-sm"
                                                    title="Remove Provider"
                                                >
                                                    <i className="fa-solid fa-xmark text-xs"></i>
                                                </button>
                                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{provider.username}</span>
                                            </div>
                                            <input
                                                type="number"
                                                min="0"
                                                value={state.operational.providerVisits[id] || ''}
                                                onChange={e => dispatch({ type: 'SET_OP_PROVIDER', payload: { id, value: parseInt(e.target.value) || 0 } })}
                                                className="w-20 bg-transparent text-right font-mono font-bold text-lg text-gray-900 dark:text-white outline-none"
                                                placeholder="0"
                                            />
                                        </div>
                                    );
                                })}

                                {/* Add Provider Dropdown */}
                                {availableProviders.length > 0 ? (
                                    <div className="relative mt-4">
                                        <button
                                            onClick={() => setIsProviderDropdownOpen(!isProviderDropdownOpen)}
                                            className={`w-full h-14 flex items-center justify-between px-5 rounded-2xl border-2 transition-all duration-300 outline-none
                                                ${isProviderDropdownOpen
                                                    ? 'bg-white dark:bg-slate-800 border-indigo-500 shadow-lg ring-4 ring-indigo-500/10'
                                                    : 'bg-white dark:bg-slate-800/50 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                }`}
                                        >
                                            <span className={`text-sm font-bold ${isProviderDropdownOpen ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
                                                {isProviderDropdownOpen ? 'Select Personnel...' : '+ Add Provider Report'}
                                            </span>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300 ${isProviderDropdownOpen ? 'rotate-180 bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                                <i className="fa-solid fa-chevron-down text-xs"></i>
                                            </div>
                                        </button>

                                        {isProviderDropdownOpen && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setIsProviderDropdownOpen(false)}></div>
                                                <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-slate-900 rounded-[1.5rem] shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden z-50 animate-fade-in-up">
                                                    <div className="p-2 max-h-60 overflow-y-auto custom-scrollbar">
                                                        {availableProviders.map(p => (
                                                            <button
                                                                key={p.id}
                                                                onClick={() => {
                                                                    dispatch({ type: 'SET_OP_PROVIDER', payload: { id: p.id, value: 0 } });
                                                                    setIsProviderDropdownOpen(false);
                                                                }}
                                                                className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 group transition-all text-left"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm
                                                                        ${p.role === UserRole.OWNER ? 'bg-red-50 text-red-600 dark:bg-red-900/20' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20'}
                                                                    `}>
                                                                        {p.username.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{p.username}</div>
                                                                        <div className="text-[10px] uppercase font-black tracking-wider text-slate-400">{p.role === UserRole.OWNER ? 'Clinic Owner' : 'Provider'}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-300 group-hover:border-indigo-500 group-hover:text-indigo-500 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 transition-all">
                                                                    <i className="fa-solid fa-plus"></i>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
                                        <i className="fa-solid fa-check-circle text-emerald-500 text-xl mb-2"></i>
                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">All providers accounted for</p>
                                    </div>
                                )}
                            </div>
                            <div className="text-right font-black text-gray-900 dark:text-white mt-2">Total Ops: {totalOps}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 3: STATS & SIGN */}
            {state.step === 3 && (
                <div className="relative overflow-hidden bg-white dark:bg-slate-900/80 backdrop-blur-xl p-8 rounded-[2rem] border border-slate-200/60 dark:border-slate-700/50 shadow-xl space-y-8">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-400 via-violet-500 to-purple-600"></div>
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-violet-600 text-white flex items-center justify-center text-sm shadow-lg shadow-purple-500/20"><i className="fa-solid fa-file-signature"></i></span>
                            Final Statistics & Sign
                        </h3>
                        <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${isStatsBalanced ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-200 dark:border-red-800'}`}>
                            <i className={`fa-solid ${isStatsBalanced ? 'fa-check-circle' : 'fa-exclamation-triangle'} text-[10px]`}></i>
                            {isStatsBalanced ? 'Matched' : `Mismatch (${statsDiff})`}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                        {[
                            { key: 'newPts', label: 'New Patients' },
                            { key: 'estPts', label: 'Established' },
                            { key: 'xrays', label: 'X-Rays' }
                        ].map((stat) => (
                            <div key={stat.key} className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 text-center">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={(state.stats as any)[stat.key] || ''}
                                    onChange={e => dispatch({ type: 'SET_STAT', payload: { key: stat.key as any, value: parseInt(e.target.value) || 0 } })}
                                    className="w-full bg-transparent text-center font-black text-3xl outline-none mt-2 text-gray-900 dark:text-white"
                                    placeholder="0"
                                />
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end text-sm font-bold text-gray-500">
                        New + Est = {totalStatsPatients} / {totalIns} (Total Patients)
                    </div>

                    <div className="mt-6">
                        <SmartDictationInput
                            value={state.notes}
                            onChange={(val) => dispatch({ type: 'SET_NOTES', payload: val })}
                            label="Notes / Discrepancies"
                            placeholder="Dictate notes regarding balance discrepancies or shift events..."
                            rows={4}
                            className="bg-gray-50 dark:bg-gray-800 rounded-xl text-sm focus:ring-medical-500"
                        />
                    </div>
                </div>
            )}

            {/* Footer Controls */}
            <div className="flex gap-3 mt-10 p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40">
                <button
                    onClick={onCancel}
                    className="px-6 h-12 rounded-xl border border-slate-300 dark:border-slate-600 font-bold text-sm text-slate-500 hover:bg-white dark:hover:bg-slate-700 hover:border-slate-400 transition-all"
                >
                    <i className="fa-solid fa-xmark mr-2 text-xs"></i>Cancel
                </button>

                <div className="flex-1 flex gap-3 justify-end">
                    {state.step > 1 && (
                        <button
                            onClick={() => dispatch({ type: 'PREV_STEP' })}
                            className="px-6 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-bold text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
                        >
                            <i className="fa-solid fa-arrow-left text-xs"></i> Back
                        </button>
                    )}

                    {state.step < 3 ? (
                        <button
                            onClick={handleNext}
                            className="flex-1 max-w-xs h-12 rounded-xl bg-gradient-to-r from-medical-600 to-medical-500 text-white font-bold text-sm shadow-lg shadow-medical-500/25 hover:shadow-medical-500/40 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                        >
                            Next Step <i className="fa-solid fa-arrow-right text-xs"></i>
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => setShowPreview(true)}
                                className="px-5 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold text-sm border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-all flex items-center gap-2"
                            >
                                <i className="fa-solid fa-eye text-xs"></i> Preview
                            </button>
                            <button
                                onClick={handleSignAndGenerate}
                                className="flex-1 max-w-xs h-12 rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 text-white dark:text-slate-900 font-bold text-sm shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2 hover:scale-[1.02] transition-all"
                            >
                                <i className="fa-solid fa-file-signature text-xs"></i> {initialData ? 'Update & Print' : 'Sign & Generate'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* --- HIDDEN REPORT ENGINE FOR PDF CAPTURE --- */}
            {/* 
          Robust capture strategy using Portal:
          1. Render into document.body to escape any parent overflow clipping.
          2. Position fixed at top-left (0,0) to align with canvas origin.
          3. Use z-index -9999 to hide behind app.
          4. Visibility: visible is required for html2canvas to capture it.
      */}
            {createPortal(
                <div style={{ position: 'absolute', top: 0, left: '-10000px', width: '215.9mm', zIndex: -9999, pointerEvents: 'none' }}>
                    <div ref={reportRef}>
                        <DailyReportDocument report={getTempReport()} usersDb={usersDb} />
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default DailyCloseWizard;
