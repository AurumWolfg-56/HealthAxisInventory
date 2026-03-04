import React, { useMemo } from 'react';
import { Protocol } from '../types';

interface UserSignature {
    id: string;
    name: string;
    role: string;
    signedAt?: string;
}

interface ProtocolSignaturesModalProps {
    isOpen: boolean;
    onClose: () => void;
    protocol?: Protocol;
    allUsers: any[];
    acknowledgments: any[];
    t: (key: string) => string;
}

const ProtocolSignaturesModal: React.FC<ProtocolSignaturesModalProps> = ({ isOpen, onClose, protocol, allUsers, acknowledgments, t }) => {

    const signaturesData = useMemo(() => {
        if (!protocol || !protocol.requires_acknowledgment) return [];

        // Filter acknowledgments for this specific protocol
        const protocolAcks = acknowledgments.filter(ack => ack.protocolId === protocol.id);
        const signedUserIds = new Set(protocolAcks.map(ack => ack.userId));

        // Create a definitive list combining all users and indicating their sign status
        return allUsers.map(u => {
            const ack = protocolAcks.find(a => a.userId === u.id);
            return {
                id: u.id,
                name: u.username || u.email || 'Unknown User',
                role: u.role || 'Staff',
                signedAt: ack ? ack.acknowledgedAt : undefined
            };
        }).sort((a, b) => {
            // Unsigned first, then alphabetical by name
            if (a.signedAt && !b.signedAt) return 1;
            if (!a.signedAt && b.signedAt) return -1;
            return a.name.localeCompare(b.name);
        });

    }, [protocol, allUsers, acknowledgments]);

    if (!isOpen || !protocol) return null;

    const signedCount = signaturesData.filter(s => s.signedAt).length;
    const totalCount = signaturesData.length;
    const progress = totalCount > 0 ? Math.round((signedCount / totalCount) * 100) : 0;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-[#1a2235] rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh] animate-scale-in">

                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <i className="fa-solid fa-file-signature text-lg"></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Signatures tracking</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{protocol.title}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-hidden flex flex-col">

                    {/* Progress Bar */}
                    <div className="mb-6 flex flex-col gap-2">
                        <div className="flex justify-between text-sm font-bold">
                            <span className="text-slate-700 dark:text-slate-300">Staff Compliance</span>
                            <span className={progress === 100 ? 'text-emerald-500' : 'text-slate-500'}>{progress}% ({signedCount}/{totalCount})</span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ${progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                        {signaturesData.map(userSign => (
                            <div key={userSign.id} className={`flex items-center justify-between p-3 rounded-2xl border ${userSign.signedAt ? 'bg-slate-50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800' : 'bg-orange-50 dark:bg-orange-500/5 border-orange-200 dark:border-orange-500/20 shadow-sm'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${userSign.signedAt ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400' : 'bg-orange-200 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400'}`}>
                                        {userSign.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-white leading-snug">{userSign.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{userSign.role}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {userSign.signedAt ? (
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-1 rounded-md mb-1"><i className="fa-solid fa-check mr-1"></i> Signed</span>
                                            <span className="text-[10px] text-slate-400">{new Date(userSign.signedAt).toLocaleDateString()} {new Date(userSign.signedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    ) : (
                                        <span className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/20 px-2 flex items-center py-1 rounded-md"><i className="fa-solid fa-clock mr-1"></i> Pending</span>
                                    )}
                                </div>
                            </div>
                        ))}

                        {signaturesData.length === 0 && (
                            <div className="text-center py-8 text-slate-500">
                                <i className="fa-solid fa-ghost text-4xl mb-3 opacity-20"></i>
                                <p>No users found in the system to track.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ProtocolSignaturesModal;
