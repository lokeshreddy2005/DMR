import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import API_URL from '../config/api';
import { Button } from '../components/ui/Button';
import { FileText, Download, Trash2, Search, Plus, FileUp, MoreVertical, Globe, Lock, Building2, Users, Edit3, Eye, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import UploadModal from '../components/UploadModal';

export function Workspace({ isPublicOnly = false }) {
    const { spaceId } = useParams();
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const activeSpace = isPublicOnly ? 'public' : (spaceId || 'public');

    const [documents, setDocuments] = useState([]);
    const [orgs, setOrgs] = useState([]);
    const [selectedOrgId, setSelectedOrgId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [toast, setToast] = useState(null);

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3500);
    };

    const getAuthHeaders = () => {
        // AuthContext stores token as 'dmr_token'
        const t = token || localStorage.getItem('dmr_token');
        return t ? { Authorization: `Bearer ${t}` } : {};
    };

    const getAccessLevel = (doc) => {
        if (!user) return 'Read';
        const uid = user._id;
        const uploaderId = doc.uploadedBy?._id || doc.uploadedBy;
        if (uploaderId?.toString() === uid?.toString()) return 'Write';
        const perm = doc.permissions?.find(p => {
            const pu = p.user?._id || p.user;
            return pu?.toString() === uid?.toString();
        });
        if (perm && (perm.level === 'owner' || perm.level === 'editor')) return 'Write';
        return 'Read';
    };

    const fetchDocuments = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // --- PUBLIC space: no auth required ---
            if (isPublicOnly || activeSpace === 'public') {
                let url = `${API_URL}/api/public/documents`;
                if (searchQuery.trim()) {
                    url = `${API_URL}/api/public/documents/search?q=${encodeURIComponent(searchQuery.trim())}`;
                }
                const res = await axios.get(url);
                setDocuments(res.data.documents || []);
                return;
            }

            // --- Authenticated spaces ---
            const headers = getAuthHeaders();

            if (activeSpace === 'organization') {
                if (!selectedOrgId) {
                    setDocuments([]);
                    return;
                }
                const res = await axios.get(
                    `${API_URL}/api/documents?space=organization&organizationId=${selectedOrgId}`,
                    { headers }
                );
                setDocuments(res.data.documents || []);
            } else {
                // private | shared
                const res = await axios.get(
                    `${API_URL}/api/documents?space=${activeSpace}`,
                    { headers }
                );
                setDocuments(res.data.documents || []);
            }
        } catch (err) {
            console.error('fetchDocuments error:', err);
            setError(err.response?.data?.error || 'Failed to load documents.');
            setDocuments([]);
        } finally {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSpace, selectedOrgId, isPublicOnly, searchQuery, token]);

    const fetchOrgs = useCallback(async () => {
        if (isPublicOnly || activeSpace !== 'organization') return;
        try {
            const headers = getAuthHeaders();
            const res = await axios.get(`${API_URL}/api/orgs`, { headers });
            const list = res.data.organizations || [];
            setOrgs(list);
            if (list.length > 0 && !selectedOrgId) {
                setSelectedOrgId(list[0]._id);
            }
        } catch (err) { console.error('fetchOrgs error:', err); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPublicOnly, activeSpace, token]);

    // Fetch orgs when entering organization space, then fetchDocuments
    useEffect(() => {
        setDocuments([]);
        setSelectedDoc(null);
        if (!isPublicOnly && activeSpace === 'organization') {
            fetchOrgs();
        } else {
            fetchDocuments();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSpace]);

    // After org is selected, fetch documents for that org
    useEffect(() => {
        if (activeSpace === 'organization' && selectedOrgId) {
            fetchDocuments();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedOrgId]);

    // Debounced search for public space
    useEffect(() => {
        if (activeSpace !== 'public') return;
        const t = setTimeout(() => fetchDocuments(), 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery]);

    const handleDownload = async (doc) => {
        try {
            const headers = getAuthHeaders();
            const url = doc.space === 'public'
                ? `${API_URL}/api/public/documents/${doc._id}/download`
                : `${API_URL}/api/documents/${doc._id}/download`;
            const res = await axios.get(url, { headers });
            window.open(res.data.downloadUrl, '_blank');
        } catch (err) { showToast('error', 'Download failed.'); }
    };

    const handleDelete = async (docId) => {
        if (!confirm('Permanently delete this document?')) return;
        try {
            const headers = getAuthHeaders();
            await axios.delete(`${API_URL}/api/documents/${docId}`, { headers });
            showToast('success', 'Document deleted.');
            fetchDocuments();
            if (selectedDoc?._id === docId) setSelectedDoc(null);
        } catch (err) { showToast('error', err.response?.data?.error || 'Delete failed.'); }
    };

    const handleMakePublic = async (docId) => {
        if (!confirm('Make this document public?')) return;
        try {
            const headers = getAuthHeaders();
            const res = await axios.put(`${API_URL}/api/documents/${docId}/make-public`, {}, { headers });
            showToast('success', res.data.message || 'Document is now public!');
            fetchDocuments();
            setSelectedDoc(null);
        } catch (err) { showToast('error', err.response?.data?.error || 'Failed to make public.'); }
    };

    const formatSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // Local filter for authenticated spaces (instant search)
    const displayedDocuments = (activeSpace === 'public' || !searchQuery.trim())
        ? documents
        : documents.filter(doc =>
            doc.fileName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
            doc.description?.toLowerCase().includes(searchQuery.toLowerCase())
        );

    const spaceLabel = activeSpace === 'shared' ? 'Shared with Me' : `${activeSpace.charAt(0).toUpperCase() + activeSpace.slice(1)} Space`;

    return (
        <div className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                        {activeSpace === 'public' && <Globe className="w-8 h-8 text-emerald-500" />}
                        {activeSpace === 'private' && <Lock className="w-8 h-8 text-blue-500" />}
                        {activeSpace === 'shared' && <Users className="w-8 h-8 text-orange-500" />}
                        {activeSpace === 'organization' && <Building2 className="w-8 h-8 text-purple-500" />}
                        {spaceLabel}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                        {activeSpace === 'public' && 'All publicly available documents.'}
                        {activeSpace === 'private' && 'Documents you have uploaded privately.'}
                        {activeSpace === 'shared' && 'Documents others have shared with you.'}
                        {activeSpace === 'organization' && 'Documents within your organizations.'}
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search files..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm shadow-sm transition-all"
                        />
                    </div>
                    {!isPublicOnly && (
                        <Button onClick={() => setIsUploadOpen(true)} className="flex-shrink-0 shadow-lg shadow-blue-500/20">
                            <FileUp className="w-4 h-4 mr-2" /> Upload
                        </Button>
                    )}
                </div>
            </div>

            {/* Org Selector */}
            {!isPublicOnly && activeSpace === 'organization' && (
                <div className="mb-6 flex flex-wrap gap-2 overflow-x-auto pb-2 flex-shrink-0">
                    {orgs.length === 0 ? (
                        <p className="text-sm text-gray-400 py-2">You are not a member of any organization.</p>
                    ) : orgs.map(org => (
                        <button
                            key={org._id}
                            onClick={() => setSelectedOrgId(org._id)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${selectedOrgId === org._id
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 ring-2 ring-purple-500/50'
                                : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50'
                                }`}
                        >
                            {org.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex gap-6 overflow-hidden relative">
                {/* File Grid */}
                <div className="flex-1 overflow-y-auto pr-2 pb-24">
                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800/50 rounded-2xl h-48 border border-gray-200 dark:border-gray-800" />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                                <X className="w-8 h-8 text-red-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Failed to Load</h3>
                            <p className="text-sm text-gray-500 mb-4">{error}</p>
                            <Button onClick={fetchDocuments}>Retry</Button>
                        </div>
                    ) : displayedDocuments.length > 0 ? (
                        <motion.div
                            initial="hidden" animate="visible"
                            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
                            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4"
                        >
                            {displayedDocuments.map(doc => {
                                const accessLevel = getAccessLevel(doc);
                                return (
                                    <motion.div
                                        key={doc._id}
                                        variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                                        onClick={() => setSelectedDoc(doc._id === selectedDoc?._id ? null : doc)}
                                        className={`group bg-white dark:bg-gray-900 border rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 ${selectedDoc?._id === doc._id
                                            ? 'border-blue-500 ring-1 ring-blue-500 shadow-md'
                                            : 'border-gray-200 dark:border-gray-800 shadow-sm'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                                <FileText className="w-6 h-6" />
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                {accessLevel === 'Write' ? (
                                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 uppercase tracking-wider border border-purple-200 dark:border-purple-800" title="You have Write access">
                                                        <Edit3 className="w-3 h-3" /> Write
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 uppercase tracking-wider border border-gray-200 dark:border-gray-700" title="Read-only access">
                                                        <Eye className="w-3 h-3" /> Read
                                                    </span>
                                                )}
                                                <button className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors" onClick={e => e.stopPropagation()}>
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate mb-1" title={doc.fileName}>{doc.fileName}</h3>
                                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
                                            <span>{formatSize(doc.fileSize)}</span>
                                            <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                                        </div>
                                        {doc.isTagged && doc.metadata?.typeTags?.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-1.5 overflow-hidden max-h-6">
                                                {doc.metadata.typeTags.slice(0, 2).map((tag, i) => (
                                                    <span key={i} className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider truncate">{tag}</span>
                                                ))}
                                                {doc.metadata.typeTags.length > 2 && <span className="text-[10px] text-gray-400 font-bold">+{doc.metadata.typeTags.length - 2}</span>}
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-center max-w-md mx-auto">
                            <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center text-gray-400 mb-6">
                                <Search className="w-10 h-10" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No documents found</h3>
                            <p className="text-gray-500 dark:text-gray-400 mb-6">
                                {searchQuery ? `No results for "${searchQuery}".` : 'This space is empty. Upload a document to get started.'}
                            </p>
                            {!isPublicOnly && activeSpace !== 'shared' && (
                                <Button onClick={() => setIsUploadOpen(true)}>Upload Document</Button>
                            )}
                        </div>
                    )}
                </div>

                {/* Details Sidebar */}
                <AnimatePresence>
                    {selectedDoc && (
                        <motion.div
                            initial={{ x: 300, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 300, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="hidden lg:flex w-80 flex-shrink-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm flex-col overflow-hidden h-full"
                        >
                            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/20">
                                <h4 className="font-bold text-gray-900 dark:text-white">Document Details</h4>
                                <button onClick={() => setSelectedDoc(null)} className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <div className="flex justify-center p-6 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30">
                                    <FileText className="w-16 h-16 text-blue-500" />
                                </div>

                                <div>
                                    <h3 className="font-extrabold text-lg text-gray-900 dark:text-white leading-tight mb-2">{selectedDoc.fileName}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{selectedDoc.description || 'No description provided.'}</p>
                                </div>

                                <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-800">
                                    {[
                                        { label: 'Access', value: getAccessLevel(selectedDoc) === 'Write' ? '✏️ Write (Editor)' : '👁️ Read-only' },
                                        { label: 'Space', value: selectedDoc.space },
                                        { label: 'Type', value: selectedDoc.mimeType },
                                        { label: 'Size', value: formatSize(selectedDoc.fileSize) },
                                        { label: 'Uploaded', value: new Date(selectedDoc.uploadDate).toLocaleDateString() },
                                        { label: 'Uploaded By', value: selectedDoc.uploadedBy?.name || 'Unknown' },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="flex justify-between py-2.5">
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</span>
                                            <span className="text-sm font-semibold text-gray-900 dark:text-white capitalize truncate max-w-[140px]">{value}</span>
                                        </div>
                                    ))}
                                </div>

                                {selectedDoc.tags?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Tags</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {selectedDoc.tags.map((t, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-[10px] uppercase font-bold text-gray-600 dark:text-gray-300">{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col gap-2">
                                <Button className="w-full" onClick={() => handleDownload(selectedDoc)}>
                                    <Download className="w-4 h-4 mr-2" /> Download
                                </Button>
                                {!isPublicOnly && activeSpace !== 'public' && getAccessLevel(selectedDoc) === 'Write' && (
                                    <>
                                        <Button
                                            className="w-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 shadow-none border border-emerald-200 dark:border-emerald-800/50"
                                            onClick={() => handleMakePublic(selectedDoc._id)}
                                        >
                                            <Globe className="w-4 h-4 mr-2" /> Make Public
                                        </Button>
                                        <Button variant="danger" className="w-full" onClick={() => handleDelete(selectedDoc._id)}>
                                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                                        </Button>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Toasts */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                        className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-xl z-50 font-bold backdrop-blur-md border ${toast.type === 'error' ? 'bg-red-500/90 text-white border-red-600' : 'bg-emerald-500/90 text-white border-emerald-600'
                            }`}
                    >
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Upload Modal */}
            <UploadModal
                isOpen={isUploadOpen}
                onClose={() => { setIsUploadOpen(false); fetchDocuments(); }}
                onUploadSuccess={() => fetchDocuments()}
                defaultSpace={activeSpace !== 'public' && activeSpace !== 'shared' ? activeSpace : 'private'}
                defaultOrgId={selectedOrgId}
            />
        </div>
    );
}
