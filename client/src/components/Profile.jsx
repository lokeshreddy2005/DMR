import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

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
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 animate-fade-in-up">
            <button
                className="flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-bold mb-8 transition-colors group"
                onClick={onClose}
            >
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                </div>
                Back to Dashboard
            </button>

            <div className="bg-white dark:bg-gray-900/90 rounded-[2.5rem] shadow-xl border border-gray-200 dark:border-gray-800/80 overflow-hidden backdrop-blur-xl">
                {/* Header Banner */}
                <div className="h-32 sm:h-48 bg-gradient-to-r from-blue-600 to-indigo-600 relative overflow-hidden">
                    <div className="absolute inset-0 bg-black/10 mix-blend-overlay"></div>
                    <div className="absolute top-0 right-0 p-8 opacity-20 transform translate-x-1/4 -translate-y-1/4">
                        <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    </div>
                </div>

                <div className="px-6 sm:px-12 pb-12 relative">
                    {/* Avatar & Info */}
                    <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8 -mt-16 sm:-mt-20 mb-10 relative z-10">
                        <div
                            className="w-32 h-32 sm:w-40 sm:h-40 rounded-full flex items-center justify-center text-white font-bold text-4xl sm:text-5xl shadow-2xl border-4 border-white dark:border-gray-900"
                            style={{ backgroundColor: user?.avatarColor || '#3b82f6' }}
                        >
                            {initials}
                        </div>
                        <div className="text-center sm:text-left pb-2 flex-1">
                            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1">{user?.name}</h2>
                            <p className="text-gray-500 dark:text-gray-400 font-medium">{user?.email}</p>
                            <div className="mt-4 inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest border border-indigo-100 dark:border-indigo-800/30">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                Member since {memberSince}
                            </div>
                        </div>
                        <div className="hidden sm:block">
                            <button className="px-6 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold transition-colors flex items-center gap-2 shadow-sm border border-red-100 dark:border-red-900/30" onClick={logout}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                                Sign Out
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Sidebar Tabs */}
                        <div className="w-full lg:w-64 flex-shrink-0">
                            <div className="flex lg:flex-col gap-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto">
                                <button
                                    className={`flex items-center gap-3 px-5 py-3 rounded-xl font-bold transition-all text-sm whitespace-nowrap ${activeSection === 'info'
                                            ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200 dark:border-gray-700'
                                            : 'text-gray-500 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-800/80 hover:text-gray-800 dark:hover:text-gray-200'
                                        }`}
                                    onClick={() => { setActiveSection('info'); setMessage({ type: '', text: '' }); }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    Edit Profile
                                </button>
                                <button
                                    className={`flex items-center gap-3 px-5 py-3 rounded-xl font-bold transition-all text-sm whitespace-nowrap ${activeSection === 'password'
                                            ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200 dark:border-gray-700'
                                            : 'text-gray-500 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-800/80 hover:text-gray-800 dark:hover:text-gray-200'
                                        }`}
                                    onClick={() => { setActiveSection('password'); setMessage({ type: '', text: '' }); }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                    Change Password
                                </button>
                            </div>

                            <button className="w-full mt-6 px-6 py-3.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold transition-colors flex sm:hidden items-center justify-center gap-2 shadow-sm border border-red-100 dark:border-red-900/30" onClick={logout}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                                Sign Out
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 max-w-2xl">
                            {message.text && (
                                <div className={`px-6 py-4 rounded-2xl mb-8 font-bold flex items-center gap-3 animate-fade-in ${message.type === 'success'
                                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400'
                                        : 'bg-red-50 border border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400'
                                    }`}>
                                    {message.type === 'success' ? (
                                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </div>
                                    )}
                                    {message.text}
                                </div>
                            )}

                            {activeSection === 'info' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="mb-8">
                                        <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">Personal Information</h3>
                                        <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">Update your display name and contact email address.</p>
                                    </div>

                                    <form onSubmit={handleProfileUpdate} className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Full Name</label>
                                            <input
                                                className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 rounded-2xl outline-none transition-all text-gray-900 dark:text-white font-medium shadow-sm"
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Email Address</label>
                                            <input
                                                className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 rounded-2xl outline-none transition-all text-gray-900 dark:text-white font-medium shadow-sm"
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="pt-4">
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className={`px-8 py-4 w-full sm:w-auto rounded-2xl font-bold text-white shadow-xl transition-all flex items-center justify-center gap-2 ${loading ? 'bg-blue-400 dark:bg-blue-600 cursor-not-allowed border border-blue-400 dark:border-blue-600 shadow-none' : 'bg-gradient-to-r from-blue-600 to-indigo-600 border border-transparent hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/30 hover:-translate-y-0.5'
                                                    }`}
                                            >
                                                {loading ? 'Saving Changes...' : 'Save Changes'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {activeSection === 'password' && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="mb-8">
                                        <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">Change Password</h3>
                                        <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">Ensure your account is using a long, random password to stay secure.</p>
                                    </div>

                                    <form onSubmit={handlePasswordChange} className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Current Password</label>
                                            <input
                                                className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 rounded-2xl outline-none transition-all text-gray-900 dark:text-white font-medium shadow-sm font-mono tracking-widest text-lg"
                                                type="password"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <hr className="border-gray-100 dark:border-gray-800 my-6" />
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">New Password</label>
                                            <input
                                                className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 rounded-2xl outline-none transition-all text-gray-900 dark:text-white font-medium shadow-sm font-mono tracking-widest text-lg placeholder-gray-400 dark:placeholder-gray-500"
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="••••••••"
                                                required
                                            />
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-bold ml-1">Minimum 6 characters required.</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Confirm New Password</label>
                                            <input
                                                className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 rounded-2xl outline-none transition-all text-gray-900 dark:text-white font-medium shadow-sm font-mono tracking-widest text-lg placeholder-gray-400 dark:placeholder-gray-500"
                                                type="password"
                                                value={confirmNewPassword}
                                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                                placeholder="••••••••"
                                                required
                                            />
                                        </div>
                                        <div className="pt-4">
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className={`px-8 py-4 w-full sm:w-auto rounded-2xl font-bold shadow-xl transition-all flex items-center justify-center gap-2 ${loading ? 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed shadow-none' : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 hover:-translate-y-0.5 hover:shadow-gray-900/30 dark:hover:shadow-white/20'
                                                    }`}
                                            >
                                                {loading ? 'Changing Password...' : 'Update Password'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Profile;
