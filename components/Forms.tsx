
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FormTemplate, User, UserRole, Permission } from '../types';
import PrintLayout from './PrintLayout';
import SmartDictationInput from '../src/components/dictation/SmartDictationInput';

interface FormsProps {
    templates: FormTemplate[];
    users: User[]; // Need list of users to find Doctors
    user: User; // Current user
    hasPermission: (permission: Permission) => boolean;
    onSaveTemplate: (template: FormTemplate) => Promise<void>;
    onDeleteTemplate: (id: string) => void;
    onLogAction: (action: any, details: string) => void;
    t: (key: string) => string;
}

const VARIABLES = ['{{patientName}}', '{{patientDOB}}', '{{doctorName}}', '{{procedure}}', '{{date}}', '{{time}}'];

const Forms: React.FC<FormsProps> = ({ templates, users, user, hasPermission, onSaveTemplate, onDeleteTemplate, onLogAction, t }) => {
    const [activeTab, setActiveTab] = useState<'generate' | 'manage'>('generate');

    // Generator State
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [procedure, setProcedure] = useState('');
    const [selectedDoctorId, setSelectedDoctorId] = useState('');

    // Editor State
    const [editId, setEditId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<FormTemplate>>({});

    // Refs
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const printRef = useRef<HTMLDivElement>(null); // For window.print() AND html2pdf generation
    const previewRef = useRef<HTMLDivElement>(null); // Only for live preview

    // Filter Providers: Include DOCTOR and OWNER roles
    const providers = users.filter(u => u.role === UserRole.DOCTOR || u.role === UserRole.OWNER);

    // --- HELPER: GET DETAILS ---
    const getDetails = () => {
        const provider = users.find(u => u.id === selectedDoctorId);
        const providerPrefix = provider?.role === UserRole.DOCTOR ? 'Dr. ' : '';
        const providerName = provider ? `${providerPrefix}${provider.username}` : '';
        const now = new Date();

        // Enforce MM/DD/YYYY Format for the Current Date
        const formattedDate = now.toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        return {
            patientName: '', // Empty for manual entry
            patientDOB: '',  // Empty for manual entry
            providerName,
            procedure,
            date: formattedDate,
            time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        };
    };

    const getSelectedTemplate = () => templates.find(t => t.id === selectedTemplateId);

    const getProcessedContent = () => {
        const template = getSelectedTemplate();
        if (!template) return '';

        const { providerName, date, time } = getDetails();

        let content = template.content;

        // We replace variables with empty underscores if not provided, to allow handwriting
        content = content.replace(/{{patientName}}/g, '__________________________');
        content = content.replace(/{{patientDOB}}/g, '__________________________');
        content = content.replace(/{{doctorName}}/g, providerName || 'Provider');
        content = content.replace(/{{procedure}}/g, procedure || '__________________________');
        content = content.replace(/{{date}}/g, date);
        content = content.replace(/{{time}}/g, time);

        return content;
    };

    // --- LOGIC: GENERATE ---


    const handleDownloadPDF = () => {
        if (!selectedTemplateId || !selectedDoctorId) {
            alert("Please select a template and a provider.");
            return;
        }

        // USE THE HIDDEN PRINT REF instead of Preview Ref
        const element = printRef.current;
        if (!element) return;

        // Check if html2pdf is loaded
        if (!(window as any).html2pdf) {
            alert("PDF generator is loading... please try again in a moment.");
            return;
        }

        const template = getSelectedTemplate();
        onLogAction('FORM_GENERATED', `Downloaded PDF '${template?.title}'`);

        // Configuration for html2pdf
        const opt = {
            margin: [10, 0, 40, 0],
            filename: `${template?.slug || 'document'}_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                letterRendering: true,
                scrollY: 0,
            },
            jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] }
        };

        // Generate PDF
        // @ts-ignore
        (window as any).html2pdf().set(opt).from(element).toPdf().get('pdf').then((pdf: any) => {
            // Native PDF Footer Injection
            const totalPages = pdf.internal.getNumberOfPages();
            const details = getDetails();

            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);


                // Footer Configuration
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                // Position footer 15mm from bottom. Since margin is 40mm, this is well inside the safe zone.
                const footerY = pageHeight - 15;

                // 1. Divider Line
                pdf.setDrawColor(220, 220, 220); // Slightly darker gray line for visibility
                pdf.setLineWidth(0.5);
                pdf.line(15, footerY - 5, pageWidth - 15, footerY - 5);

                // 2. Left Side: Confidentiality Text
                pdf.setFontSize(7);
                pdf.setTextColor(120, 120, 120); // Darker gray text
                pdf.setFont('helvetica', 'bold');
                pdf.text('CONFIDENTIAL MEDICAL RECORD', 15, footerY);

                pdf.setFontSize(6);
                pdf.setFont('helvetica', 'normal');
                pdf.text('This document contains protected health information (PHI).', 15, footerY + 3);
                pdf.text('Unauthorized disclosure is prohibited by law (HIPAA).', 15, footerY + 6);

                // 3. Right Side: Meta Data
                pdf.setFontSize(7);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(80, 80, 80);

                // "Official Document" Badge (simulated with text background)
                pdf.setFillColor(220, 38, 38); // Red background
                pdf.rect(pageWidth - 45, footerY - 4, 30, 4, 'F');
                pdf.setTextColor(255, 255, 255); // White text
                pdf.text('OFFICIAL DOCUMENT', pageWidth - 43, footerY - 1);

                // Generated Date & Page Number
                pdf.setTextColor(120, 120, 120); // Back to gray
                pdf.text(`Generated: ${details.date}`, pageWidth - 15, footerY + 3, { align: 'right' });
                pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 15, footerY + 6, { align: 'right' });

                // 4. Red Accent Bar at very bottom (Bleed edge)
                pdf.setFillColor(220, 38, 38);
                pdf.rect(0, pageHeight - 2, pageWidth, 2, 'F');
            }
        }).save();
    };

    // --- LOGIC: MANAGE ---
    const handleEdit = (tpl?: FormTemplate) => {
        if (tpl) {
            setEditId(tpl.id);
            setFormData({ ...tpl });
        } else {
            setEditId('new');
            setFormData({
                title: '',
                slug: '',
                version: '1.0',
                language: 'English',
                status: 'Draft',
                useLetterhead: true,
                content: `# Consent Form

I, **{{patientName}}**, hereby authorize...

# Acknowledgment
1. Point one...`,
                variables: VARIABLES
            });
        }
    };

    const [isSaving, setIsSaving] = useState(false);

    // UUID Polyfill for older browsers/contexts
    // Safe wrapper to handle "not available" errors in insecure contexts
    const generateUUID = () => {
        try {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                return crypto.randomUUID();
            }
        } catch (e) {
            console.warn('crypto.randomUUID failed (likely insecure context), falling back to polyfill', e);
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    const saveTemplate = async () => {
        if (!formData.title || !formData.content) return;

        try {
            setIsSaving(true);
            const slug = formData.slug || formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

            const newTemplate: FormTemplate = {
                id: editId === 'new' ? generateUUID() : editId!,
                title: formData.title,
                slug: slug,
                version: formData.version || '1.0',
                language: formData.language || 'English',
                status: formData.status || 'Draft',
                useLetterhead: formData.useLetterhead ?? true,
                content: formData.content,
                variables: VARIABLES,
                updatedAt: new Date().toISOString()
            };

            await onSaveTemplate(newTemplate);
            setEditId(null);
        } catch (error: any) {
            console.error("Failed to save template:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const insertVariable = (v: string) => {
        insertAtCursor(v);
    };

    const applyFormat = (symbol: string, closeSymbol?: string) => {
        const textarea = textAreaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = formData.content || '';

        const selectedText = text.substring(start, end);
        const before = text.substring(0, start);
        const after = text.substring(end, text.length);

        const effectiveClose = closeSymbol || symbol;

        // If applying a heading (#), it goes at the start of the line
        if (symbol === '# ') {
            // Find start of current line
            const lastNewLine = text.lastIndexOf('\n', start - 1);
            const lineStart = lastNewLine === -1 ? 0 : lastNewLine + 1;

            const newText = text.substring(0, lineStart) + symbol + text.substring(lineStart);
            setFormData({ ...formData, content: newText });
            setTimeout(() => textarea.focus(), 0);
            return;
        }

        // Don't wrap if no selection, just insert indicators to type between
        const newText = before + symbol + selectedText + effectiveClose + after;

        setFormData({ ...formData, content: newText });

        // Restore selection / focus
        setTimeout(() => {
            textarea.focus();
            if (selectedText.length > 0) {
                // Select the wrapped text
                textarea.setSelectionRange(start, end + symbol.length + effectiveClose.length);
            } else {
                // Cursor between symbols
                textarea.setSelectionRange(start + symbol.length, start + symbol.length);
            }
        }, 0);
    };

    const insertAtCursor = (textToInsert: string) => {
        const textarea = textAreaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = formData.content || '';
        const before = text.substring(0, start);
        const after = text.substring(end, text.length);

        setFormData({ ...formData, content: before + textToInsert + after });

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
        }, 0);
    };

    // --- RENDER: EDITOR ---
    if (activeTab === 'manage' && editId) {
        return createPortal(
            <div className="fixed inset-0 z-[100] bg-gray-900/95 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-gray-900 border border-gray-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    {/* Editor Header */}
                    <div className="p-6 border-b border-gray-800 flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-1">
                                {editId === 'new' ? 'Create Template' : 'Edit Consent Template'}
                            </h2>
                            <p className="text-gray-400 text-sm">Update consent template details</p>
                        </div>
                        <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-white transition-colors">
                            <i className="fa-solid fa-xmark text-xl"></i>
                        </button>
                    </div>

                    {/* Editor Body */}
                    <div className="p-8 overflow-y-auto custom-scrollbar space-y-6">
                        {/* Row 1: Name & Slug */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-gray-300 text-sm font-bold">Template Name *</label>
                                <input
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full bg-gray-950 border border-blue-500/50 rounded-lg h-12 px-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    placeholder="e.g. TB Surveillance Form"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-gray-500 text-sm font-bold">Slug (Auto-generated)</label>
                                <input
                                    value={formData.slug}
                                    onChange={e => setFormData({ ...formData, slug: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg h-12 px-4 text-gray-400 focus:outline-none"
                                    placeholder="tb-surveillance-form"
                                />
                            </div>
                        </div>

                        {/* Row 2: Metadata */}
                        <div className="grid grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-gray-300 text-sm font-bold">Version *</label>
                                <input
                                    value={formData.version}
                                    onChange={e => setFormData({ ...formData, version: e.target.value })}
                                    className="w-full bg-gray-950 border border-gray-700 rounded-lg h-12 px-4 text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-gray-300 text-sm font-bold">Language</label>
                                <select
                                    value={formData.language}
                                    onChange={e => setFormData({ ...formData, language: e.target.value as any })}
                                    className="w-full bg-gray-950 border border-gray-700 rounded-lg h-12 px-4 text-white focus:outline-none focus:border-blue-500"
                                >
                                    <option value="English">English</option>
                                    <option value="Spanish">Spanish</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-gray-300 text-sm font-bold">Status</label>
                                <select
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                                    className="w-full bg-gray-950 border border-gray-700 rounded-lg h-12 px-4 text-white focus:outline-none focus:border-blue-500"
                                >
                                    <option value="Active">Active</option>
                                    <option value="Draft">Draft</option>
                                    <option value="Archived">Archived</option>
                                </select>
                            </div>
                        </div>

                        {/* Row 3: Letterhead Toggle */}
                        <div className="border border-gray-700 rounded-xl p-4 flex items-center justify-between bg-gray-950/50">
                            <div>
                                <h4 className="text-white font-bold">Use System Letterhead</h4>
                                <p className="text-gray-500 text-xs mt-1">Include clinic header and footer in PDF</p>
                            </div>
                            <button
                                onClick={() => setFormData({ ...formData, useLetterhead: !formData.useLetterhead })}
                                className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${formData.useLetterhead ? 'bg-blue-600' : 'bg-gray-700'}`}
                            >
                                <div className={`w-6 h-6 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${formData.useLetterhead ? 'translate-x-6' : 'translate-x-0'}`}></div>
                            </button>
                        </div>

                        {/* Row 4: Content Editor with Smart Dictation */}
                        <div className="space-y-0">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-gray-300 text-sm font-bold block">Content Editor</label>
                                <div className="flex items-center gap-2 text-xs text-teal-400">
                                    <i className="fa-solid fa-microphone-lines"></i>
                                    <span className="font-bold uppercase tracking-wider">AI Dictation Ready</span>
                                </div>
                            </div>

                            {/* Formatting Toolbar */}
                            <div className="bg-gray-800 border-x border-t border-gray-700 rounded-t-xl p-2 flex flex-wrap gap-2 items-center">
                                <div className="flex gap-1 border-r border-gray-700 pr-2 mr-1">
                                    <button onClick={() => applyFormat('# ')} title="Heading" className="w-8 h-8 rounded hover:bg-gray-700 text-gray-300 font-bold flex items-center justify-center transition-colors">H</button>
                                    <button onClick={() => applyFormat('**')} title="Bold" className="w-8 h-8 rounded hover:bg-gray-700 text-gray-300 font-bold flex items-center justify-center transition-colors">B</button>
                                    <button onClick={() => applyFormat('*')} title="Italic" className="w-8 h-8 rounded hover:bg-gray-700 text-gray-300 italic flex items-center justify-center transition-colors">I</button>
                                    <button onClick={() => applyFormat('__')} title="Underline" className="w-8 h-8 rounded hover:bg-gray-700 text-gray-300 underline flex items-center justify-center transition-colors">U</button>
                                </div>

                                <div className="flex gap-2 flex-wrap">
                                    {VARIABLES.map(v => (
                                        <button
                                            key={v}
                                            onClick={() => insertVariable(v)}
                                            className="text-[10px] bg-gray-900 hover:bg-black text-blue-400 border border-gray-700 px-2 py-1 rounded transition-colors"
                                        >
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <SmartDictationInput
                                ref={textAreaRef}
                                value={formData.content || ''}
                                onChange={(val) => setFormData({ ...formData, content: val })}
                                rows={15}
                                placeholder="Type or dictate document content here..."
                                className="bg-gray-950 border-gray-700 rounded-b-xl rounded-t-none text-gray-300 font-mono text-sm leading-relaxed focus:ring-0 border-t-0"
                            />
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-gray-800 bg-gray-900 flex justify-end gap-4">
                        <button
                            onClick={() => setEditId(null)}
                            className="px-6 py-3 rounded-xl border border-gray-700 text-gray-300 font-bold hover:bg-gray-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={saveTemplate}
                            disabled={isSaving}
                            className="px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2"
                        >
                            {isSaving && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                            {isSaving ? 'Saving...' : 'Update Template'}
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    // --- RENDER: MAIN LIST ---
    return (
        <div className="space-y-8 pb-20 md:pb-10 animate-fade-in-up">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-medical-500 flex items-center justify-center shadow-lg shadow-medical-500/20">
                        <i className="fa-solid fa-file-contract text-xl text-white"></i>
                    </div>
                    <div>
                        <h2 className="text-display text-slate-900 dark:text-white">Clinical Forms</h2>
                        <p className="text-caption mt-0.5">Generate official Immediate Care Plus documents</p>
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl">
                    <button
                        onClick={() => setActiveTab('generate')}
                        className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'generate' ? 'bg-white dark:bg-gray-700 shadow-sm text-medical-600 dark:text-white' : 'text-gray-500'}`}
                    >
                        <i className="fa-solid fa-print mr-2"></i> Generate
                    </button>
                    {hasPermission('forms.manage') && (
                        <button
                            onClick={() => setActiveTab('manage')}
                            className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'manage' ? 'bg-white dark:bg-gray-700 shadow-sm text-medical-600 dark:text-white' : 'text-gray-500'}`}
                        >
                            <i className="fa-solid fa-pen-ruler mr-2"></i> Templates
                        </button>
                    )}
                </div>
            </header>

            {/* GENERATE TAB */}
            {activeTab === 'generate' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Inputs */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-glass border border-gray-100 dark:border-gray-800 space-y-5">

                            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/30">
                                <label className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase mb-2 block">1. Select Provider</label>
                                <select
                                    value={selectedDoctorId}
                                    onChange={e => setSelectedDoctorId(e.target.value)}
                                    className="w-full h-12 px-3 rounded-xl bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800/30 font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none text-gray-900 dark:text-white"
                                >
                                    <option value="">Select Doctor / Owner</option>
                                    {providers.map(d => (
                                        <option key={d.id} value={d.id}>{d.role === 'DOCTOR' ? 'Dr.' : ''} {d.username} ({d.role})</option>
                                    ))}
                                </select>
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-3">2. Procedure Info</h3>

                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Procedure / Note (Optional)</label>
                                <input type="text" value={procedure} onChange={e => setProcedure(e.target.value)} className="w-full h-12 px-4 rounded-xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-base mt-1 focus:ring-2 focus:ring-medical-500/20" placeholder="e.g. Incision and Drainage" />
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-3 pt-4">3. Select Form</h3>
                            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                                {templates.filter(t => t.status === 'Active' || t.status === 'Draft').map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setSelectedTemplateId(t.id)}
                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between group ${selectedTemplateId === t.id ? 'border-medical-500 bg-medical-50 dark:bg-medical-900/20' : 'border-gray-100 dark:border-gray-800 hover:border-medical-300'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold ${selectedTemplateId === t.id ? 'text-medical-700 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>{t.title}</span>
                                            {t.status === 'Draft' && <span className="text-[10px] font-bold bg-gray-200 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-md">DRAFT</span>}
                                        </div>
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedTemplateId === t.id ? 'border-medical-500 bg-medical-500' : 'border-gray-300'}`}>
                                            {selectedTemplateId === t.id && <i className="fa-solid fa-check text-white text-xs"></i>}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="flex flex-col gap-3 mt-6">
                                <button
                                    onClick={handleDownloadPDF}
                                    disabled={!selectedTemplateId || !selectedDoctorId}
                                    className="w-full h-14 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02]"
                                >
                                    <i className="fa-solid fa-file-pdf text-xl"></i>
                                    <span className="text-lg">Download PDF</span>
                                </button>

                            </div>
                        </div>
                    </div>

                    {/* Right: Live Preview */}
                    <div className="lg:col-span-2">
                        <div className="bg-gray-200 dark:bg-black/50 p-8 rounded-3xl h-full flex items-center justify-center overflow-auto shadow-inner border border-gray-100 dark:border-gray-800">
                            {/* A4 Paper Simulation - Scaled down */}
                            <div className="bg-white w-[216mm] min-h-[279mm] shadow-2xl scale-[0.6] lg:scale-[0.7] xl:scale-[0.8] origin-top transform transition-transform duration-500 relative">

                                {/* Visible Preview Render for PDF Generation */}
                                <div className="p-0 h-full overflow-hidden">
                                    {selectedTemplateId ? (
                                        <PrintLayout
                                            template={getSelectedTemplate()}
                                            content={getProcessedContent()}
                                            details={getDetails()} // PASSING DETAILS PROP
                                            refProp={previewRef}
                                            isPreview={true}
                                        />
                                    ) : (
                                        <div className="h-[279mm] flex flex-col items-center justify-center text-gray-300 font-sans">
                                            <i className="fa-regular fa-file-lines text-6xl mb-4"></i>
                                            <p className="font-bold text-xl uppercase tracking-widest text-center">Select Template<br />&<br />Enter Patient Info</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MANAGE TAB */}
            {activeTab === 'manage' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map(t => (
                        <div key={t.id} className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-glass border border-gray-100 dark:border-gray-800 hover:-translate-y-1 transition-transform group relative overflow-hidden">
                            {/* Status Badge */}
                            <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[10px] font-bold uppercase tracking-wider
                        ${t.status === 'Active' ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}
                      `}>
                                {t.status}
                            </div>

                            <div className="flex justify-between items-start mb-4 mt-2">
                                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300">
                                    <i className="fa-solid fa-file-contract text-xl"></i>
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{t.title}</h3>
                            <p className="text-xs text-gray-400 font-mono mb-4">{t.slug} • v{t.version}</p>

                            <div className="flex gap-2">
                                <button onClick={() => handleEdit(t)} className="flex-1 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-blue-500 hover:text-white transition-colors flex items-center justify-center font-bold text-xs text-gray-600 dark:text-gray-400">
                                    Edit
                                </button>
                                <button onClick={() => { if (window.confirm('Delete template?')) onDeleteTemplate(t.id) }} className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center text-gray-400">
                                    <i className="fa-solid fa-trash text-xs"></i>
                                </button>
                            </div>
                        </div>
                    ))}

                    <button onClick={() => handleEdit()} className="bg-gray-50 dark:bg-gray-800/50 rounded-3xl p-6 border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-medical-500 hover:bg-medical-50 dark:hover:bg-medical-900/10 transition-all flex flex-col items-center justify-center gap-4 group min-h-[250px]">
                        <div className="w-16 h-16 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center text-gray-300 group-hover:text-medical-500 group-hover:scale-110 transition-all">
                            <i className="fa-solid fa-plus text-2xl"></i>
                        </div>
                        <span className="font-bold text-gray-500 group-hover:text-medical-500">Create New Form</span>
                    </button>
                </div>
            )}



            {/* HIDDEN PRINT CONTAINER FOR PDF GENERATION */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '215.9mm' }}>
                {selectedTemplateId && (
                    <PrintLayout
                        template={getSelectedTemplate()}
                        content={getProcessedContent()}
                        details={getDetails()}
                        refProp={printRef}
                        isPreview={false}
                    />
                )}
            </div>

        </div>
    );
};

export default Forms;
