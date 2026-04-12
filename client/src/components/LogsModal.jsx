import { X, Clock3, Loader2, History, UserRound, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ACTION_META = {
    granted: {
        label: 'Shared',
        classes: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
    },
    updated: {
        label: 'Updated',
        classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
    },
    revoked: {
        label: 'Revoked',
        classes: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800',
    },
    moved: {
        label: 'Moved',
        classes: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800',
    },
};

const ROLE_LABELS = {
    owner: 'Owner',
    collaborator: 'Collaborator',
    viewer: 'Viewer',
};

function formatDateTime(value) {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleString();
}

function formatExpiryHours(value) {
    if (!value) return 'No limit';
    const expiry = new Date(value);
    if (Number.isNaN(expiry.getTime())) return 'Invalid date';

    const diffMs = expiry - new Date();
    if (diffMs <= 0) return 'Expired';

    const hoursLeft = Math.ceil(diffMs / (60 * 60 * 1000));
    return `${hoursLeft} hour${hoursLeft === 1 ? '' : 's'} left`;
}

function formatExpirySummary(value) {
    if (!value) return 'No limit';
    return `${formatExpiryHours(value)} • ${formatDateTime(value)}`;
}

function getAction(log) {
    if (log.action) return log.action;
    if (log.revokedAt) return 'revoked';
    if (log.lastUpdatedAt && log.sharedAt && new Date(log.lastUpdatedAt).getTime() !== new Date(log.sharedAt).getTime()) {
        return 'updated';
    }
    return 'granted';
}

function getCurrentState(log) {
    if (log.action === 'revoked' || log.isActive === false || log.revokedAt) {
        return {
            label: 'Inactive',
            classes: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800',
        };
    }

    if (log.expiresAt) {
        const expiry = new Date(log.expiresAt);
        if (!Number.isNaN(expiry.getTime()) && expiry <= new Date()) {
            return {
                label: 'Expired',
                classes: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800',
            };
        }
    }

    return {
        label: 'Active',
        classes: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
    };
}

export default function LogsModal({ isOpen, onClose, document, logs = [], isLoading = false, error = '', onRetry }) {
    if (!isOpen) return null;

    const sortedLogs = [...logs].sort((a, b) => {
        const left = new Date(b.eventAt || b.revokedAt || b.lastUpdatedAt || b.sharedAt || 0).getTime();
        const right = new Date(a.eventAt || a.revokedAt || a.lastUpdatedAt || a.sharedAt || 0).getTime();
        return left - right;
    });

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[120] flex items-center justify-center p-4"
                onClick={onClose}
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-3xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
                >
                    <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800/70 flex items-center justify-center">
                                <History className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Share Logs</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{document?.fileName}</p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 max-h-[70vh] overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                            </div>
                        ) : error ? (
                            <div className="space-y-3">
                                <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-2xl">
                                    {error}
                                </div>
                                {onRetry && (
                                    <button
                                        type="button"
                                        onClick={onRetry}
                                        className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
                                    >
                                        <RefreshCcw className="w-3.5 h-3.5" />
                                        Retry
                                    </button>
                                )}
                            </div>
                        ) : sortedLogs.length === 0 ? (
                            <div className="text-center py-16">
                                <p className="text-sm text-gray-500 dark:text-gray-400">No sharing activity has been logged yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {sortedLogs.map((log) => {
                                    const action = getAction(log);
                                    const actionMeta = ACTION_META[action] || ACTION_META.granted;
                                    const stateMeta = getCurrentState(log);
                                    const actor = log.eventBy || log.revokedBy || log.lastUpdatedBy || log.sharedBy;
                                    const eventAt = log.eventAt || log.revokedAt || log.lastUpdatedAt || log.sharedAt;

                                    return (
                                        <div
                                            key={log._id || `${log.user?._id || log.user}-${action}-${eventAt}`}
                                            className="rounded-3xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/30 p-5 space-y-4"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                            {log.user?.name || log.name || 'Unknown user'}
                                                        </p>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${actionMeta.classes}`}>
                                                            {actionMeta.label}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${stateMeta.classes}`}>
                                                            {stateMeta.label}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                                                        {log.user?.email || log.email || 'No email available'}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                    <Clock3 className="w-3.5 h-3.5" />
                                                    <span>{formatDateTime(eventAt)}</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-300">
                                                {action === 'moved' ? (
                                                    <>
                                                        <div className="sm:col-span-2">
                                                            <span className="font-semibold text-gray-700 dark:text-gray-200">Details:</span>{' '}
                                                            {log.name || 'Space changed'}
                                                        </div>
                                                        <div className="sm:col-span-2 flex items-start gap-2">
                                                            <UserRound className="w-3.5 h-3.5 mt-0.5 text-gray-400" />
                                                            <span>
                                                                <span className="font-semibold text-gray-700 dark:text-gray-200">Moved by:</span>{' '}
                                                                {actor?.name || actor?.email || 'Unknown user'}
                                                            </span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div>
                                                            <span className="font-semibold text-gray-700 dark:text-gray-200">Permission:</span>{' '}
                                                            {ROLE_LABELS[log.role] || log.role || 'Viewer'}
                                                        </div>
                                                        <div>
                                                            <span className="font-semibold text-gray-700 dark:text-gray-200">Expires:</span>{' '}
                                                            {log.expiresAt ? formatExpirySummary(log.expiresAt) : 'No limit'}
                                                        </div>
                                                        <div className="sm:col-span-2 flex items-start gap-2">
                                                            <UserRound className="w-3.5 h-3.5 mt-0.5 text-gray-400" />
                                                            <span>
                                                                <span className="font-semibold text-gray-700 dark:text-gray-200">Changed by:</span>{' '}
                                                                {actor?.name || actor?.email || 'Unknown user'}
                                                            </span>
                                                        </div>
                                                    </>
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
