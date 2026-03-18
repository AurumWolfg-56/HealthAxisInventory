import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole, Permission, RoleConfig, INITIAL_ROLE_CONFIGS } from '../types';
import { supabase } from '../src/lib/supabase';

// Define the shape of our Auth Context
interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAdmin: boolean;
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
                            .select('id, full_name, user_roles(role_id), permissions')
                            .eq('id', user.id)
                            .single();

                        if (profile && !error) {
                            const dbRole = profile.user_roles?.[0]?.role_id as UserRole;
                            const dbPermissions = profile.permissions as Permission[];
                            const dbUsername = profile.full_name;

                            // CRITICAL: Always use database values, never cached permissions
                            setUser(prev => ({
                                ...prev!,
                                role: dbRole || prev!.role,
                                permissions: dbPermissions || [],  // Force empty array if null, never use cache
                                username: dbUsername || prev!.username
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

    // Listen to Supabase Auth Changes — relies entirely on onAuthStateChange
    // which fires INITIAL_SESSION on page refresh, SIGNED_IN on login,
    // and TOKEN_REFRESHED when the access token is renewed.
    useEffect(() => {
        const fetchProfile = async (sessionUser: any) => {
            if (!sessionUser) return;

            try {
                // Fetch profile to get Role/Permissions
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('id, full_name, user_roles(role_id), permissions')
                    .eq('id', sessionUser.id)
                    .single();

                if (profile) {
                    const dbRole = profile.user_roles?.[0]?.role_id as UserRole;
                    const dbPermissions = profile.permissions as Permission[];
                    const dbUsername = profile.full_name;

                    setUser({
                        id: sessionUser.id,
                        email: sessionUser.email,
                        username: dbUsername || sessionUser.email?.split('@')[0] || 'User',
                        role: dbRole || UserRole.FRONT_DESK,
                        permissions: dbPermissions || []
                    });
                } else {
                    console.warn('[AuthContext] No profile found in DB for user, using session fallback');
                    setUser({
                        id: sessionUser.id,
                        email: sessionUser.email,
                        username: sessionUser.email?.split('@')[0] || 'New User',
                        role: UserRole.FRONT_DESK,
                        permissions: []
                    });
                }
            } catch (e) {
                console.error('[AuthContext] Error fetching profile:', e);
                setUser({
                    id: sessionUser.id,
                    email: sessionUser.email,
                    username: 'User (Offline)',
                    role: UserRole.FRONT_DESK,
                    permissions: []
                });
            } finally {
                console.log('[AuthContext] fetchProfile complete. roleConfigsLoaded:', roleConfigsLoaded);
            }
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[AuthContext] Auth event:', event, '| hasSession:', !!session);

            if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
                console.log('[AuthContext] Session detected via', event, '— fetching profile...');
                await fetchProfile(session.user);
            } else if (event === 'INITIAL_SESSION' && !session) {
                console.log('[AuthContext] No session found on init');
                if (roleConfigsLoaded) {
                    setIsLoading(false);
                }
            }

            if (event === 'SIGNED_OUT') {
                setUser(null);
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
        console.log('[AuthContext] Starting sign out (Fire-and-Forget mode)...');

        try {
            // 1. Clear app-specific localStorage keys only — NOT localStorage.clear()
            //    localStorage.clear() wipes Supabase auth session tokens, breaking session
            //    restore on next page load. Supabase stores tokens under 'sb-*' keys.
            const appKeys = [
                'ha_user', 'ha_users_db', 'ha_theme', 'ha_lang',
                'ha_templates', 'ha_daily_reports', 'ha_medical_codes',
                'ha_code_groups', 'ha_petty_cash', 'ha_voice_memos',
                'ha_billing_rules', 'ha_roles', 'ha_logs',
                'ha_migration_dismissed'
            ];
            appKeys.forEach(key => localStorage.removeItem(key));

            setUser(null);
            setRoleConfigs([]);

            // 2. Let Supabase clean up its own session tokens properly
            supabase.removeAllChannels().catch(e => console.warn('Channel cleanup warning:', e));
            await supabase.auth.signOut({ scope: 'local' });

            console.log('[AuthContext] Local state cleared, forcing reload now.');

            // 3. Immediate Hard Reload
            window.location.href = '/';
        } catch (err) {
            console.error('[AuthContext] Logout critical error:', err);
            // Emergency fallback — clear app keys only
            ['ha_user', 'ha_roles'].forEach(key => localStorage.removeItem(key));
            window.location.href = '/';
        }
    };

    const signIn = async (email: string) => {
        // This is a stub for now, as actual sign-in sends a magic link and happens via Supabase UI/URL redirect
        // We will eventually move the handleLogin logic here
    };

    const value = {
        user,
        isLoading,
        isAdmin: hasPermission('admin.access'),
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
