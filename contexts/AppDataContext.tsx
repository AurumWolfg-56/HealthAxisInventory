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
import { PriceService } from '../services/PriceService';
import { MedicalCodeService } from '../services/MedicalCodeService';
import { PettyCashService } from '../services/PettyCashService';
import { ScheduleService } from '../services/ScheduleService';
import { billingRules as INITIAL_BILLING_RULES } from '../data/billingRules';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';

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
    // Get token from AuthContext — SINGLE source of truth
    const { user, accessToken } = useAuth();
    // Get locationId from TenantContext
    const { locationId } = useTenant();

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

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // Core data fetching function
    const fetchAllData = useCallback(async () => {
        if (isFetchingRef.current) {
            console.log('[AppDataContext] ⏳ Skipping — fetch already in progress');
            return;
        }

        if (!accessToken) {
            console.warn('[AppDataContext] ⚠️ No accessToken, aborting fetch');
            return;
        }

        isFetchingRef.current = true;
        setIsLoading(true);
        console.log('[AppDataContext] === Starting data fetch ===');

        try {
            // Run fetches in parallel
            const [reportsResult, templatesResult, billingRulesResult, budgetsResult, protocolsResult, pettyCashResult] = await Promise.allSettled([
                DailyReportService.getReports(),
                TemplateService.getTemplates(),
                BillingRuleService.getRules(),
                BudgetService.getBudgets(user?.id),
                ProtocolService.getProtocols(),
                PettyCashService.getTransactions()
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
                setTemplates(templatesResult.value);
            } else {
                console.error('[AppDataContext] ❌ Templates failed:', templatesResult.reason);
            }

            // Handle Billing Rules
            if (billingRulesResult.status === 'fulfilled') {
                setBillingRules(billingRulesResult.value.length > 0 ? billingRulesResult.value : INITIAL_BILLING_RULES);
            } else {
                console.error('[AppDataContext] ❌ Billing Rules failed:', billingRulesResult.reason);
            }

            // Handle Budgets
            if (budgetsResult.status === 'fulfilled') {
                setBudgets(budgetsResult.value);
            } else {
                console.error('[AppDataContext] ❌ Budgets failed:', budgetsResult.reason);
            }

            // Handle Protocols
            if (protocolsResult.status === 'fulfilled') {
                setProtocols(protocolsResult.value);
            } else {
                console.error('[AppDataContext] ❌ Protocols failed:', protocolsResult.reason);
            }

            // Handle Petty Cash
            if (pettyCashResult.status === 'fulfilled') {
                setPettyCashHistory(pettyCashResult.value);
            } else {
                console.error('[AppDataContext] ❌ Petty Cash failed:', pettyCashResult.reason);
            }

            // [FIX] Feature: Automatically sync any daily reports that were saved offline
            DailyReportService.restoreLocalReports(user?.id).then((restoredCount) => {
                if (restoredCount && restoredCount > 0) {
                    console.log(`[AppDataContext] ♻️ Auto-synced ${restoredCount} offline reports!`);
                    // Fetch reports again to show the newly synced data in UI
                    DailyReportService.getReports().then((newReports) => {
                        if (mountedRef.current) setDailyReports(newReports);
                    }).catch(err => console.error("Failed to refresh reports after sync", err));
                }
            }).catch(err => console.error("Auto-sync failed", err));

            hasLoadedRef.current = true;
            console.log('[AppDataContext] === Data fetch complete ===');
        } catch (err: any) {
            console.error('[AppDataContext] 🔥 Critical error:', err?.message || err);
        } finally {
            isFetchingRef.current = false;
            if (mountedRef.current) setIsLoading(false);
        }
    }, [accessToken, user?.id]);

    // ──────────────────────────────────────────────────────────────
    // When accessToken changes (from null → token), cache it on
    // services and trigger data fetch. NO getSession(), NO
    // onAuthStateChange — just watching the token from AuthContext.
    // ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (accessToken) {
            console.log('[AppDataContext] 🔑 Token received from AuthContext — caching on services');
            DailyReportService.setAccessToken(accessToken);
            TemplateService.setAccessToken(accessToken);
            UserService.setAccessToken(accessToken);
            InventoryService.setAccessToken(accessToken);
            OrderService.setAccessToken(accessToken);
            BillingRuleService.setAccessToken(accessToken);
            BudgetService.setAccessToken(accessToken);
            ProtocolService.setAccessToken(accessToken);
            MedicalCodeService.setAccessToken(accessToken);
            PriceService.setAccessToken(accessToken);
            PettyCashService.setAccessToken(accessToken);
            ScheduleService.setAccessToken(accessToken);

            if (!hasLoadedRef.current) {
                fetchAllData();
            }
        } else {
            // Token cleared (sign out)
            DailyReportService.clearAccessToken();
            hasLoadedRef.current = false;
            isFetchingRef.current = false;
            setDailyReports([]);
            setTemplates([]);
            setBudgets([]);
            setProtocols([]);
            setPettyCashHistory([]);
        }
    }, [accessToken, fetchAllData]);

    // ──────────────────────────────────────────────────────────────
    // When locationId changes, distribute it to all services and
    // re-fetch scoped data for the new clinic.
    // ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!locationId) return;
        console.log('[AppDataContext] 📍 Location changed:', locationId);

        // Distribute to all services
        InventoryService.setLocationId(locationId);
        OrderService.setLocationId(locationId);
        DailyReportService.setLocationId(locationId);
        TemplateService.setLocationId(locationId);
        BillingRuleService.setLocationId(locationId);
        BudgetService.setLocationId(locationId);
        ProtocolService.setLocationId(locationId);
        UserService.setLocationId(locationId);
        MedicalCodeService.setLocationId(locationId);
        PriceService.setLocationId(locationId);
        PettyCashService.setLocationId(locationId);
        ScheduleService.setLocationId(locationId);

        // Re-fetch if data was already loaded (location switch)
        if (hasLoadedRef.current && accessToken) {
            hasLoadedRef.current = false;
            fetchAllData();
        }
    }, [locationId, accessToken, fetchAllData]);

    // LocalStorage persistence
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
