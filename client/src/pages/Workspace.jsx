import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import API_URL from '../config/api';
import { Button } from '../components/ui/Button';
import { FileText, Download, Trash2, Search, Plus, FileUp, MoreVertical, Globe, Lock, Building2, Users, Edit3, Eye, X, LayoutGrid, List, ChevronLeft, ChevronRight, Share2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import UploadModal from '../components/UploadModal';
import ShareModal from '../components/ShareModal';
import AdvancedSearchPopover from '../components/AdvancedSearchPopover';

export function Workspace({ isPublicOnly = false, isSearchPage = false }) {
    const { spaceId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const { user, token } = useAuth();

    const activeSpace = isPublicOnly ? 'public' : isSearchPage ? 'search' : (spaceId || 'public');

    const [documents, setDocuments] = useState([]);
    const [orgs, setOrgs] = useState([]);
    const [selectedOrgId, setSelectedOrgId] = useState('');
    const [searchQuery, setSearchQuery] = useState(isSearchPage ? (searchParams.get('q') || '') : '');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [toast, setToast] = useState(null);
    const [viewMode, setViewMode] = useState('grid');
    const currentPage = parseInt(searchParams.get('page') || '1', 10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // Tagging & Moving state
    const [tagInput, setTagInput] = useState('');
    const [isMoving, setIsMoving] = useState(false);
    const [moveSpace, setMoveSpace] = useState('public');
    const [moveOrg, setMoveOrg] = useState('');
    const [moveAutoTag, setMoveAutoTag] = useState(false);
    const [isTaggingAI, setIsTaggingAI] = useState(false);

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3500);
    };

    const getAuthHeaders = () => {
        // AuthContext stores token as 'dmr_token'
        const t = token || localStorage.getItem('dmr_token');
        return t ? { Authorization: `Bearer ${t}` } : {};
    };

    // ─── Role colors for badges ───
    const ROLE_COLORS = {
        owner: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
        manager: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
        editor: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
        sharer: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', border: 'border-green-200 dark:border-green-800' },
        downloader: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800' },
        viewer: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-200 dark:border-gray-700' },
    };

    const getUserPerm = (doc) => {
        if (!user) return null;
        const uid = user._id || user.id;
        const perm = doc.permissions?.find(p => {
            const pu = p.user?._id || p.user?.id || p.user;
            return pu?.toString() === uid?.toString();
        });
        return perm || null;
    };

    const getAccessLevel = (doc) => {
        if (!user) return 'viewer';
        const uid = user._id || user.id;
        const uploaderId = doc.uploadedBy?._id || doc.uploadedBy?.id || doc.uploadedBy;
        if (uploaderId?.toString() === uid?.toString()) return 'owner';
        const perm = getUserPerm(doc);
        if (perm) {
            // Support both new `role` field and legacy `level` field
            if (perm.role) return perm.role;
            if (perm.level) return perm.level;
            return 'viewer';
        }
        return 'viewer';
    };

    // Get current user's permission entry including expiry
    const getUserPermExpiry = (doc) => {
        if (!user) return null;
        const uid = user._id || user.id;
        const perm = doc.permissions?.find(p => {
            const pu = p.user?._id || p.user?.id || p.user;
            return pu?.toString() === uid?.toString();
        });
        if (!perm?.expiresAt) return null;
        const exp = new Date(perm.expiresAt);
        const now = new Date();
        if (exp <= now) return { label: 'Expired', isExpired: true };
        const diffMs = exp - now;
        const hours = Math.floor(diffMs / (60 * 60 * 1000));
        if (hours < 1) return { label: `${Math.ceil(diffMs / (60 * 1000))}m left`, isExpired: false };
        if (hours < 24) return { label: `${hours}h left`, isExpired: false };
        return { label: `${Math.floor(hours / 24)}d left`, isExpired: false };
    };

    const canUserEdit = (doc) => {
        if (!user) return false;
        const uid = user._id || user.id;
        const uploaderId = doc.uploadedBy?._id || doc.uploadedBy?.id || doc.uploadedBy;
        if (uploaderId?.toString() === uid?.toString()) return true;
        const perm = getUserPerm(doc);
        if (!perm) return false;
        // Support new flags and legacy level
        if (perm.canEdit !== undefined) return perm.canEdit;
        return perm.level === 'owner' || perm.level === 'editor';
    };

    const canUserDelete = (doc) => {
        if (!user) return false;
        const uid = user._id || user.id;
        const uploaderId = doc.uploadedBy?._id || doc.uploadedBy?.id || doc.uploadedBy;
        if (uploaderId?.toString() === uid?.toString()) return true;
        const perm = getUserPerm(doc);
        if (!perm) return false;
        if (perm.canDelete !== undefined) return perm.canDelete;
        return perm.level === 'owner';
    };

    const fetchDocuments = useCallback(async (abortController, forceSearchQuery = null) => {
        setIsLoading(true);
        setError(null);
        try {
            const headers = getAuthHeaders();
            const params = new URLSearchParams(searchParams);

            const qToUse = forceSearchQuery !== null ? forceSearchQuery : searchQuery;
            
            if (qToUse && qToUse.trim()) {
                params.set('q', qToUse.trim());
            } else {
                params.delete('q');
            }

            if (!isPublicOnly && activeSpace === 'organization' && selectedOrgId) {
                params.set('space', 'organization');
                params.set('organizationId', selectedOrgId);
            } else if (!isPublicOnly && activeSpace !== 'search' && activeSpace !== 'public' && activeSpace !== 'recent') {
                params.set('space', activeSpace); // handles 'private', 'shared', 'shared-to-others'
            } else if (activeSpace === 'public' || activeSpace === 'search' || activeSpace === 'recent') {
                params.delete('organizationId');
            }

            const queryStr = params.toString();
            const isPublicRequest = isPublicOnly || activeSpace === 'public';
            let endpoint = isPublicRequest ? '/api/public/documents' : '/api/documents';
            if (activeSpace === 'recent') endpoint = '/api/documents/recent-activity';

            const url = `${API_URL}${endpoint}${queryStr ? '?' + queryStr : ''}`;

            const res = await axios.get(url, {
                ...(isPublicRequest ? {} : { headers }),
                signal: abortController?.signal
            });

            setDocuments(res.data.documents || []);
            setTotalPages(res.data.totalPages || 1);
            setTotalCount(res.data.totalCount || 0);

        } catch (err) {
            if (axios.isCancel(err)) return;
            console.error('fetchDocuments error:', err);
            setError(err.response?.data?.error || 'Failed to load documents.');
            setDocuments([]);
        } finally {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSpace, selectedOrgId, isPublicOnly, searchQuery, searchParams, token]);

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

    // Effect to clear selection when space changes
    useEffect(() => {
        if (searchQuery && activeSpace !== 'search') {
            skipSearchEffect.current = true;
            setSearchQuery('');
        }
        setDocuments([]);
        setSelectedDoc(null);
        setIsMoving(false);
        if (!isPublicOnly && activeSpace === 'organization') {
            fetchOrgs();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSpace]);

    // Escape key to close document modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (isShareOpen) { setIsShareOpen(false); return; }
                if (isUploadOpen) { setIsUploadOpen(false); return; }
                if (selectedDoc) { setSelectedDoc(null); return; }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [selectedDoc, isShareOpen, isUploadOpen]);

    // Fetch documents on activeSpace, searchParams, or selectedOrgId changes
    useEffect(() => {
        if (activeSpace === 'organization' && !selectedOrgId) return;
        const controller = new AbortController();
        
        // Use the query directly from searchParams if possible, to avoid stale state
        const urlQ = searchParams.get('q');
        
        // If we just mapped away from search, or the URL search is different from state, prioritize URL/None
        if (activeSpace !== 'search' && !urlQ) {
            fetchDocuments(controller, '');
        } else {
            fetchDocuments(controller, urlQ !== null ? urlQ : null);
        }

        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSpace, selectedOrgId, searchParams]);

    // Sync URL param to state if it changes externally
    useEffect(() => {
        const urlQ = searchParams.get('q') || '';
        if (urlQ !== searchQuery) {
            setSearchQuery(urlQ);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const isFirstSearchRun = useRef(true);
    const skipSearchEffect = useRef(false);
    // Debounced search for public space
    useEffect(() => {
        if (isFirstSearchRun.current) {
            isFirstSearchRun.current = false;
            return;
        }
        if (skipSearchEffect.current) {
            skipSearchEffect.current = false;
            return;
        }
        if (activeSpace !== 'public' && activeSpace !== 'search') return;

        if (isSearchPage && searchQuery) {
            setSearchParams({ q: searchQuery }, { replace: true });
        }

        const t = setTimeout(() => fetchDocuments(), 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery]);

    const handleDownload = async (doc) => {
        try {
            const headers = getAuthHeaders();
            // Always use the authenticated endpoint when a token exists — this logs the
            // RecentAccess entry. Fall back to the public endpoint only for anon users.
            const useAuth = !!token;
            const url = useAuth
                ? `${API_URL}/api/documents/${doc._id}/download`
                : `${API_URL}/api/public/documents/${doc._id}/download`;
            const res = await axios.get(url, useAuth ? { headers } : {});
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

    const handleMoveSpaceSubmit = async () => {
        if (!moveSpace) return;
        if (moveSpace === 'organization' && !moveOrg) return;

        try {
            const headers = getAuthHeaders();
            const payload = { targetSpace: moveSpace, organizationId: moveOrg, autoTag: moveAutoTag };
            const res = await axios.put(`${API_URL}/api/documents/${selectedDoc._id}/change-space`, payload, { headers });
            showToast('success', res.data.message || 'Document moved successfully!');
            fetchDocuments();
            setSelectedDoc(null);
            setIsMoving(false);
        } catch (err) { showToast('error', err.response?.data?.error || 'Failed to move document.'); }
    };

    const handleAddTag = async (e) => {
        if (e.key !== 'Enter' || !tagInput.trim() || !selectedDoc) return;
        e.preventDefault();
        const currentTags = selectedDoc.tags || [];
        const newTag = tagInput.trim();
        if (currentTags.includes(newTag)) return setTagInput('');
        try {
            const newTags = [...currentTags, newTag];
            const headers = getAuthHeaders();
            const res = await axios.put(`${API_URL}/api/documents/${selectedDoc._id}/tags`, { tags: newTags }, { headers });
            setSelectedDoc(res.data.document);
            setDocuments(docs => docs.map(d => d._id === res.data.document._id ? res.data.document : d));
            setTagInput('');
        } catch (err) { showToast('error', 'Failed to add tag.'); }
    };

    const handleRemoveTag = async (tagToRemove) => {
        if (!selectedDoc) return;
        try {
            const newTags = selectedDoc.tags.filter(t => t !== tagToRemove);
            const headers = getAuthHeaders();
            const res = await axios.put(`${API_URL}/api/documents/${selectedDoc._id}/tags`, { tags: newTags }, { headers });
            setSelectedDoc(res.data.document);
            setDocuments(docs => docs.map(d => d._id === res.data.document._id ? res.data.document : d));
        } catch (err) { showToast('error', 'Failed to remove tag.'); }
    };

    const handleAITag = async () => {
        if (!selectedDoc) return;
        setIsTaggingAI(true);
        try {
            const headers = getAuthHeaders();
            const res = await axios.post(`${API_URL}/api/documents/${selectedDoc._id}/tags/ai`, {}, { headers });
            setSelectedDoc(res.data.document);
            setDocuments(docs => docs.map(d => d._id === res.data.document._id ? res.data.document : d));
            showToast('success', 'AI Auto-tagging complete!');
        } catch (err) { showToast('error', 'AI Tagging failed.'); } finally {
            setIsTaggingAI(false);
        }
    };

    const formatSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const itemsPerPage = 20; // Server limit is default 20
    const totalItems = totalCount;
    // Client side slicing removed - server handles pagination
    const paginatedDocuments = documents;
    const startIndex = (currentPage - 1) * itemsPerPage;

    const spaceLabel = isSearchPage ? 'Search Results' : activeSpace === 'shared' ? 'Shared with Me' : activeSpace === 'recent' ? 'Recently Accessed' : `${activeSpace.charAt(0).toUpperCase() + activeSpace.slice(1)} Space`;

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
                        {activeSpace === 'recent' && <Clock className="w-8 h-8 text-rose-500" />}
                        {isSearchPage && <Search className="w-8 h-8 text-blue-500" />}
                        {spaceLabel}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                        {activeSpace === 'public' && 'All publicly available documents.'}
                        {activeSpace === 'private' && 'Documents you have uploaded privately.'}
                        {activeSpace === 'shared' && 'Documents others have shared with you.'}
                        {activeSpace === 'organization' && 'Documents within your organizations.'}
                        {activeSpace === 'recent' && 'Documents you have recently viewed or modified.'}
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm pr-1 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                        <div className="relative flex-1 md:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder={`Search in ${spaceLabel}...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-9 py-2.5 bg-transparent border-none focus:ring-0 outline-none text-sm"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('');
                                        const np = new URLSearchParams(searchParams);
                                        np.delete('q');
                                        np.set('page', '1');
                                        setSearchParams(np, { replace: true });
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 mx-1"></div>
                        <AdvancedSearchPopover activeSpace={activeSpace} isPublicOnly={isPublicOnly} />
                    </div>
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl flex-shrink-0">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            title="Grid View"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            title="List View"
                        >
                            <List className="w-4 h-4" />
                        </button>
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
                <div className="mb-6 flex flex-wrap items-center gap-2 overflow-x-auto pb-2 flex-shrink-0">
                    {orgs.length === 0 ? (
                        <p className="text-sm text-gray-400 py-1">You are not a member of any organization.</p>
                    ) : orgs.map(org => (
                        <button
                            key={org._id}
                            onClick={() => setSelectedOrgId(org._id)}
                            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex items-center justify-center ${selectedOrgId === org._id
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 ring-1 ring-purple-500/50 shadow-sm'
                                : 'bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
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
                <div className="flex-1 min-w-0 overflow-y-auto pr-2 pb-24">
                    {!isLoading && !error && totalItems > 0 && (
                        <div className="flex items-center justify-end mb-4 mt-1">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg shadow-sm tracking-wide">
                                    Showing <span className="font-bold text-gray-900 dark:text-white">{startIndex + 1}</span> - <span className="font-bold text-gray-900 dark:text-white">{Math.min(startIndex + itemsPerPage, totalItems)}</span> of <span className="font-bold text-blue-600 dark:text-blue-400">{totalItems}</span>
                                </span>

                                {totalPages > 1 && (
                                    <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                                        <button
                                            onClick={() => {
                                                const newParams = new URLSearchParams(searchParams);
                                                newParams.set('page', Math.max(1, currentPage - 1).toString());
                                                setSearchParams(newParams);
                                            }}
                                            disabled={currentPage <= 1}
                                            className="p-1.5 text-gray-500 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700"></div>
                                        <button
                                            onClick={() => {
                                                const newParams = new URLSearchParams(searchParams);
                                                newParams.set('page', Math.min(totalPages, currentPage + 1).toString());
                                                setSearchParams(newParams);
                                            }}
                                            disabled={currentPage >= totalPages}
                                            className="p-1.5 text-gray-500 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
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
                    ) : paginatedDocuments.length > 0 ? (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={viewMode}
                                initial="hidden" animate="visible" exit="exit"
                                variants={{
                                    hidden: { opacity: 0 },
                                    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
                                    exit: { opacity: 0, transition: { duration: 0.15 } }
                                }}
                                className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4" : "flex flex-col gap-2"}
                            >
                                {paginatedDocuments.map(doc => {
                                    const accessLevel = getAccessLevel(doc);
                                    return viewMode === 'grid' ? (
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
                                                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                                    {isSearchPage && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 uppercase tracking-wider border border-gray-200 dark:border-gray-700">
                                                            {doc.space}
                                                        </span>
                                                    )}
                                                    {(() => {
                                                        const expiry = getUserPermExpiry(doc);
                                                        if (!expiry) return null;
                                                        return (
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${expiry.isExpired ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800'}`}
                                                                title="Access time remaining">
                                                                ⏱ {expiry.label}
                                                            </span>
                                                        );
                                                    })()}
                                                    {(() => {
                                                        const rc = ROLE_COLORS[accessLevel] || ROLE_COLORS.viewer; return (
                                                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${rc.bg} ${rc.text} ${rc.border}`} title={`${accessLevel} access`}>
                                                                {accessLevel === 'owner' || accessLevel === 'manager' || accessLevel === 'editor' ? <Edit3 className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                                {accessLevel}
                                                            </span>
                                                        );
                                                    })()}
                                                    <button
                                                        className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedDoc(doc._id === selectedDoc?._id ? null : doc);
                                                        }}
                                                        title="More actions"
                                                    >
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
                                    ) : (
                                        <motion.div
                                            key={doc._id}
                                            variants={{ hidden: { opacity: 0, x: -10 }, visible: { opacity: 1, x: 0 } }}
                                            onClick={() => setSelectedDoc(doc._id === selectedDoc?._id ? null : doc)}
                                            className={`group bg-white dark:bg-gray-900 border rounded-xl p-3 cursor-pointer transition-all duration-200 hover:shadow-sm flex items-center justify-between ${selectedDoc?._id === doc._id
                                                ? 'border-blue-500 ring-1 ring-blue-500 shadow-sm'
                                                : 'border-gray-200 dark:border-gray-800'
                                                }`}
                                        >
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <div className="flex flex-col min-w-0 flex-1 pr-4">
                                                    <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate" title={doc.fileName}>{doc.fileName}</h3>
                                                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider font-semibold">
                                                        <span>{formatSize(doc.fileSize)}</span>
                                                        <span>•</span>
                                                        <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 flex-shrink-0">
                                                {doc.isTagged && doc.metadata?.typeTags?.length > 0 && (
                                                    <div className="hidden md:flex flex-wrap gap-1.5 max-w-[200px] overflow-hidden">
                                                        {doc.metadata.typeTags.slice(0, 1).map((tag, i) => (
                                                            <span key={i} className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider truncate">{tag}</span>
                                                        ))}
                                                        {doc.metadata.typeTags.length > 1 && <span className="text-[10px] text-gray-400 font-bold">+{doc.metadata.typeTags.length - 1}</span>}
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-2">
                                                    {isSearchPage && (
                                                        <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 uppercase tracking-wider border border-gray-200 dark:border-gray-700">
                                                            {doc.space}
                                                        </span>
                                                    )}
                                                    {(() => {
                                                        const rc = ROLE_COLORS[accessLevel] || ROLE_COLORS.viewer; return (
                                                            <span className={`hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${rc.bg} ${rc.text} ${rc.border}`} title={`${accessLevel} access`}>
                                                                {accessLevel}
                                                            </span>
                                                        );
                                                    })()}
                                                    <button
                                                        className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedDoc(doc._id === selectedDoc?._id ? null : doc);
                                                        }}
                                                        title="More actions"
                                                    >
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </motion.div>
                        </AnimatePresence>
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

                {/* Details Modal — hidden while ShareModal is open */}
                <AnimatePresence>
                    {selectedDoc && !isShareOpen && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                            {/* Modal Overlay Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setSelectedDoc(null)}
                                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm cursor-pointer"
                            />
                            
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                            >
                                {/* Header */}
                                <div className="flex items-start sm:items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-800/20">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                                            <FileText className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-2 sm:truncate max-w-md" title={selectedDoc.fileName}>{selectedDoc.fileName}</h3>
                                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-200/60 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                                    {selectedDoc.space} Space
                                                </span>
                                                {(() => { const role = getAccessLevel(selectedDoc); const rc = ROLE_COLORS[role] || ROLE_COLORS.viewer; return (
                                                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${rc.bg} ${rc.text} ${rc.border}`} title={`${role} access`}>
                                                        {role === 'owner' || role === 'manager' || role === 'editor' ? <Edit3 className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                        {role}
                                                    </span>
                                                ); })()}
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
                                                            <span key={i} className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg text-[11px] font-bold uppercase tracking-wider group">
                                                                {t}
                                                                {canUserEdit(selectedDoc) && (
                                                                    <button type="button" onClick={() => handleRemoveTag(t)} className="opacity-50 hover:opacity-100 hover:text-blue-800 dark:hover:text-blue-200 transition-opacity">
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                )}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-500 italic mb-3">No tags added yet.</p>
                                                )}
                                                {canUserEdit(selectedDoc) && (
                                                    <div className="flex flex-col gap-2 relative">
                                                        <input
                                                            type="text"
                                                            value={tagInput}
                                                            onChange={e => setTagInput(e.target.value)}
                                                            onKeyDown={handleAddTag}
                                                            placeholder="Type tag & Enter..."
                                                            className="w-full text-xs px-3 py-2 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white"
                                                        />
                                                        <button
                                                            onClick={handleAITag}
                                                            disabled={isTaggingAI}
                                                            className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2 bg-purple-50 hover:bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 dark:text-purple-400 rounded-lg transition-colors border border-purple-100 dark:border-purple-800/50 shadow-sm"
                                                        >
                                                            {isTaggingAI ? <span className="animate-pulse flex items-center gap-2"><div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div> Analyzing...</span> : <>✨ Auto-tag with AI</>}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Metadata Column */}
                                        <div className="flex flex-col gap-4">
                                            <div className="bg-gray-50/50 dark:bg-gray-800/40 rounded-3xl p-6 border border-gray-100 dark:border-gray-800/60 space-y-4">
                                                {[
                                                    { label: 'Uploader', value: selectedDoc.uploadedBy?.name || 'Unknown' },
                                                    { label: 'Upload Date', value: new Date(selectedDoc.uploadDate).toLocaleDateString() },
                                                    { label: 'File Size', value: formatSize(selectedDoc.fileSize) },
                                                    { label: 'File Type', value: selectedDoc.mimeType },
                                                ].map(item => (
                                                    <div key={item.label} className="flex justify-between items-center py-1.5">
                                                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{item.label}</span>
                                                        <span className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[140px]">{item.value}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {isMoving && (
                                                <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3 animate-fade-in-up">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Move To</span>
                                                        <button onClick={() => setIsMoving(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded p-1 transition-colors"><X className="w-3 h-3" /></button>
                                                    </div>
                                                    <select value={moveSpace} onChange={e => setMoveSpace(e.target.value)} className="w-full text-sm p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500">
                                                        <option value="public">Public Space</option>
                                                        {orgs.length > 0 && <option value="organization">Organization Space</option>}
                                                    </select>
                                                    {moveSpace === 'organization' && (
                                                        <select value={moveOrg} onChange={e => setMoveOrg(e.target.value)} className="w-full text-sm p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500">
                                                            <option value="">Select Organization...</option>
                                                            {orgs.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
                                                        </select>
                                                    )}
                                                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer pt-1">
                                                        <input type="checkbox" checked={moveAutoTag} onChange={e => setMoveAutoTag(e.target.checked)} className="rounded text-blue-600 border-gray-300 dark:border-gray-600 dark:bg-gray-700" />
                                                        Run AI Auto-tagging
                                                    </label>
                                                    <Button className="w-full py-2.5 mt-1 text-sm shadow-sm" onClick={handleMoveSpaceSubmit}>Confirm Move</Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="p-6 border-t border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-800/20 flex flex-wrap gap-3">
                                    <Button className="flex-1 sm:flex-none border-none shadow-lg shadow-blue-500/20" onClick={() => handleDownload(selectedDoc)}>
                                        <Download className="w-4 h-4 mr-2" /> Download Document
                                    </Button>

                                    {!isPublicOnly && (getAccessLevel(selectedDoc) === 'owner' || getAccessLevel(selectedDoc) === 'manager') && (
                                        <Button
                                            className="flex-1 sm:flex-none bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 shadow-sm border border-blue-200 dark:border-blue-800/50 transition-colors"
                                            onClick={() => setIsShareOpen(true)}
                                        >
                                            <Share2 className="w-4 h-4 mr-2" /> Share
                                        </Button>
                                    )}
                                    {!isPublicOnly && canUserEdit(selectedDoc) && !isMoving && (
                                        <Button
                                            className="flex-1 sm:flex-none bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 shadow-sm border border-emerald-200 dark:border-emerald-800/50 transition-colors"
                                            onClick={() => setIsMoving(true)}
                                        >
                                            <Globe className="w-4 h-4 mr-2" /> Move
                                        </Button>
                                    )}

                                    {!isPublicOnly && canUserDelete(selectedDoc) && (
                                        <Button variant="danger" className="flex-1 sm:flex-none sm:ml-auto shadow-sm" onClick={() => handleDelete(selectedDoc._id)}>
                                            <Trash2 className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Delete</span>
                                        </Button>
                                    )}
                                </div>
                            </motion.div>
                        </div>
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
                onClose={() => setIsUploadOpen(false)}
                onUploadSuccess={() => fetchDocuments()}
                defaultSpace={(activeSpace === 'shared' || isSearchPage) ? null : activeSpace}
                defaultOrgId={selectedOrgId}
            />
            <ShareModal
                isOpen={isShareOpen}
                onClose={() => setIsShareOpen(false)}
                document={selectedDoc}
                onUpdate={(updatedDoc) => {
                    setSelectedDoc(updatedDoc);
                    setDocuments(docs => docs.map(d => d._id === updatedDoc._id ? updatedDoc : d));
                }}
            />
        </div>
    );
}
