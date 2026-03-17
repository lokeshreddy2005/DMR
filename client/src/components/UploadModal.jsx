import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

function UploadModal({ isOpen, onClose, onUploadSuccess, defaultSpace, defaultOrgId }) {
    const { token } = useAuth();
    const [file, setFile] = useState(null);
    const [space, setSpace] = useState(defaultSpace || 'public');
    const [organizationId, setOrganizationId] = useState(defaultOrgId || '');
    const [description, setDescription] = useState('');
    const [orgs, setOrgs] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            fetchOrgs();
            setFile(null);
            setDescription('');
            setError('');
            setSuccess(false);
            setProgress(0);
            setSpace(defaultSpace || 'public');
            setOrganizationId(defaultOrgId || '');
            setIsDragging(false);
        }
    }, [isOpen, defaultSpace, defaultOrgId]);

    async function fetchOrgs() {
        try {
            const res = await axios.get('/api/orgs');
            setOrgs(res.data.organizations || []);
        } catch { /* ignore */ }
    }

    function handleFileSelect(e) {
        const selected = e.target.files?.[0];
        if (selected) {
            setFile(selected);
            setError('');
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
        const dropped = e.dataTransfer?.files?.[0];
        if (dropped) {
            setFile(dropped);
            setError('');
        }
    }

    async function handleUpload() {
        if (!file) {
            setError('Please select a file.');
            return;
        }

        if (space === 'organization' && !organizationId) {
            setError('Please select an organization.');
            return;
        }

        setUploading(true);
        setProgress(0);
        setError('');

        const formData = new FormData();
        formData.append('document', file);
        formData.append('space', space);
        if (space === 'organization') formData.append('organizationId', organizationId);
        if (description) formData.append('description', description);

        try {
            await axios.post('/api/documents/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (e) => {
                    setProgress(Math.round((e.loaded * 100) / e.total));
                },
            });
            setSuccess(true);
            onUploadSuccess?.();
            setTimeout(() => onClose(), 1500);
        } catch (err) {
            setError(err.response?.data?.error || 'Upload failed.');
        } finally {
            setUploading(false);
        }
    }

    if (!isOpen) return null;

    const formatSize = (bytes) => {
        if (!bytes) return '';
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in">
            <div className="absolute inset-0 bg-gray-900/60 dark:bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => !uploading && onClose()} />

            <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 sm:p-8 flex-1 overflow-y-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Upload Document</h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Add a new file to your workspace.</p>
                        </div>
                        {!uploading && !success && (
                            <button className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 flex items-center justify-center transition-colors" onClick={onClose}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        )}
                    </div>

                    {success ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in-up">
                            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center mb-6">
                                <svg className="w-10 h-10 animate-[bounce_1s_ease-in-out_infinite]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Upload Complete!</h3>
                            <p className="text-gray-500 dark:text-gray-400">Your document has been added successfully.</p>
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

                            {/* Drop Zone */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">File</label>
                                <div
                                    className={`relative border-2 border-dashed rounded-3xl p-8 text-center transition-all duration-300 cursor-pointer ${file ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' :
                                            isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.02]' : 'border-gray-300 dark:border-gray-700 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/30 dark:hover:bg-gray-800'
                                        }`}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragEnter={handleDragEnter}
                                    onDragOver={handleDragEnter}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                    {file ? (
                                        <div className="flex items-center gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 w-full max-w-md mx-auto">
                                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                                                📄
                                            </div>
                                            <div className="text-left flex-1 min-w-0">
                                                <p className="text-gray-900 dark:text-white font-bold truncate text-sm">{file.name}</p>
                                                <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{formatSize(file.size)}</p>
                                            </div>
                                            <button
                                                className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-800/50 text-red-500 transition-colors flex-shrink-0"
                                                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="py-6 pointer-events-none">
                                            <span className="text-5xl mb-4 block transform transition-transform duration-300 group-hover:-translate-y-1">📥</span>
                                            <p className="text-gray-800 dark:text-gray-200 font-bold mb-1">Click to browse or drag and drop</p>
                                            <p className="text-gray-500 dark:text-gray-400 text-sm">Any file type up to 50MB</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Description <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Add a brief note about this document..."
                                    rows={3}
                                    className="w-full px-5 py-3.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white placeholder-gray-400 resize-none transition-shadow text-sm"
                                />
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-xl text-sm font-semibold flex items-center gap-3 animate-fade-in-up">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                    {error}
                                </div>
                            )}

                            {/* Progress */}
                            {uploading && (
                                <div className="space-y-2 animate-fade-in">
                                    <div className="flex justify-between text-sm font-bold">
                                        <span className="text-blue-600 dark:text-blue-400">Uploading...</span>
                                        <span className="text-gray-700 dark:text-gray-300">{progress}%</span>
                                    </div>
                                    <div className="h-3 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 ease-out flex items-center justify-end relative"
                                            style={{ width: `${progress}%` }}
                                        >
                                            <div className="absolute top-0 bottom-0 left-0 right-0 overflow-hidden">
                                                <div className="w-full h-full bg-white/20 animate-[shimmer_1s_infinite]"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {!success && (
                    <div className="p-6 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-800 flex flex-col-reverse sm:flex-row justify-end gap-3 mt-auto">
                        <button
                            className="px-6 py-3 rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors w-full sm:w-auto"
                            onClick={onClose}
                            disabled={uploading}
                        >
                            Cancel
                        </button>
                        <button
                            className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all w-full sm:w-auto flex items-center justify-center gap-2 ${uploading || !file
                                    ? 'bg-blue-400 dark:bg-blue-600 cursor-not-allowed shadow-none'
                                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30 transform hover:-translate-y-0.5'
                                }`}
                            onClick={handleUpload}
                            disabled={uploading || !file}
                        >
                            {uploading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Uploading...
                                </>
                            ) : 'Upload Document'}
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
