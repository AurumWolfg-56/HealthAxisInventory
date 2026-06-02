import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { encode } from 'https://deno.land/std@0.168.0/encoding/base64url.ts'
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
    const payload = await req.json();
    const { action, message_id, thread_id, reply_body, to_email, subject } = payload;

    const clientId = Deno.env.get('GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
    const refreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN');

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Gmail credentials are not fully configured.');
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
      throw new Error('Failed to get Gmail access token');
    }
    const accessToken = tokenData.access_token;

    if (action === 'reply') {
      // Build RFC 2822 email
      const emailLines = [];
      emailLines.push(`To: ${to_email}`);
      emailLines.push(`Subject: Re: ${subject.replace(/^Re:\s*/i, '')}`);
      emailLines.push(`In-Reply-To: ${message_id}`);
      emailLines.push(`References: ${message_id}`);
      emailLines.push('Content-Type: text/plain; charset="UTF-8"');
      emailLines.push('');
      emailLines.push(reply_body);

      const emailStr = emailLines.join('\r\n');
      const base64Email = encode(new TextEncoder().encode(emailStr));

      const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw: base64Email,
          threadId: thread_id
        })
      });

      if (!sendRes.ok) {
         const err = await sendRes.text();
         throw new Error(`Failed to send email: ${err}`);
      }

      // Mark as read too
      await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message_id}/modify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          removeLabelIds: ['UNREAD']
        })
      });

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders, status: 200 });

    } else if (action === 'mark_read') {
      const modifyRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message_id}/modify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          removeLabelIds: ['UNREAD']
        })
      });

      if (!modifyRes.ok) {
         const err = await modifyRes.text();
         throw new Error(`Failed to mark read: ${err}`);
      }
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders, status: 200 });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { headers: corsHeaders, status: 400 });

  } catch (error: any) {
    console.error('Error in manage-email:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
