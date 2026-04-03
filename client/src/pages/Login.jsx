import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Mail, Lock, LogIn, Eye, EyeOff } from 'lucide-react';

export function Login() {
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
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="backdrop-blur-2xl bg-white/40 dark:bg-gray-900/40 border border-white/60 dark:border-white/10 shadow-[0_8px_32px_0_rgba(31,38,135,0.1)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] p-8 sm:p-10 rounded-3xl w-full relative z-10">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Welcome back</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Sign in to your DMR account to manage your files.</p>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-semibold flex items-center gap-2">
           <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
           {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input 
          label="Email Address"
          type="email" 
          placeholder="you@company.com" 
          leftIcon={<Mail className="w-5 h-5" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        
        <div className="relative">
          <Input 
            label="Password"
            type={showPassword ? "text" : "password"} 
            placeholder="••••••••" 
            leftIcon={<Lock className="w-5 h-5" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button 
            type="button" 
            className="absolute right-4 top-[38px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        <div className="pt-2">
          <Button type="submit" className="w-full font-bold text-base" size="lg" isLoading={isLoading} leftIcon={!isLoading && <LogIn className="w-5 h-5" />}>
            Sign In
          </Button>
        </div>
      </form>
      
      <div className="mt-8 text-center text-sm font-medium text-gray-600 dark:text-gray-400">
        Don't have an account?{' '}
        <Link to="/signup" className="text-blue-600 dark:text-blue-400 hover:underline font-bold transition-all">
          Create an account
        </Link>
      </div>
    </div>
  );
}
