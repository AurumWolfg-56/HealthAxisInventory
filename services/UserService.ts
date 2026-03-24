import { Permission, UserRole } from '../types';

// ──────────────────────────────────────────────────────────────────────
// TOKEN CACHE — set by AppDataContext, reused by ALL functions.
// This eliminates supabase-js client deadlocks.
// ──────────────────────────────────────────────────────────────────────
let _cachedToken: string | null = null;
let _locationId: string | null = null;

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

    setLocationId(id: string) {
        _locationId = id;
    },

    async getUsers(): Promise<DBUser[]> {
        console.log('[UserService] Fetching users via REST...');
        try {
            // Fetch profiles with roles via PostgREST resource embedding
            // Phase F: Read from user_location_assignments, with user_roles as fallback
            const url = `${SUPABASE_URL}/rest/v1/profiles?select=id,full_name,permissions,user_location_assignments(role_id,location_id),user_roles(role_id)`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000);

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
                email: 'N/A',
                role: p.user_location_assignments?.[0]?.role_id || p.user_roles?.[0]?.role_id || UserRole.FRONT_DESK,
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
            const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s for edge function

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
            const timeoutId = setTimeout(() => controller.abort(), 45000);

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

            // 2. Update Role (user_location_assignments table — Phase F)
            // Update the role for all location assignments for this user
            const ulaUrl = `${SUPABASE_URL}/rest/v1/user_location_assignments?user_id=eq.${userId}`;
            const ulaResp = await fetch(ulaUrl, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ role_id: updates.role })
            });

            if (!ulaResp.ok) {
                console.warn('[UserService] ULA role update failed:', await ulaResp.text());
            }

            // Dual-write to user_roles for backward compatibility
            const roleUrl = `${SUPABASE_URL}/rest/v1/user_roles?user_id=eq.${userId}`;
            const rResp = await fetch(roleUrl, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ role_id: updates.role })
            });

            if (!rResp.ok) {
                console.warn('[UserService] Legacy user_roles update failed (non-critical):', await rResp.text());
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
