import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole, Permission, RoleConfig } from '../types';
import { supabase } from '../src/lib/supabase';
import { INITIAL_ROLE_CONFIGS } from '../App';

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
    const [roleConfigs, setRoleConfigs] = useState<RoleConfig[]>([]);
    const [roleConfigsLoaded, setRoleConfigsLoaded] = useState(false);

    const [isLoading, setIsLoading] = useState(true);

    // Initial Load: Fetch from DB or Seed
    useEffect(() => {
        const loadRoles = async () => {
            console.log('[AuthContext] loadRoles() started');
            try {
                // Check DB for existing configs
                console.log('[AuthContext] Fetching role_permissions from DB...');
                const { data: dbPerms, error } = await supabase
                    .from('role_permissions')
                    .select('role_id, permission_id');

                console.log('[AuthContext] DB query result:', { dbPerms, error });

                if (error) {
                    console.error('Error loading role permissions:', error);
                    return;
                }

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
                    const { error: seedError } = await supabase
                        .from('role_permissions')
                        .insert(seedData);

                    if (seedError) {
                        console.error('Error seeding roles:', seedError);
                    } else {
                        console.log('[AuthContext] Seeded initial role configs');
                        setRoleConfigs(INITIAL_ROLE_CONFIGS);
                        setRoleConfigsLoaded(true);
                    }
                }
            } catch (e) {
                console.error('Auth load error:', e);
            } finally {
                console.log('[AuthContext] loadRoles() completed');
            }
        };

        loadRoles();
    }, []);

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

    // Listen to Supabase Auth Changes
    useEffect(() => {
        const fetchProfile = async (sessionUser: any) => {
            if (!sessionUser) {
                // Keep local user if offline, or clear? For now, we rely on specific sign out action to clear.
                // But if we are online and explicit "no session", we might want to be careful.
                // Existing App.tsx logic didn't auto-clear on simple refresh if session missing but localstorage existed?
                // Actually supabase.auth.getSession() handles validation.
                return;
            }

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

                    // CRITICAL: Always use database values, never fall back to cached localStorage
                    // This ensures stale permissions don't persist after refresh
                    setUser({
                        id: sessionUser.id,
                        email: sessionUser.email,
                        username: dbUsername || sessionUser.email?.split('@')[0] || 'User',
                        role: dbRole || UserRole.FRONT_DESK,
                        // IMPORTANT: Use dbPermissions even if null/undefined - convert to empty array
                        permissions: dbPermissions || []
                    });
                } else {
                    // Fallback if no profile exists (e.g. invite flow not fully complete in DB trigger)
                    console.warn('[AuthContext] No profile found in DB for user, using session fallback');
                    setUser({
                        id: sessionUser.id,
                        email: sessionUser.email,
                        username: sessionUser.email?.split('@')[0] || 'New User',
                        role: UserRole.FRONT_DESK, // Default safe role
                        permissions: []
                    });
                }
            } catch (e) {
                console.error('[AuthContext] Error fetching profile:', e);
                // Even on error, set basic user if we have session, so we don't hang
                setUser({
                    id: sessionUser.id,
                    email: sessionUser.email,
                    username: 'User (Offline)',
                    role: UserRole.FRONT_DESK,
                    permissions: []
                });
            } finally {
                // CRITICAL: Only stop loading if roleConfigs are also ready
                // This prevents race condition where UI renders before permissions are available
                console.log('[AuthContext] fetchProfile complete. roleConfigsLoaded:', roleConfigsLoaded);
                // We'll handle isLoading in a separate useEffect that waits for BOTH
            }
        };

        const initSession = async () => {
            console.log('[AuthContext] Initializing session...');
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                console.log('[AuthContext] Session found, fetching profile...');
                await fetchProfile(session.user);
            } else {
                console.log('[AuthContext] No session found');
                // Only set loading false if roleConfigs are also loaded
                // This prevents race condition on refresh
                if (roleConfigsLoaded) {
                    setIsLoading(false);
                }
            }
        };

        initSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                if (session?.user) await fetchProfile(session.user);
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
        try {
            console.log('[AuthContext] Starting sign out...');

            // Clean up all Realtime channels before signing out
            await supabase.removeAllChannels();

            // Clear local storage BEFORE signing out to prevent race conditions
            localStorage.clear(); // Clear ALL localStorage to ensure clean state

            // Sign out from Supabase with explicit scope
            const { error } = await supabase.auth.signOut({ scope: 'local' });
            if (error) {
                console.error('[AuthContext] Error signing out:', error);
                // Don't throw, continue with cleanup
            }

            // Clear local user state
            setUser(null);
            setRoleConfigs([]);

            console.log('[AuthContext] Successfully signed out, reloading...');

            // Use replace instead of href to prevent back button issues
            window.location.replace('/');
        } catch (err) {
            console.error('[AuthContext] Logout error:', err);
            // Force clear everything even on error
            localStorage.clear();
            setUser(null);
            setRoleConfigs([]);
            // Force reload
            window.location.replace('/');
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
