import { useState, useCallback } from 'react';
import SmartUpload from './components/SmartUpload';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
    const [activeTab, setActiveTab] = useState('upload');
    const [refreshKey, setRefreshKey] = useState(0);

    const handleUploadSuccess = useCallback(() => {
        setRefreshKey((k) => k + 1);
    }, []);

    return (
        <div className="app">
            {/* Header */}
            <header className="app-header">
                <div className="header-content">
                    <div className="logo-section">
                        <div className="logo-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="logo-title">Smart Upload</h1>
                            <p className="logo-subtitle">Intelligent Document Vault System</p>
                        </div>
                    </div>

                    <nav className="tab-nav">
                        <button
                            className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
                            onClick={() => setActiveTab('upload')}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            Upload
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                            onClick={() => setActiveTab('dashboard')}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="7" height="7" />
                                <rect x="14" y="3" width="7" height="7" />
                                <rect x="14" y="14" width="7" height="7" />
                                <rect x="3" y="14" width="7" height="7" />
                            </svg>
                            Dashboard
                        </button>
                    </nav>
                </div>
            </header>

            {/* Main Content */}
            <main className="app-main">
                {activeTab === 'upload' ? (
                    <SmartUpload onUploadSuccess={handleUploadSuccess} />
                ) : (
                    <Dashboard key={refreshKey} />
                )}
            </main>

            {/* Footer */}
            <footer className="app-footer">
                <p>Sprint 2 — Smart Upload System &middot; Document Vault Classification</p>
            </footer>
        </div>
    );
}

export default App;
