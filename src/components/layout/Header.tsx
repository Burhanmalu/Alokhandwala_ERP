'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Menu,
  LogOut,
  Building2,
  X
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const { currentUser, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/projects?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <header className="h-14 bg-white border-b border-[#e5dac8] px-3 sm:px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs gap-3 shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 max-w-xl">
        {onMenuClick && (
          <button 
            onClick={onMenuClick}
            className="md:hidden p-1.5 rounded-md hover:bg-[#f8f4ec] text-[#4d301c] transition cursor-pointer"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="md:hidden flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded bg-[#24150c] flex items-center justify-center p-0.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon-accent.png" alt="Alokhandwala" className="h-full w-full object-contain" />
          </div>
          <span className="font-bold text-xs uppercase tracking-wider text-[#24160c]">ALOKHANDWALA</span>
        </div>

        {/* Global Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 text-[#9c826e] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search projects, customers, sites..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#faf6ee]/70 border border-[#d8c8b4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#8c5e39] focus:border-[#8c5e39] focus:bg-white text-[#24160c] placeholder:text-[#9c826e] transition truncate"
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
        {/* Branch / Facility Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#fbf9f5] border border-[#e8decb] text-[11px] text-[#574830] font-medium">
          <Building2 className="w-3 h-3 text-[#ab7c57]" />
          <span>Taloja Central Yard</span>
        </div>

        {/* User Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#ebdcc9]">
          <div className="w-7 h-7 rounded-md bg-[#24150c] text-[#fdf8f4] flex items-center justify-center font-bold text-xs shrink-0 border border-[#4d301c]">
            {currentUser.fullName ? currentUser.fullName[0] : 'U'}
          </div>
          <div className="hidden sm:block text-left min-w-0">
            <div className="text-xs font-semibold text-[#24160c] truncate leading-tight">
              {currentUser.fullName}
            </div>
            <div className="text-[10px] text-[#7d6553] font-mono uppercase tracking-tight leading-tight">
              {currentUser.role.replace('_', ' ')}
            </div>
          </div>

          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
