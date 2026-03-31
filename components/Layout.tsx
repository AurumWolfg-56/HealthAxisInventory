import React, { useState, useEffect, useCallback } from 'react';
import { User, AppRoute, Permission } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { FeatureFlagKey } from '../utils/featureFlags';
import Logo from './Logo';
import { AIGatewayStatus } from './AIGatewayStatus';

interface LayoutProps {
    children: React.ReactNode;
    currentRoute: AppRoute;
    onNavigate: (route: AppRoute, subTab?: string) => void;
    isDarkMode: boolean;
    toggleTheme: () => void;
    t: (key: string) => string;
    // user/hasPermission/signOut can be fetched from useAuth
}

export const Layout: React.FC<LayoutProps> = ({
    children,
    currentRoute,
    onNavigate,
    isDarkMode,
    toggleTheme,
    t
}) => {
    const { user, hasPermission, signOut, hasPlatformAccess } = useAuth();
    const { currentLocation, currentOrg, userLocations, switchLocation, isFeatureEnabled } = useTenant();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showLocationPicker, setShowLocationPicker] = useState(false);

    // Collapsible sidebar sections
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
        try {
            const saved = localStorage.getItem('sidebar_sections');
            return saved ? JSON.parse(saved) : { operations: true, clinical: false, management: false };
        } catch { return { operations: true, clinical: false, management: false }; }
    });

    const toggleSection = useCallback((key: string) => {
        setExpandedSections(prev => {
            const next = { ...prev, [key]: !prev[key] };
            localStorage.setItem('sidebar_sections', JSON.stringify(next));
            return next;
        });
    }, []);

    // Helper: render location icon using CSS instead of unreliable PNGs
    const renderLocationIcon = (size: string = 'w-10 h-10', rounded: string = 'rounded-xl') => {
        const logoUrl = currentLocation?.logo_url;
        // If logo_url starts with 'icon:', render a CSS-based icon
        if (logoUrl && logoUrl.startsWith('icon:')) {
            const parts = logoUrl.split(':');
            const iconName = parts[1] || 'building';
            const bgColor = parts[2] || '14b8a6';
            return (
                <div className={`${size} ${rounded} flex items-center justify-center text-white shadow-md`} style={{ backgroundColor: `#${bgColor}` }}>
                    <i className={`fa-solid fa-${iconName} text-lg`}></i>
                </div>
            );
        }
        // If logo_url is a real URL/path, use img but with dark bg to hide white artifacts
        if (logoUrl) {
            return <img src={logoUrl} alt={currentLocation?.name || ''} className={`${size} ${rounded} object-contain bg-slate-900 p-0.5`} />;
        }
        // Fallback: first letter
        return (
            <div className={`${size} ${rounded} bg-medical-500/10 flex items-center justify-center text-medical-500 font-black`}>
                {currentLocation?.name?.charAt(0) || 'N'}
            </div>
        );
    };

    // Reset main content scroll when route changes
    React.useEffect(() => {
        const scrollContainer = document.getElementById('main-scroll-container');
        if (scrollContainer) {
            scrollContainer.scrollTo(0, 0);
        }
    }, [currentRoute]);

    // If no user, we might want to just render children (login page) or return null
    // But App.tsx handles the Login conditional return BEFORE rendering Layout usually.
    // We assume user is present if Layout is rendered, or handle safe fallback.
    if (!user) return <>{children}</>;

    const handleSignOut = async () => {
        await signOut();
    };

    const handleNavigateWrapper = (route: AppRoute) => {
        onNavigate(route);
        setIsMobileMenuOpen(false);
    };

    // Pinned item (always visible)
    const PINNED_ITEM = { route: AppRoute.DASHBOARD, icon: "fa-chart-pie", label: t('nav_dashboard'), perm: 'dashboard.view' as const, moduleFlag: 'mod_dashboard' as FeatureFlagKey };

    // Grouped nav sections
    type NavItem = { route: AppRoute; icon: string; label: string; perm: string; moduleFlag?: FeatureFlagKey };
    type NavSection = { key: string; label: string; icon: string; items: NavItem[] };

    const NAV_SECTIONS: NavSection[] = [
        {
            key: 'operations', label: 'Operations', icon: 'fa-boxes-stacked',
            items: [
                { route: AppRoute.INVENTORY, icon: "fa-boxes-stacked", label: t('nav_inventory'), perm: 'inventory.view', moduleFlag: 'mod_inventory' as FeatureFlagKey },
                { route: AppRoute.ORDERS, icon: "fa-cart-shopping", label: t('nav_orders'), perm: 'orders.view', moduleFlag: 'mod_orders' as FeatureFlagKey },
                { route: AppRoute.BUDGETS, icon: "fa-wallet", label: "Budgets", perm: 'finance.manage', moduleFlag: 'mod_budgets' as FeatureFlagKey },
                { route: AppRoute.PRICELIST, icon: "fa-tags", label: t('nav_prices'), perm: 'prices.view', moduleFlag: 'mod_pricelist' as FeatureFlagKey },
            ]
        },
        {
            key: 'clinical', label: 'Clinical', icon: 'fa-stethoscope',
            items: [
                { route: AppRoute.PROTOCOLS, icon: "fa-book-medical", label: "Staff Hub", perm: 'protocols.view', moduleFlag: 'mod_protocols' as FeatureFlagKey },
                { route: AppRoute.BILLING_WIZARD, icon: "fa-file-invoice-dollar", label: t('nav_billing'), perm: 'billing.view', moduleFlag: 'mod_billing' as FeatureFlagKey },
                { route: AppRoute.FORMS, icon: "fa-file-signature", label: "Forms", perm: 'forms.generate', moduleFlag: 'mod_forms' as FeatureFlagKey },
                { route: AppRoute.MEDICAL_CODES, icon: "fa-list-ol", label: "Medical Codes", perm: 'codes.view', moduleFlag: 'mod_medical_codes' as FeatureFlagKey },
                { route: AppRoute.VOICE_MEMOS, icon: "fa-microphone-lines", label: t('nav_voice'), perm: 'voice.dictate', moduleFlag: 'mod_voice_memos' as FeatureFlagKey },
            ]
        },
        {
            key: 'management', label: 'Management', icon: 'fa-chart-line',
            items: [
                { route: AppRoute.INTELLIGENCE, icon: "fa-brain", label: "Intelligence", perm: 'intelligence.view', moduleFlag: 'mod_intelligence' as FeatureFlagKey },
                { route: AppRoute.REPORTS, icon: "fa-clipboard-list", label: t('nav_reports'), perm: 'reports.view', moduleFlag: 'mod_reports' as FeatureFlagKey },
                { route: AppRoute.DAILY_HISTORY, icon: "fa-calendar-check", label: t('nav_daily'), perm: 'reports.create', moduleFlag: 'mod_daily_close' as FeatureFlagKey },
                { route: AppRoute.PETTY_CASH, icon: "fa-vault", label: "Petty Cash", perm: 'finance.view', moduleFlag: 'mod_petty_cash' as FeatureFlagKey },
                { route: AppRoute.ADMIN, icon: "fa-shield-halved", label: t('nav_admin'), perm: 'admin.access' },
                { route: AppRoute.SETTINGS, icon: "fa-gear", label: t('nav_settings'), perm: '' },
            ]
        }
    ];

    // Auto-expand the section containing the active route
    useEffect(() => {
        for (const section of NAV_SECTIONS) {
            if (section.items.some(i => i.route === currentRoute)) {
                setExpandedSections(prev => {
                    if (prev[section.key]) return prev;
                    const next = { ...prev, [section.key]: true };
                    localStorage.setItem('sidebar_sections', JSON.stringify(next));
                    return next;
                });
                break;
            }
        }
    }, [currentRoute]);

    const renderNavItem = (item: NavItem, isActive: boolean) => (
        <button
            key={item.route}
            onClick={() => handleNavigateWrapper(item.route)}
            className={`group relative flex items-center gap-3 px-4 py-2.5 w-full rounded-xl transition-all duration-200 active:scale-[0.97] outline-none
              ${isActive
                    ? 'bg-medical-500/10 text-medical-500 dark:text-medical-400 font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-medical-500/5 hover:text-slate-700 dark:hover:text-slate-200'}`}
        >
            {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-medical-500 rounded-r-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${isActive ? 'bg-medical-500 text-white shadow-md shadow-medical-500/25' : 'text-inherit'}`}>
                <i className={`fa-solid ${item.icon} text-sm`}></i>
            </div>
            <span className="text-[13px] tracking-wide">{item.label}</span>
        </button>
    );

    const renderNavContent = () => (
        <nav className="flex-1 px-3 mt-2 custom-scrollbar overflow-y-auto pb-safe space-y-1">
            {/* Pinned: Dashboard */}
            {(!PINNED_ITEM.perm || hasPermission(PINNED_ITEM.perm as Permission)) && (
                <div className="mb-2">
                    {renderNavItem(PINNED_ITEM as NavItem, currentRoute === PINNED_ITEM.route)}
                </div>
            )}

            {/* Collapsible Sections */}
            {NAV_SECTIONS.map(section => {
                const visibleItems = section.items.filter(i =>
                    (!i.perm || hasPermission(i.perm as Permission)) &&
                    (!i.moduleFlag || isFeatureEnabled(i.moduleFlag))
                );
                if (visibleItems.length === 0) return null;

                const isExpanded = expandedSections[section.key] ?? false;
                const hasActiveChild = visibleItems.some(i => i.route === currentRoute);

                return (
                    <div key={section.key} className="mb-1">
                        {/* Section Header */}
                        <button
                            onClick={() => toggleSection(section.key)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group/header
                                ${hasActiveChild && !isExpanded ? 'bg-medical-500/5' : 'hover:bg-slate-100/50 dark:hover:bg-slate-800/30'}`}
                        >
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                                hasActiveChild ? 'text-medical-500' : 'text-slate-400 dark:text-slate-500 group-hover/header:text-slate-600 dark:group-hover/header:text-slate-300'
                            }`}>
                                <i className={`fa-solid ${section.icon} text-xs`}></i>
                            </div>
                            <span className={`text-[11px] font-bold uppercase tracking-wider flex-1 text-left transition-colors ${
                                hasActiveChild ? 'text-medical-500' : 'text-slate-400 dark:text-slate-500 group-hover/header:text-slate-600 dark:group-hover/header:text-slate-300'
                            }`}>
                                {section.label}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-300 dark:text-slate-600 mr-1">{visibleItems.length}</span>
                            <i className={`fa-solid fa-chevron-right text-[9px] text-slate-300 dark:text-slate-600 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}></i>
                        </button>

                        {/* Section Items */}
                        <div className={`overflow-hidden transition-all duration-200 ease-out ${isExpanded ? 'max-h-96 opacity-100 mt-0.5' : 'max-h-0 opacity-0'}`}>
                            <div className="ml-2 pl-3 border-l-2 border-slate-100 dark:border-slate-800/60 space-y-0.5">
                                {visibleItems.map(item => renderNavItem(item, currentRoute === item.route))}
                            </div>
                        </div>
                    </div>
                );
            })}
        </nav>
    );

    return (
        <div className={`min-h-screen flex transition-colors duration-500 font-sans selection:bg-medical-500/20 selection:text-medical-600 overflow-hidden relative bg-medical-50 dark:bg-[#080d0b]`}>
            {/* === MOBILE SIDEBAR DRAWER === */}
            <div
                className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            >
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
                <div className={`absolute top-0 bottom-0 left-0 w-[85%] max-w-[320px] bg-white/90 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl border-r border-white/20 dark:border-slate-800 transition-transform duration-300 ease-out flex flex-col pt-safe pb-safe ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="p-6 pb-2">
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                                <img src="/logo.png" alt="Norvexis Core" className="w-6 h-6 object-contain" />
                                <span className="text-xs font-black text-slate-400 dark:text-slate-500 tracking-tight">Norvexis <span className="text-medical-500">Core</span></span>
                            </div>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center">
                                <i className="fa-solid fa-chevron-left"></i>
                            </button>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30">
                            {renderLocationIcon('w-9 h-9', 'rounded-xl')}
                            <div className="overflow-hidden flex-1">
                                {currentLocation && <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{currentLocation.name}</p>}
                                {currentOrg && <p className="text-[10px] font-semibold text-slate-400 truncate">{currentOrg.name}</p>}
                            </div>
                        </div>
                    </div>
                    <div className="mx-6 my-4 p-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-800/50 flex items-center gap-3 shadow-inner">
                        <div className="w-10 h-10 rounded-full bg-medical-500 text-white flex items-center justify-center font-bold text-sm shadow-md">{user.username.charAt(0).toUpperCase()}</div>
                        <div className="flex-1 overflow-hidden">
                            <p className="font-bold text-slate-900 dark:text-white truncate">{user.username}</p>
                            <p className="text-[10px] uppercase font-bold text-slate-500">{user.role?.replace('_', ' ')}</p>
                        </div>
                        <button onClick={handleSignOut} className="text-red-500 hover:bg-red-100 p-2 rounded-lg transition-colors"><i className="fa-solid fa-right-from-bracket"></i></button>
                    </div>
                    <div className="h-px bg-slate-200 dark:bg-slate-800 mx-6 mb-2"></div>
                    {renderNavContent()}
                </div>
            </div>

            {/* === DESKTOP FLOATING DOCK SIDEBAR === */}
            <aside className={`hidden md:flex flex-col w-72 h-screen sticky top-0 z-40 transition-all duration-500 ${!isSidebarOpen ? '-ml-72 opacity-0' : ''}`}>
                <div className="h-[96%] m-3 rounded-[2rem] bg-white/70 dark:bg-[#0c1511]/80 backdrop-blur-2xl border border-white/40 dark:border-medical-500/8 shadow-glass flex flex-col relative overflow-hidden ring-1 ring-white/50 dark:ring-medical-500/5">
                    <div className="p-6 pb-3 z-10">
                        <div className="flex items-center gap-2 mb-4">
                            <img src="/logo.png" alt="Norvexis Core" className="w-7 h-7 object-contain" />
                            <span className="text-sm font-black text-slate-500 dark:text-slate-400 tracking-tight">Norvexis <span className="text-medical-500">Core</span></span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
                            {renderLocationIcon('w-10 h-10', 'rounded-xl')}
                            {currentLocation && (
                                <div className="overflow-hidden">
                                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{currentLocation.name}</p>
                                    {currentOrg && <p className="text-[10px] font-semibold text-slate-400 truncate">{currentOrg.name}</p>}
                                </div>
                            )}
                        </div>
                    </div>
                    {renderNavContent()}
                    {/* Command Center button — platform users only */}
                    {hasPlatformAccess && (
                        <div className="px-4 pb-2 z-10">
                            <button
                                onClick={() => handleNavigateWrapper(AppRoute.PLATFORM)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 text-sm font-bold
                                    ${currentRoute === AppRoute.PLATFORM
                                        ? 'bg-gradient-to-r from-violet-600/10 to-indigo-500/10 text-violet-600 dark:text-violet-400'
                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                    }`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${currentRoute === AppRoute.PLATFORM ? 'bg-violet-500 text-white shadow-lg' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                                    <i className="fa-solid fa-satellite-dish text-sm"></i>
                                </div>
                                <span>Command Center</span>
                            </button>
                        </div>
                    )}
                    <div className="px-4 pb-4 z-10">
                        <div className="p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-700/30">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-medical-500 to-medical-400 flex items-center justify-center text-white shadow-md font-bold text-sm flex-shrink-0">
                                    {user.username.charAt(0).toUpperCase()}
                                </div>
                                <div className="overflow-hidden flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{user.username}</p>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{user.role?.replace('_', ' ')}</p>
                                </div>
                                <button onClick={handleSignOut} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all flex-shrink-0" title={t('nav_signout')}>
                                    <i className="fa-solid fa-right-from-bracket text-xs"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* === MAIN CONTENT === */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">

                {/* Transparent Sticky Header */}
                <header className="h-20 md:h-24 flex items-center justify-between px-6 md:px-12 sticky top-0 z-30 transition-all duration-300">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden w-10 h-10 flex items-center justify-center text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-800/50 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 active:scale-90 transition-transform backdrop-blur-md">
                            <i className="fa-solid fa-bars text-lg"></i>
                        </button>
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hidden md:flex w-10 h-10 items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50 rounded-xl transition-all shadow-sm">
                            <i className="fa-solid fa-bars-staggered text-lg"></i>
                        </button>
                        <div className="md:hidden"><Logo className="w-8 h-8" classNameText="text-lg" showText={true} /></div>
                    </div>

                    <div className="flex items-center gap-3 md:gap-6">
                        {/* Location Selector (only shown for multi-location users) */}
                        {userLocations.length > 1 && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowLocationPicker(!showLocationPicker)}
                                    className="flex items-center gap-2 px-4 py-2 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-full border border-white/40 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow text-xs font-bold text-slate-600 dark:text-slate-300"
                                >
                                    <i className="fa-solid fa-location-dot text-medical-500"></i>
                                    <span className="hidden sm:inline truncate max-w-[120px]">{currentLocation?.name || 'Select'}</span>
                                    <i className="fa-solid fa-chevron-down text-[9px] opacity-50"></i>
                                </button>
                                {showLocationPicker && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowLocationPicker(false)}></div>
                                        <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                                            <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Switch Clinic</p>
                                            </div>
                                            {userLocations.map(a => (
                                                <button
                                                    key={a.location_id}
                                                    onClick={() => { switchLocation(a.location_id); setShowLocationPicker(false); }}
                                                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50
                                                        ${a.location_id === currentLocation?.id ? 'bg-medical-50 dark:bg-medical-900/20' : ''}`}
                                                >
                                                    <div className={`w-2 h-2 rounded-full ${a.location_id === currentLocation?.id ? 'bg-medical-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                                                    <div className="overflow-hidden">
                                                        <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{a.location?.name}</p>
                                                        <p className="text-[10px] text-slate-400">{a.role_id?.replace('_', ' ')}</p>
                                                    </div>
                                                    {a.location_id === currentLocation?.id && <i className="fa-solid fa-check text-medical-500 ml-auto text-xs"></i>}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        <AIGatewayStatus />

                        <button onClick={toggleTheme} className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-700 backdrop-blur-md transition-all border border-white/40 dark:border-slate-700 shadow-sm hover:shadow-lg active:scale-90">
                            <i className={`fa-solid ${isDarkMode ? 'fa-sun text-amber-400' : 'fa-moon'} text-lg`}></i>
                        </button>
                    </div>
                </header>

                {/* Dynamic Content Area with Page Transitions */}
                <div id="main-scroll-container" className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 pb-28 md:pb-12 relative z-0 custom-scrollbar scroll-smooth pt-4">
                    {children}
                </div>
            </main>
        </div>
    );
};
