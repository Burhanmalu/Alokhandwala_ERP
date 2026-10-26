'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  FolderKanban, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Boxes, 
  ShieldAlert, 
  ReceiptIndianRupee, 
  ArrowUpRight, 
  PlusCircle, 
  Repeat, 
  Truck, 
  Calendar,
  Layers,
  ArrowRight,
  MapPin
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
import { formatINR, formatQuantity, formatDate, getStatusBadgeConfig } from '@/lib/formatters';
import { useAuth } from '@/lib/auth/auth-context';

export default function DashboardPage() {
  const router = useRouter();
  const { can, currentUser } = useAuth();
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
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/4"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-80 bg-slate-200 rounded-xl"></div>
          <div className="h-80 bg-slate-200 rounded-xl"></div>
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
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#20140b] via-[#2f1c10] to-[#422716] rounded-2xl p-4 sm:p-6 text-white shadow-md border border-[#52331d]/70 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-5 sm:gap-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="hidden sm:flex w-12 h-12 rounded-xl bg-[#140c07]/70 border border-[#52331d] p-2 items-center justify-center shrink-0 shadow-inner">
            <img src="/logo-icon-accent.png" alt="Alokhandwala Logo" className="w-full h-full object-contain filter drop-shadow" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wider text-[#dfcbab]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#dfcbab] animate-pulse"></span>
                ALOKHANDWALA
              </span>
              <span>•</span>
              <span className="px-2 py-0.5 rounded-md bg-white/10 text-[#fdfcf9] font-mono text-[10px] tracking-wider uppercase border border-white/10">
                {currentUser.role.replace('_', ' ')}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#fdfcf9]">Operations & Asset Control Hub</h1>
            <p className="text-xs text-[#dfcbab]/85 max-w-2xl leading-relaxed">
              Real-time tracking of site inspections, warehouse reservations, active rentals, shifting logistics, and dismantling reconciliation.
            </p>
          </div>
        </div>

        {/* Quick Actions Toolbar */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full xl:w-auto">
          {can('PROJECT_CREATE_INSPECTION') && (
            <Link
              href="/projects/new"
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-[#24160c] bg-[#faf6ee] hover:bg-white rounded-xl shadow-xs hover:shadow transition min-h-[40px]"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#6e482f] shrink-0" />
              <span className="truncate">Inspection Form</span>
            </Link>
          )}

          <Link
            href="/sites/new"
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#fdfcf9] bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl transition min-h-[40px]"
          >
            <MapPin className="w-3.5 h-3.5 text-[#dfcbab] shrink-0" />
            <span className="truncate">Site Form</span>
          </Link>

          <Link
            href="/confirmation"
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#fdfcf9] bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl transition min-h-[40px]"
          >
            <Boxes className="w-3.5 h-3.5 text-[#dfcbab] shrink-0" />
            <span className="truncate">Confirmation</span>
          </Link>

          <Link
            href="/installation"
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#fdfcf9] bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl transition min-h-[40px]"
          >
            <Truck className="w-3.5 h-3.5 text-[#dfcbab] shrink-0" />
            <span className="truncate">Installation</span>
          </Link>

          <Link
            href="/projects"
            className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-[#dfcbab] hover:text-white bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl transition min-h-[40px]"
          >
            <span>All Projects</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Primary KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Active Rentals */}
        <Link href="/projects?status=ACTIVE_RENTAL" className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-300 transition group">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Active Rentals</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {cards.activeRentalCount || 0}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
            <span>₹{formatINR(cards.monthlyRentalRunRate, false)} /mo run rate</span>
          </div>
        </Link>

        {/* Not Installed (Awaiting Confirmation) */}
        <Link href="/projects?status=NOT_INSTALLED" className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition group">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Awaiting Confirmation</span>
            <FolderKanban className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {cards.notInstalledCount || 0}
          </div>
          <div className="text-[11px] text-blue-600 font-medium mt-1">
            Site inspections submitted
          </div>
        </Link>

        {/* Buffer Period (2-3 Days) */}
        <Link href="/projects?status=BUFFER_PERIOD" className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-amber-300 transition group">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Buffer Period Active</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-2 font-mono">
            {cards.bufferCount || 0}
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">
            Removal planning (2-3 days)
          </div>
        </Link>

        {/* Removal Pending & Overdue */}
        <Link href="/projects?status=REMOVAL_PENDING" className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-red-300 transition group">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Pending Dismantling</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-2 font-mono">
            {cards.removalCount || 0}
          </div>
          <div className="text-[11px] text-rose-700 font-medium mt-1">
            {cards.overdueRemovalsCount > 0 ? `${cards.overdueRemovalsCount} overdue removals` : 'All within deadline'}
          </div>
        </Link>
      </div>

      {/* Secondary Operational Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs">
          <div className="text-slate-400">Warehouse Usable</div>
          <div className="text-base font-bold text-slate-800 font-mono mt-0.5">
            {formatQuantity(cards.usableWarehouseQty, 'Nos')}
          </div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs">
          <div className="text-slate-400">Reserved for Projects</div>
          <div className="text-base font-bold text-blue-700 font-mono mt-0.5">
            {formatQuantity(cards.reservedQty, 'Nos')}
          </div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs">
          <div className="text-slate-400">Allocated at Sites</div>
          <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">
            {formatQuantity(cards.siteAllocatedQty, 'Nos')}
          </div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs">
          <div className="text-slate-400">Damaged (Quarantine)</div>
          <div className="text-base font-bold text-amber-700 font-mono mt-0.5">
            {formatQuantity(cards.damagedQty, 'Nos')}
          </div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs">
          <div className="text-slate-400">Missing / Unreconciled</div>
          <div className="text-base font-bold text-rose-700 font-mono mt-0.5">
            {formatQuantity(cards.missingQty, 'Nos')}
          </div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs">
          <div className="text-slate-400">Outstanding Invoices</div>
          <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
            {formatINR(cards.outstandingReceivables, false)}
          </div>
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Material Allocation by Category */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Material Allocation by Category</h2>
              <p className="text-xs text-slate-500">Warehouse stock vs Site-allocated vs Reserved</p>
            </div>
            <Link href="/inventory" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
              <span>Inventory</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.categoryAllocation || []} margin={{ top: 10, right: 15, left: 15, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis 
                  dataKey="category" 
                  tick={{ fontSize: 11, fill: '#64748b' }} 
                  interval={0} 
                  angle={-20} 
                  textAnchor="end" 
                  height={55} 
                  tickMargin={6}
                  tickFormatter={(val: string) => {
                    const clean = val
                      .replace(/Cuplock\s+/gi, '')
                      .replace(/\s*\((Standards|Horizontals)\)/gi, '')
                      .replace(/\s*&\s*Platforms/gi, '')
                      .replace(/\s*&\s*Base Plates/gi, '');
                    return clean;
                  }}
                />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={42} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px' }} 
                  formatter={(val: any) => [`${val.toLocaleString()} Nos`, '']}
                  labelFormatter={(label) => `Category: ${label}`}
                />
                <Legend 
                  verticalAlign="top" 
                  align="right" 
                  wrapperStyle={{ paddingBottom: '14px', fontSize: '11px' }} 
                />
                <Bar dataKey="warehouse" name="Warehouse Usable" fill="#1e3b2e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="onSite" name="On Customer Sites" fill="#059669" radius={[3, 3, 0, 0]} />
                <Bar dataKey="reserved" name="Reserved (Upcoming)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Projects by Lifecycle Status */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Projects by Operational Status</h2>
              <p className="text-xs text-slate-500">Real-time status breakdown across all client sites</p>
            </div>
            <Link href="/projects" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
              <span>All Projects</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="h-80 flex items-center justify-center">
            {(charts.projectsByStatus || []).length === 0 ? (
              <div className="text-center p-6 text-slate-400">
                <FolderKanban className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="font-medium text-slate-600">No project activity yet</p>
                <p className="text-[11px] mt-0.5">Register a new site to start operational tracking</p>
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
                    outerRadius={75}
                    innerRadius={40}
                    paddingAngle={3}
                  >
                    {(charts.projectsByStatus || []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#64748b'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px' }} />
                  <Legend 
                    wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} 
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

      {/* Upcoming Expiry & Removal Deadlines */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Critical Deadlines & Buffer Removals</h2>
            <p className="text-xs text-slate-500">Upcoming rental expirations and approved buffer removal dates</p>
          </div>
          <Link href="/projects" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
            View All
          </Link>
        </div>

        {/* Mobile Deadlines Card List (Phone View) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {upcomingDeadlines.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No upcoming deadlines within the next 30 days.
            </div>
          ) : (
            upcomingDeadlines.map((item: any) => {
              const badge = getStatusBadgeConfig(item.status);
              const isOverdue = item.daysLeft < 0;
              const isImminent = item.daysLeft <= 3 && item.daysLeft >= 0;

              return (
                <div key={item.id} className="p-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">{item.projectCode}</span>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.className}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                      {badge.label}
                    </span>
                  </div>

                  <div>
                    <div className="font-semibold text-slate-800">{item.customerName}</div>
                    <div className="text-slate-500 text-[11px]">{item.siteName}</div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      item.type === 'BUFFER_DEADLINE' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {item.type === 'BUFFER_DEADLINE' ? 'Removal Buffer' : 'Rental Expiry'}
                    </span>
                    <span className={`font-mono font-semibold ${
                      isOverdue ? 'text-red-600' : isImminent ? 'text-amber-600' : 'text-slate-700'
                    }`}>
                      {isOverdue ? `${Math.abs(item.daysLeft)}d overdue` : `${item.daysLeft}d left`} ({formatDate(item.targetDate)})
                    </span>
                  </div>

                  <div className="pt-1">
                    <Link
                      href={`/projects/${item.id}`}
                      className="w-full flex items-center justify-center py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition min-h-[38px]"
                    >
                      Manage Project →
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Deadlines Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-100">
              <tr>
                <th className="px-5 py-3">Project ID</th>
                <th className="px-5 py-3">Customer & Site</th>
                <th className="px-5 py-3">Deadline Type</th>
                <th className="px-5 py-3">Target Date</th>
                <th className="px-5 py-3">Days Remaining</th>
                <th className="px-5 py-3">Current Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {upcomingDeadlines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-6 text-center text-slate-400">
                    No upcoming deadlines within the next 30 days.
                  </td>
                </tr>
              ) : (
                upcomingDeadlines.map((item: any) => {
                  const badge = getStatusBadgeConfig(item.status);
                  const isOverdue = item.daysLeft < 0;
                  const isImminent = item.daysLeft <= 3 && item.daysLeft >= 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-3 font-mono font-medium text-slate-900">
                        {item.projectCode}
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-900">{item.customerName}</div>
                        <div className="text-slate-500 text-[11px]">{item.siteName}</div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          item.type === 'BUFFER_DEADLINE' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.type === 'BUFFER_DEADLINE' ? 'Removal Buffer' : 'Rental Expiry'}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono">
                        {formatDate(item.targetDate)}
                      </td>
                      <td className="px-5 py-3 font-mono">
                        <span className={`font-semibold ${
                          isOverdue ? 'text-red-600' : isImminent ? 'text-amber-600' : 'text-slate-700'
                        }`}>
                          {isOverdue ? `${Math.abs(item.daysLeft)} days overdue` : `${item.daysLeft} days left`}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.className}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/projects/${item.id}`}
                          className="px-2.5 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition"
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
