
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, PettyCashTransaction, UserRole } from '../types';

interface PettyCashLedgerProps {
    user: User;
    t: (key: string) => string;
}

// Mock initial data if no backend is connected
const MOCK_HISTORY: PettyCashTransaction[] = [
    { id: 'tx-1', userId: 'u1', userName: 'Dr. Smith', amount: 200.00, action: 'DEPOSIT', reason: 'Initial Opening Balance', runningBalance: 200.00, timestamp: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: 'tx-2', userId: 'u3', userName: 'Nurse Jackie', amount: 15.50, action: 'WITHDRAWAL', reason: 'Office Supplies (Pens)', runningBalance: 184.50, timestamp: new Date(Date.now() - 86400000).toISOString() },
    { id: 'tx-3', userId: 'u3', userName: 'Nurse Jackie', amount: 50.00, action: 'WITHDRAWAL', reason: 'Pizza for Staff Lunch', runningBalance: 134.50, timestamp: new Date().toISOString() },
];

const PettyCashLedger: React.FC<PettyCashLedgerProps> = ({ user, t }) => {
    // Master Data
    const [history, setHistory] = useState<PettyCashTransaction[]>([]);
    const [balance, setBalance] = useState(0);

    // Filter State
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Form State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formAction, setFormAction] = useState<'DEPOSIT' | 'WITHDRAWAL'>('WITHDRAWAL');
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');

    // Edit State
    const [editId, setEditId] = useState<string | null>(null);

    const canManage = user.role === UserRole.OWNER || user.role === UserRole.MANAGER;
    const printRef = useRef<HTMLDivElement>(null);

    // --- LOGIC ---

    // Helper: Recalculate running balances for the entire chain
    const recalculateBalances = (transactions: PettyCashTransaction[]): PettyCashTransaction[] => {
        if (!Array.isArray(transactions)) return [];

        // 1. Sort by Date Ascending (Oldest First) to calculate math correctly
        const sorted = [...transactions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        let currentBalance = 0;
        const recalculated = sorted.map(tx => {
            const amt = parseFloat(String(tx.amount || 0));

            if (tx.action === 'DEPOSIT') {
                currentBalance += amt;
            } else {
                currentBalance -= amt;
            }
            return { ...tx, amount: amt, runningBalance: Number(currentBalance.toFixed(2)) };
        });

        // 2. Return sorted by Date Descending (Newest First) for display
        return recalculated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    };

    // Load Data
    useEffect(() => {
        const stored = localStorage.getItem('ha_petty_cash');
        let loadedData: PettyCashTransaction[] = [];

        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) loadedData = parsed;
            } catch (e) {
                console.error("Failed to parse petty cash history", e);
            }
        } else {
            loadedData = MOCK_HISTORY;
        }

        const processed = recalculateBalances(loadedData);
        setHistory(processed);
        setBalance(processed.length > 0 ? processed[0].runningBalance : 0);
    }, []);

    // Filtered View Logic
    const filteredHistory = useMemo(() => {
        return history.filter(tx => {
            const txDate = new Date(tx.timestamp).toISOString().split('T')[0];
            let matchesStart = true;
            let matchesEnd = true;

            if (startDate) matchesStart = txDate >= startDate;
            if (endDate) matchesEnd = txDate <= endDate;

            return matchesStart && matchesEnd;
        });
    }, [history, startDate, endDate]);

    // Handle Transaction (Create or Update)
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const val = parseFloat(amount);
        if (!val || val <= 0) return;

        let updatedHistory: PettyCashTransaction[];

        if (editId) {
            // UPDATE EXISTING
            updatedHistory = history.map(tx => {
                if (tx.id === editId) {
                    return { ...tx, amount: val, action: formAction, reason: reason };
                }
                return tx;
            });
        } else {
            // CREATE NEW
            if (formAction === 'WITHDRAWAL' && val > balance) {
                alert("Insufficient funds in petty cash.");
                return;
            }

            const newTx: PettyCashTransaction = {
                id: `tx-${Date.now()}`,
                userId: user.id,
                userName: user.username,
                amount: val,
                action: formAction,
                reason: reason,
                runningBalance: 0, // Placeholder
                timestamp: new Date().toISOString()
            };
            updatedHistory = [newTx, ...history];
        }

        const finalizedHistory = recalculateBalances(updatedHistory);

        setHistory(finalizedHistory);
        setBalance(finalizedHistory.length > 0 ? finalizedHistory[0].runningBalance : 0);
        localStorage.setItem('ha_petty_cash', JSON.stringify(finalizedHistory));

        // Reset Form
        setIsFormOpen(false);
        setEditId(null);
        setAmount('');
        setReason('');
    };

    const handleEditClick = (e: React.MouseEvent, tx: PettyCashTransaction) => {
        e.preventDefault();
        e.stopPropagation();
        setEditId(tx.id);
        setAmount(tx.amount.toString());
        setReason(tx.reason);
        setFormAction(tx.action);
        setIsFormOpen(true);
    };

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (!window.confirm("Are you sure you want to delete this transaction? Balance will be recalculated.")) return;

        // Use functional state update to ensure we have the latest state
        setHistory(prevHistory => {
            const filtered = prevHistory.filter(tx => String(tx.id) !== String(id));
            const finalizedHistory = recalculateBalances(filtered);

            // Side effect: Save to local storage inside the update
            localStorage.setItem('ha_petty_cash', JSON.stringify(finalizedHistory));

            // Side effect: Update balance
            const newBalance = finalizedHistory.length > 0 ? finalizedHistory[0].runningBalance : 0;
            setBalance(newBalance);

            return finalizedHistory;
        });

        if (editId === id) {
            handleCancel();
        }
    };

    const handleCancel = () => {
        setIsFormOpen(false);
        setEditId(null);
        setAmount('');
        setReason('');
    };

    const handlePrint = () => {
        if (printRef.current) {
            // Use a simple window print for now, utilizing the print media query CSS
            const printContent = printRef.current.innerHTML;
            const originalContent = document.body.innerHTML;

            // Create a hidden iframe to print
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);

            const doc = iframe.contentWindow?.document;
            if (doc) {
                doc.open();
                doc.write(`
                  <html>
                  <head>
                      <title>Petty Cash Report</title>
                      <link href="https://cdn.tailwindcss.com" rel="stylesheet">
                      <style>
                          body { font-family: sans-serif; padding: 20px; }
                          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                          th, td { padding: 10px; border-bottom: 1px solid #ddd; text-align: left; font-size: 12px; }
                          th { background-color: #f3f4f6; text-transform: uppercase; font-size: 10px; }
                          .text-right { text-align: right; }
                          .font-bold { font-weight: bold; }
                          .text-red-500 { color: #ef4444; }
                          .text-emerald-500 { color: #10b981; }
                      </style>
                  </head>
                  <body>
                      ${printContent}
                  </body>
                  </html>
              `);
                doc.close();
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();

                // Cleanup
                setTimeout(() => {
                    document.body.removeChild(iframe);
                }, 1000);
            }
        }
    };

    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    return (
        <div className="space-y-10 pb-24 md:pb-10 animate-fade-in-up max-w-7xl mx-auto">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-medical-500 flex items-center justify-center shadow-lg shadow-medical-500/20">
                        <i className="fa-solid fa-vault text-xl text-white"></i>
                    </div>
                    <div>
                        <h2 className="text-display text-slate-900 dark:text-white">Petty Cash</h2>
                        <p className="text-caption mt-0.5">Secure Ledger & Audit Trail</p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Balance & Actions */}
                <div className="space-y-8">
                    {/* Premium Balance Card */}
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-black dark:to-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden h-[340px] flex flex-col justify-between border border-white/10 group">

                        {/* Holographic Effects */}
                        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none group-hover:scale-110 transition-transform duration-1000"></div>
                        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[80px] -ml-10 -mb-10 pointer-events-none"></div>

                        <div className="relative z-10 flex justify-between items-start">
                            <div className="flex gap-2 items-center">
                                <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                                    <i className="fa-solid fa-building-columns text-sm text-emerald-400"></i>
                                </div>
                                <span className="text-sm font-bold tracking-widest uppercase text-white/60">Clinic Reserve</span>
                            </div>
                            <span className="text-lg font-black tracking-widest text-white/80">ICP-CARE PC</span>
                        </div>

                        <div className="relative z-10 text-center py-6">
                            <div className="text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 drop-shadow-sm">
                                ${balance.toFixed(2)}
                            </div>
                            <div className="text-sm font-medium text-emerald-400 mt-2 flex items-center justify-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                Available Balance
                            </div>
                        </div>

                        <div className="relative z-10 grid grid-cols-2 gap-4">
                            <button
                                onClick={() => { setFormAction('DEPOSIT'); setIsFormOpen(true); setEditId(null); setAmount(''); setReason(''); }}
                                className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3.5 rounded-2xl shadow-lg hover:shadow-emerald-500/40 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                            >
                                <i className="fa-solid fa-plus"></i> Deposit
                            </button>
                            <button
                                onClick={() => { setFormAction('WITHDRAWAL'); setIsFormOpen(true); setEditId(null); setAmount(''); setReason(''); }}
                                className="bg-white/10 hover:bg-white/20 text-white font-bold py-3.5 rounded-2xl border border-white/10 backdrop-blur-md transition-all flex items-center justify-center gap-2"
                            >
                                <i className="fa-solid fa-receipt"></i> Expense
                            </button>
                        </div>
                    </div>

                    {/* Transaction Form Panel */}
                    {isFormOpen && (
                        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-glass border border-gray-100 dark:border-gray-800 animate-scale-in origin-top">
                            <h3 className={`text-xl font-black mb-6 flex items-center gap-3 ${formAction === 'DEPOSIT' ? 'text-emerald-600' : 'text-red-500'}`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${formAction === 'DEPOSIT' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                    <i className={`fa-solid ${formAction === 'DEPOSIT' ? 'fa-arrow-down' : 'fa-arrow-up'}`}></i>
                                </div>
                                {editId ? 'Edit Transaction' : (formAction === 'DEPOSIT' ? 'Add Funds' : 'Record Expense')}
                            </h3>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="text-xs font-extrabold text-gray-400 uppercase tracking-wider ml-1 mb-2 block">Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xl">$</span>
                                        <input
                                            autoFocus
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            required
                                            value={amount}
                                            onChange={e => setAmount(e.target.value)}
                                            className="w-full h-16 pl-10 pr-6 text-3xl font-black rounded-2xl bg-gray-50 dark:bg-gray-800 border-none outline-none focus:ring-4 focus:ring-emerald-500/20 text-gray-900 dark:text-white placeholder-gray-300"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-extrabold text-gray-400 uppercase tracking-wider ml-1 mb-2 block">Description</label>
                                    <input
                                        type="text"
                                        required
                                        value={reason}
                                        onChange={e => setReason(e.target.value)}
                                        className="w-full h-14 px-5 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none outline-none focus:ring-4 focus:ring-emerald-500/20 text-gray-900 dark:text-white font-bold text-lg"
                                        placeholder={formAction === 'DEPOSIT' ? "Source of funds..." : "What was purchased..."}
                                    />
                                </div>

                                {/* If editing, allow switching type */}
                                {editId && (
                                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                                        <label className="text-xs font-extrabold text-gray-400 uppercase tracking-wider block mb-2">Transaction Type</label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setFormAction('DEPOSIT')}
                                                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${formAction === 'DEPOSIT' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-white dark:bg-gray-700 text-gray-500'}`}
                                            >Deposit</button>
                                            <button
                                                type="button"
                                                onClick={() => setFormAction('WITHDRAWAL')}
                                                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${formAction === 'WITHDRAWAL' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-white dark:bg-gray-700 text-gray-500'}`}
                                            >Withdrawal</button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-4 pt-2">
                                    <button
                                        type="button"
                                        onClick={handleCancel}
                                        className="px-6 h-14 font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className={`flex-1 h-14 font-bold text-white text-lg rounded-2xl shadow-xl shadow-${formAction === 'DEPOSIT' ? 'emerald' : 'red'}-500/30 transition-transform hover:scale-[1.02] ${formAction === 'DEPOSIT' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-500 hover:bg-red-400'}`}
                                    >
                                        {editId ? 'Update Record' : 'Confirm'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>

                {/* Right Column: Audit Table & Filters */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Filter Bar */}
                    <div className="glass-panel p-4 rounded-[2rem] shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="flex gap-4 items-center w-full md:w-auto px-2">
                            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl px-4 py-2 border border-gray-100 dark:border-gray-700">
                                <i className="fa-regular fa-calendar text-gray-400"></i>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-transparent border-none h-8 text-sm font-bold text-gray-700 dark:text-white outline-none w-32"
                                />
                            </div>
                            <span className="text-gray-300 font-bold">-</span>
                            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl px-4 py-2 border border-gray-100 dark:border-gray-700">
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-transparent border-none h-8 text-sm font-bold text-gray-700 dark:text-white outline-none w-32"
                                />
                            </div>
                            {(startDate || endDate) && (
                                <button
                                    onClick={() => { setStartDate(''); setEndDate(''); }}
                                    className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-500 flex items-center justify-center transition-colors"
                                >
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            )}
                        </div>
                        <button
                            onClick={handlePrint}
                            className="h-12 px-6 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm border border-gray-100 dark:border-gray-700 w-full md:w-auto justify-center"
                        >
                            <i className="fa-solid fa-print"></i> Print Report
                        </button>
                    </div>

                    {/* Table Card */}
                    <div className="glass-panel rounded-[2.5rem] shadow-glass overflow-hidden flex flex-col min-h-[500px]">
                        <div className="p-8 border-b border-gray-100 dark:border-gray-800/50 flex justify-between items-center bg-white/50 dark:bg-gray-900/50 backdrop-blur-md">
                            <h3 className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-teal-500 rounded-full"></span>
                                Transaction History
                            </h3>
                            <span className="text-xs font-bold text-gray-500 uppercase bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700">
                                {filteredHistory.length} Entries
                            </span>
                        </div>

                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50/50 dark:bg-gray-800/30 text-xs uppercase text-gray-400 font-extrabold tracking-wider sticky top-0 backdrop-blur-sm z-10">
                                    <tr>
                                        <th className="p-6 pl-8">User / Date</th>
                                        <th className="p-6">Description</th>
                                        <th className="p-6 text-right">Debit</th>
                                        <th className="p-6 text-right">Credit</th>
                                        <th className="p-6 text-right pr-8">Balance</th>
                                        {canManage && <th className="p-6 text-center">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                                    {filteredHistory.map((tx) => (
                                        <tr key={tx.id} className="group hover:bg-white/60 dark:hover:bg-gray-800/40 transition-colors">
                                            <td className="p-6 pl-8">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold shadow-inner">
                                                        {getInitials(tx.userName)}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{tx.userName}</div>
                                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">
                                                            {new Date(tx.timestamp).toLocaleDateString()} • {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <span className="text-base font-medium text-gray-700 dark:text-gray-300">{tx.reason}</span>
                                            </td>
                                            <td className="p-6 text-right">
                                                {tx.action === 'WITHDRAWAL' && (
                                                    <span className="font-mono font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md">
                                                        -${Number(tx.amount).toFixed(2)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-6 text-right">
                                                {tx.action === 'DEPOSIT' && (
                                                    <span className="font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-md">
                                                        +${Number(tx.amount).toFixed(2)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-6 text-right pr-8">
                                                <span className="font-mono font-black text-slate-900 dark:text-white text-lg">
                                                    ${Number(tx.runningBalance).toFixed(2)}
                                                </span>
                                            </td>
                                            {canManage && (
                                                <td className="p-6 text-center">
                                                    <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleEditClick(e, tx)}
                                                            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center justify-center transition-all"
                                                            title="Edit"
                                                        >
                                                            <i className="fa-solid fa-pen text-sm"></i>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleDeleteClick(e, tx.id)}
                                                            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center justify-center transition-all"
                                                            title="Delete"
                                                        >
                                                            <i className="fa-solid fa-trash text-sm"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {filteredHistory.length === 0 && (
                                        <tr>
                                            <td colSpan={canManage ? 6 : 5} className="p-16 text-center text-gray-400 font-medium">
                                                <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <i className="fa-solid fa-receipt text-3xl opacity-20"></i>
                                                </div>
                                                No transactions found for this period.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- HIDDEN PRINT TEMPLATE --- */}
            <div className="hidden">
                <div ref={printRef}>
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold uppercase tracking-wide">Petty Cash Report</h1>
                        <p className="text-sm text-gray-500">
                            {startDate ? startDate : 'Start'} to {endDate ? endDate : 'Present'}
                        </p>
                        <p className="text-sm font-bold mt-1">Current Physical Balance: ${balance.toFixed(2)}</p>
                    </div>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-300">
                                <th className="py-2">Date</th>
                                <th className="py-2">User</th>
                                <th className="py-2">Description</th>
                                <th className="py-2 text-right">Debit</th>
                                <th className="py-2 text-right">Credit</th>
                                <th className="py-2 text-right">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredHistory.map((tx) => (
                                <tr key={tx.id} className="border-b border-gray-100">
                                    <td className="py-2">{new Date(tx.timestamp).toLocaleDateString()}</td>
                                    <td className="py-2">{tx.userName}</td>
                                    <td className="py-2">{tx.reason}</td>
                                    <td className="py-2 text-right text-red-500">
                                        {tx.action === 'WITHDRAWAL' ? `-$${Number(tx.amount).toFixed(2)}` : ''}
                                    </td>
                                    <td className="py-2 text-right text-emerald-500">
                                        {tx.action === 'DEPOSIT' ? `+$${Number(tx.amount).toFixed(2)}` : ''}
                                    </td>
                                    <td className="py-2 text-right font-bold">${Number(tx.runningBalance).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="mt-8 text-center text-xs text-gray-400">
                        Generated by HealthAxis Inventory System on {new Date().toLocaleString()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PettyCashLedger;
