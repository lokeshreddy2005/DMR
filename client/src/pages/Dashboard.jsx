import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import API_URL from '../config/api';
import axios from 'axios';
import { motion } from 'framer-motion';
import { CircularProgress, getStorageHeaderColor, getWarningMessage } from '../components/ui/CircularProgress';
import { Button } from '../components/ui/Button';
import { FileUp, FileText, Globe, Lock, Building2, Download, Eye, FolderPlus, ArrowRight } from 'lucide-react';
import UploadModal from '../components/UploadModal';

const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export function Dashboard() {
    const { user, token: authToken } = useAuth();
    const [stats, setStats] = useState({});
    const [storage, setStorage] = useState(null);
    const [recentDocs, setRecentDocs] = useState([]);
    const [storageOrgId, setStorageOrgId] = useState('');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const fetchDashboardData = useCallback(async () => {
        try {
            const token = authToken || localStorage.getItem('dmr_token');
            const headers = { Authorization: `Bearer ${token}` };

            const [statsRes, storageRes, recentRes] = await Promise.all([
                axios.get(`${API_URL}/api/documents/stats`, { headers }),
                axios.get(`${API_URL}/api/documents/storage`, { headers }),
                axios.get(`${API_URL}/api/documents/recent`, { headers }).catch(() => ({ data: { documents: [] } }))
            ]);

            setStats(statsRes.data.stats || {});
            setStorage(storageRes.data.storage || null);
            setRecentDocs(recentRes.data.documents || []);

            if (storageRes.data.storage?.organizations?.length > 0 && !storageOrgId) {
                setStorageOrgId(storageRes.data.storage.organizations[0].orgId);
            }
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [storageOrgId]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    if (isLoading) {
        return (
            <div className="flex-1 flex justify-center items-center h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            {/* Welcome Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        Welcome back, {user?.name?.split(' ')[0]} 👋
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Here is what is happening with your documents today.</p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <Button onClick={() => setIsUploadModalOpen(true)} className="flex-shrink-0 shadow-lg shadow-blue-500/20">
                        <FileUp className="w-4 h-4 mr-2" /> Upload Document
                    </Button>
                </div>
            </div>

            {/* Quick Stats overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                {[
                    { label: "Total Files", count: stats.total || 0, icon: FileText, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10" },
                    { label: "Public Files", count: stats.public?.count || 0, icon: Globe, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
                    { label: "Private Files", count: stats.private?.count || 0, icon: Lock, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-500/10" },
                    { label: "Team Files", count: stats.organization?.count || 0, icon: Building2, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-500/10" }
                ].map((stat, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg}`}>
                            <stat.icon className={`w-6 h-6 ${stat.color}`} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">{stat.count}</p>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1">{stat.label}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Storage Summary */}
            {storage && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up">
                    {/* Public Storage */}
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col">
                        <div className={`absolute top-0 left-0 w-full h-1.5 ${getStorageHeaderColor(storage.public.percentage)} transition-colors duration-500`}></div>
                        <div className="flex justify-between items-center mb-6">
                            <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 text-lg"><Globe className="w-5 h-5 text-emerald-500" /> Public Space</span>
                        </div>
                        <div className="flex flex-col items-center justify-center flex-grow mb-4">
                            <CircularProgress percentage={storage.public.percentage} />
                        </div>
                        <div className="space-y-2 mt-auto">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 dark:text-gray-400 font-medium tracking-wide">Storage</span>
                                <span className="font-bold text-gray-900 dark:text-white">{formatSize(storage.public.used)} / {formatSize(storage.public.limit)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 dark:text-gray-400 font-medium tracking-wide">Remaining</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatSize(storage.public.limit - storage.public.used)}</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Private Storage */}
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col">
                        <div className={`absolute top-0 left-0 w-full h-1.5 ${getStorageHeaderColor(storage.private.percentage)} transition-colors duration-500`}></div>
                        <div className="flex justify-between items-center mb-6">
                            <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 text-lg"><Lock className="w-5 h-5 text-blue-500" /> Private Space</span>
                        </div>
                        <div className="flex flex-col items-center justify-center flex-grow mb-4">
                            <CircularProgress percentage={storage.private.percentage} colorClass="text-blue-500" />
                        </div>
                        <div className="space-y-2 mt-auto">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 dark:text-gray-400 font-medium tracking-wide">Storage</span>
                                <span className="font-bold text-gray-900 dark:text-white">{formatSize(storage.private.used)} / {formatSize(storage.private.limit)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 dark:text-gray-400 font-medium tracking-wide">Remaining</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatSize(storage.private.limit - storage.private.used)}</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Organization Storage */}
                    {/* Organization Storage */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col"
                    >
                        {storage.organizations?.length > 0 ? (() => {
                            const activeOrgStats =
                                storage.organizations.find(o => o.orgId === storageOrgId) ||
                                storage.organizations[0];

                            return (
                                <>
                                    {/* Top Accent */}
                                    <div
                                        className={`absolute top-0 left-0 w-full h-1.5 ${getStorageHeaderColor(
                                            activeOrgStats.percentage
                                        )} transition-colors duration-500`}
                                    ></div>

                                    {/* Header */}
                                    <div className="flex flex-col gap-3 mb-6">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="w-5 h-5 text-purple-500" />
                                            <span className="font-semibold text-gray-800 dark:text-gray-200">
                                                Team Storage
                                            </span>
                                        </div>

                                        {/* Improved Dropdown */}
                                        <div className="flex flex-col gap-1">
                                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                                Choose Organization
                                            </label>

                                            <div className="relative">
                                                <select
                                                    value={storageOrgId}
                                                    onChange={(e) => setStorageOrgId(e.target.value)}
                                                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-xl px-3 py-2 pr-8 outline-none focus:ring-2 focus:ring-purple-500 transition-all appearance-none"
                                                >
                                                    {storage.organizations.map((o) => (
                                                        <option key={o.orgId} value={o.orgId}>
                                                            {o.orgName}
                                                        </option>
                                                    ))}
                                                </select>

                                                {/* Custom Dropdown Icon */}
                                                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400">
                                                    ▼
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Progress */}
                                    <div className="flex flex-col items-center justify-center flex-grow mb-4">
                                        <CircularProgress
                                            percentage={activeOrgStats.percentage}
                                            colorClass="text-purple-500"
                                        />
                                    </div>

                                    {/* Stats */}
                                    <div className="space-y-2 mt-auto">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500 dark:text-gray-400 font-medium tracking-wide">
                                                Storage
                                            </span>
                                            <span className="font-bold text-gray-900 dark:text-white">
                                                {formatSize(activeOrgStats.used)} /{" "}
                                                {formatSize(activeOrgStats.limit)}
                                            </span>
                                        </div>

                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500 dark:text-gray-400 font-medium tracking-wide">
                                                Remaining
                                            </span>
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                {formatSize(activeOrgStats.limit - activeOrgStats.used)}
                                            </span>
                                        </div>
                                    </div>
                                </>
                            );
                        })() : (
                            <>
                                <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-300 dark:bg-gray-700"></div>

                                <div className="flex items-center gap-2 mb-6">
                                    <Building2 className="w-5 h-5" />
                                    <span className="font-bold text-gray-800 dark:text-gray-200">
                                        Team Space
                                    </span>
                                </div>

                                <div className="flex flex-col items-center justify-center flex-grow mb-4 opacity-50">
                                    <CircularProgress percentage={0} colorClass="text-gray-400" />
                                </div>

                                <div className="text-center mt-auto pb-4 text-sm text-gray-500">
                                    Join an organization to use team storage.
                                </div>
                            </>
                        )}
                    </motion.div>
                </div>
            )}

            {/* Recent Uploads & Activity Grid */}
            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Recent Uploads</h3>
                        <Link to="/workspace/public" className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1">
                            Browse all <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                    {recentDocs.length > 0 ? (
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
                            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                                {recentDocs.slice(0, 5).map(doc => (
                                    <li key={doc._id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-center justify-between group">
                                        <div className="flex items-center gap-4 overflow-hidden">
                                            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{doc.fileName}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{formatSize(doc.fileSize)} • {new Date(doc.uploadDate).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 border-dashed rounded-3xl p-12 text-center flex flex-col items-center">
                            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-500 mb-4">
                                <FileUp className="w-8 h-8" />
                            </div>
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No documents yet</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">Upload your first document to get started with DMR's powerful management system.</p>
                            <Button onClick={() => setIsUploadModalOpen(true)}>Upload Document</Button>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Quick Actions</h3>
                    <div className="grid grid-cols-1 gap-3">
                        <Button variant="secondary" className="w-full justify-start py-6 rounded-2xl" onClick={() => setIsUploadModalOpen(true)}>
                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center mr-4"><FileUp className="w-5 h-5" /></div>
                            <div className="text-left"><p className="font-bold text-gray-900 dark:text-white">Upload New</p><p className="text-xs font-normal text-gray-500 dark:text-gray-400">Share a document</p></div>
                        </Button>
                        <Link to="/workspace/organization">
                            <Button variant="secondary" className="w-full justify-start py-6 rounded-2xl h-auto">
                                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 flex items-center justify-center mr-4"><FolderPlus className="w-5 h-5" /></div>
                                <div className="text-left"><p className="font-bold text-gray-900 dark:text-white">Team Spaces</p><p className="text-xs font-normal text-gray-500 dark:text-gray-400">Manage Org Files</p></div>
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            <UploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onUploadSuccess={fetchDashboardData}
            />
        </div>
    );
}
