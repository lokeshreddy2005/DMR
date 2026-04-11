import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, UserPlus, Trash2, User, ShieldAlert, MoreVertical } from 'lucide-react';
import { Button } from './ui/Button';
import API_URL from '../config/api';
import { useAuth } from '../context/AuthContext';

export default function ManageOrgModal({ isOpen, onClose, orgId, onUpdate, onDelete }) {
    const { user } = useAuth();
    const [org, setOrg] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Form states
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [newMemberRole, setNewMemberRole] = useState('collaborator');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen || !orgId) return;
        let isMounted = true;
        
        const fetchOrg = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem('dmr_token');
                const headers = { Authorization: `Bearer ${token}` };
                const res = await axios.get(`${API_URL}/api/orgs/${orgId}`, { headers });
                if (isMounted) setOrg(res.data.organization);
            } catch (err) {
                if (isMounted) setError(err.response?.data?.error || 'Failed to fetch organization details.');
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchOrg();

        return () => { isMounted = false; };
    }, [isOpen, orgId]);

    if (!isOpen) return null;

    const currentUserId = user?.id || user?._id;
    const isCreator = (org?.createdBy?._id || org?.createdBy)?.toString() === currentUserId?.toString();
    const isRoleAdmin = org?.members?.some(m => (m.user?._id || m.user)?.toString() === currentUserId?.toString() && m.role === 'admin');
    const isAdmin = isCreator || isRoleAdmin;

    const handleAddMember = async (e) => {
        e.preventDefault();
        if (!newMemberEmail) return;
        setIsSubmitting(true);
        setError(null);

        try {
            const token = localStorage.getItem('dmr_token');
            const headers = { Authorization: `Bearer ${token}` };
            const res = await axios.post(`${API_URL}/api/orgs/${orgId}/members`, { email: newMemberEmail, role: newMemberRole }, { headers });
            
            setOrg(res.data.organization);
            setNewMemberEmail('');
            setNewMemberRole('collaborator');
            if (onUpdate) onUpdate();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to add member.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateRole = async (userId, role) => {
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('dmr_token');
            const headers = { Authorization: `Bearer ${token}` };
            const res = await axios.put(`${API_URL}/api/orgs/${orgId}/members/${userId}`, { role }, { headers });
            setOrg(res.data.organization);
            if (onUpdate) onUpdate();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update role.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!confirm('Are you sure you want to remove this member?')) return;
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('dmr_token');
            const headers = { Authorization: `Bearer ${token}` };
            const res = await axios.delete(`${API_URL}/api/orgs/${orgId}/members/${userId}`, { headers });
            setOrg(res.data.organization);
            if (onUpdate) onUpdate();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to remove member.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteOrg = async () => {
        if (!confirm('WARNING: This will delete the organization and ALL its documents! Are you absolutely sure?')) return;
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('dmr_token');
            const headers = { Authorization: `Bearer ${token}` };
            await axios.delete(`${API_URL}/api/orgs/${orgId}`, { headers });
            if (onDelete) onDelete();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete organization.');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm cursor-pointer"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-800/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                            <Settings className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{isAdmin ? 'Manage Organization' : 'View Organization Team'}</h3>
                            {org && <p className="text-sm text-gray-500">{org.name}</p>}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-xl hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex justify-center py-10">
                            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : error ? (
                        <div className="p-4 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl font-medium text-center">
                            {error}
                        </div>
                    ) : org ? (
                        <div className="space-y-8">
                            {/* Org Info */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Description</h4>
                                <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                                    {org.description || 'No description provided.'}
                                </p>
                            </div>

                            {/* Members Section */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <User className="w-4 h-4" /> Team Members ({org.members?.length || 0})
                                </h4>

                                {/* Add Member Form (Admins only) */}
                                {isAdmin && (
                                    <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row gap-3 mb-6 p-4 bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-xl">
                                        <input
                                            type="email"
                                            placeholder="User Email Address"
                                            required
                                            value={newMemberEmail}
                                            onChange={(e) => setNewMemberEmail(e.target.value)}
                                            className="flex-1 text-sm p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white"
                                        />
                                        <select
                                            value={newMemberRole}
                                            onChange={(e) => setNewMemberRole(e.target.value)}
                                            className="sm:w-32 text-sm p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white"
                                        >
                                            <option value="viewer">Viewer</option>
                                            <option value="collaborator">Collaborator</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                        <Button
                                            type="submit"
                                            disabled={isSubmitting || !newMemberEmail}
                                            className="bg-purple-600 hover:bg-purple-700 text-white shadow-md sm:w-auto w-full justify-center"
                                        >
                                            <UserPlus className="w-4 h-4 mr-2" /> Add
                                        </Button>
                                    </form>
                                )}

                                {/* Member List */}
                                <div className="space-y-2">
                                    {org.members?.map((member) => (
                                        <div key={member.user._id || member.user} className="flex items-center justify-between p-3.5 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div 
                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm"
                                                    style={{ backgroundColor: member.user.avatarColor || '#3b82f6' }}
                                                >
                                                    {member.user.name?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                                        {member.user.name} {member.user._id === user?.id && '(You)'}
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.user.email}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {isAdmin && member.user._id !== user?.id && member.user._id !== org.createdBy?._id ? (
                                                    <select
                                                        value={member.role}
                                                        onChange={(e) => handleUpdateRole(member.user._id, e.target.value)}
                                                        disabled={isSubmitting}
                                                        className="text-xs font-semibold p-1.5 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:ring-1 focus:ring-purple-500 text-gray-700 dark:text-gray-300 cursor-pointer disabled:opacity-50"
                                                    >
                                                        <option value="viewer">Viewer</option>
                                                        <option value="collaborator">Collaborator</option>
                                                        <option value="admin">Admin</option>
                                                    </select>
                                                ) : (
                                                    <span className="text-xs font-bold px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-md uppercase tracking-wider">
                                                        {member.role}
                                                    </span>
                                                )}

                                                {isAdmin && member.user._id !== user?.id && member.user._id !== org.createdBy?._id && (
                                                    <button
                                                        onClick={() => handleRemoveMember(member.user._id)}
                                                        disabled={isSubmitting}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors disabled:opacity-50"
                                                        title="Remove user"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Footer Actions */}
                {isAdmin && org && (
                    <div className="flex-shrink-0 p-6 border-t border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-800/20 flex justify-between items-center rounded-b-3xl">
                        <Button
                            variant="danger"
                            onClick={handleDeleteOrg}
                            disabled={isSubmitting}
                            className="bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800/50 shadow-sm"
                        >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete Organization
                        </Button>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
