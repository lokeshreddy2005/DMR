import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { UserCircle, KeyRound, CheckCircle2, AlertCircle, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function Profile() {
    const { user, logout, updateProfile, changePassword } = useAuth();
    const [activeSection, setActiveSection] = useState('info');
    
    // Form state
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    
    const [toast, setToast] = useState(null);
    const [loading, setLoading] = useState(false);

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3000);
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateProfile({ name, email });
            showToast('success', 'Profile updated successfully!');
        } catch (err) {
            showToast('error', err.response?.data?.error || 'Update failed.');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmNewPassword) {
            showToast('error', 'New passwords do not match.');
            return;
        }
        if (newPassword.length < 6) {
            showToast('error', 'Password must be at least 6 characters.');
            return;
        }

        setLoading(true);
        try {
            await changePassword(currentPassword, newPassword);
            showToast('success', 'Password changed successfully!');
            setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
        } catch (err) {
            showToast('error', err.response?.data?.error || 'Password change failed.');
        } finally {
            setLoading(false);
        }
    };

    const initials = user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';
    const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';

    return (
        <div className="max-w-4xl mx-auto pb-12">
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Account Settings</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your profile details and security preferences.</p>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-sm overflow-hidden flex flex-col md:flex-row">
                
                {/* Sidebar Navigation */}
                <div className="w-full md:w-64 bg-gray-50 dark:bg-gray-800/50 p-6 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 flex-shrink-0">
                    <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setActiveSection('info')}
                            className={`flex justify-start items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                                activeSection === 'info' 
                                ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200 dark:border-gray-700 md:translate-x-1' 
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            <UserCircle className="w-5 h-5 flex-shrink-0" /> Personal Info
                        </button>
                        <button
                            onClick={() => setActiveSection('password')}
                            className={`flex justify-start items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                                activeSection === 'password' 
                                ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200 dark:border-gray-700 md:translate-x-1' 
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            <KeyRound className="w-5 h-5 flex-shrink-0" /> Security
                        </button>
                    </nav>

                    <div className="mt-8 hidden md:block">
                        <Button variant="danger" className="w-full justify-start mt-4" onClick={logout}>
                            <LogOut className="w-4 h-4 mr-2" /> Sign Out
                        </Button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-6 md:p-10">
                    <AnimatePresence mode="wait">
                        {activeSection === 'info' && (
                            <motion.div key="info" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8">
                                <div className="flex items-center gap-6 pb-8 border-b border-gray-100 dark:border-gray-800">
                                    <div className="w-24 h-24 rounded-full flex items-center justify-center text-white font-black text-3xl shadow-lg ring-4 ring-gray-50 dark:ring-gray-900" style={{ backgroundColor: user?.avatarColor || '#3b82f6' }}>
                                        {initials}
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{user?.name}</h3>
                                        <p className="text-gray-500 font-medium">{user?.email}</p>
                                        <span className="inline-block mt-2 px-3 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider rounded-lg">
                                            Member since {memberSince}
                                        </span>
                                    </div>
                                </div>

                                <form onSubmit={handleProfileUpdate} className="space-y-5 max-w-md">
                                    <Input 
                                        label="Full Name" 
                                        type="text" 
                                        value={name} 
                                        onChange={(e) => setName(e.target.value)} 
                                        required 
                                    />
                                    <Input 
                                        label="Email Address" 
                                        type="email" 
                                        value={email} 
                                        onChange={(e) => setEmail(e.target.value)} 
                                        required 
                                    />
                                    <div className="pt-4">
                                        <Button type="submit" isLoading={loading}>Save Changes</Button>
                                    </div>
                                </form>
                            </motion.div>
                        )}

                        {activeSection === 'password' && (
                            <motion.div key="password" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Change Password</h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 mb-6">Update your password associated with this account.</p>
                                </div>
                                <form onSubmit={handlePasswordChange} className="space-y-5 max-w-md">
                                    <Input 
                                        label="Current Password" 
                                        type="password" 
                                        value={currentPassword} 
                                        onChange={(e) => setCurrentPassword(e.target.value)} 
                                        required 
                                        className="font-mono text-lg" placeholder="••••••••"
                                    />
                                    <div className="h-px w-full bg-gray-100 dark:bg-gray-800 my-4" />
                                    <Input 
                                        label="New Password" 
                                        type="password" 
                                        value={newPassword} 
                                        onChange={(e) => setNewPassword(e.target.value)} 
                                        required 
                                        className="font-mono text-lg" placeholder="••••••••"
                                    />
                                    <Input 
                                        label="Confirm New Password" 
                                        type="password" 
                                        value={confirmNewPassword} 
                                        onChange={(e) => setConfirmNewPassword(e.target.value)} 
                                        required 
                                        className="font-mono text-lg" placeholder="••••••••"
                                    />
                                    <div className="pt-4">
                                        <Button type="submit" isLoading={loading}>Update Password</Button>
                                    </div>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Toasts */}
            <AnimatePresence>
                {toast && (
                    <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className={`fixed bottom-8 right-8 px-6 py-4 rounded-xl shadow-2xl z-50 font-bold backdrop-blur-md flex items-center gap-3 border ${toast.type === 'error' ? 'bg-red-50 dark:bg-red-900/90 text-red-600 dark:text-red-100 border-red-200 dark:border-red-800' : 'bg-emerald-50 dark:bg-emerald-900/90 text-emerald-600 dark:text-emerald-100 border-emerald-200 dark:border-emerald-800'}`}>
                        {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
