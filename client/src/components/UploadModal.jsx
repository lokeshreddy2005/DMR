import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import API_URL from '../config/api';

function UploadModal({ isOpen, onClose, onUploadSuccess, defaultSpace, defaultOrgId }) {
    const { token } = useAuth();
    // files: [{ id, file, progress, status('pending'|'uploading'|'done'|'error'), error }]
    const [files, setFiles] = useState([]);
    const [space, setSpace] = useState(defaultSpace || 'public');
    const [organizationId, setOrganizationId] = useState(defaultOrgId || '');
    const [description, setDescription] = useState('');
    const [orgs, setOrgs] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [allDone, setAllDone] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            fetchOrgs();
            setFiles([]);
            setDescription('');
            setAllDone(false);
            setSpace(defaultSpace || 'public');
            setOrganizationId(defaultOrgId || '');
            setIsDragging(false);
        }
    }, [isOpen, defaultSpace, defaultOrgId]);

    async function fetchOrgs() {
        try {
            const res = await axios.get(`${API_URL}/api/orgs`);
            setOrgs(res.data.organizations || []);
        } catch { /* ignore */ }
    }

    function addFiles(fileList) {
        const newFiles = Array.from(fileList).map((f) => ({
            id: `${f.name}-${Date.now()}-${Math.random()}`,
            file: f,
            progress: 0,
            status: 'pending',
            error: '',
        }));
        setFiles(prev => [...prev, ...newFiles]);
    }

    function removeFile(id) {
        setFiles(prev => prev.filter(f => f.id !== id));
    }

    function handleFileSelect(e) {
        const selected = e.target.files;
        if (selected && selected.length > 0) {
            addFiles(selected);
            e.target.value = '';
        }
    }

    function handleDragEnter(e) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }

    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const dropped = e.dataTransfer?.files;
        if (dropped && dropped.length > 0) {
            addFiles(dropped);
        }
    }

    function updateFileItem(id, patch) {
        setFiles(prev => prev.map(f => (f.id === id ? { ...f, ...patch } : f)));
    }

    async function uploadSingleFile(item) {
        updateFileItem(item.id, { status: 'uploading', progress: 0 });

        const formData = new FormData();
        formData.append('document', item.file);
        formData.append('space', space);
        if (space === 'organization') formData.append('organizationId', organizationId);
        if (description) formData.append('description', description);

        try {
            await axios.post(`${API_URL}/api/documents/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (e) => {
                    const pct = Math.round((e.loaded * 100) / e.total);
                    updateFileItem(item.id, { progress: pct });
                },
            });
            updateFileItem(item.id, { status: 'done', progress: 100 });
        } catch (err) {
            updateFileItem(item.id, { status: 'error', error: err.response?.data?.error || 'Upload failed.' });
        }
    }

    async function handleUpload() {
        if (files.length === 0) return;
        if (space === 'organization' && !organizationId) return;

        setUploading(true);

        // Upload all files concurrently
        await Promise.all(files.filter(f => f.status === 'pending' || f.status === 'error').map(f => uploadSingleFile(f)));

        setUploading(false);
        setAllDone(true);
        onUploadSuccess?.();
        setTimeout(() => onClose(), 1500);
    }

    if (!isOpen) return null;

    const formatSize = (bytes) => {
        if (!bytes) return '';
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'error');
    const canUpload = files.length > 0 && pendingFiles.length > 0 && !uploading;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in">
            <div className="absolute inset-0 bg-gray-900/60 dark:bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => !uploading && onClose()} />

            <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 sm:p-8 flex-1 overflow-y-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Upload Documents</h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Add one or more files to your workspace.</p>
                        </div>
                        {!uploading && !allDone && (
                            <button className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 flex items-center justify-center transition-colors" onClick={onClose}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        )}
                    </div>

                    {allDone ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in-up">
                            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center mb-6">
                                <svg className="w-10 h-10 animate-[bounce_1s_ease-in-out_infinite]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Upload Complete!</h3>
                            <p className="text-gray-500 dark:text-gray-400">{files.length} document{files.length !== 1 ? 's have' : ' has'} been added successfully.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Space Selector */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Target Space</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { key: 'public', icon: '🌐', label: 'Public' },
                                        { key: 'private', icon: '🔒', label: 'Private' },
                                        { key: 'organization', icon: '🏢', label: 'Org' },
                                    ].map((s) => (
                                        <button
                                            key={s.key}
                                            className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-300 ${space === s.key
                                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm'
                                                    : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 hover:border-blue-200 dark:hover:border-blue-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
                                                }`}
                                            onClick={() => setSpace(s.key)}
                                        >
                                            <span className="text-2xl mb-2">{s.icon}</span>
                                            <span className="font-bold text-xs">{s.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Org Picker */}
                            {space === 'organization' && (
                                <div className="animate-fade-in-up">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Select Organization</label>
                                    <div className="relative">
                                        <select
                                            value={organizationId}
                                            onChange={(e) => setOrganizationId(e.target.value)}
                                            className="w-full pl-5 pr-12 py-3.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white font-medium appearance-none transition-shadow"
                                        >
                                            <option value="">Select organization...</option>
                                            {orgs.map((o) => (
                                                <option key={o._id} value={o._id}>{o.name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Hidden file input — always present */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                onChange={handleFileSelect}
                                className="hidden"
                            />

                            {/* Drop Zone — only shown when NO files selected */}
                            {files.length === 0 && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Files</label>
                                    <div
                                        className={`relative border-2 border-dashed rounded-3xl p-8 text-center transition-all duration-300 cursor-pointer ${
                                                isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.02]' : 'border-gray-300 dark:border-gray-700 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/30 dark:hover:bg-gray-800'
                                            }`}
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragEnter={handleDragEnter}
                                        onDragOver={handleDragEnter}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        <div className="py-4 pointer-events-none">
                                            <span className="text-5xl mb-4 block">📥</span>
                                            <p className="text-gray-800 dark:text-gray-200 font-bold mb-1">Click to browse or drag and drop</p>
                                            <p className="text-gray-500 dark:text-gray-400 text-sm">Select multiple files · Any file type up to 50MB each</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* File List — shown when files are selected */}
                            {files.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            {files.length} file{files.length !== 1 ? 's' : ''} selected
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {!uploading && (
                                                <>
                                                    <button
                                                        className="text-xs text-red-500 hover:text-red-600 font-semibold transition-colors"
                                                        onClick={() => setFiles([])}
                                                    >Clear All</button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                                        {files.map((item) => (
                                            <div key={item.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                                                item.status === 'done'
                                                    ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50'
                                                    : item.status === 'error'
                                                        ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50'
                                                        : item.status === 'uploading'
                                                            ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/50'
                                                            : 'bg-white dark:bg-gray-800/50 border-gray-100 dark:border-gray-800'
                                            }`}>
                                                {/* Icon */}
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{
                                                    background: item.status === 'done' ? 'rgba(16,185,129,0.15)' :
                                                        item.status === 'error' ? 'rgba(244,63,94,0.15)' :
                                                        item.status === 'uploading' ? 'rgba(59,130,246,0.15)' :
                                                        'rgba(107,114,128,0.1)'
                                                }}>
                                                    {item.status === 'done' ? '✅' : item.status === 'error' ? '❌' : item.status === 'uploading' ? '⏳' : '📄'}
                                                </div>

                                                {/* File Info */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.file.name}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        {item.status === 'uploading' ? `Uploading... ${item.progress}%` :
                                                         item.status === 'done' ? 'Uploaded successfully' :
                                                         item.status === 'error' ? item.error :
                                                         formatSize(item.file.size)}
                                                    </p>
                                                    {/* Progress bar */}
                                                    {item.status === 'uploading' && (
                                                        <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-1.5">
                                                            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 rounded-full" style={{ width: `${item.progress}%` }} />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Remove button */}
                                                {!uploading && item.status !== 'uploading' && (
                                                    <button
                                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-800/50 text-red-500 transition-colors flex-shrink-0"
                                                        onClick={(e) => { e.stopPropagation(); removeFile(item.id); }}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* + Add More Files button */}
                                    {!uploading && (
                                        <button
                                            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all duration-200 cursor-pointer"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                            Add More Files
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Description <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Add a brief note about these documents..."
                                    rows={3}
                                    className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white placeholder-gray-400 resize-none transition-shadow text-sm"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {!allDone && (
                    <div className="p-6 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-800 flex flex-col-reverse sm:flex-row justify-end gap-3 mt-auto">
                        <button
                            className="px-6 py-3 rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors w-full sm:w-auto"
                            onClick={onClose}
                            disabled={uploading}
                        >
                            Cancel
                        </button>
                        <button
                            className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all w-full sm:w-auto flex items-center justify-center gap-2 ${!canUpload
                                    ? 'bg-blue-400 dark:bg-blue-600 cursor-not-allowed shadow-none'
                                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30 transform hover:-translate-y-0.5'
                                }`}
                            onClick={handleUpload}
                            disabled={!canUpload}
                        >
                            {uploading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Uploading {files.length} file{files.length !== 1 ? 's' : ''}...
                                </>
                            ) : `Upload ${files.length > 0 ? files.length + ' ' : ''}Document${files.length !== 1 ? 's' : ''}`}
                        </button>
                    </div>
                )}
            </div>

            <style jsx="true">{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
}

export default UploadModal;
