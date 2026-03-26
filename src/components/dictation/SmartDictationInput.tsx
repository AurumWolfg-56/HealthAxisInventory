
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

// ─── Copy-paste Card Component ──────────────────────────────────────────────
function NoteCard({ title, icon, content, color }: { title: string; icon: string; content: string; color: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (!content) return null;

  const colors: Record<string, string> = {
    blue: 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20',
    teal: 'border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-900/20',
    purple: 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/20',
  };

  return (
    <div className={`rounded-xl border ${colors[color] || colors.teal} overflow-hidden`}>
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/50 dark:bg-gray-800/50 border-b border-inherit">
        <h4 className="text-xs font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 flex items-center gap-2">
          <i className={`fa-solid ${icon} text-${color}-500`}></i>
          {title}
        </h4>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-lg transition-all ${
            copied
              ? 'bg-green-100 text-green-600'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-teal-600 hover:bg-teal-50'
          }`}
        >
          <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`}></i>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="p-4 text-sm text-gray-800 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
const SmartDictationInput = forwardRef<HTMLTextAreaElement, SmartDictationInputProps>(({
  value,
  onChange,
  label,
  placeholder = "Start typing or use medical dictation...",
  rows = 4,
  className = ""
}, ref) => {
  const {
    isRecording,
    isProcessing,
    recordingTime,
    audioData,
    volumeLevel,
    start,
    stop
  } = useMedicalDictation();

  const [lastValue, setLastValue] = React.useState<string | null>(null);
  const [showUndo, setShowUndo] = React.useState(false);
  
  // Structured note state
  const [structuredNote, setStructuredNote] = React.useState<StructuredNote | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);

  const handleMicClick = async () => {
    if (isRecording) {
      playStopCue();
      setLastValue(value);
      const text = await stop();
      if (text) {
        const prefix = value.length > 0 && !value.endsWith(' ') ? ' ' : '';
        onChange(value + prefix + text);
        setShowUndo(true);
        setTimeout(() => setShowUndo(false), 5000);
      }
    } else {
      playStartCue();
      await start();
    }
  };

  // Keyboard Shortcut: Ctrl + M
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        handleMicClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording, value, handleMicClick]);

  const handleGenerate = async () => {
    if (!value || isGenerating) return;
    setIsGenerating(true);
    setStructuredNote(null);
    setShowResults(true);
    try {
      const result = await generateStructuredNote(value);
      setStructuredNote(result);
    } catch (err) {
      console.error('[NoteGen] Error:', err);
    }
    setIsGenerating(false);
  };

  const handleUndo = () => {
    if (lastValue !== null) {
      onChange(lastValue);
      setLastValue(null);
      setShowUndo(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // E/M Level badge color
  const getCPTColor = (cpt: string) => {
    if (cpt?.includes('99215') || cpt?.includes('99205')) return 'bg-red-500';
    if (cpt?.includes('99214') || cpt?.includes('99204')) return 'bg-amber-500';
    if (cpt?.includes('99213') || cpt?.includes('99203')) return 'bg-blue-500';
    return 'bg-gray-500';
  };

  return (
    <div className="w-full relative group">
      {label && (
        <label className="block text-xs font-bold uppercase text-gray-500 mb-2 tracking-wide">
          {label}
        </label>
      )}

      <div className={`relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm focus-within:ring-2 focus-within:ring-teal-500 transition-all overflow-hidden ${isRecording ? 'ring-2 ring-teal-500/50 border-teal-500' : ''}`}>
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          disabled={isProcessing}
          className={`w-full p-4 bg-transparent resize-none outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 ${isProcessing ? 'opacity-50' : ''} ${className}`}
        />

        {/* Control Bar */}
        <div className="absolute bottom-3 right-3 flex items-center gap-3 z-10">
          {isRecording && (
            <div className="flex items-center gap-3 bg-gray-900/10 dark:bg-black/40 backdrop-blur-md rounded-full pr-1 pl-4 py-1 animate-fade-in border border-gray-200 dark:border-gray-700">
              <span className="text-xs font-mono font-bold text-red-600 dark:text-red-400 tabular-nums">
                {formatTime(recordingTime)}
              </span>
              <div className="w-[80px] h-[24px] flex items-center justify-center">
                <AudioVisualizer audioData={audioData} isRecording={isRecording} />
              </div>
            </div>
          )}

          {/* Mic Button */}
          <button
            type="button"
            onClick={handleMicClick}
            disabled={isProcessing || isGenerating}
            className={`
              relative flex items-center justify-center w-10 h-10 rounded-full shadow-md transition-all duration-300
              ${isRecording
                ? 'bg-red-50 text-red-600 scale-110 ring-4 ring-red-100 animate-pulse-slow'
                : 'bg-white dark:bg-gray-700 text-gray-400 hover:text-teal-600 hover:bg-teal-50 border border-gray-200 dark:border-gray-600'
              }
              ${(isProcessing || isGenerating) ? 'cursor-wait bg-gray-100' : ''}
            `}
            title={isRecording ? "Stop Dictation" : "Start Medical Dictation (Ctrl+M)"}
          >
            {(isProcessing || isGenerating) ? (
              <svg className="animate-spin h-5 w-5 text-teal-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : isRecording ? (
              <i className="fa-solid fa-stop text-sm"></i>
            ) : (
              <i className="fa-solid fa-microphone text-sm"></i>
            )}
          </button>

          {/* Generate Structured Note Button */}
          {!isRecording && value.length > 10 && (
            <div className="flex items-center gap-2 animate-fade-in">
              {showUndo && (
                <button type="button" onClick={handleUndo}
                  className="text-[10px] font-bold text-gray-400 hover:text-red-500 underline uppercase tracking-tighter">
                  Undo
                </button>
              )}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-xs font-bold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
                title="Generate CC, HPI & Plan"
              >
                <i className="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
                Generate Note
              </button>
            </div>
          )}
        </div>

        {/* Level Meter */}
        {isRecording && (
          <div className="absolute bottom-4 left-4 h-1.5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ${volumeLevel > 70 ? 'bg-red-400' : volumeLevel > 15 ? 'bg-teal-400' : 'bg-gray-400'}`}
              style={{ width: `${volumeLevel}%` }}
            />
          </div>
        )}
      </div>

      {/* Progress indicator */}
      {(isProcessing || isGenerating) && (
        <p className="absolute -bottom-6 right-0 text-xs text-teal-600 font-bold animate-pulse">
          <i className="fa-solid fa-wand-magic-sparkles mr-1"></i>
          {isProcessing ? 'Transcribing...' : 'Generating CC, HPI & Plan...'}
        </p>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          RESULTS MODAL — CC, HPI, Plan cards ready to copy-paste
         ═══════════════════════════════════════════════════════════════════ */}
      {showResults && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800">
            
            {/* Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-gray-800 dark:to-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg">
                  <i className="fa-solid fa-file-medical text-white"></i>
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Structured Clinical Note</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Copy each section into your EHR</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* CPT Badge */}
                {structuredNote && (
                  <div className={`${getCPTColor(structuredNote.suggestedCPT)} text-white px-3 py-1.5 rounded-lg shadow-md`}>
                    <span className="text-xs font-black">{structuredNote.suggestedCPT}</span>
                  </div>
                )}
                <button
                  onClick={() => setShowResults(false)}
                  className="w-9 h-9 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition-colors"
                >
                  <i className="fa-solid fa-xmark text-gray-500"></i>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <svg className="animate-spin h-10 w-10 text-teal-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <div className="text-center">
                    <p className="text-sm font-bold text-teal-600">Generating structured note...</p>
                    <p className="text-xs text-gray-400 mt-1">Analyzing dictation → CC, HPI & Plan</p>
                  </div>
                </div>
              ) : structuredNote ? (
                <>
                  {/* CC Card */}
                  <NoteCard
                    title="Chief Complaint"
                    icon="fa-comment-medical"
                    content={structuredNote.chiefComplaint}
                    color="blue"
                  />

                  {/* HPI Card */}
                  <NoteCard
                    title="History of Present Illness"
                    icon="fa-notes-medical"
                    content={structuredNote.hpi}
                    color="teal"
                  />

                  {/* Plan Card */}
                  <NoteCard
                    title="Assessment & Plan"
                    icon="fa-clipboard-list"
                    content={structuredNote.plan}
                    color="purple"
                  />

                  {/* MDM Level + Insurance Tips */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* MDM Level */}
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">E/M Level</h4>
                      <div className="flex items-center gap-2">
                        <span className={`${getCPTColor(structuredNote.suggestedCPT)} text-white text-xs font-black px-2 py-0.5 rounded`}>
                          {structuredNote.suggestedCPT}
                        </span>
                        <span className="text-xs text-gray-600 dark:text-gray-300">{structuredNote.mdmLevel}</span>
                      </div>
                    </div>

                    {/* Insurance Tips */}
                    {structuredNote.insuranceTips.length > 0 && (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">
                          <i className="fa-solid fa-shield-halved mr-1"></i> Insurance Tips
                        </h4>
                        {structuredNote.insuranceTips.map((tip, i) => (
                          <p key={i} className="text-xs text-amber-700 dark:text-amber-300 mb-1 last:mb-0">• {tip}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Copy All */}
                  <button
                    onClick={async () => {
                      const full = `CHIEF COMPLAINT:\n${structuredNote.chiefComplaint}\n\nHISTORY OF PRESENT ILLNESS:\n${structuredNote.hpi}\n\nASSESSMENT & PLAN:\n${structuredNote.plan}`;
                      await navigator.clipboard.writeText(full);
                    }}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-sm font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-copy"></i>
                    Copy Full Note (CC + HPI + Plan)
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <i className="fa-solid fa-triangle-exclamation text-3xl text-red-400 mb-2"></i>
                  <p className="text-sm font-bold">Error generating note — check if AI Gateway is running</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

SmartDictationInput.displayName = 'SmartDictationInput';

export default SmartDictationInput;
