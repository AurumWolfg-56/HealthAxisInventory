
import React, { useState, useMemo } from 'react';
import { MedicalCode, CodeGroup, User, UserRole } from '../types';

interface MedicalCodesManagerProps {
    codes: MedicalCode[];
    groups: CodeGroup[];
    user: User;
    onSaveCode: (code: MedicalCode) => void;
    onDeleteCode: (id: string) => void;
    onSaveGroup: (group: CodeGroup) => void;
    onDeleteGroup: (id: string) => void;
    isLoadingCodes?: boolean;
    canManage: boolean;
    t: (key: string) => string;
}

const MedicalCodesManager: React.FC<MedicalCodesManagerProps> = ({ codes, groups, user, onSaveCode, onDeleteCode, onSaveGroup, onDeleteGroup, isLoadingCodes, canManage, t }) => {
    const [activeTab, setActiveTab] = useState<'search' | 'groups'>('search');
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedText, setCopiedText] = useState<string | null>(null);

    // Code Editor State
    const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
    const [editingCode, setEditingCode] = useState<Partial<MedicalCode>>({});

    // Group Editor State
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Partial<CodeGroup>>({});
    const [groupSearchTerm, setGroupSearchTerm] = useState(''); // Search inside group builder

    // Group Viewer State
    const [viewingGroup, setViewingGroup] = useState<CodeGroup | null>(null);
    const [viewSearchTerm, setViewSearchTerm] = useState('');

    // Permissions Check
    const canEdit = canManage;

    // Filter Logic - Now returns both Codes and Groups for the main search view
    const searchResults = useMemo(() => {
        const lowerTerm = searchTerm.toLowerCase();

        // Filter Codes
        const matchingCodes = codes.filter(code =>
            code.name.toLowerCase().includes(lowerTerm) ||
            code.cptCode.toLowerCase().includes(lowerTerm) ||
            code.labCode.toLowerCase().includes(lowerTerm)
        );

        // Filter Groups
        const matchingGroups = groups.filter(group =>
            group.name.toLowerCase().includes(lowerTerm)
        );

        return { codes: matchingCodes, groups: matchingGroups };
    }, [codes, groups, searchTerm]);

    // Filter codes for Group Builder Modal
    const groupBuilderCodes = useMemo(() => {
        const lower = groupSearchTerm.toLowerCase();
        if (!lower) return [];
        return codes.filter(c => c.name.toLowerCase().includes(lower) || c.cptCode.includes(lower)).slice(0, 10);
    }, [codes, groupSearchTerm]);

    // Filter codes for View Modal
    const filteredViewCodes = useMemo(() => {
        if (!viewingGroup) return [];
        const groupCodes = viewingGroup.codeIds.map(id => codes.find(c => c.id === id)).filter(Boolean) as MedicalCode[];

        if (!viewSearchTerm) return groupCodes;

        const lower = viewSearchTerm.toLowerCase();
        return groupCodes.filter(c =>
            c.name.toLowerCase().includes(lower) ||
            c.cptCode.includes(lower) ||
            c.labCode.includes(lower) ||
            c.adminCode.includes(lower)
        );
    }, [viewingGroup, codes, viewSearchTerm]);

    // Helpers
    const handleCopy = (text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedText(text);
        setTimeout(() => setCopiedText(null), 1500);
    };

    const openCodeModal = (code?: MedicalCode) => {
        setEditingCode(code || { name: '', cptCode: '', labCode: '', adminCode: '' });
        setIsCodeModalOpen(true);
    };

    const saveCode = () => {
        if (!editingCode.name) return;
        onSaveCode({
            id: editingCode.id || '',
            name: editingCode.name || '',
            cptCode: editingCode.cptCode || '',
            labCode: editingCode.labCode || '',
            adminCode: editingCode.adminCode || ''
        });
        setIsCodeModalOpen(false);
    };

    const openGroupModal = (group?: CodeGroup) => {
        setEditingGroup(group || { name: '', description: '', codeIds: [] });
        setGroupSearchTerm('');
        setIsGroupModalOpen(true);
    };

    const saveGroup = () => {
        if (!editingGroup.name) return;
        onSaveGroup({
            id: editingGroup.id || '',
            name: editingGroup.name || '',
            description: editingGroup.description || '',
            codeIds: editingGroup.codeIds || []
        });
        setIsGroupModalOpen(false);
    };

    const toggleCodeInGroup = (codeId: string) => {
        const currentIds = editingGroup.codeIds || [];
        if (currentIds.includes(codeId)) {
            setEditingGroup({ ...editingGroup, codeIds: currentIds.filter(id => id !== codeId) });
        } else {
            setEditingGroup({ ...editingGroup, codeIds: [...currentIds, codeId] });
        }
    };

    const handlePrintPanel = () => {
        if (!viewingGroup) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const codesList = viewingGroup.codeIds.map(id => codes.find(c => c.id === id)).filter(Boolean) as MedicalCode[];

        printWindow.document.write(`
        <html>
          <head>
            <title>Panel: ${viewingGroup.name}</title>
            <style>
              body { font-family: sans-serif; padding: 20px; }
              h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
            </style>
          </head>
          <body>
            <h1>${viewingGroup.name}</h1>
            <p>${viewingGroup.description || ''}</p>
            <table>
              <thead>
                <tr>
                  <th>Procedure Name</th>
                  <th>CPT Code</th>
                  <th>Lab Code</th>
                  <th>Admin Code</th>
                </tr>
              </thead>
              <tbody>
                ${codesList.map(c => `
                  <tr>
                    <td><strong>${c.name}</strong></td>
                    <td>${c.cptCode || '-'}</td>
                    <td>${c.labCode || '-'}</td>
                    <td>${c.adminCode || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <script>window.print();</script>
          </body>
        </html>
      `);
        printWindow.document.close();
    };

    return (
        <div className="space-y-8 pb-20 animate-fade-in-up max-w-7xl mx-auto">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-medical-500 flex items-center justify-center text-white shadow-lg shadow-medical-500/20">
                            <i className="fa-solid fa-list-ol text-xl"></i>
                        </div>
                        <div>
                            <h2 className="text-display text-slate-900 dark:text-white">
                                Medical Codes
                            </h2>
                            <p className="text-caption mt-0.5">
                                Registry for Procedures and Exam Panels.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="glass-panel p-1.5 rounded-2xl flex shadow-sm">
                    <button
                        onClick={() => setActiveTab('search')}
                        className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'search' ? 'bg-white dark:bg-slate-800 shadow-sm text-medical-600 dark:text-medical-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Browse & Search
                    </button>
                    <button
                        onClick={() => setActiveTab('groups')}
                        className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'groups' ? 'bg-white dark:bg-slate-800 shadow-sm text-purple-600 dark:text-purple-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Panel Management
                    </button>
                </div>
            </header>

            {/* --- BROWSE & SEARCH TAB (UNIFIED VIEW) --- */}
            {activeTab === 'search' && (
                <>
                    {/* Search Bar & Add Button */}
                    <div className="flex gap-4">
                        <div className="glass-panel p-3 rounded-[2rem] luxury-shadow flex-1 transition-all border-white/50 dark:border-slate-800/80">
                            <div className="relative group">
                                <div className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none transition-transform group-focus-within:scale-110">
                                    <i className="fa-solid fa-magnifying-glass text-xl text-slate-400 group-focus-within:text-medical-500 transition-colors"></i>
                                </div>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search Panels, CPT, Lab, or Admin codes..."
                                    className="w-full pl-16 pr-12 h-14 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:outline-none font-bold text-lg placeholder-slate-400 rounded-[1.5rem] border-none focus:ring-4 ring-medical-500/10 transition-all"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-all"
                                    >
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                )}
                            </div>
                        </div>
                        {canEdit && (
                            <button
                                onClick={() => openCodeModal()}
                                className="h-14 w-14 rounded-2xl bg-medical-600 hover:bg-medical-500 text-white shadow-xl shadow-medical-500/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                                title="Add Single Code"
                            >
                                <i className="fa-solid fa-plus text-xl"></i>
                            </button>
                        )}
                    </div>

                    {/* Results Count */}
                    <div className="flex justify-between items-end px-2">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
                            {searchResults.groups.length + searchResults.codes.length} Results Found
                        </h3>
                    </div>

                    {/* RESULTS GRID */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">

                        {/* 1. RENDER GROUPS/PANELS FIRST */}
                        {searchResults.groups.map(group => (
                            <div
                                key={group.id}
                                onClick={() => { setViewingGroup(group); setViewSearchTerm(''); }}
                                className="group relative bg-white dark:bg-gray-900 rounded-[2rem] p-0 shadow-md border-2 border-purple-100 dark:border-purple-900/30 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full overflow-hidden cursor-pointer"
                            >
                                {/* Header */}
                                <div className="bg-purple-50 dark:bg-purple-900/20 p-6 border-b border-purple-100 dark:border-purple-800/50 relative">
                                    <div className="flex justify-between items-start mb-1">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="px-2 py-0.5 rounded-md bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 text-[10px] font-bold uppercase tracking-wider">
                                                    Exam Panel
                                                </span>
                                            </div>
                                            <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight pr-8">
                                                {group.name}
                                            </h3>
                                            {group.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{group.description}</p>}
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-black text-purple-600 dark:text-purple-400">{group.codeIds.length}</div>
                                            <div className="text-[9px] font-bold text-gray-400 uppercase">Tests</div>
                                        </div>
                                    </div>

                                    {/* Panel Controls (Edit/Delete) - Similar to individual codes */}
                                    {canEdit && (
                                        <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-black/80 backdrop-blur-sm rounded-lg p-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openGroupModal(group); }}
                                                className="w-8 h-8 flex items-center justify-center rounded-md text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                                title="Edit Panel"
                                            >
                                                <i className="fa-solid fa-pen"></i>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this panel?')) onDeleteGroup(group.id); }}
                                                className="w-8 h-8 flex items-center justify-center rounded-md text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50"
                                                title="Delete Panel"
                                            >
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* List of Codes in Panel */}
                                <div className="p-4 flex-1 bg-white dark:bg-gray-900 overflow-y-auto max-h-[300px] custom-scrollbar space-y-3">
                                    {group.codeIds.map(codeId => {
                                        const code = codes.find(c => c.id === codeId);
                                        if (!code) return null;
                                        return (
                                            <div key={codeId} className="border-b border-gray-100 dark:border-gray-800 pb-2 last:border-0 last:pb-0">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-snug">{code.name}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {code.cptCode && (
                                                        <div className="group/chip flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-[10px] cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" onClick={(e) => { e.stopPropagation(); handleCopy(code.cptCode) }}>
                                                            <span className="text-gray-400 font-bold">CPT:</span>
                                                            <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{code.cptCode}</span>
                                                            <i className="fa-regular fa-copy ml-1 opacity-0 group-hover/chip:opacity-100 text-gray-400"></i>
                                                        </div>
                                                    )}
                                                    {code.labCode && (
                                                        <div className="group/chip flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded text-[10px] cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors" onClick={(e) => { e.stopPropagation(); handleCopy(code.labCode) }}>
                                                            <span className="text-blue-400 font-bold">LAB:</span>
                                                            <span className="font-mono font-bold text-blue-700 dark:text-blue-300">{code.labCode}</span>
                                                            <i className="fa-regular fa-copy ml-1 opacity-0 group-hover/chip:opacity-100 text-blue-400"></i>
                                                        </div>
                                                    )}
                                                    {code.adminCode && (
                                                        <div className="group/chip flex items-center gap-1 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded text-[10px] cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors" onClick={(e) => { e.stopPropagation(); handleCopy(code.adminCode) }}>
                                                            <span className="text-purple-400 font-bold">ADM:</span>
                                                            <span className="font-mono font-bold text-purple-700 dark:text-purple-300">{code.adminCode}</span>
                                                            <i className="fa-regular fa-copy ml-1 opacity-0 group-hover/chip:opacity-100 text-purple-400"></i>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {/* 2. RENDER INDIVIDUAL CODES */}
                        {searchResults.codes.map((code) => (
                            <div
                                key={code.id}
                                className="group relative bg-white dark:bg-gray-900 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-xl hover:shadow-cyan-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col h-full min-h-[200px]"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors pr-2">
                                        {code.name}
                                    </h3>
                                    {canEdit && (
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openCodeModal(code)} className="text-gray-400 hover:text-blue-500"><i className="fa-solid fa-pen"></i></button>
                                            <button onClick={() => { if (window.confirm('Delete code?')) onDeleteCode(code.id) }} className="text-gray-400 hover:text-red-500"><i className="fa-solid fa-trash"></i></button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3 mt-auto">
                                    {/* CPT CODE */}
                                    <div className="flex justify-between items-center p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
                                        <span className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">CPT Code</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-black text-lg text-gray-800 dark:text-gray-100">
                                                {code.cptCode || <span className="text-gray-300 italic text-sm">N/A</span>}
                                            </span>
                                            {code.cptCode && (
                                                <button
                                                    onClick={() => handleCopy(code.cptCode)}
                                                    className="text-gray-400 hover:text-cyan-500 transition-colors"
                                                    title="Copy CPT"
                                                >
                                                    <i className={`fa-solid ${copiedText === code.cptCode ? 'fa-check text-green-500' : 'fa-copy'}`}></i>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* LAB CODE */}
                                    {code.labCode && (
                                        <div className="flex justify-between items-center p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
                                            <span className="text-xs font-extrabold text-blue-400 uppercase tracking-wider">Lab Code</span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-black text-lg text-blue-700 dark:text-blue-300">
                                                    {code.labCode}
                                                </span>
                                                <button
                                                    onClick={() => handleCopy(code.labCode)}
                                                    className="text-blue-300 hover:text-blue-500 transition-colors"
                                                    title="Copy Lab Code"
                                                >
                                                    <i className={`fa-solid ${copiedText === code.labCode ? 'fa-check text-green-500' : 'fa-copy'}`}></i>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* ADMIN CODE */}
                                    {code.adminCode && (
                                        <div className="flex justify-between items-center p-3 rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30">
                                            <span className="text-xs font-extrabold text-purple-400 uppercase tracking-wider">Admin Code</span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-black text-lg text-purple-700 dark:text-purple-300">
                                                    {code.adminCode}
                                                </span>
                                                <button
                                                    onClick={() => handleCopy(code.adminCode)}
                                                    className="text-purple-300 hover:text-purple-500 transition-colors"
                                                    title="Copy Admin Code"
                                                >
                                                    <i className={`fa-solid ${copiedText === code.adminCode ? 'fa-check text-green-500' : 'fa-copy'}`}></i>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* No Results */}
                        {searchResults.codes.length === 0 && searchResults.groups.length === 0 && (
                            <div className="col-span-full py-24 text-center">
                                <div className="inline-block p-8 rounded-full bg-gray-50 dark:bg-gray-800 mb-6 animate-bounce-slow shadow-sm">
                                    <i className="fa-solid fa-magnifying-glass text-5xl text-gray-300 dark:text-gray-600"></i>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No codes or panels found</h3>
                                <p className="text-gray-500 dark:text-gray-400">Try adjusting your search criteria.</p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* --- GROUPS MANAGEMENT TAB (EDITING ONLY) --- */}
            {activeTab === 'groups' && (
                <div className="space-y-6">
                    {canEdit && (
                        <button
                            onClick={() => openGroupModal()}
                            className="w-full h-16 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.01]"
                        >
                            <i className="fa-solid fa-layer-group"></i> Create New Panel / Group
                        </button>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {groups.length === 0 ? (
                            <div className="col-span-full text-center py-20 bg-gray-50 dark:bg-gray-900 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
                                <i className="fa-solid fa-boxes-stacked text-4xl text-gray-300 mb-4"></i>
                                <p className="font-bold text-gray-500">No Exam Panels Created Yet</p>
                            </div>
                        ) : (
                            groups.map(group => (
                                <div
                                    key={group.id}
                                    onClick={() => { setViewingGroup(group); setViewSearchTerm(''); }}
                                    className="bg-white dark:bg-gray-900 rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-gray-800 cursor-pointer hover:shadow-md transition-all duration-300 group"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-2xl font-black text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">{group.name}</h3>
                                            {group.description && <p className="text-gray-500 dark:text-gray-400 mt-1">{group.description}</p>}
                                        </div>
                                        {canEdit && (
                                            <div className="flex gap-2">
                                                <button onClick={(e) => { e.stopPropagation(); openGroupModal(group); }} className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-blue-500 hover:text-white transition-colors text-gray-500"><i className="fa-solid fa-pen"></i></button>
                                                <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete group?')) onDeleteGroup(group.id); }} className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-red-500 hover:text-white transition-colors text-gray-500"><i className="fa-solid fa-trash"></i></button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 gap-2 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl max-h-[200px] overflow-y-auto custom-scrollbar">
                                        {group.codeIds.map(codeId => {
                                            const code = codes.find(c => c.id === codeId);
                                            if (!code) return null;
                                            return (
                                                <div key={codeId} className="flex justify-between items-center text-sm">
                                                    <span className="font-bold text-gray-700 dark:text-gray-300 truncate pr-2 w-2/3">{code.name}</span>
                                                    <span className="font-mono text-xs text-gray-400">{code.cptCode}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* --- CODE MODAL --- */}
            {isCodeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsCodeModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-lg p-6 shadow-2xl animate-fade-in-up border border-gray-100 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-6">{editingCode.id ? 'Edit Code' : 'Add New Code'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Procedure Name</label>
                                <input
                                    value={editingCode.name || ''}
                                    onChange={e => setEditingCode({ ...editingCode, name: e.target.value })}
                                    className="w-full h-12 px-4 rounded-xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500/20"
                                    placeholder="e.g. Rapid Strep"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">CPT Code</label>
                                <input
                                    value={editingCode.cptCode || ''}
                                    onChange={e => setEditingCode({ ...editingCode, cptCode: e.target.value })}
                                    className="w-full h-12 px-4 rounded-xl bg-gray-50 dark:bg-gray-800 border-none font-bold font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500/20"
                                    placeholder="e.g. 87880"
                                />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Lab Code</label>
                                    <input
                                        value={editingCode.labCode || ''}
                                        onChange={e => setEditingCode({ ...editingCode, labCode: e.target.value })}
                                        className="w-full h-12 px-4 rounded-xl bg-gray-50 dark:bg-gray-800 border-none font-bold font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Admin Code</label>
                                    <input
                                        value={editingCode.adminCode || ''}
                                        onChange={e => setEditingCode({ ...editingCode, adminCode: e.target.value })}
                                        className="w-full h-12 px-4 rounded-xl bg-gray-50 dark:bg-gray-800 border-none font-bold font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button disabled={isLoadingCodes} onClick={() => setIsCodeModalOpen(false)} className="flex-1 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 font-bold text-gray-600 dark:text-gray-300">Cancel</button>
                            <button disabled={isLoadingCodes} onClick={saveCode} className="flex-1 h-12 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-lg flex justify-center items-center gap-2">
                                {isLoadingCodes ? <i className="fa-solid fa-spinner fa-spin"></i> : null}
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- GROUP MODAL (LARGER & IMPROVED) --- */}
            {isGroupModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsGroupModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-4xl p-8 shadow-2xl animate-fade-in-up border border-gray-100 dark:border-gray-800 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-6">{editingGroup.id ? 'Edit Panel' : 'Create New Panel'}</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Panel Name</label>
                                <input
                                    value={editingGroup.name || ''}
                                    onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })}
                                    className="w-full h-14 px-5 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-xl text-gray-900 dark:text-white focus:ring-4 focus:ring-purple-500/10 placeholder-gray-400"
                                    placeholder="e.g. Routine Labs"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Description (Optional)</label>
                                <input
                                    value={editingGroup.description || ''}
                                    onChange={e => setEditingGroup({ ...editingGroup, description: e.target.value })}
                                    className="w-full h-14 px-5 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-lg text-gray-900 dark:text-white focus:ring-4 focus:ring-purple-500/10 placeholder-gray-400"
                                    placeholder="Short description"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-gray-50 dark:bg-gray-950 rounded-3xl border border-gray-200 dark:border-gray-800">
                            {/* Search Area */}
                            <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                                <div className="relative">
                                    <i className="fa-solid fa-magnifying-glass absolute left-4 top-3.5 text-gray-400"></i>
                                    <input
                                        value={groupSearchTerm}
                                        onChange={e => setGroupSearchTerm(e.target.value)}
                                        className="w-full h-12 pl-12 pr-4 bg-gray-100 dark:bg-gray-800 rounded-xl text-base font-bold outline-none text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500/50 transition-all"
                                        placeholder="Search codes to add..."
                                    />
                                </div>

                                {groupSearchTerm && (
                                    <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                        {groupBuilderCodes.map(c => (
                                            <div key={c.id} className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-purple-300 transition-colors">
                                                <div className="flex-1 min-w-0 mr-3">
                                                    <div className="font-bold text-base text-gray-900 dark:text-white">{c.name}</div>
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        {c.cptCode && <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs font-mono font-bold text-gray-600 dark:text-gray-300">CPT: {c.cptCode}</span>}
                                                        {c.labCode && <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-xs font-mono font-bold text-blue-600 dark:text-blue-400">LAB: {c.labCode}</span>}
                                                        {c.adminCode && <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-900/30 text-xs font-mono font-bold text-purple-600 dark:text-purple-400">ADM: {c.adminCode}</span>}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => { toggleCodeInGroup(c.id); setGroupSearchTerm(''); }}
                                                    disabled={editingGroup.codeIds?.includes(c.id)}
                                                    className={`h-10 px-4 rounded-xl font-bold text-sm transition-all ${editingGroup.codeIds?.includes(c.id)
                                                        ? 'bg-green-100 text-green-700 cursor-default'
                                                        : 'bg-purple-600 text-white hover:bg-purple-500 shadow-md transform active:scale-95'
                                                        }`}
                                                >
                                                    {editingGroup.codeIds?.includes(c.id) ? 'Added' : 'Add'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Selected List */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                <div className="flex justify-between items-center mb-2 px-1">
                                    <span className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">Selected Codes ({editingGroup.codeIds?.length || 0})</span>
                                    {editingGroup.codeIds?.length === 0 && <span className="text-xs text-gray-400 italic">List is empty</span>}
                                </div>

                                {editingGroup.codeIds?.map(id => {
                                    const code = codes.find(c => c.id === id);
                                    if (!code) return null;
                                    return (
                                        <div key={id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-purple-300 transition-colors gap-4 animate-fade-in-up">
                                            <div className="flex-1">
                                                <div className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-3">{code.name}</div>

                                                {/* Badges Container - Full Visualization */}
                                                <div className="flex flex-wrap gap-3">
                                                    {code.cptCode && (
                                                        <div className="group/chip flex items-center gap-3 bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-xl cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600" onClick={() => handleCopy(code.cptCode)}>
                                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">CPT</span>
                                                            <span className="font-mono font-black text-gray-800 dark:text-gray-200 text-lg">{code.cptCode}</span>
                                                            <i className="fa-regular fa-copy opacity-0 group-hover/chip:opacity-100 text-gray-400 transition-opacity"></i>
                                                        </div>
                                                    )}
                                                    {code.labCode && (
                                                        <div className="group/chip flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-xl cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors border border-blue-100 dark:border-blue-900/30" onClick={() => handleCopy(code.labCode)}>
                                                            <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">LAB</span>
                                                            <span className="font-mono font-black text-blue-700 dark:text-blue-300 text-lg">{code.labCode}</span>
                                                            <i className="fa-regular fa-copy opacity-0 group-hover/chip:opacity-100 text-blue-400 transition-opacity"></i>
                                                        </div>
                                                    )}
                                                    {code.adminCode && (
                                                        <div className="group/chip flex items-center gap-3 bg-purple-50 dark:bg-purple-900/20 px-4 py-2 rounded-xl cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors border border-purple-100 dark:border-purple-900/30" onClick={() => handleCopy(code.adminCode)}>
                                                            <span className="text-xs font-bold text-purple-500 uppercase tracking-wider">ADM</span>
                                                            <span className="font-mono font-black text-purple-700 dark:text-purple-300 text-lg">{code.adminCode}</span>
                                                            <i className="fa-regular fa-copy opacity-0 group-hover/chip:opacity-100 text-purple-400 transition-opacity"></i>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => toggleCodeInGroup(id)}
                                                className="self-start md:self-center w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center transition-colors"
                                                title="Remove from panel"
                                            >
                                                <i className="fa-solid fa-xmark text-xl"></i>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex gap-4 mt-8 pt-4 border-t border-gray-100 dark:border-gray-800">
                            <button disabled={isLoadingCodes} onClick={() => setIsGroupModalOpen(false)} className="flex-1 h-14 rounded-2xl border-2 border-gray-100 dark:border-gray-800 font-bold text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
                            <button disabled={isLoadingCodes} onClick={saveGroup} className="flex-1 h-14 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-xl shadow-purple-500/20 transition-transform hover:scale-[1.01] flex justify-center items-center gap-2">
                                {isLoadingCodes ? <i className="fa-solid fa-spinner fa-spin"></i> : null}
                                Save Panel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- PANEL VIEW WINDOW (EXPANDED DETAIL) --- */}
            {viewingGroup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm" onClick={() => setViewingGroup(null)}>
                    <div
                        className="bg-white dark:bg-gray-900 rounded-[2.5rem] w-full max-w-3xl shadow-2xl animate-fade-in-up border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[85vh] relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-purple-600 p-8 relative overflow-hidden flex-shrink-0">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                            {/* Close Button (Top Right) */}
                            <button
                                onClick={() => setViewingGroup(null)}
                                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/20 text-white hover:bg-black/40 flex items-center justify-center transition-colors backdrop-blur-sm z-20"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>

                            <div className="relative z-10">
                                {/* Badge Row + Print Button */}
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white/20 backdrop-blur-md text-white text-xs font-bold uppercase tracking-wider">
                                        <i className="fa-solid fa-layer-group"></i> Exam Panel
                                    </div>
                                    <button
                                        onClick={handlePrintPanel}
                                        className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider transition-colors backdrop-blur-md border border-white/10"
                                        title="Print Panel Details"
                                    >
                                        <i className="fa-solid fa-print"></i> Print List
                                    </button>
                                </div>

                                <h2 className="text-4xl font-black text-white mb-2 tracking-tight pr-12">{viewingGroup.name}</h2>
                                {viewingGroup.description && <p className="text-purple-100 text-lg font-medium pr-12">{viewingGroup.description}</p>}
                            </div>
                        </div>

                        {/* Controls Bar */}
                        <div className="px-8 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0">
                            <div className="relative w-full md:w-auto flex-1">
                                <i className="fa-solid fa-search absolute left-3 top-3 text-gray-400"></i>
                                <input
                                    type="text"
                                    value={viewSearchTerm}
                                    onChange={(e) => setViewSearchTerm(e.target.value)}
                                    placeholder={`Search ${viewingGroup.codeIds.length} codes...`}
                                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-gray-900 dark:text-white font-bold text-sm"
                                />
                            </div>

                            {canEdit && (
                                <button
                                    onClick={() => {
                                        setEditingGroup(viewingGroup);
                                        setGroupSearchTerm('');
                                        setIsGroupModalOpen(true);
                                        setViewingGroup(null);
                                    }}
                                    className="px-4 py-2 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 font-bold text-xs hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors flex items-center gap-2 whitespace-nowrap"
                                >
                                    <i className="fa-solid fa-pen"></i> Edit Panel
                                </button>
                            )}
                        </div>

                        {/* List */}
                        <div className="p-6 overflow-y-auto custom-scrollbar bg-white dark:bg-gray-900 space-y-3 flex-1 min-h-0">
                            {filteredViewCodes.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">No codes found matching "{viewSearchTerm}"</div>
                            ) : (
                                filteredViewCodes.map((code, idx) => (
                                    <div key={code.id} className={`p-5 rounded-2xl border border-gray-100 dark:border-gray-700 transition-colors group ${idx % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-800/30' : 'bg-white dark:bg-gray-800/10'} hover:border-purple-300 dark:hover:border-purple-700`}>
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="text-xl font-bold text-gray-900 dark:text-white">{code.name}</h4>
                                        </div>

                                        <div className="flex flex-wrap gap-3">
                                            {code.cptCode && (
                                                <div className="flex items-center gap-3 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" onClick={() => handleCopy(code.cptCode)}>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">CPT</span>
                                                    <span className="font-mono font-black text-gray-900 dark:text-white text-lg">{code.cptCode}</span>
                                                    <i className="fa-regular fa-copy text-gray-300 text-xs ml-1"></i>
                                                </div>
                                            )}
                                            {code.labCode && (
                                                <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-xl border border-blue-100 dark:border-blue-900/30 shadow-sm cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors" onClick={() => handleCopy(code.labCode)}>
                                                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">LAB</span>
                                                    <span className="font-mono font-black text-blue-700 dark:text-blue-300 text-lg">{code.labCode}</span>
                                                    <i className="fa-regular fa-copy text-blue-400 text-xs ml-1"></i>
                                                </div>
                                            )}
                                            {code.adminCode && (
                                                <div className="flex items-center gap-3 bg-purple-50 dark:bg-purple-900/20 px-4 py-2 rounded-xl border border-purple-100 dark:border-purple-900/30 shadow-sm cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors" onClick={() => handleCopy(code.adminCode)}>
                                                    <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider">ADM</span>
                                                    <span className="font-mono font-black text-purple-700 dark:text-purple-300 text-lg">{code.adminCode}</span>
                                                    <i className="fa-regular fa-copy text-purple-400 text-xs ml-1"></i>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer - Close Button */}
                        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-end flex-shrink-0">
                            <button
                                onClick={() => setViewingGroup(null)}
                                className="px-8 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm uppercase tracking-wide"
                            >
                                Close Window
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default MedicalCodesManager;
