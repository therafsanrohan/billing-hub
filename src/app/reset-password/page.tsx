'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== passwordConfirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { supabase } = await import('@/lib/supabase');
      if (!supabase) throw new Error('Supabase is not configured');

      const { error: resetErr } = await supabase.auth.updateUser({
        password: password
      });

      if (resetErr) throw resetErr;

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f4eb] px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-[#f5f4eb] p-8 shadow-xl border border-gray-100">
        <div className="text-center">
          <img src="/logos/SVG/corevow-logo.svg" alt="Corevow logo" className="mx-auto h-12 w-auto mb-4" />
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Set New Password</h1>
          <p className="mt-2 text-xs text-gray-500">
            Please enter your new secure password below.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3.5 text-xs text-green-700 font-medium">
            Password updated successfully! Redirecting you to login page...
          </div>
        )}

        {!success && (
          <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
            <div className="space-y-4 rounded-md">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-3 pl-10 pr-10 text-sm text-[#1E1E1E] placeholder-gray-400 focus:border-[#100e09] focus:outline-none focus:ring-1 focus:ring-[#100e09]"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="block w-full rounded-lg border border-gray-200 bg-[#f5f4eb] py-3 pl-10 pr-10 text-sm text-[#1E1E1E] placeholder-gray-400 focus:border-[#100e09] focus:outline-none focus:ring-1 focus:ring-[#100e09]"
                    placeholder="••••••••••••"
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full justify-center rounded-lg bg-[#100e09] py-3 text-sm font-semibold text-[#f5f4eb] hover:bg-[#100e09]/90 focus:outline-none focus:ring-2 focus:ring-[#100e09] focus:ring-offset-2 disabled:opacity-50 transition duration-150 cursor-pointer"
              >
                {loading ? 'Updating Password...' : 'Reset Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
