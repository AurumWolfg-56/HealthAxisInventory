import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { InventoryItem, Order, PriceItem, MedicalCode, CodeGroup } from '../types';
import { InventoryService } from '../services/InventoryService';
import { OrderService } from '../services/OrderService';
import { PriceService } from '../services/PriceService';
import { MedicalCodeService } from '../services/MedicalCodeService';
import { useAuth } from './AuthContext';

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
    // Get token from AuthContext — SINGLE source of truth
    const { accessToken } = useAuth();

    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [prices, setPrices] = useState<PriceItem[]>([]);
    const [codes, setCodes] = useState<MedicalCode[]>([]);
    const [codeGroups, setCodeGroups] = useState<CodeGroup[]>([]);

    const [isLoadingInventory, setIsLoadingInventory] = useState(false);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);
    const [isLoadingCodes, setIsLoadingCodes] = useState(false);

    const isFetchingRef = useRef(false);
    const hasLoadedRef = useRef(false);

    const refreshInventory = useCallback(async () => {
        if (isFetchingRef.current || !accessToken) return;

        isFetchingRef.current = true;
        setIsLoadingInventory(true);
        setIsLoadingOrders(true);
        setIsLoadingPrices(true);
        setIsLoadingCodes(true);

        try {
            const fetchedInventory = await InventoryService.fetchAll();
            setInventory(fetchedInventory);
            setIsLoadingInventory(false);

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
    }, [accessToken]);

    // ──────────────────────────────────────────────────────────────
    // When accessToken changes (from null → token), cache it on
    // services and trigger data fetch. NO getSession(), NO
    // onAuthStateChange — just watching the token from AuthContext.
    // ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (accessToken) {
            console.log('[InventoryContext] 🔑 Token received from AuthContext — caching on services');
            InventoryService.setAccessToken(accessToken);
            OrderService.setAccessToken(accessToken);
            PriceService.setAccessToken(accessToken);
            MedicalCodeService.setAccessToken(accessToken);

            if (!hasLoadedRef.current) {
                refreshInventory();
            }
        } else {
            // Token cleared (sign out)
            hasLoadedRef.current = false;
            isFetchingRef.current = false;
        }
    }, [accessToken, refreshInventory]);

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
