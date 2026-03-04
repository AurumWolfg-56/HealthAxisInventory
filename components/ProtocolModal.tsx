import React, { useState, useEffect } from 'react';
import { Protocol, ProtocolSeverity, ProtocolArea, ProtocolType, ProtocolTargetRole } from '../types';

interface ProtocolModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (protocol: Partial<Protocol>) => Promise<void>;
    initialData?: Protocol;
    t: (key: string) => string;
}

const ProtocolModal: React.FC<ProtocolModalProps> = ({ isOpen, onClose, onSave, initialData, t }) => {
    const [formData, setFormData] = useState<Partial<Protocol>>({
        title: '',
        content: '',
        severity: 'INFO',
        area: 'GENERAL',
        type: 'STANDARD',
        requiresAcknowledgment: false,
        isPinned: false,
        targetRole: 'ALL_STAFF'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData(initialData || {
                title: '',
                content: '',
                severity: 'INFO',
                area: 'GENERAL',
                type: 'STANDARD',
                requiresAcknowledgment: false,
                isPinned: false,
                targetRole: 'ALL_STAFF'
            });
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            await onSave(formData);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-[#1a2235] rounded-3xl w-full max-w-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">

                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-medical-500/10 flex items-center justify-center text-medical-600 dark:text-medical-400">
                            <i className={`fa-solid ${initialData ? 'fa-pen-to-square' : 'fa-plus'} text-lg`}></i>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            {initialData ? 'Edit Protocol' : 'Create New Protocol'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <form id="protocol-form" onSubmit={handleSubmit} className="space-y-6">

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Title</label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-medical-500 focus:border-transparent transition-all outline-none"
                                placeholder="e.g., Opening Procedures, Sterilization Guide"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Severity</label>
                                <select
                                    value={formData.severity}
                                    onChange={e => setFormData({ ...formData, severity: e.target.value as ProtocolSeverity })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-medical-500 transition-all outline-none"
                                    required
                                >
                                    <option value="INFO">Info</option>
                                    <option value="ROUTINE">Routine</option>
                                    <option value="WARNING">Warning</option>
                                    <option value="CRITICAL">Critical</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Area / Location</label>
                                <select
                                    value={formData.area}
                                    onChange={e => setFormData({ ...formData, area: e.target.value as ProtocolArea })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-medical-500 transition-all outline-none"
                                    required
                                >
                                    <option value="GENERAL">General Office</option>
                                    <option value="FRONT_DESK">Front Desk</option>
                                    <option value="MA_STATION">MA Station</option>
                                    <option value="EXAM_ROOM">Exam Room</option>
                                    <option value="LAB">Laboratory</option>
                                    <option value="STORAGE">Storage</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Rule Type</label>
                                <select
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value as ProtocolType })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-medical-500 transition-all outline-none"
                                    required
                                >
                                    <option value="STANDARD">Standard Procedure</option>
                                    <option value="HIPAA">HIPAA Compliance</option>
                                    <option value="OSHA">OSHA Regulation</option>
                                    <option value="EMERGENCY">Emergency Protocol</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Target Audience</label>
                                <select
                                    value={formData.targetRole}
                                    onChange={e => setFormData({ ...formData, targetRole: e.target.value as ProtocolTargetRole })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-medical-500 transition-all outline-none"
                                    required
                                >
                                    <option value="ALL_STAFF">All Staff (Everyone)</option>
                                    <option value="MEDICAL_ONLY">Medical Staff Only (MA/Providers)</option>
                                    <option value="FRONT_DESK_ONLY">Front Desk Only</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Details / Content</label>
                            <textarea
                                required
                                value={formData.content}
                                onChange={e => setFormData({ ...formData, content: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-medical-500 focus:border-transparent transition-all outline-none h-48 custom-scrollbar resize-none"
                                placeholder="Describe the protocol, steps, or rules in detail..."
                            ></textarea>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Require Acknowledgment */}
                            <div className="flex items-center p-4 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-2xl">
                                <div className="flex-1">
                                    <h4 className="text-sm font-bold text-orange-800 dark:text-orange-400">Require Acknowledgment</h4>
                                    <p className="text-xs text-orange-600 dark:text-orange-300 mt-1">
                                        Force the target audience to digitally sign they have read this protocol.
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer ml-4">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={formData.requiresAcknowledgment}
                                        onChange={e => setFormData(prev => ({ ...prev, requiresAcknowledgment: e.target.checked }))}
                                    />
                                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                </label>
                            </div>

                            {/* Pin to Top */}
                            <div className="flex items-center p-4 bg-medical-50 dark:bg-medical-500/10 border border-medical-200 dark:border-medical-500/20 rounded-2xl">
                                <div className="flex-1">
                                    <h4 className="text-sm font-bold text-medical-800 dark:text-medical-400">Pin to Top 📌</h4>
                                    <p className="text-xs text-medical-600 dark:text-medical-300 mt-1">
                                        Highlight this protocol at the very top of the staff dashboard.
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer ml-4">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={formData.isPinned}
                                        onChange={e => setFormData(prev => ({ ...prev, isPinned: e.target.checked }))}
                                    />
                                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-medical-500"></div>
                                </label>
                            </div>
                        </div>

                    </form>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        type="submit"
                        form="protocol-form"
                        disabled={isSubmitting}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold bg-medical-600 hover:bg-medical-700 text-white shadow-lg shadow-medical-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSubmitting ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-check"></i>}
                        {isSubmitting ? 'Saving...' : 'Save Protocol'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ProtocolModal;
