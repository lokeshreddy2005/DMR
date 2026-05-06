/**
 * AdminOrgSpace.jsx
 * Shows all organizations → click to browse their documents.
 * Admin can delete any document in any org.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API_URL from '../config/api';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, ArrowLeft, FileText, Trash2, Download, Search, Users, ChevronLeft, ChevronRight, Settings, X } from 'lucide-react';

function ManageSystemOrgModal({ org, onClose, onUpdated }) {
    const { token } = useAuth();
    const [limitGB, setLimitGB] = useState(org.settings?.storageLimit ? org.settings.storageLimit / 1073741824 : 10);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const headers = { Authorization: `Bearer ${token || localStorage.getItem('dmr_token')}` };

    const handleUpdate = async () => {
        setLoading(true); setError('');
        try {
            await api.put(`${API_URL}/api/admin/organizations/${org._id}/limit`, { storageLimit: limitGB * 1073741824 }, { headers });
            onUpdated();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update organization');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to permanently delete "${org.name}"? This will delete all its documents.`)) return;
        setLoading(true); setError('');
        try {
            await api.delete(`${API_URL}/api/admin/organizations/${org._id}`, { headers });
            onUpdated();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete organization');
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Manage Organization</h2>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-5">
                    {error && <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-xl">{error}</div>}
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Organization Name</p>
                        <p className="text-base font-bold text-gray-900 dark:text-white">{org.name}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Global Storage Limit (GB)</label>
                        <input type="number" min="1" value={limitGB} onChange={e => setLimitGB(e.target.value)} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500" />
                        <p className="text-xs text-gray-500 mt-1">This overrides the organization's maximum allowed storage.</p>
                    </div>
                    <div className="pt-4 flex items-center justify-between border-t border-gray-100 dark:border-gray-800">
                        <button onClick={handleDelete} disabled={loading} className="px-4 py-2 text-sm text-red-600 font-semibold hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors disabled:opacity-50">Delete Org</button>
                        <div className="flex gap-2">
                            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">Cancel</button>
                            <button onClick={handleUpdate} disabled={loading} className="px-4 py-2 text-sm bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50">{loading ? 'Saving...' : 'Save Changes'}</button>
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

function OrgGrid({ onSelect }) {
    const { token } = useAuth();
    const [orgs, setOrgs] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [manageOrg, setManageOrg] = useState(null);

    const fetchOrgs = useCallback(() => {
        setLoading(true);
        api.get(`${API_URL}/api/admin/organizations`, {
            headers: { Authorization: `Bearer ${token || localStorage.getItem('dmr_token')}` }
        }).then(r => setOrgs(r.data)).catch(console.error).finally(() => setLoading(false));
    }, [token]);

    useEffect(() => {
        fetchOrgs();
    }, [fetchOrgs]);

    const filtered = orgs.filter(o =>
        o.name.toLowerCase().includes(search.toLowerCase()) ||
        (o.createdBy?.name || '').toLowerCase().includes(search.toLowerCase())
    );

    const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#ec4899', '#6366f1'];

    return (
        <div className="space-y-5">
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search organizations…" value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            {loading && orgs.length === 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-2xl h-36" />)}
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                    <Building2 className="w-12 h-12 text-gray-300 mb-3" />
                    <p className="text-gray-500 font-semibold">No organizations found.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((org, idx) => {
                        const color = org.avatarColor || COLORS[idx % COLORS.length];
                        return (
                            <motion.div key={org._id}
                                whileHover={{ y: -3, scale: 1.01 }}
                                className="relative p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer group"
                                onClick={(e) => {
                                    if (e.target.closest('button.manage-btn')) return;
                                    onSelect(org);
                                }}
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-base font-extrabold flex-shrink-0"
                                        style={{ backgroundColor: color }}>
                                        {org.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-gray-900 dark:text-white truncate">{org.name}</p>
                                        <p className="text-xs text-gray-500 truncate">by {org.createdBy?.name || org.createdBy?.email || 'Unknown'}</p>
                                    </div>
                                    <button
                                        onClick={() => setManageOrg(org)}
                                        className="manage-btn p-1.5 text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        title="Manage Organization"
                                    >
                                        <Settings className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {org.memberCount || org.members?.length || 0} members</span>
                                    <span>{fmt(org.storageUsed)} / {fmt(org.settings?.storageLimit || 10737418240)}</span>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
            <AnimatePresence>
                {manageOrg && (
                    <ManageSystemOrgModal org={manageOrg} onClose={() => setManageOrg(null)} onUpdated={() => { setManageOrg(null); fetchOrgs(); }} />
                )}
            </AnimatePresence>
        </div>
    );
}

function OrgDocuments({ org, onBack }) {
    const { token } = useAuth();
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [toast, setToast] = useState(null);
    const headers = { Authorization: `Bearer ${token || localStorage.getItem('dmr_token')}` };

    const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

    const fetchDocs = useCallback(() => {
        setLoading(true);
        const params = new URLSearchParams({ space: 'organization', organizationId: org._id, page });
        api.get(`${API_URL}/api/documents?${params}`, { headers })
            .then(r => { setDocs(r.data.documents || []); setTotalPages(r.data.totalPages || 1); setTotalCount(r.data.totalCount || 0); })
            .catch(console.error).finally(() => setLoading(false));
    }, [org._id, page]);

    useEffect(() => { fetchDocs(); }, [fetchDocs]);

    const handleDelete = async (docId, docName) => {
        if (!confirm(`Permanently delete "${docName}"?`)) return;
        try {
            await api.delete(`${API_URL}/api/admin/documents/${docId}`, { headers });
            showToast('Document deleted');
            fetchDocs();
        } catch (e) { showToast(e.response?.data?.error || 'Delete failed', 'error'); }
    };

    const handleDownload = async (doc) => {
        try {
            const r = await api.get(`${API_URL}/api/documents/${doc._id}/download`, { headers });
            const { downloadToken, fileName } = r.data;
            const blobRes = await api.get(`${API_URL}/api/documents/secure-download/${downloadToken}`, { responseType: 'blob' });
            const blob = new Blob([blobRes.data], { type: blobRes.headers['content-type'] || 'application/octet-stream' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a'); link.href = url; link.download = fileName || 'download';
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
            setTimeout(() => window.URL.revokeObjectURL(url), 15000);
        } catch (e) { showToast('Download failed', 'error'); }
    };

    return (
        <div className="space-y-5">
            {toast && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                    className={`fixed top-6 right-6 z-[200] px-5 py-3 rounded-xl shadow-lg text-white font-semibold text-sm ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
                    {toast.msg}
                </motion.div>
            )}

            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-extrabold"
                        style={{ backgroundColor: org.avatarColor || '#8b5cf6' }}>
                        {org.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{org.name}</h2>
                        <p className="text-xs text-gray-500">{totalCount} document{totalCount !== 1 ? 's' : ''}</p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl h-16" />)}</div>
            ) : docs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                    <FileText className="w-12 h-12 text-gray-300 mb-3" />
                    <p className="text-gray-500 font-semibold">No documents found in this organization.</p>
                </div>
            ) : (
                <>
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-5 py-3 font-bold">File Name</th>
                                    <th className="px-5 py-3 font-bold">Uploaded By</th>
                                    <th className="px-5 py-3 font-bold">Size</th>
                                    <th className="px-5 py-3 font-bold">Date</th>
                                    <th className="px-5 py-3 font-bold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {docs.map(doc => (
                                    <tr key={doc._id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
                                                <span className="truncate max-w-xs">{doc.fileName || doc.originalName}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 text-gray-500">{doc.uploadedBy?.name || '—'}</td>
                                        <td className="px-5 py-3 text-gray-500">{fmt(doc.fileSize)}</td>
                                        <td className="px-5 py-3 text-gray-500">{new Date(doc.uploadDate || doc.createdAt).toLocaleDateString()}</td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => handleDownload(doc)} title="Download"
                                                    className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors">
                                                    <Download className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(doc._id, doc.fileName || doc.originalName)} title="Delete"
                                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-3">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm text-gray-500 font-medium">Page {page} of {totalPages}</span>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export function AdminOrgSpace() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [selectedOrg, setSelectedOrg] = useState(null);

    useEffect(() => { if (user && user.role !== 'admin') navigate('/dashboard'); }, [user, navigate]);

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-12">
            <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-purple-500" />
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Organizations</h1>
                    <p className="text-sm text-gray-500">
                        {selectedOrg ? `Viewing documents in ${selectedOrg.name}` : 'Select an organization to view its documents'}
                    </p>
                </div>
            </div>
            <AnimatePresence mode="wait">
                {!selectedOrg ? (
                    <motion.div key="orgs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <OrgGrid onSelect={setSelectedOrg} />
                    </motion.div>
                ) : (
                    <motion.div key="docs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <OrgDocuments org={selectedOrg} onBack={() => setSelectedOrg(null)} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
