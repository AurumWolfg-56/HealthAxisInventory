
import React, { forwardRef } from 'react';
import { useMedicalDictation } from '../../hooks/useMedicalDictation';
import { refineClinicalNote } from '@/services/LocalAIService';
import { performClinicalReview, type ClinicalReview } from '@/services/ClinicalReviewService';
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
  const [refinedValue, setRefinedValue] = React.useState<string | null>(null);
  const [showUndo, setShowUndo] = React.useState(false);
  const [isRefining, setIsRefining] = React.useState(false);
  const [showComparison, setShowComparison] = React.useState(false);
  const [copyFeedback, setCopyFeedback] = React.useState<'original' | 'refined' | null>(null);
  
  // Clinical Review state
  const [clinicalReview, setClinicalReview] = React.useState<ClinicalReview | null>(null);
  const [isReviewing, setIsReviewing] = React.useState(false);
  const [activeReviewTab, setActiveReviewTab] = React.useState<'plan' | 'mdm' | 'alerts' | 'insurance'>('mdm');

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

  const handleRefine = async () => {
    if (!value || isRefining) return;
    setIsRefining(true);
    setClinicalReview(null); // Reset previous review
    const refined = await refineClinicalNote(value);
    setRefinedValue(refined);
    setIsRefining(false);
    setShowComparison(true);
    
    // Auto-trigger clinical review on the refined note
    setIsReviewing(true);
    try {
      const review = await performClinicalReview(refined || value);
      setClinicalReview(review);
    } catch (err) {
      console.error('[ClinicalReview] Error:', err);
    }
    setIsReviewing(false);
  };

  const handleCopy = async (text: string, type: 'original' | 'refined') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(type);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleApplyRefinement = () => {
    if (refinedValue) {
      setLastValue(value);
      onChange(refinedValue);
      setRefinedValue(null);
      setShowComparison(false);
      setShowUndo(true);
      setTimeout(() => setShowUndo(false), 5000);
    }
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

  // ─── MDM Level Color & Badge ──────────────────────────────────────────
  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'high': return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800', badge: 'bg-red-500' };
      case 'moderate': return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', badge: 'bg-amber-500' };
      case 'low': return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800', badge: 'bg-blue-500' };
      default: return { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-200 dark:border-gray-700', badge: 'bg-gray-500' };
    }
  };

  return (
    <div className="w-full relative group">
      {label && (
        <label className="block text-xs font-bold uppercase text-gray-500 mb-2 tracking-wide">
          {label}
        </label>
      )}

      <div className={`relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm focus-within:ring-2 focus-within:ring-teal-500 transition-all overflow-hidden ${isRecording ? 'ring-2 ring-teal-500/50 border-teal-500' : ''}`}>

        {/* Text Area */}
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          disabled={isProcessing} // Lock input while AI thinks
          className={`w-full p-4 bg-transparent resize-none outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 ${isProcessing ? 'opacity-50' : ''} ${className}`}
        />

        {/* Dictation Control Bar (Bottom Right) */}
        <div className="absolute bottom-3 right-3 flex items-center gap-3 z-10">

          {/* Active Recording State: Visualizer & Timer */}
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
            disabled={isProcessing || isRefining}
            className={`
              relative flex items-center justify-center w-10 h-10 rounded-full shadow-md transition-all duration-300
              ${isRecording
                ? 'bg-red-50 text-red-600 scale-110 ring-4 ring-red-100 animate-pulse-slow'
                : 'bg-white dark:bg-gray-700 text-gray-400 hover:text-teal-600 hover:bg-teal-50 border border-gray-200 dark:border-gray-600'
              }
              ${(isProcessing || isRefining) ? 'cursor-wait bg-gray-100' : ''}
            `}
            title={isRecording ? "Stop Dictation" : "Start Medical Dictation"}
          >
            {(isProcessing || isRefining) ? (
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

          {/* Special Actions for Premium Feed */}
          {!isRecording && value.length > 10 && (
            <div className="flex items-center gap-2 animate-fade-in">
              {showUndo && (
                <button
                  type="button"
                  onClick={handleUndo}
                  className="text-[10px] font-bold text-gray-400 hover:text-red-500 underline uppercase tracking-tighter"
                >
                  Undo
                </button>
              )}
              <button
                type="button"
                onClick={handleRefine}
                disabled={isRefining}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-50 text-teal-600 hover:bg-teal-600 hover:text-white transition-colors border border-teal-100"
                title="Magic Refine + Clinical Review"
              >
                <i className="fa-solid fa-wand-magic-sparkles text-xs"></i>
              </button>
            </div>
          )}
        </div>

        {/* Level Meter (Left side, only when recording) */}
        {isRecording && (
          <div className="absolute bottom-4 left-4 h-1.5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ${volumeLevel > 70 ? 'bg-red-400' : volumeLevel > 15 ? 'bg-teal-400' : 'bg-gray-400'}`}
              style={{ width: `${volumeLevel}%` }}
            />
          </div>
        )}
      </div>

      {/* Helper Text & Progress */}
      {(isProcessing || isRefining || isReviewing) && (
        <p className="absolute -bottom-6 right-0 text-xs text-teal-600 font-bold animate-pulse">
          <i className="fa-solid fa-wand-magic-sparkles mr-1"></i> {isProcessing ? 'Transcribing...' : isRefining ? 'Refining Clinical Note...' : 'Analyzing MDM & Generating Plan...'}
        </p>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          COMPARISON MODAL (Original vs Refined + Clinical Review)
         ═══════════════════════════════════════════════════════════════════ */}
      {showComparison && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <i className="fa-solid fa-wand-magic-sparkles text-teal-500"></i>
                  Clinical Refinement & Review
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">AI-refined note with MDM analysis, treatment plan & documentation suggestions</p>
              </div>
              <button
                onClick={() => setShowComparison(false)}
                className="w-10 h-10 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition-colors"
              >
                <i className="fa-solid fa-xmark text-gray-500"></i>
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* Row 1: Original vs Refined */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                {/* Original Pane */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Original Transcription</span>
                    <button
                      onClick={() => handleCopy(value, 'original')}
                      className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
                    >
                      <i className={`fa-solid ${copyFeedback === 'original' ? 'fa-check' : 'fa-copy'}`}></i>
                      {copyFeedback === 'original' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="flex-1 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm leading-relaxed min-h-[150px] whitespace-pre-wrap italic">
                    {value}
                  </div>
                </div>

                {/* Refined Pane */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-teal-500">Clinical Refinement</span>
                    <button
                      onClick={() => refinedValue && handleCopy(refinedValue, 'refined')}
                      className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
                    >
                      <i className={`fa-solid ${copyFeedback === 'refined' ? 'fa-check' : 'fa-copy'}`}></i>
                      {copyFeedback === 'refined' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="flex-1 p-4 rounded-xl bg-teal-50/30 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-900/30 text-gray-800 dark:text-gray-100 text-sm leading-relaxed font-medium min-h-[150px] whitespace-pre-wrap">
                    {refinedValue}
                  </div>
                </div>
              </div>

              {/* ─── Clinical Review Section ─────────────────────────────── */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
                {isReviewing ? (
                  <div className="flex items-center justify-center py-12 gap-3">
                    <svg className="animate-spin h-6 w-6 text-teal-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm font-bold text-teal-600">Analyzing MDM & generating treatment plan...</span>
                  </div>
                ) : clinicalReview ? (
                  <>
                    {/* E/M Level Badge */}
                    <div className={`flex items-center gap-4 p-4 rounded-xl mb-4 border ${getLevelStyle(clinicalReview.mdmResult.level).bg} ${getLevelStyle(clinicalReview.mdmResult.level).border}`}>
                      <div className={`w-14 h-14 rounded-xl ${getLevelStyle(clinicalReview.mdmResult.level).badge} text-white flex items-center justify-center shadow-lg`}>
                        <span className="text-lg font-black">{clinicalReview.mdmResult.cptCode.slice(-2)}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-black ${getLevelStyle(clinicalReview.mdmResult.level).text}`}>
                            {clinicalReview.mdmResult.cptCode}
                          </span>
                          <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${getLevelStyle(clinicalReview.mdmResult.level).badge} text-white`}>
                            {clinicalReview.mdmResult.level}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{clinicalReview.mdmResult.cptDescription}</p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">2-of-3 Rule</p>
                        <div className="flex gap-1 mt-1">
                          {(['problems', 'data', 'risk'] as const).map((el) => {
                            const lvl = clinicalReview.mdmResult.breakdown[el].level;
                            return (
                              <span key={el} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getLevelStyle(lvl).badge} text-white`}>
                                {el[0].toUpperCase()}: {lvl.slice(0, 3).toUpperCase()}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                      {([
                        { id: 'mdm' as const, icon: 'fa-chart-bar', label: 'MDM Breakdown' },
                        { id: 'plan' as const, icon: 'fa-clipboard-list', label: 'Treatment Plan' },
                        { id: 'alerts' as const, icon: 'fa-triangle-exclamation', label: `Alerts ${clinicalReview.logicAlerts.length + clinicalReview.suggestions.length > 0 ? `(${clinicalReview.logicAlerts.length + clinicalReview.suggestions.length})` : ''}` },
                        { id: 'insurance' as const, icon: 'fa-shield-halved', label: `Insurance ${clinicalReview.insuranceTips.length > 0 ? `(${clinicalReview.insuranceTips.length})` : ''}` },
                      ]).map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveReviewTab(tab.id)}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all ${
                            activeReviewTab === tab.id
                              ? 'bg-white dark:bg-gray-700 text-teal-600 shadow-sm'
                              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                          }`}
                        >
                          <i className={`fa-solid ${tab.icon}`}></i>
                          <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Tab Content */}
                    <div className="min-h-[200px]">
                      {/* MDM Breakdown Tab */}
                      {activeReviewTab === 'mdm' && (
                        <div className="space-y-3">
                          {(['problems', 'data', 'risk'] as const).map((element) => {
                            const score = clinicalReview.mdmResult.breakdown[element];
                            const style = getLevelStyle(score.level);
                            return (
                              <div key={element} className={`p-4 rounded-xl border ${style.border} ${style.bg}`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-bold capitalize text-gray-800 dark:text-gray-100">
                                    {element === 'data' ? 'Data Reviewed' : element.charAt(0).toUpperCase() + element.slice(1)}
                                  </span>
                                  <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${style.badge} text-white`}>
                                    {score.level}
                                  </span>
                                </div>
                                <p className={`text-sm ${style.text}`}>{score.reasoning}</p>
                              </div>
                            );
                          })}

                          {/* Upcoding Gaps */}
                          {clinicalReview.mdmResult.gaps.length > 0 && (
                            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800">
                              <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2 mb-3">
                                <i className="fa-solid fa-arrow-trend-up"></i>
                                Documentation Opportunities → {clinicalReview.mdmResult.gaps[0]?.targetCPT}
                              </h4>
                              {clinicalReview.mdmResult.gaps.map((gap, i) => (
                                <div key={i} className="flex items-start gap-2 mb-2 last:mb-0">
                                  <span className="text-emerald-500 mt-0.5"><i className="fa-solid fa-lightbulb text-xs"></i></span>
                                  <div>
                                    <span className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400">{gap.element}:</span>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{gap.suggestion}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Treatment Plan Tab */}
                      {activeReviewTab === 'plan' && (
                        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                              <i className="fa-solid fa-clipboard-list text-teal-500"></i>
                              Recommended Treatment Plan
                            </h4>
                            <button
                              onClick={() => clinicalReview.treatmentPlan && navigator.clipboard.writeText(clinicalReview.treatmentPlan)}
                              className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                            >
                              <i className="fa-solid fa-copy"></i> Copy Plan
                            </button>
                          </div>
                          <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {clinicalReview.treatmentPlan}
                          </div>
                        </div>
                      )}

                      {/* Alerts Tab */}
                      {activeReviewTab === 'alerts' && (
                        <div className="space-y-3">
                          {clinicalReview.logicAlerts.length > 0 && (
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-widest text-red-500 mb-2">
                                <i className="fa-solid fa-triangle-exclamation mr-1"></i> Logic Alerts
                              </h4>
                              {clinicalReview.logicAlerts.map((alert, i) => (
                                <div key={i} className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 mb-2 flex items-start gap-2">
                                  <i className="fa-solid fa-circle-exclamation text-red-500 mt-0.5 text-xs"></i>
                                  <span>{alert}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {clinicalReview.suggestions.length > 0 && (
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-2">
                                <i className="fa-solid fa-lightbulb mr-1"></i> Upcoding Suggestions
                              </h4>
                              {clinicalReview.suggestions.map((sug, i) => (
                                <div key={i} className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300 mb-2 flex items-start gap-2">
                                  <i className="fa-solid fa-arrow-trend-up text-amber-500 mt-0.5 text-xs"></i>
                                  <span>{sug}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {clinicalReview.logicAlerts.length === 0 && clinicalReview.suggestions.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                              <i className="fa-solid fa-check-circle text-3xl text-green-400 mb-2"></i>
                              <p className="text-sm font-bold">No alerts — documentation looks good!</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Insurance Tab */}
                      {activeReviewTab === 'insurance' && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-3">
                            <i className="fa-solid fa-shield-halved mr-1"></i> Insurance Optimization Tips
                          </h4>
                          {clinicalReview.insuranceTips.length > 0 ? (
                            clinicalReview.insuranceTips.map((tip, i) => (
                              <div key={i} className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
                                <i className="fa-solid fa-shield-check text-blue-500 mt-0.5 text-xs"></i>
                                <span>{tip}</span>
                              </div>
                            ))
                          ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                              <i className="fa-solid fa-check-circle text-3xl text-green-400 mb-2"></i>
                              <p className="text-sm font-bold">Documentation is well-structured for insurance purposes</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-5 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                onClick={() => setShowComparison(false)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                Keep Original
              </button>
              <button
                onClick={handleApplyRefinement}
                className="w-full sm:w-auto px-8 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 text-white text-sm font-bold shadow-lg shadow-teal-500/30 hover:shadow-teal-500/40 transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-check"></i>
                Apply Refined Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

SmartDictationInput.displayName = 'SmartDictationInput';

export default SmartDictationInput;
