import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
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
  Users
} from "lucide-react";
import { useState, useEffect } from "react";
import axios from "axios";
import API_URL from "../../config/api";
import { cn } from "../../utils/cn";
import { motion, AnimatePresence } from "framer-motion";

const SIDEBAR_LINKS = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Public Space", href: "/workspace/public", icon: Globe },
  { name: "Private Space", href: "/workspace/private", icon: Lock },
  { name: "Shared with Me", href: "/workspace/shared", icon: Users },
  { name: "Organizations", href: "/workspace/organization", icon: Building2 },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Global Search State
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalResults, setGlobalResults] = useState([]);
  const [showGlobalResults, setShowGlobalResults] = useState(false);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);

  useEffect(() => {
    if (!globalSearch.trim()) {
      setGlobalResults([]);
      return;
    }

    setGlobalSearchLoading(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const token = localStorage.getItem('dmr_token');
        const headers = { Authorization: `Bearer ${token}` };
        // Use the new global search endpoint
        const url = `${API_URL}/api/documents/search?q=${encodeURIComponent(globalSearch)}`;
        const res = await axios.get(url, { headers });
        setGlobalResults(res.data.documents || []);
      } catch (err) {
        console.error("Global search failed:", err);
      } finally {
        setGlobalSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [globalSearch]);

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
        "fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-300 ease-in-out lg:transform-none flex flex-col",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
              <FolderClosed className="w-4 h-4" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">DMR</span>
          </Link>
          <button className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" onClick={() => setIsSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {SIDEBAR_LINKS.map((link) => {
            const isActive = location.pathname.startsWith(link.href) && (link.href !== '/dashboard' || location.pathname === '/dashboard');
            return (
              <Link
                key={link.name}
                to={link.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all",
                  isActive
                    ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-gray-200"
                )}
              >
                <link.icon className={cn("w-5 h-5", isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-400")} />
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <Link
            to="/profile"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Settings className="w-5 h-5 text-gray-400" />
            Settings
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">

        {/* Top Navbar */}
        <header className="h-16 flex-shrink-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-30">
          <div className="flex items-center gap-4 flex-1">
            <button className="lg:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            {/* Global Search */}
            <div className="hidden sm:flex max-w-md w-full relative group z-50">
              <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${globalSearchLoading ? 'text-blue-500 animate-pulse' : 'text-gray-400'} group-focus-within:text-blue-500 transition-colors z-10`} />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && globalSearch.trim()) {
                    e.preventDefault();
                    const query = globalSearch.trim();
                    setShowGlobalResults(false);
                    setGlobalSearch('');
                    navigate(`/search?q=${encodeURIComponent(query)}`);
                  }
                }}
                onFocus={() => setShowGlobalResults(true)}
                onBlur={() => setTimeout(() => { setShowGlobalResults(false); setGlobalSearch(''); }, 200)}
                placeholder="Search all documents..."
                className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-full pl-10 pr-10 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-gray-500 relative z-10"
              />
              {globalSearch && (
                <button
                  type="button"
                  onClick={() => { setGlobalSearch(''); setShowGlobalResults(false); }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 z-20 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {showGlobalResults && (globalSearch || globalResults.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="absolute top-12 left-0 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden z-20"
                  >
                    {globalSearchLoading ? (
                      <div className="p-4 text-sm text-gray-500 text-center flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Searching...
                      </div>
                    ) : globalResults.length === 0 && globalSearch ? (
                      <div className="p-4 text-sm text-gray-500 text-center">No results found for "{globalSearch}"</div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto py-2">
                        {globalResults.map(doc => (
                          <div key={doc._id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer flex items-center justify-between group transition-colors" onClick={() => { setShowGlobalResults(false); navigate(`/workspace/${doc.space}`); }}>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-blue-50 dark:bg-blue-900/10 text-blue-500 flex items-center justify-center">📄</div>
                              <div>
                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{doc.fileName}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-200/60 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                      {doc.space}
                                  </span>
                                </p>
                              </div>
                            </div>
                            {doc.space === 'public' && doc.metadata?.typeTags?.length > 0 && <span className="text-[10px] uppercase font-bold text-gray-400 group-hover:text-blue-500">{doc.metadata.typeTags[0]}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
              )}
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
    </div>
  );
}
