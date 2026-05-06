import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import API_URL from '../config/api';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ArrowLeft, FileText, Trash2, Download, Search, Settings, Plus, X } from 'lucide-react';

function CreateUserModal({ onClose, onCreated }) {
    const { token } = useAuth();
    const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'user', storageLimit: 5368709120 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            await api.post(`${API_URL}/api/admin/users`, formData, {
                headers: { Authorization: `Bearer ${token || localStorage.getItem('dmr_token')}` }
            });
            onCreated();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create user');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create User</h2>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-xl">{error}</div>}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Name</label>
                        <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Email</label>
                        <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Password</label>
                        <input type="password" required minLength={6} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Role</label>
                            <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white">
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Quota (GB)</label>
                            <input type="number" min="1" value={formData.storageLimit / 1073741824} onChange={e => setFormData({ ...formData, storageLimit: e.target.value * 1073741824 })} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-5 py-2 text-gray-600 dark:text-gray-400 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">Cancel</button>
                        <button type="submit" disabled={loading} className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50">{loading ? 'Creating...' : 'Create User'}</button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

function ManageUserModal({ user, onClose, onUpdated }) {
    const { token } = useAuth();
    const [role, setRole] = useState(user.role);
    const [limitGB, setLimitGB] = useState(user.storageLimit ? user.storageLimit / 1073741824 : 5);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const headers = { Authorization: `Bearer ${token || localStorage.getItem('dmr_token')}` };

    const handleUpdate = async () => {
        setLoading(true); setError('');
        try {
            if (role !== user.role) await api.put(`${API_URL}/api/admin/users/${user._id}/role`, { role }, { headers });
            if (limitGB * 1073741824 !== user.storageLimit) await api.put(`${API_URL}/api/admin/users/${user._id}/limit`, { storageLimit: limitGB * 1073741824 }, { headers });
            onUpdated();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update user');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to permanently delete ${user.name}?`)) return;
        setLoading(true); setError('');
        try {
            await api.delete(`${API_URL}/api/admin/users/${user._id}`, { headers });
            onUpdated();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete user');
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Manage User</h2>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-5">
                    {error && <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-xl">{error}</div>}
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">User</p>
                        <p className="text-base font-bold text-gray-900 dark:text-white">{user.name} ({user.email})</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Role</label>
                            <select value={role} onChange={e => setRole(e.target.value)} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500">
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Quota (GB)</label>
                            <input type="number" min="1" value={limitGB} onChange={e => setLimitGB(e.target.value)} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>
                    <div className="pt-4 flex items-center justify-between border-t border-gray-100 dark:border-gray-800">
                        <button onClick={handleDelete} disabled={loading} className="px-4 py-2 text-sm text-red-600 font-semibold hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors disabled:opacity-50">Delete User</button>
                        <div className="flex gap-2">
                            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">Cancel</button>
                            <button onClick={handleUpdate} disabled={loading} className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50">{loading ? 'Saving...' : 'Save Changes'}</button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

const fmt = (b) => {
    if (!b) return '0 B';
    const k = 1024, s = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
};

// ── User List ────────────────────────────────────────────────────────────────
function UserList({ onSelect }) {
    const { token } = useAuth();
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [manageUser, setManageUser] = useState(null);
    const headers = { Authorization: `Bearer ${token || localStorage.getItem('dmr_token')}` };

    const fetchUsers = useCallback(() => {
        setLoading(true);
        api.get(`${API_URL}/api/admin/users`, { headers })
            .then(r => setUsers(r.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [headers]);

    useEffect(() => {
        fetchUsers();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const filtered = users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    if (loading && users.length === 0) return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-2xl h-28" />)}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search users…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl shadow-sm hover:bg-blue-700 transition-colors">
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Create User</span>
                </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(u => (
                    <motion.div
                        key={u._id}
                        whileHover={{ y: -3, scale: 1.01 }}
                        className="relative flex flex-col p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer group"
                        onClick={(e) => {
                            if (e.target.closest('button.manage-btn')) return;
                            onSelect(u);
                        }}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                                style={{ backgroundColor: u.avatarColor || '#3b82f6' }}>
                                {u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{u.name}</p>
                                <p className="text-xs text-gray-500 truncate">{u.email}</p>
                            </div>
                            <button
                                onClick={() => setManageUser(u)}
                                className="manage-btn p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="Manage User"
                            >
                                <Settings className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${u.role === 'admin' ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'}`}>
                                {u.role}
                            </span>
                            <span className="text-xs text-gray-400">{fmt(u.storageUsed)} / {fmt(u.storageLimit)}</span>
                        </div>
                    </motion.div>
                ))}
            </div>

            <AnimatePresence>
                {showCreate && (
                    <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchUsers(); }} />
                )}
                {manageUser && (
                    <ManageUserModal user={manageUser} onClose={() => setManageUser(null)} onUpdated={() => { setManageUser(null); fetchUsers(); }} />
                )}
            </AnimatePresence>
        </div>
    );
}

// ── User Private Documents ───────────────────────────────────────────────────
function UserDocuments({ user: selectedUser, onBack }) {
    const { token } = useAuth();
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [toast, setToast] = useState(null);
    const headers = { Authorization: `Bearer ${token || localStorage.getItem('dmr_token')}` };

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchDocs = useCallback(() => {
        setLoading(true);
        api.get(`${API_URL}/api/admin/users/${selectedUser._id}/documents?page=${page}`, { headers })
            .then(r => {
                setDocs(r.data.documents || []);
                setTotalPages(r.data.totalPages || 1);
                setTotalCount(r.data.totalCount || 0);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [selectedUser._id, page]);

    useEffect(() => { fetchDocs(); }, [fetchDocs]);

    const handleDelete = async (docId, docName) => {
        if (!confirm(`Delete "${docName}"? This cannot be undone.`)) return;
        try {
            await api.delete(`${API_URL}/api/admin/documents/${docId}`, { headers });
            showToast('Document deleted');
            fetchDocs();
        } catch (e) {
            showToast(e.response?.data?.error || 'Delete failed', 'error');
        }
    };

    const handleDownload = async (doc) => {
        try {
            const r = await api.get(`${API_URL}/api/documents/${doc._id}/download`, { headers });
            window.open(r.data.downloadUrl || r.data.signedUrl, '_blank');
        } catch (e) { showToast('Download failed', 'error'); }
    };

    return (
        <div className="space-y-6">
            {toast && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                    className={`fixed top-6 right-6 z-[200] px-5 py-3 rounded-xl shadow-lg text-white font-semibold text-sm ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
                    {toast.msg}
                </motion.div>
            )}

            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: selectedUser.avatarColor || '#3b82f6' }}>
                        {selectedUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedUser.name}'s Private Documents</h2>
                        <p className="text-sm text-gray-500">{totalCount} documents</p>
                    </div>
                </div>
            </div>

            {/* Docs */}
            {loading ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl h-16" />)}</div>
            ) : docs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                    <FileText className="w-12 h-12 text-gray-300 mb-3" />
                    <p className="text-gray-500">No private documents found for this user.</p>
                </div>
            ) : (
                <>
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-5 py-3 font-bold">File Name</th>
                                    <th className="px-5 py-3 font-bold">Size</th>
                                    <th className="px-5 py-3 font-bold">Uploaded</th>
                                    <th className="px-5 py-3 font-bold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {docs.map(doc => (
                                    <tr key={doc._id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                                <span className="truncate max-w-xs">{doc.fileName}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 text-gray-500">{fmt(doc.fileSize)}</td>
                                        <td className="px-5 py-3 text-gray-500">{new Date(doc.uploadDate).toLocaleDateString()}</td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleDownload(doc)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title="Download">
                                                    <Download className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(doc._id, doc.fileName)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Delete">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                Previous
                            </button>
                            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export function AdminUsersPage() {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const [selectedUser, setSelectedUser] = useState(null);

    useEffect(() => {
        if (user && user.role !== 'admin') navigate('/dashboard');
    }, [user, navigate]);

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-12">
            <div className="flex items-center gap-3">
                <Users className="w-7 h-7 text-blue-500" />
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">All Users</h1>
                    <p className="text-sm text-gray-500">
                        {selectedUser ? `Viewing private documents of ${selectedUser.name}` : 'Select a user to browse their private documents'}
                    </p>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {!selectedUser ? (
                    <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <UserList onSelect={setSelectedUser} />
                    </motion.div>
                ) : (
                    <motion.div key="docs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <UserDocuments user={selectedUser} onBack={() => setSelectedUser(null)} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
