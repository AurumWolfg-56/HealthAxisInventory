import React, { useState, useMemo, useEffect } from 'react';
import { User, Protocol, ProtocolSeverity, ProtocolArea, ProtocolType } from '../types';
import { useAppData } from '../contexts/AppDataContext';
import { useAuth } from '../contexts/AuthContext';
import { ProtocolService } from '../services/ProtocolService';
import ProtocolModal from './ProtocolModal';
import ProtocolSignaturesModal from './ProtocolSignaturesModal';

interface ProtocolsProps {
    user: User | null;
    users?: User[];
    t: (key: string) => string;
}

const Protocols: React.FC<ProtocolsProps> = ({ user, users = [], t }) => {
    const { protocols, setProtocols } = useAppData();
    const { hasPermission } = useAuth();
    const isManager = hasPermission('protocols.manage');

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedArea, setSelectedArea] = useState<ProtocolArea | 'ALL'>('ALL');
    const [selectedType, setSelectedType] = useState<ProtocolType | 'ALL'>('ALL');
    const [selectedSeverity, setSelectedSeverity] = useState<ProtocolSeverity | 'ALL'>('ALL');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProtocol, setEditingProtocol] = useState<Protocol | undefined>(undefined);

    // Acknowledgments sync state
    const [myAcknowledgments, setMyAcknowledgments] = useState<Record<string, boolean>>({});
    const [allAcknowledgments, setAllAcknowledgments] = useState<any[]>([]);
    const [loadingAcks, setLoadingAcks] = useState(true);

    const [viewingSignaturesFor, setViewingSignaturesFor] = useState<Protocol | undefined>(undefined);

    // Initial load for acknowledgments
    useEffect(() => {
        const fetchAcks = async () => {
            if (!user?.id) return;
            try {
                // Fetch ONLY for this user (we could optimize this on the service layer, but grabbing all is okay for small scale)
                // Fetch all acknowledgments for tracking
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

    // Data filtering with "Advanced Smart Search" (Deep text indexing)
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
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
    }, [protocols, searchTerm, selectedArea, selectedType, selectedSeverity]);

    // Unread critical protocols prompt
    const unreadCriticals = useMemo(() => {
        if (loadingAcks) return [];
        return protocols.filter(p => p.requires_acknowledgment && !myAcknowledgments[p.id]);
    }, [protocols, myAcknowledgments, loadingAcks]);

    const handleSaveProtocol = async (data: Partial<Protocol>) => {
        if (editingProtocol) {
            const updated = await ProtocolService.updateProtocol(editingProtocol.id, data);
            if (updated) {
                setProtocols(prev => prev.map(p => p.id === updated.id ? updated : p));
            }
        } else {
            const created = await ProtocolService.createProtocol(data as Omit<Protocol, 'id' | 'created_at' | 'updated_at'>);
            if (created) {
                setProtocols(prev => [created, ...prev]);
            }
        }
        setIsModalOpen(false);
    };

    const handleDeleteProtocol = async (id: string) => {
        if (!confirm('Are you sure you want to delete this protocol?')) return;
        const success = await ProtocolService.deleteProtocol(id);
        if (success) {
            setProtocols(prev => prev.filter(p => p.id !== id));
        }
    };

    const handleAcknowledge = async (id: string) => {
        if (!user?.id) return;
        const success = await ProtocolService.acknowledgeProtocol(id);
        if (success) {
            setMyAcknowledgments(prev => ({ ...prev, [id]: true }));
            // Also locally update allAcknowledgments so the manager view updates without a refresh
            setAllAcknowledgments(prev => [...prev, { protocolId: id, userId: user.id, acknowledgedAt: new Date().toISOString() }]);
        }
    };

    const getSeverityColor = (severity: ProtocolSeverity) => {
        switch (severity) {
            case 'CRITICAL': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20';
            case 'WARNING': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20';
            case 'ROUTINE': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
            case 'INFO': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getTypeIcon = (type: ProtocolType) => {
        switch (type) {
            case 'HIPAA': return <span className="flex items-center gap-1"><i className="fa-solid fa-shield-halved text-indigo-500"></i> HIPAA</span>;
            case 'OSHA': return <span className="flex items-center gap-1"><i className="fa-solid fa-triangle-exclamation text-amber-500"></i> OSHA</span>;
            case 'EMERGENCY': return <span className="flex items-center gap-1"><i className="fa-solid fa-truck-medical text-rose-500"></i> Emergency</span>;
            default: return <span className="flex items-center gap-1"><i className="fa-solid fa-file-contract text-slate-500"></i> Standard</span>;
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 pb-24">
            {/* Header section */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">Clinic Protocols</h1>
                    <p className="text-slate-500 dark:text-slate-400 max-w-2xl text-lg relative z-10 leading-relaxed">
                        Staff Hub for clinical rules, standards, and procedures.
                    </p>
                </div>
                {isManager && (
                    <button
                        onClick={() => { setEditingProtocol(undefined); setIsModalOpen(true); }}
                        className="px-6 py-3 bg-medical-600 hover:bg-medical-700 text-white rounded-2xl font-bold shadow-lg shadow-medical-500/30 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <i className="fa-solid fa-plus"></i>
                        Create Protocol
                    </button>
                )}
            </div>

            {/* Critical Unread Banner */}
            {unreadCriticals.length > 0 && (
                <div className="mb-8 p-4 sm:p-6 bg-red-50 dark:bg-red-500/10 border-2 border-red-200 dark:border-red-500/30 rounded-3xl shadow-lg shadow-red-500/10 flex flex-col sm:flex-row items-center justify-between gap-4 animate-scale-in">
                    <div className="flex items-center gap-4 text-red-700 dark:text-red-400">
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
                            <i className="fa-solid fa-bell animate-wiggle"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-black tracking-tight">Required Reading Pending</h3>
                            <p className="font-medium text-sm text-red-600/80 dark:text-red-400/80">
                                You have {unreadCriticals.length} protocol(s) that require your digital acknowledgment.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Smart Search & Filters */}
            <div className="bg-white dark:bg-[#1a2235] border border-slate-100 dark:border-slate-800 rounded-3xl p-4 sm:p-6 mb-8 shadow-sm">
                <div className="flex flex-col lg:flex-row gap-4">
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
                            className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-medical-500 outline-none transition-all placeholder:text-slate-400 font-medium"
                        />
                    </div>

                    {/* Stacked Filters */}
                    <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2 lg:pb-0">
                        <select
                            value={selectedArea}
                            onChange={e => setSelectedArea(e.target.value as any)}
                            className="px-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-700 dark:text-slate-300 font-medium outline-none focus:ring-2 focus:ring-medical-500 min-w-[140px]"
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
                            className="px-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-700 dark:text-slate-300 font-medium outline-none focus:ring-2 focus:ring-medical-500 min-w-[140px]"
                        >
                            <option value="ALL">All Rules</option>
                            <option value="STANDARD">Standard</option>
                            <option value="HIPAA">HIPAA</option>
                            <option value="OSHA">OSHA</option>
                            <option value="EMERGENCY">Emergency</option>
                        </select>

                        <select
                            value={selectedSeverity}
                            onChange={e => setSelectedSeverity(e.target.value as any)}
                            className="px-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-700 dark:text-slate-300 font-medium outline-none focus:ring-2 focus:ring-medical-500 min-w-[140px]"
                        >
                            <option value="ALL">All Severities</option>
                            <option value="CRITICAL">Critical</option>
                            <option value="WARNING">Warning</option>
                            <option value="ROUTINE">Routine</option>
                            <option value="INFO">Info</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Protocol List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProtocols.map(protocol => {
                    const isUnread = protocol.requires_acknowledgment && !myAcknowledgments[protocol.id];

                    return (
                        <div key={protocol.id} className={`bg-white dark:bg-[#1a2235] border ${isUnread ? 'border-orange-300 dark:border-orange-500/50 shadow-md shadow-orange-500/10' : 'border-slate-100 dark:border-slate-800'} rounded-3xl overflow-hidden flex flex-col hover:border-medical-300 dark:hover:border-medical-500/50 transition-colors`}>

                            <div className="p-5 border-b border-slate-50 dark:border-slate-800/50">
                                <div className="flex items-start justify-between gap-4 mb-3">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                                        {protocol.title}
                                    </h3>
                                    {isManager && (
                                        <div className="flex gap-2 opacity-50 hover:opacity-100 transition-opacity">
                                            {protocol.requires_acknowledgment && (
                                                <button onClick={() => setViewingSignaturesFor(protocol)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-indigo-500" title="View Signatures tracking">
                                                    <i className="fa-solid fa-file-signature text-sm"></i>
                                                </button>
                                            )}
                                            <button onClick={() => { setEditingProtocol(protocol); setIsModalOpen(true); }} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-medical-600">
                                                <i className="fa-solid fa-pen text-sm"></i>
                                            </button>
                                            <button onClick={() => handleDeleteProtocol(protocol.id)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-red-500">
                                                <i className="fa-solid fa-trash text-sm"></i>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${getSeverityColor(protocol.severity)}`}>
                                        {protocol.severity}
                                    </span>
                                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                        <i className="fa-solid fa-location-dot mr-1 text-slate-400"></i>
                                        {protocol.area.replace('_', ' ')}
                                    </span>
                                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                        {getTypeIcon(protocol.type)}
                                    </span>
                                </div>
                            </div>

                            <div className="p-5 flex-1 text-slate-600 dark:text-slate-400 text-sm whitespace-pre-wrap leading-relaxed">
                                {protocol.content}
                            </div>

                            {/* Footer / Acknowledgment */}
                            <div className="p-5 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div className="text-xs text-slate-400 font-medium">
                                    Updated: {new Date(protocol.updated_at).toLocaleDateString()}
                                </div>

                                {protocol.requires_acknowledgment && (
                                    isUnread ? (
                                        <button
                                            onClick={() => handleAcknowledge(protocol.id)}
                                            className="px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-500/20 dark:hover:bg-orange-500/30 dark:text-orange-400 rounded-xl text-sm font-bold transition-colors animate-pulse-slow flex items-center gap-2"
                                        >
                                            <i className="fa-solid fa-signature"></i> Sign to Acknowledge
                                        </button>
                                    ) : (
                                        <span className="flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2 rounded-xl">
                                            <i className="fa-solid fa-check-circle"></i> Acknowledged
                                        </span>
                                    )
                                )}
                            </div>
                        </div>
                    );
                })}

                {filteredProtocols.length === 0 && (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <i className="fa-solid fa-file-shield text-3xl text-slate-300 dark:text-slate-600"></i>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No protocols found</h3>
                        <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                            Adjust your smart search or filters to find what you're looking for.
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
