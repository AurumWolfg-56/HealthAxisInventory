import React, { useState, useEffect } from 'react';
import { supabase } from '../src/lib/supabase';
import { EmailIntelligenceService } from '../services/EmailIntelligenceService';

interface Email {
  id: string;
  message_id: string;
  thread_id: string;
  sender: string;
  subject: string;
  snippet: string;
  body: string;
  internal_date: string;
  category: string;
  ai_summary: string;
  ai_draft: string;
  status: string;
}

const InboxTriage = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [draftContent, setDraftContent] = useState('');

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('email_inbox')
      .select('*')
      .order('internal_date', { ascending: false });
    
    if (!error && data) {
      setEmails(data);
    }
    setLoading(false);
  };

  const handleRunAI = async () => {
    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

      await fetch(`${SUPABASE_URL}/functions/v1/fetch-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({})
      });

      await EmailIntelligenceService.processPendingEmails();
      await fetchEmails();
    } catch (e) {
      console.error('Error during manual scan:', e);
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedEmail) return;
    try {
      setProcessing(true);
      const { data: { session } } = await supabase.auth.getSession();
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/manage-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'reply',
          message_id: selectedEmail.message_id,
          thread_id: selectedEmail.thread_id,
          subject: selectedEmail.subject,
          to_email: selectedEmail.sender,
          reply_body: draftContent
        })
      });

      if (response.ok) {
        await supabase.from('email_inbox').update({ status: 'replied' }).eq('id', selectedEmail.id);
        setSelectedEmail(null);
        await fetchEmails();
      } else {
        alert('Failed to send email.');
      }
    } catch (e) {
      console.error(e);
      alert('Error sending email.');
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkRead = async (email: Email) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

      await fetch(`${SUPABASE_URL}/functions/v1/manage-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'mark_read',
          message_id: email.message_id
        })
      });

      await supabase.from('email_inbox').update({ status: 'archived' }).eq('id', email.id);
      await fetchEmails();
    } catch (e) {
      console.error(e);
    }
  };

  const renderEmailCard = (email: Email, accentColor: string) => (
    <div 
      key={email.id} 
      className={`group relative bg-white dark:bg-slate-800/80 backdrop-blur-md rounded-2xl p-5 shadow-glass border border-slate-100 dark:border-slate-700 mb-4 hover:-translate-y-1 hover:shadow-float transition-all duration-300 cursor-pointer overflow-hidden animate-fade-in-up`}
      onClick={() => { setSelectedEmail(email); setDraftContent(email.ai_draft || ''); }}
    >
      <div className={`absolute top-0 left-0 w-1 h-full ${accentColor}`}></div>
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-semibold text-slate-800 dark:text-slate-100 line-clamp-1 flex-1 pr-3">{email.subject}</h4>
        <span className="text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-1 rounded-md whitespace-nowrap">
          {new Date(email.internal_date).toLocaleDateString()}
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2 truncate">
        <i className="fa-regular fa-envelope"></i> {email.sender}
      </p>
      
      <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 group-hover:border-slate-200 dark:group-hover:border-slate-600 transition-colors">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-1.5">
          <i className="fa-solid fa-wand-magic-sparkles text-medical-500"></i> AI Summary
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">{email.ai_summary || 'No summary available.'}</p>
      </div>
    </div>
  );

  const importantEmails = emails.filter(e => e.category === 'Importante' && e.status === 'pending_approval');
  const b2bEmails = emails.filter(e => e.category === 'B2B' && e.status === 'pending_approval');
  const promoEmails = emails.filter(e => e.category === 'Promocional' && e.status !== 'replied');

  return (
    <div className="p-6 h-[calc(100vh-64px)] overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-300">
      <div className="flex justify-between items-end mb-8 px-2 animate-fade-in-up">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white flex items-center gap-3 tracking-tight">
            <div className="w-10 h-10 rounded-xl bg-medical-500/10 flex items-center justify-center text-medical-500">
              <i className="fa-solid fa-inbox text-xl"></i>
            </div>
            Inbox Triage AI
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2 ml-1">Intelligently categorizing <span className="text-medical-600 dark:text-medical-400">manager@healthaxismgmt.com</span></p>
        </div>
        <button
          onClick={handleRunAI}
          disabled={processing || loading}
          className="relative overflow-hidden flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-slate-900/20 dark:hover:shadow-white/20 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {processing && <div className="absolute inset-0 bg-white/20 dark:bg-black/10 animate-shimmer"></div>}
          <i className={`fa-solid fa-arrows-rotate ${processing ? 'fa-spin' : ''}`}></i>
          {processing ? 'Fetching & Analyzing...' : 'Scan & Triage Inbox'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
        {/* Important Column */}
        <div className="flex flex-col bg-slate-100/50 dark:bg-slate-900/50 rounded-3xl p-5 border border-slate-200/60 dark:border-slate-800 animate-fade-in-up shadow-inner-light" style={{animationDelay: '100ms'}}>
          <div className="flex justify-between items-center mb-6 px-2">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-500">
                <i className="fa-solid fa-bolt"></i>
              </div>
              Action Required
            </h3>
            <span className="bg-white dark:bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700">
              {importantEmails.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {importantEmails.map(e => renderEmailCard(e, 'bg-red-500'))}
            {importantEmails.length === 0 && !loading && (
              <div className="h-40 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                <i className="fa-solid fa-check-circle text-4xl mb-3 opacity-20"></i>
                <p className="text-sm font-medium">All caught up here.</p>
              </div>
            )}
          </div>
        </div>

        {/* B2B Column */}
        <div className="flex flex-col bg-slate-100/50 dark:bg-slate-900/50 rounded-3xl p-5 border border-slate-200/60 dark:border-slate-800 animate-fade-in-up shadow-inner-light" style={{animationDelay: '200ms'}}>
          <div className="flex justify-between items-center mb-6 px-2">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-500">
                <i className="fa-solid fa-briefcase"></i>
              </div>
              B2B Offers
            </h3>
            <span className="bg-white dark:bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700">
              {b2bEmails.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {b2bEmails.map(e => renderEmailCard(e, 'bg-blue-500'))}
            {b2bEmails.length === 0 && !loading && (
               <div className="h-40 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
               <i className="fa-solid fa-mug-hot text-4xl mb-3 opacity-20"></i>
               <p className="text-sm font-medium">No new proposals.</p>
             </div>
            )}
          </div>
        </div>

        {/* Promotional Column */}
        <div className="flex flex-col bg-slate-100/50 dark:bg-slate-900/50 rounded-3xl p-5 border border-slate-200/60 dark:border-slate-800 animate-fade-in-up shadow-inner-light" style={{animationDelay: '300ms'}}>
          <div className="flex justify-between items-center mb-6 px-2">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                <i className="fa-solid fa-tag"></i>
              </div>
              Newsletters
            </h3>
            <span className="bg-white dark:bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700">
              {promoEmails.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {promoEmails.map(email => (
              <div key={email.id} className="group flex justify-between items-center bg-white dark:bg-slate-800/80 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 mb-3 hover:shadow-md transition-all">
                <div className="overflow-hidden pr-3">
                  <h4 className="font-medium text-slate-800 dark:text-slate-200 line-clamp-1 text-sm">{email.subject}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">{email.sender}</p>
                </div>
                {email.status !== 'archived' && (
                  <button onClick={() => handleMarkRead(email)} className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 hover:bg-green-100 dark:hover:bg-green-500/20 hover:text-green-600 dark:hover:text-green-400 transition-colors" title="Mark as Read & Archive">
                    <i className="fa-solid fa-check"></i>
                  </button>
                )}
              </div>
            ))}
            {promoEmails.length === 0 && !loading && (
              <div className="h-40 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                <i className="fa-solid fa-leaf text-4xl mb-3 opacity-20"></i>
                <p className="text-sm font-medium">Clean inbox.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail/Draft Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-scale-in border border-slate-200 dark:border-slate-700">
            <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white truncate pr-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                  <i className="fa-solid fa-envelope-open-text"></i>
                </div>
                {selectedEmail.subject}
              </h2>
              <button onClick={() => setSelectedEmail(null)} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            
            <div className="flex flex-1 overflow-hidden">
              {/* Original Email */}
              <div className="w-1/2 p-8 border-r border-slate-100 dark:border-slate-800 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50 custom-scrollbar">
                <div className="mb-6 flex gap-4 items-center">
                  <div className="w-12 h-12 rounded-full bg-medical-100 dark:bg-medical-900/30 flex items-center justify-center text-medical-600 dark:text-medical-400 text-xl font-bold">
                    {selectedEmail.sender.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">From</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{selectedEmail.sender}</p>
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <i className="fa-solid fa-wand-magic-sparkles text-medical-500"></i>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">AI Summary</p>
                  </div>
                  <div className="bg-medical-50 dark:bg-medical-500/10 text-medical-900 dark:text-medical-100 p-5 rounded-2xl text-sm border border-medical-100 dark:border-medical-500/20 leading-relaxed font-medium">
                    {selectedEmail.ai_summary}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <i className="fa-regular fa-file-lines"></i>
                    Original Content
                  </p>
                  <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 font-mono shadow-sm leading-relaxed overflow-x-hidden">
                    {selectedEmail.body}
                  </div>
                </div>
              </div>

              {/* Draft Editor */}
              <div className="w-1/2 p-8 flex flex-col bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2 mb-4">
                  <i className="fa-solid fa-pen-nib text-blue-500"></i>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Suggested Response</p>
                </div>
                <textarea
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  className="flex-1 w-full p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-medical-500 dark:focus:ring-medical-500 outline-none resize-none text-slate-700 dark:text-slate-200 leading-loose text-sm transition-all shadow-inner-light"
                  placeholder="Draft your response here..."
                />
                
                <div className="mt-8 flex justify-between items-center">
                  <button onClick={() => handleMarkRead(selectedEmail)} className="px-5 py-3 rounded-xl text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2">
                    <i className="fa-solid fa-box-archive"></i> Archive Only
                  </button>
                  <button 
                    onClick={handleApprove}
                    disabled={processing || !draftContent.trim()}
                    className="flex items-center gap-3 px-8 py-3.5 rounded-xl bg-medical-600 hover:bg-medical-500 text-white font-bold shadow-lg shadow-medical-500/30 hover:shadow-medical-500/50 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    <i className="fa-solid fa-paper-plane"></i>
                    {processing ? 'Sending...' : 'Approve & Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InboxTriage;
