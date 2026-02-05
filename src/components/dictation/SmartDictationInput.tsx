
import React, { forwardRef } from 'react';
import { useMedicalDictation } from '../../hooks/useMedicalDictation';
import { refineClinicalNote } from '@/services/geminiService';
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
    const refined = await refineClinicalNote(value);
    setRefinedValue(refined);
    setIsRefining(false);
    setShowComparison(true);
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
                title="Magic Refine (Clinical AI)"
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
      {(isProcessing || isRefining) && (
        <p className="absolute -bottom-6 right-0 text-xs text-teal-600 font-bold animate-pulse">
          <i className="fa-solid fa-wand-magic-sparkles mr-1"></i> {isProcessing ? 'Transcribing...' : 'Refining Clinical Note...'}
        </p>
      )}

      {/* Comparison Modal */}
      {showComparison && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <i className="fa-solid fa-wand-magic-sparkles text-teal-500"></i>
                  Clinical Refinement Review
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Compare and clinical-grade your dictation</p>
              </div>
              <button
                onClick={() => setShowComparison(false)}
                className="w-10 h-10 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition-colors"
              >
                <i className="fa-solid fa-xmark text-gray-500"></i>
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-gray-900">
              {/* Original Pane */}
              <div className="flex flex-col gap-3">
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
                <div className="flex-1 p-5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm leading-relaxed min-h-[200px] whitespace-pre-wrap italic">
                  {value}
                </div>
              </div>

              {/* Refined Pane */}
              <div className="flex flex-col gap-3">
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
                <div className="flex-1 p-5 rounded-xl bg-teal-50/30 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-900/30 text-gray-800 dark:text-gray-100 text-sm leading-relaxed font-medium min-h-[200px] whitespace-pre-wrap">
                  {refinedValue}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-end gap-3">
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
