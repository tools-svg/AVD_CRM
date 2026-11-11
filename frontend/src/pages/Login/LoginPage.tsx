import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User as UserIcon, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { toast } from '../../context/NotificationContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please provide both username and password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.login(username, password);
      login(res.access_token, res.user, (res.user as any).session_id);
      toast.success('Sign In Successful', `Welcome back, ${res.user.full_name}!`);
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
      toast.error('Sign In Failed', err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EBE5E5] flex flex-col justify-center items-center p-4">
      {/* Login Card */}
      <div className="bg-[#FFFFFF] w-full max-w-md rounded-[18px] border border-[#E1DCDC] shadow-lg p-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Main Company Logo at Top Centre */}
        <div className="flex justify-center mb-6">
          <img
            src="/logos/1.png"
            alt="AVD Group"
            className="h-14 w-auto object-contain rounded-[4px]"
          />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-[#333333]">Sign In</h1>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[#F5DEDE] text-[#B65F65] text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#888888] uppercase mb-1">
              Username
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-[#888888] absolute left-3 top-3" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-xl pl-9 pr-3 py-2 text-xs text-[#333333] focus:outline-none focus:border-[#0A0A0A]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#888888] uppercase mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#888888] absolute left-3 top-3" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#F5F3F4] border border-[#E1DCDC] rounded-xl pl-9 pr-3 py-2 text-xs text-[#333333] focus:outline-none focus:border-[#0A0A0A]"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-[#0A0A0A] text-white text-xs font-semibold hover:bg-[#333333] transition-colors flex items-center justify-center space-x-1.5 shadow-xs disabled:opacity-50 mt-2"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};

