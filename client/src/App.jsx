import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Layouts
import { AuthLayout } from './components/layout/AuthLayout';
import { AppLayout } from './components/layout/AppLayout';
import { PublicLayout } from './components/layout/PublicLayout';
import { EmbedLayout } from './components/layout/EmbedLayout';

// Pages
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { Workspace } from './pages/Workspace';
import { Profile } from './pages/Profile';
import { EmbedUpload } from './pages/EmbedUpload';
import { EmbedRetrieve } from './pages/EmbedRetrieve';
import { VaultBrowser } from './pages/VaultBrowser';

// Route Guards
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    if (loading) return null;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return children;
};

const PublicOnlyRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    if (loading) return null;
    if (isAuthenticated) return <Navigate to="/dashboard" replace />;
    return children;
};

function App() {
    return (
        <Router>
            <Routes>
                {/* Public Marketing & Info Routes */}
                <Route element={<PublicLayout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/public" element={<Workspace isPublicOnly={true} />} />
                </Route>

                {/* Micro Frontend Embed Routes */}
                <Route element={<EmbedLayout />}>
                    <Route path="/embed/upload" element={<EmbedUpload />} />
                    <Route path="/embed/documents/:id" element={<EmbedRetrieve />} />
                </Route>

                {/* Authentication Routes */}
                <Route element={<PublicOnlyRoute><AuthLayout /></PublicOnlyRoute>}>
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                </Route>

                {/* Protected Application Routes */}
                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/search" element={<Workspace isSearchPage={true} />} />
                    <Route path="/workspace/:spaceId" element={<Workspace />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/vaults" element={<VaultBrowser />} />
                    <Route path="/vaults/:vaultId" element={<VaultBrowser />} />
                </Route>

                {/* Catch all */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
    );
}

export default App;
