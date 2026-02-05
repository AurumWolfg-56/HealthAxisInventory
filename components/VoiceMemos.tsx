
import React, { useState, useEffect } from 'react';
import SmartDictationInput from '../src/components/dictation/SmartDictationInput';
import { User } from '../types';

interface VoiceMemosProps {
  user: User;
  t: (key: string) => string;
}

interface Memo {
  id: string;
  content: string;
  timestamp: string;
  author: string;
}

const VoiceMemos: React.FC<VoiceMemosProps> = ({ user, t }) => {
  const [currentNote, setCurrentNote] = useState('');
  const [memos, setMemos] = useState<Memo[]>(() => {
    try {
      const stored = localStorage.getItem('ha_voice_memos');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('ha_voice_memos', JSON.stringify(memos));
  }, [memos]);

  const saveMemo = () => {
    if (!currentNote.trim()) return;
    const newMemo: Memo = {
      id: Date.now().toString(),
      content: currentNote,
      timestamp: new Date().toISOString(),
      author: user.username
    };
    setMemos([newMemo, ...memos]);
    setCurrentNote('');
  };

  const deleteMemo = (id: string) => {
    if (window.confirm("Delete this memo?")) {
      setMemos(memos.filter(m => m.id !== id));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  return (
    <div className="space-y-10 pb-20 animate-fade-in-up max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-medical-500 flex items-center justify-center shadow-lg shadow-medical-500/20">
            <i className="fa-solid fa-microphone-lines text-xl text-white"></i>
          </div>
          <div>
            <h2 className="text-display text-slate-900 dark:text-white">Voice Memos</h2>
            <p className="text-caption mt-0.5">Medical Dictation & Quick Notes</p>
          </div>
        </div>
      </header>

      {/* Input Area */}
      <div className="glass-panel p-8 rounded-[2.5rem] shadow-glass border border-white/50 dark:border-slate-800">
        <div className="mb-6 flex justify-between items-center">
          <label className="text-sm font-bold text-slate-500 uppercase tracking-widest ml-2">New Memo</label>
          <span className="inline-flex items-center gap-2 text-xs text-teal-700 bg-teal-100 px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-teal-200">
            <i className="fa-solid fa-wand-magic-sparkles"></i> AI Powered
          </span>
        </div>
        <SmartDictationInput
          value={currentNote}
          onChange={setCurrentNote}
          placeholder="Tap the microphone to dictate clinical notes, reminders, or observations..."
          rows={6}
          className="text-xl leading-relaxed bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-transparent focus:ring-4 focus:ring-teal-500/20 p-6 placeholder:text-slate-400"
        />
        <div className="flex justify-end mt-6">
          <button
            onClick={saveMemo}
            disabled={!currentNote.trim()}
            className="px-10 py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-lg shadow-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
          >
            <i className="fa-solid fa-floppy-disk"></i> Save Note
          </button>
        </div>
      </div>

      {/* Memos Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {memos.length === 0 ? (
          <div className="col-span-full py-20 text-center text-slate-400 flex flex-col items-center">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-6">
              <i className="fa-solid fa-note-sticky text-4xl opacity-30"></i>
            </div>
            <p className="text-lg font-medium">No voice memos saved yet.</p>
            <p className="text-sm opacity-70">Start dictating above to create your first note.</p>
          </div>
        ) : (
          memos.map(memo => (
            <div key={memo.id} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-float hover:shadow-xl transition-all duration-300 relative group flex flex-col hover:-translate-y-1">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 text-white flex items-center justify-center text-sm font-bold shadow-md">
                    {memo.author.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{memo.author}</span>
                    <span className="text-xs text-slate-400 font-mono">{new Date(memo.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => copyToClipboard(memo.content)} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100" title="Copy text">
                    <i className="fa-regular fa-copy"></i>
                  </button>
                  <button onClick={() => deleteMemo(memo.id)} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100" title="Delete">
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 mb-2">
                <p className="text-slate-700 dark:text-slate-300 text-base leading-relaxed whitespace-pre-wrap font-medium">
                  {memo.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default VoiceMemos;
