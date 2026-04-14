import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { FileText, AlertCircle, DownloadCloud, Loader2, Shield, Tag, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import API_URL from '../config/api';

export function EmbedRetrieve() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const apiKey = searchParams.get('apiKey');

    const [document, setDocument] = useState(null);
    const [downloadUrl, setDownloadUrl] = useState(null);
    const [access, setAccess] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!apiKey) {
            setError('Missing API Key. Please provide ?apiKey=... in the URL.');
            setLoading(false);
            return;
        }

        const fetchDocument = async () => {
            try {
                const response = await fetch(`${API_URL}/api/external/documents/${id}`, {
                    headers: { 'x-api-key': apiKey }
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch document');
                }

                setDocument(data.document);
                setDownloadUrl(data.downloadUrl);
                setAccess(data.access || null);

                // Notify parent frame
                window.parent?.postMessage({
                    type: 'DMR_DOCUMENT_LOADED',
                    document: data.document,
                    access: data.access,
                }, '*');
            } catch (err) {
                setError(err.message);
                window.parent?.postMessage({
                    type: 'DMR_DOCUMENT_ERROR',
                    message: err.message,
                }, '*');
            } finally {
                setLoading(false);
            }
        };

        fetchDocument();
    }, [id, apiKey]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-8">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                <p className="text-gray-500 font-medium">Retrieving document...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-red-100 p-6 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-gray-900 mb-1">Access Error</h3>
                <p className="text-sm text-red-600 font-medium break-words">{error}</p>
            </div>
        );
    }

    if (!document) return null;

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const ROLE_COLORS = {
        owner: 'bg-amber-100 text-amber-800',
        collaborator: 'bg-purple-100 text-purple-800',
        viewer: 'bg-gray-100 text-gray-700',
    };

    const uploaderName = typeof document.uploader === 'object' ? document.uploader.name : document.uploader;

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
        >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 flex flex-col items-center border-b border-gray-100 relative">
                <div className="absolute top-4 right-4 flex items-center gap-1.5">
                    <span className="bg-white/60 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold text-blue-800 uppercase tracking-wider">
                        {document.space}
                    </span>
                </div>
                <div className="w-16 h-16 bg-white shadow-sm rounded-2xl flex items-center justify-center mb-4 text-blue-600">
                    <FileText className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-gray-900 text-center max-w-[250px] truncate" title={document.fileName}>
                    {document.fileName}
                </h2>
                <p className="text-sm font-semibold text-gray-500 mt-1">
                    {formatSize(document.fileSize)} • By {uploaderName}
                </p>

                {/* (#51) Role badge */}
                {access && access.role && (
                    <div className="mt-3 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-gray-400" />
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md capitalize ${ROLE_COLORS[access.role] || 'bg-gray-100 text-gray-600'}`}>
                            {access.role}
                        </span>
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="p-6">
                {/* Description */}
                {document.description && (
                    <div className="mb-5">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Description</h4>
                        <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{document.description}</p>
                    </div>
                )}

                {/* Tags */}
                {document.tags && document.tags.length > 0 && (
                    <div className="mb-5">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            Tags
                            {document.isAITagged && (
                                <span className="bg-purple-100 text-purple-600 text-[9px] font-bold px-1.5 py-0.5 rounded ml-1">AI</span>
                            )}
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                            {document.tags.slice(0, 6).map((tag, idx) => (
                                <span key={idx} className="bg-gray-100 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-md">
                                    {tag}
                                </span>
                            ))}
                            {document.tags.length > 6 && (
                                <span className="text-gray-400 text-xs font-medium px-1 py-1">+{document.tags.length - 6} more</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Download Button */}
                {access?.canDownload !== false ? (
                    <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 transition-all cursor-pointer"
                    >
                        <DownloadCloud className="w-5 h-5" />
                        Secure Download
                    </a>
                ) : (
                    <div className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-500 font-bold py-3 px-4 rounded-xl">
                        <Lock className="w-4 h-4" />
                        Download not available (role: {access?.role})
                    </div>
                )}

                {/* Organization info */}
                {document.organization && (
                    <p className="text-xs text-center text-gray-400 mt-4 font-medium">
                        Stored in {typeof document.organization === 'object' ? document.organization.name : document.organization}
                    </p>
                )}
            </div>
        </motion.div>
    );
}
