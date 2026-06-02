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
      // 1. Manually trigger the edge function to fetch latest unread emails from Gmail
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

      // 2. Process all pending emails with Local AI
      await EmailIntelligenceService.processPendingEmails();
      
      // 3. Refresh UI
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
      // Call edge function to send email
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

  const renderEmailCard = (email: Email) => (
    <div key={email.id} className="bg-white/70 backdrop-blur-md rounded-xl p-4 shadow-sm border border-slate-100 mb-3 hover:shadow-md transition-all cursor-pointer" onClick={() => { setSelectedEmail(email); setDraftContent(email.ai_draft || ''); }}>
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold text-slate-800 line-clamp-1">{email.subject}</h4>
        <span className="text-xs text-slate-500 whitespace-nowrap ml-2">{new Date(email.internal_date).toLocaleDateString()}</span>
      </div>
      <p className="text-sm text-slate-600 mb-2 truncate">{email.sender}</p>
      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
        <p className="text-xs font-medium text-slate-700 flex items-center gap-1">
          <i className="fa-solid fa-circle-exclamation text-medical-500 text-xs"></i> AI Summary
        </p>
        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{email.ai_summary || 'No summary available.'}</p>
      </div>
    </div>
  );

  const importantEmails = emails.filter(e => e.category === 'Importante' && e.status === 'pending_approval');
  const b2bEmails = emails.filter(e => e.category === 'B2B' && e.status === 'pending_approval');
  const promoEmails = emails.filter(e => e.category === 'Promocional' && e.status !== 'replied');

  return (
    <div className="p-6 h-[calc(100vh-64px)] overflow-hidden flex flex-col bg-slate-50">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-envelope text-medical-600"></i>
            Inbox Triage AI
          </h2>
          <p className="text-sm text-slate-500 mt-1">Intelligently categorizing manager@healthaxismgmt.com</p>
        </div>
        <button
          onClick={handleRunAI}
          disabled={processing}
          className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <i className={`fa-solid fa-arrows-rotate ${processing ? 'fa-spin' : ''}`}></i>
          {processing ? 'Processing AI...' : 'Scan & Triage'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
        {/* Important Column */}
        <div className="flex flex-col bg-slate-100/50 rounded-2xl p-4 border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-inbox text-red-500"></i>
            Important ({importantEmails.length})
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {importantEmails.map(renderEmailCard)}
            {importantEmails.length === 0 && <p className="text-sm text-slate-400 text-center mt-10">No pending important emails.</p>}
          </div>
        </div>

        {/* B2B Column */}
        <div className="flex flex-col bg-slate-100/50 rounded-2xl p-4 border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-briefcase text-blue-500"></i>
            B2B Offers ({b2bEmails.length})
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {b2bEmails.map(renderEmailCard)}
            {b2bEmails.length === 0 && <p className="text-sm text-slate-400 text-center mt-10">No pending B2B offers.</p>}
          </div>
        </div>

        {/* Promotional Column */}
        <div className="flex flex-col bg-slate-100/50 rounded-2xl p-4 border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-tag text-green-500"></i>
            Promotional ({promoEmails.length})
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {promoEmails.map(email => (
              <div key={email.id} className="bg-white/70 backdrop-blur-md rounded-xl p-4 shadow-sm border border-slate-100 mb-3 flex justify-between items-center">
                <div>
                  <h4 className="font-medium text-slate-800 line-clamp-1 text-sm">{email.subject}</h4>
                  <p className="text-xs text-slate-500 truncate w-48">{email.sender}</p>
                </div>
                {email.status !== 'archived' && (
                  <button onClick={() => handleMarkRead(email)} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200" title="Mark as Read">
                    <i className="fa-solid fa-check"></i>
                  </button>
                )}
              </div>
            ))}
            {promoEmails.length === 0 && <p className="text-sm text-slate-400 text-center mt-10">No promotional emails.</p>}
          </div>
        </div>
      </div>

      {/* Detail/Draft Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 truncate pr-4">{selectedEmail.subject}</h2>
              <button onClick={() => setSelectedEmail(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            
            <div className="flex flex-1 overflow-hidden">
              {/* Original Email */}
              <div className="w-1/2 p-6 border-r border-slate-100 overflow-y-auto bg-white">
                <div className="mb-4">
                  <p className="text-sm font-medium text-slate-500">From</p>
                  <p className="text-slate-800">{selectedEmail.sender}</p>
                </div>
                <div className="mb-6">
                  <p className="text-sm font-medium text-slate-500 mb-1">AI Summary</p>
                  <div className="bg-medical-50 text-medical-800 p-3 rounded-lg text-sm border border-medical-100">
                    {selectedEmail.ai_summary}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-2">Original Content</p>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border border-slate-100 font-mono">
                    {selectedEmail.body}
                  </div>
                </div>
              </div>

              {/* Draft Editor */}
              <div className="w-1/2 p-6 flex flex-col bg-slate-50/50">
                <div className="flex justify-between items-end mb-2">
                  <p className="text-sm font-medium text-slate-500">Suggested Response</p>
                </div>
                <textarea
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  className="flex-1 w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-medical-500 outline-none resize-none text-slate-700 leading-relaxed shadow-inner"
                  placeholder="Draft your response here..."
                />
                
                <div className="mt-6 flex justify-end gap-3">
                  <button onClick={() => handleMarkRead(selectedEmail)} className="px-4 py-2 rounded-lg text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 font-medium transition-colors">
                    Mark as Read & Archive
                  </button>
                  <button 
                    onClick={handleApprove}
                    disabled={processing || !draftContent.trim()}
                    className="flex items-center gap-2 px-6 py-2 rounded-lg bg-medical-600 text-white hover:bg-medical-700 font-medium shadow-md shadow-medical-200 transition-all disabled:opacity-50"
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
