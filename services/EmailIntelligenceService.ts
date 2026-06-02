import { supabase } from '../src/lib/supabase';
import { jsonChat } from './LocalAIService';

export interface EmailTriageResult {
  category: string;
  ai_summary: string;
  ai_draft: string;
}

export const EmailIntelligenceService = {
  async processPendingEmails(): Promise<void> {
    try {
      // 1. Fetch pending emails
      const { data: pendingEmails, error: fetchErr } = await supabase
        .from('email_inbox')
        .select('*')
        .eq('status', 'pending_ai');

      if (fetchErr) {
         console.error('[EmailIntelligence] Error fetching emails:', fetchErr);
         return;
      }

      if (!pendingEmails || pendingEmails.length === 0) {
         console.log('[EmailIntelligence] No pending emails to process.');
         return;
      }

      console.log(`[EmailIntelligence] Found ${pendingEmails.length} pending emails. Processing...`);

      // 2. Process each email
      for (const email of pendingEmails) {
         try {
             const result = await this.analyzeEmail(email.sender, email.subject, email.body);
             
             // Update database
             const nextStatus = result.category.includes('Promocional') ? 'archived' : 'pending_approval';
             
             await supabase.from('email_inbox').update({
                 category: result.category,
                 ai_summary: result.ai_summary,
                 ai_draft: result.ai_draft,
                 status: nextStatus
             }).eq('id', email.id);

             console.log(`[EmailIntelligence] Processed ${email.id}: ${result.category}`);
         } catch (aiErr) {
             console.error(`[EmailIntelligence] Error processing email ${email.id}:`, aiErr);
         }
      }
    } catch (err) {
      console.error('[EmailIntelligence] Fatal error:', err);
    }
  },

  async analyzeEmail(sender: string, subject: string, body: string): Promise<EmailTriageResult> {
    const prompt = `
You are an expert Executive Assistant AI.
Your task is to analyze an incoming email and output a JSON response.
Do not output markdown code blocks around the JSON, just raw JSON.

Rules for importance:
- Important (Category "Importante"): Billing, Invoices, payments, medical records, patient codes, legal, insurance claims/denials, direct requests requiring action.
- Promotional (Category "Promocional"): Newsletters, spam, generic marketing.
- B2B (Category "B2B"): B2B services, software, marketing, outsourcing, vendors.

If it is Promotional, summary is brief and draft is empty.
If it is B2B, prepare a brief cordial rejection or pending review response.
If Important, prepare a draft response if a reply is needed, otherwise just summarize. Do NOT confirm changes to billing/legal/medical without human approval (draft should say "I have forwarded this to management...").

Email Sender: ${sender}
Email Subject: ${subject}
Email Body (might be truncated): 
${body.substring(0, 4000)}

Output ONLY valid JSON matching this structure:
{
  "category": "Importante | Promocional | B2B",
  "ai_summary": "Brief summary of why it matters",
  "ai_draft": "Suggested draft response (or empty string if none)"
}
`;

    try {
      const result = await jsonChat<EmailTriageResult>(
        'You are a helpful assistant that outputs only valid JSON.',
        prompt,
        { model: 'smart', maxTokens: 1024, temperature: 0.1 }
      );
      return result;
    } catch (e) {
       console.error('Failed to process AI response:', e);
       return {
           category: 'Importante',
           ai_summary: 'Failed to process intelligently. Needs manual review.',
           ai_draft: ''
       };
    }
  }
};
