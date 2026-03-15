import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => localStorage.getItem('dmr_token'));
    const [loading, setLoading] = useState(true);

    // Set axios default auth header
    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
            delete axios.defaults.headers.common['Authorization'];
        }
    }, [token]);

    // Fetch user on mount if token exists
    useEffect(() => {
        if (token) {
            fetchUser();
        } else {
            setLoading(false);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    async function fetchUser() {
        try {
            const res = await axios.get('/api/auth/me');
            setUser(res.data.user);
        } catch {
            // Token invalid — clear it
            localStorage.removeItem('dmr_token');
            setToken(null);
            setUser(null);
        } finally {
            setLoading(false);
        }
    }

    const signup = useCallback(async (name, email, password) => {
        const res = await axios.post('/api/auth/signup', { name, email, password });
        const { token: newToken, user: newUser } = res.data;
        localStorage.setItem('dmr_token', newToken);
        setToken(newToken);
        setUser(newUser);
        return res.data;
    }, []);

    const login = useCallback(async (email, password) => {
        const res = await axios.post('/api/auth/login', { email, password });
        const { token: newToken, user: newUser } = res.data;
        localStorage.setItem('dmr_token', newToken);
        setToken(newToken);
        setUser(newUser);
        return res.data;
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('dmr_token');
        setToken(null);
        setUser(null);
        delete axios.defaults.headers.common['Authorization'];
    }, []);

    const updateProfile = useCallback(async (data) => {
        const res = await axios.put('/api/auth/profile', data);
        setUser(res.data.user);
        return res.data;
    }, []);

    const changePassword = useCallback(async (currentPassword, newPassword) => {
        const res = await axios.put('/api/auth/password', { currentPassword, newPassword });
        return res.data;
    }, []);

    const value = {
        user,
        token,
        loading,
        isAuthenticated: !!user,
        signup,
        login,
        logout,
        updateProfile,
        changePassword,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
