import { Link, Outlet } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../ui/Button";
import { FolderClosed, Moon, Sun, ArrowRight } from "lucide-react";

export function PublicLayout() {
  const { isDarkMode, toggleTheme } = useTheme();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 font-sans transition-colors duration-300">
      <header className="sticky top-0 z-50 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md">
              <FolderClosed className="w-4 h-4" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">DMR <span className="text-xs font-semibold uppercase tracking-widest text-blue-500 ml-1">Public</span></span>
          </Link>

          <div className="flex items-center gap-4">
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
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 hidden sm:block"></div>
            {isAuthenticated ? (
              <Link to="/dashboard">
                <Button size="sm" variant="secondary" className="hidden sm:flex">
                  Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            ) : (
              <Link to="/login">
                <Button size="sm">Sign In</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <Outlet />
      </main>

      <footer className="py-8 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800 mt-auto bg-white dark:bg-gray-900 transition-colors">
        <div className="max-w-7xl mx-auto px-6">
          <p>© {new Date().getFullYear()} Document Management Repository. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
