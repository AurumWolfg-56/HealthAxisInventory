import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { InventoryItem, Order, PriceItem, MedicalCode, CodeGroup } from '../types';
import { InventoryService } from '../services/InventoryService';
import { OrderService } from '../services/OrderService';
import { PriceService } from '../services/PriceService';
import { MedicalCodeService } from '../services/MedicalCodeService';
import { supabase } from '../src/lib/supabase';

interface InventoryContextType {
    inventory: InventoryItem[];
    orders: Order[];
    prices: PriceItem[];
    codes: MedicalCode[];
    codeGroups: CodeGroup[];
    isLoadingInventory: boolean;
    isLoadingOrders: boolean;
    isLoadingPrices: boolean;
    isLoadingCodes: boolean;
    refreshInventory: () => Promise<void>;
    setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    setPrices: React.Dispatch<React.SetStateAction<PriceItem[]>>;
    setCodes: React.Dispatch<React.SetStateAction<MedicalCode[]>>;
    setCodeGroups: React.Dispatch<React.SetStateAction<CodeGroup[]>>;
    setIsLoadingInventory: React.Dispatch<React.SetStateAction<boolean>>;
    setIsLoadingOrders: React.Dispatch<React.SetStateAction<boolean>>;
    setIsLoadingPrices: React.Dispatch<React.SetStateAction<boolean>>;
    setIsLoadingCodes: React.Dispatch<React.SetStateAction<boolean>>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [prices, setPrices] = useState<PriceItem[]>([]);
    const [codes, setCodes] = useState<MedicalCode[]>([]);
    const [codeGroups, setCodeGroups] = useState<CodeGroup[]>([]);

    const [isLoadingInventory, setIsLoadingInventory] = useState(false);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);
    const [isLoadingCodes, setIsLoadingCodes] = useState(false);

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const isFetchingRef = useRef(false);
    const hasLoadedRef = useRef(false);

    const refreshInventory = useCallback(async () => {
        // Prevent concurrent fetches
        if (isFetchingRef.current) {
            return;
        }

        // Don't fetch if not authenticated
        if (!isAuthenticated) {
            return;
        }

        isFetchingRef.current = true;
        setIsLoadingInventory(true);
        setIsLoadingOrders(true);
        setIsLoadingPrices(true);
        setIsLoadingCodes(true);

        try {
            // Load inventory first as it's the primary focus
            const fetchedInventory = await InventoryService.fetchAll();
            setInventory(fetchedInventory);
            setIsLoadingInventory(false);

            // Load others in parallel/settled
            const results = await Promise.allSettled([
                OrderService.fetchAll(),
                PriceService.fetchAll(),
                MedicalCodeService.fetchCodes(),
                MedicalCodeService.fetchGroups()
            ]);

            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    if (index === 0) setOrders(result.value);
                    if (index === 1) setPrices(result.value);
                    if (index === 2) setCodes(result.value);
                    if (index === 3) setCodeGroups(result.value);
                }
                // Silently handle failures - tables might be empty
            });

            hasLoadedRef.current = true;
        } catch (error) {
            console.error("[InventoryContext] Error during data load:", error);
        } finally {
            setIsLoadingInventory(false);
            setIsLoadingOrders(false);
            setIsLoadingPrices(false);
            setIsLoadingCodes(false);
            isFetchingRef.current = false;
        }
    }, [isAuthenticated]);

    // Listen for auth state changes - optimized to prevent duplicate fetches
    useEffect(() => {
        let mounted = true;

        const handleSession = (session: any) => {
            if (session?.access_token) {
                InventoryService.setAccessToken(session.access_token);
                OrderService.setAccessToken(session.access_token);
                PriceService.setAccessToken(session.access_token);
                MedicalCodeService.setAccessToken(session.access_token);
                if (mounted) setIsAuthenticated(true);
            } else {
                if (mounted) setIsAuthenticated(false);
            }
        };

        // Check initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (mounted) handleSession(session);
        });

        // Subscribe to auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!mounted) return;
            handleSession(session);
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // Load data when authenticated (only once)
    useEffect(() => {
        if (isAuthenticated && !hasLoadedRef.current && !isFetchingRef.current) {
            refreshInventory();
        }
    }, [isAuthenticated, refreshInventory]);

    const value = {
        inventory, orders, prices, codes, codeGroups,
        isLoadingInventory, isLoadingOrders, isLoadingPrices, isLoadingCodes,
        refreshInventory,
        setInventory, setOrders, setPrices, setCodes, setCodeGroups,
        setIsLoadingInventory, setIsLoadingOrders, setIsLoadingPrices, setIsLoadingCodes
    };

    return (
        <InventoryContext.Provider value={value}>
            {children}
        </InventoryContext.Provider>
    );
};

export const useInventory = () => {
    const context = useContext(InventoryContext);
    if (!context) throw new Error('useInventory must be used within InventoryProvider');
    return context;
};
