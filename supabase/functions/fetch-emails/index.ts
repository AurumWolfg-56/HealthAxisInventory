import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const clientId = Deno.env.get('GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
    const refreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN');

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Gmail credentials are not fully configured in environment variables.');
    }

    // 1. Get new access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new Error('Failed to get Gmail access token: ' + JSON.stringify(tokenData));
    }
    const accessToken = tokenData.access_token;

    // 2. Fetch unread messages
    const listResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const listData = await listResponse.json();

    const messages = listData.messages || [];
    let addedCount = 0;

    for (const msg of messages) {
      const msgId = msg.id;

      // Check if we already have it
      const { data: existing } = await supabaseClient
        .from('email_inbox')
        .select('id')
        .eq('message_id', msgId)
        .single();
        
      if (existing) continue;

      // Fetch full message
      const detailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const detail = await detailResponse.json();

      const headers = detail.payload?.headers || [];
      const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const subject = getHeader('Subject');
      const sender = getHeader('From');
      const threadId = detail.threadId;
      const snippet = detail.snippet;
      const internalDate = new Date(parseInt(detail.internalDate)).toISOString();

      // Simple body extraction
      let bodyText = '';
      if (detail.payload?.parts) {
        const textPart = detail.payload.parts.find((p: any) => p.mimeType === 'text/plain');
        if (textPart && textPart.body?.data) {
          bodyText = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
      } else if (detail.payload?.body?.data) {
        bodyText = atob(detail.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }

      const { error } = await supabaseClient.from('email_inbox').insert({
        message_id: msgId,
        thread_id: threadId,
        sender,
        subject,
        snippet,
        body: bodyText,
        internal_date: internalDate,
        status: 'pending_ai'
      });

      if (error) {
        console.error('Error inserting email:', error);
      } else {
        addedCount++;
      }
    }

    return new Response(JSON.stringify({ success: true, added: addedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error('Error in fetch-emails:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
