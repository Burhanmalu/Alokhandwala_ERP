'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Menu,
  LogOut
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
    <header className="h-16 bg-[#fdfbf7] border-b border-[#ede4d5] px-3 sm:px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs gap-2 shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 max-w-xl">
        {onMenuClick && (
          <button 
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-lg hover:bg-[#f4ece0] text-[#5c3c26] min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 active:scale-95 transition"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="md:hidden flex items-center shrink-0">
          <img src="/logo.png" alt="Alokhandwala" className="h-6 sm:h-7 w-auto object-contain" />
        </div>

        {/* Global Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#a9927d] absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search projects, customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 sm:pl-9 pr-3 py-1.5 text-xs bg-[#f8f4ec] border border-[#e6dac7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8c5e39]/30 focus:border-[#8c5e39] text-[#24160c] placeholder:text-[#a9927d] transition truncate"
          />
        </form>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* User Avatar & Logout */}
        <div className="flex items-center gap-1.5 pl-1.5 sm:pl-2">
          <div 
            title={`${currentUser.fullName} (${currentUser.role.replace('_', ' ')})`}
            className="w-8 h-8 rounded-full bg-[#2f1d13] text-[#fdf8f4] flex items-center justify-center font-bold text-xs shadow-inner border border-[#6b472e]/50 shrink-0"
          >
            {currentUser.fullName.split(' ')[0][0]}
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition min-w-[36px] min-h-[36px] flex items-center justify-center"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
