import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Signup from './components/Signup';
import Profile from './components/Profile';

// Theme Toggle Component
function ThemeToggle() {
    const { isDarkMode, toggleTheme } = useTheme();
    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            aria-label="Toggle Dark Mode"
        >
            {isDarkMode ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
            ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
            )}
        </button>
    );
}

function App() {
    const { user, loading, isAuthenticated, logout } = useAuth();
    const [view, setView] = useState('dashboard'); // 'dashboard' | 'profile'
    const [authMode, setAuthMode] = useState('login');
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showPublic, setShowPublic] = useState(false);

    // Loading spinner
    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans">
                <svg className="animate-spin h-10 w-10 text-blue-500 mb-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Loading DMR...</p>
            </div>
        );
    }

    // Not authenticated — show public docs or login/signup
    if (!isAuthenticated) {
        if (showPublic) {
            return (
                <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">
                    <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border-b border-gray-200 dark:border-gray-800">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md">
                                    📁
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold leading-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">DMR</h1>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Public Repository</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <ThemeToggle />
                                <button
                                    className="px-5 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
                                    onClick={() => setShowPublic(false)}
                                >
                                    Sign In
                                </button>
                            </div>
                        </div>
                    </header>
                    <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
                        <Dashboard publicOnly={true} />
                    </main>
                    <footer className="py-6 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800 mt-auto">
                        <p>DMR — Public Document Browser (Read-Only)</p>
                    </footer>
                </div>
            );
        }

        return (
            <div className="min-h-screen flex flex-col relative font-sans">
                <div className="absolute top-4 right-4 z-50">
                    <ThemeToggle />
                </div>
                {authMode === 'signup' ? (
                    <Signup onSwitchToLogin={() => setAuthMode('login')} />
                ) : (
                    <Login onSwitchToSignup={() => setAuthMode('signup')} />
                )}
                <div className="absolute bottom-8 left-0 right-0 text-center z-50">
                    <button
                        onClick={() => setShowPublic(true)}
                        className="text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors bg-white/50 dark:bg-gray-900/50 backdrop-blur-md px-6 py-2 rounded-full border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow"
                    >
                        Browse public documents →
                    </button>
                </div>
            </div>
        );
    }

    const initials = user?.name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || '?';

    // Authenticated View
    return (
        <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">
            <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border-b border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('dashboard')}>
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md">
                            📁
                        </div>
                        <div>
                            <h1 className="text-xl font-bold leading-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">DMR</h1>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium hidden sm:block">Document Management Repository</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <ThemeToggle />

                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="w-10 h-10 rounded-full text-white font-bold flex items-center justify-center shadow-md border-2 border-white dark:border-gray-800 hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-blue-500"
                                style={{ backgroundColor: user?.avatarColor || '#3b82f6' }}
                            >
                                {initials}
                            </button>

                            {showUserMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl ring-1 ring-black ring-opacity-5 dark:ring-white dark:ring-opacity-10 z-50 overflow-hidden transform opacity-100 scale-100 transition-all origin-top-right">
                                        <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div
                                                    className="w-10 h-10 rounded-full text-white font-bold flex items-center justify-center shadow-sm"
                                                    style={{ backgroundColor: user?.avatarColor || '#3b82f6' }}
                                                >
                                                    {initials}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">{user?.name}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="py-1">
                                            <button
                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 flex items-center gap-2 transition-colors"
                                                onClick={() => { setView('profile'); setShowUserMenu(false); }}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                Profile Settings
                                            </button>
                                            <button
                                                className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                                                onClick={() => { logout(); setShowUserMenu(false); }}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                                                Sign Out
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
                {view === 'profile' ? (
                    <Profile onClose={() => setView('dashboard')} />
                ) : (
                    <Dashboard />
                )}
            </main>

            <footer className="py-6 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800 mt-auto">
                <p>DMR — Document Management Repository</p>
            </footer>
        </div>
    );
}

export default App;
