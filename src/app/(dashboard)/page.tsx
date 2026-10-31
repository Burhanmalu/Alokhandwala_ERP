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
  ReceiptIndianRupee
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
  Legend 
} from 'recharts';
import { useAuth } from '@/lib/auth/auth-context';
import { formatINR, formatQuantity, formatDate, getStatusBadgeConfig } from '@/lib/formatters';

export default function DashboardOverviewPage() {
  const router = useRouter();
  const { currentUser, can } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser?.role === 'WORKER') {
      router.replace('/projects');
      return;
    }
    if (currentUser?.role === 'SUPERVISOR') {
      router.replace('/sites/new');
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
    <div className="space-y-5">
      {/* Executive Command Banner */}
      <div className="bg-[#1e130c] rounded-lg border border-[#3b2416] p-4 sm:p-5 text-[#fdfbf7] flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-md bg-[#2d1b11] border border-[#52331f] flex items-center justify-center p-1.5 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon-accent.png" alt="Alokhandwala" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#c79e7c]">
              <span>Alokhandwala Enterprise</span>
              <span>•</span>
              <span className="font-mono text-[#e8decb]">{currentUser.role.replace('_', ' ')}</span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-[#fdfbf7] tracking-tight truncate">
              Operations & Asset Control Dashboard
            </h1>
          </div>
        </div>
        {/* Action Shortcuts */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Link
            href="/sites/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#24160c] bg-[#fdfcf9] hover:bg-white rounded-md transition shadow-2xs cursor-pointer border border-[#c79e7c]"
          >
            <MapPin className="w-3.5 h-3.5 text-[#6e482f]" />
            <span>Site Form</span>
          </Link>

          <Link
            href="/confirmation"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#fdfbf7] bg-[#2a1a11] hover:bg-[#382315] border border-[#4d301c] rounded-md transition cursor-pointer"
          >
            <Boxes className="w-3.5 h-3.5 text-[#c79e7c]" />
            <span>Confirmation</span>
          </Link>

          <Link
            href="/installation"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#fdfbf7] bg-[#2a1a11] hover:bg-[#382315] border border-[#4d301c] rounded-md transition cursor-pointer"
          >
            <Truck className="w-3.5 h-3.5 text-[#c79e7c]" />
            <span>Installation</span>
          </Link>

          <Link
            href="/projects"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#d6beaa] hover:text-white bg-white/5 hover:bg-white/10 rounded-md border border-white/10 transition cursor-pointer"
          >
            <span>Projects</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Active Rentals */}
        <Link 
          href="/projects?status=ACTIVE_RENTAL" 
          className="bg-white p-4 rounded-lg border border-[#e8decb] hover:border-[#8c5e39] transition shadow-2xs group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-[#7d6553] text-xs font-semibold uppercase tracking-wider">
            <span>Active Rentals</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-[#24160c] my-1 font-mono">
            {cards.activeRentalCount || 0}
          </div>
          <div className="text-[11px] text-[#574830] font-medium flex items-center gap-1">
            <span className="font-semibold text-emerald-700">₹{formatINR(cards.monthlyRentalRunRate, false)}</span>
            <span className="text-[#9c826e]">/mo revenue</span>
          </div>
        </Link>

        {/* Awaiting Confirmation */}
        <Link 
          href="/projects?status=NOT_INSTALLED" 
          className="bg-white p-4 rounded-lg border border-[#e8decb] hover:border-[#8c5e39] transition shadow-2xs group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-[#7d6553] text-xs font-semibold uppercase tracking-wider">
            <span>Awaiting Confirmation</span>
            <FolderKanban className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-[#24160c] my-1 font-mono">
            {cards.notInstalledCount || 0}
          </div>
          <div className="text-[11px] text-[#7d6553]">
            Site records awaiting commercial terms
          </div>
        </Link>

        {/* Buffer Period */}
        <Link 
          href="/projects?status=BUFFER_PERIOD" 
          className="bg-white p-4 rounded-lg border border-[#e8decb] hover:border-[#8c5e39] transition shadow-2xs group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-[#7d6553] text-xs font-semibold uppercase tracking-wider">
            <span>Buffer Period Active</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700 my-1 font-mono">
            {cards.bufferCount || 0}
          </div>
          <div className="text-[11px] text-amber-800">
            Within 2-3 day dismantling grace window
          </div>
        </Link>

        {/* Removal Pending */}
        <Link 
          href="/projects?status=REMOVAL_PENDING" 
          className="bg-white p-4 rounded-lg border border-[#e8decb] hover:border-[#8c5e39] transition shadow-2xs group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-[#7d6553] text-xs font-semibold uppercase tracking-wider">
            <span>Pending Removal</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-700 my-1 font-mono">
            {cards.removalCount || 0}
          </div>
          <div className="text-[11px] text-rose-800 font-medium">
            {cards.overdueRemovalsCount > 0 ? `${cards.overdueRemovalsCount} overdue removals` : 'All removals scheduled'}
          </div>
        </Link>
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-white p-3 rounded-md border border-[#e8decb] shadow-2xs">
          <div className="text-[10px] text-[#7d6553] uppercase font-semibold">Warehouse Usable</div>
          <div className="text-sm font-bold text-[#24160c] font-mono mt-0.5">
            {formatQuantity(cards.usableWarehouseQty, 'Nos')}
          </div>
        </div>
        <div className="bg-white p-3 rounded-md border border-[#e8decb] shadow-2xs">
          <div className="text-[10px] text-[#7d6553] uppercase font-semibold">Reserved for Sites</div>
          <div className="text-sm font-bold text-blue-700 font-mono mt-0.5">
            {formatQuantity(cards.reservedQty, 'Nos')}
          </div>
        </div>
        <div className="bg-white p-3 rounded-md border border-[#e8decb] shadow-2xs">
          <div className="text-[10px] text-[#7d6553] uppercase font-semibold">Allocated on Sites</div>
          <div className="text-sm font-bold text-emerald-700 font-mono mt-0.5">
            {formatQuantity(cards.siteAllocatedQty, 'Nos')}
          </div>
        </div>
        <div className="bg-white p-3 rounded-md border border-[#e8decb] shadow-2xs">
          <div className="text-[10px] text-[#7d6553] uppercase font-semibold">Quarantine (Damaged)</div>
          <div className="text-sm font-bold text-amber-700 font-mono mt-0.5">
            {formatQuantity(cards.damagedQty, 'Nos')}
          </div>
        </div>
        <div className="bg-white p-3 rounded-md border border-[#e8decb] shadow-2xs">
          <div className="text-[10px] text-[#7d6553] uppercase font-semibold">Unreconciled Missing</div>
          <div className="text-sm font-bold text-rose-700 font-mono mt-0.5">
            {formatQuantity(cards.missingQty, 'Nos')}
          </div>
        </div>
        <div className="bg-white p-3 rounded-md border border-[#e8decb] shadow-2xs">
          <div className="text-[10px] text-[#7d6553] uppercase font-semibold">Outstanding Balance</div>
          <div className="text-sm font-bold text-[#24160c] font-mono mt-0.5">
            {formatINR(cards.outstandingReceivables, false)}
          </div>
        </div>
      </div>

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category Allocation Chart */}
        <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
          <div className="px-4 py-3 border-b border-[#ebdcc9] bg-[#fdfcf9] flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-[#24160c] uppercase tracking-wider">
                Material Allocation by Category
              </h2>
            </div>
            <Link 
              href="/inventory" 
              className="text-xs font-medium text-[#6e482f] hover:text-[#24160c] flex items-center gap-1"
            >
              <span>Inventory</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="p-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.categoryAllocation || []} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f2eadf" vertical={false} />
                <XAxis 
                  dataKey="category" 
                  tick={{ fontSize: 10, fill: '#7d6553' }} 
                  interval={0} 
                  angle={-15} 
                  textAnchor="end" 
                  height={45} 
                  tickFormatter={(val: string) => val.replace(/Cuplock\s+/gi, '')}
                />
                <YAxis tick={{ fontSize: 10, fill: '#7d6553' }} width={38} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#d8c8b4', borderRadius: '6px', fontSize: '11px' }} 
                  formatter={(val: any) => [`${val.toLocaleString()} Nos`, '']}
                />
                <Legend 
                  verticalAlign="top" 
                  align="right" 
                  wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }} 
                />
                <Bar dataKey="warehouse" name="Yard Usable" fill="#24160c" radius={[2, 2, 0, 0]} />
                <Bar dataKey="onSite" name="On Client Sites" fill="#8c5e39" radius={[2, 2, 0, 0]} />
                <Bar dataKey="reserved" name="Reserved Plan" fill="#c79e7c" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Chart */}
        <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
          <div className="px-4 py-3 border-b border-[#ebdcc9] bg-[#fdfcf9] flex items-center justify-between">
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
          <div className="p-4 h-72 flex items-center justify-center">
            {(charts.projectsByStatus || []).length === 0 ? (
              <div className="text-center p-6 text-slate-400">
                <FolderKanban className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="font-medium text-slate-600 text-xs">No active project records</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.projectsByStatus || []}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius={70}
                    innerRadius={38}
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

      {/* Critical Expiry & Deadlines Table */}
      <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-[#ebdcc9] bg-[#fdfcf9] flex items-center justify-between">
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
                  <td colSpan={7} className="px-4 py-6 text-center text-[#9c826e]">
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
    </div>
  );
}
