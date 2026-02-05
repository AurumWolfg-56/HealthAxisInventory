
import React from 'react';
import { FormTemplate } from '../types';

interface PrintLayoutProps {
    template: FormTemplate | undefined;
    content: string;
    details?: {
        patientName: string;
        patientDOB: string;
        providerName: string;
        date: string;
    };
    refProp?: React.RefObject<HTMLDivElement | null>;
    isPreview?: boolean;
}

const PrintLayout: React.FC<PrintLayoutProps> = ({ template, content, details, refProp, isPreview = false }) => {
    if (!template) return null;

    // Layout configuration:
    const containerClass = isPreview
        ? "w-full h-full bg-white text-black overflow-hidden relative"
        : "w-[215.9mm] bg-white text-black relative";

    // Robust Markdown Parser
    const renderFormattedContent = (text: string) => {
        const lines = text.split('\n');

        return lines.map((line, index) => {
            // Handle Headings (Lines starting with #)
            if (line.trim().startsWith('# ')) {
                const headingText = line.trim().substring(2);
                return (
                    <h3 key={index} className="text-lg font-black uppercase tracking-wide mt-6 mb-2 break-inside-avoid border-b-2 border-gray-200 pb-1">
                        {headingText}
                    </h3>
                );
            }

            // Apply formatting rules
            let formattedHtml = line
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
                .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
                .replace(/__(.*?)__/g, '<u>$1</u>'); // Underline

            // If line is empty/whitespace only, render a non-breaking space to maintain height
            if (!formattedHtml.trim()) {
                formattedHtml = '&nbsp;';
            }

            return (
                <div
                    key={index}
                    // 'whitespace-pre-wrap' is CRITICAL: it preserves the spaces you type for alignment
                    // 'break-inside-avoid' prevents splitting a single line across pages
                    className="mb-1 break-inside-avoid relative whitespace-pre-wrap"
                    style={{ minHeight: '1.5em' }}
                    dangerouslySetInnerHTML={{ __html: formattedHtml }}
                />
            );
        });
    };

    return (
        <div className={containerClass} ref={refProp}>
            {/* Inner Page Container */}
            <div className="w-full relative font-sans bg-white pb-10">

                {/* === WATERMARK === */}
                {template.useLetterhead && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02] z-0 overflow-hidden">
                        <div style={{ width: '400px', height: '400px', border: '30px solid #DC2626', borderRadius: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: '280px', height: '280px', border: '15px solid #DC2626', borderRadius: '30px' }}></div>
                        </div>
                    </div>
                )}

                {/* === SIDEBAR ACCENT === */}
                {template.useLetterhead && (
                    <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-[#DC2626] z-10 print:bg-[#DC2626]"></div>
                )}

                {/* === HEADER === */}
                {template.useLetterhead && (
                    <header className="pl-14 pr-12 pt-10 pb-6 flex justify-between items-start relative z-10">

                        {/* Logo & Brand */}
                        <div className="flex items-center gap-5">
                            {/* CSS Constructed Logo for Vector Sharpness */}
                            <div className="relative flex items-center justify-center bg-[#DC2626]" style={{ width: '60px', height: '60px', borderRadius: '10px', flexShrink: 0 }}>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div style={{ width: '40px', height: '40px', borderRadius: '7px', border: '3.5px solid white' }}></div>
                                </div>
                                <svg width="32" height="32" viewBox="0 0 100 100" className="relative z-10" style={{ overflow: 'visible' }}>
                                    <path
                                        d="M10 50 H30 L40 20 L60 80 L70 50 H90"
                                        fill="none"
                                        stroke="white"
                                        strokeWidth="10"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </div>

                            <div className="flex flex-col justify-center">
                                <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-none" style={{ fontFamily: 'Arial, sans-serif' }}>
                                    IMMEDIATE <span style={{ color: '#DC2626' }}>CARE</span> PLUS
                                </h1>
                                <div className="flex items-center gap-2 mt-1.5 ml-0.5">
                                    <div className="h-px w-6 bg-gray-300"></div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.25em]">
                                        Advanced Medical Center
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Clinic Contact Info */}
                        <div className="text-right pt-0.5">
                            <h3 className="font-bold text-gray-900 uppercase text-[10px] tracking-wider mb-1.5 pb-1 border-b-2 border-[#DC2626] inline-block">
                                URGENT CARE
                            </h3>
                            <div className="text-[9px] text-gray-500 font-medium leading-relaxed">
                                <p>888 E Main Street, East Dundee, IL 60118</p>
                                <p className="mt-1">
                                    <span className="text-gray-900 font-bold">P:</span> (847) 426-0600
                                    <span className="mx-1.5 text-gray-300">|</span>
                                    <span className="text-gray-900 font-bold">F:</span> (224) 699-9146
                                </p>
                                <p className="mt-0.5">
                                    <span className="text-gray-900 font-bold">E:</span> immediatecareplus@gmail.com
                                </p>
                            </div>
                        </div>
                    </header>
                )}

                {/* === DEMOGRAPHICS BOX === */}
                {template.useLetterhead && details && (
                    <div className="mx-14 mb-8 relative z-10 break-inside-avoid">
                        <div className="bg-[#FAFAFA] border border-gray-200 rounded-md p-5 flex flex-wrap shadow-[0_2px_8px_rgba(0,0,0,0.03)] print:shadow-none">
                            {/* Row 1 (Formerly Row 2) */}
                            <div className="w-2/3 border-r border-gray-200 pr-6">
                                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest block mb-1">Ordering Provider</span>
                                <span className="text-sm font-bold text-gray-700 block">{details.providerName || '____________________'}</span>
                            </div>
                            <div className="w-1/3 pl-6">
                                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest block mb-1">Date of Service</span>
                                <span className="text-sm font-bold text-gray-700 block">{details.date}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* === BODY CONTENT === */}
                <div className={`pl-14 pr-12 py-2 relative z-10 ${!template.useLetterhead ? 'pt-14' : ''}`}>

                    {/* Document Title */}
                    <div className="mb-8 flex items-center break-inside-avoid">
                        <div className="w-1.5 h-8 bg-[#DC2626] mr-4 rounded-full"></div>
                        <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">
                            {template.title}
                        </h2>
                    </div>

                    {/* Main Text Content */}
                    {/* 'leading-relaxed' (1.625) provides good readability without wasting too much vertical space */}
                    <div className="print-content text-[11pt] leading-relaxed text-gray-900 font-medium text-justify">
                        {renderFormattedContent(content)}
                    </div>
                </div>

                {/* === FOOTER (Only for Preview) === */}
                {template.useLetterhead && isPreview && (
                    <footer className="mt-auto relative z-10 pl-14 pr-12 pb-10">
                        <div className="border-t-2 border-gray-100 pt-3 flex justify-between items-end">
                            <div className="text-[8px] text-gray-400 font-bold uppercase tracking-widest leading-loose">
                                <p className="text-gray-900 text-[9px] mb-1">Confidential Medical Record</p>
                                <p>This document contains protected health information (PHI).</p>
                            </div>

                            <div className="text-right">
                                <div style={{ backgroundColor: '#DC2626' }} className="inline-block text-white text-[8px] font-bold px-2 py-0.5 rounded mb-1">
                                    OFFICIAL DOCUMENT
                                </div>
                                <p className="text-[9px] text-gray-400 font-bold">Page 1 of 1</p>
                            </div>
                        </div>
                    </footer>
                )}
            </div>

            {/* Print Styles */}
            <style>{`
        @media print {
            @page { 
                margin: 0;
                size: letter;
            }
            body { 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important;
            }
        }
        .print-content strong, .print-content b {
            font-weight: 900 !important;
            color: #000 !important;
        }
        .break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
        }
      `}</style>
        </div>
    );
};

export default PrintLayout;
