import { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';

const VAULT_CONFIG = {
    finance: {
        label: 'Finance Vault',
        icon: '💰',
        gradient: 'var(--gradient-finance)',
        accentColor: '#10b981',
    },
    hr: {
        label: 'HR Vault',
        icon: '👥',
        gradient: 'var(--gradient-hr)',
        accentColor: '#8b5cf6',
    },
    project: {
        label: 'Project Vault',
        icon: '📋',
        gradient: 'var(--gradient-project)',
        accentColor: '#f59e0b',
    },
};

function Dashboard() {
    const [documents, setDocuments] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [activeVault, setActiveVault] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        try {
            const [docsRes, statsRes] = await Promise.all([
                axios.get('/api/documents'),
                axios.get('/api/documents/stats'),
            ]);
            setDocuments(docsRes.data.documents || []);
            setStats(statsRes.data.stats || {});
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    }

    const filteredDocs = activeVault
        ? documents.filter((d) => d.vault === activeVault)
        : documents;

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const totalDocs = documents.length;

    if (loading) {
        return (
            <div className="dashboard">
                <div className="dashboard-loading">
                    <div className="loading-spinner" />
                    <p>Loading vault data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h2>Document Dashboard</h2>
                <p>Overview of all documents across your vaults</p>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div
                    className={`stat-card stat-total ${activeVault === null ? 'active' : ''}`}
                    onClick={() => setActiveVault(null)}
                >
                    <div className="stat-icon total-icon">📊</div>
                    <div className="stat-info">
                        <span className="stat-count">{totalDocs}</span>
                        <span className="stat-label">Total Documents</span>
                    </div>
                </div>

                {Object.entries(VAULT_CONFIG).map(([key, config]) => {
                    const count = stats[key]?.count || 0;
                    return (
                        <div
                            key={key}
                            className={`stat-card ${activeVault === key ? 'active' : ''}`}
                            onClick={() => setActiveVault(activeVault === key ? null : key)}
                            style={{ '--card-accent': config.accentColor }}
                        >
                            <div className="stat-icon" style={{ background: config.gradient }}>
                                {config.icon}
                            </div>
                            <div className="stat-info">
                                <span className="stat-count">{count}</span>
                                <span className="stat-label">{config.label}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Filter indicator */}
            {activeVault && (
                <div className="filter-indicator">
                    <span>
                        Showing: <strong>{VAULT_CONFIG[activeVault]?.label}</strong>
                    </span>
                    <button onClick={() => setActiveVault(null)} className="clear-filter">
                        Clear filter ×
                    </button>
                </div>
            )}

            {/* Document List */}
            <div className="documents-section">
                <div className="section-header">
                    <h3>
                        {activeVault
                            ? `${VAULT_CONFIG[activeVault]?.icon} ${VAULT_CONFIG[activeVault]?.label}`
                            : 'All Documents'}
                    </h3>
                    <span className="doc-count">{filteredDocs.length} documents</span>
                </div>

                {filteredDocs.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📂</div>
                        <h4>No documents yet</h4>
                        <p>Upload your first PDF to see it appear here</p>
                    </div>
                ) : (
                    <div className="documents-list">
                        {filteredDocs.map((doc, index) => {
                            const config = VAULT_CONFIG[doc.vault] || {
                                label: 'Uncategorized',
                                icon: '📄',
                                gradient: 'var(--gradient-primary)',
                                accentColor: '#3b82f6',
                            };

                            return (
                                <div
                                    key={doc._id}
                                    className="doc-card"
                                    style={{
                                        animationDelay: `${index * 0.05}s`,
                                        '--doc-accent': config.accentColor,
                                    }}
                                >
                                    <div className="doc-icon" style={{ background: config.gradient }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <polyline points="14 2 14 8 20 8" />
                                        </svg>
                                    </div>

                                    <div className="doc-info">
                                        <h4 className="doc-name">{doc.fileName}</h4>
                                        <div className="doc-meta">
                                            <span className="doc-vault-tag" style={{ background: config.gradient }}>
                                                {config.icon} {config.label}
                                            </span>
                                            <span className="doc-date">{formatDate(doc.uploadDate)}</span>
                                            {doc.formattedSize && (
                                                <span className="doc-size">{doc.formattedSize}</span>
                                            )}
                                        </div>
                                        {doc.tags && doc.tags.length > 0 && (
                                            <div className="doc-tags">
                                                {doc.tags.slice(0, 5).map((tag) => (
                                                    <span key={tag} className="doc-tag">{tag}</span>
                                                ))}
                                                {doc.tags.length > 5 && (
                                                    <span className="doc-tag more">+{doc.tags.length - 5}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Dashboard;
