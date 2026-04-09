import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UploadCloud, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import API_URL from '../config/api';

export function EmbedUpload() {
    const [searchParams] = useSearchParams();
    const apiKey = searchParams.get('apiKey');
    const space = searchParams.get('space') || 'public';
    const organizationId = searchParams.get('organizationId');

    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, uploading, success, error
    const [errorMessage, setErrorMessage] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef(null);

    // Communicate with parent frame
    useEffect(() => {
        if (status === 'success') {
            window.parent?.postMessage({ type: 'DMR_UPLOAD_SUCCESS', document: file?.name }, '*');
        } else if (status === 'error') {
            window.parent?.postMessage({ type: 'DMR_UPLOAD_ERROR', message: errorMessage }, '*');
        }
    }, [status, file, errorMessage]);

    if (!apiKey) {
        return (
            <div className="w-full h-full min-h-[200px] flex items-center justify-center p-6 bg-red-50 rounded-2xl border border-red-200">
                <div className="text-center">
                    <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <p className="text-red-700 font-semibold">Missing API Key</p>
                    <p className="text-red-500 text-sm mt-1">Please provide an apiKey in the URL parameters.</p>
                </div>
            </div>
        );
    }

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setStatus('idle');
            setErrorMessage('');
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setStatus('uploading');
        setUploadProgress(0);

        const formData = new FormData();
        formData.append('document', file);
        formData.append('space', space);
        if (organizationId) {
            formData.append('organizationId', organizationId);
        }

        try {
            // Simulated progress since native fetch doesn't support progress easily without XHR
            const progressInterval = setInterval(() => {
                setUploadProgress(p => p < 90 ? p + 5 : p);
            }, 200);

            const response = await fetch(`${API_URL}/api/external/upload`, {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey
                },
                body: formData
            });

            clearInterval(progressInterval);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.details || 'Upload failed');
            }

            setUploadProgress(100);
            setStatus('success');
        } catch (err) {
            setErrorMessage(err.message);
            setStatus('error');
        }
    };

    return (
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-extrabold text-gray-900">Upload Document</h2>
                <p className="text-sm font-medium text-gray-500 mt-1">
                    Space: <span className="text-blue-600 capitalize">{space}</span>
                </p>
            </div>

            <div 
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                    file ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
            >
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    disabled={status === 'uploading' || status === 'success'}
                />

                <AnimatePresence mode="wait">
                    {status === 'success' ? (
                        <motion.div key="success" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                            <p className="text-green-700 font-bold text-lg">Upload Complete!</p>
                            <p className="text-green-600 text-sm mt-1">{file.name}</p>
                        </motion.div>
                    ) : status === 'error' ? (
                        <motion.div key="error" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                            <p className="text-red-700 font-bold">Upload Failed</p>
                            <p className="text-red-500 text-sm mt-1 break-words">{errorMessage}</p>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setStatus('idle'); }}
                                className="mt-4 text-blue-600 text-sm font-semibold hover:underline relative z-10"
                            >
                                Try Again
                            </button>
                        </motion.div>
                    ) : status === 'uploading' ? (
                        <motion.div key="uploading" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-3" />
                            <p className="text-blue-700 font-bold">Uploading...</p>
                            <div className="w-full bg-blue-100 rounded-full h-2 mt-4">
                                <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="idle" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <UploadCloud className="w-8 h-8 text-blue-600" />
                            </div>
                            {file ? (
                                <div>
                                    <p className="text-gray-900 font-bold text-lg truncate px-2">{file.name}</p>
                                    <p className="text-gray-500 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                            ) : (
                                <p className="text-gray-600 font-semibold">Drop a file here or click to browse</p>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {status === 'idle' && file && (
                <motion.button 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    onClick={handleUpload}
                    className="w-full mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 transition-all"
                >
                    Confirm Upload
                </motion.button>
            )}
        </div>
    );
}
