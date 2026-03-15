import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Profile.css';

function Profile({ onClose }) {
    const { user, logout, updateProfile, changePassword } = useAuth();
    const [activeSection, setActiveSection] = useState('info');
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });
    const [loading, setLoading] = useState(false);

    const initials = user?.name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || '?';

    const memberSince = user?.createdAt
        ? new Date(user.createdAt).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        })
        : '';

    async function handleProfileUpdate(e) {
        e.preventDefault();
        setMessage({ type: '', text: '' });
        setLoading(true);

        try {
            await updateProfile({ name, email });
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Update failed.' });
        } finally {
            setLoading(false);
        }
    }

    async function handlePasswordChange(e) {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        if (newPassword !== confirmNewPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match.' });
            return;
        }

        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
            return;
        }

        setLoading(true);

        try {
            await changePassword(currentPassword, newPassword);
            setMessage({ type: 'success', text: 'Password changed successfully!' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Password change failed.' });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="profile-page">
            <div className="profile-container">
                {/* Profile Header */}
                <div className="profile-header-card">
                    <button className="profile-back-btn" onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                        Back
                    </button>

                    <div className="profile-hero">
                        <div
                            className="profile-avatar-large"
                            style={{ backgroundColor: user?.avatarColor || '#3b82f6' }}
                        >
                            {initials}
                        </div>
                        <div className="profile-hero-info">
                            <h2>{user?.name}</h2>
                            <p>{user?.email}</p>
                            <span className="member-badge">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                                Member since {memberSince}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Section Tabs */}
                <div className="profile-tabs">
                    <button
                        className={`profile-tab ${activeSection === 'info' ? 'active' : ''}`}
                        onClick={() => { setActiveSection('info'); setMessage({ type: '', text: '' }); }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                        Edit Profile
                    </button>
                    <button
                        className={`profile-tab ${activeSection === 'password' ? 'active' : ''}`}
                        onClick={() => { setActiveSection('password'); setMessage({ type: '', text: '' }); }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Change Password
                    </button>
                </div>

                {/* Messages */}
                {message.text && (
                    <div className={`profile-message ${message.type}`}>
                        {message.type === 'success' ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                        )}
                        {message.text}
                    </div>
                )}

                {/* Edit Profile Section */}
                {activeSection === 'info' && (
                    <div className="profile-section">
                        <form onSubmit={handleProfileUpdate}>
                            <div className="form-group">
                                <label htmlFor="profile-name">Full name</label>
                                <input
                                    id="profile-name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="profile-email">Email address</label>
                                <input
                                    id="profile-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" className="profile-save-btn" disabled={loading}>
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </form>
                    </div>
                )}

                {/* Change Password Section */}
                {activeSection === 'password' && (
                    <div className="profile-section">
                        <form onSubmit={handlePasswordChange}>
                            <div className="form-group">
                                <label htmlFor="current-pwd">Current password</label>
                                <input
                                    id="current-pwd"
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="new-pwd">New password</label>
                                <input
                                    id="new-pwd"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Min. 6 characters"
                                    required
                                    autoComplete="new-password"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="confirm-new-pwd">Confirm new password</label>
                                <input
                                    id="confirm-new-pwd"
                                    type="password"
                                    value={confirmNewPassword}
                                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                                    required
                                    autoComplete="new-password"
                                />
                            </div>
                            <button type="submit" className="profile-save-btn" disabled={loading}>
                                {loading ? 'Changing...' : 'Change Password'}
                            </button>
                        </form>
                    </div>
                )}

                {/* Danger Zone */}
                <div className="profile-danger-zone">
                    <h4>Session</h4>
                    <p>Sign out of your account on this device.</p>
                    <button className="logout-btn" onClick={logout}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Profile;
