'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/lib/auth/auth-context';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // If verifying session or unauthenticated, show corporate loading state to prevent UI flash
  if (isLoading || !isAuthenticated) {
    return (
      <div className="h-full h-[100dvh] w-full bg-[#140c07] flex flex-col items-center justify-center text-slate-300 p-6 overflow-hidden">
        <div className="p-4 rounded-2xl bg-[#24150c] flex items-center justify-center shadow-xl shadow-black/60 border border-[#59371d]/60 mb-4 animate-pulse">
          <img 
            src="/logo-white.png" 
            alt="ALOKHANDWALA" 
            className="h-14 w-auto object-contain filter drop-shadow"
          />
        </div>
        <div className="text-xs font-semibold tracking-widest text-[#debfa6] uppercase">
          ALOKHANDWALA
        </div>
        <div className="text-xs text-[#a9927d] mt-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#c79e7c] animate-ping" />
          Verifying security session...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full h-[100dvh] w-full overflow-hidden bg-slate-50 text-slate-800">
      {/* Desktop Sidebar Container */}
      <aside className="hidden md:flex md:w-64 md:shrink-0 h-full min-h-0 flex-col z-20">
        <Sidebar />
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close mobile navigation overlay"
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full min-h-0 bg-[#1c120c] shadow-2xl flex flex-col animate-in slide-in-from-left duration-250 overflow-hidden">
            <Sidebar onClose={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area Container */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden">
        <Header onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-y-contain p-3 sm:p-4 md:p-6 lg:p-8 main-scrollbar">
          <div className="max-w-7xl w-full mx-auto min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
