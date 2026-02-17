import { Permission, UserRole } from '../types';

// ──────────────────────────────────────────────────────────────────────
// TOKEN CACHE — set by AppDataContext, reused by ALL functions.
// This eliminates supabase-js client deadlocks.
// ──────────────────────────────────────────────────────────────────────
let _cachedToken: string | null = null;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getHeaders(): Record<string, string> {
    if (!_cachedToken) {
        console.error('[UserService] ❌ No cached token! setAccessToken() was never called.');
        // We don't throw here to avoid crashing UI if accessed early, but logs will show why calls fail
    }
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${_cachedToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
}

export interface DBUser {
    id: string;
    full_name: string;
    email: string;
    role: UserRole;
    permissions?: Permission[];
}

export const UserService = {
    setAccessToken(token: string) {
        _cachedToken = token;
        console.log('[UserService] 🔑 Access token cached');
    },

    async getUsers(): Promise<DBUser[]> {
        console.log('[UserService] Fetching users via REST...');
        try {
            // Fetch profiles with roles via PostgREST resource embedding
            // REST URL equivalent: /rest/v1/profiles?select=id,full_name,permissions,user_roles(role_id)
            const url = `${SUPABASE_URL}/rest/v1/profiles?select=id,full_name,permissions,user_roles(role_id)`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(url, {
                method: 'GET',
                headers: getHeaders(),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`PostgREST error ${response.status}: ${errorBody}`);
            }

            const data = await response.json();

            return (data || []).map((p: any) => ({
                id: p.id,
                full_name: p.full_name || 'Anonymous User',
                email: 'N/A', // Email is not exposed in public profiles/roles query usually, but logic kept from Admin.tsx
                role: p.user_roles?.[0]?.role_id || UserRole.FRONT_DESK,
                permissions: p.permissions || undefined
            }));

        } catch (error: any) {
            console.error('[UserService] ❌ Error fetching users:', error);
            throw error;
        }
    },

    async inviteUser(email: string, fullName: string, role: UserRole): Promise<void> {
        console.log('[UserService] Inviting user...');
        try {
            const url = `${SUPABASE_URL}/functions/v1/admin-api`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s for edge function

            const response = await fetch(url, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    action: 'invite_user',
                    payload: {
                        email,
                        full_name: fullName,
                        role_id: role,
                        redirectTo: window.location.origin
                    }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorBody = await response.text();
                // Try parsing JSON error from Edge Function
                try {
                    const jsonErr = JSON.parse(errorBody);
                    if (jsonErr.error) throw new Error(jsonErr.error);
                } catch (e) {
                    // Ignore JSON parse error, use text
                }
                throw new Error(`Server error (${response.status}): ${errorBody}`);
            }

            const data = await response.json();
            if (data.error) throw new Error(data.error);

        } catch (error: any) {
            console.error('[UserService] ❌ Error inviting user:', error);
            throw error;
        }
    },

    async deleteUser(userId: string): Promise<void> {
        console.log('[UserService] Deleting user...', userId);
        try {
            const url = `${SUPABASE_URL}/functions/v1/admin-api`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);

            const response = await fetch(url, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    action: 'delete_user',
                    payload: { user_id: userId }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`Delete failed (${response.status}): ${errorBody}`);
            }

            const data = await response.json();
            if (data.error) throw new Error(data.error);
            if (data.success === false) throw new Error('Server reported failure');

        } catch (error: any) {
            console.error('[UserService] ❌ Error deleting user:', error);
            throw error;
        }
    },

    async updateUser(userId: string, updates: { full_name: string; role: UserRole }): Promise<void> {
        console.log('[UserService] Updating user...', userId);
        try {
            // 1. Update Profile (Full Name)
            const profileUrl = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`;
            const pResp = await fetch(profileUrl, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ full_name: updates.full_name })
            });
            if (!pResp.ok) throw new Error(`Failed to update profile: ${await pResp.text()}`);

            // 2. Update Role (user_roles table)
            // user_roles has (user_id, role_id). We presume one role per user for now based on Admin.tsx logic.
            // Using PATCH on the record where user_id matches.
            const roleUrl = `${SUPABASE_URL}/rest/v1/user_roles?user_id=eq.${userId}`;
            const rResp = await fetch(roleUrl, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ role_id: updates.role })
            });

            if (!rResp.ok) {
                // If PATCH fails, it might be because the row doesn't exist? (Unlikely if user exists, but possible)
                console.warn('[UserService] Role update failed (maybe no row?), trying upsert...');
                // If logic needed, we could try POST, but for now throwing error is safer as Admin.tsx expects success
                throw new Error(`Failed to update role: ${await rResp.text()}`);
            }

        } catch (error: any) {
            console.error('[UserService] ❌ Error updating user:', error);
            throw error;
        }
    },

    async updatePermissions(userId: string, permissions: Permission[] | null): Promise<void> {
        try {
            const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`;
            const response = await fetch(url, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ permissions: permissions })
            });

            if (!response.ok) {
                throw new Error(`Failed to update permissions: ${await response.text()}`);
            }
        } catch (error: any) {
            console.error('[UserService] ❌ Error updating permissions:', error);
            throw error;
        }
    }
};
