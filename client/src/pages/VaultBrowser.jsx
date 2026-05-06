import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import API_URL from '../config/api';
import { useAuth } from '../context/AuthContext';
import { FileText, ChevronLeft, ChevronRight, ArrowLeft, LayoutGrid, List, X, Download, Maximize2, Plus, Trash2, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/Button';
import DocumentPreview, { DocumentThumbnail, FullPreviewModal } from '../components/PreviewModal';
import { VAULT_ICONS, VAULT_COLOR, VAULT_LABELS, VAULT_THRESHOLD } from '../constants/vaults';

const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatVaultPercent = (score) => `${(score * 100).toFixed(2)}%`;

function EditVaultModal({ vault, onClose, onUpdated }) {
    const { token } = useAuth();
    const [formData, setFormData] = useState({
        label: vault.label || '',
        description: vault.description || '',
        keywords: (vault.keywords || []).join(', ')
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const headers = { Authorization: `Bearer ${token || localStorage.getItem('dmr_token')}` };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            const payload = { ...formData, keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean) };
            await api.put(`${API_URL}/api/admin/vaults/${vault.id}`, payload, { headers });
            onUpdated();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update vault');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Vault</h2>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-xl">{error}</div>}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Label</label>
                        <input type="text" required value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Description</label>
                        <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Keywords (comma-separated)</label>
                        <input type="text" value={formData.keywords} onChange={e => setFormData({ ...formData, keywords: e.target.value })} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white" />
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-5 py-2 text-gray-600 dark:text-gray-400 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">Cancel</button>
                        <button type="submit" disabled={loading} className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50">{loading ? 'Saving...' : 'Save Changes'}</button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

// ─── Vault List View ───────────────────────────────────────────────────────────
function VaultListView({ onSelectVault }) {
    const { token, user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [vaults, setVaults] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newVault, setNewVault] = useState({ id: '', label: '', description: '', keywords: '' });
    const [toast, setToast] = useState(null);
    const [editVault, setEditVault] = useState(null);
    const headers = { Authorization: `Bearer ${token || localStorage.getItem('dmr_token')}` };

    const showToastMsg = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

    const fetchVaults = () => {
        Promise.all([
            api.get(`${API_URL}/api/documents/vaults/list`, { headers }),
            api.get(`${API_URL}/api/documents/vaults/stats`, { headers }),
        ]).then(([listRes, statsRes]) => {
            setVaults(listRes.data.vaults || []);
            const statsMap = {};
            (statsRes.data.vaultStats || []).forEach(s => { statsMap[s.vaultId] = s.count; });
            setStats(statsMap);
        }).catch(console.error)
          .finally(() => setLoading(false));
    };

    useEffect(() => { fetchVaults(); }, [token]);

    const handleCreateVault = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...newVault, keywords: newVault.keywords.split(',').map(k => k.trim()).filter(Boolean) };
            await api.post(`${API_URL}/api/admin/vaults`, payload, { headers });
            setNewVault({ id: '', label: '', description: '', keywords: '' });
            setShowCreate(false);
            showToastMsg('Vault created!');
            fetchVaults();
        } catch (e) { showToastMsg(e.response?.data?.error || 'Failed to create vault', 'error'); }
    };

    const handleDeleteVault = async (id) => {
        if (!confirm('Delete this vault?')) return;
        try {
            await api.delete(`${API_URL}/api/admin/vaults/${id}`, { headers });
            showToastMsg('Vault deleted');
            fetchVaults();
        } catch (e) { showToastMsg('Failed to delete vault', 'error'); }
    };

    if (loading) return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 13 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800/50 rounded-2xl h-32 border border-gray-200 dark:border-gray-800" />
            ))}
        </div>
    );

    const inputCls = "w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <div className="space-y-6">
            {toast && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                    className={`fixed top-6 right-6 z-[200] px-5 py-3 rounded-xl shadow-lg text-white font-semibold text-sm ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
                    {toast.msg}
                </motion.div>
            )}

            {/* Admin: Create Vault */}
            {isAdmin && (
                <div>
                    {!showCreate ? (
                        <button onClick={() => setShowCreate(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-sm font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors">
                            <Plus className="w-4 h-4" /> Create New Vault
                        </button>
                    ) : (
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Plus className="w-4 h-4 text-emerald-500" /> New Vault</h3>
                            <form onSubmit={handleCreateVault} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div><label className="block text-xs font-bold text-gray-500 mb-1">VAULT ID</label><input required className={inputCls} placeholder="e.g. legal_docs" value={newVault.id} onChange={e => setNewVault(p => ({...p, id: e.target.value}))} /></div>
                                <div><label className="block text-xs font-bold text-gray-500 mb-1">LABEL</label><input required className={inputCls} placeholder="e.g. Legal Documents" value={newVault.label} onChange={e => setNewVault(p => ({...p, label: e.target.value}))} /></div>
                                <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-500 mb-1">DESCRIPTION</label><input className={inputCls} placeholder="Short description…" value={newVault.description} onChange={e => setNewVault(p => ({...p, description: e.target.value}))} /></div>
                                <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-500 mb-1">KEYWORDS (comma-separated)</label><input className={inputCls} placeholder="legal, contract, nda" value={newVault.keywords} onChange={e => setNewVault(p => ({...p, keywords: e.target.value}))} /></div>
                                <div className="md:col-span-2 flex gap-2 justify-end">
                                    <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-semibold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
                                    <Button type="submit"><Plus className="w-4 h-4 mr-1" /> Create Vault</Button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {vaults.map(vault => {
                const color = VAULT_COLOR;
                const count = stats[vault.id] || 0;
                return (
                    <motion.div
                        key={vault.id}
                        whileHover={{ y: -3, scale: 1.01 }}
                        className={`text-left p-5 rounded-2xl border ${color.bg} ${color.border} shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-3 relative group cursor-pointer`}
                        onClick={(e) => {
                            if (e.target.closest('button.manage-btn')) return;
                            onSelectVault(vault);
                        }}
                    >
                        {isAdmin && (
                            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={e => { e.stopPropagation(); setEditVault(vault); }}
                                    className="manage-btn p-1.5 text-gray-400 hover:text-blue-600 bg-white/70 dark:bg-gray-900/70 rounded-lg"
                                    title="Edit vault"
                                >
                                    <Settings className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={e => { e.stopPropagation(); handleDeleteVault(vault.id); }}
                                    className="manage-btn p-1.5 text-gray-400 hover:text-red-600 bg-white/70 dark:bg-gray-900/70 rounded-lg"
                                    title="Delete vault"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        <div className="flex items-start justify-between">
                            <span className="text-2xl">{VAULT_ICONS[vault.id] || '🗂️'}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color.bg} ${color.text} border ${color.border}`}>
                                {count} {count === 1 ? 'doc' : 'docs'}
                            </span>
                        </div>
                        <div>
                            <h3 className={`font-bold text-sm ${color.text}`}>{vault.label}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{vault.description}</p>
                        </div>
                    </motion.div>
                );
            })}
            </div>
            
            <AnimatePresence>
                {editVault && (
                    <EditVaultModal vault={editVault} onClose={() => setEditVault(null)} onUpdated={() => { setEditVault(null); fetchVaults(); showToastMsg('Vault updated successfully!'); }} />
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Vault Document View ───────────────────────────────────────────────────────
function VaultDocumentView({ vault, onBack }) {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [documents, setDocuments] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('grid');
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [expandedTags, setExpandedTags] = useState(false);
    const [isFullPreviewOpen, setIsFullPreviewOpen] = useState(false);

    const currentPage = parseInt(searchParams.get('page') || '1', 10);
    const LIMIT = 20;
    const effectiveTotalPages = Math.max(1, totalPages || 1);
    const color = VAULT_COLOR;

    const getAuthHeaders = useCallback(() => {
        const t = token || localStorage.getItem('dmr_token');
        return t ? { Authorization: `Bearer ${t}` } : {};
    }, [token]);

    const fetchDocs = useCallback(async () => {
        setLoading(true);
        try {
            const headers = getAuthHeaders();
            const res = await api.get(
                `${API_URL}/api/documents/vault/${vault.id}?page=${currentPage}&limit=${LIMIT}`,
                { headers }
            );
            setDocuments(res.data.documents || []);
            setTotalCount(res.data.totalCount || 0);
            setTotalPages(Math.max(1, res.data.totalPages || 1));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [vault.id, currentPage, getAuthHeaders]);

    useEffect(() => { fetchDocs(); }, [fetchDocs]);

    useEffect(() => {
        setExpandedTags(false);
    }, [selectedDoc?._id]);

    const goToPage = (p) => {
        const np = new URLSearchParams(searchParams);
        np.set('page', String(p));
        setSearchParams(np);
    };

    const startIndex = (currentPage - 1) * LIMIT;

    const handleDownload = async (doc) => {
        try {
            const headers = getAuthHeaders();
            const tokenRes = await api.get(`${API_URL}/api/documents/${doc._id}/download`, { headers });
            const { downloadToken, fileName } = tokenRes.data;
            const blobRes = await api.get(`${API_URL}/api/documents/secure-download/${downloadToken}`, { responseType: 'blob' });
            const blob = new Blob([blobRes.data], { type: blobRes.headers['content-type'] || 'application/octet-stream' });
            const url = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = fileName || 'download';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            window.open(url, '_blank');
            setTimeout(() => window.URL.revokeObjectURL(url), 15000);
        } catch (err) {
            console.error('Vault download failed:', err);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Vault Header */}
            <div className={`flex items-center gap-4 p-5 rounded-2xl border ${color.bg} ${color.border}`}>
                <button
                    onClick={onBack}
                    className="p-2 rounded-xl bg-white/70 dark:bg-gray-900/50 hover:bg-white dark:hover:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 transition-all"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <span className="text-3xl">{VAULT_ICONS[vault.id] || '🗂️'}</span>
                <div className="flex-1">
                    <h2 className={`text-xl font-extrabold ${color.text}`}>{vault.label}</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{vault.description}</p>
                </div>
                <span className={`text-sm font-bold px-3 py-1 rounded-full border ${color.bg} ${color.text} ${color.border}`}>
                    {totalCount} {totalCount === 1 ? 'document' : 'documents'}
                </span>
            </div>

            {/* Controls */}
            {!loading && totalCount > 0 && (
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg shadow-sm">
                        Showing <span className="font-bold text-gray-900 dark:text-white">{startIndex + 1}</span>–<span className="font-bold text-gray-900 dark:text-white">{Math.min(startIndex + LIMIT, totalCount)}</span> of <span className={`font-bold ${color.text}`}>{totalCount}</span>
                    </span>
                    <div className="flex items-center gap-2">
                        {/* Pagination */}
                        {effectiveTotalPages > 1 && (
                            <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                                <button onClick={() => goToPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="p-1.5 text-gray-500 hover:text-blue-600 disabled:opacity-30 transition-colors">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="px-2 text-xs font-bold text-gray-700 dark:text-gray-300">{currentPage} / {effectiveTotalPages}</span>
                                <button onClick={() => goToPage(Math.min(effectiveTotalPages, currentPage + 1))} disabled={currentPage >= effectiveTotalPages} className="p-1.5 text-gray-500 hover:text-blue-600 disabled:opacity-30 transition-colors">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        {/* View toggle */}
                        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}><LayoutGrid className="w-4 h-4" /></button>
                            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}><List className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>
            )}

            {/* Document Grid / List */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800/50 rounded-2xl h-40 border border-gray-200 dark:border-gray-800" />
                    ))}
                </div>
            ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <span className="text-5xl mb-4">{VAULT_ICONS[vault.id] || '🗂️'}</span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No documents yet</h3>
                    <p className="text-sm text-gray-500">Documents routed to the <strong>{vault.label}</strong> vault will appear here.</p>
                </div>
            ) : (
                <AnimatePresence mode="wait">
                    <motion.div
                        key={viewMode}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4' : 'flex flex-col gap-[2px]'}
                    >
                        {viewMode === 'list' && documents.length > 0 && (
                            <div className="hidden md:flex items-center gap-4 px-4 py-2.5 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest border-b border-gray-200 dark:border-gray-800">
                                <div className="w-10"></div>
                                <div className="flex-1">Name</div>
                                <div className="w-36">Uploaded By</div>
                                <div className="w-32">Date Modified</div>
                                <div className="w-24">File Size</div>
                            </div>
                        )}
                        {documents.map(doc => {
                            // Find this vault's score in the document
                            const vaultEntry = doc.metadata?.vaults?.find(v => v.vaultId === vault.id);
                            const score = vaultEntry ? formatVaultPercent(vaultEntry.score) : null;

                            return viewMode === 'grid' ? (
                                <motion.div
                                    key={doc._id}
                                    variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                                    initial="hidden" animate="visible"
                                    onClick={() => setSelectedDoc(doc)}
                                    className={`bg-white dark:bg-gray-900 border rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer ${color.border}`}
                                >
                                    <DocumentThumbnail document={doc} />
                                    <div className="p-5">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className={`w-11 h-11 rounded-xl ${color.bg} ${color.text} flex items-center justify-center flex-shrink-0`}>
                                                <FileText className="w-5 h-5" />
                                            </div>
                                        </div>
                                        <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate mb-1" title={doc.fileName}>{doc.fileName}</h3>
                                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">
                                            <span>{formatSize(doc.fileSize)}</span>
                                            <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                                        </div>
                                        <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-3">
                                            <span>{doc.uploadedBy?.name || 'Unknown'}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key={doc._id}
                                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                    onClick={() => setSelectedDoc(doc)}
                                    className={`bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800/60 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors flex items-center justify-between ${selectedDoc?._id === doc._id ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                                >
                                    <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                                        <div className={`w-10 h-10 rounded-lg ${color.bg} ${color.text} flex items-center justify-center flex-shrink-0`}>
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{doc.fileName}</h3>
                                            <div className="md:hidden flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                                                <span>{formatSize(doc.fileSize)}</span>
                                                <span>•</span>
                                                <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                                                <span>•</span>
                                                <span className="truncate max-w-[100px]">{doc.uploadedBy?.name || 'Unknown'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Desktop Columns */}
                                    <div className="hidden md:flex items-center gap-4 flex-shrink-0 text-sm font-medium text-gray-600 dark:text-gray-400">
                                        <div className="w-36 truncate" title={doc.uploadedBy?.name || 'Unknown'}>{doc.uploadedBy?.name || 'Unknown'}</div>
                                        <div className="w-32">{new Date(doc.uploadDate).toLocaleDateString()}</div>
                                        <div className="w-24 uppercase">{formatSize(doc.fileSize)}</div>
                                    </div>


                                </motion.div>
                            );
                        })}
                    </motion.div>
                </AnimatePresence>
            )}

        {/* Document Preview Modal */}
        <AnimatePresence>
            {selectedDoc && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setSelectedDoc(null)}
                        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm cursor-pointer"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        {/* Header */}
                        <div className="flex items-start sm:items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-800/20">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-2 sm:truncate max-w-md">{selectedDoc.fileName}</h3>
                                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-200/60 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                            Vault Document
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setSelectedDoc(null)} className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-xl hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ml-4 sm:ml-0">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Info Column */}
                                <div className="space-y-6">
                                    <DocumentPreview document={selectedDoc} />

                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Description</p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium">{selectedDoc.description || 'No description provided.'}</p>
                                    </div>
                                    
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Metadata Tags</p>
                                            {selectedDoc.isAITagged && (
                                                <span className="text-[10px] font-bold text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 py-0.5 rounded uppercase tracking-wider">AI Tagged</span>
                                            )}
                                        </div>
                                        {(selectedDoc.tags?.length > 0) ? (
                                            <div className="flex flex-wrap gap-1.5 mb-3">
                                                {(expandedTags ? selectedDoc.tags : selectedDoc.tags.slice(0, 3)).map((t, i) => (
                                                    <span key={i} className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold uppercase tracking-wider group">
                                                        {t}
                                                    </span>
                                                ))}
                                                {!expandedTags && selectedDoc.tags.length > 3 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedTags(true)}
                                                        className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-[11px] font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                                                    >
                                                        +{selectedDoc.tags.length - 3}
                                                    </button>
                                                )}
                                                {expandedTags && selectedDoc.tags.length > 3 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedTags(false)}
                                                        className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-[11px] font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                                                    >
                                                        Show less
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-500 italic mb-3">No tags added yet.</p>
                                        )}
                                    </div>

                                    {/* Vaults Section */}
                                    {selectedDoc.metadata?.vaults && selectedDoc.metadata.vaults.filter(v => v.score >= VAULT_THRESHOLD).length > 0 && (
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Document Vaults</p>
                                            <div className="space-y-2.5">
                                                {selectedDoc.metadata.vaults.filter(v => v.score >= VAULT_THRESHOLD).map((vault) => {
                                                    const vaultColor = VAULT_COLOR;
                                                    const label = VAULT_LABELS[vault.vaultId] || vault.label;
                                                    return (
                                                        <div key={vault.vaultId} className={`p-3 rounded-lg border ${vaultColor.bg} ${vaultColor.border}`}>
                                                            <button
                                                              onClick={() => navigate(`/vaults/${vault.vaultId}`)}
                                                              className={`font-semibold text-sm ${vaultColor.text} hover:opacity-80 transition-opacity cursor-pointer`}
                                                            >
                                                                {label}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Metadata Column */}
                                <div className="bg-gray-50/50 dark:bg-gray-800/40 rounded-3xl p-6 border border-gray-100 dark:border-gray-800/60 space-y-4">
                                    {[
                                        { label: 'Uploader', value: selectedDoc.uploadedBy?.name || 'Unknown' },
                                        { label: 'Upload Date', value: new Date(selectedDoc.uploadDate).toLocaleDateString() },
                                        { label: 'File Size', value: formatSize(selectedDoc.fileSize) },
                                        { label: 'File Type', value: selectedDoc.mimeType },
                                    ].map(item => (
                                        <div key={item.label} className="flex justify-between items-center py-1">
                                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{item.label}</span>
                                            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[140px]">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-800/20 flex flex-wrap justify-end gap-3 sm:gap-4">
                            <Button className="flex-1 sm:flex-none border-none shadow-lg shadow-blue-500/20" onClick={() => handleDownload(selectedDoc)}>
                                <Download className="w-4 h-4 mr-2" />
                                Download
                            </Button>
                            <Button
                                variant="secondary"
                                className="flex-1 sm:flex-none"
                                onClick={() => setIsFullPreviewOpen(true)}
                            >
                                <Maximize2 className="w-4 h-4 mr-2" />
                                Open Preview
                            </Button>
                            <button 
                                onClick={() => setSelectedDoc(null)} 
                                className="flex-1 sm:flex-none px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        <FullPreviewModal
            isOpen={isFullPreviewOpen}
            onClose={() => setIsFullPreviewOpen(false)}
            document={selectedDoc}
            onDownload={handleDownload}
        />
        </div>
    );
}

// ─── Main VaultBrowser Page ────────────────────────────────────────────────────
export function VaultBrowser() {
    const { vaultId } = useParams();
    const navigate = useNavigate();
    const [vaults, setVaults] = useState([]);
    const { token } = useAuth();

    // Pre-load vault list so we can resolve vaultId → vault object
    useEffect(() => {
        const headers = { Authorization: `Bearer ${token || localStorage.getItem('dmr_token')}` };
        api.get(`${API_URL}/api/documents/vaults/list`, { headers })
            .then(res => setVaults(res.data.vaults || []))
            .catch(console.error);
    }, [token]);

    const selectedVault = vaultId ? vaults.find(v => v.id === vaultId) : null;

    const handleSelectVault = (vault) => navigate(`/vaults/${vault.id}`);
    const handleBack = () => navigate('/vaults');

    return (
        <div className="max-w-7xl mx-auto">
            {/* Page header */}
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                    🗂️ Vault Browser
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                    {vaultId && selectedVault
                        ? `Browsing documents in the "${selectedVault.label}" vault`
                        : 'Browse all documents organised by AI-assigned vault categories'}
                </p>
            </div>

            <AnimatePresence mode="wait">
                {!vaultId || !selectedVault ? (
                    <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <VaultListView onSelectVault={handleSelectVault} />
                    </motion.div>
                ) : (
                    <motion.div key={vaultId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <VaultDocumentView vault={selectedVault} onBack={handleBack} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
