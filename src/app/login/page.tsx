'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Boxes,
  Truck,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectUrl = searchParams.get('redirect') || '/';

  // If already authenticated, redirect to destination
  useEffect(() => {
    if (isAuthenticated) {
      router.replace(redirectUrl);
    }
  }, [isAuthenticated, redirectUrl, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!email.trim()) {
      setError('Please enter your corporate email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.success) {
        router.replace(redirectUrl);
      } else {
        setError(res.error || 'Authentication failed. Please verify your credentials.');
      }
    } catch {
      setError('An unexpected error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full box-border bg-[#100905] flex items-center justify-center p-4 sm:p-6 relative font-sans">
      {/* Clipped Ambient Background Layer (prevents viewport overflow) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #8c5e39 1px, transparent 0)',
            backgroundSize: '36px 36px',
          }}
        />
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-[#8c5e39]/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-[#59371d]/25 rounded-full blur-3xl" />
      </div>

      {/* Main 40:60 Split Container */}
      <div className="relative z-10 w-full max-w-[1000px] lg:h-[580px] bg-[#1c120c] border border-[#2f1f15] rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-5">
        {/* Left Panel (40%): Brand & Features */}
        <div className="hidden lg:flex lg:col-span-2 bg-gradient-to-b from-[#140c07] via-[#1a0f09] to-[#120a05] p-7 flex-col justify-between border-r border-[#2f1f15]">
          <div className="space-y-6">
            {/* Brand Logo */}
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="ALOKHANDWALA"
                className="h-14 w-auto max-w-[210px] object-contain"
              />
            </div>

            {/* Main Heading */}
            <div>
              <h2 className="text-xl font-bold text-[#fdf8f4] leading-snug tracking-tight">
                Operations &amp; Asset Lifecycle
              </h2>
            </div>

            {/* Compact Feature Cards */}
            <div className="space-y-2.5">
              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-[#24150c]/75 border border-[#3d2617]/80">
                <Boxes className="w-4 h-4 text-[#c79e7c] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-[#f5ebe0]">Real-Time Stock Auditing</div>
                  <div className="text-[11px] text-[#a58972] leading-snug mt-0.5">
                    37,000+ warehouse units tracked across active project sites.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-[#24150c]/75 border border-[#3d2617]/80">
                <Truck className="w-4 h-4 text-[#c79e7c] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-[#f5ebe0]">Site Shift &amp; Buffer Governance</div>
                  <div className="text-[11px] text-[#a58972] leading-snug mt-0.5">
                    Zero asset leakage with documented supervisor digital sign-offs.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-lg bg-[#24150c]/75 border border-[#3d2617]/80">
                <ShieldCheck className="w-4 h-4 text-[#c79e7c] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-[#f5ebe0]">Role-Based Security (RBAC)</div>
                  <div className="text-[11px] text-[#a58972] leading-snug mt-0.5">
                    Separated approval authority for PMs, Supervisors &amp; Finance.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Left Footer System Status */}
          <div className="pt-4 border-t border-[#2d1b11] flex items-center justify-between text-[11px] text-[#8e6e54]">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Live ERP Core v1.0
            </span>
            <span>Secured Session</span>
          </div>
        </div>

        {/* Right Panel (60%): Login Form */}
        <div className="lg:col-span-3 bg-[#fdfcf9] p-6 sm:p-8 lg:px-10 lg:py-7 flex flex-col justify-between">
          {/* Compact Mobile/Tablet Brand Header */}
          <div className="flex lg:hidden items-center justify-between pb-4 mb-4 border-b border-[#efe7dc]">
            <div className="bg-[#140c07] px-3 py-1.5 rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="ALOKHANDWALA" className="h-7 w-auto max-w-[130px] object-contain" />
            </div>
            <span className="text-[11px] font-semibold text-[#6e4627]">ERP Portal</span>
          </div>

          {/* Centered Form Content */}
          <div className="flex-1 flex flex-col justify-center w-full max-w-md mx-auto py-2">
            {/* Header */}
            <div className="mb-5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f3ebe1] border border-[#dfd0be] text-[11px] font-semibold text-[#6e4627] mb-2.5">
                <Sparkles className="w-3.5 h-3.5 text-[#8c5e39]" />
                <span>Corporate Access Gateway</span>
              </div>
              <h1 className="text-2xl font-bold text-[#24160c] tracking-tight">
                Sign In
              </h1>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <div className="flex-1">{error}</div>
              </div>
            )}

            {/* Credentials Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#3d2617] mb-1.5" htmlFor="email-input">
                  Corporate Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8c7360] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. admin@alokhandwala.com"
                    required
                    disabled={loading}
                    className="w-full h-[46px] pl-10 pr-4 text-xs text-[#24160c] bg-white border border-[#d6c7b2] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c5e39]/25 focus:border-[#8c5e39] transition shadow-2xs disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#3d2617] mb-1.5" htmlFor="password-input">
                  Account Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8c7360] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your security password"
                    required
                    disabled={loading}
                    className="w-full h-[46px] pl-10 pr-10 text-xs text-[#24160c] bg-white border border-[#d6c7b2] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c5e39]/25 focus:border-[#8c5e39] transition shadow-2xs disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8c7360] hover:text-[#24160c] transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Session */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#574830] select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={loading}
                    className="rounded border-[#d6c7b2] text-[#8c5e39] focus:ring-[#8c5e39] accent-[#8c5e39] w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Keep session active on this device</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                id="login-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full h-[45px] px-4 bg-gradient-to-r from-[#8c5e39] to-[#684123] hover:from-[#7a5130] hover:to-[#57351b] focus:outline-none focus:ring-2 focus:ring-[#8c5e39]/40 text-white rounded-xl text-xs font-bold tracking-wide shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="pt-3.5 border-t border-[#efe7dc] text-center text-[11px] text-[#8c7360]">
            ALOKHANDWALA • Secured Internal Portal
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#100905] flex items-center justify-center text-[#debfa6]">
          <div className="w-8 h-8 border-2 border-[#8c5e39]/30 border-t-[#8c5e39] rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
