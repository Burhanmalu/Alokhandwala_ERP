'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FolderKanban, 
  Users, 
  Boxes, 
  ReceiptIndianRupee, 
  Building2, 
  Layers, 
  Truck, 
  BarChart3, 
  Bell, 
  UserCheck, 
  Settings, 
  ShieldAlert, 
  LogOut,
  X 
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';

export function Sidebar({ onClose }: { onClose?: () => void } = {}) {
  const pathname = usePathname();
  const { can, currentUser, logout } = useAuth();

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const navLinkClass = (path: string) => {
    const active = isActive(path);
    return `flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all min-h-[42px] ${
      active
        ? 'bg-[#382315] text-[#fdf8f4] font-semibold border-l-2 border-[#c79e7c]'
        : 'text-[#debfa6] hover:bg-[#281910] hover:text-white'
    }`;
  };

  const iconClass = (path: string) => {
    return `w-4 h-4 shrink-0 ${isActive(path) ? 'text-[#c79e7c]' : 'text-[#a9927d]'}`;
  };

  return (
    <div className="w-full h-full min-h-0 bg-[#1c120c] text-[#debfa6] flex flex-col shrink-0 select-none overflow-hidden">
      {/* Brand Header */}
      <div className="p-4 border-b border-[#2f1f15] flex items-center justify-between bg-[#140c07] shrink-0">
        <Link 
          href="/" 
          onClick={onClose}
          className="flex items-center gap-3 hover:opacity-90 transition group min-w-0"
        >
          <div className="w-10 h-10 rounded-xl bg-[#23150c] flex items-center justify-center p-1.5 shadow-md shadow-black/50 border border-[#59371d]/60 group-hover:border-[#c79e7c]/70 transition-colors shrink-0">
            <img 
              src="/logo-icon-accent.png" 
              alt="Alokhandwala Scaffold Mark" 
              className="w-full h-full object-contain filter drop-shadow"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-[#fdf8f4] text-base tracking-wider truncate uppercase">
              ALOKHANDWALA
            </div>
          </div>
        </Link>

        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-2 rounded-lg text-[#a9927d] hover:text-white hover:bg-[#281910] transition min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0"
            aria-label="Close Navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Scroll Area */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain sidebar-scrollbar py-3 px-2 space-y-4 text-xs">
        
        {/* WORKER VIEW: Only sees sites he has worked on */}
        {currentUser.role === 'WORKER' && (
          <div className="space-y-0.5">
            <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8f745f]">
              My Work Sites
            </div>
            
            <Link href="/projects" onClick={onClose} className={navLinkClass('/projects')}>
              <div className="flex items-center gap-2.5">
                <Building2 className={iconClass('/projects')} />
                <span>Sites Worked On</span>
              </div>
            </Link>
          </div>
        )}

        {/* SUPERVISOR VIEW: Only has Site Form and Installation Form (+ My Projects) */}
        {currentUser.role === 'SUPERVISOR' && (
          <div className="space-y-4">
            <div className="space-y-0.5">
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8f745f]">
                Supervisor Forms
              </div>

              <Link href="/sites/new" onClick={onClose} className={navLinkClass('/sites/new')}>
                <div className="flex items-center gap-2.5">
                  <Building2 className={iconClass('/sites/new')} />
                  <span>Site Form</span>
                </div>
              </Link>

              <Link href="/installation" onClick={onClose} className={navLinkClass('/installation')}>
                <div className="flex items-center gap-2.5">
                  <Truck className={iconClass('/installation')} />
                  <span>Installation Form</span>
                </div>
              </Link>
            </div>

            <div className="space-y-0.5 pt-1 border-t border-[#2a1b12]">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8f745f]">
                Sites & Projects
              </div>

              <Link href="/projects" onClick={onClose} className={navLinkClass('/projects')}>
                <div className="flex items-center gap-2.5">
                  <FolderKanban className={iconClass('/projects')} />
                  <span>Assigned Sites</span>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* ADMIN VIEW: Has all the power (full operations, workflow, management) */}
        {currentUser.role === 'ADMIN' && (
          <>
            {/* Section: Main Operations */}
            <div className="space-y-0.5">
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8f745f]">
                Operations
              </div>
              
              <Link href="/" onClick={onClose} className={navLinkClass('/')}>
                <div className="flex items-center gap-2.5">
                  <LayoutDashboard className={iconClass('/')} />
                  <span>Dashboard</span>
                </div>
              </Link>

              <Link href="/projects" onClick={onClose} className={navLinkClass('/projects')}>
                <div className="flex items-center gap-2.5">
                  <FolderKanban className={iconClass('/projects')} />
                  <span>Projects</span>
                </div>
              </Link>

              <Link href="/customers" onClick={onClose} className={navLinkClass('/customers')}>
                <div className="flex items-center gap-2.5">
                  <Users className={iconClass('/customers')} />
                  <span>Customers</span>
                </div>
              </Link>

              <Link href="/inventory" onClick={onClose} className={navLinkClass('/inventory')}>
                <div className="flex items-center gap-2.5">
                  <Boxes className={iconClass('/inventory')} />
                  <span>Inventory & Yard</span>
                </div>
              </Link>

              <Link href="/billing" onClick={onClose} className={navLinkClass('/billing')}>
                <div className="flex items-center gap-2.5">
                  <ReceiptIndianRupee className={iconClass('/billing')} />
                  <span>Billing & Invoices</span>
                </div>
              </Link>
            </div>

            {/* Section: Field Workflow */}
            <div className="space-y-0.5 pt-1 border-t border-[#2a1b12]">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8f745f]">
                Field Workflow
              </div>

              <Link href="/sites/new" onClick={onClose} className={navLinkClass('/sites/new')}>
                <div className="flex items-center gap-2.5">
                  <Building2 className={iconClass('/sites/new')} />
                  <span>Site Form</span>
                </div>
              </Link>

              <Link href="/confirmation" onClick={onClose} className={navLinkClass('/confirmation')}>
                <div className="flex items-center gap-2.5">
                  <Layers className={iconClass('/confirmation')} />
                  <span>Confirmation & Plan</span>
                </div>
              </Link>

              <Link href="/installation" onClick={onClose} className={navLinkClass('/installation')}>
                <div className="flex items-center gap-2.5">
                  <Truck className={iconClass('/installation')} />
                  <span>Installation Form</span>
                </div>
              </Link>
            </div>

            {/* Section: Insights & Management */}
            <div className="space-y-0.5 pt-1 border-t border-[#2a1b12]">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8f745f]">
                Management
              </div>

              <Link href="/reports" onClick={onClose} className={navLinkClass('/reports')}>
                <div className="flex items-center gap-2.5">
                  <BarChart3 className={iconClass('/reports')} />
                  <span>Reports & Analytics</span>
                </div>
              </Link>

              <Link href="/notifications" onClick={onClose} className={navLinkClass('/notifications')}>
                <div className="flex items-center gap-2.5">
                  <Bell className={iconClass('/notifications')} />
                  <span>Notifications</span>
                </div>
              </Link>

              <Link href="/users" onClick={onClose} className={navLinkClass('/users')}>
                <div className="flex items-center gap-2.5">
                  <UserCheck className={iconClass('/users')} />
                  <span>User Management</span>
                </div>
              </Link>

              <Link href="/audit-logs" onClick={onClose} className={navLinkClass('/audit-logs')}>
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className={iconClass('/audit-logs')} />
                  <span>Audit Trail</span>
                </div>
              </Link>

              <Link href="/settings" onClick={onClose} className={navLinkClass('/settings')}>
                <div className="flex items-center gap-2.5">
                  <Settings className={iconClass('/settings')} />
                  <span>Settings</span>
                </div>
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Footer User Card & Logout */}
      <div className="p-3 bg-[#140c07] border-t border-[#2f1f15] shrink-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[#fdf8f4] truncate">
              {currentUser.fullName}
            </div>
            <div className="text-[10px] text-[#9f836c] font-mono uppercase tracking-wide">
              {currentUser.role.replace('_', ' ')}
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs text-[#debfa6] hover:text-white bg-[#24150c] hover:bg-[#341e12] border border-[#3e271a] transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
