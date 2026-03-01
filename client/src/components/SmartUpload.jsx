import { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import './SmartUpload.css';

const VAULT_COLORS = {
    finance: { gradient: 'var(--gradient-finance)', icon: '💰', label: 'Finance Vault' },
    hr: { gradient: 'var(--gradient-hr)', icon: '👥', label: 'HR Vault' },
    project: { gradient: 'var(--gradient-project)', icon: '📋', label: 'Project Vault' },
    uncategorized: { gradient: 'var(--gradient-primary)', icon: '📄', label: 'Uncategorized' },
};

function SmartUpload({ onUploadSuccess }) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

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

    const uploadFile = useCallback(async (file) => {
        if (!file || file.type !== 'application/pdf') {
            setError('Please upload a PDF file.');
            return;
        }

        setUploading(true);
        setProgress(0);
        setError(null);
        setResult(null);

        const formData = new FormData();
        formData.append('document', file);

        try {
            const response = await axios.post('/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setProgress(percent);
                },
            });

            setResult(response.data);
            onUploadSuccess?.();
        } catch (err) {
            const msg = err.response?.data?.error || 'Upload failed. Please try again.';
            setError(msg);
        } finally {
            setUploading(false);
        }
    }, [onUploadSuccess]);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            uploadFile(files[0]);
        }
    }, [uploadFile]);

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadFile(file);
            e.target.value = '';
        }
    };

    const resetUpload = () => {
        setResult(null);
        setError(null);
        setProgress(0);
    };

    const vaultInfo = result ? VAULT_COLORS[result.document?.vault] || VAULT_COLORS.uncategorized : null;

    return (
        <div className="smart-upload">
            <div className="upload-header">
                <h2>Upload Document</h2>
                <p>Drop a PDF file and our AI will automatically classify it into the right vault</p>
            </div>

            {/* Drop Zone */}
            <div
                className={`drop-zone ${isDragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={!uploading ? handleClick : undefined}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="file-input"
                />

                {uploading ? (
                    <div className="upload-progress">
                        <div className="spinner" />
                        <p className="progress-text">
                            {progress < 100 ? 'Uploading...' : 'Analyzing document...'}
                        </p>
                        <div className="progress-bar-track">
                            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="progress-percent">{progress}%</span>
                    </div>
                ) : (
                    <div className="drop-content">
                        <div className={`drop-icon ${isDragging ? 'bounce' : ''}`}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                        </div>
                        <p className="drop-title">
                            {isDragging ? 'Drop your PDF here!' : 'Drag & drop your PDF here'}
                        </p>
                        <p className="drop-subtitle">or click to browse · PDF files only · Max 10 MB</p>
                    </div>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="upload-error">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    <span>{error}</span>
                    <button onClick={resetUpload} className="dismiss-btn">Dismiss</button>
                </div>
            )}

            {/* Result Card */}
            {result && (
                <div className="result-card">
                    <div className="result-header">
                        <div className="result-icon" style={{ background: vaultInfo.gradient }}>
                            <span>{vaultInfo.icon}</span>
                        </div>
                        <div>
                            <h3>Document Classified!</h3>
                            <p className="result-vault">{vaultInfo.label}</p>
                        </div>
                        <span className="result-badge" style={{ background: vaultInfo.gradient }}>
                            Auto-tagged
                        </span>
                    </div>

                    <div className="result-details">
                        <div className="detail-row">
                            <span className="detail-label">File</span>
                            <span className="detail-value">{result.document?.fileName}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Vault</span>
                            <span className="detail-value vault-tag" style={{ background: vaultInfo.gradient }}>
                                {vaultInfo.icon} {vaultInfo.label}
                            </span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Tags Found</span>
                            <div className="tags-list">
                                {result.document?.tags?.length > 0
                                    ? result.document.tags.map((tag) => (
                                        <span key={tag} className="tag-chip">{tag}</span>
                                    ))
                                    : <span className="no-tags">No keywords matched</span>
                                }
                            </div>
                        </div>
                    </div>

                    <button className="upload-another-btn" onClick={resetUpload}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Upload Another
                    </button>
                </div>
            )}

            {/* How it works */}
            <div className="how-it-works">
                <h3>How it works</h3>
                <div className="steps-grid">
                    <div className="step-card">
                        <div className="step-number">1</div>
                        <h4>Upload</h4>
                        <p>Drop or select a PDF document</p>
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
