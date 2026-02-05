import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { z } from "https://esm.sh/zod@3.22.4";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// --- Validation Schemas ---
const InviteUserSchema = z.object({
  action: z.literal('invite_user'),
  payload: z.object({
    email: z.string().email(),
    role_id: z.enum(['OWNER', 'MANAGER', 'DOCTOR', 'MA', 'FRONT_DESK']),
    full_name: z.string().min(2),
    redirectTo: z.string().optional()
  })
});

const UpdatePermissionsSchema = z.object({
  action: z.literal('update_role_permissions'),
  payload: z.object({
    role_id: z.string(),
    permission_ids: z.array(z.string())
  })
});

const DeleteUserSchema = z.object({
  action: z.literal('delete_user'),
  payload: z.object({
    user_id: z.string().uuid()
  })
});

const RootSchema = z.discriminatedUnion('action', [
  InviteUserSchema,
  UpdatePermissionsSchema,
  DeleteUserSchema
]);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // 1. JWT Verification & Context
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const token = authHeader.replace('Bearer ', '');
    // In production, Supabase Gateway validates the signature.
    // We parse basic claims to identify the user. 
    // For safer parsing without libraries in Deno edge:
    const base64Url = token.split('.')[1];
    if (!base64Url) throw new Error('Invalid Token Format');

    // Polyfill for proper Base64 decoding in standard environment
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const user = JSON.parse(jsonPayload);
    if (!user.sub) throw new Error('No sub in JWT');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // 2. RBAC Check (Must be OWNER or MANAGER)
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role_id')
      .eq('user_id', user.sub)
      .in('role_id', ['OWNER', 'MANAGER'])
      .single()

    if (roleError || !roleData) {
      console.error('Permission failure for user:', user.sub);
      return new Response(JSON.stringify({ error: 'Forbidden: Insufficient administrative privileges' }), {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const callerId = user.sub;

    // 3. Input Validation
    const body = await req.json();
    const validation = RootSchema.safeParse(body);

    if (!validation.success) {
      console.warn('Validation error:', validation.error);
      return new Response(JSON.stringify({
        error: 'Validation failed',
        details: validation.error.format()
      }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    const { action, payload } = validation.data;
    console.log(`Executing ${action} for caller ${callerId}`);

    // 4. Action Handlers
    switch (action) {
      case 'invite_user': {
        const { email, role_id, full_name, redirectTo } = payload

        const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          data: { full_name },
          redirectTo: redirectTo || undefined
        })
        if (inviteError) throw inviteError

        // Assign role immediately
        const { error: roleInsertError } = await supabaseAdmin
          .from('user_roles')
          .insert({ user_id: inviteData.user.id, role_id })

        if (roleInsertError) throw roleInsertError

        return new Response(JSON.stringify({ success: true, user: inviteData.user }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }

      case 'update_role_permissions': {
        const { role_id, permission_ids } = payload

        // Atomic update not fully possible without RPC/Transaction, but we do best effort
        await supabaseAdmin.from('role_permissions').delete().eq('role_id', role_id);

        if (permission_ids.length > 0) {
          const newRows = permission_ids.map((pid) => ({ role_id, permission_id: pid }))
          const { error } = await supabaseAdmin.from('role_permissions').insert(newRows)
          if (error) throw error
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }

      case 'delete_user': {
        const { user_id } = payload

        if (user_id === callerId) {
          return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          })
        }

        const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id)
        if (error) throw error

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }
    }

  } catch (error: any) {
    console.error('Admin API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
