
import React, { forwardRef } from 'react';
import { useMedicalDictation } from '../../hooks/useMedicalDictation';
import { generateStructuredNote, type StructuredNote } from '@/services/ClinicalReviewService';
import { playStartCue, playStopCue } from '@/services/audioService';
import AudioVisualizer from './AudioVisualizer';

interface SmartDictationInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  rows?: number;
  className?: string;
}

// ─── Copy-paste Card ────────────────────────────────────────────────────────
function NoteCard({ title, icon, content, color }: { title: string; icon: string; content: string; color: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };
  if (!content) return null;
  const colors: Record<string, string> = {
    blue: 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20',
    teal: 'border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-900/20',
    purple: 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/20',
    amber: 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20',
  };
  return (
    <div className={`rounded-xl border ${colors[color] || colors.teal} overflow-hidden`}>
      <div className="flex items-center justify-between px-4 py-2 bg-white/50 dark:bg-gray-800/50 border-b border-inherit">
        <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 flex items-center gap-2">
          <i className={`fa-solid ${icon}`}></i>{title}
        </h4>
        <button onClick={handleCopy}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-lg transition-all ${copied ? 'bg-green-100 text-green-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-teal-600 hover:bg-teal-50'}`}>
          <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`}></i>{copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="p-4 text-sm text-gray-800 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">{content}</div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
const SmartDictationInput = forwardRef<HTMLTextAreaElement, SmartDictationInputProps>(({
  value, onChange, label,
  placeholder = "Start typing or use medical dictation...",
  rows = 4, className = ""
}, ref) => {
  const { isRecording, isProcessing, recordingTime, audioData, volumeLevel, start, stop } = useMedicalDictation();
  const [lastValue, setLastValue] = React.useState<string | null>(null);
  const [showUndo, setShowUndo] = React.useState(false);
  const [structuredNote, setStructuredNote] = React.useState<StructuredNote | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);

  const handleMicClick = async () => {
    if (isRecording) {
      playStopCue(); setLastValue(value);
      const text = await stop();
      if (text) { onChange(value + (value.length > 0 && !value.endsWith(' ') ? ' ' : '') + text); setShowUndo(true); setTimeout(() => setShowUndo(false), 5000); }
    } else { playStartCue(); await start(); }
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'm') { e.preventDefault(); handleMicClick(); } };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording, value, handleMicClick]);

  const handleGenerate = async () => {
    if (!value || isGenerating) return;
    setIsGenerating(true); setStructuredNote(null); setShowResults(true);
    try { setStructuredNote(await generateStructuredNote(value)); } catch (err) { console.error('[NoteGen]', err); }
    setIsGenerating(false);
  };

  const closeModal = () => setShowResults(false);
  const handleUndo = () => { if (lastValue !== null) { onChange(lastValue); setLastValue(null); setShowUndo(false); } };
  const formatTime = (s: number) => `${Math.floor(s/60)}:${s%60 < 10 ? '0' : ''}${s%60}`;

  const getCPTColor = (cpt: string) => {
    if (cpt?.includes('99215') || cpt?.includes('99205')) return 'bg-red-500';
    if (cpt?.includes('99214') || cpt?.includes('99204')) return 'bg-amber-500';
    return 'bg-blue-500';
  };

  // Close on Escape key
  React.useEffect(() => {
    if (!showResults) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showResults]);

  return (
    <div className="w-full relative group">
      {label && <label className="block text-xs font-bold uppercase text-gray-500 mb-2 tracking-wide">{label}</label>}

      <div className={`relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm focus-within:ring-2 focus-within:ring-teal-500 transition-all overflow-hidden ${isRecording ? 'ring-2 ring-teal-500/50 border-teal-500' : ''}`}>
        <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} disabled={isProcessing}
          className={`w-full p-4 bg-transparent resize-none outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 ${isProcessing ? 'opacity-50' : ''} ${className}`} />

        <div className="absolute bottom-3 right-3 flex items-center gap-3 z-10">
          {isRecording && (
            <div className="flex items-center gap-3 bg-gray-900/10 dark:bg-black/40 backdrop-blur-md rounded-full pr-1 pl-4 py-1 animate-fade-in border border-gray-200 dark:border-gray-700">
              <span className="text-xs font-mono font-bold text-red-600 dark:text-red-400 tabular-nums">{formatTime(recordingTime)}</span>
              <div className="w-[80px] h-[24px] flex items-center justify-center"><AudioVisualizer audioData={audioData} isRecording={isRecording} /></div>
            </div>
          )}
          <button type="button" onClick={handleMicClick} disabled={isProcessing || isGenerating}
            className={`relative flex items-center justify-center w-10 h-10 rounded-full shadow-md transition-all duration-300 ${isRecording ? 'bg-red-50 text-red-600 scale-110 ring-4 ring-red-100 animate-pulse-slow' : 'bg-white dark:bg-gray-700 text-gray-400 hover:text-teal-600 hover:bg-teal-50 border border-gray-200 dark:border-gray-600'} ${(isProcessing || isGenerating) ? 'cursor-wait bg-gray-100' : ''}`}
            title={isRecording ? "Stop Dictation" : "Start Medical Dictation (Ctrl+M)"}>
            {(isProcessing || isGenerating) ? (
              <svg className="animate-spin h-5 w-5 text-teal-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
            ) : isRecording ? <i className="fa-solid fa-stop text-sm"/> : <i className="fa-solid fa-microphone text-sm"/>}
          </button>
          {!isRecording && value.length > 10 && (
            <div className="flex items-center gap-2 animate-fade-in">
              {showUndo && <button type="button" onClick={handleUndo} className="text-[10px] font-bold text-gray-400 hover:text-red-500 underline uppercase tracking-tighter">Undo</button>}
              <button type="button" onClick={handleGenerate} disabled={isGenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-xs font-bold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
                title="Generate CC, HPI, Diagnoses & Plan">
                <i className="fa-solid fa-wand-magic-sparkles text-[10px]"/><span>Generate Note</span>
              </button>
            </div>
          )}
        </div>
        {isRecording && (
          <div className="absolute bottom-4 left-4 h-1.5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-150 ${volumeLevel > 70 ? 'bg-red-400' : volumeLevel > 15 ? 'bg-teal-400' : 'bg-gray-400'}`} style={{ width: `${volumeLevel}%` }}/>
          </div>
        )}
      </div>

      {(isProcessing || isGenerating) && (
        <p className="absolute -bottom-6 right-0 text-xs text-teal-600 font-bold animate-pulse">
          <i className="fa-solid fa-wand-magic-sparkles mr-1"/>{isProcessing ? 'Transcribing...' : 'Generating CC, HPI, Dx & Plan...'}
        </p>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          RESULTS MODAL — Fixed layout: header + scrollable body + footer
         ═══════════════════════════════════════════════════════════════════ */}
      {showResults && (
        <div
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={closeModal}
        >
          {/* Modal container — centered with fixed dimensions */}
          <div
            className="absolute inset-2 sm:inset-3 flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── FIXED HEADER ── */}
            <div className="shrink-0 px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-gray-800 dark:to-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg">
                  <i className="fa-solid fa-file-medical text-white text-sm"></i>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Structured Clinical Note</h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">AI-generated suggestions — Copy each section into your EHR</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {structuredNote && (
                  <div className={`${getCPTColor(structuredNote.suggestedCPT)} text-white px-2.5 py-1 rounded-lg shadow-md`}>
                    <span className="text-xs font-black">{structuredNote.suggestedCPT}</span>
                  </div>
                )}
                <button
                  onClick={closeModal}
                  className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-600 flex items-center justify-center transition-colors text-gray-600 dark:text-gray-300"
                  title="Close (Esc)"
                >
                  <i className="fa-solid fa-xmark text-base"></i>
                </button>
              </div>
            </div>

            {/* ── SCROLLABLE CONTENT ── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0 }}>
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <svg className="animate-spin h-10 w-10 text-teal-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  <div className="text-center">
                    <p className="text-sm font-bold text-teal-600">Generating structured note...</p>
                    <p className="text-xs text-gray-400 mt-1">Analyzing dictation → CC, HPI, Dx & Plan</p>
                  </div>
                </div>
              ) : structuredNote ? (
                <>
                  {/* Disclaimer */}
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
                    <i className="fa-solid fa-info-circle text-amber-500 mt-0.5 text-xs"></i>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      <strong>AI-Generated Suggestions:</strong> All content below is generated by AI as a documentation aid.
                      The provider must review, modify, and approve all sections before use. This does not constitute medical advice.
                    </p>
                  </div>

                  <NoteCard title="Chief Complaint" icon="fa-comment-medical" content={structuredNote.chiefComplaint} color="blue" />
                  <NoteCard title="History of Present Illness" icon="fa-notes-medical" content={structuredNote.hpi} color="teal" />
                  <NoteCard title="Assessment / Diagnoses" icon="fa-stethoscope" content={structuredNote.diagnoses} color="amber" />
                  <NoteCard title="Plan" icon="fa-clipboard-list" content={structuredNote.plan} color="purple" />

                  {/* Conduct Alerts */}
                  {structuredNote.conductAlerts && structuredNote.conductAlerts.length > 0 && (
                    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20 overflow-hidden">
                      <div className="px-4 py-2 bg-white/50 dark:bg-gray-800/50 border-b border-inherit">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-red-600 flex items-center gap-2">
                          <i className="fa-solid fa-triangle-exclamation"></i> Clinical Conduct Alerts
                        </h4>
                      </div>
                      <div className="p-3 space-y-2">
                        {structuredNote.conductAlerts.map((alert, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                            <i className="fa-solid fa-circle-exclamation text-red-500 mt-0.5 text-xs shrink-0"></i>
                            <span>{alert}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upcoding Suggestions — case-specific */}
                  {structuredNote.upcodingSuggestions && structuredNote.upcodingSuggestions.length > 0 && (
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20 overflow-hidden">
                      <div className="px-4 py-2 bg-white/50 dark:bg-gray-800/50 border-b border-inherit">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                          <i className="fa-solid fa-arrow-trend-up"></i> Documentation Opportunities → Reach 99214
                        </h4>
                      </div>
                      <div className="p-3 space-y-2">
                        {structuredNote.upcodingSuggestions.map((sug, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                            <i className="fa-solid fa-lightbulb text-emerald-500 mt-0.5 text-xs shrink-0"></i>
                            <span>{sug}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* MDM Level */}
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 flex items-center gap-3">
                    <span className={`${getCPTColor(structuredNote.suggestedCPT)} text-white text-xs font-black px-2.5 py-1 rounded-lg`}>
                      {structuredNote.suggestedCPT}
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-300">{structuredNote.mdmLevel}</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <i className="fa-solid fa-triangle-exclamation text-3xl text-red-400 mb-2"></i>
                  <p className="text-sm font-bold">Error generating note — check AI Gateway</p>
                </div>
              )}
            </div>

            {/* ── FIXED FOOTER ── */}
            {structuredNote && (
              <div className="shrink-0 px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-3">
                <button
                  onClick={async () => {
                    const full = `CHIEF COMPLAINT:\n${structuredNote.chiefComplaint}\n\nHISTORY OF PRESENT ILLNESS:\n${structuredNote.hpi}\n\nASSESSMENT / DIAGNOSES:\n${structuredNote.diagnoses}\n\nPLAN:\n${structuredNote.plan}`;
                    await navigator.clipboard.writeText(full);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-sm font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-copy"></i> Copy Full Note
                </button>
                <button
                  onClick={closeModal}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

SmartDictationInput.displayName = 'SmartDictationInput';
export default SmartDictationInput;
