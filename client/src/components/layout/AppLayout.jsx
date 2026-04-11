import { Link, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { Button } from "../ui/Button";
import {
  FolderClosed,
  Search,
  Moon,
  Sun,
  LogOut,
  LayoutDashboard,
  Globe,
  Lock,
  Building2,
  Settings,
  Menu,
  X,
  Users,
  FileText,
  ChevronLeft,
  Clock,
  Share2,
  Trash2,
  Edit3,
  Eye,
  Download,
  UserCheck,
  Vault
} from "lucide-react";
import { useState, useEffect } from "react";
import axios from "axios";
import API_URL from "../../config/api";
import { cn } from "../../utils/cn";
import { motion, AnimatePresence } from "framer-motion";

import ShareModal from "../ShareModal";
import AdvancedSearchPopover from "../AdvancedSearchPopover";

const SIDEBAR_LINKS = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Recently Accessed", href: "/workspace/recent", icon: Clock },
  { name: "Public Space", href: "/workspace/public", icon: Globe },
  { name: "Private Space", href: "/workspace/private", icon: Lock },
  { name: "Shared with Me", href: "/workspace/shared", icon: Users },
  { name: "Shared with Others", href: "/workspace/shared-to-others", icon: UserCheck },
  { name: "Organizations", href: "/workspace/organization", icon: Building2 },
  { name: "Vault Browser", href: "/vaults", icon: Vault },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Global Search State
  const [searchParams] = useSearchParams();
  const [globalSearch, setGlobalSearch] = useState(searchParams.get('q') || "");
  const [previewDoc, setPreviewDoc] = useState(null);
  const [searchScope, setSearchScope] = useState('all');
  const [orgs, setOrgs] = useState([]);

  // Sync Global search text with URL on navigation
  useEffect(() => {
    setGlobalSearch(searchParams.get('q') || "");
  }, [searchParams]);

  // Sync Search Scope with current route initially
  useEffect(() => {
    const path = location.pathname;
    if (path === '/workspace/public') setSearchScope('public');
    else if (path === '/workspace/private') setSearchScope('private');
    else if (path === '/workspace/shared') setSearchScope('shared');
    else if (path === '/workspace/shared-to-others') setSearchScope('shared-to-others');
    else if (path === '/workspace/organization') {
      const orgId = searchParams.get('organizationId');
      if (orgId) setSearchScope(`org_${orgId}`);
      else setSearchScope('organization');
    } else {
      setSearchScope('all');
    }
  }, [location.pathname, searchParams.get('organizationId')]); // Update if URL or Org Selection changes

  // Fetch organizations for the dropdown
  useEffect(() => {
    const fetchOrgs = async () => {
      if (!user) return;
      try {
        const token = localStorage.getItem('dmr_token');
        const res = await axios.get(`${API_URL}/api/orgs`, { headers: { Authorization: `Bearer ${token}` } });
        setOrgs(res.data.organizations || []);
      } catch (err) {
        console.error("Failed to fetch organizations context:", err);
      }
    };
    fetchOrgs();
  }, [user]);

  // Navigate helper for search
  const executeSearch = (query, overrideParams) => {
    const np = overrideParams || new URLSearchParams(searchParams);
    
    // If a specific query is given, apply it, otherwise don't blindly overwrite
    if (query !== undefined) {
      if (query.trim()) np.set('q', query.trim());
      else np.delete('q');
    }
    
    np.set('page', '1');

    let basePath = '/search';
    if (searchScope === 'public') basePath = '/workspace/public';
    else if (searchScope === 'private') basePath = '/workspace/private';
    else if (searchScope === 'shared') basePath = '/workspace/shared';
    else if (searchScope === 'shared-to-others') basePath = '/workspace/shared-to-others';
    else if (searchScope.startsWith('org_')) {
      basePath = '/workspace/organization';
      np.set('organizationId', searchScope.replace('org_', ''));
    } else {
      // For global search ('all'), we must remove organizationId so we don't accidentally get scoped.
      np.delete('organizationId');
    }

    navigate(`${basePath}?${np.toString()}`);
  };

  const formatSizePreview = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDownloadPreview = async (doc) => {
    try {
      const token = localStorage.getItem('dmr_token');
      const headers = { Authorization: `Bearer ${token}` };
      const url = doc.space === 'public'
        ? `${API_URL}/api/public/documents/${doc._id}/download`
        : `${API_URL}/api/documents/${doc._id}/download`;
      const res = await axios.get(url, { headers });
      window.open(res.data.downloadUrl, '_blank');
    } catch (err) {
      console.error(err);
      alert('Download failed.');
    }
  };

  const getAccessLevel = (doc) => {
    if (!user) return 'none';
    if (doc.owner && doc.owner._id === user.id) return 'owner';
    if (doc.uploadedBy && doc.uploadedBy._id === user.id) return 'owner';
    if (doc.organization?.members) {
      const member = doc.organization.members.find(m => m.user === user.id);
      if (member) return member.role;
    }
    if (doc.sharedWith && Array.isArray(doc.sharedWith)) {
      const share = doc.sharedWith.find(s => s.user === user.id);
      if (share) return share.permission;
    }
    return doc.space === 'public' ? 'viewer' : 'none';
  };

  const canUserDelete = (doc) => {
    const role = getAccessLevel(doc);
    return role === 'owner' || role === 'collaborator';
  };

  const handleDeletePreview = async (docId) => {
    if (!confirm('Permanently delete this document?')) return;
    try {
      const token = localStorage.getItem('dmr_token');
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${API_URL}/api/documents/${docId}`, { headers });
      setPreviewDoc(null);
      // Removed from global results
      setGlobalResults(prev => prev.filter(d => d._id !== docId));
    } catch (err) {
      alert('Delete failed.');
    }
  };

  const [isShareOpen, setIsShareOpen] = useState(false);

  // Escape key to close preview modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isShareOpen) { setIsShareOpen(false); return; }
        if (previewDoc) { setPreviewDoc(null); return; }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [previewDoc, isShareOpen]);



  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950 font-sans transition-colors duration-300">

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ease-in-out flex flex-col overflow-hidden",
        isSidebarOpen ? "translate-x-0 w-72" : "-translate-x-full lg:translate-x-0",
        isSidebarCollapsed ? "lg:w-20" : "lg:w-72"
      )}>
        {/* Sidebar Header */}
        <div className="h-16 flex flex-shrink-0 items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800">
          <Link to="/dashboard" className="flex items-center gap-3 min-w-max">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md flex-shrink-0">
              <FolderClosed className="w-4 h-4" />
            </div>
            <span className={cn("text-xl font-bold tracking-tight text-gray-900 dark:text-white transition-opacity duration-300", isSidebarCollapsed ? "lg:opacity-0 lg:hidden" : "opacity-100")}>
              DMR
            </span>
          </Link>
          <button className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex-shrink-0" onClick={() => setIsSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto overflow-x-hidden">
          {SIDEBAR_LINKS.map((link) => {
            const isActive = link.href === '/vaults'
              ? location.pathname.startsWith('/vaults')
              : location.pathname === link.href;
            return (
              <Link
                key={link.name}
                to={link.href}
                title={isSidebarCollapsed ? link.name : undefined}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap overflow-hidden",
                  isActive
                    ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-gray-200",
                  isSidebarCollapsed && "lg:px-0 lg:justify-center"
                )}
              >
                <link.icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-400")} />
                <span className={cn("transition-opacity duration-300", isSidebarCollapsed ? "lg:opacity-0 lg:w-0" : "opacity-100")}>{link.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 overflow-hidden">
          <Link
            to="/profile"
            title={isSidebarCollapsed ? "Settings" : undefined}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap",
              isSidebarCollapsed && "lg:px-0 lg:justify-center"
            )}
          >
            <Settings className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <span className={cn("transition-opacity duration-300", isSidebarCollapsed ? "lg:opacity-0 lg:w-0" : "opacity-100")}>Settings</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">

        {/* Top Navbar */}
        <header className="h-16 flex-shrink-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-30 transition-all duration-300">
          <div className="flex items-center gap-4 flex-1">
            {/* Mobile Menu Toggle */}
            <button className="lg:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            {/* Desktop Sidebar Toggle */}
            <button
              className="hidden lg:flex p-2 -ml-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isSidebarCollapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>

            {/* Global Search */}
            <div className="hidden md:flex max-w-2xl w-full relative group z-50">
              <div className="flex bg-gray-50/80 hover:bg-white focus-within:bg-white dark:bg-gray-800/60 dark:hover:bg-gray-800 dark:focus-within:bg-gray-800 border border-transparent hover:border-gray-200 focus-within:border-blue-500 dark:border-transparent dark:hover:border-gray-700 dark:focus-within:border-blue-500 rounded-xl transition-all shadow-sm w-full focus-within:ring-4 focus-within:ring-blue-500/10">
                
                {/* Context Dropdown */}
                <select
                  value={searchScope}
                  onChange={(e) => setSearchScope(e.target.value)}
                  className="bg-transparent border-none text-xs font-semibold text-gray-500 dark:text-gray-400 focus:ring-0 cursor-pointer pl-3 pr-8 py-2.5 outline-none rounded-l-xl hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <option className="bg-gray-50 dark:bg-gray-950" value="all">All Documents</option>
                  <option className="bg-gray-50 dark:bg-gray-950" value="public">Public Space</option>
                  <option className="bg-gray-50 dark:bg-gray-950" value="private">Private Space</option>
                  <option className="bg-gray-50 dark:bg-gray-950" value="shared">Shared with Me</option>
                  <option className="bg-gray-50 dark:bg-gray-950" value="shared-to-others">Shared with Others</option>
                  {orgs.map(org => (
                    <option className="bg-gray-50 dark:bg-gray-950" key={org._id} value={`org_${org._id}`}>Org: {org.name}</option>
                  ))}
                </select>

                <div className="w-px bg-gray-300 dark:bg-gray-600 my-2"></div>

                {/* Input Field */}
                <div className="relative flex-1">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-gray-400 group-focus-within:text-blue-500 transition-colors pointer-events-none">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        executeSearch(globalSearch);
                      }
                    }}
                    placeholder={`Search within ${searchScope === 'all' ? 'all spaces' : 'selected space'}...`}
                    className="w-full bg-transparent border-none pl-9 pr-20 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-0 font-medium placeholder:text-gray-400 outline-none"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-20">
                    {globalSearch && (
                      <button
                        type="button"
                        onClick={() => {
                            setGlobalSearch('');
                            executeSearch('');
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {/* Advanced Filters inside search bar */}
                    {searchScope !== 'shared-to-others' && (
                      <AdvancedSearchPopover activeSpace={searchScope} isPublicOnly={searchScope === 'public'} applySearchCallback={(params) => executeSearch(globalSearch, params)} />
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <button
              onClick={toggleTheme}
              className="relative flex h-8 w-16 items-center rounded-full bg-gray-200 dark:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 shadow-inner group"
              aria-label="Toggle Theme"
            >
              <div className="absolute inset-0 flex w-full items-center justify-between px-2 text-gray-400 dark:text-gray-500 pointer-events-none">
                <Sun className="h-4 w-4" />
                <Moon className="h-4 w-4" />
              </div>
              <span
                className={`absolute left-1 top-1 flex h-6 w-6 transform items-center justify-center rounded-full bg-white dark:bg-gray-950 shadow-sm transition-transform duration-300 ease-in-out ${isDarkMode ? "translate-x-8" : "translate-x-0"
                  }`}
              >
                {isDarkMode ? (
                  <Moon className="h-3.5 w-3.5 text-blue-400" />
                ) : (
                  <Sun className="h-3.5 w-3.5 text-amber-500" />
                )}
              </span>
            </button>

            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-9 h-9 rounded-full text-white text-sm font-bold flex items-center justify-center shadow-sm hover:ring-2 hover:ring-offset-2 hover:ring-blue-500 dark:hover:ring-offset-gray-950 transition-all"
                style={{ backgroundColor: user?.avatarColor || '#3b82f6' }}
              >
                {initials}
              </button>

              <AnimatePresence>
                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 z-50 overflow-hidden"
                    >
                      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user?.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{user?.email}</p>
                      </div>
                      <div className="p-2">
                        <Link to="/profile" className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => setShowProfileMenu(false)}>
                          <Settings className="w-4 h-4" /> Profile Settings
                        </Link>
                        <button onClick={() => { logout(); setShowProfileMenu(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-left mt-1">
                          <LogOut className="w-4 h-4" /> Sign out
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Global Document Preview Modal */}
      <AnimatePresence>
        {previewDoc && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPreviewDoc(null)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm cursor-pointer"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-start sm:items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-800/20">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-2 sm:truncate max-w-md">{previewDoc.fileName}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-200/60 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        {previewDoc.space} Space
                      </span>
                      {previewDoc.organization && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                          {previewDoc.organization.name}
                        </span>
                      )}
                      {(() => { const role = getAccessLevel(previewDoc); return (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-700 dark:text-gray-300 text-xs font-bold uppercase tracking-wider">
                          {role === 'owner' || role === 'collaborator' ? <Edit3 className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          {role}
                        </div>
                      ); })()}
                    </div>
                  </div>
                </div>
                <button onClick={() => setPreviewDoc(null)} className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-xl hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ml-4 sm:ml-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Info Column */}
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Description</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium">{previewDoc.description || 'No description provided.'}</p>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Metadata Tags</p>
                          {previewDoc.isAITagged && (
                              <span className="text-[10px] font-bold text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 px-1.5 py-0.5 rounded uppercase tracking-wider">AI Tagged</span>
                          )}
                      </div>
                      {(previewDoc.tags?.length > 0) ? (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                              {previewDoc.tags.map((t, i) => (
                                  <span key={i} className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold uppercase tracking-wider group">
                                      {t}
                                  </span>
                              ))}
                          </div>
                      ) : (
                          <p className="text-xs text-gray-500 italic mb-3">No tags added yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Metadata Column */}
                  <div className="bg-gray-50/50 dark:bg-gray-800/40 rounded-3xl p-6 border border-gray-100 dark:border-gray-800/60 space-y-4">
                    {[
                      { label: 'Uploader', value: previewDoc.uploadedBy?.name || 'Unknown' },
                      { label: 'Upload Date', value: new Date(previewDoc.uploadDate).toLocaleDateString() },
                      { label: 'File Size', value: formatSizePreview(previewDoc.fileSize) },
                      { label: 'File Type', value: previewDoc.mimeType },
                    ].map(item => (
                      <div key={item.label} className="flex justify-between items-center py-1">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{item.label}</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[140px]">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-800/20 flex flex-wrap justify-end gap-3 sm:gap-4">
                <Button className="flex-1 sm:flex-none border-none shadow-lg shadow-blue-500/20" onClick={() => handleDownloadPreview(previewDoc)}>
                  <Download className="w-4 h-4 mr-2" /> Download
                </Button>

                {(getAccessLevel(previewDoc) === 'owner' || getAccessLevel(previewDoc) === 'collaborator') && previewDoc.space !== 'public' && (
                  <Button
                    className="flex-1 sm:flex-none bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 shadow-sm border border-blue-200 dark:border-blue-800/50 transition-colors"
                    onClick={() => setIsShareOpen(true)}
                  >
                    <Share2 className="w-4 h-4 mr-2" /> Share
                  </Button>
                )}

                {canUserDelete(previewDoc) && previewDoc.space !== 'public' && (
                  <Button variant="danger" className="flex-1 sm:flex-none sm:mr-auto shadow-sm" onClick={() => handleDeletePreview(previewDoc._id)}>
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </Button>
                )}

                <Button className="flex-1 sm:flex-none bg-gray-200 text-gray-800 hover:bg-gray-300 border-none shadow-none dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700" onClick={() => { setPreviewDoc(null); navigate(`/workspace/${previewDoc.space}`); }}>
                  Go to Workspace
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Modal for Global Search */}
      {previewDoc && isShareOpen && (
        <ShareModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          document={previewDoc}
          onUpdate={(updatedDoc) => {
            setPreviewDoc(updatedDoc);
            setGlobalResults(docs => docs.map(d => d._id === updatedDoc._id ? updatedDoc : d));
          }}
        />
      )}
    </div>
  );
}
