'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FolderKanban, 
  Users, 
  Boxes, 
  ReceiptIndianRupee, 
  Building2, 
  Truck, 
  BarChart3, 
  Bell, 
  Settings, 
  LogOut,
  X,
  FileText,
  ArrowRightLeft,
  PackagePlus,
  ChevronDown,
  Landmark,
  BookOpen,
  ClipboardList,
  DollarSign,
  ScrollText
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';

export function Sidebar({ onClose }: { onClose?: () => void } = {}) {
  const pathname = usePathname();
  const { currentUser, logout } = useAuth();
  const isInventoryRoute = pathname.startsWith('/inventory');
  const isAccountsRoute = pathname.startsWith('/accounts');
  const isHRRoute = pathname.startsWith('/hr');
  const [inventoryExpanded, setInventoryExpanded] = useState<boolean>(() => isInventoryRoute);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (isInventoryRoute) setInventoryExpanded(true);
  }, [pathname, isInventoryRoute]);

  useEffect(() => {
    const loadUnread = () => {
      fetch('/api/notifications')
        .then((r) => r.json())
        .then((json) => {
          if (json.success) {
            setUnreadNotifications(
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

  const isExact = (path: string) => pathname === path;

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    if (path === '/reports') return pathname === '/reports';
    if (path === '/inventory') return isInventoryRoute;
    if (path === '/accounts') return isAccountsRoute;
    if (path === '/hr') return isHRRoute;
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

  const subNavLinkClass = (path: string) => {
    const active = isExact(path);
    return `flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
      active
        ? 'bg-[#2a1a11] text-[#fdfbf7] font-semibold text-[#c79e7c]'
        : 'text-[#bfa38e] hover:bg-[#20140d] hover:text-white'
    }`;
  };
  return (
    <div className="w-full h-full min-h-0 bg-[#19100a] text-[#debfa6] flex flex-col shrink-0 select-none border-r border-[#2a1a11] overflow-hidden">
      {/* Brand Header */}
      <div className="px-5 py-3.5 border-b border-[#2a1a11] flex items-center justify-between bg-[#120b06] shrink-0">
        <Link 
          href="/" 
          onClick={onClose}
          className="flex-1 flex items-center justify-center hover:opacity-90 transition group min-w-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/logo.png" 
            alt="ALOKHANDWALA" 
            className="h-11 sm:h-12 w-auto max-w-[200px] object-contain drop-shadow-xs"
          />
        </Link>

        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md text-[#a9927d] hover:text-white hover:bg-[#24150c] transition cursor-pointer shrink-0 ml-2"
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
              <Link href="/challans" onClick={onClose} className={navLinkClass('/challans')}>
                <div className="flex items-center gap-2.5">
                  <ScrollText className={iconClass('/challans')} />
                  <span>Challan</span>
                </div>
              </Link>
            </div>
          </div>
        )}

                {/* ACCOUNTANT VIEW */}
        {currentUser.role === 'ACCOUNTANT' && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <div className="px-3.5 py-1 text-2xs font-semibold uppercase tracking-wider text-[#8a705e]">
                Financial Operations
              </div>
              <Link href="/" onClick={onClose} className={navLinkClass('/')}>
                <div className="flex items-center gap-2.5">
                  <LayoutDashboard className={iconClass('/')} />
                  <span>Dashboard</span>
                </div>
              </Link>
              <Link href="/accounts/billing" onClick={onClose} className={navLinkClass('/accounts/billing')}>
                <div className="flex items-center gap-2.5">
                  <ReceiptIndianRupee className={iconClass('/accounts/billing')} />
                  <span>Billing & Invoices</span>
                </div>
              </Link>
              <Link href="/billing/outstanding" onClick={onClose} className={navLinkClass('/billing/outstanding')}>
                <div className="flex items-center gap-2.5">
                  <DollarSign className={iconClass('/billing/outstanding')} />
                  <span>Outstanding Balances</span>
                </div>
              </Link>
              <Link href="/accounts" onClick={onClose} className={navLinkClass('/accounts')}>
                <div className="flex items-center gap-2.5">
                  <Landmark className={iconClass('/accounts')} />
                  <span>Chart of Accounts</span>
                </div>
              </Link>
              <Link href="/accounts/ledger" onClick={onClose} className={navLinkClass('/accounts/ledger')}>
                <div className="flex items-center gap-2.5">
                  <BookOpen className={iconClass('/accounts/ledger')} />
                  <span>General Ledger</span>
                </div>
              </Link>
              <Link href="/accounts/bills" onClick={onClose} className={navLinkClass('/accounts/bills')}>
                <div className="flex items-center gap-2.5">
                  <ClipboardList className={iconClass('/accounts/bills')} />
                  <span>Vendor Bills</span>
                </div>
              </Link>
              <Link href="/accounts/reports" onClick={onClose} className={navLinkClass('/accounts/reports')}>
                <div className="flex items-center gap-2.5">
                  <BarChart3 className={iconClass('/accounts/reports')} />
                  <span>Financial Statements</span>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* CLIENT VIEW */}
        {currentUser.role === 'CLIENT' && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <div className="px-3.5 py-1 text-2xs font-semibold uppercase tracking-wider text-[#8a705e]">
                Client Portal
              </div>
              <Link href="/projects" onClick={onClose} className={navLinkClass('/projects')}>
                <div className="flex items-center gap-2.5">
                  <FolderKanban className={iconClass('/projects')} />
                  <span>My Scaffolding Projects</span>
                </div>
              </Link>
              <Link href="/quotation" onClick={onClose} className={navLinkClass('/quotation')}>
                <div className="flex items-center gap-2.5">
                  <FileText className={iconClass('/quotation')} />
                  <span>My Quotations</span>
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

              <Link href="/challans" onClick={onClose} className={navLinkClass('/challans')}>
                <div className="flex items-center gap-2.5">
                  <ScrollText className={iconClass('/challans')} />
                  <span>Challan</span>
                </div>
              </Link>

              {/* Inventory Group with Sub-Pages */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setInventoryExpanded(prev => !prev)}
                  className={`w-full ${navLinkClass('/inventory')} cursor-pointer text-left select-none`}
                  aria-expanded={inventoryExpanded}
                  aria-controls="inventory-submenu"
                >
                  <div className="flex items-center gap-2.5">
                    <Boxes className={iconClass('/inventory')} />
                    <span>Inventory</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 shrink-0 ${inventoryExpanded ? 'rotate-180 text-[#c79e7c]' : 'text-[#9c826e]'}`} />
                </button>

                {/* Sub-Pages Section under Inventory */}
                {inventoryExpanded && (
                  <div id="inventory-submenu" className="pl-3 pr-1 py-0.5 space-y-0.5 border-l-2 border-[#382315] ml-4 mt-1 transition-all duration-200 animate-in fade-in slide-in-from-top-1">
                    <Link
                      href="/inventory"
                      onClick={onClose}
                      className={subNavLinkClass('/inventory')}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isExact('/inventory') ? 'bg-[#c79e7c]' : 'bg-[#5c3e24]'}`} />
                      <span>Stock Overview</span>
                    </Link>
                  </div>
                )}
              </div>
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
                {unreadNotifications > 0 && (
                  <span className="px-1.5 py-0.5 min-w-[18px] text-center rounded-full bg-[#c79e7c] text-[#24160c] text-[10px] font-mono font-bold leading-none">
                    {unreadNotifications}
                  </span>
                )}
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
