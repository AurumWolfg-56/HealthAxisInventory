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

    // Core data fetching function — uses the cached token (set via setAccessToken)
    const fetchAllData = useCallback(async () => {
        if (isFetchingRef.current) {
            console.log('[AppDataContext] already fetching, skipping concurrent');
            return;
        }

        isFetchingRef.current = true;
        setIsLoading(true); // UI Feedback
        console.log('[AppDataContext] === Starting data fetch ===');

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;

            // Run fetches in parallel using Promise.allSettled so one failure doesn't block the other result
            const [reportsResult, templatesResult, billingRulesResult, budgetsResult, protocolsResult] = await Promise.allSettled([
                DailyReportService.getReports(),
                TemplateService.getTemplates(),
                BillingRuleService.getRules(),
                BudgetService.getBudgets(userId),
                ProtocolService.getProtocols()
            ]);

            // Handle Reports
            if (reportsResult.status === 'fulfilled') {
                if (mountedRef.current) {
                    console.log('[AppDataContext] ✅ Reports fetched:', reportsResult.value.length);
                    setDailyReports(reportsResult.value);
                }
            } else {
                console.error('[AppDataContext] ❌ Reports fetch failed:', reportsResult.reason);
            }

            // Handle Templates
            if (templatesResult.status === 'fulfilled') {
                if (mountedRef.current) {
                    console.log('[AppDataContext] ✅ Templates fetched:', templatesResult.value.length);
                    setTemplates(templatesResult.value);
                }
            } else {
                console.error('[AppDataContext] ❌ Templates fetch failed:', templatesResult.reason);
            }

            // Handle Billing Rules
            if (billingRulesResult.status === 'fulfilled') {
                if (mountedRef.current) {
                    console.log('[AppDataContext] ✅ Billing Rules fetched:', billingRulesResult.value.length);
                    setBillingRules(billingRulesResult.value.length > 0 ? billingRulesResult.value : INITIAL_BILLING_RULES);
                }
            } else {
                console.error('[AppDataContext] ❌ Billing Rules fetch failed:', billingRulesResult.reason);
            }

            // Handle Budgets
            if (budgetsResult.status === 'fulfilled') {
                if (mountedRef.current) {
                    console.log('[AppDataContext] ✅ Budgets fetched:', budgetsResult.value.length);
                    setBudgets(budgetsResult.value);
                }
            } else {
                console.error('[AppDataContext] ❌ Budgets fetch failed:', budgetsResult.reason);
            }

            // Handle Protocols
            if (protocolsResult.status === 'fulfilled') {
                if (mountedRef.current) {
                    console.log('[AppDataContext] ✅ Protocols fetched:', protocolsResult.value.length);
                    setProtocols(protocolsResult.value);
                }
            } else {
                console.error('[AppDataContext] ❌ Protocols fetch failed:', protocolsResult.reason);
            }

            hasLoadedRef.current = true;
            console.log('[AppDataContext] === Data fetch complete ===');
        } catch (err) {
            console.error('[AppDataContext] Critical fetch error:', err);
        } finally {
            isFetchingRef.current = false;
            if (mountedRef.current) setIsLoading(false);
        }
    }, []);

    // Single unified auth listener — relies entirely on onAuthStateChange
    // which fires INITIAL_SESSION on page refresh, SIGNED_IN on login,
    // and TOKEN_REFRESHED when the access token is renewed.
    useEffect(() => {
        mountedRef.current = true;

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[AppDataContext] Auth event:', event, '| hasSession:', !!session);

            if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
                console.log('[AppDataContext] Session detected via', event, '— caching token & fetching data...');
                DailyReportService.setAccessToken(session.access_token);
                TemplateService.setAccessToken(session.access_token);
                UserService.setAccessToken(session.access_token);
                InventoryService.setAccessToken(session.access_token);
                OrderService.setAccessToken(session.access_token);
                BillingRuleService.setAccessToken(session.access_token);
                ProtocolService.setAccessToken(session.access_token);
                if (mountedRef.current) {
                    await fetchAllData();
                }
            } else if (event === 'INITIAL_SESSION' && !session) {
                console.log('[AppDataContext] No session found on init (INITIAL_SESSION without session)');
            }

            if (event === 'SIGNED_OUT') {
                console.log('[AppDataContext] SIGNED_OUT — clearing data & token');
                DailyReportService.clearAccessToken();
                hasLoadedRef.current = false;
                isFetchingRef.current = false;
                if (mountedRef.current) {
                    setDailyReports([]);
                    setTemplates([]);
                    setBudgets([]);
                    setProtocols([]);
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
