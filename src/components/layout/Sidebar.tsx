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
  X,
  FileText
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';

export function Sidebar({ onClose }: { onClose?: () => void } = {}) {
  const pathname = usePathname();
  const { currentUser, logout } = useAuth();

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const navLinkClass = (path: string) => {
    const active = isActive(path);
    return `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'bg-[#2a1a11] text-[#fdfbf7] font-semibold border-l-3 border-[#c79e7c] shadow-2xs'
        : 'text-[#d6beaa] hover:bg-[#22150e] hover:text-white'
    }`;
  };

  const iconClass = (path: string) => {
    return `w-4.5 h-4.5 shrink-0 transition-colors ${isActive(path) ? 'text-[#c79e7c]' : 'text-[#9c826e]'}`;
  };

  return (
    <div className="w-full h-full min-h-0 bg-[#19100a] text-[#debfa6] flex flex-col shrink-0 select-none border-r border-[#2a1a11] overflow-hidden">
      {/* Brand Header */}
      <div className="px-5 py-4 border-b border-[#2a1a11] flex items-center justify-between bg-[#120b06] shrink-0">
        <Link 
          href="/" 
          onClick={onClose}
          className="flex items-center gap-3 hover:opacity-95 transition group min-w-0"
        >
          <div className="w-9 h-9 rounded-lg bg-[#24150c] flex items-center justify-center p-1.5 border border-[#4d301c] shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/logo-icon-accent.png" 
              alt="Alokhandwala Scaffold Mark" 
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-[#fdf8f4] text-sm tracking-wider truncate uppercase">
              ALOKHANDWALA
            </div>
            <div className="text-2xs text-[#9c826e] font-medium tracking-tight truncate">
              Enterprise ERP System
            </div>
          </div>
        </Link>

        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-md text-[#a9927d] hover:text-white hover:bg-[#24150c] transition"
            aria-label="Close Navigation"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation Scroll Area */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain sidebar-scrollbar py-4 px-3 space-y-5 text-sm">
        
        {/* WORKER VIEW: Only sees sites he has worked on */}
        {currentUser.role === 'WORKER' && (
          <div className="space-y-1.5">
            <div className="px-3.5 py-1 text-2xs font-semibold uppercase tracking-wider text-[#8a705e]">
              My Operations
            </div>
            
            <Link href="/projects" onClick={onClose} className={navLinkClass('/projects')}>
              <div className="flex items-center gap-2.5">
                <Building2 className={iconClass('/projects')} />
                <span>Sites Worked On</span>
              </div>
            </Link>
          </div>
        )}

        {/* SUPERVISOR VIEW */}
        {currentUser.role === 'SUPERVISOR' && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <div className="px-3.5 py-1 text-2xs font-semibold uppercase tracking-wider text-[#8a705e]">
                Field Operations
              </div>

              <Link href="/sites/new" onClick={onClose} className={navLinkClass('/sites/new')}>
                <div className="flex items-center gap-2.5">
                  <Building2 className={iconClass('/sites/new')} />
                  <span>Site Form</span>
                </div>
              </Link>

              <Link href="/quotation" onClick={onClose} className={navLinkClass('/quotation')}>
                <div className="flex items-center gap-2.5">
                  <FileText className={iconClass('/quotation')} />
                  <span>Quotation Form</span>
                </div>
              </Link>

              <Link href="/installation" onClick={onClose} className={navLinkClass('/installation')}>
                <div className="flex items-center gap-2.5">
                  <Truck className={iconClass('/installation')} />
                  <span>Installation Form</span>
                </div>
              </Link>
            </div>

            <div className="space-y-1.5 pt-2.5 border-t border-[#23150d]">
              <div className="px-3.5 py-1 text-2xs font-semibold uppercase tracking-wider text-[#8a705e]">
                Sites & Records
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

        {/* ADMIN VIEW */}
        {currentUser.role === 'ADMIN' && (
          <>
            {/* Section: Main Operations */}
            <div className="space-y-1.5">
              <div className="px-3.5 py-1 text-2xs font-semibold uppercase tracking-wider text-[#8a705e]">
                Core Modules
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
                  <span>Billing & Accounts</span>
                </div>
              </Link>
            </div>

            {/* Section: Field Operations Workflow */}
            <div className="space-y-1.5 pt-2.5 border-t border-[#23150d]">
              <div className="px-3.5 py-1 text-2xs font-semibold uppercase tracking-wider text-[#8a705e]">
                Field Workflow
              </div>
              <Link href="/sites/new" onClick={onClose} className={navLinkClass('/sites/new')}>
                <div className="flex items-center gap-2.5">
                  <Building2 className={iconClass('/sites/new')} />
                  <span>Site Form</span>
                </div>
              </Link>

              <Link href="/quotation" onClick={onClose} className={navLinkClass('/quotation')}>
                <div className="flex items-center gap-2.5">
                  <FileText className={iconClass('/quotation')} />
                  <span>Quotation Form</span>
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
                  <span>Installation & Handover</span>
                </div>
              </Link>
            </div>

            {/* Section: Insights & Management */}
            <div className="space-y-1.5 pt-2.5 border-t border-[#23150d]">
              <div className="px-3.5 py-1 text-2xs font-semibold uppercase tracking-wider text-[#8a705e]">
                Administration
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
      <div className="p-2.5 bg-[#120b06] border-t border-[#2a1a11] shrink-0">
        <div className="flex items-center justify-between gap-2 px-1 py-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-md bg-[#24150c] text-[#fdf8f4] flex items-center justify-center font-bold text-xs border border-[#4d301c] shrink-0">
              {currentUser.fullName ? currentUser.fullName[0] : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-[#fdf8f4] truncate">
                {currentUser.fullName}
              </div>
              <div className="text-[10px] text-[#9c826e] font-mono uppercase tracking-wide truncate">
                {currentUser.role.replace('_', ' ')}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 rounded-md text-[#9c826e] hover:text-rose-400 hover:bg-[#24150c] transition cursor-pointer"
            aria-label="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
