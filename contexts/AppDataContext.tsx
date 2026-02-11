import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { FormTemplate, BillingRule, PettyCashTransaction, ActivityLog } from '../types';
import { DailyReport } from '../types/dailyReport';
import { DailyReportService } from '../services/DailyReportService';
import { TemplateService } from '../services/TemplateService';
import { billingRules as INITIAL_BILLING_RULES } from '../data/billingRules';
import { supabase } from '../src/lib/supabase';

// Storage Keys
const STORAGE_KEYS = {
    BILLING_RULES: 'ha_billing_rules',
    PETTY_CASH: 'ha_petty_cash',
    LOGS: 'ha_logs',
};

// Helper
function loadState<T>(key: string, fallback: T): T {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : fallback;
    } catch (e) {
        console.warn(`Failed to load ${key}`, e);
        return fallback;
    }
}

interface AppDataContextType {
    templates: FormTemplate[];
    setTemplates: React.Dispatch<React.SetStateAction<FormTemplate[]>>;
    dailyReports: DailyReport[];
    setDailyReports: React.Dispatch<React.SetStateAction<DailyReport[]>>;
    billingRules: BillingRule[];
    setBillingRules: React.Dispatch<React.SetStateAction<BillingRule[]>>;
    pettyCashHistory: PettyCashTransaction[];
    setPettyCashHistory: React.Dispatch<React.SetStateAction<PettyCashTransaction[]>>;
    logs: ActivityLog[];
    setLogs: React.Dispatch<React.SetStateAction<ActivityLog[]>>;
    addLog: (action: ActivityLog['action'], details: string) => void;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // State
    const [templates, setTemplates] = useState<FormTemplate[]>([]);
    const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
    const [billingRules, setBillingRules] = useState<BillingRule[]>(() => loadState(STORAGE_KEYS.BILLING_RULES, INITIAL_BILLING_RULES));
    const [pettyCashHistory, setPettyCashHistory] = useState<PettyCashTransaction[]>(() => loadState(STORAGE_KEYS.PETTY_CASH, []));
    const [logs, setLogs] = useState<ActivityLog[]>(() => {
        const loadedLogs = loadState(STORAGE_KEYS.LOGS, []);
        return loadedLogs.map((log: any) => ({ ...log, timestamp: new Date(log.timestamp) }));
    });

    // Auth tracking — same proven pattern as InventoryContext
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const isFetchingRef = useRef(false);
    const hasLoadedRef = useRef(false);

    // Listen for auth state changes directly from Supabase (not useAuth)
    useEffect(() => {
        let mounted = true;

        // Check initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (mounted) {
                console.log('[AppDataContext] Initial session check:', !!session);
                setIsAuthenticated(!!session);
            }
        });

        // Subscribe to auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!mounted) return;
            const hasSession = !!session;
            console.log('[AppDataContext] Auth state change:', event, hasSession);
            setIsAuthenticated(prev => {
                if (prev !== hasSession) {
                    if (!hasSession) {
                        hasLoadedRef.current = false;
                    }
                    return hasSession;
                }
                return prev;
            });
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // Fetch data when authenticated (only once per session)
    const fetchData = useCallback(async () => {
        if (isFetchingRef.current) return;
        if (!isAuthenticated) return;

        isFetchingRef.current = true;
        console.log('[AppDataContext] Fetching data (authenticated)...');

        try {
            // Fetch reports and templates in parallel
            const [reports, fetchedTemplates] = await Promise.allSettled([
                DailyReportService.getReports(),
                TemplateService.getTemplates()
            ]);

            if (reports.status === 'fulfilled') {
                console.log('[AppDataContext] Reports fetched:', reports.value.length);
                setDailyReports(reports.value);
            } else {
                console.error('[AppDataContext] Failed to fetch reports:', reports.reason);
            }

            if (fetchedTemplates.status === 'fulfilled' && fetchedTemplates.value.length > 0) {
                console.log('[AppDataContext] Templates fetched:', fetchedTemplates.value.length);
                setTemplates(fetchedTemplates.value);
            }

            hasLoadedRef.current = true;
        } catch (error) {
            console.error('[AppDataContext] Error during data load:', error);
        } finally {
            isFetchingRef.current = false;
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated && !hasLoadedRef.current && !isFetchingRef.current) {
            fetchData();
        }
    }, [isAuthenticated, fetchData]);

    // LocalStorage persistence for non-Supabase data
    useEffect(() => localStorage.setItem(STORAGE_KEYS.BILLING_RULES, JSON.stringify(billingRules)), [billingRules]);
    useEffect(() => localStorage.setItem(STORAGE_KEYS.PETTY_CASH, JSON.stringify(pettyCashHistory)), [pettyCashHistory]);
    useEffect(() => localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs)), [logs]);

    const addLog = (action: ActivityLog['action'], details: string) => {
        const newLog: ActivityLog = {
            id: Date.now().toString(),
            timestamp: new Date(),
            action,
            details,
            user: 'System'
        };
        setLogs(prev => [newLog, ...prev]);
    };

    const value = {
        templates, setTemplates,
        dailyReports, setDailyReports,
        billingRules, setBillingRules,
        pettyCashHistory, setPettyCashHistory,
        logs, setLogs,
        addLog
    };

    return (
        <AppDataContext.Provider value={value}>
            {children}
        </AppDataContext.Provider>
    );
};

export const useAppData = () => {
    const context = useContext(AppDataContext);
    if (!context) throw new Error('useAppData must be used within AppDataProvider');
    return context;
};
