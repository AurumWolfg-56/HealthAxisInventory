
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, UserRole, AppRoute, InventoryItem, ActivityLog, ToastMessage, Order, PriceItem, RoleConfig, Permission, FormTemplate, MedicalCode, CodeGroup, PettyCashTransaction, BillingRule } from './types';
import { useAuth } from './contexts/AuthContext';

import { useInventory } from './contexts/InventoryContext';
import { useAppData } from './contexts/AppDataContext';
import { Layout } from './components/Layout';
import { DailyReport } from './types/dailyReport';
import { generateUUID } from './utils/uuid';
import { DailyReportService } from './services/DailyReportService';
import { TemplateService } from './services/TemplateService';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Reports from './components/Reports';
import Orders from './components/Orders';
import PriceList from './components/PriceList';
import Scanner from './components/Scanner';
import Settings from './components/Settings';
import Admin from './components/Admin';
import Forms from './components/Forms';
import DailyCloseWizard, { DailyReportDocument } from './components/DailyCloseWizard';
import ReportHistory from './components/ReportHistory';
import ProductModal from './components/ProductModal';
import ItemScannerModal from './components/ItemScannerModal';
import BillingWizard from './components/BillingWizard';
import MedicalCodesManager from './components/MedicalCodesManager';
import PettyCashLedger from './components/PettyCashLedger';
import VoiceMemos from './components/VoiceMemos';
import { InventoryIntelligenceDashboard } from './components/InventoryIntelligence';
import { InventoryIntelligenceVerification } from './components/InventoryIntelligenceVerification';
import Login from './components/Login';
import Toast from './components/Toast';
import VoiceAssistant from './components/VoiceAssistant';
import Logo from './components/Logo';
import * as XLSX from 'xlsx';
import { translations, Language } from './utils/translations';
import { medicalCodes as INITIAL_CODES } from './data/medicalCodes';
import { billingRules as INITIAL_BILLING_RULES } from './data/billingRules';
import { supabase } from './src/lib/supabase';
import { InventoryService } from './services/InventoryService';
import { OrderService } from './services/OrderService';
import { PriceService } from './services/PriceService';
import { MedicalCodeService } from './services/MedicalCodeService';
import { UserService } from './services/UserService';
import { migrateLocalToCloud } from './utils/migrateLocalToCloud';

const STORAGE_KEYS = {
    USER: 'ha_user', // Managed by AuthContext
    USERS_DB: 'ha_users_db',
    THEME: 'ha_theme',
    LANG: 'ha_lang',

    TEMPLATES: 'ha_templates',
    DAILY_REPORTS: 'ha_daily_reports',
    MEDICAL_CODES: 'ha_medical_codes',
    CODE_GROUPS: 'ha_code_groups',
    PETTY_CASH: 'ha_petty_cash',
    VOICE_MEMOS: 'ha_voice_memos',
    BILLING_RULES: 'ha_billing_rules'
};

// Initial Inventory Removed - preventing local overwrite

// Initial Role Configs moved to types.ts to avoid circular dependency
// export const INITIAL_ROLE_CONFIGS...

const INITIAL_TEMPLATES: FormTemplate[] = [
    {
        id: 't1',
        title: 'Authorization for Release of Medical Records',
        slug: 'auth-release-records',
        version: '1.0',
        language: 'English',
        status: 'Active',
        useLetterhead: true,
        content: `Patient Information...`,
        variables: ['{{patientName}}', '{{patientDOB}}', '{{procedure}}', '{{doctorName}}'],
        updatedAt: new Date().toISOString()
    }
];

const loadState = <T,>(key: string, fallback: T): T => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch (e) {
        console.error(`Error loading key ${key}`, e);
        return fallback;
    }
};



const App: React.FC = () => {
    // --- AUTH CONTEXT ---
    const { user, hasPermission, roleConfigs, updateRoleConfig, signOut, updateUser, isLoading } = useAuth();

    // --- STATE ---
    // const [user, setUser] = useState<User | null>(() => loadState(STORAGE_KEYS.USER, null)); // Moved to Context
    const [usersDb, setUsersDb] = useState<User[]>(() => loadState(STORAGE_KEYS.USERS_DB, [
        { id: 'u1', username: 'Dr. Smith', role: UserRole.DOCTOR },
        { id: 'u2', username: 'Dr. Jones', role: UserRole.DOCTOR },
        { id: 'u3', username: 'Nurse Jackie', role: UserRole.MA }
    ]));

    // --- INVENTORY CONTEXT ---
    const {
        inventory, orders, prices, codes, codeGroups,
        isLoadingInventory, isLoadingOrders, isLoadingPrices, isLoadingCodes,
        refreshInventory,
        setInventory, setOrders, setPrices, setCodes, setCodeGroups,
        setIsLoadingInventory, setIsLoadingOrders, setIsLoadingPrices, setIsLoadingCodes
    } = useInventory();

    // --- APP DATA CONTEXT ---
    const {
        templates, setTemplates, dailyReports, billingRules, pettyCashHistory, logs,
        setDailyReports, setLogs, addLog: contextAddLog
    } = useAppData();

    // Local Helper wrapper for addLog to match App signature if needed, or update usages
    const addLog = (action: ActivityLog['action'], details: string) => {
        contextAddLog(action, details);
    };

    const [currentRoute, setCurrentRoute] = useState<AppRoute>(AppRoute.DASHBOARD);
    const [reportsTab, setReportsTab] = useState<string | undefined>(undefined);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [isDarkMode, setIsDarkMode] = useState(() => loadState(STORAGE_KEYS.THEME, true));
    const [language, setLanguage] = useState<Language>(() => loadState(STORAGE_KEYS.LANG, 'en'));

    // UI Logic
    const [showScanner, setShowScanner] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalItem, setModalItem] = useState<Partial<InventoryItem> | undefined>(undefined);
    const [voiceSearchTerm, setVoiceSearchTerm] = useState<string>("");

    const [editingReport, setEditingReport] = useState<DailyReport | undefined>(undefined);
    const [viewingReport, setViewingReport] = useState<DailyReport | null>(null);
    const [needsPasswordUpdate, setNeedsPasswordUpdate] = useState(false);
    const viewerRef = useRef<HTMLDivElement>(null);

    const t = (key: keyof typeof translations.en) => translations[language][key] || key;

    // --- EFFECTS ---

    // NEW: Load Inventory from Supabase


    // Auth logic and role persistence moved to AuthContext
    // Removed: fetchRole effect
    // Removed: roleConfigs persistence effect
    // Removed: user persistence effect
    // START ORIG EFFECT BLOCK (Auth, etc)
    useEffect(() => {
        // Critical: Check hash immediately before Supabase client clears it
        const isInviteLink = window.location.hash.includes('type=invite') ||
            window.location.hash.includes('type=recovery') ||
            window.location.hash.includes('type=signup');

        if (isInviteLink) {
            console.log('[Auth] Detected invite/recovery link, enforcing password update.');
            setNeedsPasswordUpdate(true);
        }

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth Event:', event, session?.user?.email);

            if (event === 'PASSWORD_RECOVERY') {
                setNeedsPasswordUpdate(true);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Separate effect to fetch role once user is authenticated
    // This effect is now handled within AuthContext

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(isDarkMode));
    }, [isDarkMode]);

    // Fetch real users from DB for dropdowns - ensures we have the latest list (especially newly added doctors/owners)
    useEffect(() => {
        const fetchUsersDb = async () => {
            if (!user?.id) return;
            try {
                const fetchedUsers = await UserService.getUsers();
                console.log('[Debug] Users fetched:', fetchedUsers);
                setUsersDb(fetchedUsers);
                localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(fetchedUsers));
            } catch (err) {
                console.error('Exception fetching users db:', err);
            }
        };

        fetchUsersDb();
    }, [user?.id]);

    // Removed: useEffect(() => { localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(roleConfigs)); }, [roleConfigs]);

    // Migration to ensure 'admin.access' exists in roleConfigs if it was missing from localStorage
    // This logic should ideally be handled within AuthContext or on initial setup
    useEffect(() => {
        const hasAdminAccess = roleConfigs.some(rc => rc.permissions.includes('admin.access'));
        if (!hasAdminAccess) {
            console.log('Migrating roleConfigs to include admin.access');
            // This update needs to go through the AuthContext's update mechanism if roleConfigs is managed there
            // For now, assuming updateRoleConfig can handle this or it's a one-time migration
            // If roleConfigs is fully managed by context, this local state update won't work.
            // The instruction implies removing the local setRoleConfigs, so this block might need re-evaluation
            // or a context-aware implementation.
            // For now, removing the setRoleConfigs part as per the instruction's intent to remove local role state.
        }
    }, [roleConfigs]); // Keep dependency on roleConfigs to trigger if context changes it
    useEffect(() => { localStorage.setItem(STORAGE_KEYS.LANG, JSON.stringify(language)); }, [language]);
    // Removed: User, BillingRules, etc (Moved to AppDataContext)

    // Removed: handleStorage listener (managed by Contexts)

    // hasPermission moved to AuthContext
    // updateRoleConfig moved to AuthContext

    const toggleTheme = () => setIsDarkMode(!isDarkMode);
    const addToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, text, type }]);
    };
    const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));



    // refreshInventory moved to InventoryContext
    // user/refreshInventory effect removed as context handles init

    // Migration Helper (To be exposed in UI)
    const handleMigrate = async () => {
        if (!user?.id) return;
        const result = await migrateLocalToCloud(user.id);
        if (result.success) {
            alert(result.message);
            refreshInventory(); // Reload from cloud to verify
        } else {
            alert('Migration Failed: ' + result.message);
        }
    };

    const handleNavigate = (route: AppRoute, subTab?: string) => {
        if (route === currentRoute) return;
        setCurrentRoute(route);
        if (route === AppRoute.REPORTS && subTab) setReportsTab(subTab);
        else setReportsTab(undefined);
    };

    useEffect(() => {
        if (user) {
            console.log('[AuthDebug] User Logged In:', JSON.stringify({
                id: user.id,
                email: user.email,
                role: user.role,
                permissions: user.permissions?.length || 0
            }, null, 2));
        } else {
            console.log('[AuthDebug] No user session found');
        }
    }, [user]);

    const handleLogin = (user: any) => {
        // Session is handled by onAuthStateChange
        addToast(`Authentication successful`, 'success');
        if (window.location.hash && (window.location.hash.includes('type=invite') || window.location.hash.includes('type=recovery'))) {
            window.history.replaceState(null, '', window.location.pathname);
        }
    };

    // handleSignOut removed - handled in Layout

    const handleScanComplete = (data: any) => {
        setShowScanner(false);
        if (!hasPermission('inventory.edit')) { addToast("Permission denied", "error"); return; }
        if (data.suggestedName) {
            setModalItem({
                name: data.suggestedName,
                category: data.category || 'Uncategorized',
                stock: data.estimatedQuantity || 0,
                unit: 'unit_each',
                averageCost: 0,
                minStock: 10,
                maxStock: 100,
                expiryDate: data.expiryDate || '',
                batchNumber: '',
                location: ''
            });
            setIsModalOpen(true);
            addToast("Item identified!", "info");
        } else {
            addToast("Could not identify item details.", "error");
        }
    };



    const handleImport = async (file: File) => {
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    console.log(`[Import] Starting file processing: ${file.name}`);
                    const data = e.target?.result;
                    if (!data) throw new Error("Could not read file data");

                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet) as any[];

                    console.log(`[Import] Parsed ${json.length} rows from Excel`);

                    if (json.length === 0) {
                        addToast('File is empty', 'error');
                        return;
                    }

                    // Multi-language header mapping (En / Es)
                    const itemsToUpsert = json.map((row, index) => {
                        const getVal = (keys: string[]) => {
                            const foundKey = Object.keys(row).find(k =>
                                keys.some(target => k.toLowerCase().trim() === target.toLowerCase())
                            );
                            const val = foundKey ? row[foundKey] : undefined;
                            // Clean strings, handle undefined/null
                            return typeof val === 'string' ? val.trim() : val;
                        };

                        const stockRaw = getVal(['Stock', 'Existencia', 'Cantidad', 'Quantity', 'Stock Actual', 'Qty']);
                        const costRaw = getVal(['Cost', 'Costo', 'Average Cost', 'Price', 'Precio', 'Costo Promedio']);
                        const minRaw = getVal(['Min', 'Mínimo', 'Min Stock', 'Alert', 'Stock Minimo', 'Mínimo stock']);
                        const maxRaw = getVal(['Max', 'Máximo', 'Max Stock', 'Limit', 'Stock Maximo', 'Máximo stock']);
                        const expiryRaw = getVal(['Expiry', 'Expiración', 'Vencimiento', 'Expiry Date', 'Fecha de Vencimiento', 'Fecha Expiración']);
                        const skuRaw = getVal(['SKU', 'Code', 'Código', 'Ref', 'Reference', 'Cod']);

                        const item = {
                            name: getVal(['Name', 'Nombre', 'Item', 'Producto', 'Descripción', 'Descripcion']) || '',
                            category: getVal(['Category', 'Categoría', 'Grupo', 'Categoria']) || 'General',
                            sku: skuRaw || '',
                            stock: isNaN(Number(stockRaw)) ? 0 : Number(stockRaw),
                            unit: getVal(['Unit', 'Unidad']) || 'unit_each',
                            averageCost: isNaN(Number(costRaw)) ? 0 : Number(costRaw),
                            minStock: isNaN(Number(minRaw)) ? 10 : Number(minRaw),
                            maxStock: isNaN(Number(maxRaw)) ? 100 : Number(maxRaw),
                            expiryDate: expiryRaw || null,
                            batchNumber: getVal(['Batch', 'Lote', 'Batch Number', 'Lot', 'Número de Lote']) || '',
                            location: getVal(['Location', 'Ubicación', 'Bodega', 'Ubicacion']) || 'Main Storage'
                        };

                        if (!item.name) {
                            console.warn(`[Import] Row ${index + 2} skipped: Missing Name column`);
                        }
                        return item;
                    }).filter(item => item.name);

                    console.log(`[Import] Validated ${itemsToUpsert.length} items for upsert`);

                    if (itemsToUpsert.length === 0) {
                        addToast('No valid items found. Check Excel headers.', 'error');
                        return;
                    }

                    addToast(`Processing ${itemsToUpsert.length} items...`, 'info');

                    const successCount = await InventoryService.importItems(itemsToUpsert);

                    await refreshInventory();

                    if (successCount > 0) {
                        addToast(`Successfully imported ${successCount} items`, 'success');
                        addLog('IMPORT_INVENTORY', `Imported ${successCount}/${itemsToUpsert.length} items from ${file.name}`);
                    } else {
                        addToast('Import failed. Please check data format or permissions.', 'error');
                    }
                } catch (err: any) {
                    console.error('[Import] Internal Error:', err);
                    addToast(`Import error: ${err.message}`, 'error');
                }
            };
            reader.readAsArrayBuffer(file);
        } catch (e: any) {
            console.error('[Import] Reader Error:', e);
            addToast(`File read failed: ${e.message}`, 'error');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-[#0a0f18] text-indigo-600">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-lg font-medium text-gray-600 dark:text-gray-300 animate-pulse">Loading HealthAxis...</p>
                </div>
            </div>
        );
    }

    if (!user || needsPasswordUpdate) return (
        <>
            <Toast toasts={toasts} removeToast={removeToast} />
            <Login
                onLogin={(u) => {
                    handleLogin(u);
                    setNeedsPasswordUpdate(false);
                }}
                t={t}
                forcePasswordUpdate={needsPasswordUpdate}
                onPasswordSet={() => setNeedsPasswordUpdate(false)}
            />
        </>
    );

    // NAV_ITEMS and NavContent moved to Layout

    return (
        <div className={`min-h-screen transition-colors duration-500 font-sans selection:bg-medical-500/20 selection:text-medical-600 bg-medical-50 dark:bg-[#0a0f18]`}>

            <Toast toasts={toasts} removeToast={removeToast} />
            <VoiceAssistant onCommand={() => { }} onError={(msg) => addToast(msg, 'error')} />
            <ItemScannerModal
                isOpen={showScanner}
                onClose={() => setShowScanner(false)}
                onAddItem={async (itemData) => {
                    try {
                        const newItem = await InventoryService.createItem(itemData);
                        if (newItem) {
                            setInventory(prev => [newItem, ...prev]);
                            addToast('Item added via AI Scanner', 'success');

                            if (user?.id) {
                                await InventoryService.logAction(user.id, 'ADDED', newItem.id, `AI Scanner added: ${newItem.name}`);
                                addLog('ADDED', `AI Scanner added: ${newItem.name}`);
                            }
                        } else {
                            throw new Error("Failed to create item");
                        }
                    } catch (e: any) {
                        addToast(`Scan save failed: ${e.message}`, 'error');
                    }
                }}
                t={t}
            />
            <ProductModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={async (itemData) => {
                    try {
                        if (itemData.id) {
                            await InventoryService.updateItem(itemData.id, itemData);
                            setInventory(prev => prev.map(i => i.id === itemData.id ? { ...i, ...itemData } : i as InventoryItem));
                            addToast('Item updated', 'success');
                            if (user?.id) await InventoryService.logAction(user.id, 'UPDATED', itemData.id, `Updated ${itemData.name}`);
                        } else {
                            const newItem = await InventoryService.createItem(itemData);
                            if (newItem) {
                                setInventory(prev => [newItem, ...prev]);
                                addToast('Item added', 'success');
                                if (user?.id) await InventoryService.logAction(user.id, 'ADDED', newItem.id, `Added ${newItem.name}`);
                            } else {
                                throw new Error("Failed to create item");
                            }
                        }
                        setIsModalOpen(false);
                    } catch (e: any) {
                        addToast(`Save failed: ${e.message}`, 'error');
                    }
                }}
                initialData={modalItem}
                t={t}
            />

            <Layout
                currentRoute={currentRoute}
                onNavigate={handleNavigate}
                isDarkMode={isDarkMode}
                toggleTheme={toggleTheme}
                t={t}
            >

                <div key={currentRoute} className="max-w-[1600px] mx-auto print:max-w-none animate-fade-in-up">

                    {/* MIGRATION TOOL - TEMP UI FOR PHASE 2 */}
                    {currentRoute === AppRoute.DASHBOARD && (user?.role === UserRole.OWNER || user?.role === UserRole.MANAGER) && (
                        <div className="mb-8 p-6 rounded-3xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-xl flex items-center justify-between relative overflow-hidden group">
                            <div className="relative z-10">
                                <h3 className="text-xl font-bold mb-1"><i className="fa-solid fa-cloud-arrow-up mr-2"></i> System Migration</h3>
                                <p className="text-indigo-100/90 text-sm max-w-lg">
                                    We are moving to a localized Database. If you have local data, click below to sync it safely to the cloud.
                                </p>
                            </div>
                            <button
                                onClick={handleMigrate}
                                className="relative z-10 px-6 py-3 bg-white text-indigo-600 rounded-xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                            >
                                <i className="fa-solid fa-bolt"></i> Sync Data to Cloud
                            </button>
                            {/* Decorative Circles */}
                            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-3xl"></div>
                            <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-indigo-900/20 blur-3xl"></div>
                        </div>
                    )}

                    {currentRoute === AppRoute.DASHBOARD && hasPermission('dashboard.view') && <Dashboard inventory={inventory} logs={logs} dailyReports={dailyReports} pettyCashHistory={pettyCashHistory} orders={orders} users={usersDb} t={t} onNavigate={handleNavigate} />}
                    {currentRoute === AppRoute.INVENTORY && hasPermission('inventory.view') && (
                        <Inventory
                            items={inventory}
                            user={user}
                            hasPermission={hasPermission}
                            onAddItem={() => { setModalItem(undefined); setIsModalOpen(true); }}
                            onEditItem={(i) => { setModalItem(i); setIsModalOpen(true); }}
                            onUpdateItem={async (id, updates) => {
                                try {
                                    await InventoryService.updateItem(id, updates);
                                    setInventory(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv));
                                    addToast('Item updated successfully', 'success');

                                    // Optional: Log update
                                    if (user?.id) await InventoryService.logAction(user.id, 'UPDATED', id, `Updated item details`, updates);
                                } catch (e: any) {
                                    addToast(`Update failed: ${e.message}`, 'error');
                                }
                            }}
                            onDeleteItem={() => { }}
                            onAuditItem={async (id) => {
                                try {
                                    const timestamp = new Date().toISOString();
                                    const username = user?.username || 'System';
                                    const userId = user?.id;

                                    await InventoryService.updateItem(id, {
                                        lastChecked: timestamp,
                                        lastCheckedBy: username
                                    });

                                    // Update local state
                                    setInventory(prev => prev.map(inv => inv.id === id ? {
                                        ...inv,
                                        lastChecked: timestamp,
                                        lastCheckedBy: username
                                    } : inv));

                                    // Log the audit action
                                    if (userId) {
                                        const item = inventory.find(i => i.id === id);
                                        await InventoryService.logAction(userId, 'AUDITED', id, { stock: item?.stock, verified_at: timestamp });

                                        // Sync with local activity log
                                        addLog('AUDITED', `Verified audit for ${item?.name || 'Item ID: ' + id}`);
                                    }

                                    addToast('Audit verified successfully', 'success');
                                } catch (e: any) {
                                    addToast(`Audit failed: ${e.message}`, 'error');
                                }
                            }}
                            onScanClick={() => setShowScanner(true)}
                            onImport={handleImport}
                            onMergeDuplicates={() => { }}
                            searchOverride={voiceSearchTerm}
                            t={t}
                        />
                    )}
                    {currentRoute === AppRoute.INTELLIGENCE && hasPermission('intelligence.view') && (
                        <InventoryIntelligenceDashboard
                            inventory={inventory}
                            onAddToOrder={(items) => {
                                // Add items to Current Order (Draft)
                                // We need to check if a draft order exists, or create one?
                                // For simplicity, we can just add them to the 'cart' logic if it exists, 
                                // or auto-create a draft order.
                                // Given the existing logic, we might need to navigate to Orders and prepopulate?
                                // Or better: Call OrderService to create a draft order directly.

                                // Implementation:
                                // Create a new DRAFT order with these items from "Restock Request"
                                const orderItems = items.map(i => {
                                    const invItem = inventory.find(inv => inv.id === i.itemId);
                                    return {
                                        id: generateUUID(),
                                        inventoryItemId: i.itemId,
                                        name: invItem?.name || 'Unknown',
                                        quantity: i.quantity,
                                        unitCost: invItem?.averageCost || 0,
                                        unitType: invItem?.unit || 'unit',
                                        total: (invItem?.averageCost || 0) * i.quantity
                                    };
                                });

                                const newOrder: Order = {
                                    id: generateUUID(),
                                    poNumber: `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}-AUTO`,
                                    vendor: 'Multiple/Auto',
                                    orderDate: new Date().toISOString().split('T')[0],
                                    expectedDate: '',
                                    status: 'DRAFT',
                                    items: orderItems,
                                    subtotal: orderItems.reduce((acc, item) => acc + item.total, 0),
                                    shippingCost: 0,
                                    totalTax: 0,
                                    grandTotal: orderItems.reduce((acc, item) => acc + item.total, 0),
                                    notes: 'Generated by Inventory Intelligence',
                                    createdBy: user?.id
                                };

                                // Save via OrderService
                                OrderService.createOrder(newOrder, user?.id || 'system').then(created => {
                                    if (created) {
                                        setOrders(prev => [created, ...prev]);
                                        addToast('Draft Order Created from recommendations', 'success');
                                        handleNavigate(AppRoute.ORDERS);
                                    }
                                });
                            }}
                        />
                    )}

                    {currentRoute === 'intelligence-verify' && (
                        <div className="p-4">
                            <InventoryIntelligenceVerification />
                        </div>
                    )}
                    {currentRoute === AppRoute.ORDERS && hasPermission('orders.view') && (
                        <Orders
                            orders={orders}
                            inventory={inventory}
                            user={user}
                            hasPermission={hasPermission}
                            isLoadingOrders={isLoadingOrders}
                            onSaveOrder={async (order) => {
                                try {
                                    setIsLoadingOrders(true);
                                    if (!user?.id) throw new Error("User not authenticated");

                                    const newOrder = await OrderService.createOrder(order, user.id);
                                    if (newOrder) {
                                        setOrders(prev => [newOrder, ...prev]);
                                        addToast('Order created successfully', 'success');

                                        // Log activity
                                        addLog('ORDER_CREATED', `Created PO #${newOrder.poNumber} for ${newOrder.vendor}`);
                                        if (user.id) {
                                            await InventoryService.logAction(
                                                user.id,
                                                'ORDER_CREATED',
                                                newOrder.id,
                                                "Order Created",
                                                { vendor: newOrder.vendor, total: newOrder.grandTotal },
                                                'orders'
                                            );
                                        }
                                    }
                                } catch (e: any) {
                                    console.error(e);
                                    addToast(`Error saving order: ${e.message}`, 'error');
                                } finally {
                                    setIsLoadingOrders(false);
                                }
                            }}
                            onReceiveOrder={async (order) => {
                                try {
                                    if (!user?.id) throw new Error("User not authenticated");

                                    const now = new Date().toISOString();
                                    let itemsProcessed = 0;

                                    // ── Process each order item independently ─────────────────────────
                                    // Each item is DB-written then immediately committed to local state.
                                    // An error on one item shows a toast but does NOT block the others.
                                    for (const orderItem of order.items) {
                                        try {
                                            // 1. Look for the item in local state (fast path)
                                            let existingItem = inventory.find(inv =>
                                                (orderItem.inventoryItemId && inv.id === orderItem.inventoryItemId) ||
                                                inv.name.trim().toLowerCase() === orderItem.name.trim().toLowerCase()
                                            );

                                            // 2. If not in local state, check the DB directly — this handles
                                            // the case where a previous receipt attempt inserted the item into DB
                                            // but local state was never updated (avoids unique constraint errors)
                                            if (!existingItem) {
                                                const dbItem = await InventoryService.findByName(orderItem.name.trim());
                                                if (dbItem) {
                                                    existingItem = dbItem;
                                                    // Sync local state with the DB item so UI is consistent
                                                    setInventory(prev => {
                                                        const alreadyPresent = prev.some(i => i.id === dbItem.id);
                                                        return alreadyPresent ? prev : [...prev, dbItem];
                                                    });
                                                }
                                            }

                                            if (existingItem) {
                                                // ── Existing item ──────────────────────────────────────
                                                const newStock = existingItem.stock + orderItem.quantity;
                                                const currentTotalValue = existingItem.stock * (existingItem.averageCost || 0);
                                                const newOrderValue = orderItem.quantity * (orderItem.unitCost || 0);
                                                const newAverageCost = newStock > 0
                                                    ? (currentTotalValue + newOrderValue) / newStock
                                                    : existingItem.averageCost;

                                                // DB write
                                                await InventoryService.updateItem(existingItem.id, {
                                                    stock: newStock,
                                                    averageCost: newAverageCost,
                                                    lastChecked: now,
                                                    lastCheckedBy: user.username
                                                });

                                                // Audit log (used by Intelligence Engine for cycle detection)
                                                await InventoryService.logAction(
                                                    user.id, 'RESTOCKED', existingItem.id,
                                                    JSON.stringify({ new_stock: newStock, added: orderItem.quantity, source_order: order.id })
                                                );

                                                // Immediately commit to local state
                                                setInventory(prev => prev.map(inv =>
                                                    inv.id === existingItem.id
                                                        ? { ...inv, stock: newStock, averageCost: newAverageCost, lastChecked: now, lastCheckedBy: user.username }
                                                        : inv
                                                ));
                                                itemsProcessed++;

                                            } else {
                                                // ── New item ───────────────────────────────────────────
                                                const newItemConfig: Omit<InventoryItem, 'id'> = {
                                                    name: orderItem.name,
                                                    category: orderItem.category || 'Uncategorized',
                                                    stock: orderItem.quantity,
                                                    unit: orderItem.unitType || 'unit_each',
                                                    averageCost: orderItem.unitCost || 0,
                                                    minStock: 10,
                                                    maxStock: 100,
                                                    expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
                                                    batchNumber: `ORDER-${order.poNumber}`,
                                                    location: 'Main Storage',
                                                    lastChecked: now,
                                                    lastCheckedBy: user.username
                                                };

                                                const newItem = await InventoryService.createItem(newItemConfig);
                                                if (!newItem) throw new Error(`DB returned null for new item: ${newItemConfig.name}`);

                                                // Audit log for new item (Intelligence Engine needs this)
                                                await InventoryService.logAction(
                                                    user.id, 'RESTOCKED', newItem.id,
                                                    JSON.stringify({ new_stock: orderItem.quantity, added: orderItem.quantity, source_order: order.id })
                                                );

                                                // Back-fill order_items.item_id so future fetches can link the row
                                                await OrderService.updateOrderItemLink(orderItem.id, newItem.id);

                                                // Immediately commit to local state
                                                setInventory(prev => [...prev, newItem]);
                                                itemsProcessed++;
                                            }
                                        } catch (itemErr: any) {
                                            console.error(`[ReceiveOrder] Failed to process item "${orderItem.name}":`, itemErr);
                                            addToast(`Could not update "${orderItem.name}": ${itemErr.message}`, 'error');
                                        }
                                    }

                                    // ── Mark order RECEIVED (non-blocking for inventory) ──────────────
                                    // If this fails (e.g. transient DB issue), inventory is already updated
                                    // correctly — we just show a warning instead of rolling everything back.
                                    try {
                                        await OrderService.receiveOrder(order.id);
                                        setOrders(prev => prev.map(o =>
                                            o.id === order.id ? { ...o, status: 'RECEIVED' as const } : o
                                        ));
                                    } catch (statusErr: any) {
                                        console.warn('[ReceiveOrder] Could not update order status:', statusErr);
                                        addToast(`Order status update failed, but inventory was updated. Please refresh.`, 'info');
                                    }

                                    if (itemsProcessed > 0) {
                                        addToast(`Order ${order.poNumber} received. ${itemsProcessed} item(s) updated in inventory.`, 'success');
                                        addLog('ORDER_RECEIVED', `Received ${order.poNumber}. ${itemsProcessed} item(s) updated.`);
                                    }

                                } catch (e: any) {
                                    console.error('[ReceiveOrder] Unexpected failure:', e);
                                    addToast(`Error receiving order: ${e.message}`, 'error');
                                }
                            }}
                            onDeleteOrder={async (orderId) => {
                                try {
                                    setIsLoadingOrders(true);

                                    // Delete from Supabase
                                    await OrderService.deleteOrder(orderId);
                                    setOrders(prev => prev.filter(o => o.id !== orderId));

                                    // Log to local activity log
                                    addLog('DELETED_ORDER', `Deleted order ID: ${orderId}`);

                                    if (user?.id) {
                                        try {
                                            await InventoryService.logAction(user.id, 'DELETED_ORDER', orderId, {}, null, 'orders');
                                        } catch (logErr) {
                                            console.warn('Audit log insert failed (non-critical):', logErr);
                                        }
                                    }
                                    addToast('Order deleted successfully', 'info');
                                } catch (e: any) {
                                    console.error('Failed to delete order:', e);
                                    addToast('Failed to delete order', 'error');
                                } finally {
                                    setIsLoadingOrders(false);
                                }
                            }}
                            onAddToInventory={async (itemData) => {
                                try {
                                    const newItem = await InventoryService.createItem(itemData);
                                    if (newItem) {
                                        setInventory(prev => [newItem, ...prev]);
                                        addToast(`Added ${itemData.name} to inventory`, 'success');
                                        if (user?.id) await InventoryService.logAction(user.id, 'ADDED', newItem.id, `Order Scanner added: ${newItem.name}`);
                                        addLog('ADDED', `Order Scanner added: ${itemData.name}`);
                                    } else {
                                        throw new Error("Failed to create item");
                                    }
                                } catch (e: any) {
                                    addToast(`Failed to add item: ${e.message}`, 'error');
                                }
                            }}
                            t={t}
                        />
                    )}
                    {currentRoute === AppRoute.PRICELIST && hasPermission('prices.view') && (
                        <PriceList
                            prices={prices}
                            user={user}
                            hasPermission={hasPermission}
                            isLoadingPrices={isLoadingPrices}
                            onAddPrice={async (priceData) => {
                                try {
                                    const newPrice = await PriceService.createPrice(priceData);
                                    if (newPrice) {
                                        setPrices(prev => [newPrice, ...prev]);
                                        addToast('Price item added', 'success');
                                        addLog('PRICE_ADDED', `Added service: ${newPrice.serviceName}`);
                                    }
                                } catch (e) {
                                    addToast('Failed to add price item', 'error');
                                }
                            }}
                            onUpdatePrice={async (price) => {
                                try {
                                    await PriceService.updatePrice(price);
                                    setPrices(prev => prev.map(p => p.id === price.id ? price : p));
                                    addToast('Price item updated', 'success');
                                    addLog('PRICE_UPDATED', `Updated service: ${price.serviceName}`);
                                } catch (e) {
                                    addToast('Failed to update price item', 'error');
                                }
                            }}
                            onDeletePrice={async (id) => {
                                try {
                                    await PriceService.deletePrice(id);
                                    setPrices(prev => prev.filter(p => p.id !== id));
                                    addToast('Price item deleted', 'info');
                                    addLog('PRICE_DELETED', `Deleted price item ID: ${id}`);
                                } catch (e) {
                                    addToast('Failed to delete price item', 'error');
                                }
                            }}
                            onImportPrices={async (newPrices) => {
                                // Bulk add
                                try {
                                    let addedCount = 0;
                                    for (const price of newPrices) {
                                        const added = await PriceService.createPrice(price);
                                        if (added) {
                                            setPrices(prev => [added, ...prev]);
                                            addedCount++;
                                        }
                                    }
                                    addToast(`Imported ${addedCount} prices`, 'success');
                                    addLog('PRICE_IMPORT', `Imported ${addedCount} items`);
                                } catch (e) {
                                    addToast('Failed to import some prices', 'error');
                                }
                            }}
                            t={t}
                        />
                    )}
                    {currentRoute === AppRoute.BILLING_WIZARD && hasPermission('billing.view') && <BillingWizard billingRules={billingRules} user={user} onSaveRule={() => { }} onDeleteRule={() => { }} t={t} />}
                    {currentRoute === AppRoute.MEDICAL_CODES && hasPermission('codes.view') && (
                        <MedicalCodesManager
                            codes={codes}
                            groups={codeGroups}
                            user={user}
                            isLoadingCodes={isLoadingCodes}
                            canManage={hasPermission('codes.manage')}
                            onSaveCode={async (code) => {
                                try {
                                    if (code.id) {
                                        const updated = await MedicalCodeService.updateCode(code);
                                        if (updated) {
                                            setCodes(prev => prev.map(c => c.id === code.id ? updated : c));
                                            addToast('Medical code updated', 'success');
                                            addLog('CODE_UPDATED', `Updated code: ${code.name}`);
                                        }
                                    } else {
                                        const newCode = await MedicalCodeService.createCode(code);
                                        if (newCode) {
                                            setCodes(prev => [newCode, ...prev]);
                                            addToast('Medical code created', 'success');
                                            addLog('CODE_ADDED', `Created code: ${newCode.name}`);
                                        }
                                    }
                                } catch (e) {
                                    addToast('Failed to save code', 'error');
                                }
                            }}
                            onDeleteCode={async (id) => {
                                try {
                                    await MedicalCodeService.deleteCode(id);
                                    setCodes(prev => prev.filter(c => c.id !== id));
                                    // Update local groups state just in case, though backend remains purely array
                                    setCodeGroups(prev => prev.map(g => ({
                                        ...g,
                                        codeIds: g.codeIds.filter(cid => cid !== id)
                                    })));
                                    addToast('Medical code deleted', 'info');
                                    addLog('CODE_DELETED', `Deleted code ID: ${id}`);
                                } catch (e) {
                                    addToast('Failed to delete code', 'error');
                                }
                            }}
                            onSaveGroup={async (group) => {
                                try {
                                    if (group.id) {
                                        const updated = await MedicalCodeService.updateGroup(group);
                                        if (updated) {
                                            setCodeGroups(prev => prev.map(g => g.id === group.id ? updated : g));
                                            addToast('Panel saved', 'success');
                                            addLog('GROUP_UPDATED', `Updated panel: ${group.name}`);
                                        }
                                    } else {
                                        const newGroup = await MedicalCodeService.createGroup(group);
                                        if (newGroup) {
                                            setCodeGroups(prev => [newGroup, ...prev]);
                                            addToast('Panel created', 'success');
                                            addLog('GROUP_ADDED', `Created panel: ${newGroup.name}`);
                                        }
                                    }
                                } catch (e) {
                                    addToast('Failed to save panel', 'error');
                                }
                            }}
                            onDeleteGroup={async (id) => {
                                try {
                                    await MedicalCodeService.deleteGroup(id);
                                    setCodeGroups(prev => prev.filter(g => g.id !== id));
                                    addToast('Panel deleted', 'info');
                                    addLog('GROUP_DELETED', `Deleted panel ID: ${id}`);
                                } catch (e) {
                                    addToast('Failed to delete panel', 'error');
                                }
                            }}
                            t={t}
                        />
                    )}
                    {currentRoute === AppRoute.PETTY_CASH && hasPermission('finance.view') && <PettyCashLedger user={user} t={t} />}
                    {currentRoute === AppRoute.VOICE_MEMOS && hasPermission('voice.dictate') && <VoiceMemos user={user} t={t} />}
                    {currentRoute === AppRoute.FORMS && hasPermission('forms.generate') && (
                        <Forms
                            templates={templates}
                            users={usersDb}
                            user={user}
                            hasPermission={hasPermission}
                            onSaveTemplate={async (template) => {
                                try {
                                    if (templates.find(t => t.id === template.id)) {
                                        const updated = await TemplateService.updateTemplate(template);
                                        if (updated) {
                                            setTemplates(prev => prev.map(t => t.id === template.id ? updated : t));
                                            addToast('Template updated', 'success');
                                            addLog('TEMPLATE_UPDATED', `Updated template: ${template.title}`);
                                        }
                                    } else {
                                        const newTemplate = await TemplateService.createTemplate(template);
                                        if (newTemplate) {
                                            setTemplates(prev => [newTemplate, ...prev]);
                                            addToast('Template created', 'success');
                                            addLog('TEMPLATE_CREATED', `Created template: ${template.title}`);
                                        }
                                    }
                                } catch (e: any) {
                                    console.error('Template Save Error:', e);
                                    addToast(`Failed to save template: ${e.message}`, 'error');
                                    throw e;
                                }
                            }}
                            onDeleteTemplate={async (id) => {
                                if (confirm('Delete template?')) {
                                    try {
                                        const success = await TemplateService.deleteTemplate(id);
                                        if (success) {
                                            setTemplates(prev => prev.filter(t => t.id !== id));
                                            addToast('Template deleted', 'info');
                                            addLog('TEMPLATE_DELETED', `Deleted template ID: ${id}`);
                                        }
                                    } catch (e) {
                                        addToast('Failed to delete template', 'error');
                                    }
                                }
                            }}
                            onLogAction={addLog}
                            t={t}
                        />
                    )}
                    {currentRoute === AppRoute.REPORTS && hasPermission('reports.view') && (
                        <Reports
                            inventory={inventory}
                            logs={logs}
                            user={user}
                            t={t}
                            hasPermission={hasPermission}
                            onNavigate={setCurrentRoute}
                            initialTab={reportsTab}
                            onUpdateLog={(id, details) => {
                                setLogs(prev => prev.map(log => log.id === id ? { ...log, details } : log));
                                addToast('Log updated successfully', 'success');
                            }}
                            onDeleteLog={async (id) => {
                                try {
                                    const { error } = await supabase.from('audit_log').delete().eq('id', id);
                                    if (error) throw error;
                                    setLogs(prev => prev.filter(log => log.id !== id));
                                    addToast('Log entry permanently removed', 'success');
                                } catch (e: any) {
                                    addToast(`Failed to delete log: ${e.message}`, 'error');
                                }
                            }}
                        />
                    )}
                    {currentRoute === AppRoute.DAILY_HISTORY && hasPermission('reports.create') && (
                        <ReportHistory
                            reports={dailyReports}
                            user={user}
                            onEditReport={(r) => { setEditingReport(r); setCurrentRoute(AppRoute.DAILY_CLOSE); }}
                            onDeleteReport={async (id) => {
                                if (confirm('Are you sure you want to delete this report?')) {
                                    try {
                                        const success = await DailyReportService.deleteReport(id);
                                        if (success) {
                                            setDailyReports(prev => prev.filter(r => r.id !== id));
                                            addToast('Report deleted successfully', 'success');
                                            addLog('DAILY_CLOSE', `Deleted report: ${id}`);
                                        } else {
                                            addToast('Failed to delete report from database', 'error');
                                        }
                                    } catch (e) {
                                        addToast('Error deleting report', 'error');
                                    }
                                }
                            }}
                            onViewReport={(r) => setViewingReport(r)}
                            onCreateNew={() => { setEditingReport(undefined); setCurrentRoute(AppRoute.DAILY_CLOSE); }}
                        />
                    )}
                    {currentRoute === AppRoute.DAILY_CLOSE && hasPermission('reports.create') && (
                        <DailyCloseWizard
                            user={user}
                            usersDb={usersDb}
                            onCloseComplete={(report) => {
                                setDailyReports(prev => {
                                    const exists = prev.find(r => r.id === report.id);
                                    if (exists) return prev.map(r => r.id === report.id ? report : r);
                                    return [report, ...prev];
                                });
                                addLog('DAILY_CLOSE', `Completed daily reconciliation: ${report.id}`);
                                addToast('Daily Report saved successfully', 'success');
                                setEditingReport(undefined);
                                setCurrentRoute(AppRoute.DAILY_HISTORY);
                            }}
                            onCancel={() => {
                                setEditingReport(undefined);
                                setCurrentRoute(AppRoute.DAILY_HISTORY);
                            }}
                            initialData={editingReport}
                        />
                    )}
                    {currentRoute === AppRoute.SETTINGS && <Settings user={user} onUpdateUser={updateUser} isDarkMode={isDarkMode} toggleTheme={toggleTheme} onResetData={() => { }} language={language} setLanguage={setLanguage} t={t} />}
                    {currentRoute === AppRoute.ADMIN && hasPermission('admin.access') && <Admin roleConfigs={roleConfigs} onUpdateRoleConfig={updateRoleConfig} currentUser={user} t={t} />}
                </div>
            </Layout>

            {/* Floating Action Button (Minimal) */}
            <div className="md:hidden fixed bottom-6 right-6 z-40 animate-scale-in">
                <button onClick={() => setShowScanner(true)} className="w-16 h-16 rounded-full bg-gradient-to-br from-medical-500 to-medical-600 text-white shadow-glow flex items-center justify-center border-4 border-white dark:border-slate-800 active:scale-90 transition-transform">
                    <i className="fa-solid fa-qrcode text-2xl"></i>
                </button>
            </div>

            {viewingReport && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in-up">
                    <button onClick={() => setViewingReport(null)} className="absolute top-4 right-4 text-white text-3xl hover:text-red-400 transition-colors"><i className="fa-solid fa-xmark"></i></button>
                    <div className="bg-white rounded-lg p-4 overflow-auto max-h-full shadow-2xl">
                        <DailyReportDocument report={viewingReport} usersDb={usersDb} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
