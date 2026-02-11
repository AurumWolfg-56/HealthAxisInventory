import React, { createContext, useContext, useState, useEffect } from 'react';
import { FormTemplate, BillingRule, PettyCashTransaction, ActivityLog } from '../types';
import { DailyReport } from '../types/dailyReport';
import { DailyReportService } from '../services/DailyReportService';
import { TemplateService } from '../services/TemplateService';
import { billingRules as INITIAL_BILLING_RULES } from '../data/billingRules';
import { useAuth } from './AuthContext';

// Storage Keys
const STORAGE_KEYS = {
    TEMPLATES: 'ha_templates',
    DAILY_REPORTS: 'ha_daily_reports',
    BILLING_RULES: 'ha_billing_rules',
    PETTY_CASH: 'ha_petty_cash',
    LOGS: 'ha_logs',
};

// Initial Data
const INITIAL_TEMPLATES: FormTemplate[] = [];

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
    const { user, isLoading: authLoading } = useAuth();

    const [templates, setTemplates] = useState<FormTemplate[]>(() => loadState(STORAGE_KEYS.TEMPLATES, INITIAL_TEMPLATES));
    const [dailyReports, setDailyReports] = useState<DailyReport[]>(() => loadState(STORAGE_KEYS.DAILY_REPORTS, []));
    const [billingRules, setBillingRules] = useState<BillingRule[]>(() => loadState(STORAGE_KEYS.BILLING_RULES, INITIAL_BILLING_RULES));
    const [pettyCashHistory, setPettyCashHistory] = useState<PettyCashTransaction[]>(() => loadState(STORAGE_KEYS.PETTY_CASH, []));
    const [logs, setLogs] = useState<ActivityLog[]>(() => {
        const loadedLogs = loadState(STORAGE_KEYS.LOGS, []);
        // Rehydrate dates
        return loadedLogs.map((log: any) => ({ ...log, timestamp: new Date(log.timestamp) }));
    });

    useEffect(() => {
        // CRITICAL: Wait for Auth to be ready before fetching data
        // Otherwise RLS policies will block the request (resulting in empty arrays)
        if (authLoading || !user) {
            console.log('[AppDataContext] Waiting for auth...', { authLoading, user: !!user });
            return;
        }

        const fetchReports = async () => {
            console.log('[AppDataContext] Auth ready, fetching reports...');
            try {
                const reports = await DailyReportService.getReports();
                console.log('[AppDataContext] Reports fetched:', reports.length);
                setDailyReports(reports);
            } catch (error) {
                console.error("Failed to fetch daily reports", error);
            }
        };
        const fetchTemplates = async () => {
            try {
                const templates = await TemplateService.getTemplates();
                if (templates.length > 0) {
                    setTemplates(templates);
                }
            } catch (error) {
                console.error("Failed to fetch templates", error);
            }
        };

        fetchReports();
        fetchTemplates();
    }, [user, authLoading]);

    useEffect(() => localStorage.setItem(STORAGE_KEYS.BILLING_RULES, JSON.stringify(billingRules)), [billingRules]);
    useEffect(() => localStorage.setItem(STORAGE_KEYS.PETTY_CASH, JSON.stringify(pettyCashHistory)), [pettyCashHistory]);
    useEffect(() => localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs)), [logs]);

    const addLog = (action: ActivityLog['action'], details: string) => {
        const newLog: ActivityLog = {
            id: Date.now().toString(),
            timestamp: new Date(),
            action,
            details,
            user: user?.username || 'System'
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
