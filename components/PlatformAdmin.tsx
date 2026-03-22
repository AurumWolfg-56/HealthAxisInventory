import React, { useState, useEffect, useCallback } from 'react';
import { useTenant, Organization, ClinicLocation } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';
import { MODULE_FLAGS, FEATURE_FLAGS, FeatureFlagKey, DEFAULT_FEATURE_FLAGS } from '../utils/featureFlags';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://tnwahbelwnhqevbgykxo.supabase.co';
const SUPABASE_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

// Human-readable labels for feature flags
const FLAG_LABELS: Record<string, { label: string; icon: string; desc: string }> = {
    mod_dashboard:     { label: 'Dashboard',       icon: 'fa-chart-pie',          desc: 'Main analytics dashboard' },
    mod_protocols:     { label: 'Staff Hub',        icon: 'fa-book-medical',       desc: 'Protocols & training materials' },
    mod_inventory:     { label: 'Inventory',        icon: 'fa-boxes-stacked',      desc: 'Item tracking & stock levels' },
    mod_intelligence:  { label: 'Intelligence',     icon: 'fa-brain',              desc: 'AI-powered analytics' },
    mod_orders:        { label: 'Orders',           icon: 'fa-cart-shopping',      desc: 'Purchase order management' },
    mod_budgets:       { label: 'Budgets',          icon: 'fa-wallet',             desc: 'Financial planning' },
    mod_pricelist:     { label: 'Price List',       icon: 'fa-tags',               desc: 'Item pricing management' },
    mod_billing:       { label: 'Billing Wizard',   icon: 'fa-file-invoice-dollar',desc: 'Clinical billing & coding' },
    mod_medical_codes: { label: 'Medical Codes',    icon: 'fa-list-ol',            desc: 'ICD-10 & CPT code lookup' },
    mod_forms:         { label: 'Forms',            icon: 'fa-file-signature',     desc: 'Document generation' },
    mod_voice_memos:   { label: 'Voice Memos',      icon: 'fa-microphone-lines',   desc: 'Audio dictation & notes' },
    mod_daily_close:   { label: 'Daily Close',      icon: 'fa-calendar-check',     desc: 'End-of-day reporting' },
    mod_reports:       { label: 'Reports',          icon: 'fa-clipboard-list',     desc: 'Report generation' },
    mod_petty_cash:    { label: 'Petty Cash',       icon: 'fa-vault',              desc: 'Cash management' },
    mod_scanner:       { label: 'Scanner',          icon: 'fa-barcode',            desc: 'Barcode scanning' },
    feat_pdf_export:   { label: 'PDF Export',       icon: 'fa-file-pdf',           desc: 'Export documents as PDF' },
    feat_budget_autoroll: { label: 'Budget Auto-Roll', icon: 'fa-rotate',          desc: 'Automatic budget rollover' },
    feat_ai_dictation: { label: 'AI Dictation',     icon: 'fa-robot',              desc: 'AI-powered voice transcription' },
    feat_ai_clinical_assist: { label: 'AI Clinical', icon: 'fa-wand-magic-sparkles', desc: 'AI clinical assistance' },
    feat_multi_lang:   { label: 'Multi-Language',   icon: 'fa-language',           desc: 'Multilingual interface support' },
};

interface EditingLocation {
    id?: string;
    name: string;
    slug: string;
    address: string;
    phone: string;
    email: string;
    timezone: string;
    logo_url: string;
    primary_color: string;
    is_active: boolean;
}

export const PlatformAdmin: React.FC = () => {
    const { currentOrg, currentLocation, userLocations } = useTenant();
    const { accessToken } = useAuth();
    const [orgLocations, setOrgLocations] = useState<ClinicLocation[]>([]);
    const [activeSection, setActiveSection] = useState<'org' | 'locations' | 'flags'>('org');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [editingOrg, setEditingOrg] = useState<{ name: string; logo_url: string; primary_color: string } | null>(null);
    const [editingLoc, setEditingLoc] = useState<EditingLocation | null>(null);
    const [flagsLocation, setFlagsLocation] = useState<ClinicLocation | null>(null);
    const [localFlags, setLocalFlags] = useState<Record<string, boolean>>({});

    const headers = useCallback(() => ({
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    }), [accessToken]);

    // Fetch all locations for current org
    const fetchLocations = useCallback(async () => {
        if (!currentOrg || !accessToken) return;
        setLoading(true);
        try {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/clinic_locations?organization_id=eq.${currentOrg.id}&order=name.asc`,
                { headers: headers() }
            );
            if (res.ok) {
                const data = await res.json();
                setOrgLocations(data);
                // If flagsLocation was selected, refresh it
                if (flagsLocation) {
                    const updated = data.find((l: ClinicLocation) => l.id === flagsLocation.id);
                    if (updated) {
                        setFlagsLocation(updated);
                        setLocalFlags({ ...DEFAULT_FEATURE_FLAGS, ...(updated.feature_flags || {}) });
                    }
                }
            }
        } catch (e) {
            console.error('Failed to fetch locations:', e);
        } finally {
            setLoading(false);
        }
    }, [currentOrg, accessToken, headers, flagsLocation]);

    useEffect(() => {
        fetchLocations();
    }, [currentOrg, accessToken]);

    useEffect(() => {
        if (successMsg) {
            const t = setTimeout(() => setSuccessMsg(null), 3000);
            return () => clearTimeout(t);
        }
    }, [successMsg]);

    // Initialize flags editor
    useEffect(() => {
        if (currentLocation && !flagsLocation) {
            setFlagsLocation(currentLocation);
            setLocalFlags({ ...DEFAULT_FEATURE_FLAGS, ...(currentLocation.feature_flags || {}) });
        }
    }, [currentLocation]);

    // --- SAVE HANDLERS ---

    const saveOrg = async () => {
        if (!editingOrg || !currentOrg) return;
        setSaving(true);
        try {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/organizations?id=eq.${currentOrg.id}`,
                { method: 'PATCH', headers: headers(), body: JSON.stringify(editingOrg) }
            );
            if (!res.ok) throw new Error(await res.text());
            setSuccessMsg('Organization updated');
            setEditingOrg(null);
            // Reload page to refresh TenantContext
            window.location.reload();
        } catch (e: any) {
            alert('Error: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const saveLoc = async () => {
        if (!editingLoc || !currentOrg) return;
        setSaving(true);
        try {
            if (editingLoc.id) {
                // Update existing
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/clinic_locations?id=eq.${editingLoc.id}`,
                    { method: 'PATCH', headers: headers(), body: JSON.stringify({
                        name: editingLoc.name,
                        slug: editingLoc.slug,
                        address: editingLoc.address || null,
                        phone: editingLoc.phone || null,
                        email: editingLoc.email || null,
                        timezone: editingLoc.timezone,
                        logo_url: editingLoc.logo_url || null,
                        primary_color: editingLoc.primary_color || null,
                        is_active: editingLoc.is_active,
                    })}
                );
                if (!res.ok) throw new Error(await res.text());
            } else {
                // Create new
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/clinic_locations`,
                    { method: 'POST', headers: headers(), body: JSON.stringify({
                        organization_id: currentOrg.id,
                        name: editingLoc.name,
                        slug: editingLoc.slug,
                        address: editingLoc.address || null,
                        phone: editingLoc.phone || null,
                        email: editingLoc.email || null,
                        timezone: editingLoc.timezone,
                        logo_url: editingLoc.logo_url || null,
                        primary_color: editingLoc.primary_color || null,
                        is_active: editingLoc.is_active,
                        feature_flags: DEFAULT_FEATURE_FLAGS,
                    })}
                );
                if (!res.ok) throw new Error(await res.text());
            }
            setSuccessMsg(editingLoc.id ? 'Location updated' : 'Location created');
            setEditingLoc(null);
            fetchLocations();
        } catch (e: any) {
            alert('Error: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const saveFlags = async () => {
        if (!flagsLocation) return;
        setSaving(true);
        try {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/clinic_locations?id=eq.${flagsLocation.id}`,
                { method: 'PATCH', headers: headers(), body: JSON.stringify({ feature_flags: localFlags }) }
            );
            if (!res.ok) throw new Error(await res.text());
            setSuccessMsg('Feature flags saved');
            fetchLocations();
        } catch (e: any) {
            alert('Error: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleFlag = (key: string) => {
        setLocalFlags(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const newLocation = (): EditingLocation => ({
        name: '', slug: '', address: '', phone: '', email: '',
        timezone: 'America/New_York', logo_url: '', primary_color: '', is_active: true,
    });

    const editLocation = (loc: ClinicLocation): EditingLocation => ({
        id: loc.id,
        name: loc.name,
        slug: loc.slug,
        address: loc.address || '',
        phone: loc.phone || '',
        email: loc.email || '',
        timezone: loc.timezone,
        logo_url: loc.logo_url || '',
        primary_color: loc.primary_color || '',
        is_active: loc.is_active,
    });

    const moduleFlags = Object.values(MODULE_FLAGS);
    const featureFlags = Object.values(FEATURE_FLAGS);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Success Toast */}
            {successMsg && (
                <div className="fixed top-6 right-6 z-50 animate-fade-in">
                    <div className="bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
                        <i className="fa-solid fa-check-circle text-lg"></i>
                        <span className="font-bold text-sm">{successMsg}</span>
                    </div>
                </div>
            )}

            {/* Section Tabs */}
            <div className="flex flex-wrap gap-2">
                {[
                    { key: 'org', label: 'Organization', icon: 'fa-building' },
                    { key: 'locations', label: 'Locations', icon: 'fa-location-dot' },
                    { key: 'flags', label: 'Feature Flags', icon: 'fa-toggle-on' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveSection(tab.key as any)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                            activeSection === tab.key
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                                : 'bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-white border border-slate-200 dark:border-slate-700'
                        }`}
                    >
                        <i className={`fa-solid ${tab.icon} mr-2`}></i>{tab.label}
                    </button>
                ))}
            </div>

            {/* ═══ SECTION A: Organization ═══ */}
            {activeSection === 'org' && currentOrg && (
                <div className="glass-panel rounded-[2rem] overflow-hidden border border-slate-100 dark:border-slate-800">
                    <div className="p-8 bg-gradient-to-r from-indigo-600 to-purple-700 text-white relative overflow-hidden">
                        <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/5 rounded-full blur-3xl"></div>
                        <div className="flex items-center gap-5 relative z-10">
                            {currentOrg.logo_url ? (
                                <img src={currentOrg.logo_url} alt="" className="w-16 h-16 rounded-2xl object-contain bg-white/10 p-2" />
                            ) : (
                                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-black">{currentOrg.name.charAt(0)}</div>
                            )}
                            <div>
                                <h3 className="text-2xl font-black tracking-tight">{currentOrg.name}</h3>
                                <p className="text-indigo-200 text-sm font-mono mt-1">/{currentOrg.slug}</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-8 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                                <p className="text-3xl font-black text-indigo-600">{orgLocations.length}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Locations</p>
                            </div>
                            <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                                <p className="text-3xl font-black text-emerald-600">{userLocations.length}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">User Assignments</p>
                            </div>
                            <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                                <p className="text-3xl font-black text-amber-600">{currentOrg.is_active ? '●' : '○'}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{currentOrg.is_active ? 'Active' : 'Inactive'}</p>
                            </div>
                        </div>
                        
                        {!editingOrg ? (
                            <button onClick={() => setEditingOrg({ name: currentOrg.name, logo_url: currentOrg.logo_url || '', primary_color: currentOrg.primary_color || '#0ea5e9' })}
                                className="px-6 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-black rounded-xl text-xs uppercase tracking-widest hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
                                <i className="fa-solid fa-pen mr-2"></i>Edit Organization
                            </button>
                        ) : (
                            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl space-y-4 border border-slate-200 dark:border-slate-700">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Organization Name</label>
                                    <input type="text" value={editingOrg.name} onChange={e => setEditingOrg({ ...editingOrg, name: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none focus:border-indigo-500 dark:text-white" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logo URL</label>
                                    <input type="text" value={editingOrg.logo_url} onChange={e => setEditingOrg({ ...editingOrg, logo_url: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none focus:border-indigo-500 dark:text-white" placeholder="/logo.png" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Color</label>
                                    <div className="flex gap-3 items-center">
                                        <input type="color" value={editingOrg.primary_color} onChange={e => setEditingOrg({ ...editingOrg, primary_color: e.target.value })}
                                            className="w-12 h-10 rounded-lg cursor-pointer border-0" />
                                        <input type="text" value={editingOrg.primary_color} onChange={e => setEditingOrg({ ...editingOrg, primary_color: e.target.value })}
                                            className="flex-1 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-sm outline-none dark:text-white" />
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setEditingOrg(null)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-xl text-xs uppercase tracking-widest">Cancel</button>
                                    <button onClick={saveOrg} disabled={saving} className="flex-1 py-3 bg-indigo-600 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg disabled:opacity-50">
                                        {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Save'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ SECTION B: Locations ═══ */}
            {activeSection === 'locations' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <p className="text-xs font-bold text-slate-400">{orgLocations.length} location{orgLocations.length !== 1 ? 's' : ''} in {currentOrg?.name}</p>
                        <button onClick={() => setEditingLoc(newLocation())}
                            className="px-5 py-2.5 bg-indigo-600 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform">
                            <i className="fa-solid fa-plus mr-2"></i>New Location
                        </button>
                    </div>

                    {loading ? (
                        <div className="text-center py-20"><i className="fa-solid fa-spinner fa-spin text-indigo-500 text-3xl"></i></div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {orgLocations.map(loc => (
                                <div key={loc.id} className={`glass-panel rounded-2xl p-6 border transition-all hover:shadow-md ${
                                    currentLocation?.id === loc.id ? 'border-indigo-300 dark:border-indigo-600 ring-2 ring-indigo-500/10' : 'border-slate-100 dark:border-slate-800'
                                } ${!loc.is_active ? 'opacity-50' : ''}`}>
                                    <div className="flex items-start gap-4">
                                        {loc.logo_url ? (
                                            <img src={loc.logo_url} alt="" className="w-12 h-12 rounded-xl object-contain bg-slate-50 dark:bg-slate-800 p-1" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-medical-500/20 to-blue-500/20 flex items-center justify-center text-medical-600 dark:text-medical-400 text-xl font-black">{loc.name.charAt(0)}</div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-black text-slate-900 dark:text-white truncate">{loc.name}</h4>
                                                {currentLocation?.id === loc.id && (
                                                    <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[9px] font-black uppercase rounded-md">Active</span>
                                                )}
                                            </div>
                                            <p className="text-xs font-mono text-slate-400 mt-0.5">/{loc.slug}</p>
                                            {loc.address && <p className="text-xs text-slate-500 mt-2"><i className="fa-solid fa-map-pin mr-1 text-medical-500"></i>{loc.address}</p>}
                                            {loc.phone && <p className="text-xs text-slate-500 mt-1"><i className="fa-solid fa-phone mr-1 text-medical-500"></i>{loc.phone}</p>}
                                            <div className="flex gap-2 mt-3">
                                                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[9px] font-bold uppercase rounded-lg">
                                                    <i className="fa-solid fa-clock mr-1"></i>{loc.timezone}
                                                </span>
                                                <span className={`px-2 py-1 text-[9px] font-bold uppercase rounded-lg ${loc.is_active ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-red-50 dark:bg-red-900/20 text-red-500'}`}>
                                                    {loc.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                        </div>
                                        <button onClick={() => setEditingLoc(editLocation(loc))}
                                            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center shrink-0">
                                            <i className="fa-solid fa-pen-to-square"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═══ SECTION C: Feature Flags ═══ */}
            {activeSection === 'flags' && (
                <div className="space-y-6">
                    {/* Location selector for flags */}
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                        <div>
                            <h4 className="font-black text-slate-900 dark:text-white">Feature Flags</h4>
                            <p className="text-xs text-slate-500 mt-1">Toggle modules and features per location</p>
                        </div>
                        <select
                            value={flagsLocation?.id || ''}
                            onChange={(e) => {
                                const loc = orgLocations.find(l => l.id === e.target.value);
                                if (loc) {
                                    setFlagsLocation(loc);
                                    setLocalFlags({ ...DEFAULT_FEATURE_FLAGS, ...(loc.feature_flags || {}) });
                                }
                            }}
                            className="px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none focus:ring-2 ring-indigo-500/20 dark:text-white min-w-[200px]"
                        >
                            {orgLocations.map(l => (
                                <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Module Flags Grid */}
                    <div>
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mb-3">Modules</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {moduleFlags.map(key => {
                                const meta = FLAG_LABELS[key] || { label: key, icon: 'fa-puzzle-piece', desc: '' };
                                const enabled = localFlags[key] ?? true;
                                return (
                                    <button key={key} onClick={() => toggleFlag(key)}
                                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group ${
                                            enabled
                                                ? 'bg-white dark:bg-slate-800 border-emerald-200 dark:border-emerald-800/50 shadow-sm'
                                                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-60'
                                        }`}>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                                            enabled ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                                        }`}>
                                            <i className={`fa-solid ${meta.icon}`}></i>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-sm text-slate-800 dark:text-white truncate">{meta.label}</p>
                                            <p className="text-[10px] text-slate-400 truncate">{meta.desc}</p>
                                        </div>
                                        <div className={`w-12 h-7 rounded-full flex items-center p-1 transition-all shrink-0 ${
                                            enabled ? 'bg-emerald-500 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'
                                        }`}>
                                            <div className="w-5 h-5 bg-white rounded-full shadow-md transition-all"></div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Sub-Feature Flags */}
                    <div>
                        <p className="text-[10px] font-black text-purple-500 uppercase tracking-[0.3em] mb-3">Sub-Features</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {featureFlags.map(key => {
                                const meta = FLAG_LABELS[key] || { label: key, icon: 'fa-puzzle-piece', desc: '' };
                                const enabled = localFlags[key] ?? false;
                                return (
                                    <button key={key} onClick={() => toggleFlag(key)}
                                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                                            enabled
                                                ? 'bg-white dark:bg-slate-800 border-purple-200 dark:border-purple-800/50 shadow-sm'
                                                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-60'
                                        }`}>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                                            enabled ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                                        }`}>
                                            <i className={`fa-solid ${meta.icon}`}></i>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-sm text-slate-800 dark:text-white truncate">{meta.label}</p>
                                            <p className="text-[10px] text-slate-400 truncate">{meta.desc}</p>
                                        </div>
                                        <div className={`w-12 h-7 rounded-full flex items-center p-1 transition-all shrink-0 ${
                                            enabled ? 'bg-purple-500 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'
                                        }`}>
                                            <div className="w-5 h-5 bg-white rounded-full shadow-md transition-all"></div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Save Flags */}
                    <button onClick={saveFlags} disabled={saving}
                        className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black rounded-2xl uppercase text-xs tracking-widest shadow-xl hover:shadow-indigo-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
                        {saving ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i>Saving...</> : <><i className="fa-solid fa-floppy-disk mr-2"></i>Save Feature Flags</>}
                    </button>
                </div>
            )}

            {/* ═══ EDIT LOCATION MODAL ═══ */}
            {editingLoc && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-panel w-full max-w-lg p-8 rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-slate-700 animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">{editingLoc.id ? 'Edit Location' : 'New Location'}</h3>
                            <button onClick={() => setEditingLoc(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                                <i className="fa-solid fa-xmark text-xl"></i>
                            </button>
                        </div>
                        <div className="space-y-4">
                            {[
                                { key: 'name', label: 'Clinic Name', placeholder: 'e.g. Immediate Care Plus - Orlando', type: 'text' },
                                { key: 'slug', label: 'Slug', placeholder: 'e.g. immediate-care-plus-orlando', type: 'text' },
                                { key: 'address', label: 'Address', placeholder: '123 Main St, Orlando, FL', type: 'text' },
                                { key: 'phone', label: 'Phone', placeholder: '(407) 555-0123', type: 'tel' },
                                { key: 'email', label: 'Email', placeholder: 'contact@clinic.com', type: 'email' },
                                { key: 'logo_url', label: 'Logo URL', placeholder: '/icp-logo.png or https://...', type: 'text' },
                                { key: 'timezone', label: 'Timezone', placeholder: 'America/New_York', type: 'text' },
                            ].map(field => (
                                <div key={field.key} className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{field.label}</label>
                                    <input type={field.type} placeholder={field.placeholder}
                                        value={(editingLoc as any)[field.key]}
                                        onChange={e => setEditingLoc({ ...editingLoc, [field.key]: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none focus:border-indigo-500 dark:text-white" />
                                </div>
                            ))}
                            <div className="flex items-center gap-3 pt-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active</label>
                                <button onClick={() => setEditingLoc({ ...editingLoc, is_active: !editingLoc.is_active })}
                                    className={`w-14 h-8 rounded-full flex items-center p-1 transition-all ${editingLoc.is_active ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'}`}>
                                    <div className="w-6 h-6 bg-white rounded-full shadow-md"></div>
                                </button>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setEditingLoc(null)} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-xl text-xs uppercase tracking-widest">Cancel</button>
                                <button onClick={saveLoc} disabled={saving || !editingLoc.name || !editingLoc.slug}
                                    className="flex-1 py-3.5 bg-indigo-600 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg disabled:opacity-50">
                                    {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : editingLoc.id ? 'Save Changes' : 'Create Location'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
