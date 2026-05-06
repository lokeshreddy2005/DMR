import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API_URL from '../config/api';
import api from '../utils/api';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/Button';
import {
    Users, Building2, Server, Trash2, Plus, Save, ShieldAlert,
    ShieldCheck, UserX, BarChart3, HardDrive, FileText, Edit3, X, Check,
    Zap, RotateCcw, Trash
} from 'lucide-react';
import { CircularProgress, getStorageHeaderColor, getWarningMessage } from '../components/ui/CircularProgress';

const MB = 1048576;
const fmt = (b) => { if (!b) return '0 B'; const k = 1024, s = ['B','KB','MB','GB']; const i = Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(1))+' '+s[i]; };
const toMB = (b) => +(b / MB).toFixed(0);
const fromMB = (mb) => Math.round(parseFloat(mb) * MB);

function StatCard({ icon: Icon, label, value, color }) {
    return (
        <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex items-center gap-4 shadow-sm`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{value}</p>
                <p className="text-xs font-semibold text-gray-500 mt-0.5">{label}</p>
            </div>
        </div>
    );
}

export function SuperAdminDashboard() {
    const { user, token: authToken } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [organizations, setOrganizations] = useState([]);
    const [vaults, setVaults] = useState([]);
    const [trash, setTrash] = useState({ users: [], organizations: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState(null);

    // Edit states
    const [editingLimits, setEditingLimits] = useState({});  // {id: mbValue}
    const [editingVault, setEditingVault] = useState(null);   // vault object being edited
    const [newVault, setNewVault] = useState({ id: '', label: '', description: '', keywords: '' });

    const token = authToken || localStorage.getItem('dmr_token');
    const headers = { Authorization: `Bearer ${token}` };

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        if (user && user.role !== 'admin') navigate('/dashboard');
    }, [user, navigate]);

    const fetchAll = useCallback(async () => {
        setIsLoading(true);
        try {
            const [statsRes, usersRes, orgsRes, vaultsRes, trashRes] = await Promise.all([
                api.get(`${API_URL}/api/admin/stats`, { headers }),
                api.get(`${API_URL}/api/admin/users`, { headers }),
                api.get(`${API_URL}/api/admin/organizations`, { headers }),
                api.get(`${API_URL}/api/admin/vaults`, { headers }),
                api.get(`${API_URL}/api/admin/trash`, { headers }),
            ]);
            setStats(statsRes.data);
            setUsers(usersRes.data);
            setOrganizations(orgsRes.data);
            setVaults(vaultsRes.data);
            setTrash(trashRes.data);
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    }, [token]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const apiCall = async (fn, successMsg) => {
        try { await fn(); showToast(successMsg); fetchAll(); }
        catch (e) { showToast(e.response?.data?.error || 'Error occurred', 'error'); }
    };

    const saveUserLimit = (id) => {
        if (editingLimits[id] === undefined) return;
        apiCall(() => api.put(`${API_URL}/api/admin/users/${id}/limit`, { storageLimit: fromMB(editingLimits[id]) }, { headers }), 'Storage limit updated');
    };

    const saveOrgLimit = (id) => {
        if (editingLimits[id] === undefined) return;
        apiCall(() => api.put(`${API_URL}/api/admin/organizations/${id}/limit`, { storageLimit: fromMB(editingLimits[id]) }, { headers }), 'Storage limit updated');
    };

    const changeUserRole = (id, role) => {
        apiCall(() => api.put(`${API_URL}/api/admin/users/${id}/role`, { role }, { headers }), `User role changed to ${role}`);
    };

    const deleteUser = (id, name) => {
        if (!confirm(`Move user "${name}" to Trash? Account will be scheduled for deletion in 14 days.`)) return;
        apiCall(() => api.delete(`${API_URL}/api/admin/users/${id}`, { headers }), `User moved to trash`);
    };

    const deleteOrg = (id, name) => {
        if (!confirm(`Move organization "${name}" to Trash? Data will be scheduled for deletion in 14 days.`)) return;
        apiCall(() => api.delete(`${API_URL}/api/admin/organizations/${id}`, { headers }), 'Organization moved to trash');
    };

    const restoreItem = (type, id) => {
        apiCall(() => api.post(`${API_URL}/api/admin/trash/restore/${type}/${id}`, {}, { headers }), `${type === 'user' ? 'User' : 'Organization'} restored`);
    };

    const permanentDelete = (type, id, name) => {
        if (!confirm(`Permanently delete ${type} "${name}"? This action is irreversible and will delete all associated documents.`)) return;
        apiCall(() => api.delete(`${API_URL}/api/admin/trash/permanent/${type}/${id}`, { headers }), 'Deleted permanently');
    };

    const createVault = async (e) => {
        e.preventDefault();
        const payload = { ...newVault, keywords: newVault.keywords.split(',').map(k => k.trim()).filter(Boolean) };
        await apiCall(() => api.post(`${API_URL}/api/admin/vaults`, payload, { headers }), 'Vault created');
        setNewVault({ id: '', label: '', description: '', keywords: '' });
    };

    const saveVaultEdit = () => {
        if (!editingVault) return;
        const { id, label, description, keywords } = editingVault;
        const kws = typeof keywords === 'string' ? keywords.split(',').map(k => k.trim()).filter(Boolean) : keywords;
        apiCall(() => api.put(`${API_URL}/api/admin/vaults/${id}`, { label, description, keywords: kws }, { headers }), 'Vault updated');
        setEditingVault(null);
    };

    const deleteVault = (id) => {
        if (!confirm('Delete this vault?')) return;
        apiCall(() => api.delete(`${API_URL}/api/admin/vaults/${id}`, { headers }), 'Vault deleted');
    };

    const inputCls = "bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-lg p-2 w-full focus:ring-2 focus:ring-blue-500 outline-none";
    const tabs = [
        { id: 'overview', label: 'Overview', icon: BarChart3 },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'organizations', label: 'Organizations', icon: Building2 },
        { id: 'vaults', label: 'Vaults', icon: Server },
        { id: 'trash', label: 'Trash', icon: Trash2 },
    ];

    if (isLoading) return <div className="flex justify-center items-center h-64"><div className="animate-spin h-10 w-10 rounded-full border-b-2 border-purple-500" /></div>;

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-12">
            {/* Toast */}
            {toast && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className={`fixed top-6 right-6 z-[200] px-5 py-3 rounded-xl shadow-lg text-white font-semibold text-sm ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
                    {toast.msg}
                </motion.div>
            )}

            <div>
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                    <ShieldAlert className="w-8 h-8 text-red-500" /> Admin Dashboard
                </h1>
                <p className="text-gray-500 mt-1 text-sm">Full control over users, organizations, storage quotas and vault categories.</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800 pb-3 overflow-x-auto">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                        className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 text-sm whitespace-nowrap transition-all ${activeTab === t.id ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                        <t.icon className="w-4 h-4" /> {t.label}
                    </button>
                ))}
            </div>

            {/* ── OVERVIEW ── */}
            {activeTab === 'overview' && stats && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
                        <StatCard icon={Users} label="Regular Users" value={stats.totalUsers} color="bg-blue-50 dark:bg-blue-500/10 text-blue-500" />
                        <StatCard icon={ShieldCheck} label="Admins" value={stats.totalAdmins} color="bg-red-50 dark:bg-red-500/10 text-red-500" />
                        <StatCard icon={Building2} label="Organizations" value={stats.totalOrgs} color="bg-purple-50 dark:bg-purple-500/10 text-purple-500" />
                        <StatCard icon={FileText} label="Documents" value={stats.totalDocs} color="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500" />
                        <StatCard icon={HardDrive} label="Total Storage" value={fmt(stats.totalStorageUsed)} color="bg-orange-50 dark:bg-orange-500/10 text-orange-500" />
                        <StatCard icon={Server} label="Vaults" value={stats.vaultCount} color="bg-cyan-50 dark:bg-cyan-500/10 text-cyan-500" />
                        <StatCard icon={Zap} label="Saved by Compression" value={fmt(stats.compressionSavings)} color="bg-yellow-50 dark:bg-yellow-500/10 text-yellow-500" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                        {(() => {
                            const totalPrivateUsed = users.reduce((acc, u) => acc + (u.storageUsed || 0), 0);
                            const totalPrivateLimit = users.reduce((acc, u) => acc + (u.storageLimit || 0), 0);
                            const privatePercentage = totalPrivateLimit > 0 ? Math.round(Math.min(100, (totalPrivateUsed / totalPrivateLimit) * 100)) : 0;
                            
                            const totalOrgUsed = organizations.reduce((acc, o) => acc + (o.storageUsed || 0), 0);
                            const totalOrgLimit = organizations.reduce((acc, o) => acc + (o.settings?.storageLimit || 10737418240), 0); // Default to 10GB if not set
                            const orgPercentage = totalOrgLimit > 0 ? Math.round(Math.min(100, (totalOrgUsed / totalOrgLimit) * 100)) : 0;

                            const publicUsed = stats.publicStorageUsed || 0;
                            const totalUsed = stats.totalStorageUsed || 1; // Avoid div by zero
                            const publicPercentage = Math.round((publicUsed / totalUsed) * 100);

                            return (
                                <>
                                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <Users className="w-5 h-5 text-blue-500" /> All Private Spaces
                                            </h3>
                                            <p className="text-sm text-gray-500 mt-1">Sum of all users' individual storage</p>
                                            <div className="mt-4">
                                                <p className="text-2xl font-black text-gray-900 dark:text-white">{fmt(totalPrivateUsed)}</p>
                                                <p className="text-xs font-semibold text-gray-500">used of {fmt(totalPrivateLimit)}</p>
                                            </div>
                                        </div>
                                        <div className="w-24 h-24 flex-shrink-0">
                                            <CircularProgress percentage={privatePercentage} colorClass="text-blue-500" />
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <Building2 className="w-5 h-5 text-purple-500" /> Organization Spaces
                                            </h3>
                                            <p className="text-sm text-gray-500 mt-1">Sum of all organization storage</p>
                                            <div className="mt-4">
                                                <p className="text-2xl font-black text-gray-900 dark:text-white">{fmt(totalOrgUsed)}</p>
                                                <p className="text-xs font-semibold text-gray-500">used of {fmt(totalOrgLimit)}</p>
                                            </div>
                                        </div>
                                        <div className="w-24 h-24 flex-shrink-0">
                                            <CircularProgress percentage={orgPercentage} colorClass="text-purple-500" />
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <FileText className="w-5 h-5 text-emerald-500" /> Total Public Space
                                            </h3>
                                            <p className="text-sm text-gray-500 mt-1">Total storage used by public files</p>
                                            <div className="mt-4">
                                                <p className="text-2xl font-black text-gray-900 dark:text-white">{fmt(publicUsed)}</p>
                                                <p className="text-xs font-semibold text-gray-500">{publicPercentage}% of total storage</p>
                                            </div>
                                        </div>
                                        <div className="w-24 h-24 flex-shrink-0">
                                            <CircularProgress percentage={publicPercentage} colorClass="text-emerald-500" />
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* ── USERS ── */}
            {activeTab === 'users' && (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    {['Name','Email','Role','Storage Used','Limit (MB)','Actions'].map(h => (
                                        <th key={h} className="px-5 py-3 font-bold">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u._id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                                        <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">{u.name}</td>
                                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{u.email}</td>
                                        <td className="px-5 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${u.role === 'admin' ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'}`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-gray-500">{fmt(u.storageUsed)}</td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-1">
                                                <input type="number" min="1"
                                                    value={editingLimits[u._id] !== undefined ? editingLimits[u._id] : toMB(u.storageLimit)}
                                                    onChange={e => setEditingLimits(p => ({ ...p, [u._id]: e.target.value }))}
                                                    className="w-24 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                                <button onClick={() => saveUserLimit(u._id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors" title="Save limit"><Check className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-2">
                                                {u.role === 'user' ? (
                                                    <button onClick={() => changeUserRole(u._id, 'admin')} className="px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg border border-red-200 dark:border-red-500/30 flex items-center gap-1 transition-colors">
                                                        <ShieldCheck className="w-3 h-3" /> Promote
                                                    </button>
                                                ) : (
                                                    <button onClick={() => changeUserRole(u._id, 'user')} className="px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 flex items-center gap-1 transition-colors" disabled={u._id === user?.id}>
                                                        <ShieldAlert className="w-3 h-3" /> Demote
                                                    </button>
                                                )}
                                                <button onClick={() => deleteUser(u._id, u.name)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Delete user" disabled={u._id === user?.id}>
                                                    <UserX className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── ORGANIZATIONS ── */}
            {activeTab === 'organizations' && (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    {['Organization','Creator','Members','Storage Used','Limit (MB)','Actions'].map(h => (
                                        <th key={h} className="px-5 py-3 font-bold">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {organizations.map(org => (
                                    <tr key={org._id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                                        <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white">{org.name}</td>
                                        <td className="px-5 py-3 text-gray-500">{org.createdBy?.name || org.createdBy?.email}</td>
                                        <td className="px-5 py-3 text-gray-500">{org.memberCount}</td>
                                        <td className="px-5 py-3 text-gray-500">{fmt(org.storageUsed)}</td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-1">
                                                <input type="number" min="1"
                                                    value={editingLimits[org._id] !== undefined ? editingLimits[org._id] : toMB(org.storageLimit)}
                                                    onChange={e => setEditingLimits(p => ({ ...p, [org._id]: e.target.value }))}
                                                    className="w-24 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-purple-500"
                                                />
                                                <button onClick={() => saveOrgLimit(org._id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors" title="Save limit"><Check className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <button onClick={() => deleteOrg(org._id, org.name)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Delete organization">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── VAULTS ── */}
            {activeTab === 'vaults' && (
                <div className="space-y-6">
                    {/* Create form */}
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-emerald-500" /> Add New Vault</h3>
                        <form onSubmit={createVault} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Vault ID</label>
                                <input required placeholder="e.g. human_resources" value={newVault.id} onChange={e => setNewVault(p => ({...p, id: e.target.value}))} className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Label</label>
                                <input required placeholder="e.g. Human Resources" value={newVault.label} onChange={e => setNewVault(p => ({...p, label: e.target.value}))} className={inputCls} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Description</label>
                                <input placeholder="Short description…" value={newVault.description} onChange={e => setNewVault(p => ({...p, description: e.target.value}))} className={inputCls} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Keywords (comma-separated)</label>
                                <input placeholder="hr, payroll, employee" value={newVault.keywords} onChange={e => setNewVault(p => ({...p, keywords: e.target.value}))} className={inputCls} />
                            </div>
                            <div className="md:col-span-2 flex justify-end">
                                <Button type="submit" className="flex items-center gap-2"><Plus className="w-4 h-4" /> Create Vault</Button>
                            </div>
                        </form>
                    </div>

                    {/* Vault list */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {vaults.map(vault => (
                            <div key={vault.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm group relative">
                                {editingVault?.id === vault.id ? (
                                    <div className="space-y-2">
                                        <input className={inputCls} value={editingVault.label} onChange={e => setEditingVault(p => ({...p, label: e.target.value}))} placeholder="Label" />
                                        <input className={inputCls} value={editingVault.description} onChange={e => setEditingVault(p => ({...p, description: e.target.value}))} placeholder="Description" />
                                        <input className={inputCls} value={Array.isArray(editingVault.keywords) ? editingVault.keywords.join(', ') : editingVault.keywords} onChange={e => setEditingVault(p => ({...p, keywords: e.target.value}))} placeholder="Keywords" />
                                        <div className="flex gap-2 pt-1">
                                            <button onClick={saveVaultEdit} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 transition-colors"><Check className="w-3 h-3" /> Save</button>
                                            <button onClick={() => setEditingVault(null)} className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-lg transition-colors"><X className="w-3 h-3" /> Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setEditingVault({ ...vault, keywords: vault.keywords?.join(', ') || '' })} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                                            <button onClick={() => deleteVault(vault.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                        <h4 className="font-bold text-gray-900 dark:text-white">{vault.label}</h4>
                                        <p className="text-xs text-gray-400 font-mono mt-0.5 mb-2">{vault.id}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-3">{vault.description || '—'}</p>
                                        <div className="flex flex-wrap gap-1">
                                            {vault.keywords?.slice(0, 5).map(k => (
                                                <span key={k} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-xs rounded-full text-gray-600 dark:text-gray-300">{k}</span>
                                            ))}
                                            {vault.keywords?.length > 5 && <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-xs rounded-full text-gray-500">+{vault.keywords.length - 5}</span>}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── TRASH ── */}
            {activeTab === 'trash' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 text-red-500">
                            <Trash2 className="w-5 h-5" /> Trashed Items
                        </h3>
                        <p className="text-sm text-gray-500 mb-6">These items are scheduled for permanent deletion 14 days after being moved here. You can restore them at any time before then.</p>

                        <div className="space-y-8">
                            {/* Trashed Users */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Users ({trash.users.length})</h4>
                                {trash.users.length === 0 ? (
                                    <p className="text-sm text-gray-400 italic py-4 border border-dashed rounded-xl text-center">No users in trash.</p>
                                ) : (
                                    <div className="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-xl">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800">
                                                <tr>
                                                    <th className="px-5 py-3">User</th>
                                                    <th className="px-5 py-3">Deleted At</th>
                                                    <th className="px-5 py-3">Auto-Delete In</th>
                                                    <th className="px-5 py-3">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {trash.users.map(u => {
                                                    const daysLeft = Math.ceil((new Date(u.scheduledDeletionDate) - new Date()) / (1000 * 60 * 60 * 24));
                                                    return (
                                                        <tr key={u._id} className="border-t border-gray-100 dark:border-gray-800">
                                                            <td className="px-5 py-3">
                                                                <div className="font-semibold text-gray-900 dark:text-white">{u.name}</div>
                                                                <div className="text-xs text-gray-500">{u.email}</div>
                                                            </td>
                                                            <td className="px-5 py-3 text-gray-500">{new Date(u.deletedAt).toLocaleDateString()}</td>
                                                            <td className="px-5 py-3">
                                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${daysLeft <= 3 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                                                    {daysLeft} days
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-3">
                                                                <div className="flex gap-2">
                                                                    <button onClick={() => restoreItem('user', u._id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Restore User"><RotateCcw className="w-4 h-4" /></button>
                                                                    <button onClick={() => permanentDelete('user', u._id, u.name)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Permanently"><Trash className="w-4 h-4" /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Trashed Organizations */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Organizations ({trash.organizations.length})</h4>
                                {trash.organizations.length === 0 ? (
                                    <p className="text-sm text-gray-400 italic py-4 border border-dashed rounded-xl text-center">No organizations in trash.</p>
                                ) : (
                                    <div className="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-xl">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800">
                                                <tr>
                                                    <th className="px-5 py-3">Organization</th>
                                                    <th className="px-5 py-3">Creator</th>
                                                    <th className="px-5 py-3">Auto-Delete In</th>
                                                    <th className="px-5 py-3">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {trash.organizations.map(o => {
                                                    const daysLeft = Math.ceil((new Date(o.scheduledDeletionDate) - new Date()) / (1000 * 60 * 60 * 24));
                                                    return (
                                                        <tr key={o._id} className="border-t border-gray-100 dark:border-gray-800">
                                                            <td className="px-5 py-3 font-semibold text-gray-900 dark:text-white">{o.name}</td>
                                                            <td className="px-5 py-3 text-gray-500">{o.createdBy?.name || o.createdBy?.email}</td>
                                                            <td className="px-5 py-3">
                                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${daysLeft <= 3 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                                                    {daysLeft} days
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-3">
                                                                <div className="flex gap-2">
                                                                    <button onClick={() => restoreItem('organization', o._id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Restore Organization"><RotateCcw className="w-4 h-4" /></button>
                                                                    <button onClick={() => permanentDelete('organization', o._id, o.name)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Permanently"><Trash className="w-4 h-4" /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
