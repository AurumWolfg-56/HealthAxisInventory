import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { FormTemplate, BillingRule, PettyCashTransaction, ActivityLog, Budget, Protocol } from '../types';
import { DailyReport } from '../types/dailyReport';
import { DailyReportService } from '../services/DailyReportService';
import { TemplateService } from '../services/TemplateService';
import { UserService } from '../services/UserService';
import { InventoryService } from '../services/InventoryService';
import { OrderService } from '../services/OrderService';
import { BillingRuleService } from '../services/BillingRuleService';
import { BudgetService } from '../services/BudgetService';
import { ProtocolService } from '../services/ProtocolService';
import { billingRules as INITIAL_BILLING_RULES } from '../data/billingRules';
import { supabase } from '../src/lib/supabase';
import { useAuth } from './AuthContext';

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
    addLog: (action: ActivityLog['action'], details: string, userName?: string) => void;
    budgets: Budget[];
    setBudgets: React.Dispatch<React.SetStateAction<Budget[]>>;
    protocols: Protocol[];
    setProtocols: React.Dispatch<React.SetStateAction<Protocol[]>>;
    refreshData: () => Promise<void>;
    isLoading: boolean;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Get authenticated user from AuthContext
    const { user } = useAuth();

    // State
    const [templates, setTemplates] = useState<FormTemplate[]>([]);
    const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
    const [billingRules, setBillingRules] = useState<BillingRule[]>(() => loadState(STORAGE_KEYS.BILLING_RULES, INITIAL_BILLING_RULES));
    const [pettyCashHistory, setPettyCashHistory] = useState<PettyCashTransaction[]>(() => loadState(STORAGE_KEYS.PETTY_CASH, []));
    const [logs, setLogs] = useState<ActivityLog[]>(() => {
        const loadedLogs = loadState(STORAGE_KEYS.LOGS, []);
        return loadedLogs.map((log: any) => ({ ...log, timestamp: new Date(log.timestamp) }));
    });
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [protocols, setProtocols] = useState<Protocol[]>([]);

    const [isLoading, setIsLoading] = useState(false);

    const isFetchingRef = useRef(false);
    const hasLoadedRef = useRef(false);
    const mountedRef = useRef(true);

    // Cleanup on unmount
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // Core data fetching function
    const fetchAllData = useCallback(async (userId?: string) => {
        if (isFetchingRef.current) {
            console.log('[AppDataContext] ⏳ Skipping — fetch already in progress');
            return;
        }

        isFetchingRef.current = true;
        setIsLoading(true);
        console.log('[AppDataContext] === Starting data fetch === userId:', userId || 'none');

        try {
            // Get the current session token for API calls
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                console.warn('[AppDataContext] ⚠️ No session token available, aborting fetch');
                return;
            }

            const resolvedUserId = userId || session.user?.id;

            // Cache token on all services
            DailyReportService.setAccessToken(session.access_token);
            TemplateService.setAccessToken(session.access_token);
            UserService.setAccessToken(session.access_token);
            InventoryService.setAccessToken(session.access_token);
            OrderService.setAccessToken(session.access_token);
            BillingRuleService.setAccessToken(session.access_token);
            ProtocolService.setAccessToken(session.access_token);

            console.log('[AppDataContext] 🔑 Token cached. Fetching all data...');

            // Run fetches in parallel
            const [reportsResult, templatesResult, billingRulesResult, budgetsResult, protocolsResult] = await Promise.allSettled([
                DailyReportService.getReports(),
                TemplateService.getTemplates(),
                BillingRuleService.getRules(),
                BudgetService.getBudgets(resolvedUserId),
                ProtocolService.getProtocols()
            ]);

            if (!mountedRef.current) return;

            // Handle Reports
            if (reportsResult.status === 'fulfilled') {
                console.log('[AppDataContext] ✅ Reports:', reportsResult.value.length);
                setDailyReports(reportsResult.value);
            } else {
                console.error('[AppDataContext] ❌ Reports failed:', reportsResult.reason?.message || reportsResult.reason);
            }

            // Handle Templates
            if (templatesResult.status === 'fulfilled') {
                console.log('[AppDataContext] ✅ Templates:', templatesResult.value.length);
                setTemplates(templatesResult.value);
            } else {
                console.error('[AppDataContext] ❌ Templates failed:', templatesResult.reason);
            }

            // Handle Billing Rules
            if (billingRulesResult.status === 'fulfilled') {
                console.log('[AppDataContext] ✅ Billing Rules:', billingRulesResult.value.length);
                setBillingRules(billingRulesResult.value.length > 0 ? billingRulesResult.value : INITIAL_BILLING_RULES);
            } else {
                console.error('[AppDataContext] ❌ Billing Rules failed:', billingRulesResult.reason);
            }

            // Handle Budgets
            if (budgetsResult.status === 'fulfilled') {
                console.log('[AppDataContext] ✅ Budgets:', budgetsResult.value.length);
                setBudgets(budgetsResult.value);
            } else {
                console.error('[AppDataContext] ❌ Budgets failed:', budgetsResult.reason);
            }

            // Handle Protocols
            if (protocolsResult.status === 'fulfilled') {
                console.log('[AppDataContext] ✅ Protocols:', protocolsResult.value.length);
                setProtocols(protocolsResult.value);
            } else {
                console.error('[AppDataContext] ❌ Protocols failed:', protocolsResult.reason);
            }

            hasLoadedRef.current = true;
            console.log('[AppDataContext] === Data fetch complete ===');
        } catch (err: any) {
            console.error('[AppDataContext] 🔥 Critical error:', err?.message || err);
        } finally {
            isFetchingRef.current = false;
            if (mountedRef.current) setIsLoading(false);
        }
    }, []);

    // ──────────────────────────────────────────────────────────────────
    // SIMPLE APPROACH: Fetch data when the user becomes available.
    // No separate onAuthStateChange listener needed — AuthContext 
    // already handles session restoration and provides the `user` object.
    // This eliminates ALL race conditions from competing listeners.
    // ──────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (user?.id && !hasLoadedRef.current) {
            console.log('[AppDataContext] 👤 User detected:', user.id.substring(0, 8), '— loading data...');
            fetchAllData(user.id);
        }

        if (!user) {
            // User signed out — clear data
            if (hasLoadedRef.current) {
                console.log('[AppDataContext] 🚪 User gone — clearing data');
                DailyReportService.clearAccessToken();
                hasLoadedRef.current = false;
                isFetchingRef.current = false;
                setDailyReports([]);
                setTemplates([]);
                setBudgets([]);
                setProtocols([]);
            }
        }
    }, [user?.id, fetchAllData]);

    // LocalStorage persistence for non-Supabase data
    useEffect(() => localStorage.setItem(STORAGE_KEYS.BILLING_RULES, JSON.stringify(billingRules)), [billingRules]);
    useEffect(() => localStorage.setItem(STORAGE_KEYS.PETTY_CASH, JSON.stringify(pettyCashHistory)), [pettyCashHistory]);
    useEffect(() => localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs)), [logs]);

    const addLog = (action: ActivityLog['action'], details: string, userName?: string) => {
        const newLog: ActivityLog = {
            id: Date.now().toString(),
            timestamp: new Date(),
            action,
            details,
            user: userName || 'System'
        };
        setLogs(prev => [newLog, ...prev]);
    };

    const value = {
        templates, setTemplates,
        dailyReports, setDailyReports,
        billingRules, setBillingRules,
        pettyCashHistory, setPettyCashHistory,
        logs, setLogs,
        addLog,
        budgets, setBudgets,
        protocols, setProtocols,
        refreshData: fetchAllData,
        isLoading
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
