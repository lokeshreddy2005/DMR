import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

function Signup({ onSwitchToLogin }) {
    const { signup } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    function getPasswordStrength(pwd) {
        if (!pwd) return { level: 0, label: '', color: '' };
        let score = 0;
        if (pwd.length >= 6) score++;
        if (pwd.length >= 8) score++;
        if (/[A-Z]/.test(pwd)) score++;
        if (/[0-9]/.test(pwd)) score++;
        if (/[^A-Za-z0-9]/.test(pwd)) score++;

        if (score <= 1) return { level: 1, label: 'Weak', color: '#f43f5e' };
        if (score <= 2) return { level: 2, label: 'Fair', color: '#f59e0b' };
        if (score <= 3) return { level: 3, label: 'Good', color: '#06b6d4' };
        return { level: 4, label: 'Strong', color: '#10b981' };
    }

    const strength = getPasswordStrength(password);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setLoading(true);

        try {
            await signup(name, email, password);
        } catch (err) {
            setError(err.response?.data?.error || 'Signup failed. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-header">
                        <div className="auth-logo">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                        </div>
                        <h1 className="auth-title">Create account</h1>
                        <p className="auth-subtitle">Join DMR to manage your documents</p>
                    </div>

                    {error && (
                        <div className="auth-error">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="name">Full name</label>
                            <div className="input-wrapper">
                                <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                                <input
                                    id="name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="John Doe"
                                    required
                                    autoComplete="name"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="signup-email">Email address</label>
                            <div className="input-wrapper">
                                <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                    <polyline points="22,6 12,13 2,6" />
                                </svg>
                                <input
                                    id="signup-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    required
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="signup-password">Password</label>
                            <div className="input-wrapper">
                                <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                <input
                                    id="signup-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Min. 6 characters"
                                    required
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    className="toggle-password"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                            {password && (
                                <div className="password-strength">
                                    <div className="strength-bars">
                                        {[1, 2, 3, 4].map((i) => (
                                            <div
                                                key={i}
                                                className={`strength-bar ${i <= strength.level ? 'active' : ''}`}
                                                style={i <= strength.level ? { backgroundColor: strength.color } : {}}
                                            />
                                        ))}
                                    </div>
                                    <span className="strength-label" style={{ color: strength.color }}>
                                        {strength.label}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirm-password">Confirm password</label>
                            <div className="input-wrapper">
                                <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <input
                                    id="confirm-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter password"
                                    required
                                    autoComplete="new-password"
                                />
                            </div>
                            {confirmPassword && password !== confirmPassword && (
                                <span className="field-error">Passwords do not match</span>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="auth-submit"
                            disabled={loading || (confirmPassword && password !== confirmPassword)}
                        >
                            {loading ? (
                                <span className="btn-loading">
                                    <span className="spinner-small" />
                                    Creating account...
                                </span>
                            ) : (
                                'Create Account'
                            )}
                        </button>
                    </form>

                    <div className="auth-footer">
                        <p>
                            Already have an account?{' '}
                            <button className="auth-link" onClick={onSwitchToLogin}>
                                Sign in
                            </button>
                        </p>
                    </div>
                </div>

                <div className="auth-decoration">
                    <div className="decoration-orb orb-1" />
                    <div className="decoration-orb orb-2" />
                    <div className="decoration-orb orb-3" />
                </div>
            </div>
        </div>
    );
}

export default Signup;
