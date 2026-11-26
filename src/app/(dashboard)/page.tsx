'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  Boxes, 
  FolderKanban, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowRight,
  Truck,
  MapPin,
  TrendingUp,
  ReceiptIndianRupee,
  Search,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend,
  LabelList
} from 'recharts';
import { useAuth } from '@/lib/auth/auth-context';
import { formatINR, formatQuantity, formatDate, getStatusBadgeConfig } from '@/lib/formatters';

export default function DashboardOverviewPage() {
  const router = useRouter();
  const { currentUser, can } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeFinancialCard, setActiveFinancialCard] = useState<'TOTAL_AMOUNT' | 'TOTAL_RECEIVED' | 'TOTAL_OVERDUE' | null>(null);
  const [financialSearch, setFinancialSearch] = useState('');
  const [financialPage, setFinancialPage] = useState(1);

  useEffect(() => {
    if (currentUser?.role === 'WORKER') {
      router.replace('/projects');
      return;
    }
    if (currentUser?.role === 'SUPERVISOR') {
      router.replace('/sites/new');
      return;
    }
    if (currentUser?.role === 'CLIENT') {
      router.replace('/projects');
      return;
    }

    fetch('/api/dashboard')
      .then(res => res.json())
      .then(json => {
        if (json.success) setData(json.data);
      })
      .finally(() => setLoading(false));
  }, [currentUser, router]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-20 bg-[#ebdcc9]/50 rounded-lg w-full"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-white border border-[#ebdcc9] rounded-lg"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-72 bg-white border border-[#ebdcc9] rounded-lg"></div>
          <div className="h-72 bg-white border border-[#ebdcc9] rounded-lg"></div>
        </div>
      </div>
    );
  }

  const cards = data?.cards || {};
  const charts = data?.charts || {};
  const upcomingDeadlines = data?.upcomingDeadlines || [];
  const financialProjects: any[] = data?.financialProjects || [];

  const openFinancialModal = (type: 'TOTAL_AMOUNT' | 'TOTAL_RECEIVED' | 'TOTAL_OVERDUE') => {
    setActiveFinancialCard(type);
    setFinancialSearch('');
    setFinancialPage(1);
  };

  const STATUS_COLORS: Record<string, string> = {
    NOT_INSTALLED: '#64748b',
    CONFIRMED_PROJECT: '#3b82f6',
    SCHEDULED: '#8b5cf6',
    INSTALLED: '#10b981',
    ACTIVE_RENTAL: '#059669',
    BUFFER_PERIOD: '#f59e0b',
    EXTENSION_REQUESTED: '#06b6d4',
    EXTENDED: '#0d9488',
    SHIFTING_PENDING: '#6366f1',
    SHIFTING_IN_PROGRESS: '#4f46e5',
    REMOVAL_PENDING: '#ea580c',
    RETURNED_RECONCILIATION: '#e11d48',
    CLOSED: '#94a3b8',
    CANCELLED: '#dc2626',
  };

  return (
    <div className="space-y-4">
      {/* Row 1: Compact Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Rentals */}
        <Link 
          href="/projects?status=ACTIVE_RENTAL" 
          className="bg-white px-4 py-3.5 sm:px-5 sm:py-4 rounded-xl border border-[#e8decb] hover:border-[#8c5e39] transition shadow-2xs group flex flex-col justify-between min-h-[116px]"
        >
          <div className="flex items-center justify-between text-[#7d6553] text-[11px] font-semibold uppercase tracking-wider">
            <span className="truncate">Active Rentals</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="text-2xl sm:text-[26px] leading-tight font-bold text-[#24160c] my-1 font-mono">
            {cards.activeRentalCount || 0}
          </div>
          <div className="text-[11px] text-[#574830] font-medium flex items-center gap-1.5 truncate">
            <span className="font-semibold text-emerald-700">{formatINR(cards.monthlyRentalRunRate, false)}</span>
            <span className="text-[#9c826e]">/mo revenue</span>
          </div>
        </Link>

        {/* Awaiting Confirmation */}
        <Link 
          href="/projects?status=NOT_INSTALLED" 
          className="bg-white px-4 py-3.5 sm:px-5 sm:py-4 rounded-xl border border-[#e8decb] hover:border-[#8c5e39] transition shadow-2xs group flex flex-col justify-between min-h-[116px]"
        >
          <div className="flex items-center justify-between text-[#7d6553] text-[11px] font-semibold uppercase tracking-wider">
            <span className="truncate">Awaiting Confirmation</span>
            <FolderKanban className="w-4 h-4 text-blue-600 shrink-0" />
          </div>
          <div className="text-2xl sm:text-[26px] leading-tight font-bold text-[#24160c] my-1 font-mono">
            {cards.notInstalledCount || 0}
          </div>
          <div className="text-[11px] text-[#7d6553] truncate">
            Site records awaiting commercial terms
          </div>
        </Link>

        {/* Buffer Period */}
        <Link 
          href="/projects?status=BUFFER_PERIOD" 
          className="bg-white px-4 py-3.5 sm:px-5 sm:py-4 rounded-xl border border-[#e8decb] hover:border-[#8c5e39] transition shadow-2xs group flex flex-col justify-between min-h-[116px]"
        >
          <div className="flex items-center justify-between text-[#7d6553] text-[11px] font-semibold uppercase tracking-wider">
            <span className="truncate">Buffer Period Active</span>
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <div className="text-2xl sm:text-[26px] leading-tight font-bold text-amber-700 my-1 font-mono">
            {cards.bufferCount || 0}
          </div>
          <div className="text-[11px] text-amber-800 truncate">
            Within 2-3 day dismantling grace window
          </div>
        </Link>

        {/* Removal Pending */}
        <Link 
          href="/projects?status=REMOVAL_PENDING" 
          className="bg-white px-4 py-3.5 sm:px-5 sm:py-4 rounded-xl border border-[#e8decb] hover:border-[#8c5e39] transition shadow-2xs group flex flex-col justify-between min-h-[116px]"
        >
          <div className="flex items-center justify-between text-[#7d6553] text-[11px] font-semibold uppercase tracking-wider">
            <span className="truncate">Pending Removal</span>
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          </div>
          <div className="text-2xl sm:text-[26px] leading-tight font-bold text-rose-700 my-1 font-mono">
            {cards.removalCount || 0}
          </div>
          <div className="text-[11px] text-rose-800 font-medium truncate">
            {cards.overdueRemovalsCount > 0 ? `${cards.overdueRemovalsCount} overdue removals` : 'All removals scheduled'}
          </div>
        </Link>
      </div>

      {/* Row 2: Compact Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. TOTAL AMOUNT */}
        <button
          type="button"
          onClick={() => openFinancialModal('TOTAL_AMOUNT')}
          className="text-left bg-white px-4 py-3.5 sm:px-5 sm:py-4 rounded-xl border border-[#e8decb] hover:border-[#8c5e39] hover:shadow-xs transition duration-150 cursor-pointer group flex flex-col justify-between min-h-[106px]"
          title="Click to view all projects and their total agreed amounts"
        >
          <div className="flex items-center justify-between text-[11px] text-[#7d6553] uppercase font-semibold tracking-wider group-hover:text-[#24160c]">
            <span className="truncate">TOTAL AMOUNT</span>
            <ArrowUpRight className="w-4 h-4 text-[#9c826e] group-hover:text-[#8c5e39] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl leading-tight font-bold text-[#24160c] font-mono my-1 truncate">
            {formatINR(cards.totalProjectAmount || 0, false)}
          </div>
          <div className="text-[11px] text-[#8c7360] truncate">
            Across all {financialProjects.length} {financialProjects.length === 1 ? 'project' : 'projects'}
          </div>
        </button>

        {/* 2. TOTAL AMOUNT RECEIVED */}
        <button
          type="button"
          onClick={() => openFinancialModal('TOTAL_RECEIVED')}
          className="text-left bg-white px-4 py-3.5 sm:px-5 sm:py-4 rounded-xl border border-[#e8decb] hover:border-emerald-600 hover:shadow-xs transition duration-150 cursor-pointer group flex flex-col justify-between min-h-[106px]"
          title="Click to view projects with payments received"
        >
          <div className="flex items-center justify-between text-[11px] text-[#7d6553] uppercase font-semibold tracking-wider group-hover:text-emerald-800">
            <span className="truncate">TOTAL AMOUNT RECEIVED</span>
            <ArrowUpRight className="w-4 h-4 text-[#9c826e] group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl leading-tight font-bold text-emerald-700 font-mono my-1 truncate">
            {formatINR(cards.totalProjectReceived || 0, false)}
          </div>
          <div className="text-[11px] text-[#8c7360] truncate">
            {financialProjects.filter(p => p.totalPaymentReceived > 0).length} {financialProjects.filter(p => p.totalPaymentReceived > 0).length === 1 ? 'project' : 'projects'} with payments
          </div>
        </button>

        {/* 3. TOTAL OVERDUE AMOUNT */}
        <button
          type="button"
          onClick={() => openFinancialModal('TOTAL_OVERDUE')}
          className="text-left bg-white px-4 py-3.5 sm:px-5 sm:py-4 rounded-xl border border-[#e8decb] hover:border-amber-600 hover:shadow-xs transition duration-150 cursor-pointer group flex flex-col justify-between min-h-[106px]"
          title="Click to view projects with outstanding balance"
        >
          <div className="flex items-center justify-between text-[11px] text-[#7d6553] uppercase font-semibold tracking-wider group-hover:text-amber-900">
            <span className="truncate">TOTAL OVERDUE AMOUNT</span>
            <ArrowUpRight className="w-4 h-4 text-[#9c826e] group-hover:text-amber-700 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl leading-tight font-bold text-amber-800 font-mono my-1 truncate">
            {formatINR(cards.totalProjectOverdue || 0, false)}
          </div>
          <div className="text-[11px] text-[#8c7360] truncate">
            {financialProjects.filter(p => p.balanceAmount > 0).length} {financialProjects.filter(p => p.balanceAmount > 0).length === 1 ? 'project' : 'projects'} with balance due
          </div>
        </button>
      </div>

      {/* Row 3: Visual Analytics (50/50 Compact Charts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Project Financial Overview Chart */}
        <div className="bg-white rounded-xl border border-[#e8decb] shadow-2xs overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#ebdcc9] bg-[#fdfcf9] flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-[#24160c] uppercase tracking-wider">
                Project Financial Overview
              </h2>
            </div>
            <Link 
              href="/projects" 
              className="text-xs font-medium text-[#6e482f] hover:text-[#24160c] flex items-center gap-1"
            >
              <span>Projects</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="px-3 py-2.5 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'Total Agreed Amount', amount: cards.totalProjectAmount || 0, fill: '#24160c' },
                  { name: 'Total Amount Received', amount: cards.totalProjectReceived || 0, fill: '#047857' },
                  { name: 'Total Overdue Amount', amount: cards.totalProjectOverdue || 0, fill: '#b45309' },
                ]}
                margin={{ top: 20, right: 12, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f2eadf" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#4d301c', fontWeight: 600 }}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#7d6553' }}
                  width={64}
                  tickFormatter={(val: number) => formatINR(val, false)}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#d8c8b4', borderRadius: '6px', fontSize: '11px' }}
                  formatter={(val: any) => [formatINR(Number(val) || 0, false), 'Amount']}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={64}>
                  <Cell fill="#24160c" />
                  <Cell fill="#047857" />
                  <Cell fill="#b45309" />
                  <LabelList
                    dataKey="amount"
                    position="top"
                    formatter={(val: any) => formatINR(Number(val) || 0, false)}
                    style={{ fontSize: '11px', fontWeight: 700, fill: '#24160c' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Chart */}
        <div className="bg-white rounded-xl border border-[#e8decb] shadow-2xs overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#ebdcc9] bg-[#fdfcf9] flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-[#24160c] uppercase tracking-wider">
                Projects by Operational Status
              </h2>
            </div>
            <Link 
              href="/projects" 
              className="text-xs font-medium text-[#6e482f] hover:text-[#24160c] flex items-center gap-1"
            >
              <span>Projects</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="px-3 py-2.5 h-[240px] flex items-center justify-center">
            {(charts.projectsByStatus || []).length === 0 ? (
              <div className="text-center p-4 text-[#9c826e]">
                <FolderKanban className="w-7 h-7 mx-auto mb-1.5 text-[#c7b39d]" />
                <p className="font-medium text-[#574830] text-xs">No active project records</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.projectsByStatus || []}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="46%"
                    outerRadius={64}
                    innerRadius={36}
                    paddingAngle={2}
                  >
                    {(charts.projectsByStatus || []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#64748b'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#d8c8b4', borderRadius: '6px', fontSize: '11px' }} />
                  <Legend 
                    wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }} 
                    layout="horizontal" 
                    align="center" 
                    verticalAlign="bottom" 
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Critical Expiry & Deadlines Table */}
      <div className="bg-white rounded-xl border border-[#e8decb] shadow-2xs overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#ebdcc9] bg-[#fdfcf9] flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-[#24160c] uppercase tracking-wider">
              Critical Deadlines & Buffer Removals
            </h2>
          </div>
          <Link 
            href="/projects" 
            className="text-xs font-semibold text-[#6e482f] hover:text-[#24160c]"
          >
            View All Projects
          </Link>
        </div>

        {/* Mobile View */}
        <div className="block md:hidden divide-y divide-[#f2eadf]">
          {upcomingDeadlines.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#9c826e]">
              No upcoming deadlines within the next 30 days.
            </div>
          ) : (
            upcomingDeadlines.map((item: any) => {
              const badge = getStatusBadgeConfig(item.status);
              const isOverdue = item.daysLeft < 0;
              const isImminent = item.daysLeft <= 3 && item.daysLeft >= 0;

              return (
                <div key={item.id} className="p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[#24160c]">{item.projectCode}</span>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.className}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                      {badge.label}
                    </span>
                  </div>

                  <div>
                    <div className="font-semibold text-[#24160c]">{item.customerName}</div>
                    <div className="text-[#7d6553] text-[11px]">{item.siteName}</div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-[#f2eadf]">
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#faf6ee] text-[#59371d] border border-[#ebdcc9]">
                      {item.type === 'BUFFER_DEADLINE' ? 'Removal Buffer' : 'Rental Expiry'}
                    </span>
                    <span className={`font-mono font-semibold ${
                      isOverdue ? 'text-red-700' : isImminent ? 'text-amber-700' : 'text-[#4d3221]'
                    }`}>
                      {isOverdue ? `${Math.abs(item.daysLeft)}d overdue` : `${item.daysLeft}d left`} ({formatDate(item.targetDate)})
                    </span>
                  </div>

                  <div className="pt-1">
                    <Link
                      href={`/projects/${item.id}`}
                      className="w-full flex items-center justify-center py-1.5 text-xs font-semibold text-[#24160c] bg-[#fbf9f5] hover:bg-[#faf6ee] border border-[#d8c8b4] rounded-md transition"
                    >
                      Manage Project →
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#fbf9f5] text-[#7d6553] uppercase tracking-wider text-[10px] font-semibold border-b border-[#ebdcc9]">
              <tr>
                <th className="px-4 py-2.5">Project ID</th>
                <th className="px-4 py-2.5">Customer & Site</th>
                <th className="px-4 py-2.5">Milestone</th>
                <th className="px-4 py-2.5">Target Date</th>
                <th className="px-4 py-2.5">Timeline</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2eadf]">
              {upcomingDeadlines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-4 text-center text-[#9c826e]">
                    No deadlines requiring attention within 30 days.
                  </td>
                </tr>
              ) : (
                upcomingDeadlines.map((item: any) => {
                  const badge = getStatusBadgeConfig(item.status);
                  const isOverdue = item.daysLeft < 0;
                  const isImminent = item.daysLeft <= 3 && item.daysLeft >= 0;

                  return (
                    <tr key={item.id} className="hover:bg-[#faf6ee]/50 transition">
                      <td className="px-4 py-2.5 font-mono font-semibold text-[#24160c]">
                        {item.projectCode}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-[#24160c]">{item.customerName}</div>
                        <div className="text-[#7d6553] text-[11px] truncate max-w-xs">{item.siteName}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#faf6ee] text-[#59371d] border border-[#ebdcc9]">
                          {item.type === 'BUFFER_DEADLINE' ? 'Removal Buffer' : 'Rental Expiry'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[#574830]">
                        {formatDate(item.targetDate)}
                      </td>
                      <td className="px-4 py-2.5 font-mono">
                        <span className={`font-semibold ${
                          isOverdue ? 'text-red-700' : isImminent ? 'text-amber-700' : 'text-[#4d3221]'
                        }`}>
                          {isOverdue ? `${Math.abs(item.daysLeft)}d overdue` : `${item.daysLeft}d left`}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.className}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href={`/projects/${item.id}`}
                          className="px-2.5 py-1 text-[11px] font-medium text-[#24160c] bg-[#fbf9f5] hover:bg-[#faf6ee] border border-[#d8c8b4] rounded transition"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Financial Summary Project List Modal */}
      {activeFinancialCard && (() => {
        const baseList =
          activeFinancialCard === 'TOTAL_AMOUNT'
            ? financialProjects
            : activeFinancialCard === 'TOTAL_RECEIVED'
            ? financialProjects.filter((p) => p.totalPaymentReceived > 0)
            : financialProjects.filter((p) => p.balanceAmount > 0);

        const q = financialSearch.trim().toLowerCase();
        const filtered = q
          ? baseList.filter(
              (p) =>
                (p.projectCode || '').toLowerCase().includes(q) ||
                (p.siteName || '').toLowerCase().includes(q) ||
                (p.customerName || '').toLowerCase().includes(q) ||
                (p.status || '').toLowerCase().replace(/_/g, ' ').includes(q)
            )
          : baseList;

        const PAGE_SIZE = 10;
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        const currentPage = Math.min(financialPage, totalPages);
        const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

        const modalTitle =
          activeFinancialCard === 'TOTAL_AMOUNT'
            ? 'TOTAL AMOUNT — All Projects'
            : activeFinancialCard === 'TOTAL_RECEIVED'
            ? 'TOTAL AMOUNT RECEIVED — Paid Projects'
            : 'TOTAL OVERDUE AMOUNT — Projects with Outstanding Balance';

        const modalTotal =
          activeFinancialCard === 'TOTAL_AMOUNT'
            ? cards.totalProjectAmount || 0
            : activeFinancialCard === 'TOTAL_RECEIVED'
            ? cards.totalProjectReceived || 0
            : cards.totalProjectOverdue || 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140b06]/70 backdrop-blur-xs">
            <div
              className="fixed inset-0"
              onClick={() => setActiveFinancialCard(null)}
            />
            <div className="relative z-10 w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-[#d6c7b2] overflow-hidden text-stone-800 max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="bg-[#24160c] px-5 py-4 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-[#382315] border border-[#523622] flex items-center justify-center text-[#c79e7c]">
                    <ReceiptIndianRupee className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{modalTitle}</h3>
                    <p className="text-[11px] font-mono text-[#c79e7c]">
                      {baseList.length} {baseList.length === 1 ? 'Project' : 'Projects'} · Total: {formatINR(modalTotal, false)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveFinancialCard(null)}
                  className="p-1 text-stone-300 hover:text-white cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="px-5 py-3 bg-[#fbf9f5] border-b border-[#e5dac8] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-[#9c826e] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={financialSearch}
                    onChange={(e) => {
                      setFinancialSearch(e.target.value);
                      setFinancialPage(1);
                    }}
                    placeholder="Search by project ID, site name, customer, or status..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#d6c7b2] rounded-md text-[#24160c] focus:border-[#8f6541] focus:ring-1 focus:ring-[#8f6541] focus:outline-none"
                  />
                </div>
                <span className="text-[11px] text-[#7d6553] font-medium shrink-0">
                  Showing {filtered.length} of {baseList.length}
                </span>
              </div>

              {/* Project List Table */}
              <div className="overflow-auto flex-1">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#faf6ee] text-[#7d6553] font-semibold uppercase tracking-wider text-[10px] border-b border-[#ebdcc9] sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5">Project</th>
                      <th className="px-4 py-2.5">Customer Name</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Total Agreed Price</th>
                      <th className="px-4 py-2.5 text-right">Total Payment Received</th>
                      <th className="px-4 py-2.5 text-right">Balance Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f2eadf]">
                    {pageItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-[#9c826e]">
                          No matching projects found.
                        </td>
                      </tr>
                    ) : (
                      pageItems.map((p) => {
                        const badge = getStatusBadgeConfig(p.status);
                        return (
                          <tr key={p.id} className="hover:bg-[#faf6ee]/60 transition">
                            <td className="px-4 py-2.5">
                              <Link
                                href={`/projects/${p.id}`}
                                className="font-mono font-bold text-[#24160c] hover:text-[#8c5e39] hover:underline block"
                              >
                                {p.projectCode}
                              </Link>
                              <span className="text-[11px] text-[#7d6553] truncate block max-w-[200px]">
                                {p.siteName}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-[#24160c]">
                              {p.customerName}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.className}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold text-[#24160c]">
                              {formatINR(p.totalAgreedPrice, false)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">
                              {formatINR(p.totalPaymentReceived, false)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold text-amber-800">
                              {formatINR(p.balanceAmount, false)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer with Pagination & Back to Dashboard */}
              <div className="bg-[#fbf9f5] border-t border-[#e5dac8] px-5 py-3 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => setFinancialPage((pg) => Math.max(1, pg - 1))}
                        className="p-1.5 rounded border border-[#d6c7b2] bg-white text-[#24160c] hover:bg-[#faf6ee] disabled:opacity-40 cursor-pointer"
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[11px] font-mono text-[#7d6553] px-1">
                        Page {currentPage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() => setFinancialPage((pg) => Math.min(totalPages, pg + 1))}
                        className="p-1.5 rounded border border-[#d6c7b2] bg-white text-[#24160c] hover:bg-[#faf6ee] disabled:opacity-40 cursor-pointer"
                        aria-label="Next page"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveFinancialCard(null)}
                  className="px-4 py-2 text-xs font-bold text-[#c79e7c] bg-[#24160c] hover:bg-[#382315] rounded-md transition cursor-pointer"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
