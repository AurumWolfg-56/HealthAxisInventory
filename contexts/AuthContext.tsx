import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole, Permission, RoleConfig, INITIAL_ROLE_CONFIGS } from '../types';
import { supabase } from '../src/lib/supabase';

// Define the shape of our Auth Context
interface AuthContextType {
    user: User | null;
    accessToken: string | null;
    isLoading: boolean;
    isAdmin: boolean;
    isPlatformAdmin: boolean;
    hasPlatformAccess: boolean;
    hasPermission: (permission: Permission) => boolean;
    roleConfigs: RoleConfig[];
    updateRoleConfig: (role: UserRole, permission: Permission) => void;
    signIn: (email: string) => Promise<void>;
    signOut: () => Promise<void>;
    updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper constant
const STORAGE_KEYS = {
    USER: 'ha_user',
    ROLES: 'ha_roles'
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const stored = localStorage.getItem(STORAGE_KEYS.USER);
        return stored ? JSON.parse(stored) : null;
    });
    const [accessToken, setAccessToken] = useState<string | null>(null);

    // CRITICAL FIX: Initialize with empty array to prevent using hardcoded permissions on page refresh
    // Permissions will only be available after loading from database
    // CRITICAL FIX: Initialize from LocalStorage to prevent waiting on DB every refresh
    const [roleConfigs, setRoleConfigs] = useState<RoleConfig[]>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.ROLES);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    });
    // If we loaded from storage, we are "loaded", otherwise false
    const [roleConfigsLoaded, setRoleConfigsLoaded] = useState(() => {
        return !!localStorage.getItem(STORAGE_KEYS.ROLES);
    });

    const [isLoading, setIsLoading] = useState(true);

    // Initial Load: Fetch from DB or Seed
    useEffect(() => {
        const loadRoles = async () => {
            console.log('[AuthContext] loadRoles() started');
            try {
                // Check DB for existing configs
                console.log('[AuthContext] Fetching role_permissions from DB...');

                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                const response = await fetch(`${supabaseUrl}/rest/v1/role_permissions?select=role_id,permission_id`, {
                    method: 'GET',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`Failed to fetch role_permissions: ${response.status} ${response.statusText}`);
                }

                const dbPerms = await response.json();
                console.log('[AuthContext] DB query result:', { dbPerms });

                if (dbPerms && dbPerms.length > 0) {
                    // Group flat list into RoleConfig structure
                    const grouped: Record<string, Permission[]> = {};
                    dbPerms.forEach((row: any) => {
                        if (!grouped[row.role_id]) grouped[row.role_id] = [];
                        grouped[row.role_id].push(row.permission_id as Permission);
                    });

                    const loadedConfigs: RoleConfig[] = Object.keys(grouped).map(role => ({
                        role: role as UserRole,
                        permissions: grouped[role]
                    }));
                    console.log('[AuthContext] Loaded role configs from DB:', loadedConfigs);
                    setRoleConfigs(loadedConfigs);
                    setRoleConfigsLoaded(true);
                } else {
                    // Seed if empty
                    console.log('Seeding initial role permissions...');
                    const seedData = [];
                    for (const config of INITIAL_ROLE_CONFIGS) {
                        for (const perm of config.permissions) {
                            seedData.push({ role_id: config.role, permission_id: perm });
                        }
                    }
                    // We don't timeout the seed, if it hangs it's less critical as we fallback anyway
                    const seedResponse = await fetch(`${supabaseUrl}/rest/v1/role_permissions`, {
                        method: 'POST',
                        headers: {
                            'apikey': supabaseKey,
                            'Authorization': `Bearer ${supabaseKey}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal'
                        },
                        body: JSON.stringify(seedData)
                    });

                    if (!seedResponse.ok) {
                        console.error('Error seeding roles, using local fallback:', await seedResponse.text());
                        // Fallback also if seeding fails
                        setRoleConfigs(INITIAL_ROLE_CONFIGS);
                        setRoleConfigsLoaded(true);
                    } else {
                        console.log('[AuthContext] Seeded initial role configs');
                        setRoleConfigs(INITIAL_ROLE_CONFIGS);
                        setRoleConfigsLoaded(true);
                    }
                }
            } catch (e) {
                console.error('Auth load error or timeout, using fallback:', e);
                setRoleConfigs(INITIAL_ROLE_CONFIGS);
                setRoleConfigsLoaded(true);
            } finally {
                console.log('[AuthContext] loadRoles() completed');
            }
        };

        if (roleConfigs.length > 0) {
            console.log('[AuthContext] Loaded role configs from LocalStorage Cache (Instant Start)');
        }
        loadRoles();
    }, []);

    // Persist Role Configs
    useEffect(() => {
        if (roleConfigs.length > 0) {
            localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(roleConfigs));
        }
    }, [roleConfigs]);

    // CRITICAL: Coordinate isLoading based on BOTH user session AND roleConfigs being ready
    // This prevents race conditions where UI renders before permissions are available
    useEffect(() => {
        console.log('[AuthContext] Loading state check - user:', !!user, 'roleConfigsLoaded:', roleConfigsLoaded);

        // Only stop loading if:
        // 1. RoleConfigs are loaded from DB, AND
        // 2. Either we have a user OR we've confirmed there's no session
        if (roleConfigsLoaded) {
            setIsLoading(false);
            console.log('[AuthContext] Both user and roleConfigs ready, setting isLoading = false');
        }
    }, [user, roleConfigsLoaded]);

    // Persist User (and handle explicit clear)
    useEffect(() => {
        if (user) {
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        } else {
            localStorage.removeItem(STORAGE_KEYS.USER);
        }
    }, [user]);

    // Listen to Profile Permission Changes (Real-time)
    useEffect(() => {
        if (!user?.id) return;

        // Subscribe to permission changes for this specific user
        const channel = supabase
            .channel(`profile_changes_${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${user.id}`
                },
                async (payload) => {
                    console.log('[AuthContext] Permission change detected, refreshing profile...', payload);
                    // Re-fetch the profile to get updated permissions
                    try {
                        const { data: profile, error } = await supabase
                            .from('profiles')
                            .select('id, full_name, platform_role, user_location_assignments(role_id, location_id), permissions')
                            .eq('id', user.id)
                            .single();

                        if (profile && !error) {
                            const dbRole = profile.user_location_assignments?.[0]?.role_id as UserRole;
                            const dbPermissions = profile.permissions as Permission[];
                            const dbUsername = profile.full_name;

                            // CRITICAL: Always use database values, never cached permissions
                            setUser(prev => ({
                                ...prev!,
                                role: dbRole || prev!.role,
                                permissions: dbPermissions || [],
                                username: dbUsername || prev!.username,
                                platformRole: profile.platform_role || prev!.platformRole || null
                            }));
                            console.log('[AuthContext] Profile updated with fresh DB permissions:', dbPermissions || []);
                        }
                    } catch (e) {
                        console.error('[AuthContext] Error refreshing profile after permission change:', e);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    // Listen to Supabase Auth Changes
    useEffect(() => {
        const fetchProfile = async (sessionUser: any, token: string) => {
            if (!sessionUser) return;

            const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
            const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

            try {
                // Use REST API with the ACTUAL session token (not supabase client internal auth)
                const url = `${SUPABASE_URL}/rest/v1/profiles?select=id,full_name,platform_role,user_location_assignments(role_id,location_id),permissions&id=eq.${sessionUser.id}`;
                const response = await fetch(url, {
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`Profile fetch failed: ${response.status}`);
                }

                const data = await response.json();
                const profile = data?.[0];

                if (profile) {
                    const dbRole = profile.user_location_assignments?.[0]?.role_id as UserRole;
                    const dbPermissions = profile.permissions as Permission[];
                    const dbUsername = profile.full_name;

                    console.log('[AuthContext] ✅ Profile loaded from DB:', dbUsername, dbRole);
                    setUser({
                        id: sessionUser.id,
                        email: sessionUser.email,
                        username: dbUsername || sessionUser.email?.split('@')[0] || 'User',
                        role: dbRole || UserRole.FRONT_DESK,
                        permissions: dbPermissions || [],
                        platformRole: profile.platform_role || null
                    });
                } else {
                    console.warn('[AuthContext] No profile found in DB, using session fallback');
                    // Only set if no existing user in localStorage
                    if (!localStorage.getItem(STORAGE_KEYS.USER)) {
                        setUser({
                            id: sessionUser.id,
                            email: sessionUser.email,
                            username: sessionUser.email?.split('@')[0] || 'New User',
                            role: UserRole.FRONT_DESK,
                            permissions: []
                        });
                    }
                }
            } catch (e) {
                console.error('[AuthContext] ⚠️ Profile fetch error (keeping cached user):', e);
                // CRITICAL: Do NOT overwrite user to FRONT_DESK on error!
                // Keep the existing user from localStorage — their role/permissions are still valid
                const existingUser = localStorage.getItem(STORAGE_KEYS.USER);
                if (!existingUser) {
                    // Only set basic user if there's no cached user at all (first-ever login)
                    setUser({
                        id: sessionUser.id,
                        email: sessionUser.email,
                        username: sessionUser.email?.split('@')[0] || 'User',
                        role: UserRole.FRONT_DESK,
                        permissions: []
                    });
                }
                // If cached user exists, we just keep it — don't call setUser at all
            } finally {
                console.log('[AuthContext] fetchProfile complete. roleConfigsLoaded:', roleConfigsLoaded);
            }
        };

        // SINGLE unified auth listener — handles ALL events including INITIAL_SESSION
        // INITIAL_SESSION fires on page refresh, SIGNED_IN on login, TOKEN_REFRESHED on token renewal
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[AuthContext] 🔔 Auth event:', event, '| hasSession:', !!session);

            if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
                console.log('[AuthContext] ✅ Session via', event, '— caching token + fetching profile');
                setAccessToken(session.access_token);
                await fetchProfile(session.user, session.access_token);
            } else if (event === 'INITIAL_SESSION' && !session) {
                console.log('[AuthContext] ⚠️ No session on init');
                setAccessToken(null);
                if (roleConfigsLoaded) {
                    setIsLoading(false);
                }
            }

            if (event === 'SIGNED_OUT') {
                setUser(null);
                setAccessToken(null);
                localStorage.removeItem(STORAGE_KEYS.USER);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Permission Logic
    const hasPermission = (permission: Permission): boolean => {
        if (!user) {
            console.log('[hasPermission] No user, returning false');
            return false;
        }

        const userRole = user.role?.toUpperCase();
        const isOwnerOrManager = userRole === 'OWNER' || userRole === 'MANAGER';

        // OWNER and MANAGER always have all permissions
        if (isOwnerOrManager) return true;

        // Priority 1: User-specific permission overrides
        if (user.permissions && user.permissions.length > 0) {
            const hasIt = user.permissions.includes(permission);
            console.log(`[hasPermission] User-specific check for ${permission}: ${hasIt}`, user.permissions);
            return hasIt;
        }

        // Priority 2: Role-based permissions
        // CRITICAL: Wait for roleConfigs to load before checking
        if (!roleConfigsLoaded) {
            console.warn(`[hasPermission] RoleConfigs not loaded yet, denying ${permission}`);
            return false;
        }

        const config = roleConfigs.find(rc => rc.role.toUpperCase() === userRole);
        const hasIt = config ? config.permissions.includes(permission) : false;
        console.log(`[hasPermission] Role-based check for ${permission} (${userRole}): ${hasIt}`, config?.permissions);
        return hasIt;
    };

    const updateRoleConfig = async (role: UserRole, permission: Permission) => {
        // Optimistic UI Update
        setRoleConfigs(prev => {
            const configIndex = prev.findIndex(c => c.role === role);
            // If role not found, create it with new permission
            if (configIndex === -1) {
                // DB Insert (Async)
                supabase.from('role_permissions').insert({ role_id: role, permission_id: permission }).then(({ error }) => {
                    if (error) console.error('Error adding permission:', error);
                });
                return [...prev, { role, permissions: [permission] }];
            }

            const newConfigs = [...prev];
            const currentPermissions = newConfigs[configIndex].permissions;

            if (currentPermissions.includes(permission)) {
                // Removing
                newConfigs[configIndex].permissions = currentPermissions.filter(p => p !== permission);
                // DB Delete (Async)
                supabase.from('role_permissions').delete().match({ role_id: role, permission_id: permission }).then(({ error }) => {
                    if (error) console.error('Error removing permission:', error);
                });
            } else {
                // Adding
                newConfigs[configIndex].permissions = [...currentPermissions, permission];
                // DB Insert (Async)
                supabase.from('role_permissions').insert({ role_id: role, permission_id: permission }).then(({ error }) => {
                    if (error) console.error('Error adding permission:', error);
                });
            }
            return newConfigs;
        });
    };

    const signOut = async () => {
        console.log('[AuthContext] Starting sign out...');

        try {
            // 1. Clear app-specific localStorage keys
            const appKeys = [
                'ha_user', 'ha_users_db', 'ha_theme', 'ha_lang',
                'ha_templates', 'ha_daily_reports', 'ha_medical_codes',
                'ha_code_groups', 'ha_petty_cash', 'ha_voice_memos',
                'ha_billing_rules', 'ha_roles', 'ha_logs',
                'ha_migration_dismissed',
                'nv_current_location', 'nv_tenant_cache'
            ];
            appKeys.forEach(key => localStorage.removeItem(key));

            // 2. Clear Supabase auth tokens from localStorage
            const supabaseKeys = Object.keys(localStorage).filter(k =>
                k.startsWith('sb-') || k.includes('supabase')
            );
            supabaseKeys.forEach(key => localStorage.removeItem(key));

            // 3. Reset React state
            setUser(null);
            setAccessToken(null);
            setRoleConfigs([]);

            // 4. Clean up Supabase channels
            supabase.removeAllChannels().catch(e => console.warn('Channel cleanup warning:', e));

            // 5. AWAIT Supabase sign out (critical - must complete before reload)
            await supabase.auth.signOut({ scope: 'local' });
            console.log('[AuthContext] Supabase session cleared.');

            // 6. Hard reload AFTER session is cleared
            window.location.href = '/';
        } catch (err) {
            console.error('[AuthContext] Logout error:', err);
            // Emergency: clear everything and reload
            const allKeys = Object.keys(localStorage).filter(k =>
                k.startsWith('ha_') || k.startsWith('sb-') || k.includes('supabase')
            );
            allKeys.forEach(key => localStorage.removeItem(key));
            window.location.href = '/';
        }
    };

    const signIn = async (email: string) => {
        // This is a stub for now, as actual sign-in sends a magic link and happens via Supabase UI/URL redirect
        // We will eventually move the handleLogin logic here
    };

    const value = {
        user,
        accessToken,
        isLoading,
        isAdmin: hasPermission('admin.access'),
        isPlatformAdmin: user?.platformRole === 'platform_admin',
        hasPlatformAccess: user?.platformRole === 'platform_admin' || user?.platformRole === 'platform_viewer',
        hasPermission,
        roleConfigs,
        updateRoleConfig,
        signIn,
        signOut,
        updateUser: (newUser: User) => setUser(newUser)
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
