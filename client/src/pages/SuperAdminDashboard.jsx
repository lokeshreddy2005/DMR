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

export function SuperAdminDashboard() {
    const { token: authToken } = useAuth();
    const [organizations, setOrganizations] = useState([]);
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Modal state for editing quota
    const [editingOrg, setEditingOrg] = useState(null);
    const [newQuotaGB, setNewQuotaGB] = useState('');

    const fetchData = useCallback(async () => {
        try {
            const token = authToken || localStorage.getItem('dmr_token');
            const headers = { Authorization: `Bearer ${token}` };

            const [orgsRes, usersRes] = await Promise.all([
                axios.get(`${API_URL}/api/superadmin/organizations`, { headers }),
                axios.get(`${API_URL}/api/superadmin/users`, { headers })
            ]);

            setOrganizations(orgsRes.data.organizations || []);
            setUsers(usersRes.data.users || []);
        } catch (error) {
            console.error("Failed to fetch superadmin data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [authToken]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleUpdateQuota = async (e) => {
        e.preventDefault();
        try {
            const token = authToken || localStorage.getItem('dmr_token');
            const headers = { Authorization: `Bearer ${token}` };
            const limitBytes = parseFloat(newQuotaGB) * 1024 * 1024 * 1024;
            
            await axios.patch(`${API_URL}/api/superadmin/organizations/${editingOrg._id}/quota`, {
                totalStorageLimitBytes: limitBytes
            }, { headers });
            
            setEditingOrg(null);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.error || "Failed to update quota");
        }
    };

    if (isLoading) {
        return <div className="flex-1 flex justify-center items-center h-[50vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Global Dashboard</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm border border-gray-200 dark:border-gray-800 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center"><Building2 /></div>
                    <div>
                        <p className="text-2xl font-black">{organizations.length}</p>
                        <p className="text-sm font-semibold text-gray-500">Total Organizations</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm border border-gray-200 dark:border-gray-800 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Users /></div>
                    <div>
                        <p className="text-2xl font-black">{users.length}</p>
                        <p className="text-sm font-semibold text-gray-500">Total Users</p>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Organizations & Quotas</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800/50">
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Organization Name</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Created By</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Total Limit</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {organizations.map(org => (
                                <tr key={org._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{org.name}</td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{org.createdBy?.name || 'Unknown'}</td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{formatSize(org.storageQuota?.totalStorageLimitBytes)}</td>
                                    <td className="px-6 py-4">
                                        <Button variant="secondary" onClick={() => {
                                            setEditingOrg(org);
                                            setNewQuotaGB((org.storageQuota?.totalStorageLimitBytes || 0) / (1024*1024*1024));
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

            {editingOrg && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-xl w-full max-w-md">
                        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Edit Quota for {editingOrg.name}</h3>
                        <form onSubmit={handleUpdateQuota}>
                            <div className="mb-4">
                                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Total Storage Limit (GB)</label>
                                <input 
                                    type="number" 
                                    min="1" 
                                    step="0.1" 
                                    value={newQuotaGB} 
                                    onChange={(e) => setNewQuotaGB(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <Button type="button" variant="ghost" onClick={() => setEditingOrg(null)}>Cancel</Button>
                                <Button type="submit">Save Changes</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
