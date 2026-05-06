import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, FileText, Download, Maximize2, Minimize2, AlertTriangle, Eye } from 'lucide-react';
import api from '../utils/api';
import API_URL from '../config/api';
import { useAuth } from '../context/AuthContext';

// ─── MIME type categories ───────────────────────────────────────────────────────
const PREVIEWABLE_CATEGORIES = ['image', 'video', 'audio', 'pdf', 'text'];

function getFileCategory(mimeType, fileName) {
    const mime = (mimeType || '').toLowerCase();
    const ext = (fileName || '').split('.').pop()?.toLowerCase();
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime === 'application/pdf') return 'pdf';
    if (mime.startsWith('text/') || ['application/json', 'application/xml', 'application/javascript'].includes(mime)) return 'text';
    const textExts = ['txt', 'md', 'csv', 'log', 'json', 'xml', 'yaml', 'yml', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'css', 'html', 'sql', 'sh'];
    if (textExts.includes(ext)) return 'text';
    return 'unsupported';
}

function isPreviewable(mimeType, fileName) {
    return PREVIEWABLE_CATEGORIES.includes(getFileCategory(mimeType, fileName));
}

// ─── Thumbnail URL cache ────────────────────────────────────────────────────────
const thumbnailCache = new Map();

// ─── Extension → icon/color map ─────────────────────────────────────────────────
const EXT_STYLES = {
    pdf:  { icon: '📄', bg: 'from-red-500/10 to-red-600/5',    text: 'text-red-500',    label: 'PDF' },
    doc:  { icon: '📝', bg: 'from-blue-500/10 to-blue-600/5',   text: 'text-blue-500',   label: 'DOC' },
    docx: { icon: '📝', bg: 'from-blue-500/10 to-blue-600/5',   text: 'text-blue-500',   label: 'DOCX' },
    xls:  { icon: '📊', bg: 'from-green-500/10 to-green-600/5', text: 'text-green-500',  label: 'XLS' },
    xlsx: { icon: '📊', bg: 'from-green-500/10 to-green-600/5', text: 'text-green-500',  label: 'XLSX' },
    ppt:  { icon: '📽', bg: 'from-orange-500/10 to-orange-600/5', text: 'text-orange-500', label: 'PPT' },
    pptx: { icon: '📽', bg: 'from-orange-500/10 to-orange-600/5', text: 'text-orange-500', label: 'PPTX' },
    mp4:  { icon: '🎬', bg: 'from-purple-500/10 to-purple-600/5', text: 'text-purple-500', label: 'MP4' },
    mp3:  { icon: '🎵', bg: 'from-pink-500/10 to-pink-600/5',   text: 'text-pink-500',   label: 'MP3' },
    zip:  { icon: '📦', bg: 'from-yellow-500/10 to-yellow-600/5', text: 'text-yellow-600', label: 'ZIP' },
    txt:  { icon: '📝', bg: 'from-gray-500/10 to-gray-600/5',   text: 'text-gray-500',   label: 'TXT' },
    csv:  { icon: '📊', bg: 'from-green-500/10 to-green-600/5',  text: 'text-green-500',  label: 'CSV' },
    json: { icon: '{ }', bg: 'from-yellow-500/10 to-yellow-600/5', text: 'text-yellow-600', label: 'JSON' },
    py:   { icon: '🐍', bg: 'from-blue-500/10 to-yellow-500/5', text: 'text-blue-500',   label: 'PY' },
    js:   { icon: '⚡', bg: 'from-yellow-400/10 to-yellow-500/5', text: 'text-yellow-500', label: 'JS' },
};

const DEFAULT_EXT_STYLE = { icon: '📄', bg: 'from-gray-400/10 to-gray-500/5', text: 'text-gray-400', label: '?' };

// ════════════════════════════════════════════════════════════════════════════════
// 1. DocumentThumbnail — small preview shown on each document CARD
//    Now fetches previews for ALL file types, not just images.
// ════════════════════════════════════════════════════════════════════════════════
function DocumentThumbnail({ document: doc, isPublic = false }) {
    const { token } = useAuth();
    const [previewUrl, setPreviewUrl] = useState(() => thumbnailCache.get(doc?._id) || null);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const [textSnippet, setTextSnippet] = useState(null);
    const mountedRef = useRef(true);

    const category = getFileCategory(doc?.mimeType, doc?.fileName);
    const ext = (doc?.fileName || '').split('.').pop()?.toLowerCase() || '';
    const extStyle = EXT_STYLES[ext] || DEFAULT_EXT_STYLE;

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    useEffect(() => {
        if (!doc?._id || previewUrl || failed) return;
        if (thumbnailCache.has(doc._id)) {
            setPreviewUrl(thumbnailCache.get(doc._id));
            return;
        }

        const controller = new AbortController();
        setLoading(true);

        const fetchThumb = async () => {
            try {
                const t = token || localStorage.getItem('dmr_token');
                const headers = t && !isPublic ? { Authorization: `Bearer ${t}` } : {};
                const useAuth = !!t && !isPublic;
                const url = useAuth
                    ? `${API_URL}/api/documents/${doc._id}/preview`
                    : `${API_URL}/api/public/documents/${doc._id}/preview`;
                const res = await api.get(url, { ...(useAuth ? { headers } : {}), signal: controller.signal });
                if (mountedRef.current) {
                    thumbnailCache.set(doc._id, res.data.previewUrl);
                    setPreviewUrl(res.data.previewUrl);

                    // For text files, fetch a snippet for the thumbnail
                    if (category === 'text' && res.data.previewUrl) {
                        try {
                            const textRes = await fetch(res.data.previewUrl, { signal: controller.signal });
                            const text = await textRes.text();
                            const lines = text.split('\n').slice(0, 8);
                            if (mountedRef.current) setTextSnippet(lines.join('\n'));
                        } catch { /* ignore */ }
                    }
                }
            } catch {
                if (mountedRef.current) setFailed(true);
            } finally {
                if (mountedRef.current) setLoading(false);
            }
        };
        fetchThumb();
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doc?._id, category, isPublic, token]);

    // ─── Loading state ───
    if (loading) {
        return (
            <div className="w-full h-32 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // ─── Image thumbnail ───
    if (category === 'image' && previewUrl) {
        return (
            <div className="w-full h-32 bg-gray-50 dark:bg-gray-800/50 overflow-hidden flex items-center justify-center">
                <img src={previewUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
            </div>
        );
    }

    // ─── PDF thumbnail — render first page via iframe ───
    if (category === 'pdf' && previewUrl) {
        return (
            <div className="w-full h-32 bg-gray-100 dark:bg-gray-800/50 overflow-hidden relative">
                <iframe
                    src={`${previewUrl}#page=1&view=Fit&toolbar=0&navpanes=0&scrollbar=0`}
                    title="PDF preview"
                    className="border-0 absolute top-0 left-0"
                    style={{ width: 'calc(100% + 20px)', height: '500px', pointerEvents: 'none', transform: 'scale(1)', transformOrigin: 'top left' }}
                    scrolling="no"
                    tabIndex={-1}
                />
                {/* Overlay to prevent interaction */}
                <div className="absolute inset-0" />
            </div>
        );
    }

    // ─── Video thumbnail — show first frame ───
    if (category === 'video' && previewUrl) {
        return (
            <div className="w-full h-32 bg-black overflow-hidden relative flex items-center justify-center">
                <video
                    src={previewUrl}
                    className="w-full h-full object-cover"
                    preload="metadata"
                    muted
                    playsInline
                    tabIndex={-1}
                />
                {/* Play icon overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5,3 19,12 5,21" />
                        </svg>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Audio thumbnail ───
    if (category === 'audio' && previewUrl) {
        return (
            <div className="w-full h-32 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 overflow-hidden flex flex-col items-center justify-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                    </svg>
                </div>
                <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider">Audio</span>
            </div>
        );
    }

    // ─── Text file thumbnail — show code snippet ───
    if (category === 'text' && previewUrl && textSnippet) {
        return (
            <div className="w-full h-32 bg-gray-50 dark:bg-gray-950 overflow-hidden p-2.5">
                <pre className="text-[8px] font-mono leading-tight text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words overflow-hidden" style={{ maxHeight: '100%' }}>
                    {textSnippet}
                </pre>
            </div>
        );
    }

    // ─── Styled file type placeholder fallback ───
    return (
        <div className={`w-full h-32 bg-gradient-to-br ${extStyle.bg} flex flex-col items-center justify-center gap-1.5`}>
            <span className="text-3xl">{extStyle.icon}</span>
            <span className={`text-[10px] font-extrabold tracking-widest uppercase ${extStyle.text}`}>{extStyle.label || ext.toUpperCase()}</span>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════════
// 2. DocumentPreview — inline first-page preview inside the detail panel
// ════════════════════════════════════════════════════════════════════════════════
function DocumentPreview({ document: doc, isPublic = false }) {
    const { token } = useAuth();
    const [previewUrl, setPreviewUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [textContent, setTextContent] = useState(null);

    const category = getFileCategory(doc?.mimeType, doc?.fileName);
    const canPreview = PREVIEWABLE_CATEGORIES.includes(category);

    useEffect(() => {
        if (!doc?._id || !canPreview) { setPreviewUrl(null); setTextContent(null); setError(null); return; }
        const controller = new AbortController();
        setLoading(true); setError(null); setTextContent(null);

        const fetch_ = async () => {
            try {
                const t = token || localStorage.getItem('dmr_token');
                const headers = t && !isPublic ? { Authorization: `Bearer ${t}` } : {};
                const useAuth = !!t && !isPublic;
                const url = useAuth
                    ? `${API_URL}/api/documents/${doc._id}/preview`
                    : `${API_URL}/api/public/documents/${doc._id}/preview`;
                const res = await api.get(url, { ...(useAuth ? { headers } : {}), signal: controller.signal });
                setPreviewUrl(res.data.previewUrl);
                if (category === 'text' && res.data.previewUrl) {
                    try {
                        const textRes = await fetch(res.data.previewUrl, { signal: controller.signal });
                        const text = await textRes.text();
                        const lines = text.split('\n').slice(0, 30);
                        setTextContent(lines.join('\n') + (text.split('\n').length > 30 ? '\n…' : ''));
                    } catch { /* ignore */ }
                }
            } catch (err) { if (!api.isCancel(err)) setError('Preview unavailable.'); }
            finally { setLoading(false); }
        };
        fetch_();
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doc?._id, isPublic, token]);

    if (!canPreview) return null;
    if (loading) return (
        <div className="w-full rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800/60 flex items-center justify-center h-48 mb-4">
            <div className="flex items-center gap-3"><Loader2 className="w-5 h-5 text-blue-500 animate-spin" /><span className="text-xs font-semibold text-gray-400 animate-pulse">Loading preview…</span></div>
        </div>
    );
    if (error) return (
        <div className="w-full rounded-2xl bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 flex items-center justify-center h-32 mb-4 gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" /><span className="text-xs font-semibold text-red-500">{error}</span>
        </div>
    );
    if (!previewUrl) return null;

    switch (category) {
        case 'image':
            return (<div className="w-full rounded-2xl overflow-hidden bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#ffffff_0%_50%)] dark:bg-[repeating-conic-gradient(#1f2937_0%_25%,#111827_0%_50%)] bg-[length:16px_16px] border border-gray-100 dark:border-gray-800/60 mb-4 flex items-center justify-center p-3 max-h-64"><img src={previewUrl} alt={doc.fileName} className="max-w-full max-h-56 object-contain rounded-lg" loading="lazy" /></div>);
        case 'video':
            return (<div className="w-full rounded-2xl overflow-hidden bg-black border border-gray-100 dark:border-gray-800/60 mb-4 flex items-center justify-center max-h-64"><video src={previewUrl} className="max-w-full max-h-60 rounded-lg" controls preload="metadata" controlsList="nodownload" /></div>);
        case 'audio':
            return (<div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-100 dark:border-violet-800/40 mb-4 p-4 flex flex-col items-center gap-3"><div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20"><svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg></div><audio src={previewUrl} controls className="w-full" controlsList="nodownload" preload="metadata" /></div>);
        case 'pdf':
            return (
                <div className="relative w-full max-w-[420px] mx-auto rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800/60 mb-4 bg-gray-100 dark:bg-gray-800/40">
                    <iframe
                        src={`${previewUrl}#page=1&view=Fit&toolbar=0&navpanes=0&scrollbar=0`}
                        title={`Preview: ${doc.fileName}`}
                        className="border-0"
                        scrolling="no"
                        style={{ width: 'calc(100% + 20px)', height: '260px', pointerEvents: 'none' }}
                    />
                </div>
            );
        case 'text':
            return (<div className="w-full rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800/60 mb-4 bg-gray-50 dark:bg-gray-950 p-4"><pre className="text-[11px] font-mono leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{textContent || 'Loading…'}</pre></div>);
        default: return null;
    }
}

// ════════════════════════════════════════════════════════════════════════════════
// 3. FullPreviewModal — full document viewer (opened via "View" button)
// ════════════════════════════════════════════════════════════════════════════════
const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

function FullPreviewModal({ isOpen, onClose, document: doc, isPublic = false, onDownload }) {
    const { token } = useAuth();
    const [previewUrl, setPreviewUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [textContent, setTextContent] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const category = getFileCategory(doc?.mimeType, doc?.fileName);
    const canPreview = PREVIEWABLE_CATEGORIES.includes(category);
    const ext = (doc?.fileName || '').split('.').pop()?.toLowerCase() || '';

    useEffect(() => {
        if (!isOpen || !doc?._id) { setPreviewUrl(null); setTextContent(null); setError(null); return; }
        const controller = new AbortController();
        setLoading(true); setError(null); setTextContent(null);

        const fetch_ = async () => {
            try {
                const t = token || localStorage.getItem('dmr_token');
                const headers = t && !isPublic ? { Authorization: `Bearer ${t}` } : {};
                const useAuth = !!t && !isPublic;
                const url = useAuth
                    ? `${API_URL}/api/documents/${doc._id}/preview`
                    : `${API_URL}/api/public/documents/${doc._id}/preview`;
                const res = await api.get(url, { ...(useAuth ? { headers } : {}), signal: controller.signal });
                setPreviewUrl(res.data.previewUrl);
                if (category === 'text' && res.data.previewUrl) {
                    try {
                        const textRes = await fetch(res.data.previewUrl, { signal: controller.signal });
                        const txt = await textRes.text();
                        setTextContent(txt);
                    } catch { /* ignore */ }
                }
            } catch (err) { if (!api.isCancel(err)) setError(err.response?.data?.error || 'Preview unavailable.'); }
            finally { setLoading(false); }
        };
        fetch_();
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, doc?._id, isPublic, token]);

    useEffect(() => {
        if (!isOpen) return;
        const h = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen || !doc) return null;

    const renderContent = () => {
        if (loading) return (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
                <div className="relative"><div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" /><Loader2 className="w-10 h-10 text-blue-500 animate-spin relative" /></div>
                <p className="text-sm font-semibold text-gray-500 animate-pulse">Loading document…</p>
            </div>
        );
        if (error || !canPreview) return (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 text-center px-6">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center"><AlertTriangle className="w-8 h-8 text-red-400" /></div>
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">{error ? 'Preview Unavailable' : 'Cannot Preview'}</h4>
                <p className="text-sm text-gray-500 max-w-sm">{error || `This file type (.${ext}) cannot be previewed in the browser.`}</p>
                {onDownload && <button onClick={() => onDownload(doc)} className="mt-2 flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-blue-500/25"><Download className="w-4 h-4" />Download to View</button>}
            </div>
        );
        switch (category) {
            case 'image': return (<div className="flex items-center justify-center h-full min-h-[400px] p-4 bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#ffffff_0%_50%)] dark:bg-[repeating-conic-gradient(#1f2937_0%_25%,#111827_0%_50%)] bg-[length:20px_20px]"><img src={previewUrl} alt={doc.fileName} className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl" loading="lazy" /></div>);
            case 'video': return (<div className="flex items-center justify-center h-full min-h-[400px] p-4 bg-black/95"><video src={previewUrl} controls autoPlay={false} className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" controlsList="nodownload" /></div>);
            case 'audio': return (<div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-6 px-8"><div className="w-24 h-24 bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-xl shadow-purple-500/25"><svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg></div><h4 className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-full">{doc.fileName}</h4><audio src={previewUrl} controls className="w-full max-w-lg" controlsList="nodownload" /></div>);
            case 'pdf': return (<div className="w-full h-full min-h-[80vh] overflow-hidden relative"><iframe src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`} title={`Preview: ${doc.fileName}`} className="border-0 absolute top-0 left-0 h-full" style={{ width: 'calc(100% + 20px)' }} allow="fullscreen" /></div>);
            case 'text': return (<div className="w-full h-full min-h-[400px] overflow-auto bg-gray-50 dark:bg-gray-950 p-6"><pre className="text-sm font-mono leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">{textContent || 'Loading…'}</pre></div>);
            default: return null;
        }
    };

    const CATEGORY_ICON = { image: '🖼', video: '🎬', audio: '🎵', pdf: '📄', text: '📝', unsupported: '📄' };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-md cursor-pointer" />
                    <motion.div initial={{ opacity: 0, scale: 0.92, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 30 }} transition={{ type: 'spring', damping: 28, stiffness: 380 }}
                        className={`relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden flex flex-col transition-all duration-300 ${isFullscreen ? 'w-screen h-screen rounded-none max-w-none max-h-none' : 'w-[95vw] max-w-5xl max-h-[92vh]'}`}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/80 dark:bg-gray-800/30 backdrop-blur-sm flex-shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
                                    <span className="text-white text-base">{CATEGORY_ICON[category] || '📄'}</span>
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[50vw]" title={doc.fileName}>{doc.fileName}</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{formatSize(doc.fileSize)}</span>
                                        <span className="text-gray-300 dark:text-gray-600">•</span>
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20">{ext || 'file'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                {onDownload && <button onClick={() => onDownload(doc)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all" title="Download"><Download className="w-5 h-5" /></button>}
                                <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all" title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>{isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}</button>
                                <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all" title="Close"><X className="w-5 h-5" /></button>
                            </div>
                        </div>
                        {/* Content */}
                        <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">{renderContent()}</div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

// ─── Exports ────────────────────────────────────────────────────────────────────
export default DocumentPreview;
export { DocumentThumbnail, FullPreviewModal, isPreviewable, getFileCategory };
