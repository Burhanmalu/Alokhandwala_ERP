'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Building2, 
  Lock, 
  Mail, 
  ArrowRight, 
  ShieldCheck, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Boxes, 
  Truck, 
  Clock, 
  Eye, 
  EyeOff, 
  Sparkles,
  UserCheck,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
    } catch (err: any) {
      setError('An unexpected error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const roleBadgeColors: Record<string, string> = {
    ADMIN: 'bg-purple-950/80 text-purple-300 border-purple-800/60',
    SUPERVISOR: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
    WORKER: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
  };

  return (
    <div className="h-full min-h-full w-full bg-[#100905] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-y-auto font-sans main-scrollbar">
      {/* Background Ambience & Scaffold Grid Aesthetic */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #8c5e39 1px, transparent 0)`,
            backgroundSize: '36px 36px'
          }}
        />
      </div>
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#8c5e39]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#59371d]/25 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container Card */}
      <div className="relative w-full max-w-5xl bg-[#1c120c] border border-[#2f1f15] rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0 sm:min-h-[560px]">
        
        {/* Left Hero & Enterprise Showcase (Desktop Only) */}
        <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-b from-[#140c07] via-[#1a0f09] to-[#120a05] p-8 lg:p-10 flex-col justify-between border-r border-[#2f1f15] relative">
          <div className="relative z-10">
            {/* Brand Logo & Title */}
            <div className="mb-8">
              <div className="inline-block p-4 rounded-2xl bg-[#1e120a]/80 border border-[#3d2617] shadow-xl backdrop-blur-xs">
                <img 
                  src="/logo-white.png" 
                  alt="Alokhandwala" 
                  className="h-16 w-auto object-contain filter drop-shadow-md"
                />
              </div>
            </div>

            {/* Tagline */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-100 leading-tight">
                Operations & Asset Lifecycle
              </h2>
            </div>

            {/* Key Value Highlights */}
            <div className="space-y-3.5">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#24150c]/70 border border-[#3d2617]/80">
                <Boxes className="w-4 h-4 text-[#c79e7c] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">Real-Time Stock Auditing</div>
                  <div className="text-[11px] text-[#9f836c]">37,000+ warehouse units tracked across active project sites.</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#24150c]/70 border border-[#3d2617]/80">
                <Truck className="w-4 h-4 text-[#c79e7c] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">Site Shift & Buffer Governance</div>
                  <div className="text-[11px] text-[#9f836c]">Zero asset leakage with documented supervisor digital sign-offs.</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#24150c]/70 border border-[#3d2617]/80">
                <ShieldCheck className="w-4 h-4 text-[#c79e7c] mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">Role-Based Security (RBAC)</div>
                  <div className="text-[11px] text-[#9f836c]">Separated approval authority for PMs, Supervisors & Finance.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Left Footer System Pill */}
          <div className="relative z-10 mt-8 pt-6 border-t border-[#2d1b11] flex items-center justify-between text-[11px] text-[#8e6e54]">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live ERP Core v1.0
            </span>
            <span>256-Bit Encrypted</span>
          </div>
        </div>

        {/* Right Authentication Form Area */}
        <div className="lg:col-span-7 bg-[#fdfcf9] p-4 sm:p-8 lg:p-12 flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f3ebe1] border border-[#dfd0be] text-[11px] font-semibold text-[#6e4627]">
                  <Sparkles className="w-3.5 h-3.5 text-[#8c5e39]" />
                  Corporate Access Gateway
                </div>
                <img src="/logo.png" alt="Alokhandwala" className="h-7 w-auto object-contain lg:hidden" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Sign In
              </h2>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <div className="flex-1">{error}</div>
              </div>
            )}

            {/* Standard Credentials Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="email-input">
                  Corporate Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. admin@alokhandwala.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 text-xs text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c5e39]/30 focus:border-[#8c5e39] transition shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="password-input">
                  Account Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your security password"
                    required
                    className="w-full pl-10 pr-10 py-2.5 text-xs text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8c5e39]/30 focus:border-[#8c5e39] transition shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-[#8c5e39] focus:ring-[#8c5e39] accent-[#8c5e39] w-3.5 h-3.5"
                  />
                  <span>Keep session active on this device</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                id="login-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-[#8c5e39] to-[#684123] hover:from-[#7a5130] hover:to-[#57351b] text-white rounded-xl text-xs font-bold tracking-wide shadow-md shadow-[#8c5e39]/20 transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
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

          {/* Footer Security Notice */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center text-[11px] text-slate-400">
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
