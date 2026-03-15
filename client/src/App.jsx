import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Signup from './components/Signup';
import Profile from './components/Profile';
import './App.css';

function App() {
    const { user, loading, isAuthenticated, logout } = useAuth();
    const [view, setView] = useState('dashboard'); // 'dashboard' | 'profile'
    const [authMode, setAuthMode] = useState('login');
    const [showUserMenu, setShowUserMenu] = useState(false);

    // Loading spinner
    if (loading) {
        return (
            <div className="app-loading">
                <div className="loading-spinner-large" />
                <p>Loading DMR...</p>
            </div>
        );
    }

    // Not authenticated
    if (!isAuthenticated) {
        if (authMode === 'signup') {
            return <Signup onSwitchToLogin={() => setAuthMode('login')} />;
        }
        return <Login onSwitchToSignup={() => setAuthMode('signup')} />;
    }

    // Profile view
    if (view === 'profile') {
        return (
            <div className="app">
                <header className="app-header">
                    <div className="header-content">
                        <div className="logo-section">
                            <div className="logo-icon">📁</div>
                            <div>
                                <h1 className="logo-title">DMR</h1>
                                <p className="logo-subtitle">Document Management Repository</p>
                            </div>
                        </div>
                    </div>
                </header>
                <main className="app-main">
                    <Profile onClose={() => setView('dashboard')} />
                </main>
            </div>
        );
    }

    const initials = user?.name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || '?';

    return (
        <div className="app">
            <header className="app-header">
                <div className="header-content">
                    <div className="logo-section">
                        <div className="logo-icon">📁</div>
                        <div>
                            <h1 className="logo-title">DMR</h1>
                            <p className="logo-subtitle">Document Management Repository</p>
                        </div>
                    </div>

                    <div className="header-right">
                        {/* User Menu */}
                        <div className="user-menu-wrapper">
                            <button
                                className="user-avatar-btn"
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                style={{ backgroundColor: user?.avatarColor || '#3b82f6' }}
                            >
                                {initials}
                            </button>

                            {showUserMenu && (
                                <>
                                    <div className="menu-backdrop" onClick={() => setShowUserMenu(false)} />
                                    <div className="user-dropdown">
                                        <div className="dropdown-header">
                                            <div
                                                className="dropdown-avatar"
                                                style={{ backgroundColor: user?.avatarColor || '#3b82f6' }}
                                            >
                                                {initials}
                                            </div>
                                            <div>
                                                <p className="dropdown-name">{user?.name}</p>
                                                <p className="dropdown-email">{user?.email}</p>
                                            </div>
                                        </div>
                                        <div className="dropdown-divider" />
                                        <button
                                            className="dropdown-item"
                                            onClick={() => {
                                                setView('profile');
                                                setShowUserMenu(false);
                                            }}
                                        >
                                            👤 Profile
                                        </button>
                                        <button
                                            className="dropdown-item dropdown-logout"
                                            onClick={() => {
                                                logout();
                                                setShowUserMenu(false);
                                            }}
                                        >
                                            🚪 Sign Out
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="app-main">
                <Dashboard />
            </main>

            <footer className="app-footer">
                <p>DMR — Document Management Repository · Spaces & Permissions</p>
            </footer>
        </div>
    );
}

export default App;
