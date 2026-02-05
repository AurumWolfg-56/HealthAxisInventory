
import React, { useState, useEffect } from 'react';
import { UserRole, RoleConfig, Permission } from '../types';
import { supabase } from '../src/lib/supabase';

interface AdminProps {
    roleConfigs: RoleConfig[];
    onUpdateRoleConfig: (role: UserRole, permission: Permission) => void;
    currentUser: any;
    t: (key: string) => string;
}

interface DBUser {
    id: string;
    full_name: string;
    email: string;
    role: UserRole;
    permissions?: Permission[];
}

const ALL_PERMISSIONS: { id: Permission; label: string; category: string }[] = [
    { id: 'inventory.view', label: 'View Inventory', category: 'Inventory' },
    { id: 'inventory.edit', label: 'Add/Edit Items', category: 'Inventory' },
    { id: 'inventory.audit', label: 'Audit Stock', category: 'Inventory' },
    { id: 'orders.view', label: 'View Orders', category: 'Purchasing' },
    { id: 'orders.create', label: 'Create Orders', category: 'Purchasing' },
    { id: 'orders.receive', label: 'Receive Orders', category: 'Purchasing' },
    { id: 'prices.view', label: 'View Price List', category: 'Finance' },
    { id: 'prices.manage', label: 'Edit Prices', category: 'Finance' },
    { id: 'reports.view', label: 'View Reports', category: 'Analytics' },
    { id: 'reports.create', label: 'Daily Close', category: 'Analytics' },
    { id: 'billing.view', label: 'View Billing', category: 'Finance' },
    { id: 'codes.view', label: 'View Codes', category: 'Clinical' },
    { id: 'codes.manage', label: 'Manage Codes', category: 'Clinical' },
    { id: 'forms.generate', label: 'Generate Forms', category: 'Clinical' },
    { id: 'forms.manage', label: 'Manage Templates', category: 'Clinical' },
    { id: 'finance.view', label: 'View Petty Cash', category: 'Finance' },
    { id: 'finance.manage', label: 'Manage Petty Cash', category: 'Finance' },
    { id: 'admin.access', label: 'Access Admin Panel', category: 'System' },
];

const EDITABLE_ROLES = [UserRole.DOCTOR, UserRole.MA, UserRole.FRONT_DESK];

const Admin: React.FC<AdminProps> = ({ roleConfigs, onUpdateRoleConfig, currentUser, t }) => {
    const [users, setUsers] = useState<DBUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviting, setInviting] = useState(false);
    const [inviteData, setInviteData] = useState({ email: '', full_name: '', role: UserRole.MA });
    const [activeTab, setActiveTab] = useState<'users' | 'permissions'>('users');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingUser, setEditingUser] = useState<DBUser | null>(null);
    const [permissionMode, setPermissionMode] = useState<'role' | 'user'>('role');
    const [selectedUserForPerms, setSelectedUserForPerms] = useState<string | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data: profiles, error: pError } = await supabase
                .from('profiles')
                .select('id, full_name, permissions, user_roles(role_id)');

            if (pError) throw pError;

            const formattedUsers: DBUser[] = (profiles || []).map((p: any) => ({
                id: p.id,
                full_name: p.full_name || 'Anonymous User',
                email: 'N/A',
                role: p.user_roles?.[0]?.role_id || UserRole.FRONT_DESK,
                permissions: p.permissions || undefined
            }));

            setUsers(formattedUsers);
        } catch (err: any) {
            console.error('Error fetching users:', err);
            // alert('Error loading users: ' + (err.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviting(true);
        try {
            const { data, error } = await supabase.functions.invoke('admin-api', {
                body: {
                    action: 'invite_user',
                    payload: {
                        email: inviteData.email,
                        full_name: inviteData.full_name,
                        role_id: inviteData.role,
                        redirectTo: window.location.origin
                    }
                }
            });

            if (error) {
                console.error('Admin API Error:', error);
                let errorMessage = error.message;
                // Robust parsing of context/body
                try {
                    if (error.context && typeof error.context.json === 'function') {
                        const body = await error.context.json();
                        if (body && body.error) errorMessage = body.error;
                    }
                } catch (e) {
                    // Ignore parsing errors
                }
                throw new Error(errorMessage);
            }

            if (data && data.error) {
                throw new Error(data.error);
            }

            alert('User invited successfully!');
            setInviteData({ email: '', full_name: '', role: UserRole.MA });
            fetchUsers();
        } catch (err: any) {
            alert('Error inviting user: ' + err.message);
        } finally {
            setInviting(false);
        }
    };

    const handleUpdateUser = async (userId: string, updates: { full_name: string; role: UserRole }) => {
        try {
            const { error: pError } = await supabase
                .from('profiles')
                .update({ full_name: updates.full_name })
                .eq('id', userId);

            if (pError) throw pError;

            const { error: rError } = await supabase
                .from('user_roles')
                .update({ role_id: updates.role })
                .eq('user_id', userId);

            if (rError) throw rError;

            setEditingUser(null);
            fetchUsers();
            alert('User updated successfully!');
        } catch (err: any) {
            alert('Error updating user: ' + err.message);
        }
    };

    const handleUpdateUserPermissions = async (userId: string, permission: Permission) => {
        const user = users.find(u => u.id === userId);
        if (!user) return;

        const currentPerms = user.permissions || [];
        let newPerms: Permission[];

        if (currentPerms.includes(permission)) {
            newPerms = currentPerms.filter(p => p !== permission);
        } else {
            newPerms = [...currentPerms, permission];
        }

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ permissions: newPerms.length > 0 ? newPerms : null })
                .eq('id', userId);

            if (error) throw error;
            fetchUsers();
        } catch (err: any) {
            alert('Error updating permissions: ' + err.message);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Are you sure you want to delete this user? This action is irreversible.')) return;
        try {
            const { data, error } = await supabase.functions.invoke('admin-api', {
                body: {
                    action: 'delete_user',
                    payload: { user_id: userId }
                }
            });

            if (error) {
                let errorMessage = error.message;
                try {
                    if (error.context && typeof error.context.json === 'function') {
                        const body = await error.context.json();
                        if (body && body.error) errorMessage = body.error;
                    }
                } catch (e) {
                    console.log('Error parsing response body', e);
                }
                throw new Error(errorMessage);
            }

            if (data && data.success === false) {
                const debugInfo = data.debug ? JSON.stringify(data.debug) : '';
                throw new Error(data.error || 'Unknown server error. ' + debugInfo);
            }

            fetchUsers();
            alert('User deleted successfully.');
        } catch (err: any) {
            console.error('Delete Error Detail:', err);
            alert(`Error deleting user: ${err.message || 'Unknown error'}`);
        }
    };

    const isChecked = (permId: Permission) => {
        if (permissionMode === 'role') {
            const config = roleConfigs.find(c => c.role === (inviteData.role as UserRole)); // Fallback or selected role
            return config?.permissions.includes(permId) || false;
        } else if (permissionMode === 'user' && selectedUserForPerms) {
            const user = users.find(u => u.id === selectedUserForPerms);
            if (user?.permissions) return user.permissions.includes(permId);
            // Fallback to role if no override
            const config = roleConfigs.find(c => c.role === user?.role);
            return config?.permissions.includes(permId) || false;
        }
        return false;
    };

    // Helper for global role matrix (original behavior)
    const isRoleChecked = (role: UserRole, perm: Permission) => {
        const config = roleConfigs.find(c => c.role === role);
        return config?.permissions.includes(perm) || false;
    };

    const filteredUsers = users.filter(u =>
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const permissionCategories = Array.from(new Set(ALL_PERMISSIONS.map(p => p.category)));

    return (
        <div className="space-y-8 pb-20 md:pb-10 animate-fade-in">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-medical-500 flex items-center justify-center shadow-lg shadow-medical-500/20">
                        <i className="fa-solid fa-gears text-xl text-white"></i>
                    </div>
                    <div>
                        <h2 className="text-display text-slate-900 dark:text-white">
                            System Administration
                        </h2>
                        <p className="text-caption mt-0.5">Control access, manage roles, and audit security.</p>
                    </div>
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm scale-[1.02]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <i className="fa-solid fa-users mr-2"></i> Personnel
                    </button>
                    <button
                        onClick={() => setActiveTab('permissions')}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'permissions' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm scale-[1.02]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <i className="fa-solid fa-shield-halved mr-2"></i> Permissions
                    </button>
                </div>
            </header>

            {activeTab === 'users' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* User List Panel */}
                    <div className="lg:col-span-8 space-y-4">
                        <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <i className="fa-solid fa-magnifying-glass text-slate-400 ml-2"></i>
                            <input
                                type="text"
                                placeholder="Search personnel by name or ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-transparent border-none outline-none w-full font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                            />
                        </div>

                        <div className="glass-panel rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800">
                            <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/50 dark:bg-slate-900/50 sticky top-0 z-10 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
                                        <tr>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Personnel</th>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Role & Status</th>
                                            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Settings</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                        {loading ? (
                                            <tr><td colSpan={3} className="p-20 text-center"><i className="fa-solid fa-circle-notch fa-spin text-indigo-500 text-3xl"></i></td></tr>
                                        ) : filteredUsers.length === 0 ? (
                                            <tr><td colSpan={3} className="p-20 text-center text-slate-400 font-medium">No personnel found.</td></tr>
                                        ) : filteredUsers.map(u => (
                                            <tr key={u.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-all">
                                                <td className="p-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-inner
                                                            ${u.role === UserRole.OWNER ? 'bg-red-50 text-red-600 dark:bg-red-900/20' :
                                                                u.role === UserRole.MANAGER ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' :
                                                                    u.role === UserRole.DOCTOR ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' :
                                                                        'bg-slate-50 text-slate-600 dark:bg-slate-800'}
                                                        `}>
                                                            {u.full_name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-slate-900 dark:text-slate-100 leading-tight">{u.full_name}</p>
                                                            <p className="text-xs font-mono text-slate-400 mt-1 uppercase tracking-tight">ID: {u.id.substring(0, 8)}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-6">
                                                    <div className="flex flex-col gap-2">
                                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest w-fit
                                                            ${u.role === UserRole.OWNER ? 'bg-red-500 text-white' :
                                                                u.role === UserRole.MANAGER ? 'bg-blue-500 text-white' :
                                                                    u.role === UserRole.DOCTOR ? 'bg-emerald-500 text-white' :
                                                                        'bg-slate-600 text-white'}
                                                        `}>
                                                            {u.role.replace('_', ' ')}
                                                        </span>
                                                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 uppercase tracking-wide">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                            Active Session
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => setEditingUser(u)}
                                                            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-indigo-500 hover:text-white transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0"
                                                        >
                                                            <i className="fa-solid fa-pen-to-square"></i>
                                                        </button>
                                                        {u.id !== currentUser?.id && (
                                                            <button
                                                                onClick={() => handleDeleteUser(u.id)}
                                                                className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-red-500 hover:text-white transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0"
                                                            >
                                                                <i className="fa-solid fa-trash-can"></i>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Edit User Modal */}
                        {editingUser && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                                <div className="glass-panel w-full max-w-lg p-8 rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-slate-700 animate-scale-in">
                                    <div className="flex justify-between items-center mb-8">
                                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Modify Personnel</h3>
                                        <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                            <i className="fa-solid fa-xmark text-xl"></i>
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                            <input
                                                type="text"
                                                value={editingUser.full_name}
                                                onChange={e => setEditingUser({ ...editingUser, full_name: e.target.value })}
                                                className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 outline-none font-bold placeholder:text-slate-400 transition-all dark:text-white"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Role</label>
                                            <select
                                                value={editingUser.role}
                                                onChange={e => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                                                className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 outline-none font-black transition-all appearance-none cursor-pointer dark:text-white"
                                            >
                                                {Object.values(UserRole).map(r => (
                                                    <option key={r} value={r}>{r.replace('_', ' ')}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="pt-4 flex gap-4">
                                            <button
                                                onClick={() => setEditingUser(null)}
                                                className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black rounded-2xl transition-all hover:bg-slate-200 dark:hover:bg-slate-700 uppercase text-xs tracking-widest"
                                            >
                                                Discard
                                            </button>
                                            <button
                                                onClick={() => handleUpdateUser(editingUser.id, { full_name: editingUser.full_name, role: editingUser.role })}
                                                className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase text-xs tracking-widest"
                                            >
                                                Save Changes
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => {
                                                setPermissionMode('user');
                                                setSelectedUserForPerms(editingUser.id);
                                                setActiveTab('permissions');
                                                setEditingUser(null);
                                            }}
                                            className="w-full py-4 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 font-black rounded-2xl flex items-center justify-center gap-2 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/30 uppercase text-[10px] tracking-widest"
                                        >
                                            <i className="fa-solid fa-shield-halved"></i> Manage View/Edit Permissions
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Info & Invite */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="glass-panel p-8 rounded-[2.5rem] bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-xl border-none relative overflow-hidden">
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                            <h4 className="font-black mb-6 uppercase tracking-widest text-xs flex items-center gap-2">
                                <i className="fa-solid fa-paper-plane animate-bounce"></i>
                                New Personnel Invite
                            </h4>
                            <form onSubmit={handleInvite} className="space-y-4 group">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-indigo-200 uppercase tracking-widest ml-1">Full Legal Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={inviteData.full_name}
                                        onChange={e => setInviteData({ ...inviteData, full_name: e.target.value })}
                                        className="w-full px-5 py-4 rounded-2xl bg-white/10 border border-white/20 focus:bg-white/20 focus:border-white/40 outline-none font-bold text-sm placeholder:text-white/30 transition-all"
                                        placeholder="e.g. John Doe"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-indigo-200 uppercase tracking-widest ml-1">Professional Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={inviteData.email}
                                        onChange={e => setInviteData({ ...inviteData, email: e.target.value })}
                                        className="w-full px-5 py-4 rounded-2xl bg-white/10 border border-white/20 focus:bg-white/20 focus:border-white/40 outline-none font-bold text-sm placeholder:text-white/30 transition-all"
                                        placeholder="j.doe@clinic.com"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-indigo-200 uppercase tracking-widest ml-1">Assigned Role</label>
                                    <select
                                        value={inviteData.role}
                                        onChange={e => setInviteData({ ...inviteData, role: e.target.value as UserRole })}
                                        className="w-full px-5 py-4 rounded-2xl bg-white/10 border border-white/20 focus:bg-white/20 focus:border-white/40 outline-none font-black text-sm transition-all appearance-none cursor-pointer"
                                    >
                                        {Object.values(UserRole).map(r => (
                                            <option key={r} value={r} className="text-slate-900">{r.replace('_', ' ')}</option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    disabled={inviting}
                                    className="w-full py-5 bg-white text-indigo-600 font-black rounded-2xl shadow-lg hover:shadow-indigo-500/20 transition-all active:scale-[0.97] mt-4 uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-2"
                                >
                                    {inviting ? <i className="fa-solid fa-spinner fa-spin"></i> : (
                                        <>Deploy Invitation <i className="fa-solid fa-bolt"></i></>
                                    )}
                                </button>
                                <p className="text-[10px] text-indigo-100/60 text-center mt-6 font-medium leading-relaxed">
                                    Automated verification email will be dispatched immediately.
                                </p>
                            </form>
                        </div>


                    </div>
                </div>
            ) : (
                <div className="space-y-8 animate-fade-in-up">
                    <div className="flex items-center gap-4 bg-indigo-50 dark:bg-indigo-900/10 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-900/30">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
                            <i className="fa-solid fa-shield-check text-xl"></i>
                        </div>
                        <div>
                            <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Access Control Matrix</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Manage permissions either by broad roles or specific individual overrides.</p>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 w-full md:w-auto">
                            <button
                                onClick={() => setPermissionMode('role')}
                                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${permissionMode === 'role' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md scale-[1.02]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <i className="fa-solid fa-users-gear mr-2"></i> Global Roles
                            </button>
                            <button
                                onClick={() => setPermissionMode('user')}
                                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${permissionMode === 'user' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md scale-[1.02]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <i className="fa-solid fa-user-shield mr-2"></i> Individual Personnel
                            </button>
                        </div>

                        {permissionMode === 'user' && (
                            <div className="relative w-full md:w-80 animate-fade-in">
                                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                <select
                                    value={selectedUserForPerms || ''}
                                    onChange={(e) => setSelectedUserForPerms(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 ring-indigo-500/20 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">Select personnel to manage...</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="glass-panel p-1 rounded-[3rem] shadow-sm overflow-hidden border border-slate-100 dark:border-slate-800">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/50 dark:bg-slate-900 sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800">
                                    <tr>
                                        <th className="p-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] w-1/2">Module Permissions</th>
                                        {permissionMode === 'role' ? EDITABLE_ROLES.map(role => (
                                            <th key={role} className="p-8 text-center min-w-[140px]">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-md
                                                        ${role === UserRole.DOCTOR ? 'bg-emerald-500' : role === UserRole.MA ? 'bg-blue-500' : 'bg-purple-500'}
                                                    `}>
                                                        {role.charAt(0)}
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-900 dark:text-slate-200 uppercase tracking-widest">{role.replace('_', ' ')}</span>
                                                </div>
                                            </th>
                                        )) : (
                                            <th className="p-8 text-center min-w-[200px]">
                                                {selectedUserForPerms ? (
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-lg font-black shadow-md">
                                                            {users.find(u => u.id === selectedUserForPerms)?.full_name.charAt(0)}
                                                        </div>
                                                        <span className="text-[10px] font-black text-slate-900 dark:text-slate-200 uppercase tracking-widest">
                                                            Custom Access Overrides
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No User Selected</span>
                                                )}
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {permissionCategories.map(category => (
                                        <React.Fragment key={category}>
                                            <tr className="bg-slate-50 dark:bg-slate-800/20">
                                                <td colSpan={EDITABLE_ROLES.length + 1} className="p-4 px-8">
                                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em]">{category}</span>
                                                </td>
                                            </tr>
                                            {ALL_PERMISSIONS.filter(p => p.category === category).map((perm) => (
                                                <tr key={perm.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-all border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                                                    <td className="p-8">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                                                            <span className="font-bold text-slate-800 dark:text-slate-200 tracking-tight">{perm.label}</span>
                                                        </div>
                                                    </td>
                                                    {permissionMode === 'role' ? EDITABLE_ROLES.map(role => {
                                                        const active = isRoleChecked(role, perm.id);
                                                        return (
                                                            <td key={`${role}-${perm.id}`} className="p-8 text-center">
                                                                <label className="relative inline-flex items-center cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="sr-only peer"
                                                                        checked={active}
                                                                        onChange={() => onUpdateRoleConfig(role, perm.id)}
                                                                    />
                                                                    <div className="w-16 h-9 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-7 after:w-7 after:transition-all dark:border-slate-600 peer-checked:bg-gradient-to-r peer-checked:from-indigo-600 peer-checked:to-purple-600 shadow-inner"></div>
                                                                </label>
                                                            </td>
                                                        );
                                                    }) : (
                                                        <td className="p-8 text-center">
                                                            {selectedUserForPerms ? (
                                                                <label className="relative inline-flex items-center cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="sr-only peer"
                                                                        checked={isChecked(perm.id)}
                                                                        onChange={() => handleUpdateUserPermissions(selectedUserForPerms, perm.id)}
                                                                    />
                                                                    <div className="w-16 h-9 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-7 after:w-7 after:transition-all dark:border-slate-600 peer-checked:bg-gradient-to-r peer-checked:from-emerald-600 peer-checked:to-teal-600 shadow-inner"></div>
                                                                </label>
                                                            ) : (
                                                                <div className="w-16 h-9 bg-slate-100 dark:bg-slate-800/50 rounded-full mx-auto opacity-30"></div>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="p-8 bg-slate-100 dark:bg-slate-800/30 border-t-4 border-slate-900 dark:border-white rounded-l-[3rem] rounded-r-[1rem] flex gap-6 items-center">
                        <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-700 flex items-center justify-center text-slate-900 dark:text-white shadow-lg shrink-0 text-xl">
                            <i className="fa-solid fa-crown"></i>
                        </div>
                        <div>
                            <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-sm">Privileged Role Notice</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium italic">
                                OWNER and MANAGER accounts possess absolute authority and circumvent standard permission constraints.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Admin;