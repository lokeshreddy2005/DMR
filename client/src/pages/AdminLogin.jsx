import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Mail, Lock, LogIn, Eye, EyeOff, ShieldAlert } from 'lucide-react';

export function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { user } = await login(email, password);
      // Ensure only admins and superadmins can log in here
      if (user.role === 'user') {
          // Log them out immediately if they try to access the admin portal with a user account
          localStorage.removeItem('dmr_token');
          window.location.href = '/login?error=Unauthorized. Please use the standard login portal.';
          return;
      }
      
      if (user.role === 'superadmin') navigate('/superadmin/dashboard');
      else if (user.role === 'admin') navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="backdrop-blur-3xl bg-gray-900/90 border border-gray-700 shadow-2xl p-8 sm:p-10 rounded-3xl w-full relative z-10 text-white">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/50 border border-red-400">
            <ShieldAlert className="w-8 h-8 text-white" />
        </div>
      </div>

      <div className="text-center mb-8 mt-4">
        <h2 className="text-3xl font-extrabold tracking-tight text-white">Admin Portal</h2>
        <p className="text-sm text-gray-400 mt-2">Secure access for Administrators and Super Admins.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-500 text-red-200 rounded-xl text-sm font-semibold flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Admin Email</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="w-5 h-5 text-gray-500" />
                </div>
                <input
                    type="email"
                    className="block w-full pl-10 pr-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="admin@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
            </div>
        </div>

        <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Master Password</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-gray-500" />
                </div>
                <input
                    type={showPassword ? "text" : "password"}
                    className="block w-full pl-10 pr-10 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 focus:outline-none"
                    onClick={() => setShowPassword(!showPassword)}
                >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
            </div>
        </div>

        <div className="pt-4">
          <Button type="submit" variant="danger" className="w-full font-bold text-base bg-red-600 hover:bg-red-700 text-white border-none" size="lg" isLoading={isLoading} leftIcon={!isLoading && <LogIn className="w-5 h-5" />}>
            Secure Login
          </Button>
        </div>
      </form>

      <div className="mt-8 pt-6 border-t border-gray-800 text-center text-sm font-medium text-gray-400">
        Return to{' '}
        <Link to="/login" className="text-gray-300 hover:text-white hover:underline transition-all">
          Standard User Login
        </Link>
      </div>

      {/* Demo helper */}
      <div className="mt-6 p-4 bg-gray-800 border border-gray-700 rounded-xl">
        <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Test Admin Credentials</p>
        <div className="flex flex-col gap-2">
          <button 
            type="button"
            onClick={() => { setEmail('superadmin@dmr.com'); setPassword('YourSecurePassword'); }}
            className="text-left text-sm text-gray-300 hover:text-white flex justify-between group"
          >
            <span>Super Admin: <span className="font-mono bg-gray-900 px-1 py-0.5 rounded">superadmin@dmr.com</span></span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-500">Autofill</span>
          </button>
          <button 
            type="button"
            onClick={() => { setEmail('admin@dmr.com'); setPassword('password123'); }}
            className="text-left text-sm text-gray-300 hover:text-white flex justify-between group"
          >
            <span>Admin: <span className="font-mono bg-gray-900 px-1 py-0.5 rounded">admin@dmr.com</span></span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-500">Autofill</span>
          </button>
        </div>
      </div>

    </div>
  );
}
