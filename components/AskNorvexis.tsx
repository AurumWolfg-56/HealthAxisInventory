import React, { useState, useRef, useEffect, useCallback } from 'react';
import { queryClinicData, QueryResult } from '../services/QueryEngine';
import { checkConnection } from '../services/LocalAIService';
import { InventoryItem, Order, PettyCashTransaction, Protocol } from '../types';
import { DailyReport } from '../types/dailyReport';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  dataUsed?: string;
}

interface AskNorvexisProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  orders: Order[];
  dailyReports: DailyReport[];
  pettyCash: PettyCashTransaction[];
  protocols: Protocol[];
}

const QUICK_QUESTIONS = [
  '📦 What items are low on stock?',
  '💰 How much revenue did we make this week?',
  '📋 Show pending orders',
  '⚠️ Any items expiring soon?',
];

const AskNorvexis: React.FC<AskNorvexisProps> = ({
  isOpen,
  onClose,
  inventory,
  orders,
  dailyReports,
  pettyCash,
  protocols,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiConnected, setAiConnected] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check AI connection on open
  useEffect(() => {
    if (isOpen) {
      checkConnection().then(r => setAiConnected(r.connected));
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (role: Message['role'], content: string, dataUsed?: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
      dataUsed,
    }]);
  };

  const handleQuery = useCallback(async (question: string) => {
    if (!question.trim() || loading) return;

    // Strip emoji prefix from quick questions
    const cleanQuestion = question.replace(/^[^\w\s¿]+\s*/, '').trim();
    addMessage('user', question);
    setInput('');
    setLoading(true);

    try {
      const result: QueryResult = await queryClinicData(
        cleanQuestion,
        inventory,
        orders,
        dailyReports,
        pettyCash,
        protocols
      );
      addMessage('assistant', result.answer, result.dataUsed);
    } catch (error: any) {
      const msg = error.message?.includes('localhost')
        ? 'LM Studio is not running. Please start the server at localhost:1234.'
        : `Error: ${error.message || 'Failed to process query'}`;
      addMessage('system', msg);
    } finally {
      setLoading(false);
    }
  }, [loading, inventory, orders, dailyReports, pettyCash, protocols]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuery(input);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full md:w-[420px] bg-white dark:bg-[#0a0f0d] z-[61] shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20">
              <i className="fa-solid fa-robot text-white text-lg" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Ask Norvexis</h3>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${aiConnected ? 'bg-emerald-400' : aiConnected === false ? 'bg-red-400' : 'bg-slate-400'}`} />
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {aiConnected ? 'Local AI Connected' : aiConnected === false ? 'AI Offline' : 'Checking...'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center">
                <i className="fa-solid fa-comments text-2xl text-emerald-500" />
              </div>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
                Ask me anything about your clinic
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                Inventory • Orders • Revenue • Expenses
              </p>

              {/* Quick Questions */}
              <div className="space-y-2">
                {QUICK_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuery(q)}
                    disabled={loading}
                    className="w-full text-left px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-300 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-emerald-500 dark:bg-emerald-600 text-white'
                    : msg.role === 'system'
                    ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 text-amber-800 dark:text-amber-200'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                {msg.dataUsed && (
                  <p className="text-[10px] mt-2 opacity-60">
                    Source: {msg.dataUsed}
                  </p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 dark:bg-slate-800/80 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a0f0d]">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 focus-within:border-emerald-400 dark:focus-within:border-emerald-600 transition-colors">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your inventory, orders, revenue..."
              disabled={loading}
              className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none py-2"
            />
            <button
              onClick={() => handleQuery(input)}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              <i className="fa-solid fa-paper-plane text-xs" />
            </button>
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[9px] text-emerald-600/50 dark:text-emerald-400/40 uppercase tracking-wider">
              100% Local AI • Your data never leaves this device
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default AskNorvexis;
