import React, { useState, useEffect } from 'react';

// Status Types
type AIStatus = 'checking' | 'online' | 'partial' | 'offline';

export const AIGatewayStatus: React.FC = () => {
    const [status, setStatus] = useState<AIStatus>('checking');
    const [lmStudio, setLmStudio] = useState(false);
    const [whisper, setWhisper] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    // Ping the local services
    const checkStatus = async () => {
        let lmOk = false;
        let whisperOk = false;

        // Check LM Studio
        try {
            const res = await fetch('http://127.0.0.1:1234/v1/models', { method: 'GET', signal: AbortSignal.timeout(2000) });
            if (res.ok) lmOk = true;
        } catch {
            lmOk = false;
        }

        // Check Whisper / Gateway
        try {
            const res = await fetch('http://localhost:8765/health', { method: 'GET', signal: AbortSignal.timeout(2000) });
            if (res.ok) whisperOk = true;
        } catch {
            whisperOk = false;
        }

        setLmStudio(lmOk);
        setWhisper(whisperOk);

        if (lmOk && whisperOk) setStatus('online');
        else if (lmOk && !whisperOk) setStatus('partial');
        else setStatus('offline');
    };

    // Poll every 15 seconds
    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 15000);
        return () => clearInterval(interval);
    }, []);

    // Derived UI states
    const statusConfig = {
        checking: { color: 'bg-slate-300 text-slate-500', icon: 'fa-spinner fa-spin', text: 'Checking AI...' },
        online: { color: 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/30', icon: 'fa-brain', text: 'AI Active', dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' },
        partial: { color: 'bg-amber-500/10 text-amber-500 ring-amber-500/30', icon: 'fa-brain', text: 'AI Partial', dot: 'bg-amber-400' },
        offline: { color: 'bg-red-500/10 text-red-500 ring-red-500/30', icon: 'fa-brain', text: 'AI Offline', dot: 'bg-red-500' }
    };

    const current = statusConfig[status];

    return (
        <div className="relative">
            {/* The Badge Button */}
            <button
                onClick={() => setShowDetails(!showDetails)}
                onBlur={() => setTimeout(() => setShowDetails(false), 200)}
                className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-transparent ring-1 transition-all duration-300 hover:shadow-md ${current.color}`}
                title="Local AI Core Status"
            >
                <div className="relative flex items-center justify-center">
                    <i className={`fa-solid ${current.icon} text-sm`}></i>
                    {/* Status Dot */}
                    {status !== 'checking' && (
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-[1.5px] border-white dark:border-slate-900 ${current.dot}`}></div>
                    )}
                </div>
                <span className="text-xs font-bold tracking-tight">{current.text}</span>
            </button>

            {/* Mobile simplified button (icon only) */}
            <button
                onClick={() => setShowDetails(!showDetails)}
                onBlur={() => setTimeout(() => setShowDetails(false), 200)}
                className={`md:hidden flex items-center justify-center w-10 h-10 rounded-full border border-transparent ring-1 transition-all ${current.color}`}
            >
                <div className="relative flex items-center justify-center">
                    <i className={`fa-solid ${current.icon} text-lg`}></i>
                    {status !== 'checking' && (
                        <div className={`absolute 0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${current.dot} -top-1 -right-1`}></div>
                    )}
                </div>
            </button>

            {/* Diagnostics Dropdown */}
            {showDetails && (
                <div className="absolute right-0 top-full mt-3 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 z-50 animate-in fade-in slide-in-from-top-2">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white mb-1"><i className="fa-solid fa-microchip text-medical-500 mr-2"></i>Local AI Engine Status</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Diagnostics for the intelligent core running on your machine.</p>

                    <div className="space-y-3">
                        {/* LM Studio Check */}
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`flex w-6 h-6 rounded-md items-center justify-center text-white ${lmStudio ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                    <i className={`fa-solid ${lmStudio ? 'fa-check' : 'fa-xmark'} text-xs`}></i>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">LM Studio (Logic & OCR)</p>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">127.0.0.1:1234</p>
                                </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${lmStudio ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {lmStudio ? 'ONLINE' : 'OFFLINE'}
                            </span>
                        </div>

                        {/* Whisper Check */}
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`flex w-6 h-6 rounded-md items-center justify-center text-white ${whisper ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                                    <i className={`fa-solid ${whisper ? 'fa-check' : 'fa-exclamation'} text-xs`}></i>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">Norvexis Gateway (Voice)</p>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">localhost:8765</p>
                                </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${whisper ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {whisper ? 'ONLINE' : 'OFFLINE'}
                            </span>
                        </div>
                    </div>

                    {/* Troubleshooting Guide */}
                    {(status === 'partial' || status === 'offline') && (
                        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">How to fix:</p>
                            <ul className="text-[11px] text-slate-500 dark:text-slate-400 list-disc pl-4 space-y-1">
                                {!lmStudio && <li>Open <strong>LM Studio</strong>, load your models, and start the local server.</li>}
                                {!whisper && <li>Run <strong>start-ai-gateway.bat</strong> from your local Norvexis project folder to enable Voice AI.</li>}
                            </ul>
                            <button
                                onClick={(e) => { e.preventDefault(); checkStatus(); }}
                                className="mt-3 w-full py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                            >
                                <i className="fa-solid fa-rotate-right mr-2"></i>Test Connection Again
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
