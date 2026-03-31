import { Link, Outlet } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { Moon, Sun, FolderClosed } from "lucide-react";
import { motion } from "framer-motion";

export function AuthLayout() {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col relative font-sans bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-20 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl delay-75" />
      </div>

      {/* Top Navbar */}
      <header className="absolute top-0 left-0 right-0 z-50 p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <FolderClosed className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">DMR</span>
        </Link>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-full bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shadow-sm border border-gray-200 dark:border-gray-800"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex items-center justify-center p-4 z-10 w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <Outlet />
        </motion.div>
      </main>

      {/* Bottom Floating Action */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center z-10">
        <Link
          to="/public"
          className="text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors bg-white/70 dark:bg-gray-900/70 backdrop-blur-md px-6 py-2.5 rounded-full border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow active:scale-95"
        >
          Browse public documents &rarr;
        </Link>
      </div>
    </div>
  );
}
