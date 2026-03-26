import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import API_URL from '../config/api';
import UploadModal from './UploadModal';


function Dashboard({ publicOnly = false }) {
    const [activeSpace, setActiveSpace] = useState('public');
    const [documents, setDocuments] = useState([]);
    const [stats, setStats] = useState({});
    const [storage, setStorage] = useState(null);
    const [orgs, setOrgs] = useState([]);
    const [selectedOrg, setSelectedOrg] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showUpload, setShowUpload] = useState(false);
    const [showOrgForm, setShowOrgForm] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');
    const [newOrgDesc, setNewOrgDesc] = useState('');
    const [showAddMember, setShowAddMember] = useState(false);
    const [memberEmail, setMemberEmail] = useState('');
    const [memberRole, setMemberRole] = useState('member');
    const [docDetail, setDocDetail] = useState(null);
    const [shareEmail, setShareEmail] = useState('');
    const [shareLevel, setShareLevel] = useState('viewer');
    const [message, setMessage] = useState({ type: '', text: '' });
    // Search & tags
    const [searchQuery, setSearchQuery] = useState('');


    const fetchAll = useCallback(async () => {
        if (publicOnly) {
            setLoading(true);
            try {
                const [docsRes] = await Promise.all([
                    axios.get(`${API_URL}/api/public/documents`),
                ]);
                setDocuments(docsRes.data.documents || []);
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
            return;
        }
        setLoading(true);
        try {
            const [statsRes, storageRes, orgsRes] = await Promise.all([
                axios.get(`${API_URL}/api/documents/stats`),
                axios.get(`${API_URL}/api/documents/storage`),
                axios.get(`${API_URL}/api/orgs`),
            ]);
            setStats(statsRes.data.stats || {});
            setStorage(storageRes.data.storage || null);
            setOrgs(orgsRes.data.organizations || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, [publicOnly]);

    const fetchDocs = useCallback(async () => {
        try {
            if (publicOnly || (activeSpace === 'public' && searchQuery.trim())) {
                let url = '/api/public/documents';
                if (searchQuery.trim()) {
                    url = `/api/public/documents/search?q=${encodeURIComponent(searchQuery)}`;
                }
                const res = await axios.get(url);
                setDocuments(res.data.documents || []);
                return;
            }
            let url = '/api/documents';
            if (activeSpace === 'organization' && selectedOrg) {
                url += `?space=organization&organizationId=${selectedOrg._id}`;
            } else if (activeSpace !== 'organization') {
                url += `?space=${activeSpace}`;
            }
            const res = await axios.get(url);
            setDocuments(res.data.documents || []);
        } catch (err) { console.error(err); }
    }, [activeSpace, selectedOrg, publicOnly, searchQuery]);

    useEffect(() => { fetchAll(); }, [fetchAll]);
    useEffect(() => { fetchDocs(); }, [fetchDocs]);

    function showMsg(type, text) {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }

    async function handleCreateOrg() {
        if (!newOrgName.trim()) return;
        try {
            await axios.post(`${API_URL}/api/orgs`, { name: newOrgName, description: newOrgDesc });
            setNewOrgName(''); setNewOrgDesc(''); setShowOrgForm(false);
            showMsg('success', 'Organization created!');
            fetchAll();
        } catch (err) { showMsg('error', err.response?.data?.error || 'Failed'); }
    }

    async function handleAddMember() {
        if (!memberEmail.trim() || !selectedOrg) return;
        try {
            await axios.post(`${API_URL}/api/orgs/${selectedOrg._id}/members`, { email: memberEmail, role: memberRole });
            setMemberEmail(''); setShowAddMember(false);
            showMsg('success', 'Member added!');
            fetchAll();
        } catch (err) { showMsg('error', err.response?.data?.error || 'Failed'); }
    }

    async function handleDeleteDoc(docId) {
        if (!confirm('Delete this document permanently?')) return;
        try {
            await axios.delete(`${API_URL}/api/documents/${docId}`);
            showMsg('success', 'Document deleted.');
            fetchDocs(); fetchAll();
        } catch (err) { showMsg('error', err.response?.data?.error || 'Failed'); }
    }

    async function handleDownload(docId) {
        try {
            const url = publicOnly ? `/api/public/documents/${docId}/download` : `/api/documents/${docId}/download`;
            const res = await axios.get(url);
            window.open(res.data.downloadUrl, '_blank');
        } catch (err) { showMsg('error', 'Download failed.'); }
    }

    async function handleViewDetail(docId) {
        try {
            const url = publicOnly ? `/api/public/documents/${docId}` : `/api/documents/${docId}`;
            const res = await axios.get(url);
            setDocDetail(res.data.document);
        } catch (err) { showMsg('error', 'Failed to load details.'); }
    }

    async function handleMakePublic(docId) {
        try {
            const res = await axios.put(`${API_URL}/api/documents/${docId}/make-public`);
            showMsg('success', 'Document is now public with auto-tags!');
            fetchDocs(); fetchAll();
        } catch (err) { showMsg('error', err.response?.data?.error || 'Failed'); }
    }

    async function handleShareDoc() {
        if (!shareEmail.trim() || !docDetail) return;
        try {
            const res = await axios.post(`${API_URL}/api/documents/${docDetail._id}/permissions`, {
                email: shareEmail, level: shareLevel,
            });
            setDocDetail(res.data.document);
            setShareEmail('');
            showMsg('success', 'Access granted!');
        } catch (err) { showMsg('error', err.response?.data?.error || 'Failed'); }
    }

    async function handleRevokeAccess(docId, userId) {
        try {
            const res = await axios.delete(`${API_URL}/api/documents/${docId}/permissions/${userId}`);
            setDocDetail(res.data.document);
            showMsg('success', 'Access revoked.');
        } catch (err) { showMsg('error', err.response?.data?.error || 'Failed'); }
    }

    async function handleRemoveMember(userId) {
        if (!selectedOrg) return;
        try {
            await axios.delete(`${API_URL}/api/orgs/${selectedOrg._id}/members/${userId}`);
            showMsg('success', 'Member removed.');
            fetchAll();
        } catch (err) { showMsg('error', err.response?.data?.error || 'Failed'); }
    }

    async function handleDeleteOrg(orgId) {
        if (!confirm('Delete this organization permanently? All documents inside it will also be deleted.')) return;
        try {
            await axios.delete(`${API_URL}/api/orgs/${orgId}`);
            if (selectedOrg?._id === orgId) setSelectedOrg(null);
            showMsg('success', 'Organization deleted.');
            fetchAll(); fetchDocs();
        } catch (err) { showMsg('error', err.response?.data?.error || 'Failed'); }
    }

    function handleSearch(e) {
        e.preventDefault();
        fetchDocs();
    }



    const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const formatSize = (b) => {
        if (!b) return '0 B';
        const s = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(b) / Math.log(1024));
        return parseFloat((b / Math.pow(1024, i)).toFixed(1)) + ' ' + s[i];
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] animate-pulse">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                <p className="text-gray-500 font-medium">Loading workspace...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in relative">
            {message.text && (
                <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 backdrop-blur-md transform transition-all ${message.type === 'error' ? 'bg-red-500/90 text-white' : 'bg-emerald-500/90 text-white'
                    }`}>
                    <span>{message.text}</span>
                </div>
            )}

            {!publicOnly && (
                <UploadModal
                    isOpen={showUpload}
                    onClose={() => setShowUpload(false)}
                    onUploadSuccess={() => { fetchDocs(); fetchAll(); }}
                    defaultSpace={activeSpace === 'organization' ? 'organization' : activeSpace}
                    defaultOrgId={selectedOrg?._id}
                />
            )}

            {/* Document Detail Modal */}
            {docDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setDocDetail(null)} />
                    <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800">
                        <div className="sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between z-10">
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                <span className="text-3xl">📄</span> {docDetail.fileName}
                            </h3>
                            <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors" onClick={() => setDocDetail(null)}>✕</button>
                        </div>

                        <div className="p-8 space-y-8">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                                    <span className="text-gray-500 dark:text-gray-400 font-medium">Space</span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${docDetail.space === 'public' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                                        docDetail.space === 'private' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                                            'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400'
                                        }`}>{docDetail.space}</span>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                                    <span className="text-gray-500 dark:text-gray-400 font-medium">Size</span><span className="text-gray-900 dark:text-white font-medium">{formatSize(docDetail.fileSize)}</span>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                                    <span className="text-gray-500 dark:text-gray-400 font-medium">Type</span><span className="text-gray-900 dark:text-white font-medium">{docDetail.mimeType}</span>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                                    <span className="text-gray-500 dark:text-gray-400 font-medium">Uploaded</span><span className="text-gray-900 dark:text-white font-medium">{formatDate(docDetail.uploadDate)}</span>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                                    <span className="text-gray-500 dark:text-gray-400 font-medium">By</span><span className="text-gray-900 dark:text-white font-medium">{docDetail.uploadedBy?.name}</span>
                                </div>
                                {docDetail.description && (
                                    <div className="py-2">
                                        <span className="text-gray-500 dark:text-gray-400 font-medium block mb-1">Description</span>
                                        <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl text-sm leading-relaxed">{docDetail.description}</p>
                                    </div>
                                )}
                            </div>

                            {/* Metadata */}
                            {docDetail.isTagged && docDetail.metadata && (
                                <div className="bg-blue-50 dark:bg-blue-900/10 rounded-2xl p-6 border border-blue-100 dark:border-blue-800/30">
                                    <h4 className="flex items-center gap-2 text-sm font-bold tracking-wide uppercase text-blue-800 dark:text-blue-300 mb-4">
                                        <span>✨</span> AI Metadata
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><span className="block text-xs font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-widest mb-1">Domain</span><span className="font-medium text-gray-900 dark:text-white">{docDetail.metadata.primaryDomain}</span></div>
                                        <div><span className="block text-xs font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-widest mb-1">Sensitivity</span><span className="font-medium text-gray-900 dark:text-white">{docDetail.metadata.sensitivity}</span></div>
                                        <div><span className="block text-xs font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-widest mb-1">Vault</span><span className="font-medium text-gray-900 dark:text-white">{docDetail.metadata.vaultTarget}</span></div>
                                        <div><span className="block text-xs font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-widest mb-1">Department</span><span className="font-medium text-gray-900 dark:text-white">{docDetail.metadata.departmentOwner}</span></div>
                                        {docDetail.metadata.academicYear && docDetail.metadata.academicYear !== 'Unknown' && (
                                            <div><span className="block text-xs font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-widest mb-1">Year</span><span className="font-medium text-gray-900 dark:text-white">{docDetail.metadata.academicYear}</span></div>
                                        )}
                                    </div>
                                    {docDetail.metadata.typeTags?.length > 0 && (
                                        <div className="mt-5 flex flex-wrap gap-2">
                                            {docDetail.metadata.typeTags.map((t, i) => <span key={i} className="px-3 py-1 bg-white/70 dark:bg-gray-800 border border-blue-200 dark:border-blue-700 text-xs font-semibold rounded-lg text-blue-700 dark:text-blue-300 shadow-sm">{t}</span>)}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Tags */}
                            {docDetail.tags?.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><span>🏷️</span> Keywords</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {docDetail.tags.map((t, i) => <span key={i} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">{t}</span>)}
                                    </div>
                                </div>
                            )}

                            {/* Permissions */}
                            {!publicOnly && docDetail.permissions && (
                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><span>👥</span> Access List</h4>
                                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
                                        {docDetail.permissions.map((p) => (
                                            <div key={p._id} className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm" style={{ backgroundColor: p.user?.avatarColor || '#3b82f6' }}>
                                                        {p.user?.name?.[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-sm text-gray-900 dark:text-white">{p.user?.name || 'Unknown'}</p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{p.level}</p>
                                                    </div>
                                                </div>
                                                {p.level !== 'owner' && (
                                                    <button className="text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 p-2 rounded-xl transition-colors font-bold" onClick={() => handleRevokeAccess(docDetail._id, p.user?._id)}>✕</button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                        <input className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 dark:text-white" placeholder="Colleague's email..." value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} />
                                        <select className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 dark:text-white" value={shareLevel} onChange={(e) => setShareLevel(e.target.value)}>
                                            <option value="viewer">Viewer</option>
                                            <option value="editor">Editor</option>
                                        </select>
                                        <button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md transition-colors" onClick={handleShareDoc}>Share</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800/80 backdrop-blur-md px-8 py-5 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                            <button className="px-8 py-3 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-white rounded-xl font-bold shadow-lg transition-transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2" onClick={() => handleDownload(docDetail._id)}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Download File
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Bar */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-2">
                <div>
                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        {publicOnly ? 'Public Collection' : 'Workspace'}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        {publicOnly ? 'Open access institutional documents and assets' : 'Manage your private, public, and team resources'}
                    </p>
                </div>
                {!publicOnly && (
                    <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 flex-shrink-0" onClick={() => setShowUpload(true)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Upload Document
                    </button>
                )}
            </div>

            {/* Search Bar */}
            {(publicOnly || activeSpace === 'public') && (
                <form onSubmit={handleSearch} className="relative group max-w-3xl">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Search across title, keywords, descriptions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-28 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl shadow-sm focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-all duration-300"
                    />
                    <button type="submit" className="absolute right-2 top-2 bottom-2 px-6 bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-400 font-bold rounded-xl transition-colors">
                        Search
                    </button>
                </form>
            )}

            {/* Storage Summary (auth only) */}
            {!publicOnly && storage && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                        <div className="flex justify-between items-center mb-4">
                            <span className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2"><span>🌐</span> Public Space</span>
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-lg tracking-wide">{storage.public.percentage}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden mb-3">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${storage.public.percentage}%` }} />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide">USED: <span className="font-bold text-gray-700 dark:text-gray-300">{formatSize(storage.public.used)}</span> / {formatSize(storage.public.limit)}</p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                        <div className="flex justify-between items-center mb-4">
                            <span className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2"><span>🔒</span> Private Space</span>
                            <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-lg tracking-wide">{storage.private.percentage}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden mb-3">
                            <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${storage.private.percentage}%` }} />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide">USED: <span className="font-bold text-gray-700 dark:text-gray-300">{formatSize(storage.private.used)}</span> / {formatSize(storage.private.limit)}</p>
                    </div>
                </div>
            )}

            {/* Space Tabs (auth only) */}
            {!publicOnly && (
                <div className="inline-flex flex-wrap gap-2 p-1.5 mb-8 bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border border-gray-200 dark:border-gray-800/80 rounded-2xl shadow-sm w-full sm:w-auto">
                    {[
                        { key: 'public', icon: '🌐', label: 'Public', count: stats.public?.count || 0 },
                        { key: 'private', icon: '🔒', label: 'Private', count: stats.private?.count || 0 },
                        { key: 'organization', icon: '🏢', label: 'Organizations', count: orgs.length },
                    ].map((s) => (
                        <button key={s.key}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${activeSpace === s.key
                                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700/50 scale-[1.02]'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800/50 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                            onClick={() => { setActiveSpace(s.key); setSelectedOrg(null); setSearchQuery(''); }}
                        >
                            <span className="text-lg opacity-80">{s.icon}</span>
                            <span>{s.label}</span>
                            <span className={`px-2 py-0.5 rounded-md text-xs font-black tracking-wide ${activeSpace === s.key
                                    ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                }`}>{s.count}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Organization view */}
            {!publicOnly && activeSpace === 'organization' && (
                <div className="space-y-6 mb-8 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-3xl p-6 sm:p-8 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">Your Organizations</h3>
                            <button
                                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${showOrgForm ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20'}`}
                                onClick={() => setShowOrgForm(!showOrgForm)}
                            >
                                {showOrgForm ? 'Cancel' : '+ New Organization'}
                            </button>
                        </div>

                        {showOrgForm && (
                            <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-2xl flex flex-col md:flex-row gap-4 animate-fade-in-up">
                                <input className="flex-1 px-5 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white placeholder-gray-400 transition-shadow font-medium" placeholder="Organization name" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} />
                                <input className="flex-1 px-5 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white placeholder-gray-400 transition-shadow font-medium" placeholder="Description (optional)" value={newOrgDesc} onChange={(e) => setNewOrgDesc(e.target.value)} />
                                <button className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-colors whitespace-nowrap" onClick={handleCreateOrg}>Create</button>
                            </div>
                        )}

                        {orgs.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                {orgs.map((org) => (
                                    <div
                                        key={org._id}
                                        className={`group relative flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 text-left cursor-pointer ${selectedOrg?._id === org._id
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm ring-1 ring-blue-500'
                                                : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 hover:border-blue-300 hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm'
                                            }`}
                                        onClick={() => setSelectedOrg(org)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl text-white font-black flex items-center justify-center text-lg shadow-sm transition-transform group-hover:scale-105`} style={{ backgroundColor: org.avatarColor || '#3b82f6' }}>
                                                {org.name[0]?.toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white text-base leading-tight mb-1">{org.name}</p>
                                                <p className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                                    {org.members?.length || 0} members
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 w-9 h-9 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-800/50 text-red-500 transition-all flex-shrink-0"
                                            title="Delete Organization"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteOrg(org._id); }}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            !showOrgForm && (
                                <div className="text-center py-12 px-4 bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                                    <span className="text-5xl opacity-80 block mb-4 drop-shadow-sm">🏢</span>
                                    <h4 className="text-gray-900 dark:text-white font-extrabold text-lg mb-2">No Organizations Yet</h4>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm mx-auto">Create an organization to start collaborating with your team and sharing documents securely.</p>
                                </div>
                            )
                        )}
                    </div>

                    {selectedOrg && (
                        <div className="bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-3xl p-6 sm:p-8 shadow-sm animate-fade-in-up">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700/50">
                                <div>
                                    <h4 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                                        Team Members
                                        <span className="text-xs font-black px-2.5 py-1 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg tracking-wide">{selectedOrg.name}</span>
                                    </h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage access and roles for this organization.</p>
                                </div>
                                <button
                                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${showAddMember ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                                    onClick={() => setShowAddMember(!showAddMember)}
                                >
                                    {showAddMember ? 'Cancel' : '+ Add Member'}
                                </button>
                            </div>

                            {showAddMember && (
                                <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-2xl flex flex-col sm:flex-row gap-4 animate-fade-in">
                                    <input className="flex-1 px-5 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white placeholder-gray-400 text-sm font-medium" placeholder="User email address" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
                                    <select className="px-5 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white text-sm font-bold" value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
                                        <option value="admin">Admin</option>
                                        <option value="member">Member</option>
                                        <option value="viewer">Viewer</option>
                                    </select>
                                    <button className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-colors text-sm" onClick={handleAddMember}>Add</button>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {selectedOrg.members?.map((m) => (
                                    <div key={m._id} className="group flex items-center justify-between p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-300">
                                        <div className="flex items-center gap-4">
                                            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shadow-sm" style={{ backgroundColor: m.user?.avatarColor || '#6b7280' }}>
                                                {m.user?.name?.[0]?.toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-gray-900 dark:text-white mb-0.5">{m.user?.name || m.user?.email}</p>
                                                <p className={`text-[10px] font-black uppercase tracking-widest ${m.role === 'admin' ? 'text-purple-600 dark:text-purple-400' :
                                                        m.role === 'member' ? 'text-blue-600 dark:text-blue-400' :
                                                            'text-gray-500 dark:text-gray-400'
                                                    }`}>{m.role}</p>
                                            </div>
                                        </div>
                                        {m.role !== 'admin' && (
                                            <button className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 p-2.5 rounded-xl transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => handleRemoveMember(m.user?._id)} title="Remove Member">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Documents Grid */}
            {(publicOnly || activeSpace !== 'organization' || (activeSpace === 'organization' && selectedOrg)) && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-4">
                        <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                            {publicOnly ? 'Public Collection' :
                                activeSpace === 'organization' && selectedOrg ? `${selectedOrg.name} Documents` :
                                    `${activeSpace.charAt(0).toUpperCase() + activeSpace.slice(1)} Files`}
                        </h3>
                        <div className="bg-gray-100 dark:bg-gray-800 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider text-gray-600 dark:text-gray-300 shadow-inner">
                            {documents.length} files
                        </div>
                    </div>

                    {documents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 px-6 bg-white/50 dark:bg-gray-800/30 backdrop-blur-sm border border-dashed border-gray-300 dark:border-gray-700 rounded-3xl animate-fade-in text-center shadow-sm">
                            <span className="text-7xl mb-6 inline-block transform hover:scale-110 transition-transform duration-300 drop-shadow-md">📂</span>
                            <h4 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-3">No documents {searchQuery ? 'matching your search' : 'found here'}</h4>
                            <p className="text-gray-500 dark:text-gray-400 text-base max-w-md mb-8 leading-relaxed">
                                {searchQuery ? 'Try adjusting your keywords or clearing the search filter.' :
                                    publicOnly ? 'There are no public documents available at the moment.' :
                                        'This space is empty. Upload your first document to get started and organize your work.'}
                            </p>
                            {!publicOnly && !searchQuery && (
                                <button className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2" onClick={() => setShowUpload(true)}>
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    Upload First Document
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in-up">
                            {documents.map((doc) => (
                                <div
                                    key={doc._id}
                                    className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300 cursor-pointer flex flex-col relative overflow-hidden h-full"
                                    onClick={() => handleViewDetail(doc._id)}
                                >
                                    <div className="flex items-start justify-between mb-5">
                                        <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300 shadow-sm border border-blue-100/50 dark:border-blue-800/30">
                                            📄
                                        </div>
                                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="w-9 h-9 rounded-full bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 flex items-center justify-center transition-colors shadow-sm" onClick={(e) => { e.stopPropagation(); handleDownload(doc._id); }} title="Download">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                            </button>
                                            {!publicOnly && doc.space === 'private' && (
                                                <button className="w-9 h-9 rounded-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-800/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-colors shadow-sm" onClick={(e) => { e.stopPropagation(); handleMakePublic(doc._id); }} title="Publish to Public">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                                </button>
                                            )}
                                            {!publicOnly && (
                                                <button className="w-9 h-9 rounded-full bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-800/50 text-red-600 dark:text-red-400 flex items-center justify-center transition-colors shadow-sm" onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc._id); }} title="Delete File">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <h4 className="font-bold text-gray-900 dark:text-white text-base mb-3 line-clamp-2 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={doc.fileName}>{doc.fileName}</h4>

                                    <div className="flex items-center gap-2.5 mb-5 text-[11px] font-black tracking-wider uppercase">
                                        <span className={`px-2.5 py-1 rounded-lg shadow-sm ${doc.space === 'public' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                                                doc.space === 'private' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                                                    'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400'
                                            }`}>{doc.space}</span>
                                        <span className="text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 px-2.5 py-1 rounded-lg border border-gray-100 dark:border-gray-700">{formatSize(doc.fileSize)}</span>
                                    </div>

                                    <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700/50">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-bold flex items-center gap-1.5 mb-2.5">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                            {formatDate(doc.uploadDate)}
                                            <span className="mx-1.5 text-gray-300 dark:text-gray-600">•</span>
                                            {doc.uploadedBy?.name?.split(' ')[0]}
                                        </p>

                                        {/* Tags preview */}
                                        <div className="flex flex-wrap gap-1.5">
                                            {doc.isTagged && doc.metadata?.primaryDomain && (
                                                <span className="px-2.5 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-[10px] font-black rounded-lg uppercase tracking-wider border border-indigo-100/50 dark:border-indigo-800/30 truncate max-w-[100px]" title={doc.metadata.primaryDomain}>
                                                    {doc.metadata.primaryDomain}
                                                </span>
                                            )}
                                            {doc.tags?.slice(0, doc.isTagged && doc.metadata?.primaryDomain ? 1 : 2).map((t, i) => (
                                                <span key={i} className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-[10px] font-bold rounded-lg truncate max-w-[80px]">
                                                    {t}
                                                </span>
                                            ))}
                                            {doc.tags?.length > (doc.isTagged && doc.metadata?.primaryDomain ? 1 : 2) && (
                                                <span className="px-2.5 py-1 bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-[10px] font-bold rounded-lg border border-gray-200 dark:border-gray-700">
                                                    +{doc.tags.length - (doc.isTagged && doc.metadata?.primaryDomain ? 1 : 2)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default Dashboard;
