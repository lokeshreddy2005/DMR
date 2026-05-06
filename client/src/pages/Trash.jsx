import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import API_URL from '../config/api';
import { Button } from '../components/ui/Button';
import { FileText, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';

export function Trash() {
    const { token } = useAuth();
    const [documents, setDocuments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const getAuthHeaders = () => {
        const t = token || localStorage.getItem('dmr_token');
        return t ? { Authorization: `Bearer ${t}` } : {};
    };

    const fetchTrash = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const headers = getAuthHeaders();
            // Fetch trashed documents across all accessible spaces
            const res = await api.get(`${API_URL}/api/documents?trashed=true`, { headers });
            setDocuments(res.data.documents || []);
        } catch (err) {
            console.error('Fetch trash error:', err);
            setError(err.response?.data?.error || 'Failed to load trash.');
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchTrash();
    }, [fetchTrash]);

    const handleRecover = async (docId) => {
        try {
            const headers = getAuthHeaders();
            const res = await api.put(`${API_URL}/api/documents/${docId}/recover`, {}, { headers });
            alert(res.data.message || 'Document recovered successfully.');
            fetchTrash();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to recover document.');
        }
    };

    const handlePermanentDelete = async (docId) => {
        if (!confirm('Are you sure you want to permanently delete this document? This cannot be undone.')) return;
        try {
            const headers = getAuthHeaders();
            // Passing force=true will permanently delete it
            await api.delete(`${API_URL}/api/documents/${docId}?force=true`, { headers });
            fetchTrash();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to permanently delete document.');
        }
    };

    const formatSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-950 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                        <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trash</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                            <AlertTriangle className="w-3.5 h-3.5" /> Items in trash will be permanently deleted after 30 days.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {isLoading ? (
                    <div className="flex justify-center items-center h-48">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-200 dark:bg-red-900/20 dark:border-red-800">
                        {error}
                    </div>
                ) : documents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                            <Trash2 className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Trash is empty</h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-sm">No items have been moved to the trash recently.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {documents.map(doc => (
                            <div key={doc._id} className="group relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-red-300 dark:hover:border-red-700 hover:shadow-md dark:hover:shadow-red-900/20 rounded-2xl p-4 transition-all flex flex-col h-[220px]">
                                <div className="flex items-start gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 flex-shrink-0">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-gray-900 dark:text-white truncate" title={doc.fileName}>{doc.fileName}</h3>
                                        <p className="text-xs text-gray-500 truncate mt-0.5">{formatSize(doc.fileSize)} • {doc.mimeType}</p>
                                    </div>
                                </div>
                                <div className="flex-1 flex flex-col justify-end text-xs text-gray-500 dark:text-gray-400">
                                    <p className="truncate mb-1">
                                        <span className="font-semibold">From:</span> {doc.space === 'organization' ? (doc.organization?.name ? `${doc.organization.name} Organization` : 'Organization Space') : `${doc.space.charAt(0).toUpperCase() + doc.space.slice(1)} Space`}
                                    </p>
                                    <p className="truncate">Trashed: {new Date(doc.trashedAt).toLocaleDateString()}</p>
                                    <p className="truncate mt-1 text-red-500 dark:text-red-400 font-medium">Auto-delete: {new Date(new Date(doc.trashedAt).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
                                </div>
                                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                                    <Button variant="outline" className="flex-1 text-xs" onClick={() => handleRecover(doc._id)}>
                                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Recover
                                    </Button>
                                    <Button variant="danger" className="flex-1 text-xs" onClick={() => handlePermanentDelete(doc._id)}>
                                        <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
