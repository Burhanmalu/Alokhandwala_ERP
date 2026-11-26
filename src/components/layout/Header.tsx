'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Menu, 
  LogOut, 
  X,
  Bell
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const { currentUser, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const loadUnread = () => {
      fetch('/api/notifications')
        .then((r) => r.json())
        .then((json) => {
          if (json.success) {
            setUnreadCount(
              typeof json.unreadCount === 'number'
                ? json.unreadCount
                : (json.data || []).filter((n: any) => !n.isRead).length
            );
          }
        })
        .catch(() => {});
    };
    loadUnread();
    const timer = setInterval(loadUnread, 60_000);
    window.addEventListener('notifications-updated', loadUnread);
    return () => {
      clearInterval(timer);
      window.removeEventListener('notifications-updated', loadUnread);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/projects?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <header className="h-14 sm:h-16 bg-white border-b border-[#e5dac8] px-3.5 sm:px-5 lg:px-7 flex items-center justify-between sticky top-0 z-30 shadow-2xs gap-3 shrink-0">
      <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 max-w-2xl">
        {onMenuClick && (
          <button 
            onClick={onMenuClick}
            className="lg:hidden p-1.5 rounded-md hover:bg-[#f8f4ec] text-[#4d301c] transition cursor-pointer shrink-0"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <Link href="/" className="lg:hidden flex items-center gap-2 shrink-0 hover:opacity-90 transition">
          <div className="bg-[#120b06] px-2.5 py-1 rounded-md flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="ALOKHANDWALA" className="h-6 w-auto max-w-[110px] object-contain" />
          </div>
        </Link>

        {/* Global Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[120px] max-w-xl">
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#9c826e] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search projects, customers, sites..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 sm:pl-10 pr-7 py-1.5 sm:py-2 text-xs sm:text-sm bg-[#faf6ee]/70 border border-[#d8c8b4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8c5e39]/20 focus:border-[#8c5e39] focus:bg-white text-[#24160c] placeholder:text-[#9c826e] transition truncate"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </form>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {currentUser.role === 'ADMIN' && (
          <Link
            href="/notifications"
            title="Notification Center"
            className="relative p-2 rounded-lg text-[#4d301c] hover:bg-[#faf6ee] border border-transparent hover:border-[#e5dac8] transition shrink-0"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#24160c] text-[#c79e7c] text-[9px] font-mono font-bold flex items-center justify-center border border-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        )}

        {/* User Pill */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#24150c] text-[#fdf8f4] flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 border border-[#4d301c]">
            {currentUser.fullName ? currentUser.fullName[0] : 'U'}
          </div>
          <div className="hidden sm:block text-left min-w-0 max-w-[120px] md:max-w-[160px]">
            <div className="text-xs sm:text-sm font-semibold text-[#24160c] truncate leading-tight">
              {currentUser.fullName}
            </div>
            <div className="text-[10px] text-[#7d6553] font-mono uppercase tracking-tight leading-tight mt-0.5 truncate">
              {currentUser.role.replace('_', ' ')}
            </div>
          </div>

          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer shrink-0"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
