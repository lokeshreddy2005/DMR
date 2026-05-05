import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import API_URL from '../config/api';
import axios from 'axios';
import { Button } from '../components/ui/Button';
import { Building2, Users, HardDrive } from 'lucide-react';

const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export function AdminDashboard() {
    const { token: authToken } = useAuth();
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // To handle org quota updates, we'd ideally fetch the org, but we can do a simplified version here
    // where admin can just allocate user private quotas. We'll add the UI for the Team and Public quotas in another component or here.
    
    const [editingUser, setEditingUser] = useState(null);
    const [newUserQuotaGB, setNewUserQuotaGB] = useState('');

    const fetchData = useCallback(async () => {
        try {
            const token = authToken || localStorage.getItem('dmr_token');
            const headers = { Authorization: `Bearer ${token}` };

            const usersRes = await axios.get(`${API_URL}/api/admin/users`, { headers });
            setUsers(usersRes.data.users || []);
        } catch (error) {
            console.error("Failed to fetch admin data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [authToken]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleUpdateUserQuota = async (e) => {
        e.preventDefault();
        try {
            const token = authToken || localStorage.getItem('dmr_token');
            const headers = { Authorization: `Bearer ${token}` };
            const limitBytes = parseFloat(newUserQuotaGB) * 1024 * 1024 * 1024;
            
            await axios.patch(`${API_URL}/api/admin/users/${editingUser._id}/quota`, {
                privateStorageLimitBytes: limitBytes
            }, { headers });
            
            setEditingUser(null);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.error || "Failed to update quota. Check if it exceeds total limits.");
        }
    };

    if (isLoading) {
        return <div className="flex-1 flex justify-center items-center h-[50vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Organization Dashboard</h1>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Organization Members & Private Quotas</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800/50">
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Name</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Email</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Role</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Private Limit</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {users.map(u => (
                                <tr key={u._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{u.name}</td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{u.email}</td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300 uppercase text-xs font-bold">{u.role}</td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{formatSize(u.privateStorageLimitBytes)}</td>
                                    <td className="px-6 py-4">
                                        <Button variant="secondary" onClick={() => {
                                            setEditingUser(u);
                                            setNewUserQuotaGB((u.privateStorageLimitBytes || 0) / (1024*1024*1024));
                                        }}>
                                            <HardDrive className="w-4 h-4 mr-2" /> Edit Quota
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-xl w-full max-w-md">
                        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Edit Private Quota for {editingUser.name}</h3>
                        <form onSubmit={handleUpdateUserQuota}>
                            <div className="mb-4">
                                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Private Storage Limit (GB)</label>
                                <input 
                                    type="number" 
                                    min="0" 
                                    step="0.1" 
                                    value={newUserQuotaGB} 
                                    onChange={(e) => setNewUserQuotaGB(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <Button type="button" variant="ghost" onClick={() => setEditingUser(null)}>Cancel</Button>
                                <Button type="submit">Save Changes</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
