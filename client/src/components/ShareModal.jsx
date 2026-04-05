import { useState, useEffect, useCallback } from 'react';
import { X, Users, UserPlus, Trash2, Shield, ChevronDown, Copy, Check, Loader2, Clock, Settings, Link2, Globe, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import API_URL from '../config/api';

const ROLE_OPTIONS = [
    { value: 'viewer',     label: 'Viewer',           desc: 'Can only view the document',              icon: '👁️' },
    { value: 'downloader', label: 'Viewer & Download', desc: 'Can view and download the document',      icon: '⬇️' },
    { value: 'manager',    label: 'Full Access',       desc: 'Can edit, share, download, and manage',   icon: '🛡️' },
];

const EXPIRY_OPTIONS = [
    { value: '0',    label: 'No limit' },
    { value: '24',   label: '1 day' },
    { value: '168',  label: '7 days' },
    { value: 'custom', label: 'Custom' },
];

const ROLE_COLORS = {
    owner:      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    manager:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    editor:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    sharer:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
    downloader: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200 dark:border-teal-800',
    viewer:     'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700',
};

export default function ShareModal({ isOpen, onClose, document, onUpdate }) {
    const { user, token } = useAuth();
    const [email, setEmail] = useState('');
    const [selectedRole, setSelectedRole] = useState('viewer');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [permissions, setPermissions] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showRoleDropdown, setShowRoleDropdown] = useState(false);
    const [editingUserId, setEditingUserId] = useState(null);
    const [expiresIn, setExpiresIn] = useState('0');
    const [customDays, setCustomDays] = useState('');
    const [maxShares, setMaxShares] = useState(1);
    const [showSettings, setShowSettings] = useState(false);
    const [linkSharing, setLinkSharing] = useState({ enabled: false, mode: 'restricted', role: 'viewer', token: null });
    const [linkCopied, setLinkCopied] = useState(false);

    const getAuthHeaders = () => {
        const t = token || localStorage.getItem('dmr_token');
        return t ? { Authorization: `Bearer ${t}` } : {};
    };

    const fetchPermissions = useCallback(async () => {
        if (!document?._id) return;
        setIsLoading(true);
        try {
            const headers = getAuthHeaders();
            const res = await axios.get(`${API_URL}/api/documents/${document._id}/permissions`, { headers });
            setPermissions(res.data.permissions || []);
        } catch (err) {
            // If user can't manage access, just show permissions from the document
            setPermissions(document.permissions || []);
        } finally {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [document?._id]);

    useEffect(() => {
        if (isOpen && document) {
            fetchPermissions();
            setEmail('');
            setError('');
            setSuccess('');
            setSelectedRole('viewer');
            setExpiresIn('0');
            setMaxShares(document?.sharingPolicy?.maxShares ?? 1);
            setLinkSharing(document?.linkSharing || { enabled: false, mode: 'restricted', role: 'viewer', token: null });
            setLinkCopied(false);
        }
    }, [isOpen, document, fetchPermissions]);

    const handleShare = async (e) => {
        e.preventDefault();
        if (!email.trim()) return;
        setIsSubmitting(true);
        setError('');
        setSuccess('');

        try {
            const headers = getAuthHeaders();
            // Compute actual expiresIn hours
            let actualExpiresIn = undefined;
            if (expiresIn === 'custom' && customDays) {
                actualExpiresIn = String(Number(customDays) * 24);
            } else if (expiresIn !== '0') {
                actualExpiresIn = expiresIn;
            }
            const res = await axios.post(
                `${API_URL}/api/documents/${document._id}/permissions`,
                { email: email.trim(), role: selectedRole, expiresIn: actualExpiresIn },
                { headers }
            );
            setSuccess(res.data.message);
            setEmail('');
            fetchPermissions();
            if (onUpdate) onUpdate(res.data.document);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to share document.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRevoke = async (userId) => {
        if (!confirm('Revoke this user\'s access?')) return;
        try {
            const headers = getAuthHeaders();
            const res = await axios.delete(
                `${API_URL}/api/documents/${document._id}/permissions/${userId}`,
                { headers }
            );
            setSuccess(res.data.message);
            fetchPermissions();
            if (onUpdate) onUpdate(res.data.document);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to revoke access.');
        }
    };

    const handleUpdateRole = async (userId, newRole) => {
        // Find the user's email from permissions
        const perm = permissions.find(p => {
            const pu = p.user?._id || p.user?.id || p.user;
            return pu?.toString() === userId.toString();
        });
        const userEmail = perm?.user?.email;
        if (!userEmail) return;

        try {
            const headers = getAuthHeaders();
            const res = await axios.post(
                `${API_URL}/api/documents/${document._id}/permissions`,
                { email: userEmail, role: newRole },
                { headers }
            );
            setSuccess(`Updated role to ${newRole}`);
            setEditingUserId(null);
            fetchPermissions();
            if (onUpdate) onUpdate(res.data.document);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update role.');
        }
    };

    const handleUpdateMaxShares = (value) => {
        const newMax = Math.max(0, parseInt(value) || 0);
        setMaxShares(newMax);
    };

    const formatExpiry = (expiresAt) => {
        if (!expiresAt) return null;
        const exp = new Date(expiresAt);
        const now = new Date();
        if (exp <= now) return 'Expired';
        const diffMs = exp - now;
        const hours = Math.floor(diffMs / (60 * 60 * 1000));
        if (hours < 1) return `${Math.ceil(diffMs / (60 * 1000))}m left`;
        if (hours < 24) return `${hours}h left`;
        return `${Math.floor(hours / 24)}d left`;
    };

    const currentUserId = user?._id || user?.id;
    const isOwnerOrUploader = (perm) => {
        const pu = perm.user?._id || perm.user?.id || perm.user;
        return pu?.toString() === currentUserId?.toString() || perm.role === 'owner';
    };

    const handleLinkSharingUpdate = (updates) => {
        setLinkSharing({ ...linkSharing, ...updates });
    };

    const handleSaveSettings = async () => {
        setIsSavingSettings(true);
        setError('');
        setSuccess('');
        try {
            const headers = getAuthHeaders();
            const [policyRes, linkRes] = await Promise.all([
                axios.put(
                    `${API_URL}/api/documents/${document._id}/sharing-policy`,
                    { maxShares },
                    { headers }
                ),
                axios.put(
                    `${API_URL}/api/documents/${document._id}/link-sharing`,
                    linkSharing,
                    { headers }
                )
            ]);
            setSuccess('Share settings saved successfully.');
            if (onUpdate) onUpdate({ ...document, sharingPolicy: { maxShares }, linkSharing: linkRes.data.linkSharing });
            setShowSettings(false);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save settings.');
        } finally {
            setIsSavingSettings(false);
        }
    };

    const getShareUrl = () => {
        if (!linkSharing?.token) return '';
        const origin = window.location.origin;
        return `${origin}/shared/${linkSharing.token}`;
    };

    const copyLink = () => {
        const url = getShareUrl();
        if (!url) return;
        navigator.clipboard.writeText(url);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
    };

    const LINK_MODE_OPTIONS = [
        { value: 'restricted', label: 'Restricted', desc: 'Only people added above', icon: <X className="w-3.5 h-3.5" /> },
        ...(document?.space === 'organization' ? [{ value: 'organization', label: 'Anyone in organization', desc: 'All org members with the link', icon: <Building2 className="w-3.5 h-3.5" /> }] : []),
    ];

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                                <Users className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Share Document</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[280px]">{document?.fileName}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>



                    {/* Share Form */}
                    <form onSubmit={handleShare} className="p-5 border-b border-gray-100 dark:border-gray-800 relative overflow-visible">
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter email address..."
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400"
                                />
                            </div>

                            {/* Role selector */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                                    className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
                                >
                                    {ROLE_OPTIONS.find(r => r.value === selectedRole)?.label || 'Viewer'}
                                    <ChevronDown className="w-3.5 h-3.5" />
                                </button>

                                {showRoleDropdown && (
                                    <>
                                        {/* Click-away overlay */}
                                        <div className="fixed inset-0 z-20" onClick={() => setShowRoleDropdown(false)} />
                                        <motion.div
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-30 py-1"
                                        >
                                            {ROLE_OPTIONS.map((role) => (
                                                <button
                                                    key={role.value}
                                                    type="button"
                                                    onClick={() => { setSelectedRole(role.value); setShowRoleDropdown(false); }}
                                                    className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${selectedRole === role.value ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm">{role.icon}</span>
                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{role.label}</p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">{role.desc}</p>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </motion.div>
                                    </>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || !email.trim()}
                                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                Share
                            </button>
                        </div>

                        {/* Settings toggle */}
                        <div className="flex justify-end mt-2">
                            <button
                                type="button"
                                onClick={() => setShowSettings(!showSettings)}
                                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${showSettings ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                            >
                                <Settings className="w-3.5 h-3.5" />
                                Share Settings
                            </button>
                        </div>

                        {/* Share Settings Panel */}
                        <AnimatePresence>
                            {showSettings && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                                        {/* Time Limit */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-3.5 h-3.5 text-gray-400" />
                                                <div>
                                                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Time Limit</p>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Access expires after this period</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={expiresIn}
                                                    onChange={(e) => setExpiresIn(e.target.value)}
                                                    className="text-xs px-2 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    {EXPIRY_OPTIONS.map(o => (
                                                        <option key={o.value} value={o.value}>{o.label}</option>
                                                    ))}
                                                </select>
                                                {expiresIn === 'custom' && (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            pattern="[0-9]*"
                                                            value={customDays}
                                                            onChange={(e) => setCustomDays(e.target.value.replace(/\D/g, ''))}
                                                            placeholder="0"
                                                            className="w-12 text-center text-xs font-bold px-1.5 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                        <span className="text-[10px] text-gray-500">days</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="border-t border-gray-200 dark:border-gray-700" />

                                        {/* Max Users */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Users className="w-3.5 h-3.5 text-gray-400" />
                                                <div>
                                                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Max Users</p>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Limit how many users can access</p>
                                                </div>
                                            </div>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={maxShares}
                                                onChange={(e) => handleUpdateMaxShares(e.target.value.replace(/\D/g, '') || '0')}
                                                className="w-14 text-center text-xs font-bold px-2 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        {/* Organization Access */}
                                        <>
                                            <div className="border-t border-gray-200 dark:border-gray-700" />
                                            <div className="flex items-center justify-between mt-3">
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                                                    <div>
                                                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Organization Access</p>
                                                        <p className="text-[10px] text-gray-500 dark:text-gray-400">Organization members have access</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {linkSharing.enabled && linkSharing.mode === 'organization' && (
                                                        <select
                                                            value={linkSharing.role}
                                                            onChange={(e) => handleLinkSharingUpdate({ role: e.target.value })}
                                                            className="text-xs font-semibold px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-300"
                                                        >
                                                            <option value="viewer">Viewer</option>
                                                            <option value="downloader">Viewer & Download</option>
                                                            <option value="manager">Full Access</option>
                                                        </select>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleLinkSharingUpdate({ 
                                                            enabled: !(linkSharing.enabled && linkSharing.mode === 'organization'), 
                                                            mode: (linkSharing.enabled && linkSharing.mode === 'organization') ? 'restricted' : 'organization',
                                                            role: linkSharing.role || 'viewer'
                                                        })}
                                                        className={`relative w-8 h-4 rounded-full transition-colors ${linkSharing.enabled && linkSharing.mode === 'organization' ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                                    >
                                                        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${linkSharing.enabled && linkSharing.mode === 'organization' ? 'left-[18px]' : 'left-0.5'}`} />
                                                    </button>
                                                </div>
                                            </div>
                                        </>

                                        {/* Save Settings Button */}
                                        <div className="flex justify-end pt-2">
                                            <button
                                                type="button"
                                                onClick={handleSaveSettings}
                                                disabled={isSavingSettings}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                                            >
                                                {isSavingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                Save Settings
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Messages */}
                        <AnimatePresence>
                            {error && (
                                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-sm text-red-500 font-medium bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                                    {error}
                                </motion.p>
                            )}
                            {success && (
                                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-sm text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-lg">
                                    {success}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </form>

                    {/* Existing Permissions List */}
                    <div className="p-5 max-h-[300px] overflow-y-auto">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">People with access</p>
                            <span className="text-[10px] font-bold text-gray-400">
                                {permissions.filter(p => p.role !== 'owner' && p.level !== 'owner').length}
                                {maxShares > 0 ? ` / ${maxShares}` : ''} shared
                            </span>
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-6">
                                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                            </div>
                        ) : permissions.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No one has access yet.</p>
                        ) : (
                            <div className="space-y-1">
                                {permissions.map((perm, idx) => {
                                    const permUser = perm.user;
                                    const userId = permUser?._id || permUser?.id || permUser;
                                    const isCurrentUser = userId?.toString() === currentUserId?.toString();
                                    const role = perm.role || perm.level || 'viewer';
                                    const isOwner = role === 'owner';

                                    return (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div
                                                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                                                    style={{ backgroundColor: permUser?.avatarColor || '#6366f1' }}
                                                >
                                                    {permUser?.name?.[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                        {permUser?.name || 'Unknown'}
                                                        {isCurrentUser && <span className="text-xs text-gray-400 ml-1">(you)</span>}
                                                    </p>
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{permUser?.email || ''}</p>
                                                        {(() => {
                                                            const expiry = formatExpiry(perm.expiresAt);
                                                            if (!expiry) return null;
                                                            const isExpired = expiry === 'Expired';
                                                            return (
                                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isExpired ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                                                                    ⏱ {expiry}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {isOwner ? (
                                                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${ROLE_COLORS.owner}`}>
                                                        Owner
                                                    </span>
                                                ) : editingUserId === userId?.toString() ? (
                                                    <select
                                                        value={role}
                                                        onChange={(e) => handleUpdateRole(userId, e.target.value)}
                                                        onBlur={() => setEditingUserId(null)}
                                                        autoFocus
                                                        className="text-xs font-semibold px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        {ROLE_OPTIONS.map(r => (
                                                            <option key={r.value} value={r.value}>{r.label}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <button
                                                        onClick={() => setEditingUserId(userId?.toString())}
                                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer hover:opacity-80 transition-opacity ${ROLE_COLORS[role] || ROLE_COLORS.viewer}`}
                                                        title="Click to change role"
                                                    >
                                                        {role.charAt(0).toUpperCase() + role.slice(1)}
                                                    </button>
                                                )}

                                                {!isOwner && !isCurrentUser && (
                                                    <button
                                                        onClick={() => handleRevoke(userId)}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Revoke access"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
