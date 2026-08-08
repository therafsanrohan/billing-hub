'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { handleDatabaseError } from '@/lib/utils/db-error-handler';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot password state
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email.trim(), password }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || 'The username/email or password is incorrect.');
        setLoading(false);
        return;
      }

      router.replace(json.redirectTo || '/billing');
    } catch (err: any) {
      setError('The application could not reach the cloud server. Check your internet connection and try again.');
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');
    setForgotSuccess('');

    try {
      const supabase = createClient();
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/reset-password`
      });

      if (resetErr) {
        const handled = handleDatabaseError(resetErr, 'resetPassword');
        setError(handled.userMessage);
        setLoading(false);
        return;
      }

      setForgotSuccess('A secure password reset link has been dispatched to your email.');
      setForgotEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to request password reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f4eb] px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-[#f5f4eb] p-8 shadow-xl border border-gray-100">
        <div className="text-center flex flex-col items-center">
          <img src="/logos/SVG/corevow-logo.svg" alt="Corevow logo" className="h-12 w-auto mb-4" />
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Billing • Secure Authentication Portal
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 font-medium leading-relaxed">
            {error}
          </div>
        )}

        {forgotSuccess && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3.5 text-xs text-green-700 font-medium leading-relaxed">
            {forgotSuccess}
          </div>
        )}

        {!forgotMode ? (
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4 rounded-md">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  Email or Username
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    id="email"
                    name="email"
                    type="text"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-3 pl-10 pr-3 text-sm text-[#1E1E1E] placeholder-gray-400 focus:border-[#100e09] focus:outline-none focus:ring-1 focus:ring-[#100e09]"
                    placeholder="name@corevow.com or username"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setError(''); }}
                    className="text-xs font-semibold text-[#100e09] hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-3 pl-10 pr-10 text-sm text-[#1E1E1E] placeholder-gray-400 focus:border-[#100e09] focus:outline-none focus:ring-1 focus:ring-[#100e09]"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full justify-center rounded-lg bg-[#100e09] py-3 text-sm font-semibold text-[#f5f4eb] hover:bg-[#100e09]/90 focus:outline-none focus:ring-2 focus:ring-[#100e09] focus:ring-offset-2 disabled:opacity-50 transition duration-150 cursor-pointer"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleForgotPassword}>
            <div className="space-y-4 rounded-md">
              <div>
                <label htmlFor="forgotEmail" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  Registered Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    id="forgotEmail"
                    name="forgotEmail"
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-3 pl-10 pr-3 text-sm text-[#1E1E1E] placeholder-gray-400 focus:border-[#100e09] focus:outline-none focus:ring-1 focus:ring-[#100e09]"
                    placeholder="name@corevow.com"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full justify-center rounded-lg bg-[#100e09] py-3 text-sm font-semibold text-[#f5f4eb] hover:bg-[#100e09]/90 focus:outline-none focus:ring-2 focus:ring-[#100e09] focus:ring-offset-2 disabled:opacity-50 transition duration-150 cursor-pointer"
              >
                {loading ? 'Requesting link...' : 'Send Recovery Email'}
              </button>

              <button
                type="button"
                onClick={() => { setForgotMode(false); setError(''); setForgotSuccess(''); }}
                className="flex items-center justify-center space-x-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition cursor-pointer"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>Back to Login</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
