import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import API_URL from '../config/api';
import { Button } from '../components/ui/Button';
import { FileText, Download, Trash2, Search, FileUp, MoreVertical, Globe, Lock, Building2, Users, Edit3, Eye, X, LayoutGrid, List, ChevronLeft, ChevronRight, Share2, Clock, UserCheck, Plus, Settings, UserPlus, FileImage, FileSpreadsheet, Presentation, FileCode, FileType2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import UploadModal from '../components/UploadModal';
import ShareModal from '../components/ShareModal';
import LogsModal from '../components/LogsModal';
import DocumentPreview, { DocumentThumbnail, FullPreviewModal } from '../components/PreviewModal';
import CreateOrgModal from '../components/CreateOrgModal';
import ManageOrgModal from '../components/ManageOrgModal';
import { VAULT_COLOR, VAULT_LABELS, VAULT_THRESHOLD } from '../constants/vaults';

export function Workspace({ isPublicOnly = false, isSearchPage = false }) {
    const { spaceId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, token } = useAuth();

    const activeSpace = isPublicOnly ? 'public' : isSearchPage ? 'search' : (spaceId || 'public');
    const activeSharedWithEmail = (searchParams.get('sharedWithEmail') || '').trim();

    const [documents, setDocuments] = useState([]);
    const [orgs, setOrgs] = useState([]);
    const [selectedOrgId, setSelectedOrgId] = useState('');
    const [searchQuery, setSearchQuery] = useState(isSearchPage ? (searchParams.get('q') || '') : '');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [isLogsOpen, setIsLogsOpen] = useState(false);
    const [isFullPreviewOpen, setIsFullPreviewOpen] = useState(false);
    const [fullPreviewDoc, setFullPreviewDoc] = useState(null);
    const [logsData, setLogsData] = useState([]);
    const [isLogsLoading, setIsLogsLoading] = useState(false);
    const [logsError, setLogsError] = useState('');
    const [isDocDetailsLoading, setIsDocDetailsLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [viewMode, setViewMode] = useState('grid');
    const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
    const [isManageOrgOpen, setIsManageOrgOpen] = useState(false);
    const currentPage = parseInt(searchParams.get('page') || '1', 10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // Tagging & Moving state
    const [tagInput, setTagInput] = useState('');
    const [expandedTags, setExpandedTags] = useState(false);
    const [isMoving, setIsMoving] = useState(false);
    const [moveSpace, setMoveSpace] = useState('public');
    const [moveOrg, setMoveOrg] = useState('');
    const [moveAutoTag, setMoveAutoTag] = useState(false);
    const [isTaggingAI, setIsTaggingAI] = useState(false);
    const [isCopying, setIsCopying] = useState(false);
    const [copySpace, setCopySpace] = useState('private');

    const [selectionMode, setSelectionMode] = useState('none');
    const [sharedRecipientEmailInput, setSharedRecipientEmailInput] = useState(searchParams.get('sharedWithEmail') || '');
    const [selectedDocumentIds, setSelectedDocumentIds] = useState(new Set());
    const [isBulkRevoking, setIsBulkRevoking] = useState(false);

    const toggleSelection = (id) => {
        const newSet = new Set(selectedDocumentIds);
        if (newSet.has(id)) {
            newSet.delete(id);
            if (selectionMode === 'all') {
                setSelectionMode('manual');
            }
        } else {
            newSet.add(id);
        }
        setSelectedDocumentIds(newSet);
    };

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3500);
    };

    const getAuthHeaders = () => {
        // AuthContext stores token as 'dmr_token'
        const t = token || localStorage.getItem('dmr_token');
        return t ? { Authorization: `Bearer ${t}` } : {};
    };

    const handleSelectionModeChange = (mode) => {
        setSelectionMode(mode);

        if (mode === 'none') {
            setSelectedDocumentIds(new Set());
            return;
        }

        if (mode === 'all') {
            setSelectedDocumentIds(new Set(documents.map((doc) => doc._id)));
            return;
        }

        setSelectedDocumentIds(new Set());
    };

    const clearSharedRecipientFilter = () => {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('sharedWithEmail');
        newParams.delete('sharedWith');
        newParams.delete('sharedWithLabel');
        newParams.set('page', '1');
        setSharedRecipientEmailInput('');
        setSelectedDocumentIds(new Set());
        setSearchParams(newParams);
    };

    // ─── Role colors for badges ───
    const ROLE_COLORS = {
        owner: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
        admin: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
        collaborator: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
        viewer: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-200 dark:border-gray-700' },
    };

    const ROLE_LABELS = {
        owner: 'Owner',
        admin: 'Admin',
        collaborator: 'Collaborator',
        viewer: 'Viewer',
    };

    const getUserPerm = (doc) => {
        if (!user) return null;
        const uid = user._id || user.id;
        const perm = doc.permissions?.find(p => {
            const pu = p.user?._id || p.user?.id || p.user;
            return pu?.toString() === uid?.toString();
        });
        return perm || null;
    };

    const getAccessLevel = (doc) => {
        if (!user) return 'viewer';
        const uid = user._id || user.id;

        // 1. Uploader is always owner
        const uploaderId = doc.uploadedBy?._id || doc.uploadedBy?.id || doc.uploadedBy;
        if (uploaderId?.toString() === uid?.toString()) return 'owner';

        // 2. Base role from organization if applicable
        let orgRole = null;
        if (doc.space === 'organization' && doc.organization) {
            const orgId = typeof doc.organization === 'object' ? doc.organization._id || doc.organization.id : doc.organization;
            const org = orgs.find(o => (o._id || o.id)?.toString() === orgId?.toString());
            if (org) {
                const member = org.members?.find(m => (m.user?._id || m.user)?.toString() === uid?.toString());
                if (member) orgRole = member.role;
            }
        }

        // 3. Document-level specific permissions
        const perm = getUserPerm(doc);
        const docRole = perm ? (perm.role || perm.level || 'viewer') : 'viewer';

        // 4. If the document is in the org space, the user's org admin/collaborator role acts as a baseline
        if (orgRole) {
            if (orgRole === 'admin') return 'admin';
            if (orgRole === 'collaborator' && docRole === 'viewer') return 'collaborator';
        }

        return docRole;
    };

    const formatDateTime = (value) => {
        if (!value) return 'No limit';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Invalid date';
        return date.toLocaleString();
    };

    const formatExpiryHours = (value) => {
        const exp = new Date(value);
        if (Number.isNaN(exp.getTime())) return 'Invalid date';

        const diffMs = exp - new Date();
        if (diffMs <= 0) return 'Expired';

        const hoursLeft = Math.ceil(diffMs / (60 * 60 * 1000));
        return `${hoursLeft} hour${hoursLeft === 1 ? '' : 's'} left`;
    };

    const formatRelativeExpiry = (value) => {
        return formatExpiryHours(value);
    };

    const getUserPermExpiryInfo = (doc) => {
        const perm = getUserPerm(doc);
        if (!perm?.expiresAt) return null;

        const exp = new Date(perm.expiresAt);
        if (Number.isNaN(exp.getTime())) return null;

        const isExpired = exp <= new Date();
        const hoursLeft = formatExpiryHours(exp);

        return {
            expiresAt: exp,
            formattedAt: formatDateTime(exp),
            relativeLabel: formatRelativeExpiry(exp),
            isExpired,
            tooltip: isExpired ? `Access expired on ${formatDateTime(exp)}` : `Access expires on ${formatDateTime(exp)} (${hoursLeft})`,
        };
    };

    const canManageDocumentAccess = (doc) => {
        // If in org space, check org role first natively
        if (doc.space === 'organization' && doc.organization) {
            const orgId = typeof doc.organization === 'object' ? doc.organization._id || doc.organization.id : doc.organization;
            const org = orgs.find(o => (o._id || o.id)?.toString() === orgId?.toString());
            if (org) {
                const currentUserId = user?.id || user?._id;
                const member = org.members?.find(m => (m.user?._id || m.user)?.toString() === currentUserId?.toString());
                const orgRole = member?.role;
                
                // If the user's org role is viewer, they cannot manage access at all
                if (orgRole !== 'admin' && orgRole !== 'collaborator') {
                    return false;
                }
            }
        }
        
        // Allowed if doc-level role is owner/collaborator/admin
        const role = getAccessLevel(doc);
        if (role === 'owner' || role === 'admin' || role === 'collaborator') return true;

        return false;
    };

    const canViewDocumentLogs = (doc) => {
        if (doc.space === 'organization' && doc.organization) {
            const orgId = typeof doc.organization === 'object' ? doc.organization._id || doc.organization.id : doc.organization;
            const org = orgs.find(o => (o._id || o.id)?.toString() === orgId?.toString());
            if (org) {
                const currentUserId = user?.id || user?._id;
                const member = org.members?.find(m => (m.user?._id || m.user)?.toString() === currentUserId?.toString());
                const orgRole = member?.role;
                
                if (orgRole !== 'admin') {
                    return false;
                }
            }
        }
        
        const role = getAccessLevel(doc);
        if (role === 'owner' || role === 'admin') return true;

        return false;
    };

    const getShareLogStatus = (log) => {
        if (log?.revokedAt) {
            return {
                label: 'Revoked',
                classes: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800',
            };
        }

        if (log?.expiresAt) {
            const expiresAt = new Date(log.expiresAt);
            if (!Number.isNaN(expiresAt.getTime()) && expiresAt <= new Date()) {
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
    };

    const mergeDocumentData = (currentDoc, nextDoc) => {
        if (!currentDoc) return nextDoc;
        return {
            ...currentDoc,
            ...nextDoc,
            permissions: nextDoc.permissions ?? currentDoc.permissions,
            shareLogs: nextDoc.shareLogs ?? currentDoc.shareLogs,
            uploadedBy: nextDoc.uploadedBy ?? currentDoc.uploadedBy,
            organization: nextDoc.organization ?? currentDoc.organization,
            linkSharing: nextDoc.linkSharing ?? currentDoc.linkSharing,
        };
    };

    const getEntityId = (value) => {
        if (!value) return null;
        if (typeof value === 'string') return value;
        if (value._id) return value._id.toString();
        if (value.id) return value.id.toString();
        return value.toString();
    };

    const buildShareLogFeed = (doc, permissions = [], shareLogs = []) => {
        const existingLogs = Array.isArray(shareLogs) ? shareLogs : [];
        const activeLogUsers = new Set(
            existingLogs
                .filter(log => log && log.action !== 'revoked' && log.isActive !== false && !log.revokedAt)
                .map(log => getEntityId(log.user))
                .filter(Boolean)
        );

        const derivedLogs = (permissions || [])
            .map((perm) => {
                const role = perm.role || perm.level || 'viewer';
                const userId = getEntityId(perm.user);

                if (!userId || role === 'owner' || activeLogUsers.has(userId)) {
                    return null;
                }

                return {
                    _id: `derived-${doc?._id || 'doc'}-${userId}`,
                    action: 'granted',
                    user: perm.user,
                    name: perm.user?.name || '',
                    email: perm.user?.email || '',
                    role,
                    expiresAt: perm.expiresAt || null,
                    isActive: true,
                    eventAt: perm.grantedAt || doc?.uploadDate || null,
                    eventBy: perm.grantedBy || null,
                    sharedAt: perm.grantedAt || doc?.uploadDate || null,
                    sharedBy: perm.grantedBy || null,
                    lastUpdatedAt: null,
                    lastUpdatedBy: null,
                    revokedAt: null,
                    revokedBy: null,
                    isDerived: true,
                };
            })
            .filter(Boolean);

        return [...existingLogs, ...derivedLogs];
    };

    const prepareLogs = (doc, payload = {}) => {
        return buildShareLogFeed(
            doc,
            payload.permissions ?? doc?.permissions ?? [],
            payload.shareLogs ?? doc?.shareLogs ?? []
        );
    };

    const canUserEdit = (doc) => {
        if (!user) return false;
        const uid = user._id || user.id;
        const uploaderId = doc.uploadedBy?._id || doc.uploadedBy?.id || doc.uploadedBy;
        if (uploaderId?.toString() === uid?.toString()) return true;
        const perm = getUserPerm(doc);
        if (!perm) return false;
        // Support new flags and legacy level
        if (perm.canEdit !== undefined) return perm.canEdit;
        return perm.level === 'owner' || perm.level === 'editor';
    };

    const canUserDelete = (doc) => {
        if (!user) return false;
        const uid = user._id || user.id;
        const uploaderId = doc.uploadedBy?._id || doc.uploadedBy?.id || doc.uploadedBy;
        if (uploaderId?.toString() === uid?.toString()) return true;
        // Org admin/collaborator can delete org documents
        if (doc.space === 'organization' && doc.organization) {
            const orgId = typeof doc.organization === 'object' ? doc.organization._id || doc.organization.id : doc.organization;
            const org = orgs.find(o => (o._id || o.id)?.toString() === orgId?.toString());
            if (org) {
                const member = org.members?.find(m => (m.user?._id || m.user)?.toString() === uid?.toString());
                if (member && (member.role === 'admin' || member.role === 'collaborator')) return true;
            }
        }
        const perm = getUserPerm(doc);
        if (!perm) return false;
        if (perm.canDelete !== undefined) return perm.canDelete;
        return perm.level === 'owner';
    };

    const canUserMove = (doc) => {
        if (isPublicOnly || !doc) return false;
        // No move for org documents — use Copy instead
        if (doc.space === 'organization') return false;
        const role = getAccessLevel(doc);
        return role === 'owner' || role === 'collaborator' || role === 'admin';
    };

    const canUserCopy = (doc) => {
        if (isPublicOnly || !doc) return false;
        // Copy only available for org documents
        if (doc.space !== 'organization') return false;
        const role = getAccessLevel(doc);
        return role === 'owner' || role === 'collaborator' || role === 'admin';
    };

    const openDocumentDetails = (doc) => {
        setIsLogsOpen(false);
        setIsMoving(false);
        setIsCopying(false);
        setSelectedDoc(doc._id === selectedDoc?._id ? null : doc);
    };

    const openMoveDetails = (doc) => {
        setIsLogsOpen(false);
        setIsCopying(false);
        setSelectedDoc(doc);
        setIsMoving(true);
    };

    const openCopyDetails = (doc) => {
        setIsLogsOpen(false);
        setIsMoving(false);
        setSelectedDoc(doc);
        setIsCopying(true);
    };

    const handleOpenLogs = async (doc) => {
        if (!doc?._id) {
            showToast('error', 'Unable to load logs for this document.');
            return;
        }

        setSelectedDoc(prev => prev?._id === doc._id ? mergeDocumentData(prev, doc) : doc);
        setIsLogsOpen(true);
        setLogsError('');
        setLogsData(prepareLogs(doc));
        setIsLogsLoading(true);

        try {
            const headers = getAuthHeaders();
            const res = await axios.get(`${API_URL}/api/documents/${doc._id}/permissions`, {
                headers,
            });

            setSelectedDoc(prev => prev?._id === doc._id
                ? mergeDocumentData(prev, { _id: doc._id, permissions: res.data.permissions, shareLogs: res.data.shareLogs })
                : prev);
            setLogsData(prepareLogs(doc, res.data));
        } catch (err) {
            setLogsError(err.response?.data?.error || 'Failed to load share logs.');
            setLogsData(prepareLogs(doc));
        } finally {
            setIsLogsLoading(false);
        }
    };

    const getDetailItems = (doc) => {
        const items = [
            { label: 'Uploader', value: doc.uploadedBy?.name || 'Unknown' },
            { label: 'Upload Date', value: new Date(doc.uploadDate).toLocaleDateString() },
            { label: 'File Size', value: formatSize(doc.fileSize) },
            { label: 'File Type', value: getFileType(doc) },
        ];

        const expiryInfo = getUserPermExpiryInfo(doc);
        if (expiryInfo) {
            items.push({ label: 'Access Expiration', value: expiryInfo.formattedAt });
        }

        return items;
    };

    const fetchDocuments = useCallback(async (abortController, forceSearchQuery = null) => {
        setIsLoading(true);
        setError(null);
        try {
            const headers = getAuthHeaders();
            const params = new URLSearchParams(searchParams);

            const qToUse = forceSearchQuery !== null ? forceSearchQuery : searchQuery;
            
            if (qToUse && qToUse.trim()) {
                params.set('q', qToUse.trim());
            } else {
                params.delete('q');
            }

            if (!isPublicOnly && activeSpace === 'organization' && selectedOrgId) {
                params.set('space', 'organization');
                params.set('organizationId', selectedOrgId);
            } else if (!isPublicOnly && activeSpace !== 'search' && activeSpace !== 'public' && activeSpace !== 'recent') {
                params.set('space', activeSpace); // handles 'private', 'shared', 'shared-to-others'
            } else if (activeSpace === 'public' || activeSpace === 'search' || activeSpace === 'recent') {
                params.delete('organizationId');
            }

            const queryStr = params.toString();
            const isPublicRequest = isPublicOnly || activeSpace === 'public';
            let endpoint = isPublicRequest ? '/api/public/documents' : '/api/documents';
            if (activeSpace === 'recent') endpoint = '/api/documents/recent-activity';

            const url = `${API_URL}${endpoint}${queryStr ? '?' + queryStr : ''}`;

            const res = await axios.get(url, {
                ...(isPublicRequest ? {} : { headers }),
                signal: abortController?.signal
            });

            setDocuments(res.data.documents || []);
            setTotalPages(res.data.totalPages || 1);
            setTotalCount(res.data.totalCount || 0);

        } catch (err) {
            if (axios.isCancel(err)) return;
            console.error('fetchDocuments error:', err);
            setError(err.response?.data?.error || 'Failed to load documents.');
            setDocuments([]);
        } finally {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSpace, selectedOrgId, isPublicOnly, searchQuery, searchParams, token]);

    const fetchOrgs = useCallback(async () => {
        if (isPublicOnly || activeSpace !== 'organization') return;
        try {
            const headers = getAuthHeaders();
            const res = await axios.get(`${API_URL}/api/orgs`, { headers });
            const list = res.data.organizations || [];
            setOrgs(list);
            
            const urlOrgId = searchParams.get('organizationId');
            if (urlOrgId && list.some(o => o._id === urlOrgId)) {
                setSelectedOrgId(urlOrgId);
            } else if (list.length > 0 && !selectedOrgId) {
                setSelectedOrgId(list[0]._id);
            }
        } catch (err) { console.error('fetchOrgs error:', err); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPublicOnly, activeSpace, token, searchParams]);

    useEffect(() => {
        const urlOrgId = searchParams.get('organizationId');
        if (activeSpace === 'organization' && urlOrgId && urlOrgId !== selectedOrgId) {
            setSelectedOrgId(urlOrgId);
        }
    }, [searchParams, activeSpace]);

    // Effect to clear selection when space changes
    useEffect(() => {
        if (searchQuery && activeSpace !== 'search') {
            skipSearchEffect.current = true;
            setSearchQuery('');
        }
        setDocuments([]);
        setSelectedDoc(null);
        setIsMoving(false);
        if (!isPublicOnly && activeSpace === 'organization') {
            fetchOrgs();
        }
        setSelectionMode('none');
        setSelectedDocumentIds(new Set());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSpace]);

    useEffect(() => {
        if (activeSpace !== 'shared-to-others') return;

        if (selectionMode === 'all') {
            setSelectedDocumentIds(new Set(documents.map((doc) => doc._id)));
            return;
        }

        setSelectedDocumentIds((prev) => {
            const visibleIds = new Set(documents.map((doc) => doc._id));
            const next = new Set([...prev].filter((id) => visibleIds.has(id)));
            if (next.size === prev.size && [...next].every((id) => prev.has(id))) return prev;
            return next;
        });
    }, [documents, selectionMode, activeSpace]);

    useEffect(() => {
        if (activeSpace !== 'shared-to-others') return;
        setSharedRecipientEmailInput(searchParams.get('sharedWithEmail') || '');
    }, [searchParams, activeSpace]);

    useEffect(() => {
        if (activeSpace !== 'shared-to-others') return;

        const keysToClear = [
            'sort',
            'extension',
            'minSize',
            'maxSize',
            'startDate',
            'endDate',
            'isTagged',
            'tags',
            'tagsMode',
            'uploadedBy',
            'departmentOwner',
            'permissionLevel',
            'isAITagged',
            'vault',
            'organizationId',
        ];

        const hasHiddenFilters = keysToClear.some((key) => searchParams.has(key));
        if (!hasHiddenFilters) return;

        const newParams = new URLSearchParams(searchParams);
        keysToClear.forEach((key) => newParams.delete(key));
        newParams.set('page', '1');
        setSearchParams(newParams);
    }, [activeSpace, searchParams, setSearchParams]);

    useEffect(() => {
        if (activeSpace !== 'shared-to-others') return;

        const normalizedInput = sharedRecipientEmailInput.trim().toLowerCase();
        const currentFilter = activeSharedWithEmail.trim().toLowerCase();
        if (normalizedInput === currentFilter) return;

        const timeoutId = setTimeout(() => {
            const newParams = new URLSearchParams(searchParams);
            if (normalizedInput) {
                newParams.set('sharedWithEmail', normalizedInput);
            } else {
                newParams.delete('sharedWithEmail');
            }
            newParams.delete('sharedWith');
            newParams.delete('sharedWithLabel');
            newParams.set('page', '1');
            setSelectedDocumentIds(new Set());
            setSearchParams(newParams);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [sharedRecipientEmailInput, activeSpace, activeSharedWithEmail, searchParams, setSearchParams]);

    // Escape key to close document modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (isShareOpen) { setIsShareOpen(false); return; }
                if (isUploadOpen) { setIsUploadOpen(false); return; }
                if (selectedDoc) { setSelectedDoc(null); return; }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [selectedDoc, isShareOpen, isUploadOpen]);

    // Fetch documents on activeSpace, searchParams, or selectedOrgId changes
    useEffect(() => {
        if (activeSpace === 'organization' && !selectedOrgId) return;
        const controller = new AbortController();
        
        // Use the query directly from searchParams if possible, to avoid stale state
        const urlQ = searchParams.get('q');
        
        // If we just mapped away from search, or the URL search is different from state, prioritize URL/None
        if (activeSpace !== 'search' && !urlQ) {
            fetchDocuments(controller, '');
        } else {
            fetchDocuments(controller, urlQ !== null ? urlQ : null);
        }

        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSpace, selectedOrgId, searchParams]);

    // Sync URL param to state if it changes externally
    useEffect(() => {
        const urlQ = searchParams.get('q') || '';
        if (urlQ !== searchQuery) {
            setSearchQuery(urlQ);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    useEffect(() => {
        if (!selectedDoc?._id) {
            setIsDocDetailsLoading(false);
            setIsLogsOpen(false);
            return;
        }

        setIsLogsOpen(false);
        let isMounted = true;
        const controller = new AbortController();

        const fetchSelectedDocDetails = async () => {
            setIsDocDetailsLoading(true);
            try {
                const usePublicEndpoint = isPublicOnly;
                const headers = getAuthHeaders();
                const endpoint = usePublicEndpoint
                    ? `${API_URL}/api/public/documents/${selectedDoc._id}`
                    : `${API_URL}/api/documents/${selectedDoc._id}`;

                const res = await axios.get(
                    endpoint,
                    usePublicEndpoint
                        ? { signal: controller.signal }
                        : { headers, signal: controller.signal }
                );

                if (!isMounted) return;
                setSelectedDoc(prev => prev?._id === res.data.document?._id ? mergeDocumentData(prev, res.data.document) : prev);
            } catch (err) {
                if (axios.isCancel(err)) return;
                console.error('fetchSelectedDocDetails error:', err);
            } finally {
                if (isMounted) setIsDocDetailsLoading(false);
            }
        };

        fetchSelectedDocDetails();

        return () => {
            isMounted = false;
            controller.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDoc?._id, isPublicOnly, token]);

    const isFirstSearchRun = useRef(true);
    const skipSearchEffect = useRef(false);
    // Debounced search for public space
    useEffect(() => {
        if (isFirstSearchRun.current) {
            isFirstSearchRun.current = false;
            return;
        }
        if (skipSearchEffect.current) {
            skipSearchEffect.current = false;
            return;
        }
        if (activeSpace !== 'public' && activeSpace !== 'search') return;

        if (isSearchPage && searchQuery) {
            setSearchParams({ q: searchQuery }, { replace: true });
        }

        const t = setTimeout(() => fetchDocuments(), 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery]);

    const handleDownload = async (doc) => {
        try {
            const headers = getAuthHeaders();
            // Step 1: Get a one-time download token from the server
            const useAuth = !!token;
            const tokenUrl = useAuth
                ? `${API_URL}/api/documents/${doc._id}/download`
                : `${API_URL}/api/public/documents/${doc._id}/download`;
            const tokenRes = await axios.get(tokenUrl, useAuth ? { headers } : {});

            const { downloadToken, fileName } = tokenRes.data;

            // Step 2: Stream the file via the secure-download endpoint as a blob
            const streamUrl = useAuth
                ? `${API_URL}/api/documents/secure-download/${downloadToken}`
                : `${API_URL}/api/public/secure-download/${downloadToken}`;
            const blobRes = await axios.get(streamUrl, { responseType: 'blob' });

            // Step 3: Trigger a local file download and open in new tab
            const blob = new Blob([blobRes.data], { type: blobRes.headers['content-type'] || 'application/octet-stream' });
            const url = window.URL.createObjectURL(blob);

            // Download the file
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName || 'download';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Also open in a new tab for immediate viewing
            window.open(url, '_blank');

            // Revoke after a delay so the new tab has time to load
            setTimeout(() => window.URL.revokeObjectURL(url), 15000);
        } catch (err) { showToast('error', 'Download failed.'); }
    };

    const handleDelete = async (docId) => {
        if (!confirm('Permanently delete this document?')) return;
        try {
            const headers = getAuthHeaders();
            await axios.delete(`${API_URL}/api/documents/${docId}`, { headers });
            showToast('success', 'Document deleted.');
            fetchDocuments();
            if (selectedDoc?._id === docId) setSelectedDoc(null);
        } catch (err) { showToast('error', err.response?.data?.error || 'Delete failed.'); }
    };

    const handleBulkRevoke = async () => {
        if (selectedDocumentIds.size === 0) {
            showToast('error', 'Select at least one document.');
            return;
        }

        const docCount = selectedDocumentIds.size;
        const confirmMsg = activeSharedWithEmail
            ? `Revoke ${activeSharedWithEmail} from ${docCount} selected document${docCount === 1 ? '' : 's'}?`
            : `Revoke all shared access from ${docCount} selected document${docCount === 1 ? '' : 's'}?`;
        if (!confirm(confirmMsg)) {
            return;
        }

        setIsBulkRevoking(true);
        try {
            const headers = getAuthHeaders();
            const payload = { documentIds: [...selectedDocumentIds] };
            if (activeSharedWithEmail) payload.email = activeSharedWithEmail;
            const res = await axios.post(
                `${API_URL}/api/documents/permissions/bulk-revoke`,
                payload,
                { headers }
            );

            showToast('success', res.data.message || 'Access revoked.');
            setSelectionMode('none');
            setSelectedDocumentIds(new Set());
            await fetchDocuments();
        } catch (err) {
            showToast('error', err.response?.data?.error || 'Bulk revoke failed.');
        } finally {
            setIsBulkRevoking(false);
        }
    };

    const handleMoveSpaceSubmit = async () => {
        if (!moveSpace) return;
        if (moveSpace === 'organization' && !moveOrg) return;

        try {
            const headers = getAuthHeaders();
            const payload = { targetSpace: moveSpace, organizationId: moveOrg, autoTag: moveAutoTag };
            const res = await axios.put(`${API_URL}/api/documents/${selectedDoc._id}/change-space`, payload, { headers });
            showToast('success', res.data.message || 'Document moved successfully!');
            fetchDocuments();
            setSelectedDoc(null);
            setIsMoving(false);
        } catch (err) { showToast('error', err.response?.data?.error || 'Failed to move document.'); }
    };

    const handleCopySubmit = async () => {
        if (!copySpace) return;
        try {
            const headers = getAuthHeaders();
            const res = await axios.post(`${API_URL}/api/documents/${selectedDoc._id}/copy`, { targetSpace: copySpace }, { headers });
            showToast('success', res.data.message || 'Document copied successfully!');
            fetchDocuments();
            setSelectedDoc(null);
            setIsCopying(false);
        } catch (err) { showToast('error', err.response?.data?.error || 'Failed to copy document.'); }
    };

    const handleAddTag = async (e) => {
        if (e.key !== 'Enter' || !tagInput.trim() || !selectedDoc) return;
        e.preventDefault();
        const currentTags = selectedDoc.tags || [];
        const newTag = tagInput.trim();
        if (currentTags.includes(newTag)) return setTagInput('');
        try {
            const newTags = [...currentTags, newTag];
            const headers = getAuthHeaders();
            const res = await axios.put(`${API_URL}/api/documents/${selectedDoc._id}/tags`, { tags: newTags }, { headers });
            setSelectedDoc(prev => mergeDocumentData(prev, res.data.document));
            setDocuments(docs => docs.map(d => d._id === res.data.document._id ? res.data.document : d));
            setTagInput('');
        } catch (err) { showToast('error', 'Failed to add tag.'); }
    };

    const handleRemoveTag = async (tagToRemove) => {
        if (!selectedDoc) return;
        try {
            const newTags = selectedDoc.tags.filter(t => t !== tagToRemove);
            const headers = getAuthHeaders();
            const res = await axios.put(`${API_URL}/api/documents/${selectedDoc._id}/tags`, { tags: newTags }, { headers });
            setSelectedDoc(prev => mergeDocumentData(prev, res.data.document));
            setDocuments(docs => docs.map(d => d._id === res.data.document._id ? res.data.document : d));
        } catch (err) { showToast('error', 'Failed to remove tag.'); }
    };

    const handleAITag = async () => {
        if (!selectedDoc) return;
        setIsTaggingAI(true);
        try {
            const headers = getAuthHeaders();
            const res = await axios.post(`${API_URL}/api/documents/${selectedDoc._id}/tags/ai`, {}, { headers });
            setSelectedDoc(prev => mergeDocumentData(prev, res.data.document));
            setDocuments(docs => docs.map(d => d._id === res.data.document._id ? res.data.document : d));
            showToast('success', 'AI Auto-tagging complete!');
        } catch (err) { showToast('error', 'AI Tagging failed.'); } finally {
            setIsTaggingAI(false);
        }
    };

    const formatSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatVaultPercent = (score) => `${(score * 100).toFixed(2)}%`;

    const getFileType = (doc) => {
        // Priority 1: Metadata extension
        if (doc.metadata?.extension) {
            return doc.metadata.extension.replace('.', '').toUpperCase();
        }

        // Priority 2: MimeType mapping
        if (doc.mimeType) {
            const MIME_TO_EXT = {
                'application/pdf': 'PDF',
                'application/msword': 'DOC',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
                'application/vnd.ms-excel': 'XLS',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
                'application/vnd.ms-powerpoint': 'PPT',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
                'text/plain': 'TXT',
                'image/png': 'PNG',
                'image/jpeg': 'JPG',
                'image/gif': 'GIF',
                'video/mp4': 'MP4',
                'audio/mpeg': 'MP3',
                'application/zip': 'ZIP',
                'application/x-zip-compressed': 'ZIP'
            };
            if (MIME_TO_EXT[doc.mimeType]) return MIME_TO_EXT[doc.mimeType];
        }

        // Priority 3: Extract from fileName
        if (doc.fileName && doc.fileName.includes('.')) {
            const ext = doc.fileName.split('.').pop();
            if (ext) return ext.toUpperCase();
        }

        return 'FILE';
    };

    const getFileIconDetails = (doc) => {
        const type = getFileType(doc);
        switch(type) {
            case 'PFD': case 'PDF': 
                return { icon: <FileType2 className="w-5 h-5" />, bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-500 dark:text-red-400' };
            case 'JPG': case 'JPEG': case 'PNG': case 'GIF': case 'WEBP': case 'SVG': 
                return { icon: <FileImage className="w-5 h-5" />, bg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-500 dark:text-rose-400' };
            case 'XLS': case 'XLSX': case 'CSV': 
                return { icon: <FileSpreadsheet className="w-5 h-5" />, bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' };
            case 'PPT': case 'PPTX': 
                return { icon: <Presentation className="w-5 h-5" />, bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-500 dark:text-amber-400' };
            case 'JSON': case 'XML': case 'HTML': case 'JS': case 'CSS': 
                return { icon: <FileCode className="w-5 h-5" />, bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-300' };
            case 'DOC': case 'DOCX': case 'TXT':
                return { icon: <FileText className="w-5 h-5" />, bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' };
            default: 
                return { icon: <FileText className="w-5 h-5" />, bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' };
        }
    };

    const itemsPerPage = 20; // Server limit is default 20
    const sharedToOthersRevokeTitle = selectedDocumentIds.size === 0
        ? 'Select at least one document to revoke access.'
        : activeSharedWithEmail
            ? `Revoke ${activeSharedWithEmail} from selected documents.`
            : 'Revoke all shared access from selected documents.';
    const totalItems = totalCount;
    const effectiveTotalPages = totalPages;
    // Client side slicing removed - server handles pagination
    const paginatedDocuments = documents;
    const startIndex = (currentPage - 1) * itemsPerPage;

    const currentUserId = user?.id || user?._id;
    const adminOrgs = orgs.filter(org => {
        const isCreator = (org?.createdBy?._id || org?.createdBy)?.toString() === currentUserId?.toString();
        const isRoleAdmin = org?.members?.some(m => (m.user?._id || m.user)?.toString() === currentUserId?.toString() && m.role === 'admin');
        return isCreator || isRoleAdmin;
    });
    const memberOrgs = orgs.filter(org => !adminOrgs.includes(org));
    const selectedOrg = orgs.find(o => o._id === selectedOrgId);
    const isOrgAdmin = selectedOrg ? adminOrgs.some(o => o._id === selectedOrg._id) : false;

    const spaceLabel = isSearchPage ? 'Search Results' : activeSpace === 'shared' ? 'Shared with Me' : activeSpace === 'shared-to-others' ? 'Shared with Others' : activeSpace === 'recent' ? 'Recently Accessed' : activeSpace === 'organization' && selectedOrg ? selectedOrg.name : `${activeSpace.charAt(0).toUpperCase() + activeSpace.slice(1)} Space`;

    return (
        <div className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        {activeSpace === 'public' && <Globe className="w-8 h-8 text-emerald-500" />}
                        {activeSpace === 'private' && <Lock className="w-8 h-8 text-blue-500" />}
                        {activeSpace === 'shared' && <Users className="w-8 h-8 text-orange-500" />}
                        {activeSpace === 'shared-to-others' && <UserCheck className="w-8 h-8 text-indigo-500" />}
                        {activeSpace === 'organization' && <Building2 className="w-8 h-8 text-purple-500" />}
                        {activeSpace === 'recent' && <Clock className="w-8 h-8 text-rose-500" />}
                        {isSearchPage && <Search className="w-8 h-8 text-blue-500" />}
                        <span className="truncate max-w-[300px] sm:max-w-none">{spaceLabel}</span>
                        {selectedOrgId && activeSpace === 'organization' && (
                            <div className="ml-3 flex items-center gap-2">

                                <Button onClick={() => setIsManageOrgOpen(true)} variant="secondary" className="h-8 text-xs px-3 bg-gray-100/50 hover:bg-gray-200 shadow-none border border-gray-200 dark:bg-gray-800/80 dark:hover:bg-gray-700 dark:border-gray-700">
                                    {isOrgAdmin ? (
                                        <><Settings className="w-3.5 h-3.5 mr-1.5" /> Manage Team</>
                                    ) : (
                                        <><Users className="w-3.5 h-3.5 mr-1.5" /> View Access</>
                                    )}
                                </Button>
                            </div>
                        )}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                        {activeSpace === 'public' && 'All publicly available documents.'}
                        {activeSpace === 'private' && 'Documents you have uploaded privately.'}
                        {activeSpace === 'shared' && 'Documents others have shared with you.'}
                        {activeSpace === 'shared-to-others' && 'Documents you have shared with other users.'}
                        {activeSpace === 'organization' && 'Documents within your organizations.'}
                        {activeSpace === 'recent' && 'Documents you have recently viewed or modified.'}
                    </p>
                </div>

                <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        {activeSpace === 'shared-to-others' && (
                        <>
                            <select
                                value={selectionMode}
                                onChange={(e) => handleSelectionModeChange(e.target.value)}
                                className="text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl pl-3 pr-8 py-2 outline-none hover:border-gray-300 dark:hover:border-gray-600 focus:ring-2 focus:ring-blue-500 transition-all font-medium cursor-pointer shadow-sm appearance-none"
                                style={{ minWidth: "170px", backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7em top 50%', backgroundSize: '.65em auto' }}
                                title="Selection options"
                            >
                                <option value="none">Select documents</option>
                                <option value="manual">Select manually</option>
                                <option value="all">Select all on page</option>
                            </select>

                            <div className="relative min-w-[260px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <input
                                    type="email"
                                    value={sharedRecipientEmailInput}
                                    onChange={(e) => setSharedRecipientEmailInput(e.target.value)}
                                    placeholder="Filter by recipient email..."
                                    className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl outline-none hover:border-gray-300 dark:hover:border-gray-600 focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                                />
                                {sharedRecipientEmailInput && (
                                    <button
                                        type="button"
                                        onClick={clearSharedRecipientFilter}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-md transition-colors"
                                        title="Clear email filter"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </>
                    )}

                    {activeSpace !== 'shared-to-others' && (
                        <select
                            value={searchParams.get('sort') || 'latest'}
                            onChange={(e) => {
                                const newParams = new URLSearchParams(searchParams);
                                newParams.set('sort', e.target.value);
                                newParams.set('page', '1');
                                setSearchParams(newParams);
                            }}
                            className="text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl pl-3 pr-8 py-2 outline-none hover:border-gray-300 dark:hover:border-gray-600 focus:ring-2 focus:ring-blue-500 transition-all font-medium cursor-pointer shadow-sm appearance-none"
                            style={{ minWidth: "140px", backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7em top 50%', backgroundSize: '.65em auto' }}
                        >
                            <option value="latest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="sizeDesc">Largest Size</option>
                            <option value="sizeAsc">Smallest Size</option>
                        </select>
                    )}

                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl flex-shrink-0">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            title="Grid View"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            title="List View"
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                    {!isPublicOnly && activeSpace === 'shared-to-others' && (
                        <Button
                            variant="danger"
                            className="flex-shrink-0 shadow-lg shadow-red-500/10"
                            isLoading={isBulkRevoking}
                            disabled={selectedDocumentIds.size === 0 || isBulkRevoking}
                            onClick={handleBulkRevoke}
                            title={sharedToOthersRevokeTitle}
                        >
                            <Trash2 className="w-4 h-4 mr-2" /> Revoke
                        </Button>
                    )}
                        {!isPublicOnly && activeSpace !== 'shared-to-others' && (
                            <Button onClick={() => setIsUploadOpen(true)} className="flex-shrink-0 shadow-lg shadow-blue-500/20">
                                <FileUp className="w-4 h-4 mr-2" /> Upload
                            </Button>
                        )}
                    </div>
                    
                    {/* Pagination below Header controls */}
                    {!isLoading && !error && totalItems > 0 && effectiveTotalPages > 1 && (
                        <div className="flex items-center gap-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm px-3 py-1.5 self-end">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                Page <span className="font-bold text-gray-900 dark:text-white">{currentPage}</span> of <span className="font-bold text-gray-900 dark:text-white">{effectiveTotalPages}</span>
                                <span className="ml-2 text-gray-400 dark:text-gray-600">·</span>
                                <span className="ml-2"><span className="font-bold text-blue-600 dark:text-blue-400">{totalItems}</span> total</span>
                            </span>
                            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => {
                                        const newParams = new URLSearchParams(searchParams);
                                        newParams.set('page', Math.max(1, currentPage - 1).toString());
                                        setSearchParams(newParams);
                                    }}
                                    disabled={currentPage <= 1}
                                    className="p-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => {
                                        const newParams = new URLSearchParams(searchParams);
                                        newParams.set('page', Math.min(effectiveTotalPages, currentPage + 1).toString());
                                        setSearchParams(newParams);
                                    }}
                                    disabled={currentPage >= effectiveTotalPages}
                                    className="p-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Org Selector */}
            {!isPublicOnly && activeSpace === 'organization' && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 overflow-x-auto pb-2 flex-shrink-0 w-full">
                    <div className="flex items-center gap-3">
                        <Button onClick={() => setIsCreateOrgOpen(true)} variant="secondary" className="flex-shrink-0 h-9 px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            <Plus className="w-4 h-4 mr-2" /> New Org
                        </Button>
                        <div className="w-px h-8 bg-gray-300 dark:bg-gray-700 mx-1"></div>
                        {orgs.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">You are not a member of any organization.</p>
                        ) : (
                            <div className="relative">
                                <select
                                    value={selectedOrgId || ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (!val) return;
                                        const newParams = new URLSearchParams(searchParams);
                                        newParams.set('organizationId', val);
                                        newParams.set('page', '1');
                                        setSearchParams(newParams);
                                    }}
                                    className="appearance-none bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm font-semibold rounded-xl pl-4 pr-10 py-2 outline-none focus:ring-2 focus:ring-purple-500 transition-all cursor-pointer shadow-sm hover:border-purple-300 dark:hover:border-purple-700 min-w-[200px]"
                                    style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '.65em auto' }}
                                >
                                    <option value="" disabled>Select Organization...</option>
                                    {adminOrgs.length > 0 && (
                                        <optgroup label="My Organizations">
                                            {adminOrgs.map(org => (
                                                <option className="bg-white dark:bg-gray-900" key={org._id} value={org._id}>{org.name}</option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {memberOrgs.length > 0 && (
                                        <optgroup label="Other Organizations">
                                            {memberOrgs.map(org => (
                                                <option className="bg-white dark:bg-gray-900" key={org._id} value={org._id}>{org.name}</option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                            </div>
                        )}
                    </div>
                    {/* User Role Indicator */}
                    {selectedOrgId && (
                        <div className="ml-auto hidden sm:flex items-center gap-2 bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 rounded-xl px-3 py-1.5 shadow-sm">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">My Role:</span>
                            {(() => {
                                const selectedOrg = orgs.find(o => (o._id || o.id)?.toString() === selectedOrgId?.toString());
                                if (!selectedOrg) return null;
                                const uid = user?._id || user?.id;
                                const member = selectedOrg.members?.find(m => (m.user?._id || m.user)?.toString() === uid?.toString());
                                const role = member?.role || 'viewer';
                                const rc = ROLE_COLORS[role] || ROLE_COLORS.viewer;
                                return (
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${rc.bg} ${rc.text} ${rc.border}`}>
                                        {ROLE_LABELS[role] || role}
                                    </span>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex gap-6 overflow-hidden relative">
                {/* File Grid */}
                <div className="flex-1 min-w-0 overflow-y-auto pr-2 pb-4">
                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-800/50 rounded-2xl h-48 border border-gray-200 dark:border-gray-800" />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                                <X className="w-8 h-8 text-red-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Failed to Load</h3>
                            <p className="text-sm text-gray-500 mb-4">{error}</p>
                            <Button onClick={fetchDocuments}>Retry</Button>
                        </div>
                    ) : paginatedDocuments.length > 0 ? (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={viewMode}
                                initial="hidden" animate="visible" exit="exit"
                                variants={{
                                    hidden: { opacity: 0 },
                                    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
                                    exit: { opacity: 0, transition: { duration: 0.15 } }
                                }}
                                className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4" : "flex flex-col gap-[2px]"}
                            >
                                {viewMode === 'list' && paginatedDocuments.length > 0 && (
                                    <div className="hidden md:flex items-center gap-4 px-4 py-2.5 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest border-b border-gray-200 dark:border-gray-800">
                                        {(activeSpace === 'shared-to-others' && selectionMode !== 'none') ? <div className="w-4"></div> : null}
                                        <div className="w-10"></div>
                                        <div className="flex-1">Name</div>
                                        <div className="w-36">Uploaded By</div>
                                        <div className="w-32">Date Modified</div>
                                        <div className="w-24">File Size</div>
                                        <div className="w-32 text-right">Actions</div>
                                    </div>
                                )}
                                {paginatedDocuments.map(doc => {
                                    return viewMode === 'grid' ? (
                                        <motion.div
                                            key={doc._id}
                                            variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                                            onClick={() => openDocumentDetails(doc)}
                                            className={`group bg-white dark:bg-gray-900 border rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 ${selectedDoc?._id === doc._id
                                                ? 'border-blue-500 ring-1 ring-blue-500 shadow-md'
                                                : 'border-gray-200 dark:border-gray-800 shadow-sm'
                                                }`}
                                        >
                                            {/* Thumbnail area — Google Drive style */}
                                            <div className="-mx-5 -mt-5 mb-4 rounded-t-2xl overflow-hidden border-b border-gray-100 dark:border-gray-800/40">
                                                <DocumentThumbnail document={doc} isPublic={isPublicOnly} />
                                            </div>
                                            <div className="flex justify-between items-start gap-2 mb-2">
                                                <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate flex-1 pt-0.5" title={doc.fileName}>{doc.fileName}</h3>
                                                <div className="flex items-center gap-1.5 flex-wrap justify-end flex-shrink-0">
                                                    {isSearchPage && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 uppercase tracking-wider border border-gray-200 dark:border-gray-700">
                                                            {doc.space}
                                                        </span>
                                                    )}
                                                    {(() => {
                                                        const expiry = getUserPermExpiryInfo(doc);
                                                        if (!expiry) return null;
                                                        return (
                                                            <span
                                                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${expiry.isExpired ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800'}`}
                                                                title={expiry.tooltip}
                                                            >
                                                                <Clock className="w-3.5 h-3.5" />
                                                            </span>
                                                        );
                                                    })()}
                                                    {canUserMove(doc) && (
                                                        <button
                                                            type="button"
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-400 transition-colors"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openMoveDetails(doc);
                                                            }}
                                                            title="Move document"
                                                        >
                                                            <Globe className="w-3 h-3" />
                                                            Move
                                                        </button>
                                                    )}
                                                    {canUserCopy(doc) && (
                                                        <button
                                                            type="button"
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-cyan-200 bg-cyan-50 text-cyan-600 hover:bg-cyan-100 dark:border-cyan-800/60 dark:bg-cyan-900/20 dark:text-cyan-400 transition-colors"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openCopyDetails(doc);
                                                            }}
                                                            title="Copy to another space"
                                                        >
                                                            <FileUp className="w-3 h-3" />
                                                            Copy
                                                        </button>
                                                    )}
                                                    <button
                                                        className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openDocumentDetails(doc);
                                                        }}
                                                        title="More actions"
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap overflow-hidden">
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <span>{formatSize(doc.fileSize)}</span>
                                                    <span>•</span>
                                                    <span className="font-bold text-blue-600 dark:text-blue-400">{getFileType(doc)}</span>
                                                </div>
                                                <span className="shrink-0">{new Date(doc.uploadDate).toLocaleDateString()}</span>
                                            </div>
                                            {/* {doc.isTagged && doc.metadata?.typeTags?.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-1.5 overflow-hidden max-h-6">
                                                    {doc.metadata.typeTags.slice(0, 2).map((tag, i) => (
                                                        <span key={i} className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider truncate">{tag}</span>
                                                    ))}
                                                    {doc.metadata.typeTags.length > 2 && <span className="text-[10px] text-gray-400 font-bold">+{doc.metadata.typeTags.length - 2}</span>}
                                                </div>
                                            )} */}
                                            {doc.isVaultRouted && doc.metadata?.vaults?.filter(v => v.score >= VAULT_THRESHOLD).length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1.5 overflow-hidden max-h-5">
                                                    {doc.metadata.vaults.filter(v => v.score >= VAULT_THRESHOLD).slice(0, 2).map((v, i) => (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(`/vaults/${v.vaultId}?page=1`);
                                                            }}
                                                            className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold tracking-wide truncate flex items-center gap-1 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                                                            title={`View documents in ${v.label}`}
                                                        >
                                                            🗂 {v.label}
                                                        </button>
                                                    ))}
                                                    {doc.metadata.vaults.filter(v => v.score >= VAULT_THRESHOLD).length > 2 && <span className="text-[10px] text-gray-400 font-bold">+{doc.metadata.vaults.filter(v => v.score >= VAULT_THRESHOLD).length - 2}</span>}
                                                </div>
                                            )}
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key={doc._id}
                                            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
                                            onClick={() => openDocumentDetails(doc)}
                                            className={`group bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800/60 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors flex items-center justify-between ${selectedDoc?._id === doc._id
                                                ? 'bg-blue-50 dark:bg-blue-900/10'
                                                : ''
                                                }`}
                                        >
                                            <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                                                {activeSpace === 'shared-to-others' && selectionMode !== 'none' && (
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0" 
                                                        checked={selectedDocumentIds.has(doc._id)} 
                                                        onChange={(e) => { e.stopPropagation(); toggleSelection(doc._id); }} 
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                )}
                                                {(() => {
                                                    const iconDetails = getFileIconDetails(doc);
                                                    return (
                                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconDetails.bg} ${iconDetails.text}`}>
                                                            {iconDetails.icon}
                                                        </div>
                                                    );
                                                })()}
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate" title={doc.fileName}>{doc.fileName}</h3>
                                                    {/* Mobile Only Info */}
                                                    <div className="md:hidden flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                                                        <span>{formatSize(doc.fileSize)}</span>
                                                        <span>•</span>
                                                        <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                                                        <span>•</span>
                                                        <span className="truncate max-w-[100px]">{doc.uploadedBy?.name || 'Unknown'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Desktop Columns */}
                                            <div className="hidden md:flex items-center gap-4 flex-shrink-0 text-sm font-medium text-gray-600 dark:text-gray-400">
                                                <div className="w-36 truncate" title={doc.uploadedBy?.name || 'Unknown'}>{doc.uploadedBy?.name || 'Unknown'}</div>
                                                <div className="w-32">{new Date(doc.uploadDate).toLocaleDateString()}</div>
                                                <div className="w-24 uppercase">{formatSize(doc.fileSize)}</div>
                                            </div>

                                            <div className="flex items-center gap-2 md:w-32 justify-end flex-shrink-0 pl-4">
                                                {activeSpace !== 'public' && doc.isVaultRouted && doc.metadata?.vaults?.filter(v => v.score >= VAULT_THRESHOLD).length > 0 && (
                                                    <div className="hidden lg:flex flex-wrap gap-1.5 max-w-[160px] overflow-hidden">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(`/vaults/${doc.metadata.vaults.find(v => v.score >= VAULT_THRESHOLD).vaultId}?page=1`);
                                                            }}
                                                            className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold truncate flex items-center gap-1 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                                                            title={`View documents in ${doc.metadata.vaults.find(v => v.score >= VAULT_THRESHOLD).label}`}
                                                        >
                                                            🗂 {doc.metadata.vaults.find(v => v.score >= VAULT_THRESHOLD).label}
                                                        </button>
                                                        {doc.metadata.vaults.filter(v => v.score >= VAULT_THRESHOLD).length > 1 && <span className="text-[10px] text-gray-400 font-bold">+{doc.metadata.vaults.filter(v => v.score >= VAULT_THRESHOLD).length - 1}</span>}
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-2">
                                                    {isSearchPage && (
                                                        <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 uppercase tracking-wider border border-gray-200 dark:border-gray-700">
                                                            {doc.space}
                                                        </span>
                                                    )}
                                                    {canUserMove(doc) && (
                                                        <button
                                                            type="button"
                                                            className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-400 transition-colors"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openMoveDetails(doc);
                                                            }}
                                                            title="Move document"
                                                        >
                                                            <Globe className="w-3 h-3" />
                                                            Move
                                                        </button>
                                                    )}
                                                    {canUserCopy(doc) && (
                                                        <button
                                                            type="button"
                                                            className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-cyan-200 bg-cyan-50 text-cyan-600 hover:bg-cyan-100 dark:border-cyan-800/60 dark:bg-cyan-900/20 dark:text-cyan-400 transition-colors"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openCopyDetails(doc);
                                                            }}
                                                            title="Copy to another space"
                                                        >
                                                            <FileUp className="w-3 h-3" />
                                                            Copy
                                                        </button>
                                                    )}
                                                    {(() => {
                                                        const expiry = getUserPermExpiryInfo(doc);
                                                        if (!expiry) return null;
                                                        return (
                                                            <span
                                                                className={`hidden sm:inline-flex items-center justify-center w-6 h-6 rounded-full ${expiry.isExpired ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800'}`}
                                                                title={expiry.tooltip}
                                                            >
                                                                <Clock className="w-3.5 h-3.5" />
                                                            </span>
                                                        );
                                                    })()}
                                                    <button
                                                        className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openDocumentDetails(doc);
                                                        }}
                                                        title="More actions"
                                                    >
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </motion.div>
                        </AnimatePresence>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-center max-w-md mx-auto">
                            <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center text-gray-400 mb-6">
                                <Search className="w-10 h-10" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No documents found</h3>
                            <p className="text-gray-500 dark:text-gray-400 mb-6">
                                {searchQuery
                                    ? `No results for "${searchQuery}".`
                                    : activeSpace === 'shared-to-others'
                                        ? activeSharedWithEmail
                                            ? `No documents are shared with ${activeSharedWithEmail}.`
                                            : 'You have no active document shares right now.'
                                        : 'This space is empty. Upload a document to get started.'
                                }
                            </p>
                            {!isPublicOnly && activeSpace !== 'shared' && activeSpace !== 'shared-to-others' && (
                                <Button onClick={() => setIsUploadOpen(true)}>Upload Document</Button>
                            )}
                        </div>
                    )}
                </div>

                {/* Details Modal — hidden while ShareModal is open */}
                <AnimatePresence>
                    {selectedDoc && !isShareOpen && !isLogsOpen && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                            {/* Modal Overlay Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setSelectedDoc(null)}
                                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm cursor-pointer"
                            />
                            
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                            >
                                {/* Header */}
                                <div className="flex items-start sm:items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-800/20">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                                            <FileText className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-2 sm:truncate max-w-md" title={selectedDoc.fileName}>{selectedDoc.fileName}</h3>
                                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-200/60 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                                    {selectedDoc.space} Space
                                                </span>
                                                {(() => { const role = getAccessLevel(selectedDoc); const rc = ROLE_COLORS[role] || ROLE_COLORS.viewer; return (
                                                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${rc.bg} ${rc.text} ${rc.border}`} title={`${ROLE_LABELS[role] || role} access`}>
                                                        {role === 'owner' || role === 'collaborator' ? <Edit3 className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                        {ROLE_LABELS[role] || role}
                                                    </span>
                                                ); })()}
                                                {(() => {
                                                    const expiry = getUserPermExpiryInfo(selectedDoc);
                                                    if (!expiry) return null;
                                                    return (
                                                        <span
                                                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${expiry.isExpired ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800'}`}
                                                            title={expiry.tooltip}
                                                        >
                                                            <Clock className="w-3 h-3" />
                                                            {expiry.relativeLabel}
                                                        </span>
                                                    );
                                                })()}
                                                {isDocDetailsLoading && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                                        Refreshing...
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedDoc(null)} className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-xl hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ml-4 sm:ml-0">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="p-6 overflow-y-auto">
                                    {/* Inline first-page preview */}
                                    <DocumentPreview document={selectedDoc} isPublic={isPublicOnly} />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Info Column */}
                                        <div className="space-y-6">
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Description</p>
                                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium">{selectedDoc.description || 'No description provided.'}</p>
                                            </div>
                                            
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Metadata Tags</p>
                                                    {selectedDoc.isAITagged && (
                                                        <span className="text-[10px] font-bold text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 py-0.5 rounded uppercase tracking-wider">AI Tagged</span>
                                                    )}
                                                </div>
                                                {(selectedDoc.tags?.length > 0) ? (
                                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                                        {(expandedTags ? selectedDoc.tags : selectedDoc.tags.slice(0, 3)).map((t, i) => (
                                                            <span key={i} className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg text-[11px] font-bold uppercase tracking-wider group">
                                                                {t}
                                                                {canUserEdit(selectedDoc) && (
                                                                    <button type="button" onClick={() => handleRemoveTag(t)} className="opacity-50 hover:opacity-100 hover:text-blue-800 dark:hover:text-blue-200 transition-opacity">
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                )}
                                                            </span>
                                                        ))}
                                                        {!expandedTags && selectedDoc.tags.length > 3 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedTags(true)}
                                                                className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-[11px] font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                                                            >
                                                                +{selectedDoc.tags.length - 3}
                                                            </button>
                                                        )}
                                                        {expandedTags && selectedDoc.tags.length > 3 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedTags(false)}
                                                                className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-[11px] font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
                                                            >
                                                                Show less
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-500 italic mb-3">No tags added yet.</p>
                                                )}
                                                {canUserEdit(selectedDoc) && (
                                                    <div className="flex flex-col gap-2 relative">
                                                        <input
                                                            type="text"
                                                            value={tagInput}
                                                            onChange={e => setTagInput(e.target.value)}
                                                            onKeyDown={handleAddTag}
                                                            placeholder="Type tag & Enter..."
                                                            className="w-full text-xs px-3 py-2 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white"
                                                        />
                                                        <button
                                                            onClick={handleAITag}
                                                            disabled={isTaggingAI}
                                                            className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2 bg-purple-50 hover:bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 dark:text-purple-400 rounded-lg transition-colors border border-purple-100 dark:border-purple-800/50 shadow-sm"
                                                        >
                                                            {isTaggingAI ? <span className="animate-pulse flex items-center gap-2"><div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div> Analyzing...</span> : <>✨ Auto-tag with AI</>}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Metadata Column */}
                                        <div className="flex flex-col gap-4">
                                            <div className="bg-gray-50/50 dark:bg-gray-800/40 rounded-3xl p-6 border border-gray-100 dark:border-gray-800/60 space-y-4">
                                                {getDetailItems(selectedDoc).map(item => (
                                                    <div key={item.label} className="flex justify-between items-center py-1.5">
                                                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{item.label}</span>
                                                        <span className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[140px]" title={item.value}>{item.value}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Vaults Section */}
                                            {selectedDoc.metadata?.vaults && selectedDoc.metadata.vaults.filter(v => v.score >= VAULT_THRESHOLD).length > 0 && (
                                              <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-800/60 space-y-3">
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Document Vaults</p>
                                                <div className="space-y-2.5">
                                                  {selectedDoc.metadata.vaults.filter(v => v.score >= VAULT_THRESHOLD).map((vault) => {
                                                    const color = VAULT_COLOR;
                                                    const label = VAULT_LABELS[vault.vaultId] || vault.label;
                                                    return (
                                                      <div key={vault.vaultId} className={`p-3 rounded-lg border ${color.bg} ${color.border}`}>
                                                        <button
                                                          onClick={() => navigate(`/vaults/${vault.vaultId}`)}
                                                          className={`font-semibold text-sm ${color.text} hover:opacity-80 transition-opacity cursor-pointer`}
                                                        >
                                                          {label}
                                                        </button>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            )}

                                            {isMoving && (
                                                <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3 animate-fade-in-up">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Move To</span>
                                                        <button onClick={() => setIsMoving(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded p-1 transition-colors"><X className="w-3 h-3" /></button>
                                                    </div>
                                                    <select value={moveSpace} onChange={e => setMoveSpace(e.target.value)} className="w-full text-sm p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500">
                                                        <option value="public">Public Space</option>
                                                        <option value="private">Private Space</option>
                                                        {orgs.length > 0 && <option value="organization">Organization Space</option>}
                                                    </select>
                                                    {moveSpace === 'organization' && (
                                                        <select value={moveOrg} onChange={e => setMoveOrg(e.target.value)} className="w-full text-sm p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500">
                                                            <option value="">Select Organization...</option>
                                                            {orgs.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
                                                        </select>
                                                    )}
                                                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer pt-1">
                                                        <input type="checkbox" checked={moveAutoTag} onChange={e => setMoveAutoTag(e.target.checked)} className="rounded text-blue-600 border-gray-300 dark:border-gray-600 dark:bg-gray-700" />
                                                        Run AI Auto-tagging
                                                    </label>
                                                    <Button className="w-full py-2.5 mt-1 text-sm shadow-sm" onClick={handleMoveSpaceSubmit}>Confirm Move</Button>
                                                </div>
                                            )}
                                            {isCopying && (
                                                <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3 animate-fade-in-up">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Copy To</span>
                                                        <button onClick={() => setIsCopying(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded p-1 transition-colors"><X className="w-3 h-3" /></button>
                                                    </div>
                                                    <select value={copySpace} onChange={e => setCopySpace(e.target.value)} className="w-full text-sm p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500">
                                                        <option value="private">Private Space</option>
                                                        <option value="public">Public Space</option>
                                                    </select>
                                                    <Button className="w-full py-2.5 mt-1 text-sm shadow-sm" onClick={handleCopySubmit}>Confirm Copy</Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="p-6 border-t border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-800/20 flex flex-wrap gap-3">
                                    <Button
                                        className="flex-1 sm:flex-none bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-none shadow-lg shadow-indigo-500/25"
                                        onClick={() => {
                                            setFullPreviewDoc(selectedDoc);
                                            setIsFullPreviewOpen(true);
                                        }}
                                    >
                                        <Eye className="w-4 h-4 mr-2" /> View
                                    </Button>
                                    <Button className="flex-1 sm:flex-none border-none shadow-lg shadow-blue-500/20" onClick={() => handleDownload(selectedDoc)}>
                                        <Download className="w-4 h-4 mr-2" /> Download
                                    </Button>

                                    {!isPublicOnly && canViewDocumentLogs(selectedDoc) && (
                                        <Button
                                            className="flex-1 sm:flex-none bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-900/20 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700 transition-colors"
                                            onClick={() => handleOpenLogs(selectedDoc)}
                                        >
                                            <Clock className="w-4 h-4 mr-2" /> Logs
                                        </Button>
                                    )}

                                    {!isPublicOnly && canManageDocumentAccess(selectedDoc) && (
                                        <Button
                                            className="flex-1 sm:flex-none bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 shadow-sm border border-blue-200 dark:border-blue-800/50 transition-colors"
                                            onClick={() => setIsShareOpen(true)}
                                        >
                                            <Share2 className="w-4 h-4 mr-2" /> Share
                                        </Button>
                                    )}
                                    {!isPublicOnly && canUserDelete(selectedDoc) && (
                                        <Button variant="danger" className="flex-1 sm:flex-none sm:ml-auto shadow-sm" onClick={() => handleDelete(selectedDoc._id)}>
                                            <Trash2 className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Delete</span>
                                        </Button>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>

            {/* Toasts */}
            <AnimatePresence>

                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                        className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-xl z-50 font-bold backdrop-blur-md border ${toast.type === 'error' ? 'bg-red-500/90 text-white border-red-600' : 'bg-emerald-500/90 text-white border-emerald-600'
                            }`}
                    >
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>

            <CreateOrgModal
                isOpen={isCreateOrgOpen}
                onClose={() => setIsCreateOrgOpen(false)}
                onSuccess={(org) => {
                    setIsCreateOrgOpen(false);
                    fetchOrgs().then(() => {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set('organizationId', org._id);
                        newParams.set('page', '1');
                        setSearchParams(newParams);
                    });
                }}
            />

            {selectedOrgId && (
                <ManageOrgModal
                    isOpen={isManageOrgOpen}
                    onClose={() => setIsManageOrgOpen(false)}
                    orgId={selectedOrgId}
                    onUpdate={() => fetchOrgs()}
                    onDelete={() => {
                        setSelectedOrgId('');
                        setIsManageOrgOpen(false);
                        const newParams = new URLSearchParams(searchParams);
                        newParams.delete('organizationId');
                        setSearchParams(newParams);
                        fetchOrgs();
                    }}
                />
            )}

            {/* Upload Modal */}
            <UploadModal
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
                onUploadSuccess={() => fetchDocuments()}
                defaultSpace={(activeSpace === 'shared' || isSearchPage) ? null : activeSpace}
                defaultOrgId={selectedOrgId}
            />
            <ShareModal
                isOpen={isShareOpen}
                onClose={() => setIsShareOpen(false)}
                document={selectedDoc}
                onUpdate={(updatedDoc) => {
                    setSelectedDoc(prev => mergeDocumentData(prev, updatedDoc));
                    setDocuments(docs => docs.map(d => d._id === updatedDoc._id ? updatedDoc : d));
                }}
            />
            <FullPreviewModal
                isOpen={isFullPreviewOpen}
                onClose={() => { setIsFullPreviewOpen(false); setFullPreviewDoc(null); }}
                document={fullPreviewDoc}
                isPublic={isPublicOnly}
                onDownload={handleDownload}
            />
            <LogsModal
                isOpen={isLogsOpen}
                onClose={() => {
                    setIsLogsOpen(false);
                    setLogsError('');
                }}
                document={selectedDoc}
                logs={logsData}
                isLoading={isLogsLoading}
                error={logsError}
                onRetry={() => handleOpenLogs(selectedDoc)}
            />
        </div>
    );
}
