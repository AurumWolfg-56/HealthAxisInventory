import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { resolveFeatureFlags, FeatureFlagKey } from '../utils/featureFlags';
import { useAuth } from './AuthContext';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface Organization {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    primary_color: string;
    is_active: boolean;
}

export interface ClinicLocation {
    id: string;
    organization_id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    timezone: string;
    primary_color: string | null;
    feature_flags: Record<string, boolean>;
    is_active: boolean;
}

export interface UserLocationAssignment {
    user_id: string;
    location_id: string;
    role_id: string;
    permission_overrides: { grant?: string[]; deny?: string[] } | null;
    is_default: boolean;
    location?: ClinicLocation;
    organization?: Organization;
}

// ═══════════════════════════════════════════════════════════════
// CONTEXT TYPE
// ═══════════════════════════════════════════════════════════════

interface TenantContextType {
    currentOrg: Organization | null;
    currentLocation: ClinicLocation | null;
    locationId: string | null;
    userLocations: UserLocationAssignment[];
    locationRole: string | null;
    featureFlags: Record<FeatureFlagKey, boolean>;
    isFeatureEnabled: (flag: FeatureFlagKey) => boolean;
    switchLocation: (locationId: string) => void;
    isLoading: boolean;
    clearTenantData: () => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const STORAGE_KEYS = {
    CURRENT_LOCATION: 'nv_current_location',
    TENANT_CACHE: 'nv_tenant_cache',
};

// ═══════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, accessToken } = useAuth();

    const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
    const [currentLocation, setCurrentLocation] = useState<ClinicLocation | null>(null);
    const [userLocations, setUserLocations] = useState<UserLocationAssignment[]>([]);
    const [locationRole, setLocationRole] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const loadedForUser = useRef<string | null>(null);

    const locationId = currentLocation?.id ?? null;

    const featureFlags = useMemo(
        () => resolveFeatureFlags(currentLocation?.feature_flags),
        [currentLocation]
    );

    const isFeatureEnabled = useCallback(
        (flag: FeatureFlagKey): boolean => featureFlags[flag] ?? false,
        [featureFlags]
    );

    // ── AUTO-LOAD: React to auth changes ──
    useEffect(() => {
        if (!user?.id || !accessToken) {
            // User logged out
            if (loadedForUser.current) {
                setCurrentOrg(null);
                setCurrentLocation(null);
                setUserLocations([]);
                setLocationRole(null);
                localStorage.removeItem(STORAGE_KEYS.CURRENT_LOCATION);
                localStorage.removeItem(STORAGE_KEYS.TENANT_CACHE);
                loadedForUser.current = null;
            }
            setIsLoading(false);
            return;
        }

        // Don't reload if already loaded for this user
        if (loadedForUser.current === user.id) return;
        loadedForUser.current = user.id;

        const loadTenantData = async () => {
            try {
                console.log('[TenantContext] Loading tenant data for user:', user.id);

                const baseUrl = import.meta.env.VITE_SUPABASE_URL;
                const res = await fetch(
                    `${baseUrl}/rest/v1/user_location_assignments?user_id=eq.${user.id}&select=*,location:clinic_locations(*,organization:organizations(*))`,
                    {
                        headers: {
                            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${accessToken}`,
                        },
                    }
                );

                if (!res.ok) {
                    console.warn('[TenantContext] Failed to fetch assignments:', res.status);
                    setIsLoading(false);
                    return;
                }

                const assignments: any[] = await res.json();
                console.log('[TenantContext] Got', assignments.length, 'location assignments');

                if (assignments.length === 0) {
                    console.warn('[TenantContext] User has no location assignments');
                    setIsLoading(false);
                    return;
                }

                const typedAssignments: UserLocationAssignment[] = assignments.map(a => ({
                    user_id: a.user_id,
                    location_id: a.location_id,
                    role_id: a.role_id,
                    permission_overrides: a.permission_overrides,
                    is_default: a.is_default,
                    location: a.location,
                    organization: a.location?.organization,
                }));

                setUserLocations(typedAssignments);

                // Determine active location: saved > default > first
                const savedLocationId = localStorage.getItem(STORAGE_KEYS.CURRENT_LOCATION);
                let active = typedAssignments.find(a => a.location_id === savedLocationId)
                    || typedAssignments.find(a => a.is_default)
                    || typedAssignments[0];

                if (active?.location) {
                    setCurrentLocation(active.location);
                    setCurrentOrg(active.organization ?? null);
                    setLocationRole(active.role_id);
                    localStorage.setItem(STORAGE_KEYS.CURRENT_LOCATION, active.location_id);
                    console.log('[TenantContext] Active:', active.location.name, '| Role:', active.role_id);
                }

                // Cache for instant start
                localStorage.setItem(STORAGE_KEYS.TENANT_CACHE, JSON.stringify({
                    org: active?.organization,
                    location: active?.location,
                    role: active?.role_id,
                }));

                setIsLoading(false);
            } catch (err) {
                console.error('[TenantContext] Error:', err);
                setIsLoading(false);
            }
        };

        loadTenantData();
    }, [user?.id, accessToken]);

    // Switch location
    const switchLocation = useCallback((newLocationId: string) => {
        const assignment = userLocations.find(a => a.location_id === newLocationId);
        if (!assignment?.location) return;

        setCurrentLocation(assignment.location);
        setCurrentOrg(assignment.organization ?? null);
        setLocationRole(assignment.role_id);
        localStorage.setItem(STORAGE_KEYS.CURRENT_LOCATION, newLocationId);
        console.log('[TenantContext] Switched to:', assignment.location.name);
    }, [userLocations]);

    // Clear on logout
    const clearTenantData = useCallback(() => {
        setCurrentOrg(null);
        setCurrentLocation(null);
        setUserLocations([]);
        setLocationRole(null);
        loadedForUser.current = null;
        localStorage.removeItem(STORAGE_KEYS.CURRENT_LOCATION);
        localStorage.removeItem(STORAGE_KEYS.TENANT_CACHE);
    }, []);

    // Load from cache on mount for instant start
    useEffect(() => {
        try {
            const cached = localStorage.getItem(STORAGE_KEYS.TENANT_CACHE);
            if (cached) {
                const data = JSON.parse(cached);
                if (data.org) setCurrentOrg(data.org);
                if (data.location) setCurrentLocation(data.location);
                if (data.role) setLocationRole(data.role);
                console.log('[TenantContext] Loaded from cache:', data.location?.name);
            }
        } catch {
            // Ignore
        }
    }, []);

    const value: TenantContextType = {
        currentOrg,
        currentLocation,
        locationId,
        userLocations,
        locationRole,
        featureFlags,
        isFeatureEnabled,
        switchLocation,
        isLoading,
        clearTenantData,
    };

    return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

// ═══════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════

export const useTenant = (): TenantContextType => {
    const context = useContext(TenantContext);
    if (!context) {
        throw new Error('useTenant must be used within a TenantProvider');
    }
    return context;
};
