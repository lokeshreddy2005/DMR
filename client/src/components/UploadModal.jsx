import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './UploadModal.css';

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

    function handleDrop(e) {
        e.preventDefault();
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
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Upload Document</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                {success ? (
                    <div className="upload-success-msg">
                        <div className="success-icon">✓</div>
                        <p>Document uploaded successfully!</p>
                    </div>
                ) : (
                    <>
                        {/* Space Selector */}
                        <div className="space-selector">
                            <label>Upload to</label>
                            <div className="space-options">
                                {[
                                    { key: 'public', icon: '🌐', label: 'Public' },
                                    { key: 'private', icon: '🔒', label: 'Private' },
                                    { key: 'organization', icon: '🏢', label: 'Organization' },
                                ].map((s) => (
                                    <button
                                        key={s.key}
                                        className={`space-option ${space === s.key ? 'active' : ''}`}
                                        onClick={() => setSpace(s.key)}
                                    >
                                        <span className="space-opt-icon">{s.icon}</span>
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Org Picker */}
                        {space === 'organization' && (
                            <div className="form-group">
                                <label>Organization</label>
                                <select
                                    value={organizationId}
                                    onChange={(e) => setOrganizationId(e.target.value)}
                                    className="org-select"
                                >
                                    <option value="">Select organization...</option>
                                    {orgs.map((o) => (
                                        <option key={o._id} value={o._id}>{o.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Drop Zone */}
                        <div
                            className={`modal-drop-zone ${file ? 'has-file' : ''}`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                onChange={handleFileSelect}
                                hidden
                            />
                            {file ? (
                                <div className="file-preview">
                                    <span className="file-icon">📄</span>
                                    <div>
                                        <p className="file-name">{file.name}</p>
                                        <p className="file-size">{formatSize(file.size)}</p>
                                    </div>
                                    <button
                                        className="remove-file"
                                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                    >×</button>
                                </div>
                            ) : (
                                <div className="drop-content">
                                    <span className="drop-icon-large">📁</span>
                                    <p>Drop a file here or click to browse</p>
                                    <p className="drop-hint">Any file type · Max 50 MB</p>
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        <div className="form-group">
                            <label>Description (optional)</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Add a note about this document..."
                                rows={2}
                                className="desc-input"
                            />
                        </div>

                        {/* Error */}
                        {error && <div className="modal-error">{error}</div>}

                        {/* Progress */}
                        {uploading && (
                            <div className="upload-progress-bar">
                                <div className="progress-fill" style={{ width: `${progress}%` }} />
                            </div>
                        )}

                        {/* Actions */}
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={onClose} disabled={uploading}>
                                Cancel
                            </button>
                            <button className="btn-upload" onClick={handleUpload} disabled={uploading || !file}>
                                {uploading ? `Uploading ${progress}%...` : 'Upload'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default UploadModal;
