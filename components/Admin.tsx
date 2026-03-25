
import React, { useState, useEffect } from 'react';
import { UserRole, RoleConfig, Permission } from '../types';
import { UserService, DBUser } from '../services/UserService';
import { DataRepair } from './DataRepair';
import { PlatformAdmin } from './PlatformAdmin';

interface AdminProps {
    roleConfigs: RoleConfig[];
    onUpdateRoleConfig: (role: UserRole, permission: Permission) => void;
    currentUser: any;
    t: (key: string) => string;
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

const ROLE_META: Record<string, { icon: string; color: string; bg: string; border: string }> = {
    OWNER: { icon: 'fa-crown', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500', border: 'border-l-red-500' },
    MANAGER: { icon: 'fa-user-tie', color: 'text-medical-600 dark:text-medical-400', bg: 'bg-medical-500', border: 'border-l-medical-500' },
    DOCTOR: { icon: 'fa-user-doctor', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500', border: 'border-l-emerald-500' },
    MA: { icon: 'fa-clipboard-user', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500', border: 'border-l-blue-500' },
    FRONT_DESK: { icon: 'fa-desktop', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-500', border: 'border-l-slate-500' },
};

const getRelativeTime = (dateStr?: string): string => {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
};

const Admin: React.FC<AdminProps> = ({ roleConfigs, onUpdateRoleConfig, currentUser, t }) => {
    const [users, setUsers] = useState<DBUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviting, setInviting] = useState(false);
    const [inviteData, setInviteData] = useState({ email: '', full_name: '', role: UserRole.MA });
    const [activeTab, setActiveTab] = useState<'users' | 'permissions' | 'maintenance' | 'platform'>('users');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingUser, setEditingUser] = useState<DBUser | null>(null);
    const [permissionMode, setPermissionMode] = useState<'role' | 'user'>('role');
    const [selectedUserForPerms, setSelectedUserForPerms] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [showInviteModal, setShowInviteModal] = useState(false);

    useEffect(() => { fetchUsers(); }, []);

    const [error, setError] = useState<string | null>(null);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const fetchedUsers = await UserService.getUsers();
            setUsers(fetchedUsers);
        } catch (err: any) {
            console.error('Error fetching users:', err);
            setError(err.message || 'Failed to load personnel list');
        } finally {
            setLoading(false);
        }
    };

    // Auto-dismiss success messages
    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    const showToast = (msg: string) => setSuccessMessage(msg);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviting(true);
        try {
            await UserService.inviteUser(inviteData.email, inviteData.full_name, inviteData.role);
            showToast(`Invitation sent to ${inviteData.email}`);
            setInviteData({ email: '', full_name: '', role: UserRole.MA });
            setShowInviteModal(false);
            fetchUsers();
        } catch (err: any) {
            showToast(`Error: ${err.message}`);
        } finally {
            setInviting(false);
        }
    };

    const handleUpdateUser = async (userId: string, updates: { full_name: string; role: UserRole }) => {
        try {
            await UserService.updateUser(userId, updates);
            setEditingUser(null);
            fetchUsers();
            showToast(`${updates.full_name} updated successfully`);
        } catch (err: any) {
            showToast(`Error: ${err.message}`);
        }
    };

    const handleUpdateUserPermissions = async (userId: string, permission: Permission) => {
        const user = users.find(u => u.id === userId);
        if (!user) return;

        const currentPerms = user.permissions || [];
        let newPerms: Permission[];
        let actionType: 'added' | 'removed';

        if (currentPerms.includes(permission)) {
            newPerms = currentPerms.filter(p => p !== permission);
            actionType = 'removed';
        } else {
            newPerms = [...currentPerms, permission];
            actionType = 'added';
        }

        try {
            await UserService.updatePermissions(userId, newPerms.length > 0 ? newPerms : null);
            const permLabel = permission.split('.').pop();
            showToast(`Permission "${permLabel}" ${actionType} for ${user.full_name}`);
            fetchUsers();
        } catch (err: any) {
            console.error('Error updating permissions:', err);
            showToast(`Error: ${err.message}`);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Are you sure you want to delete this user? This action is irreversible.')) return;
        try {
            await UserService.deleteUser(userId);
            fetchUsers();
            showToast('User deleted successfully');
            if (editingUser?.id === userId) setEditingUser(null);
        } catch (err: any) {
            console.error('Delete Error Detail:', err);
            showToast(`Error: ${err.message}`);
        }
    };

    const isChecked = (permId: Permission) => {
        if (permissionMode === 'role') {
            const config = roleConfigs.find(c => c.role === (inviteData.role as UserRole));
            return config?.permissions.includes(permId) || false;
        } else if (permissionMode === 'user' && selectedUserForPerms) {
            const user = users.find(u => u.id === selectedUserForPerms);
            if (user?.permissions) return user.permissions.includes(permId);
            const config = roleConfigs.find(c => c.role === user?.role);
            return config?.permissions.includes(permId) || false;
        }
        return false;
    };

    const isRoleChecked = (role: UserRole, perm: Permission) => {
        const config = roleConfigs.find(c => c.role === role);
        return config?.permissions.includes(perm) || false;
    };

    const filteredUsers = users.filter(u =>
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const permissionCategories = Array.from(new Set(ALL_PERMISSIONS.map(p => p.category)));

    // Stats
    const roleStats = users.reduce((acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="space-y-8 pb-20 md:pb-10 animate-fade-in">
            {/* Success Toast Notification */}
            {successMessage && (
                <div className="fixed top-6 right-6 z-50 animate-fade-in">
                    <div className={`${successMessage.startsWith('Error') ? 'bg-red-500' : 'bg-emerald-500'} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px]`}>
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            <i className={`fa-solid ${successMessage.startsWith('Error') ? 'fa-triangle-exclamation' : 'fa-check'} text-xl`}></i>
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-sm">{successMessage}</p>
                        </div>
                        <button
                            onClick={() => setSuccessMessage(null)}
                            className="w-8 h-8 rounded-lg hover:bg-white/20 transition-colors flex items-center justify-center"
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>
            )}

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
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-white dark:bg-slate-700 text-medical-600 dark:text-medical-400 shadow-sm scale-[1.02]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <i className="fa-solid fa-users mr-2"></i> Personnel
                    </button>
                    <button
                        onClick={() => setActiveTab('permissions')}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'permissions' ? 'bg-white dark:bg-slate-700 text-medical-600 dark:text-medical-400 shadow-sm scale-[1.02]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <i className="fa-solid fa-shield-halved mr-2"></i> Permissions
                    </button>
                    <button
                        onClick={() => setActiveTab('maintenance')}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'maintenance' ? 'bg-white dark:bg-slate-700 text-medical-600 dark:text-medical-400 shadow-sm scale-[1.02]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <i className="fa-solid fa-wrench mr-2"></i> Maintenance
                    </button>
                    <button
                        onClick={() => setActiveTab('platform')}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'platform' ? 'bg-white dark:bg-slate-700 text-medical-600 dark:text-medical-400 shadow-sm scale-[1.02]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <i className="fa-solid fa-server mr-2"></i> Platform
                    </button>
                </div>
            </header>

            {activeTab === 'users' ? (
                <div className="space-y-6">
                    {/* Team Stats Bar */}
                    <div className="flex flex-wrap gap-3">
                        <div className="glass-panel px-5 py-3 rounded-2xl flex items-center gap-3 border shadow-sm">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"><i className="fa-solid fa-users"></i></div>
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total</div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white leading-none">{users.length}</div>
                            </div>
                        </div>
                        {Object.entries(roleStats).map(([role, count]) => {
                            const meta = ROLE_META[role] || ROLE_META.FRONT_DESK;
                            return (
                                <div key={role} className="glass-panel px-5 py-3 rounded-2xl flex items-center gap-3 border shadow-sm">
                                    <div className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center text-white`}><i className={`fa-solid ${meta.icon} text-sm`}></i></div>
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{role.replace('_', ' ')}</div>
                                        <div className="text-lg font-bold text-slate-900 dark:text-white leading-none">{count}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Search + Invite Button */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <div className="flex-1 flex items-center gap-3 glass-panel p-2.5 rounded-2xl border-white/50 dark:border-slate-800/80">
                            <i className="fa-solid fa-magnifying-glass text-sm text-slate-400 ml-2"></i>
                            <input
                                type="text"
                                placeholder="Search by name, email, or ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="flex-1 bg-transparent border-none outline-none font-medium text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                            />
                        </div>
                        <button
                            onClick={() => setShowInviteModal(true)}
                            className="h-11 px-6 bg-medical-600 text-white rounded-xl font-bold shadow-xl shadow-medical-500/30 flex items-center gap-2.5 transition-all hover:scale-105 hover:shadow-2xl active:scale-95 whitespace-nowrap text-sm"
                        >
                            <i className="fa-solid fa-paper-plane"></i> Invite Personnel
                        </button>
                    </div>

                    {/* Personnel Table */}
                    <div className="glass-panel rounded-2xl luxury-shadow overflow-hidden border-white/40 dark:border-slate-800/50">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-separate border-spacing-0 min-w-[700px]">
                                <thead className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-10">
                                    <tr className="border-b border-slate-200 dark:border-slate-800">
                                        <th className="px-5 py-4">Personnel</th>
                                        <th className="px-5 py-4">Role</th>
                                        <th className="px-5 py-4">Email</th>
                                        <th className="px-5 py-4 text-center">Last Active</th>
                                        <th className="px-5 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={5} className="p-20 text-center"><i className="fa-solid fa-circle-notch fa-spin text-medical-500 text-3xl"></i></td></tr>
                                    ) : error ? (
                                        <tr>
                                            <td colSpan={5} className="p-20 text-center text-red-500 font-bold">
                                                <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                                                {error}
                                                <button onClick={fetchUsers} className="block mx-auto mt-4 text-sm text-medical-600 underline">Retry</button>
                                            </td>
                                        </tr>
                                    ) : filteredUsers.length === 0 ? (
                                        <tr><td colSpan={5} className="p-20 text-center text-slate-400 font-medium">No personnel found.</td></tr>
                                    ) : filteredUsers.map((u, idx) => {
                                        const meta = ROLE_META[u.role] || ROLE_META.FRONT_DESK;
                                        const isOnline = u.last_sign_in_at && (Date.now() - new Date(u.last_sign_in_at).getTime()) < 3600000; // 1hr
                                        return (
                                            <tr
                                                key={u.id}
                                                className={`group border-l-[3px] transition-all duration-200 ${meta.border} ${idx % 2 === 1 ? 'bg-slate-50/30 dark:bg-slate-800/20' : ''} hover:bg-medical-50/30 dark:hover:bg-medical-900/10`}
                                            >
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base text-white shadow-md ${meta.bg}`}>
                                                                {u.full_name.charAt(0)}
                                                            </div>
                                                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${isOnline ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-sm text-slate-900 dark:text-white leading-tight">{u.full_name}</p>
                                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                                {u.created_at ? `Member since ${new Date(u.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}` : `ID: ${u.id.substring(0, 8)}`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white ${meta.bg}`}>
                                                        <i className={`fa-solid ${meta.icon} text-[9px]`}></i>
                                                        {u.role.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                                        {u.email !== 'N/A' ? u.email : <span className="italic text-slate-300 dark:text-slate-600">No email</span>}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        {isOnline ? (
                                                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Online
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                                {getRelativeTime(u.last_sign_in_at)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => setEditingUser({...u})}
                                                            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-medical-500 hover:text-white transition-all flex items-center justify-center text-xs"
                                                            title="Edit User"
                                                        >
                                                            <i className="fa-solid fa-pen-to-square"></i>
                                                        </button>
                                                        {u.id !== currentUser?.id && (
                                                            <button
                                                                onClick={() => handleDeleteUser(u.id)}
                                                                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center text-xs"
                                                                title="Delete User"
                                                            >
                                                                <i className="fa-solid fa-trash-can"></i>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'permissions' ? (
                <div className="space-y-8 animate-fade-in-up">
                    <div className="flex items-center gap-4 bg-medical-50 dark:bg-medical-900/10 p-6 rounded-2xl border border-medical-100 dark:border-medical-900/30">
                        <div className="w-12 h-12 rounded-2xl bg-medical-100 dark:bg-medical-900/40 flex items-center justify-center text-medical-600 dark:text-medical-400 shadow-sm">
                            <i className="fa-solid fa-shield-check text-xl"></i>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-tight">Access Control Matrix</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Manage permissions either by broad roles or specific individual overrides.</p>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 w-full md:w-auto">
                            <button
                                onClick={() => setPermissionMode('role')}
                                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${permissionMode === 'role' ? 'bg-white dark:bg-slate-700 text-medical-600 dark:text-medical-400 shadow-md scale-[1.02]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <i className="fa-solid fa-users-gear mr-2"></i> Global Roles
                            </button>
                            <button
                                onClick={() => setPermissionMode('user')}
                                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${permissionMode === 'user' ? 'bg-white dark:bg-slate-700 text-medical-600 dark:text-medical-400 shadow-md scale-[1.02]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
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
                                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 ring-medical-500/20 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">Select personnel to manage...</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="glass-panel p-1 rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:border-slate-800">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/50 dark:bg-slate-900 sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800">
                                    <tr>
                                        <th className="p-8 text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] w-1/2">Module Permissions</th>
                                        {permissionMode === 'role' ? EDITABLE_ROLES.map(role => (
                                            <th key={role} className="p-8 text-center min-w-[140px]">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold shadow-md ${ROLE_META[role]?.bg || 'bg-slate-500'}`}>
                                                        <i className={`fa-solid ${ROLE_META[role]?.icon || 'fa-user'}`}></i>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">{role.replace('_', ' ')}</span>
                                                </div>
                                            </th>
                                        )) : (
                                            <th className="p-8 text-center min-w-[200px]">
                                                {selectedUserForPerms ? (
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="w-12 h-12 rounded-2xl bg-medical-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
                                                            {users.find(u => u.id === selectedUserForPerms)?.full_name.charAt(0)}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">
                                                            Custom Access Overrides
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No User Selected</span>
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
                                                    <span className="text-[10px] font-bold text-medical-500 uppercase tracking-[0.3em]">{category}</span>
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
                                                                    <input type="checkbox" className="sr-only peer" checked={active} onChange={() => onUpdateRoleConfig(role, perm.id)} />
                                                                    <div className="w-16 h-9 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-7 after:w-7 after:transition-all dark:border-slate-600 peer-checked:bg-gradient-to-r peer-checked:from-medical-600 peer-checked:to-emerald-600 shadow-inner"></div>
                                                                </label>
                                                            </td>
                                                        );
                                                    }) : (
                                                        <td className="p-8 text-center">
                                                            {selectedUserForPerms ? (
                                                                <label className="relative inline-flex items-center cursor-pointer">
                                                                    <input type="checkbox" className="sr-only peer" checked={isChecked(perm.id)} onChange={() => handleUpdateUserPermissions(selectedUserForPerms, perm.id)} />
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

                    <div className="p-8 bg-slate-100 dark:bg-slate-800/30 border-t-4 border-slate-900 dark:border-white rounded-l-2xl rounded-r-xl flex gap-6 items-center">
                        <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-700 flex items-center justify-center text-slate-900 dark:text-white shadow-lg shrink-0 text-xl">
                            <i className="fa-solid fa-crown"></i>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-widest text-sm">Privileged Role Notice</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium italic">
                                OWNER and MANAGER accounts possess absolute authority and circumvent standard permission constraints.
                            </p>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'maintenance' ? (
                <div className="animate-fade-in">
                    <DataRepair />
                </div>
            ) : activeTab === 'platform' ? (
                <div className="animate-fade-in">
                    <PlatformAdmin />
                </div>
            ) : null}

            {/* ===== INVITE MODAL ===== */}
            {showInviteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowInviteModal(false)}>
                    <div className="glass-panel w-full max-w-md p-8 rounded-2xl shadow-2xl border border-white/20 dark:border-slate-700 animate-scale-in bg-gradient-to-br from-medical-600 to-emerald-700 text-white relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
                                <i className="fa-solid fa-paper-plane"></i> Invite Personnel
                            </h3>
                            <button onClick={() => setShowInviteModal(false)} className="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center transition-colors">
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>
                        <form onSubmit={handleInvite} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-medical-200 uppercase tracking-widest ml-1">Full Legal Name</label>
                                <input
                                    type="text" required
                                    value={inviteData.full_name}
                                    onChange={e => setInviteData({ ...inviteData, full_name: e.target.value })}
                                    className="w-full px-5 py-4 rounded-xl bg-white/10 border border-white/20 focus:bg-white/20 focus:border-white/40 outline-none font-bold text-sm placeholder:text-white/30 transition-all"
                                    placeholder="e.g. John Doe"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-medical-200 uppercase tracking-widest ml-1">Professional Email</label>
                                <input
                                    type="email" required
                                    value={inviteData.email}
                                    onChange={e => setInviteData({ ...inviteData, email: e.target.value })}
                                    className="w-full px-5 py-4 rounded-xl bg-white/10 border border-white/20 focus:bg-white/20 focus:border-white/40 outline-none font-bold text-sm placeholder:text-white/30 transition-all"
                                    placeholder="j.doe@clinic.com"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-medical-200 uppercase tracking-widest ml-1">Assigned Role</label>
                                <select
                                    value={inviteData.role}
                                    onChange={e => setInviteData({ ...inviteData, role: e.target.value as UserRole })}
                                    className="w-full px-5 py-4 rounded-xl bg-white/10 border border-white/20 focus:bg-white/20 focus:border-white/40 outline-none font-bold text-sm transition-all appearance-none cursor-pointer"
                                >
                                    {Object.values(UserRole).map(r => (
                                        <option key={r} value={r} className="text-slate-900">{r.replace('_', ' ')}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                disabled={inviting}
                                className="w-full py-5 bg-white text-medical-600 font-bold rounded-xl shadow-lg hover:shadow-medical-500/20 transition-all active:scale-[0.97] mt-4 uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-2"
                            >
                                {inviting ? <i className="fa-solid fa-spinner fa-spin"></i> : (
                                    <>Deploy Invitation <i className="fa-solid fa-bolt"></i></>
                                )}
                            </button>
                            <p className="text-[10px] text-medical-100/60 text-center mt-4 font-medium leading-relaxed">
                                Automated verification email will be dispatched immediately.
                            </p>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== EDIT USER MODAL (Expanded) ===== */}
            {editingUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setEditingUser(null)}>
                    <div className="glass-panel w-full max-w-lg p-8 rounded-2xl shadow-2xl border border-white/20 dark:border-slate-700 animate-scale-in max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-md ${ROLE_META[editingUser.role]?.bg || 'bg-slate-500'}`}>
                                    {editingUser.full_name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Edit Personnel</h3>
                                    <p className="text-xs text-slate-400">{editingUser.email !== 'N/A' ? editingUser.email : `ID: ${editingUser.id.substring(0, 8)}`}</p>
                                </div>
                            </div>
                            <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                <i className="fa-solid fa-xmark text-xl"></i>
                            </button>
                        </div>

                        <div className="space-y-5">
                            {/* Account Info */}
                            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Member Since</span>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                                        {editingUser.created_at ? new Date(editingUser.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Unknown'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Last Login</span>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                                        {editingUser.last_sign_in_at ? getRelativeTime(editingUser.last_sign_in_at) : 'Never'}
                                    </p>
                                </div>
                            </div>

                            {/* Editable Fields */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                <input
                                    type="text"
                                    value={editingUser.full_name}
                                    onChange={e => setEditingUser({ ...editingUser, full_name: e.target.value })}
                                    className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-medical-500 outline-none font-bold placeholder:text-slate-400 transition-all dark:text-white text-sm"
                                />
                            </div>

                            {editingUser.email !== 'N/A' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email <span className="text-slate-300">(read-only)</span></label>
                                    <div className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-sm font-medium text-slate-400 cursor-not-allowed">
                                        {editingUser.email}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Assigned Role</label>
                                <select
                                    value={editingUser.role}
                                    onChange={e => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                                    className="w-full px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-medical-500 outline-none font-bold transition-all appearance-none cursor-pointer dark:text-white text-sm"
                                >
                                    {Object.values(UserRole).map(r => (
                                        <option key={r} value={r}>{r.replace('_', ' ')}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Actions */}
                            <div className="pt-2 flex gap-3">
                                <button
                                    onClick={() => setEditingUser(null)}
                                    className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl transition-all hover:bg-slate-200 dark:hover:bg-slate-700 uppercase text-xs tracking-widest"
                                >
                                    Discard
                                </button>
                                <button
                                    onClick={() => handleUpdateUser(editingUser.id, { full_name: editingUser.full_name, role: editingUser.role })}
                                    className="flex-1 py-3.5 bg-medical-600 text-white font-bold rounded-xl shadow-lg shadow-medical-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase text-xs tracking-widest"
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
                                className="w-full py-3.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 font-bold rounded-xl flex items-center justify-center gap-2 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/30 uppercase text-[10px] tracking-widest"
                            >
                                <i className="fa-solid fa-shield-halved"></i> Manage View/Edit Permissions
                            </button>

                            {/* Danger Zone */}
                            {editingUser.id !== currentUser?.id && (
                                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3">
                                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-3">Danger Zone</p>
                                    <button
                                        onClick={() => handleDeleteUser(editingUser.id)}
                                        className="w-full py-3 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 border border-red-100 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/20 transition-all active:scale-[0.98]"
                                    >
                                        <i className="fa-solid fa-trash-can"></i> Delete This Account
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Admin;