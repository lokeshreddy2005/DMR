import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import API_URL from '../config/api';
import { useAuth } from '../context/AuthContext';
import { FileText, ChevronLeft, ChevronRight, ArrowLeft, LayoutGrid, List, X, Download, Share2, Trash2, Edit3, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { VAULT_ICONS, VAULT_COLOR, DEFAULT_VAULT_COLOR, VAULT_LABELS, VAULT_THRESHOLD } from '../constants/vaults';

const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatVaultPercent = (score) => `${(score * 100).toFixed(2)}%`;

// ─── Vault List View ───────────────────────────────────────────────────────────
function VaultListView({ onSelectVault }) {
    const { token } = useAuth();
    const [vaults, setVaults] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const headers = { Authorization: `Bearer ${token || localStorage.getItem('dmr_token')}` };
        Promise.all([
            axios.get(`${API_URL}/api/documents/vaults/list`, { headers }),
            axios.get(`${API_URL}/api/documents/vaults/stats`, { headers }),
        ]).then(([listRes, statsRes]) => {
            setVaults(listRes.data.vaults || []);
            const statsMap = {};
            (statsRes.data.vaultStats || []).forEach(s => { statsMap[s.vaultId] = s.count; });
            setStats(statsMap);
        }).catch(console.error)
          .finally(() => setLoading(false));
    }, [token]);

    if (loading) return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 13 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800/50 rounded-2xl h-32 border border-gray-200 dark:border-gray-800" />
            ))}
        </div>
    );

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {vaults.map(vault => {
                const color = VAULT_COLOR;
                const count = stats[vault.id] || 0;
                return (
                    <motion.button
                        key={vault.id}
                        onClick={() => onSelectVault(vault)}
                        whileHover={{ y: -3, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className={`text-left p-5 rounded-2xl border ${color.bg} ${color.border} shadow-sm hover:shadow-md transition-all duration-200 flex flex-col gap-3`}
                    >
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
                    </motion.button>
                );
            })}
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

    const currentPage = parseInt(searchParams.get('page') || '1', 10);
    const LIMIT = 20;

    const color = VAULT_COLOR;

    const fetchDocs = useCallback(async () => {
        setLoading(true);
        try {
            const headers = { Authorization: `Bearer ${token || localStorage.getItem('dmr_token')}` };
            const res = await axios.get(
                `${API_URL}/api/documents/vault/${vault.id}?page=${currentPage}&limit=${LIMIT}`,
                { headers }
            );
            setDocuments(res.data.documents || []);
            setTotalCount(res.data.totalCount || 0);
            setTotalPages(res.data.totalPages || 1);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [vault.id, currentPage, token]);

    useEffect(() => { fetchDocs(); }, [fetchDocs]);

    const goToPage = (p) => {
        const np = new URLSearchParams(searchParams);
        np.set('page', String(p));
        setSearchParams(np);
    };

    const startIndex = (currentPage - 1) * LIMIT;

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
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                                <button onClick={() => goToPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="p-1.5 text-gray-500 hover:text-blue-600 disabled:opacity-30 transition-colors">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="px-2 text-xs font-bold text-gray-700 dark:text-gray-300">{currentPage} / {totalPages}</span>
                                <button onClick={() => goToPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages} className="p-1.5 text-gray-500 hover:text-blue-600 disabled:opacity-30 transition-colors">
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
                        className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4' : 'flex flex-col gap-2'}
                    >
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
                                    className={`bg-white dark:bg-gray-900 border rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer ${color.border}`}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className={`w-11 h-11 rounded-xl ${color.bg} ${color.text} flex items-center justify-center flex-shrink-0`}>
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        {score !== null && (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${color.bg} ${color.text} ${color.border}`}>
                                                {score} match
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate mb-1" title={doc.fileName}>{doc.fileName}</h3>
                                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 font-medium mb-3">
                                        <span>{formatSize(doc.fileSize)}</span>
                                        <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                                    </div>
                                    {score !== null && (
                                        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1">
                                            <div className={`${color.bar} h-1 rounded-full`} style={{ width: score }} />
                                        </div>
                                    )}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key={doc._id}
                                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                    onClick={() => setSelectedDoc(doc)}
                                    className={`bg-white dark:bg-gray-900 border rounded-xl p-3 flex items-center gap-4 hover:shadow-sm transition-all cursor-pointer ${color.border}`}
                                >
                                    <div className={`w-9 h-9 rounded-lg ${color.bg} ${color.text} flex items-center justify-center flex-shrink-0`}>
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate">{doc.fileName}</h3>
                                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                            <span>{formatSize(doc.fileSize)}</span>
                                            <span>•</span>
                                            <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                                            <span>•</span>
                                            <span>{doc.uploadedBy?.name || 'Unknown'}</span>
                                        </div>
                                    </div>
                                    {score !== null && (
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${color.bg} ${color.text} ${color.border}`}>
                                            {score}
                                        </span>
                                    )}
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
                                                {selectedDoc.tags.map((t, i) => (
                                                    <span key={i} className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold uppercase tracking-wider group">
                                                        {t}
                                                    </span>
                                                ))}
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
                                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                                <span className={`font-semibold text-sm ${vaultColor.text}`}>
                                                                    {label}
                                                                </span>
                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${vaultColor.bg} ${vaultColor.text} border ${vaultColor.border}`}>
                                                                    {`${(vault.score * 100).toFixed(2)}%`}
                                                                </span>
                                                            </div>
                                                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                                                <div 
                                                                    className={`${vaultColor.bar} h-full rounded-full transition-all`}
                                                                    style={{ width: `${vault.score * 100}%` }}
                                                                />
                                                            </div>
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
        axios.get(`${API_URL}/api/documents/vaults/list`, { headers })
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
