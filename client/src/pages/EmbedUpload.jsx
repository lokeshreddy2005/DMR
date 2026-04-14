import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UploadCloud, CheckCircle, AlertCircle, Loader2, X, Tag, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import API_URL from '../config/api';

export function EmbedUpload() {
    const [searchParams] = useSearchParams();
    const apiKey = searchParams.get('apiKey');
    const space = searchParams.get('space') || 'public';
    const organizationId = searchParams.get('organizationId');
    const presetTags = searchParams.get('tags'); // comma-separated preset tags
    const enableAutoTag = searchParams.get('autoTag') === 'true';

    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, uploading, success, error
    const [errorMessage, setErrorMessage] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadedDoc, setUploadedDoc] = useState(null);
    const fileInputRef = useRef(null);

    // (#41) Manual tag support
    const [tags, setTags] = useState(() => {
        if (presetTags) return presetTags.split(',').map(t => t.trim()).filter(Boolean);
        return [];
    });
    const [tagInput, setTagInput] = useState('');

    // (#42) Auto-tag toggle
    const [autoTag, setAutoTag] = useState(enableAutoTag);

    // Description
    const [description, setDescription] = useState('');

    // Communicate with parent frame
    useEffect(() => {
        if (status === 'success' && uploadedDoc) {
            window.parent?.postMessage({
                type: 'DMR_UPLOAD_SUCCESS',
                document: uploadedDoc,
            }, '*');
        } else if (status === 'error') {
            window.parent?.postMessage({
                type: 'DMR_UPLOAD_ERROR',
                message: errorMessage,
            }, '*');
        }
    }, [status, uploadedDoc, errorMessage]);

    // Listen for messages from parent frame (for pre-filling)
    useEffect(() => {
        const handler = (event) => {
            if (event.data?.type === 'DMR_SET_CONFIG') {
                if (event.data.tags) setTags(event.data.tags);
                if (event.data.description) setDescription(event.data.description);
                if (event.data.autoTag !== undefined) setAutoTag(event.data.autoTag);
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    if (!apiKey) {
        return (
            <div className="w-full h-full min-h-[200px] flex items-center justify-center p-6 bg-red-50 rounded-2xl border border-red-200">
                <div className="text-center">
                    <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <p className="text-red-700 font-semibold">Missing API Key</p>
                    <p className="text-red-500 text-sm mt-1">Please provide an apiKey in the URL parameters.</p>
                </div>
            </div>
        );
    }

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setStatus('idle');
            setErrorMessage('');
        }
    };

    // (#48) Flexible tag input — handles comma-separated, enter key
    const addTag = (value) => {
        const newTags = value.split(',').map(t => t.trim()).filter(Boolean);
        setTags(prev => [...new Set([...prev, ...newTags])]);
        setTagInput('');
    };

    const removeTag = (tagToRemove) => {
        setTags(prev => prev.filter(t => t !== tagToRemove));
    };

    const handleTagKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            if (tagInput.trim()) addTag(tagInput);
        }
        if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
            setTags(prev => prev.slice(0, -1));
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setStatus('uploading');
        setUploadProgress(0);

        const formData = new FormData();
        formData.append('document', file);
        formData.append('space', space);

        if (organizationId) formData.append('organizationId', organizationId);
        if (description.trim()) formData.append('description', description.trim());
        if (autoTag) formData.append('autoTag', 'true');

        // (#41 + #48) Send manual tags
        if (tags.length > 0) {
            formData.append('manualTags', JSON.stringify(tags));
        }

        try {
            const progressInterval = setInterval(() => {
                setUploadProgress(p => p < 90 ? p + 5 : p);
            }, 200);

            const response = await fetch(`${API_URL}/api/external/upload`, {
                method: 'POST',
                headers: { 'x-api-key': apiKey },
                body: formData,
            });

            clearInterval(progressInterval);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.details || 'Upload failed');
            }

            setUploadProgress(100);
            setUploadedDoc(data.document);
            setStatus('success');
        } catch (err) {
            setErrorMessage(err.message);
            setStatus('error');
        }
    };

    const resetForm = () => {
        setFile(null);
        setStatus('idle');
        setErrorMessage('');
        setUploadProgress(0);
        setUploadedDoc(null);
        setDescription('');
        setTags(presetTags ? presetTags.split(',').map(t => t.trim()).filter(Boolean) : []);
        setAutoTag(enableAutoTag);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
            <div className="text-center mb-5">
                <h2 className="text-2xl font-extrabold text-gray-900">Upload Document</h2>
                <p className="text-sm font-medium text-gray-500 mt-1">
                    Space: <span className="text-blue-600 capitalize">{space}</span>
                </p>
            </div>

            {/* ── File Drop Zone ── */}
            <div
                className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                    file ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    disabled={status === 'uploading' || status === 'success'}
                />

                <AnimatePresence mode="wait">
                    {status === 'success' ? (
                        <motion.div key="success" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                            <p className="text-green-700 font-bold text-lg">Upload Complete!</p>
                            <p className="text-green-600 text-sm mt-1">{uploadedDoc?.fileName}</p>
                            {uploadedDoc?.tags?.length > 0 && (
                                <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                                    {uploadedDoc.tags.slice(0, 5).map((tag, idx) => (
                                        <span key={idx} className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-md">{tag}</span>
                                    ))}
                                    {uploadedDoc.tags.length > 5 && (
                                        <span className="text-green-500 text-xs font-medium">+{uploadedDoc.tags.length - 5} more</span>
                                    )}
                                </div>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); resetForm(); }}
                                className="mt-4 text-blue-600 text-sm font-semibold hover:underline relative z-10"
                            >
                                Upload Another
                            </button>
                        </motion.div>
                    ) : status === 'error' ? (
                        <motion.div key="error" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                            <p className="text-red-700 font-bold">Upload Failed</p>
                            <p className="text-red-500 text-sm mt-1 break-words">{errorMessage}</p>
                            <button
                                onClick={(e) => { e.stopPropagation(); setStatus('idle'); }}
                                className="mt-4 text-blue-600 text-sm font-semibold hover:underline relative z-10"
                            >
                                Try Again
                            </button>
                        </motion.div>
                    ) : status === 'uploading' ? (
                        <motion.div key="uploading" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-3" />
                            <p className="text-blue-700 font-bold">{autoTag ? 'Uploading & Tagging...' : 'Uploading...'}</p>
                            <div className="w-full bg-blue-100 rounded-full h-2 mt-4">
                                <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="idle" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <UploadCloud className="w-7 h-7 text-blue-600" />
                            </div>
                            {file ? (
                                <div>
                                    <p className="text-gray-900 font-bold text-lg truncate px-2">{file.name}</p>
                                    <p className="text-gray-500 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                            ) : (
                                <p className="text-gray-600 font-semibold">Drop a file here or click to browse</p>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Options (shown when file selected and not yet uploading) ── */}
            {status === 'idle' && file && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-4">

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Description</label>
                        <input
                            type="text"
                            placeholder="Brief description (optional)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* (#41) Manual Tags */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                            <Tag className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                            Tags
                        </label>
                        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-transparent transition-all min-h-[38px]">
                            {tags.map((tag, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded-lg">
                                    {tag}
                                    <button
                                        type="button"
                                        onClick={() => removeTag(tag)}
                                        className="text-blue-400 hover:text-blue-700 transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                            <input
                                type="text"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleTagKeyDown}
                                onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                                placeholder={tags.length === 0 ? 'Type and press Enter...' : ''}
                                className="flex-1 min-w-[80px] text-sm outline-none bg-transparent"
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Separate with commas or Enter</p>
                    </div>

                    {/* (#42) Auto-Tag Toggle */}
                    <label className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-xl cursor-pointer hover:shadow-sm transition-all">
                        <div className="relative">
                            <input
                                type="checkbox"
                                checked={autoTag}
                                onChange={(e) => setAutoTag(e.target.checked)}
                                className="sr-only"
                            />
                            <div className={`w-10 h-5 rounded-full transition-colors ${autoTag ? 'bg-purple-500' : 'bg-gray-300'}`}></div>
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${autoTag ? 'translate-x-5' : ''}`}></div>
                        </div>
                        <div className="flex-1">
                            <span className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-purple-500" />
                                AI Auto-Tag
                            </span>
                            <span className="text-xs text-gray-500">Automatically analyze and tag document</span>
                        </div>
                    </label>

                    {/* Upload Button */}
                    <motion.button
                        initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                        onClick={handleUpload}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 transition-all active:scale-[0.98]"
                    >
                        Confirm Upload
                    </motion.button>
                </motion.div>
            )}
        </div>
    );
}
