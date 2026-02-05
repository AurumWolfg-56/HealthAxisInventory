
import React, { useState, useEffect, useRef } from 'react';

interface CalculatorModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onConfirm: (total: number) => void;
  initialTotal?: number;
}

const CalculatorModal: React.FC<CalculatorModalProps> = ({ isOpen, title, onClose, onConfirm, initialTotal }) => {
  const [currentInput, setCurrentInput] = useState('');
  const [entries, setEntries] = useState<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setEntries(initialTotal && initialTotal > 0 ? [initialTotal] : []);
      setCurrentInput('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialTotal]);

  if (!isOpen) return null;

  const handleAdd = () => {
    const val = parseFloat(currentInput);
    if (!isNaN(val) && val !== 0) {
      setEntries(prev => [...prev, val]);
      setCurrentInput('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const removeEntry = (index: number) => {
    setEntries(prev => prev.filter((_, i) => i !== index));
  };

  const total = entries.reduce((sum, val) => sum + val, 0);

  const handleConfirm = () => {
    // If there is pending input, ask user if they meant to add it, otherwise just add it if they hit confirm
    if (currentInput) {
        const val = parseFloat(currentInput);
        if (!isNaN(val)) {
            onConfirm(total + val);
            onClose();
            return;
        }
    }
    onConfirm(total);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      
      <div className="relative bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-fade-in-up border border-gray-100 dark:border-gray-700">
        
        {/* Header */}
        <div className="p-6 bg-medical-600 flex justify-between items-center text-white">
            <div>
                <h3 className="text-xl font-black uppercase tracking-wide">Receipt Tally</h3>
                <p className="text-medical-100 text-xs font-bold">{title}</p>
            </div>
            <div className="text-right">
                <div className="text-xs text-medical-200 uppercase font-bold">Current Total</div>
                <div className="text-3xl font-mono font-black tracking-tight">${total.toFixed(2)}</div>
            </div>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex gap-2">
            <div className="relative flex-1">
                <span className="absolute left-4 top-3.5 text-gray-400 font-bold">$</span>
                <input 
                    ref={inputRef}
                    type="number" 
                    step="0.01"
                    value={currentInput}
                    onChange={e => setCurrentInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter amount..."
                    className="w-full h-12 pl-8 pr-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono font-bold text-lg focus:ring-2 focus:ring-medical-500 outline-none"
                />
            </div>
            <button 
                onClick={handleAdd}
                className="w-12 h-12 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
                <i className="fa-solid fa-plus text-lg"></i>
            </button>
        </div>

        {/* Tape List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-100 dark:bg-gray-950/50 min-h-[200px]">
            {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                    <i className="fa-solid fa-calculator text-4xl mb-2"></i>
                    <span className="text-xs font-bold uppercase">No entries yet</span>
                </div>
            ) : (
                entries.map((entry, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 animate-fade-in-up">
                        <span className="font-mono font-bold text-gray-600 dark:text-gray-300 text-sm">#{idx + 1}</span>
                        <div className="flex items-center gap-4">
                            <span className="font-mono font-bold text-lg text-gray-900 dark:text-white">${entry.toFixed(2)}</span>
                            <button onClick={() => removeEntry(idx)} className="w-6 h-6 rounded-full bg-red-100 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors">
                                <i className="fa-solid fa-xmark text-xs"></i>
                            </button>
                        </div>
                    </div>
                )).reverse()
            )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex gap-3">
            <button 
                onClick={onClose}
                className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
                Cancel
            </button>
            <button 
                onClick={handleConfirm}
                className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-medical-600 to-blue-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
            >
                <i className="fa-solid fa-check"></i> Apply Total
            </button>
        </div>
      </div>
    </div>
  );
};

export default CalculatorModal;
