import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import UploadModal from './UploadModal';
import './Dashboard.css';

function Dashboard() {
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

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [statsRes, storageRes, orgsRes] = await Promise.all([
                axios.get('/api/documents/stats'),
                axios.get('/api/documents/storage'),
                axios.get('/api/orgs'),
            ]);
            setStats(statsRes.data.stats || {});
            setStorage(storageRes.data.storage || null);
            setOrgs(orgsRes.data.organizations || []);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchDocs = useCallback(async () => {
        try {
            let url = '/api/documents';
            if (activeSpace === 'organization' && selectedOrg) {
                url += `?space=organization&organizationId=${selectedOrg._id}`;
            } else if (activeSpace !== 'organization') {
                url += `?space=${activeSpace}`;
            }
            const res = await axios.get(url);
            setDocuments(res.data.documents || []);
        } catch (err) {
            console.error('Fetch docs error:', err);
        }
    }, [activeSpace, selectedOrg]);

    useEffect(() => { fetchAll(); }, [fetchAll]);
    useEffect(() => { fetchDocs(); }, [fetchDocs]);

    function showMsg(type, text) {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }

    async function handleCreateOrg() {
        if (!newOrgName.trim()) return;
        try {
            await axios.post('/api/orgs', { name: newOrgName, description: newOrgDesc });
            setNewOrgName(''); setNewOrgDesc(''); setShowOrgForm(false);
            showMsg('success', 'Organization created!');
            fetchAll();
        } catch (err) {
            showMsg('error', err.response?.data?.error || 'Failed to create org.');
        }
    }

    async function handleAddMember() {
        if (!memberEmail.trim() || !selectedOrg) return;
        try {
            await axios.post(`/api/orgs/${selectedOrg._id}/members`, { email: memberEmail, role: memberRole });
            setMemberEmail(''); setShowAddMember(false);
            showMsg('success', 'Member added!');
            fetchAll();
        } catch (err) {
            showMsg('error', err.response?.data?.error || 'Failed to add member.');
        }
    }

    async function handleDeleteDoc(docId) {
        if (!confirm('Delete this document permanently?')) return;
        try {
            await axios.delete(`/api/documents/${docId}`);
            showMsg('success', 'Document deleted.');
            fetchDocs(); fetchAll();
        } catch (err) {
            showMsg('error', err.response?.data?.error || 'Delete failed.');
        }
    }

    async function handleDownload(docId) {
        try {
            const res = await axios.get(`/api/documents/${docId}/download`);
            window.open(res.data.downloadUrl, '_blank');
        } catch (err) {
            showMsg('error', 'Download failed.');
        }
    }

    async function handleViewDetail(docId) {
        try {
            const res = await axios.get(`/api/documents/${docId}`);
            setDocDetail(res.data.document);
        } catch (err) {
            showMsg('error', 'Failed to load document details.');
        }
    }

    async function handleShareDoc() {
        if (!shareEmail.trim() || !docDetail) return;
        try {
            const res = await axios.post(`/api/documents/${docDetail._id}/permissions`, {
                email: shareEmail, level: shareLevel,
            });
            setDocDetail(res.data.document);
            setShareEmail('');
            showMsg('success', 'Access granted!');
        } catch (err) {
            showMsg('error', err.response?.data?.error || 'Share failed.');
        }
    }

    async function handleRevokeAccess(docId, userId) {
        try {
            const res = await axios.delete(`/api/documents/${docId}/permissions/${userId}`);
            setDocDetail(res.data.document);
            showMsg('success', 'Access revoked.');
        } catch (err) {
            showMsg('error', err.response?.data?.error || 'Revoke failed.');
        }
    }

    async function handleRemoveMember(userId) {
        if (!selectedOrg) return;
        try {
            await axios.delete(`/api/orgs/${selectedOrg._id}/members/${userId}`);
            showMsg('success', 'Member removed.');
            fetchAll();
        } catch (err) {
            showMsg('error', err.response?.data?.error || 'Remove failed.');
        }
    }

    const formatDate = (d) => new Date(d).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
    const formatSize = (b) => {
        if (!b) return '0 B';
        const s = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(b) / Math.log(1024));
        return parseFloat((b / Math.pow(1024, i)).toFixed(1)) + ' ' + s[i];
    };

    if (loading) {
        return (
            <div className="dash">
                <div className="dash-loading"><div className="loading-spinner" /><p>Loading...</p></div>
            </div>
        );
    }

    return (
        <div className="dash">
            {/* Message */}
            {message.text && <div className={`dash-msg ${message.type}`}>{message.text}</div>}

            {/* Upload Modal */}
            <UploadModal
                isOpen={showUpload}
                onClose={() => setShowUpload(false)}
                onUploadSuccess={() => { fetchDocs(); fetchAll(); }}
                defaultSpace={activeSpace === 'organization' ? 'organization' : activeSpace}
                defaultOrgId={selectedOrg?._id}
            />

            {/* Document Detail Modal */}
            {docDetail && (
                <div className="modal-overlay" onClick={() => setDocDetail(null)}>
                    <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="detail-header">
                            <h3>📄 {docDetail.fileName}</h3>
                            <button className="modal-close" onClick={() => setDocDetail(null)}>×</button>
                        </div>
                        <div className="detail-body">
                            <div className="detail-row"><span>Space</span><span className={`space-badge ${docDetail.space}`}>{docDetail.space}</span></div>
                            <div className="detail-row"><span>Size</span><span>{formatSize(docDetail.fileSize)}</span></div>
                            <div className="detail-row"><span>Type</span><span>{docDetail.mimeType}</span></div>
                            <div className="detail-row"><span>Uploaded</span><span>{formatDate(docDetail.uploadDate)}</span></div>
                            <div className="detail-row"><span>By</span><span>{docDetail.uploadedBy?.name}</span></div>
                            {docDetail.description && <div className="detail-row"><span>Description</span><span>{docDetail.description}</span></div>}

                            {/* Permissions */}
                            <div className="perms-section">
                                <h4>Permissions</h4>
                                {docDetail.permissions?.map((p) => (
                                    <div key={p._id} className="perm-row">
                                        <div className="perm-avatar" style={{ backgroundColor: p.user?.avatarColor || '#3b82f6' }}>
                                            {p.user?.name?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div className="perm-info">
                                            <span>{p.user?.name || 'Unknown'}</span>
                                            <span className="perm-level">{p.level}</span>
                                        </div>
                                        {p.level !== 'owner' && (
                                            <button className="perm-revoke" onClick={() => handleRevokeAccess(docDetail._id, p.user?._id)}>×</button>
                                        )}
                                    </div>
                                ))}

                                {/* Share */}
                                <div className="share-form">
                                    <input
                                        placeholder="Email to share with..."
                                        value={shareEmail}
                                        onChange={(e) => setShareEmail(e.target.value)}
                                    />
                                    <select value={shareLevel} onChange={(e) => setShareLevel(e.target.value)}>
                                        <option value="viewer">Viewer</option>
                                        <option value="editor">Editor</option>
                                    </select>
                                    <button onClick={handleShareDoc}>Share</button>
                                </div>
                            </div>
                        </div>
                        <div className="detail-actions">
                            <button className="btn-dl" onClick={() => handleDownload(docDetail._id)}>⬇ Download</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Bar */}
            <div className="dash-top">
                <div>
                    <h2>Document Manager</h2>
                    <p className="dash-subtitle">Manage files across Public, Private & Organization spaces</p>
                </div>
                <button className="btn-upload-main" onClick={() => setShowUpload(true)}>
                    + Upload Document
                </button>
            </div>

            {/* Storage Summary */}
            {storage && (
                <div className="storage-cards">
                    <div className="storage-card">
                        <div className="storage-head">
                            <span>🌐 Public Space</span>
                            <span className="storage-pct">{storage.public.percentage}%</span>
                        </div>
                        <div className="storage-bar"><div className="storage-fill public-fill" style={{ width: `${storage.public.percentage}%` }} /></div>
                        <span className="storage-text">{formatSize(storage.public.used)} / {formatSize(storage.public.limit)}</span>
                    </div>
                    <div className="storage-card">
                        <div className="storage-head">
                            <span>🔒 Private Space</span>
                            <span className="storage-pct">{storage.private.percentage}%</span>
                        </div>
                        <div className="storage-bar"><div className="storage-fill private-fill" style={{ width: `${storage.private.percentage}%` }} /></div>
                        <span className="storage-text">{formatSize(storage.private.used)} / {formatSize(storage.private.limit)}</span>
                    </div>
                    {storage.organizations?.map((org) => (
                        <div className="storage-card" key={org.orgId}>
                            <div className="storage-head">
                                <span>🏢 {org.orgName}</span>
                                <span className="storage-pct">{org.percentage}%</span>
                            </div>
                            <div className="storage-bar"><div className="storage-fill org-fill" style={{ width: `${org.percentage}%` }} /></div>
                            <span className="storage-text">{formatSize(org.used)} / {formatSize(org.limit)}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Space Tabs */}
            <div className="space-tabs">
                {[
                    { key: 'public', icon: '🌐', label: 'Public', count: stats.public?.count || 0 },
                    { key: 'private', icon: '🔒', label: 'Private', count: stats.private?.count || 0 },
                    { key: 'organization', icon: '🏢', label: 'Organizations', count: stats.organization?.count || 0 },
                ].map((s) => (
                    <button
                        key={s.key}
                        className={`space-tab ${activeSpace === s.key ? 'active' : ''}`}
                        onClick={() => { setActiveSpace(s.key); setSelectedOrg(null); }}
                    >
                        <span className="st-icon">{s.icon}</span>
                        <span>{s.label}</span>
                        <span className="st-count">{s.count}</span>
                    </button>
                ))}
            </div>

            {/* Organization view */}
            {activeSpace === 'organization' && (
                <div className="org-section">
                    <div className="org-list">
                        <div className="org-list-head">
                            <h3>Your Organizations</h3>
                            <button className="btn-sm" onClick={() => setShowOrgForm(!showOrgForm)}>
                                {showOrgForm ? 'Cancel' : '+ New'}
                            </button>
                        </div>

                        {showOrgForm && (
                            <div className="org-form">
                                <input placeholder="Organization name" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} />
                                <input placeholder="Description (optional)" value={newOrgDesc} onChange={(e) => setNewOrgDesc(e.target.value)} />
                                <button className="btn-create" onClick={handleCreateOrg}>Create</button>
                            </div>
                        )}

                        {orgs.map((org) => (
                            <button
                                key={org._id}
                                className={`org-item ${selectedOrg?._id === org._id ? 'active' : ''}`}
                                onClick={() => setSelectedOrg(org)}
                            >
                                <div className="org-avatar" style={{ backgroundColor: org.avatarColor || '#3b82f6' }}>
                                    {org.name[0]?.toUpperCase()}
                                </div>
                                <div className="org-info">
                                    <p className="org-name">{org.name}</p>
                                    <p className="org-meta">{org.members?.length || 0} members</p>
                                </div>
                            </button>
                        ))}

                        {orgs.length === 0 && !showOrgForm && (
                            <p className="empty-text">No organizations yet. Create one!</p>
                        )}
                    </div>

                    {/* Org Members Panel */}
                    {selectedOrg && (
                        <div className="org-members-panel">
                            <div className="org-members-head">
                                <h4>{selectedOrg.name} — Members</h4>
                                <button className="btn-sm" onClick={() => setShowAddMember(!showAddMember)}>
                                    {showAddMember ? 'Cancel' : '+ Add'}
                                </button>
                            </div>

                            {showAddMember && (
                                <div className="add-member-form">
                                    <input placeholder="User email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
                                    <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
                                        <option value="admin">Admin</option>
                                        <option value="member">Member</option>
                                        <option value="viewer">Viewer</option>
                                    </select>
                                    <button className="btn-create" onClick={handleAddMember}>Add</button>
                                </div>
                            )}

                            <div className="members-list">
                                {selectedOrg.members?.map((m) => (
                                    <div key={m._id} className="member-row">
                                        <div className="perm-avatar" style={{ backgroundColor: m.user?.avatarColor || '#666' }}>
                                            {m.user?.name?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div className="perm-info">
                                            <span>{m.user?.name || m.user?.email}</span>
                                            <span className={`role-badge ${m.role}`}>{m.role}</span>
                                        </div>
                                        {m.role !== 'admin' && (
                                            <button className="perm-revoke" onClick={() => handleRemoveMember(m.user?._id)}>×</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Documents Grid */}
            <div className="docs-section">
                <div className="docs-head">
                    <h3>
                        {activeSpace === 'organization' && selectedOrg
                            ? `${selectedOrg.name} — Documents`
                            : `${activeSpace.charAt(0).toUpperCase() + activeSpace.slice(1)} Documents`}
                    </h3>
                    <span className="doc-count">{documents.length} files</span>
                </div>

                {documents.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">📂</span>
                        <h4>No documents yet</h4>
                        <p>Upload your first file to this space</p>
                        <button className="btn-upload-main" onClick={() => setShowUpload(true)}>+ Upload</button>
                    </div>
                ) : (
                    <div className="docs-grid">
                        {documents.map((doc) => (
                            <div key={doc._id} className="doc-card" onClick={() => handleViewDetail(doc._id)}>
                                <div className="dc-top">
                                    <span className="dc-icon">📄</span>
                                    <div className="dc-actions">
                                        <button onClick={(e) => { e.stopPropagation(); handleDownload(doc._id); }} title="Download">⬇</button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc._id); }} title="Delete" className="dc-del">🗑</button>
                                    </div>
                                </div>
                                <p className="dc-name">{doc.fileName}</p>
                                <div className="dc-meta">
                                    <span className={`space-badge ${doc.space}`}>{doc.space}</span>
                                    <span>{formatSize(doc.fileSize)}</span>
                                </div>
                                <p className="dc-date">{formatDate(doc.uploadDate)} · {doc.uploadedBy?.name}</p>
                                {doc.description && <p className="dc-desc">{doc.description}</p>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Dashboard;
