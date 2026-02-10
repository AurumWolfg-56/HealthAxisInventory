import React, { useState } from 'react';
import { supabase } from '../src/lib/supabase';
import { UserRole } from '../types';

interface OrphanedRole {
    user_id: string;
    role_id: UserRole;
    created_at?: string;
}

export const DataRepair: React.FC = () => {
    const [orphans, setOrphans] = useState<OrphanedRole[]>([]);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string>('');
    const [scanned, setScanned] = useState(false);

    const scan = async () => {
        setLoading(true);
        setStatus('Scanning database...');
        try {
            // Fetch all roles
            const { data: roles, error: roleError } = await supabase.from('user_roles').select('*');
            if (roleError) throw roleError;

            // Fetch all profiles
            const { data: profiles, error: profileError } = await supabase.from('profiles').select('id');
            if (profileError) throw profileError;

            const profileIds = new Set(profiles?.map(p => p.id));
            const foundOrphans = roles?.filter(r => !profileIds.has(r.user_id)) || [];

            setOrphans(foundOrphans.map(o => ({
                user_id: o.user_id,
                role_id: o.role_id,
                created_at: o.created_at
            })));
            setStatus(`Scan complete. Found ${foundOrphans.length} orphaned roles.`);
            setScanned(true);
        } catch (e: any) {
            setStatus(`Scan failed: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const fixOrphan = async (orphan: OrphanedRole) => {
        try {
            // Create a profile for this user
            const { error } = await supabase.from('profiles').insert({
                id: orphan.user_id,
                full_name: `Restored User (${orphan.role_id})`,
                permissions: [] // Default permissions
            });

            if (error) throw error;

            // Remove from list
            setOrphans(prev => prev.filter(o => o.user_id !== orphan.user_id));
            setStatus(`Successfully restored profile for user ${orphan.user_id}`);
        } catch (e: any) {
            alert(`Failed to fix: ${e.message}`);
        }
    };

    const fixAll = async () => {
        if (!confirm(`Are you sure you want to restore ${orphans.length} profiles?`)) return;
        setLoading(true);
        let successCount = 0;

        for (const orphan of orphans) {
            try {
                const { error } = await supabase.from('profiles').insert({
                    id: orphan.user_id,
                    full_name: `Restored User (${orphan.role_id})`,
                    permissions: []
                });
                if (!error) successCount++;
            } catch (e) {
                console.error(e);
            }
        }

        setLoading(false);
        setStatus(`Batch restore complete. restored ${successCount} profiles.`);
        scan(); // Rescan
    };

    return (
        <div className="p-6 border border-amber-200 rounded-3xl bg-amber-50 dark:bg-amber-900/10 space-y-4 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <i className="fa-solid fa-user-doctor"></i>
                    </div>
                    <div>
                        <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Provider Data Repair</h3>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Detect and fix missing user profiles for assigned roles</p>
                    </div>
                </div>
                <button
                    onClick={scan}
                    disabled={loading}
                    className="px-5 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm hover:shadow-md transition-all active:scale-95 border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                >
                    {loading ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : <i className="fa-solid fa-magnifying-glass mr-2"></i>}
                    {loading ? 'Scanning...' : 'Scan Database'}
                </button>
            </div>

            {status && (
                <div className={`text-xs font-bold px-4 py-2 rounded-lg ${status.includes('fail') ? 'bg-red-100 text-red-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                    {status}
                </div>
            )}

            {orphans.length > 0 && (
                <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-red-500">
                            <i className="fa-solid fa-triangle-exclamation mr-1"></i>
                            {orphans.length} Issues Found
                        </p>
                        <button onClick={fixAll} className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:underline">
                            Fix All
                        </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                        {orphans.map(o => (
                            <div key={o.user_id} className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-amber-100 dark:border-amber-900/20 shadow-sm">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${o.role_id === 'DOCTOR' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                                            {o.role_id}
                                        </span>
                                        <span className="text-xs font-mono text-slate-400">{o.user_id.substring(0, 8)}...</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => fixOrphan(o)}
                                    className="text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg font-black hover:bg-indigo-100 dark:hover:bg-indigo-900/40 uppercase tracking-wide transition-colors"
                                >
                                    Restore
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {scanned && orphans.length === 0 && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl flex items-center gap-3">
                    <i className="fa-solid fa-circle-check text-emerald-500 text-lg"></i>
                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">System Healthy: No orphaned roles found.</span>
                </div>
            )}
        </div>
    );
};
