import React, { useState } from 'react';
import { User, AppRoute, Permission } from '../types';
import { useAuth } from '../contexts/AuthContext';
import Logo from './Logo';

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
    const { user, hasPermission, signOut } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

    const NAV_ITEMS = [
        { route: AppRoute.DASHBOARD, icon: "fa-chart-pie", label: t('nav_dashboard') },
        { route: AppRoute.INVENTORY, icon: "fa-boxes-stacked", label: t('nav_inventory'), perm: 'inventory.view' },
        { route: AppRoute.ORDERS, icon: "fa-cart-shopping", label: t('nav_orders'), perm: 'orders.view' },
        { route: AppRoute.PRICELIST, icon: "fa-tags", label: t('nav_prices'), perm: 'prices.view' },
        { header: "Clinical" },
        { route: AppRoute.BILLING_WIZARD, icon: "fa-file-invoice-dollar", label: t('nav_billing'), perm: 'billing.view' },
        { route: AppRoute.MEDICAL_CODES, icon: "fa-list-ol", label: "Medical Codes", perm: 'codes.view' },
        { route: AppRoute.FORMS, icon: "fa-file-signature", label: "Forms", perm: 'forms.generate' },
        { route: AppRoute.VOICE_MEMOS, icon: "fa-microphone-lines", label: t('nav_voice') },
        { header: "Admin" },
        { route: AppRoute.ADMIN, icon: "fa-shield-halved", label: t('nav_admin'), perm: 'admin.access' },
        { route: AppRoute.REPORTS, icon: "fa-clipboard-list", label: t('nav_reports'), perm: 'reports.view' },
        { route: AppRoute.DAILY_HISTORY, icon: "fa-calendar-check", label: t('nav_daily'), perm: 'reports.create' },
        { route: AppRoute.PETTY_CASH, icon: "fa-vault", label: "Petty Cash", perm: 'finance.view' },
        { route: AppRoute.SETTINGS, icon: "fa-gear", label: t('nav_settings') },
    ];

    const NavContent = () => (
        <nav className="flex-1 px-4 space-y-1.5 mt-2 custom-scrollbar overflow-y-auto pb-safe">
            {NAV_ITEMS.map((item: any, idx) => {
                if (item.header) return <div key={idx} className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-6 py-2 mt-4 mb-1 opacity-70">{item.header}</div>;
                if (item.perm && !hasPermission(item.perm as Permission)) return null;

                const isActive = currentRoute === item.route;
                return (
                    <button
                        key={idx}
                        onClick={() => handleNavigateWrapper(item.route as AppRoute)}
                        className={`group relative flex items-center gap-4 px-5 py-3.5 w-full rounded-2xl transition-all duration-300 active:scale-95 outline-none
                          ${isActive
                                ? 'bg-gradient-to-r from-medical-600/10 to-medical-500/5 text-medical-600 dark:text-medical-400 font-bold'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'}`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${isActive ? 'bg-medical-500 text-white shadow-lg shadow-medical-500/30 scale-110' : 'bg-transparent group-hover:bg-slate-200 dark:group-hover:bg-slate-700'}`}>
                            <i className={`fa-solid ${item.icon} text-lg`}></i>
                        </div>
                        <span className="text-sm font-bold tracking-wide">{item.label}</span>
                        {isActive && <div className="absolute right-0 h-8 w-1 bg-medical-500 rounded-l-full shadow-[0_0_10px_rgba(20,184,166,0.5)]"></div>}
                    </button>
                );
            })}
        </nav>
    );

    return (
        <div className={`min-h-screen flex transition-colors duration-500 font-sans selection:bg-medical-500/20 selection:text-medical-600 overflow-hidden relative bg-medical-50 dark:bg-[#0a0f18]`}>
            {/* === MOBILE SIDEBAR DRAWER === */}
            <div
                className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            >
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
                <div className={`absolute top-0 bottom-0 left-0 w-[85%] max-w-[320px] bg-white/90 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl border-r border-white/20 dark:border-slate-800 transition-transform duration-300 ease-out flex flex-col pt-safe pb-safe ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="p-6 pb-2 flex justify-between items-center">
                        <Logo className="w-8 h-8" classNameText="text-xl" />
                        <button onClick={() => setIsMobileMenuOpen(false)} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center">
                            <i className="fa-solid fa-chevron-left"></i>
                        </button>
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
                    <NavContent />
                </div>
            </div>

            {/* === DESKTOP FLOATING DOCK SIDEBAR === */}
            <aside className={`hidden md:flex flex-col w-80 h-screen sticky top-0 z-40 transition-all duration-500 ${!isSidebarOpen ? '-ml-80 opacity-0' : ''}`}>
                <div className="h-[96%] m-4 rounded-[2.5rem] bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/40 dark:border-slate-800/60 shadow-glass flex flex-col relative overflow-hidden ring-1 ring-white/50 dark:ring-white/5">
                    <div className="p-8 pb-4 flex items-center gap-3 z-10">
                        <Logo className="w-10 h-10" classNameText="text-2xl" />
                    </div>
                    <NavContent />
                    <div className="p-4 z-10">
                        <div className="p-4 rounded-[1.5rem] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/50 border border-slate-200 dark:border-slate-700/50 shadow-sm relative overflow-hidden group">
                            <div className="flex items-center gap-3 mb-3 relative z-10">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-medical-500 to-teal-400 flex items-center justify-center text-white shadow-lg font-bold text-sm">
                                    {user.username.charAt(0).toUpperCase()}
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{user.username}</p>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{user.role}</p>
                                </div>
                            </div>
                            <button onClick={handleSignOut} className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-red-500 hover:text-white hover:bg-red-500 rounded-xl transition-all relative z-10 active:scale-[0.99]">
                                <i className="fa-solid fa-right-from-bracket"></i> {t('nav_signout')}
                            </button>
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
                        <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-full border border-white/40 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-default">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 tracking-wide uppercase">{t('system_online')}</span>
                        </div>

                        <button onClick={toggleTheme} className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-700 backdrop-blur-md transition-all border border-white/40 dark:border-slate-700 shadow-sm hover:shadow-lg active:scale-90">
                            <i className={`fa-solid ${isDarkMode ? 'fa-sun text-amber-400' : 'fa-moon'} text-lg`}></i>
                        </button>
                    </div>
                </header>

                {/* Dynamic Content Area with Page Transitions */}
                <div className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 pb-28 md:pb-12 relative z-0 custom-scrollbar scroll-smooth pt-4">
                    <div key={currentRoute} className="max-w-[1600px] mx-auto print:max-w-none animate-fade-in-up">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
};
