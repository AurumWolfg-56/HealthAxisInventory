import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { User, Protocol, ProtocolSeverity, ProtocolArea, ProtocolType } from '../types';
import { useAppData } from '../contexts/AppDataContext';
import { useAuth } from '../contexts/AuthContext';
import { ProtocolService } from '../services/ProtocolService';
import { supabase } from '../src/lib/supabase';
import ProtocolModal from './ProtocolModal';
import ProtocolSignaturesModal from './ProtocolSignaturesModal';
import { RichTextContent } from './RichTextContent';

interface ProtocolsProps {
    user: User | null;
    users?: User[];
    t: (key: string) => string;
}

// RichTextContent is imported from components/RichTextContent.tsx

const Protocols: React.FC<ProtocolsProps> = ({ user, users = [], t }) => {
    const { protocols, setProtocols, refreshData, isLoading } = useAppData();
    const { hasPermission } = useAuth();
    const isManager = hasPermission('protocols.manage');

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedArea, setSelectedArea] = useState<ProtocolArea | 'ALL'>('ALL');
    const [selectedType, setSelectedType] = useState<ProtocolType | 'ALL'>('ALL');
    const [selectedSeverity, setSelectedSeverity] = useState<ProtocolSeverity | 'ALL'>('ALL');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProtocol, setEditingProtocol] = useState<Protocol | undefined>(undefined);

    // Accordion UI State
    const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
        PINNED: true,
        EMERGENCY: true,
        HIPAA: true,
        OSHA: true,
        STANDARD: true
    });

    const toggleFolder = (folder: string) => {
        setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
    };

    // Acknowledgments sync state
    const [myAcknowledgments, setMyAcknowledgments] = useState<Record<string, boolean>>({});
    const [allAcknowledgments, setAllAcknowledgments] = useState<any[]>([]);
    const [loadingAcks, setLoadingAcks] = useState(true);

    const [viewingSignaturesFor, setViewingSignaturesFor] = useState<Protocol | undefined>(undefined);

    useEffect(() => {
        const fetchAcks = async () => {
            if (!user?.id) return;
            try {
                const acks = await ProtocolService.getAcknowledgments();
                setAllAcknowledgments(acks);

                const myAcks = acks.filter(a => a.userId === user.id);
                const ackMap: Record<string, boolean> = {};
                myAcks.forEach(a => ackMap[a.protocolId] = true);
                setMyAcknowledgments(ackMap);
            } catch (e) {
                console.error("Failed to fetch acknowledgments", e);
            } finally {
                setLoadingAcks(false);
            }
        };
        fetchAcks();
    }, [user?.id]);

    const isUserInTargetAudience = (protocol: Protocol) => {
        if (!user) return false;
        if (user.role === 'OWNER' || user.role === 'MANAGER') return true; // Managers always see to verify
        if (!protocol.targetRole || protocol.targetRole === 'ALL_STAFF') return true;
        if (protocol.targetRole === 'MEDICAL_ONLY' && (user.role === 'MA' || user.role === 'DOCTOR')) return true;
        if (protocol.targetRole === 'FRONT_DESK_ONLY' && user.role === 'FRONT_DESK') return true;
        return false;
    };

    // Determine if a protocol has been signed by EVERYONE in its target audience
    const isProtocolFullyAcknowledged = useCallback((protocol: Protocol) => {
        if (!protocol.requiresAcknowledgment) return true;

        const protocolAcks = allAcknowledgments.filter(a => a.protocolId === protocol.id);
        const signedIds = new Set(protocolAcks.map(a => a.userId));

        let targetUsers = users;
        if (protocol.targetRole === 'MEDICAL_ONLY') {
            targetUsers = users.filter(u => u.role === 'MA' || u.role === 'DOCTOR');
        } else if (protocol.targetRole === 'FRONT_DESK_ONLY') {
            targetUsers = users.filter(u => u.role === 'FRONT_DESK');
        } else {
            // ALL_STAFF -> exclude owner/manager from being forced to sign, just the operational staff
            targetUsers = users.filter(u => u.role === 'MA' || u.role === 'FRONT_DESK' || u.role === 'DOCTOR');
        }

        if (targetUsers.length === 0) return true;
        return targetUsers.every(u => signedIds.has(u.id));
    }, [users, allAcknowledgments]);

    useEffect(() => {
        // Bulletproof F5 Refresh Fallback
        let isMounted = true;
        if (protocols.length === 0) {
            supabase.auth.getSession().then(({ data }) => {
                if (data.session && isMounted) {
                    ProtocolService.setAccessToken(data.session.access_token);
                    ProtocolService.getProtocols().then(fetched => {
                        if (fetched && fetched.length > 0 && isMounted) {
                            setProtocols(fetched);
                        }
                    });
                }
            });
        }
        return () => { isMounted = false; };
    }, [protocols.length, setProtocols]);

    // Data filtering with "Advanced Smart Search"
    const filteredProtocols = useMemo(() => {
        let result = protocols;

        if (selectedArea !== 'ALL') result = result.filter(p => p.area === selectedArea);
        if (selectedType !== 'ALL') result = result.filter(p => p.type === selectedType);
        if (selectedSeverity !== 'ALL') result = result.filter(p => p.severity === selectedSeverity);

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(p =>
                p.title.toLowerCase().includes(term) ||
                p.content.toLowerCase().includes(term)
            );
        }

        // Sort by severity (CRITICAL first) then by date
        const severityWeight = { 'CRITICAL': 4, 'WARNING': 3, 'ROUTINE': 2, 'INFO': 1 };
        return result.sort((a, b) => {
            const wA = severityWeight[a.severity] || 0;
            const wB = severityWeight[b.severity] || 0;
            if (wA !== wB) return wB - wA;
            // Handle invalid dates gracefully safely
            const da = new Date(a.updatedAt).getTime() || 0;
            const db = new Date(b.updatedAt).getTime() || 0;
            return db - da;
        });
    }, [protocols, searchTerm, selectedArea, selectedType, selectedSeverity]);

    const unreadCriticals = useMemo(() => {
        if (loadingAcks) return [];
        return protocols.filter(p => p.requiresAcknowledgment && !myAcknowledgments[p.id] && isUserInTargetAudience(p));
    }, [protocols, myAcknowledgments, loadingAcks, user]);

    const groupedProtocols = useMemo(() => {
        return {
            PINNED: filteredProtocols.filter(p => p.isPinned && !isProtocolFullyAcknowledged(p)),
            EMERGENCY: filteredProtocols.filter(p => p.type === 'EMERGENCY'),
            HIPAA: filteredProtocols.filter(p => p.type === 'HIPAA'),
            OSHA: filteredProtocols.filter(p => p.type === 'OSHA'),
            STANDARD: filteredProtocols.filter(p => p.type === 'STANDARD')
        };
    }, [filteredProtocols, isProtocolFullyAcknowledged]);

    const handleSaveProtocol = async (data: Partial<Protocol>) => {
        try {
            if (editingProtocol) {
                const updated = await ProtocolService.updateProtocol(editingProtocol.id, data);
                if (updated) {
                    setProtocols(prev => prev.map(p => p.id === updated.id ? updated : p));
                } else {
                    throw new Error('Failed to update protocol');
                }
            } else {
                const created = await ProtocolService.createProtocol(data as Omit<Protocol, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>);
                if (created) {
                    setProtocols(prev => [created, ...prev]);
                } else {
                    throw new Error('Failed to create protocol. Check permissions.');
                }
            }
            setIsModalOpen(false);
        } catch (error: any) {
            console.error('Protocol save error:', error);
            alert(error?.message || 'An error occurred while saving the protocol.');
        }
    };

    const handleDeleteProtocol = async (id: string) => {
        if (!confirm('Are you sure you want to delete this protocol?')) return;
        const success = await ProtocolService.deleteProtocol(id);
        if (success) {
            setProtocols(prev => prev.filter(p => p.id !== id));
        }
    };

    const handleAcknowledge = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation(); // Prevent accordion expansion
        if (!user?.id) return;
        const success = await ProtocolService.acknowledgeProtocol(id, user.id);
        if (success) {
            setMyAcknowledgments(prev => ({ ...prev, [id]: true }));
            setAllAcknowledgments(prev => [...prev, { protocolId: id, userId: user.id, acknowledgedAt: new Date().toISOString() }]);
        }
    };

    const handlePrint = (protocol: Protocol, e: React.MouseEvent) => {
        e.stopPropagation();
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert("Pop-ups must be allowed to print protocols.");
            return;
        }

        // Format the content for printing
        const cleanedContent = protocol.content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br/>');

        const dateObj = new Date(protocol.updatedAt);
        const safeDate = isNaN(dateObj.getTime()) ? new Date().toLocaleDateString() : dateObj.toLocaleDateString();

        printWindow.document.write(`
            <html>
                <head>
                    <title>${protocol.title} - Protocol</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #111827; max-width: 800px; margin: 0 auto; }
                        .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px; }
                        .title { font-size: 28px; font-weight: 800; margin: 0 0 15px 0; color: #111827; }
                        .meta { display: flex; gap: 15px; color: #4b5563; font-size: 14px; font-weight: 600; }
                        .pill { padding: 4px 10px; border-radius: 6px; background: #f3f4f6; border: 1px solid #e5e7eb; }
                        .content { font-size: 15px; line-height: 1.8; color: #374151; }
                        .footer { margin-top: 50px; padding-top: 20px; border-top: 1px dashed #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
                        @media print { body { padding: 0; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1 class="title">${protocol.title}</h1>
                        <div class="meta">
                            <span class="pill">Type: ${protocol.type}</span>
                            <span class="pill">Area: ${protocol.area.replace('_', ' ')}</span>
                            <span class="pill">Severity: ${protocol.severity}</span>
                            <span class="pill">Target: ${protocol.targetRole ? protocol.targetRole.replace('_', ' ') : 'ALL STAFF'}</span>
                        </div>
                    </div>
                    <div class="content">
                        ${cleanedContent}
                    </div>
                    <div class="footer">
                        Official Clinical Protocol | Updated: ${safeDate} | HealthAxis
                    </div>
                    <script>
                        window.onload = function() { window.print(); window.setTimeout(function(){ window.close(); }, 500); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const getSeverityColor = (severity: ProtocolSeverity) => {
        switch (severity) {
            case 'CRITICAL': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30';
            case 'WARNING': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30';
            case 'ROUTINE': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30';
            case 'INFO': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const renderProtocolCard = (protocol: Protocol) => {
        const isUnread = protocol.requiresAcknowledgment && !myAcknowledgments[protocol.id] && isUserInTargetAudience(protocol);
        const isExpanded = expandedCardId === protocol.id;
        const isCurrentlyPinned = protocol.isPinned && !isProtocolFullyAcknowledged(protocol);

        const dateObj = new Date(protocol.updatedAt);
        const safeDate = isNaN(dateObj.getTime()) ? new Date().toLocaleDateString() : dateObj.toLocaleDateString();

        return (
            <div
                key={protocol.id}
                className={`bg-white dark:bg-[#1a2235] rounded-2xl overflow-hidden shadow-sm transition-all duration-300 border ${isUnread ? 'border-orange-400 dark:border-orange-500 shadow-md shadow-orange-500/20'
                    : isExpanded ? 'border-medical-300 dark:border-medical-500/50 shadow-lg'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
            >
                {/* Accordion Header (Compact) */}
                <div
                    className="p-4 flex items-center justify-between cursor-pointer select-none group"
                    onClick={() => setExpandedCardId(isExpanded ? null : protocol.id)}
                >
                    <div className="flex items-center gap-4 flex-1 overflow-hidden pr-4">
                        <div className={`w-2 h-10 rounded-full flex-shrink-0 ${protocol.severity === 'CRITICAL' ? 'bg-red-500' :
                            protocol.severity === 'WARNING' ? 'bg-orange-400' :
                                protocol.severity === 'INFO' ? 'bg-blue-400' : 'bg-emerald-400'
                            }`}></div>

                        <div className="flex flex-col min-w-0">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white truncate group-hover:text-medical-600 transition-colors">
                                {isCurrentlyPinned && <i className="fa-solid fa-thumbtack text-medical-500 mr-2"></i>}
                                {protocol.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1 opacity-70">
                                <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${getSeverityColor(protocol.severity).split(' ')[1]}`}>
                                    {protocol.severity}
                                </span>
                                <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                                    <i className="fa-solid fa-location-dot mr-1"></i>
                                    {protocol.area.replace('_', ' ')}
                                </span>
                                {isCurrentlyPinned && (
                                    <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-bold whitespace-nowrap border-l border-slate-300 dark:border-slate-700 pl-2">
                                        <i className="fa-solid fa-folder mr-1"></i>
                                        {protocol.type}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {isUnread && (
                            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 rounded-lg text-xs font-bold animate-pulse-slow">
                                <i className="fa-solid fa-signature"></i> Signature Required
                            </div>
                        )}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:bg-medical-50 dark:group-hover:bg-medical-500/10 group-hover:text-medical-600 transition-all ${isExpanded ? 'rotate-180 bg-medical-50 text-medical-600' : ''}`}>
                            <i className="fa-solid fa-chevron-down text-sm"></i>
                        </div>
                    </div>
                </div>

                {/* Accordion Body (Expanded) */}
                {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10">
                        <div className="p-5 sm:p-6">
                            <RichTextContent content={protocol.content} />
                        </div>

                        {/* Footer Actions */}
                        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 dark:bg-slate-800/50 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                            <div className="text-xs font-medium text-slate-500 flex items-center gap-3">
                                <span>Updated: {safeDate}</span>
                                {protocol.targetRole && protocol.targetRole !== 'ALL_STAFF' && (
                                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400">
                                        Target: {protocol.targetRole.replace('_', ' ')}
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={(e) => handlePrint(protocol, e)}
                                    className="px-3 py-2 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 transition-colors shadow-sm"
                                    title="Export to PDF / Print"
                                >
                                    <i className="fa-solid fa-print"></i>
                                </button>

                                {isManager && (
                                    <>
                                        {protocol.requiresAcknowledgment && (
                                            <button onClick={(e) => { e.stopPropagation(); setViewingSignaturesFor(protocol); }} className="px-3 py-2 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 transition-colors shadow-sm">
                                                <i className="fa-solid fa-list-check"></i> Signatures
                                            </button>
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); setEditingProtocol(protocol); setIsModalOpen(true); }} className="px-3 py-2 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-medical-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 transition-colors shadow-sm">
                                            <i className="fa-solid fa-pen"></i> Edit
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteProtocol(protocol.id); }} className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 dark:bg-slate-800 dark:border-slate-700 transition-colors shadow-sm">
                                            <i className="fa-solid fa-trash"></i>
                                        </button>
                                    </>
                                )}

                                {protocol.requiresAcknowledgment && isUserInTargetAudience(protocol) && (
                                    isUnread ? (
                                        <button
                                            onClick={(e) => handleAcknowledge(protocol.id, e)}
                                            className="ml-auto px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-500/30 transition-all flex items-center gap-2"
                                        >
                                            <i className="fa-solid fa-signature animate-bounce-subtle"></i> Sign Now
                                        </button>
                                    ) : (
                                        <span className="ml-auto flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-4 py-2 rounded-xl">
                                            <i className="fa-solid fa-check-double"></i> Signed
                                        </span>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const ProtocolFolder = ({ title, icon, color, protocols, typeKey }: { title: string, icon: string, color: string, protocols: Protocol[], typeKey: string }) => {
        if (protocols.length === 0) return null;
        const isOpen = expandedFolders[typeKey];

        return (
            <div className="mb-6">
                <button
                    onClick={() => toggleFolder(typeKey)}
                    className={`w-full flex items-center justify-between p-4 sm:p-5 rounded-2xl ${color} bg-opacity-10 border border-opacity-20 backdrop-blur-sm transition-all hover:bg-opacity-20`}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/50 dark:bg-black/20 flex items-center justify-center text-2xl shadow-sm">
                            <i className={`fa-solid ${icon}`}></i>
                        </div>
                        <div className="text-left">
                            <h2 className="text-xl font-black tracking-tight">{title}</h2>
                            <p className="text-sm font-semibold opacity-80">{protocols.length} Items</p>
                        </div>
                    </div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-white/50 dark:bg-black/20 text-lg transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                        <i className="fa-solid fa-chevron-down"></i>
                    </div>
                </button>

                {isOpen && (
                    <div className="mt-4 grid gap-3 animate-fade-in pl-2 md:pl-6 border-l-2 border-slate-100 dark:border-slate-800 ml-4 md:ml-6">
                        {protocols.map(renderProtocolCard)}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 pb-32">
            {/* Header section */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">Clinic Protocols</h1>
                    <p className="text-slate-500 dark:text-slate-400 max-w-2xl text-lg relative z-10 leading-relaxed font-medium">
                        Staff Hub for clinical rules, standards, and procedures.
                    </p>
                </div>
                {isManager && (
                    <button
                        onClick={() => { setEditingProtocol(undefined); setIsModalOpen(true); }}
                        className="px-6 py-3.5 bg-medical-600 hover:bg-medical-700 text-white rounded-2xl font-bold shadow-lg shadow-medical-500/30 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <i className="fa-solid fa-plus"></i>
                        Create New Protocol
                    </button>
                )}
            </div>

            {/* Critical Unread Banner */}
            {unreadCriticals.length > 0 && (
                <div className="mb-8 p-5 sm:p-6 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-3xl shadow-xl shadow-red-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 animate-scale-in border border-red-400/50">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 shadow-inner">
                            <i className="fa-solid fa-file-signature animate-wiggle"></i>
                        </div>
                        <div>
                            <h3 className="text-xl font-black tracking-tight">Signatures Required</h3>
                            <p className="font-medium text-white/90 text-sm mt-0.5">
                                You have {unreadCriticals.length} mandatory protocol(s) that require your digital acknowledgment.
                            </p>
                        </div>
                    </div>
                    {/* The specific unread items will have signed orange buttons on them */}
                </div>
            )}

            {/* Smart Search & Filters */}
            <div className="bg-white dark:bg-[#1a2235] border border-slate-100 dark:border-slate-800 rounded-3xl p-4 sm:p-5 mb-8 shadow-sm">
                <div className="flex flex-col lg:flex-row gap-3">
                    {/* Deep Text Search */}
                    <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <i className="fa-solid fa-magnifying-glass text-slate-400"></i>
                        </div>
                        <input
                            type="text"
                            placeholder="Smart Search (e.g. 'blood spill', 'front desk rules')..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-medical-500 hover:border-slate-300 transition-all placeholder:text-slate-400 font-bold"
                        />
                    </div>

                    {/* Stacked Filters */}
                    <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar lg:pb-0">
                        <select
                            value={selectedArea}
                            onChange={e => setSelectedArea(e.target.value as any)}
                            className="px-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-700 dark:text-slate-300 font-bold outline-none focus:ring-2 focus:ring-medical-500 min-w-[140px] hover:border-slate-300 transition-colors"
                        >
                            <option value="ALL">All Areas</option>
                            <option value="FRONT_DESK">Front Desk</option>
                            <option value="MA_STATION">MA Station</option>
                            <option value="EXAM_ROOM">Exam Room</option>
                            <option value="LAB">Laboratory</option>
                            <option value="GENERAL">General</option>
                        </select>

                        <select
                            value={selectedType}
                            onChange={e => setSelectedType(e.target.value as any)}
                            className="px-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-700 dark:text-slate-300 font-bold outline-none focus:ring-2 focus:ring-medical-500 min-w-[140px] hover:border-slate-300 transition-colors"
                        >
                            <option value="ALL">All Rule Types</option>
                            <option value="STANDARD">Standard</option>
                            <option value="HIPAA">HIPAA</option>
                            <option value="OSHA">OSHA</option>
                            <option value="EMERGENCY">Emergency</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Folder View UI */}
            <div className="max-w-5xl mx-auto">
                <ProtocolFolder
                    title="Pinned Announcements 📌"
                    icon="fa-thumbtack text-medical-600 dark:text-medical-400"
                    color="bg-medical-100 text-medical-900 border-medical-300 dark:bg-medical-900/50 dark:text-medical-100 dark:border-medical-500/50"
                    protocols={groupedProtocols.PINNED}
                    typeKey="PINNED"
                />

                <ProtocolFolder
                    title="Emergency & Safety Protocols"
                    icon="fa-truck-medical text-red-600 dark:text-red-400"
                    color="bg-red-100 text-red-900 border-red-300 dark:bg-red-900/50 dark:text-red-100 dark:border-red-500/50"
                    protocols={groupedProtocols.EMERGENCY}
                    typeKey="EMERGENCY"
                />

                <ProtocolFolder
                    title="HIPAA Privacy Rules"
                    icon="fa-shield-halved text-indigo-600 dark:text-indigo-400"
                    color="bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-900/50 dark:text-indigo-100 dark:border-indigo-500/50"
                    protocols={groupedProtocols.HIPAA}
                    typeKey="HIPAA"
                />

                <ProtocolFolder
                    title="OSHA Regulations"
                    icon="fa-triangle-exclamation text-orange-600 dark:text-orange-400"
                    color="bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-900/50 dark:text-orange-100 dark:border-orange-500/50"
                    protocols={groupedProtocols.OSHA}
                    typeKey="OSHA"
                />

                <ProtocolFolder
                    title="Standard Procedures"
                    icon="fa-book-medical text-slate-600 dark:text-slate-400"
                    color="bg-slate-200 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
                    protocols={groupedProtocols.STANDARD}
                    typeKey="STANDARD"
                />

                {filteredProtocols.length === 0 && (
                    <div className="py-16 flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-[#1a2235] rounded-3xl border border-slate-200 dark:border-slate-800">
                        <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center mb-6">
                            <i className="fa-solid fa-folder-open text-3xl text-slate-300 dark:text-slate-600"></i>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Folder is Empty</h3>
                        <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-medium">
                            Adjust your smart search or filters to locate the correct protocol.
                        </p>
                    </div>
                )}
            </div>

            <ProtocolModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveProtocol}
                initialData={editingProtocol}
                t={t}
            />

            <ProtocolSignaturesModal
                isOpen={!!viewingSignaturesFor}
                onClose={() => setViewingSignaturesFor(undefined)}
                protocol={viewingSignaturesFor}
                allUsers={users}
                acknowledgments={allAcknowledgments}
                t={t}
            />
        </div>
    );
};

export default Protocols;
