'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { NotificationPopupHost } from '@/components/layout/NotificationPopupHost';
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
        <div className="mb-6 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/logo.png" 
            alt="ALOKHANDWALA" 
            className="h-16 sm:h-20 w-auto max-w-[260px] object-contain drop-shadow-md"
          />
        </div>
        <div className="text-xs text-[#a9927d] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#c79e7c] animate-ping" />
          Verifying security session...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full h-[100dvh] w-full overflow-hidden bg-[#f7f4ed] text-[#24160c]">
      {/* Desktop Sidebar Container (Responsive width across desktop resolutions) */}
      <aside className="hidden lg:flex lg:w-60 xl:w-68 2xl:w-72 lg:shrink-0 h-full min-h-0 flex-col z-20">
        <Sidebar />
      </aside>

      {/* Mobile & Tablet Navigation Drawer (< 1024px) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close mobile navigation overlay"
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full min-h-0 bg-[#19100a] shadow-2xl flex flex-col animate-in slide-in-from-left duration-250 overflow-hidden">
            <Sidebar onClose={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area Container - Independently Scrollable */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden">
        <Header onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-y-contain p-3.5 sm:p-5 lg:p-6 xl:p-8 main-scrollbar">
          <div className="max-w-[1560px] w-full mx-auto min-w-0">
            {children}
          </div>
        </main>
      </div>
      <NotificationPopupHost />
    </div>
  );
}
