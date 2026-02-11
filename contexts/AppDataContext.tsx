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

    const isFetchingRef = useRef(false);
    const hasLoadedRef = useRef(false);
    const mountedRef = useRef(true);

    // Core data fetching function — accepts token to avoid duplicate getSession() calls
    const fetchAllData = useCallback(async (accessToken?: string) => {
        if (isFetchingRef.current || hasLoadedRef.current) {
            console.log('[AppDataContext] Skipping fetch (fetching:', isFetchingRef.current, 'loaded:', hasLoadedRef.current, ')');
            return;
        }

        isFetchingRef.current = true;
        console.log('[AppDataContext] === Starting data fetch ===', accessToken ? '(token passed)' : '(no token)');

        try {
            // Pass the access token directly — avoids duplicate getSession() deadlock
            try {
                const reports = await DailyReportService.getReports(accessToken);
                if (mountedRef.current) {
                    console.log('[AppDataContext] ✅ Reports fetched successfully:', reports.length);
                    setDailyReports(reports);
                }
            } catch (reportError) {
                console.error('[AppDataContext] ❌ Reports fetch failed:', reportError);
            }

            // Fetch templates (non-critical, no timeout needed)
            try {
                const fetchedTemplates = await TemplateService.getTemplates();
                if (mountedRef.current && fetchedTemplates.length > 0) {
                    console.log('[AppDataContext] ✅ Templates fetched:', fetchedTemplates.length);
                    setTemplates(fetchedTemplates);
                }
            } catch (templateError) {
                console.error('[AppDataContext] ❌ Templates fetch failed:', templateError);
            }

            hasLoadedRef.current = true;
            console.log('[AppDataContext] === Data fetch complete ===');
        } finally {
            isFetchingRef.current = false;
        }
    }, []);

    // Single unified auth listener
    useEffect(() => {
        mountedRef.current = true;

        const handleAuth = async () => {
            // Step 1: Check for existing session (handles page refresh)
            console.log('[AppDataContext] Checking for existing session...');
            const { data: { session } } = await supabase.auth.getSession();

            if (session && mountedRef.current) {
                console.log('[AppDataContext] ✅ Session found on init, passing token directly...');
                await fetchAllData(session.access_token);
            } else {
                console.log('[AppDataContext] No session found on init');
            }
        };

        handleAuth();

        // Step 2: Listen for future auth changes (handles login/logout)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[AppDataContext] Auth event:', event, '| hasSession:', !!session);

            if (event === 'SIGNED_IN' && session && !hasLoadedRef.current) {
                console.log('[AppDataContext] SIGNED_IN detected, passing token directly...');
                if (mountedRef.current) {
                    await fetchAllData(session.access_token);
                }
            }

            if (event === 'SIGNED_OUT') {
                console.log('[AppDataContext] SIGNED_OUT — clearing data');
                hasLoadedRef.current = false;
                isFetchingRef.current = false;
                if (mountedRef.current) {
                    setDailyReports([]);
                    setTemplates([]);
                }
            }
        });

        return () => {
            mountedRef.current = false;
            subscription.unsubscribe();
        };
    }, [fetchAllData]);

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
