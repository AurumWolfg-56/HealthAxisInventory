import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BillingRule, User, UserRole } from '../types';

interface BillingWizardProps {
    billingRules: BillingRule[];
    user: User;
    onSaveRule: (rule: BillingRule) => void;
    onDeleteRule: (id: string) => void;
    t: (key: string) => string;
}

const INSURERS = ["BCBS", "Anthem BCBS", "Aetna", "Cigna", "Meridian"];

const BillingWizard: React.FC<BillingWizardProps> = ({ billingRules, user, onSaveRule, onDeleteRule, t }) => {
    const [selectedInsurer, setSelectedInsurer] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedCpt, setCopiedCpt] = useState<string | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Edit Mode State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<Partial<BillingRule>>({});

    const canEdit = user.role === UserRole.OWNER || user.role === UserRole.MANAGER;

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Filter Logic
    const filteredRules = useMemo(() => {
        let rules = billingRules;

        // 1. Filter by Insurer (Dropdown)
        if (selectedInsurer) {
            rules = rules.filter(r => r.insurers.includes(selectedInsurer));
        }

        // 2. Filter by Search Query (Reverse Lookup)
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            rules = rules.filter(r =>
                r.testName.toLowerCase().includes(query) ||
                r.cpt.includes(query)
            );
        }

        return rules;
    }, [billingRules, selectedInsurer, searchQuery]);

    const handleCopy = (cpt: string) => {
        navigator.clipboard.writeText(cpt);
        setCopiedCpt(cpt);
        setTimeout(() => setCopiedCpt(null), 2000);
    };

    const handleSelect = (insurer: string) => {
        setSelectedInsurer(insurer);
        setIsDropdownOpen(false);
    };

    const openModal = (rule?: BillingRule) => {
        if (rule) {
            setEditingRule({ ...rule });
        } else {
            setEditingRule({
                insurers: [],
                testName: '',
                cpt: '',
                billToClient: true
            });
        }
        setIsModalOpen(true);
    };

    const toggleInsurerInEdit = (insurer: string) => {
        const current = editingRule.insurers || [];
        if (current.includes(insurer)) {
            setEditingRule({ ...editingRule, insurers: current.filter(i => i !== insurer) });
        } else {
            setEditingRule({ ...editingRule, insurers: [...current, insurer] });
        }
    };

    const handleSave = () => {
        if (!editingRule.testName || !editingRule.cpt || (editingRule.insurers?.length === 0)) {
            alert("Please fill in Name, CPT, and select at least one insurer.");
            return;
        }

        const newRule: BillingRule = {
            id: editingRule.id || `br_${Date.now()}`,
            insurers: editingRule.insurers || [],
            testName: editingRule.testName || '',
            cpt: editingRule.cpt || '',
            billToClient: editingRule.billToClient ?? true
        };

        onSaveRule(newRule);
        setIsModalOpen(false);
    };

    return (
        <>
            <div className="space-y-10 pb-20 animate-fade-in-up max-w-7xl mx-auto">
                {/* Header with gradient text */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-medical-500 flex items-center justify-center text-white shadow-lg shadow-medical-500/20">
                            <i className="fa-solid fa-file-invoice-dollar text-xl"></i>
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-display text-slate-900 dark:text-white">
                                    {t('billing_title')}
                                </h2>
                                <button
                                    onClick={() => setIsInfoModalOpen(true)}
                                    className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-500 flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all hover:scale-110"
                                    title="Important Billing Info"
                                >
                                    <i className="fa-solid fa-circle-info"></i>
                                </button>
                            </div>
                            <p className="text-caption mt-0.5">
                                {t('billing_subtitle')}
                            </p>
                        </div>
                    </div>

                    {canEdit && (
                        <button
                            onClick={() => openModal()}
                            className="h-14 px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold shadow-lg flex items-center gap-2 transition-all hover:scale-105"
                        >
                            <i className="fa-solid fa-plus"></i> Add Test Rule
                        </button>
                    )}
                </header>

                {/* Control Panel - Modern Floating Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-30">

                    {/* CUSTOM DROPDOWN */}
                    <div className="relative group" ref={dropdownRef}>
                        <label className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-3 block ml-1 flex items-center gap-2">
                            <i className="fa-solid fa-building-shield text-emerald-500"></i>
                            {t('lbl_select_insurer')}
                        </label>

                        <div className="relative">
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className={`w-full h-20 pl-6 pr-6 flex items-center justify-between bg-white dark:bg-gray-800/60 border-2 rounded-[1.5rem] transition-all duration-300 backdrop-blur-xl shadow-lg hover:shadow-xl
                        ${isDropdownOpen
                                        ? 'border-emerald-500 ring-4 ring-emerald-500/10'
                                        : 'border-white dark:border-gray-700 hover:border-emerald-200 dark:hover:border-emerald-900/50'
                                    }
                    `}
                            >
                                <div className="flex items-center gap-4">
                                    {selectedInsurer ? (
                                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                                            {selectedInsurer.charAt(0)}
                                        </div>
                                    ) : (
                                        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                                            <i className="fa-regular fa-building"></i>
                                        </div>
                                    )}
                                    <span className={`text-xl font-bold ${selectedInsurer ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                                        {selectedInsurer || t('opt_select_insurance')}
                                    </span>
                                </div>

                                <div className={`w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-400 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : ''}`}>
                                    <i className="fa-solid fa-chevron-down text-sm"></i>
                                </div>
                            </button>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                                <div className="absolute top-full left-0 w-full mt-3 bg-white dark:bg-gray-900 rounded-[1.5rem] shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in-up z-50">
                                    <div className="p-2 space-y-1 max-h-[320px] overflow-y-auto custom-scrollbar">
                                        <button
                                            onClick={() => handleSelect('')}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors font-bold text-sm ${!selectedInsurer ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                        >
                                            <div className="w-8 h-8 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                                                <i className="fa-solid fa-ban text-xs"></i>
                                            </div>
                                            Show All / Reset
                                        </button>

                                        <div className="h-px bg-gray-100 dark:bg-gray-800 my-1 mx-2"></div>

                                        {INSURERS.map(ins => (
                                            <button
                                                key={ins}
                                                onClick={() => handleSelect(ins)}
                                                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group ${selectedInsurer === ins ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${selectedInsurer === ins ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                                                        {ins.charAt(0)}
                                                    </div>
                                                    <span className="font-bold text-lg">{ins}</span>
                                                </div>
                                                {selectedInsurer === ins && (
                                                    <i className="fa-solid fa-check text-white"></i>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SEARCH INPUT */}
                    <div className="relative group">
                        <label className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-3 block ml-1 flex items-center gap-2">
                            <i className="fa-solid fa-magnifying-glass text-blue-500"></i>
                            {t('lbl_reverse_lookup')}
                        </label>
                        <div className="relative">
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 text-xl z-10 group-focus-within:text-blue-500 transition-colors">
                                <i className="fa-solid fa-search"></i>
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search test name (e.g. Strep)..."
                                className="w-full h-20 pl-14 pr-14 bg-white dark:bg-gray-800/60 border-2 border-white dark:border-gray-700 rounded-[1.5rem] font-bold text-xl text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder-gray-300 dark:placeholder-gray-600 shadow-lg"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 hover:text-white hover:bg-red-500 dark:hover:bg-red-500 transition-all z-10"
                                >
                                    <i className="fa-solid fa-xmark text-sm"></i>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Results Grid */}
                <div className="min-h-[400px]">
                    {selectedInsurer || searchQuery || filteredRules.length > 0 ? (
                        <>
                            <div className="mb-6 flex justify-between items-end px-2 border-b border-gray-100 dark:border-gray-800 pb-2">
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Authorized Tests ({filteredRules.length})
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {filteredRules.length > 0 ? (
                                    filteredRules.map((rule) => (
                                        <div
                                            key={rule.id}
                                            className="group relative bg-white dark:bg-gray-900 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full"
                                        >
                                            {/* Green top border indicator */}
                                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400"></div>

                                            <div className="p-6 pt-8 flex flex-col flex-1 h-full relative">
                                                {/* Decoration bg */}
                                                <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                                                    <i className="fa-solid fa-file-medical text-6xl text-emerald-500"></i>
                                                </div>

                                                {/* Admin Controls */}
                                                {canEdit && (
                                                    <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                        <button
                                                            onClick={() => openModal(rule)}
                                                            className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-colors"
                                                        >
                                                            <i className="fa-solid fa-pen text-xs"></i>
                                                        </button>
                                                        <button
                                                            onClick={() => { if (window.confirm('Delete this rule?')) onDeleteRule(rule.id); }}
                                                            className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors"
                                                        >
                                                            <i className="fa-solid fa-trash text-xs"></i>
                                                        </button>
                                                    </div>
                                                )}

                                                <div className="mb-4">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-800/50">
                                                            <i className="fa-solid fa-check"></i> Authorized
                                                        </span>
                                                    </div>
                                                    <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors pr-2">
                                                        {rule.testName}
                                                    </h3>
                                                </div>

                                                {/* Insurer Bubbles (only if searching generally) */}
                                                {!selectedInsurer && (
                                                    <div className="flex flex-wrap gap-1 mb-6 mt-auto">
                                                        {rule.insurers.slice(0, 3).map(ins => (
                                                            <span key={ins} className="text-[9px] font-bold px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-md border border-gray-200 dark:border-gray-700">
                                                                {ins}
                                                            </span>
                                                        ))}
                                                        {rule.insurers.length > 3 && (
                                                            <span className="text-[9px] font-bold px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-md border border-gray-200 dark:border-gray-700">
                                                                +{rule.insurers.length - 3}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="mt-auto pt-5 border-t border-gray-100 dark:border-gray-800/50 flex items-center justify-between">
                                                    <div>
                                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">CPT Code</div>
                                                        <div className="text-3xl font-mono font-black text-gray-800 dark:text-gray-100 tracking-tighter">
                                                            {rule.cpt}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleCopy(rule.cpt)}
                                                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm ${copiedCpt === rule.cpt
                                                            ? 'bg-emerald-500 text-white shadow-emerald-500/30 scale-110'
                                                            : 'bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700'
                                                            }`}
                                                        title="Copy Code"
                                                    >
                                                        <i className={`fa-solid ${copiedCpt === rule.cpt ? 'fa-check text-lg' : 'fa-copy text-lg'}`}></i>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full py-24 text-center">
                                        <div className="inline-block p-8 rounded-full bg-gray-50 dark:bg-gray-800 mb-6 animate-bounce-slow shadow-sm">
                                            <i className="fa-solid fa-file-circle-question text-5xl text-gray-300 dark:text-gray-600"></i>
                                        </div>
                                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No permitted tests found</h3>
                                        <p className="text-gray-500 dark:text-gray-400">Try changing the insurance or search terms.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        /* Empty State */
                        <div className="flex flex-col items-center justify-center py-24 opacity-60">
                            <div className="w-40 h-40 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-full flex items-center justify-center mb-8 shadow-inner relative">
                                <i className="fa-solid fa-hand-holding-dollar text-7xl text-gray-300 dark:text-gray-600 relative z-10"></i>
                                <div className="absolute inset-0 bg-white/20 dark:bg-black/20 rounded-full blur-2xl"></div>
                            </div>
                            <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-3 text-center">Select an Insurance to Begin</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-xl max-w-lg text-center leading-relaxed">
                                Choose an insurance provider from the dropdown above to see authorized <span className="font-bold text-emerald-600 dark:text-emerald-400">"Bill to Client"</span> tests and codes.
                            </p>

                            {/* Visual Arrow Hint */}
                            <div className="mt-8 animate-bounce">
                                <i className="fa-solid fa-arrow-up text-gray-300 dark:text-gray-600 text-3xl"></i>
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* --- ADD/EDIT MODAL --- */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-lg p-8 shadow-2xl animate-fade-in-up border border-gray-100 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white">{editingRule.id ? 'Edit Billing Rule' : 'New Billing Rule'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-500 flex items-center justify-center"><i className="fa-solid fa-xmark"></i></button>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Test Name</label>
                                <input
                                    value={editingRule.testName || ''}
                                    onChange={e => setEditingRule({ ...editingRule, testName: e.target.value })}
                                    className="w-full h-12 px-4 rounded-xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                    placeholder="e.g. Rapid Strep"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">CPT Code</label>
                                <input
                                    value={editingRule.cpt || ''}
                                    onChange={e => setEditingRule({ ...editingRule, cpt: e.target.value })}
                                    className="w-full h-12 px-4 rounded-xl bg-gray-50 dark:bg-gray-800 border-none font-mono font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                    placeholder="e.g. 87880"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Authorized Insurers</label>
                                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar p-1">
                                    {INSURERS.map(ins => (
                                        <button
                                            key={ins}
                                            onClick={() => toggleInsurerInEdit(ins)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${editingRule.insurers?.includes(ins)
                                                ? 'bg-emerald-600 text-white border-emerald-600'
                                                : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'
                                                }`}
                                        >
                                            {ins}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setIsModalOpen(false)} className="flex-1 h-12 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
                            <button onClick={handleSave} className="flex-1 h-12 rounded-xl bg-emerald-600 text-white font-bold shadow-lg hover:bg-emerald-500 transition-colors">Save Rule</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* --- BILLING INFO MODAL (INFORMATIVE) --- */}
            {isInfoModalOpen && createPortal(
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-6 bg-slate-900/80 backdrop-blur-md animate-fade-in" onClick={() => setIsInfoModalOpen(false)}>
                    <div
                        className="bg-slate-900 border border-slate-700/50 rounded-[2rem] w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Decorative Top Glow */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-indigo-500/20 rounded-full blur-[80px] pointer-events-none"></div>

                        {/* Floating Header Area */}
                        <div className="p-8 pb-4 flex items-start justify-between flex-shrink-0 relative z-10">
                            <div>
                                <h3 className="text-3xl font-black text-white tracking-tight leading-tight">{t('guide_title')}</h3>
                                <div className="mt-2 text-indigo-200/80 font-bold uppercase tracking-widest text-xs">{t('guide_subtitle')}</div>
                            </div>
                            <div className="w-12 h-12 rounded-[14px] bg-white/5 flex items-center justify-center text-teal-400 border border-white/10 shadow-inner backdrop-blur-md">
                                <i className="fa-solid fa-lightbulb text-xl"></i>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="p-8 pt-4 space-y-6 overflow-y-auto custom-scrollbar flex-1 relative z-10">
                            <div className="space-y-4">
                                {/* Rule 1 Block (Green/Positive "Hero") */}
                                <div className="bg-[#0a231c] p-6 rounded-2xl border border-emerald-500/20 flex gap-5 items-center shadow-lg">
                                    <div className="w-10 h-10 rounded-full bg-emerald-500/90 text-white flex-shrink-0 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                                        <div className="w-3 h-3 rounded-full bg-white animate-pulse"></div>
                                    </div>
                                    <p className="text-emerald-50 font-medium leading-relaxed text-sm md:text-base">
                                        {t('guide_body')}
                                    </p>
                                </div>

                                {/* Rule 2 Block (Orange/Warning) */}
                                <div className="bg-[#24130a] p-5 rounded-2xl border border-amber-500/20 flex gap-4 items-center shadow-lg">
                                    <div className="w-6 h-6 rounded-full bg-amber-500/90 text-amber-950 flex-shrink-0 flex items-center justify-center text-xs font-black shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                                        !
                                    </div>
                                    <p className="text-amber-100/90 font-medium text-sm leading-relaxed">
                                        {t('guide_warning')}
                                    </p>
                                </div>
                            </div>

                            {/* Restyled Insurers Pill List */}
                            <div className="pt-6">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 text-center">
                                    {t('guide_note_title')}
                                </h4>
                                <div className="flex flex-wrap justify-center gap-2 lg:gap-3">
                                    {INSURERS.sort().map((ins) => {
                                        // Assign dot colors matching the mockup
                                        let dotColor = "bg-blue-500";
                                        let dotGlow = "shadow-[0_0_8px_rgba(59,130,246,0.6)]";

                                        if (['Aetna', 'BCBS', 'Anthem BCBS', 'Cigna'].includes(ins)) {
                                            dotColor = "bg-indigo-500";
                                            dotGlow = "shadow-[0_0_8px_rgba(99,102,241,0.6)]";
                                        }

                                        return (
                                            <div
                                                key={ins}
                                                className="px-4 py-2 bg-white/5 rounded-xl border border-white/5 flex items-center gap-2.5 backdrop-blur-md transition-all hover:bg-white/10"
                                            >
                                                <div className={`w-2.5 h-2.5 rounded-full ${dotColor} ${dotGlow}`}></div>
                                                <span className="font-bold text-gray-200 text-sm tracking-wide">
                                                    {ins}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Refined Footer */}
                        <div className="px-8 pb-8 pt-2 flex justify-center flex-shrink-0 relative z-10">
                            <button
                                onClick={() => setIsInfoModalOpen(false)}
                                className="px-10 py-3.5 bg-white text-black rounded-xl font-black text-xs md:text-sm uppercase tracking-[0.15em] hover:bg-gray-100 hover:scale-[1.02] transition-all duration-200 shadow-[0_4px_20px_rgba(255,255,255,0.15)] active:scale-95"
                            >
                                {t('btn_understood')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default BillingWizard;
