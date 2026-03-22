import { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import './SmartUpload.css';

const VAULT_COLORS = {
    finance: { gradient: 'var(--gradient-finance)', icon: '💰', label: 'Finance Vault' },
    hr: { gradient: 'var(--gradient-hr)', icon: '👥', label: 'HR Vault' },
    project: { gradient: 'var(--gradient-project)', icon: '📋', label: 'Project Vault' },
    uncategorized: { gradient: 'var(--gradient-primary)', icon: '📄', label: 'Uncategorized' },
};

// Statuses for individual file items
const STATUS = {
    PENDING: 'pending',
    UPLOADING: 'uploading',
    SUCCESS: 'success',
    ERROR: 'error',
};

function SmartUpload({ onUploadSuccess }) {
    const [isDragging, setIsDragging] = useState(false);
    // fileItems: [{ id, file, status, progress, result, error }]
    const [fileItems, setFileItems] = useState([]);
    const fileInputRef = useRef(null);

    /** Update a specific file item by id */
    const updateFileItem = useCallback((id, patch) => {
        setFileItems(prev =>
            prev.map(item => (item.id === id ? { ...item, ...patch } : item))
        );
    }, []);

    /** Upload a single file and update its state */
    const uploadFile = useCallback(async (id, file) => {
        if (!file || file.type !== 'application/pdf') {
            updateFileItem(id, { status: STATUS.ERROR, error: 'Only PDF files are supported.' });
            return;
        }

        updateFileItem(id, { status: STATUS.UPLOADING, progress: 0, error: null });

        const formData = new FormData();
        formData.append('document', file);

        try {
            const response = await axios.post('/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    updateFileItem(id, { progress: percent });
                },
            });
            updateFileItem(id, { status: STATUS.SUCCESS, result: response.data });
            onUploadSuccess?.();
        } catch (err) {
            const msg = err.response?.data?.error || 'Upload failed. Please try again.';
            updateFileItem(id, { status: STATUS.ERROR, error: msg });
        }
    }, [updateFileItem, onUploadSuccess]);

    /** Add files to queue and start uploads */
    const processFiles = useCallback((files) => {
        const pdfs = Array.from(files).filter(f => f.type === 'application/pdf');
        const nonPdfs = Array.from(files).filter(f => f.type !== 'application/pdf');

        const newItems = [
            ...pdfs.map(file => ({
                id: `${file.name}-${Date.now()}-${Math.random()}`,
                file,
                status: STATUS.PENDING,
                progress: 0,
                result: null,
                error: null,
            })),
            ...nonPdfs.map(file => ({
                id: `${file.name}-${Date.now()}-${Math.random()}`,
                file,
                status: STATUS.ERROR,
                progress: 0,
                result: null,
                error: 'Only PDF files are supported.',
            })),
        ];

        setFileItems(prev => [...prev, ...newItems]);

        // Start all PDF uploads concurrently
        pdfs.forEach((file, i) => {
            const item = newItems[i];
            uploadFile(item.id, file);
        });
    }, [uploadFile]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) processFiles(files);
    }, [processFiles]);

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            processFiles(files);
            e.target.value = '';
        }
    };

    const removeItem = (id) => {
        setFileItems(prev => prev.filter(item => item.id !== id));
    };

    const clearAll = () => setFileItems([]);

    const anyUploading = fileItems.some(i => i.status === STATUS.UPLOADING || i.status === STATUS.PENDING);

    return (
        <div className="smart-upload">
            <div className="upload-header">
                <h2>Upload Documents</h2>
                <p>Drop one or more PDF files — our AI will automatically classify each into the right vault</p>
            </div>

            {/* Drop Zone */}
            <div
                className={`drop-zone ${isDragging ? 'dragging' : ''} ${anyUploading ? 'uploading' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={!anyUploading ? handleClick : undefined}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={handleFileChange}
                    className="file-input"
                />

                <div className="drop-content">
                    <div className={`drop-icon ${isDragging ? 'bounce' : ''}`}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                    </div>
                    <p className="drop-title">
                        {isDragging ? 'Drop your PDFs here!' : 'Drag & drop your PDFs here'}
                    </p>
                    <p className="drop-subtitle">or click to browse · Multiple PDFs supported · Max 10 MB each</p>
                </div>
            </div>

            {/* File Upload Queue */}
            {fileItems.length > 0 && (
                <div className="file-queue">
                    <div className="file-queue-header">
                        <span className="file-queue-title">
                            {fileItems.length} file{fileItems.length !== 1 ? 's' : ''}
                        </span>
                        {!anyUploading && (
                            <button className="dismiss-btn" onClick={clearAll}>Clear All</button>
                        )}
                    </div>

                    {fileItems.map((item) => {
                        const vaultInfo = item.result
                            ? VAULT_COLORS[item.result.document?.vault] || VAULT_COLORS.uncategorized
                            : null;

                        return (
                            <div key={item.id} className={`file-item file-item--${item.status}`}>
                                {/* File name & remove */}
                                <div className="file-item-top">
                                    <div className="file-item-icon">
                                        {item.status === STATUS.SUCCESS && <span>✅</span>}
                                        {item.status === STATUS.ERROR && <span>❌</span>}
                                        {(item.status === STATUS.UPLOADING || item.status === STATUS.PENDING) && (
                                            <div className="spinner-sm" />
                                        )}
                                    </div>
                                    <span className="file-item-name">{item.file.name}</span>
                                    {item.status !== STATUS.UPLOADING && (
                                        <button
                                            className="dismiss-btn"
                                            onClick={() => removeItem(item.id)}
                                            title="Remove"
                                        >✕</button>
                                    )}
                                </div>

                                {/* Progress bar while uploading */}
                                {item.status === STATUS.UPLOADING && (
                                    <div className="file-item-progress">
                                        <div className="progress-bar-track">
                                            <div className="progress-bar-fill" style={{ width: `${item.progress}%` }} />
                                        </div>
                                        <span className="progress-percent">
                                            {item.progress < 100 ? `${item.progress}%` : 'Analyzing…'}
                                        </span>
                                    </div>
                                )}

                                {/* Error message */}
                                {item.status === STATUS.ERROR && (
                                    <p className="file-item-error">{item.error}</p>
                                )}

                                {/* Success result */}
                                {item.status === STATUS.SUCCESS && vaultInfo && (
                                    <div className="file-item-result">
                                        <span className="result-badge" style={{ background: vaultInfo.gradient }}>
                                            {vaultInfo.icon} {vaultInfo.label}
                                        </span>
                                        {item.result.document?.tags?.length > 0 && (
                                            <div className="tags-list">
                                                {item.result.document.tags.map(tag => (
                                                    <span key={tag} className="tag-chip">{tag}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* How it works */}
            <div className="how-it-works">
                <h3>How it works</h3>
                <div className="steps-grid">
                    <div className="step-card">
                        <div className="step-number">1</div>
                        <h4>Upload</h4>
                        <p>Drop or select one or more PDF documents</p>
                    </div>
                    <div className="step-arrow">→</div>
                    <div className="step-card">
                        <div className="step-number">2</div>
                        <h4>Analyze</h4>
                        <p>Text is extracted & scanned for keywords</p>
                    </div>
                    <div className="step-arrow">→</div>
                    <div className="step-card">
                        <div className="step-number">3</div>
                        <h4>Classify</h4>
                        <p>Auto-tagged and routed to the correct vault</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SmartUpload;
