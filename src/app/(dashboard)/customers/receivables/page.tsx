'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Search,
  ReceiptIndianRupee,
  AlertTriangle,
  ExternalLink,
  Filter,
  Building2,
  X,
  RefreshCw,
} from 'lucide-react';
import { PageContainer } from '@/components/ui/PageContainer';
import { Customer, Project } from '@/lib/schema';
import {
  formatDate,
  formatINR,
  getEffectiveRemovalDate,
  getProjectOutstandingBalance,
  getStatusBadgeConfig,
  getRemainingDaysInfo,
  isReceivableEligibleProjectStatus,
} from '@/lib/formatters';

function CustomerReceivablesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCustomerId = searchParams.get('customerId') || '';

  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>(initialCustomerId);

  useEffect(() => {
    setCustomerFilter(initialCustomerId);
  }, [initialCustomerId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projRes, custRes] = await Promise.all([
        fetch('/api/projects', { cache: 'no-store' }),
        fetch('/api/customers', { cache: 'no-store' }),
      ]);
      const projJson = await projRes.json();
      const custJson = await custRes.json();
      if (!projRes.ok || !projJson.success) {
        throw new Error(projJson.error || 'Failed to load projects');
      }
      setProjects(projJson.data || []);
      if (custRes.ok && custJson.success) {
        setCustomers(custJson.data || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load outstanding projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Only projects with receivable-eligible status and positive outstanding balance
  const eligibleProjects = useMemo(() => {
    return projects
      .filter((p) => {
        if (!isReceivableEligibleProjectStatus(p.status)) return false;
        return getProjectOutstandingBalance(p) > 0;
      })
      .map((p) => {
        const total = Number(p.totalAmount ?? p.agreedProjectPrice ?? p.quotationAmount ?? 0);
        const received = Number(p.paymentReceived ?? p.advancePaidAmount ?? 0);
        const balance = getProjectOutstandingBalance(p);
        const installDate = p.actualInstallationDate || p.installationDate || p.plannedInstallationDate;
        const removalDate = getEffectiveRemovalDate(p);
        const remainingInfo = getRemainingDaysInfo(removalDate, p.status);
        const overdueDays =
          remainingInfo.days !== null && remainingInfo.days < 0 ? Math.abs(remainingInfo.days) : 0;

        return {
          project: p,
          total,
          received,
          balance,
          installDate,
          removalDate,
          overdueDays,
          remainingInfo,
        };
      });
  }, [projects]);

  const filteredRows = useMemo(() => {
    return eligibleProjects.filter((row) => {
      if (customerFilter && row.project.customerId !== customerFilter) {
        return false;
      }
      if (statusFilter !== 'ALL' && row.project.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = (row.project.projectCode || '').toLowerCase().includes(q);
        const matchCust = (row.project.customerName || '').toLowerCase().includes(q);
        const matchSite = (row.project.siteName || '').toLowerCase().includes(q);
        if (!matchCode && !matchCust && !matchSite) return false;
      }
      return true;
    });
  }, [eligibleProjects, customerFilter, statusFilter, searchQuery]);

  const totalReceivables = useMemo(
    () => Math.round(filteredRows.reduce((sum, r) => sum + r.balance, 0) * 100) / 100,
    [filteredRows]
  );

  const overdueCount = useMemo(
    () => filteredRows.filter((r) => r.overdueDays > 0).length,
    [filteredRows]
  );

  const selectedCustomerName = useMemo(() => {
    if (!customerFilter) return null;
    return (
      customers.find((c) => c.id === customerFilter)?.companyName ||
      eligibleProjects.find((r) => r.project.customerId === customerFilter)?.project.customerName ||
      'Selected Customer'
    );
  }, [customerFilter, customers, eligibleProjects]);

  const availableStatuses = useMemo(() => {
    const set = new Set<string>(eligibleProjects.map((r) => r.project.status));
    return Array.from(set);
  }, [eligibleProjects]);

  return (
    <PageContainer className="space-y-5">
      {/* Top Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link
            href="/customers"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#714f36] hover:text-[#24160c] mb-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Customers</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-[#24160c] tracking-tight flex items-center gap-2">
            <ReceiptIndianRupee className="w-5 h-5 text-[#8c5e39]" />
            <span>Outstanding & Overdue Receivables</span>
          </h1>
          <p className="text-xs text-[#7d6553] mt-0.5">
            Eligible active & confirmed projects with pending balance (Confirmed, Scheduled, Active Rental / Installed, Removal Pending)
          </p>
        </div>

        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#faf6ee] text-[#4d301c] border border-[#d6c7b2] rounded-md text-xs font-semibold shadow-2xs transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-[#e8decb] rounded-lg p-3.5 shadow-2xs">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#7d6553]">
            {selectedCustomerName ? `${selectedCustomerName} · Receivables` : 'Total Eligible Receivables'}
          </div>
          <div className={`text-xl font-bold font-mono mt-1 ${totalReceivables > 0 ? 'text-amber-800' : 'text-[#24160c]'}`}>
            {formatINR(totalReceivables).replace(/\.00$/, '')}
          </div>
          <div className="text-[11px] text-[#9c826e] mt-0.5">
            Sum of (Agreed Amount − Received) for eligible projects
          </div>
        </div>

        <div className="bg-white border border-[#e8decb] rounded-lg p-3.5 shadow-2xs">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#7d6553]">
            Outstanding Projects
          </div>
          <div className="text-xl font-bold font-mono text-[#24160c] mt-1">
            {filteredRows.length}
          </div>
          <div className="text-[11px] text-[#9c826e] mt-0.5">
            Projects with balance &gt; ₹0
          </div>
        </div>

        <div className="bg-white border border-[#e8decb] rounded-lg p-3.5 shadow-2xs">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#7d6553]">
            Overdue Rental / Removal
          </div>
          <div className={`text-xl font-bold font-mono mt-1 ${overdueCount > 0 ? 'text-rose-700' : 'text-[#24160c]'}`}>
            {overdueCount}
          </div>
          <div className="text-[11px] text-[#9c826e] mt-0.5">
            Past effective removal / expiry date
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-3 rounded-lg border border-[#e8decb] shadow-2xs flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-[#9c826e] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by project ID, customer name, or site name..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#fbf9f5] border border-[#d8c8b4] rounded-md text-[#24160c] focus:bg-white focus:border-[#8c5e39] focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#8c5e39]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-[#fbf9f5] border border-[#d8c8b4] rounded-md text-[#24160c] font-medium focus:outline-none"
            >
              <option value="ALL">All Eligible Statuses</option>
              {availableStatuses.map((st) => (
                <option key={st} value={st}>
                  {getStatusBadgeConfig(st).label}
                </option>
              ))}
            </select>
          </div>

          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-[#fbf9f5] border border-[#d8c8b4] rounded-md text-[#24160c] font-medium focus:outline-none max-w-[220px]"
          >
            <option value="">All Customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>

          {customerFilter && (
            <button
              type="button"
              onClick={() => {
                setCustomerFilter('');
                router.replace('/customers/receivables');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-[#faf6ee] text-[#59371d] border border-[#d8c8b4] rounded-md hover:bg-[#ebdcc9] cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Clear Customer</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-800 font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Listing */}
      {loading ? (
        <div className="bg-white border border-[#e8decb] rounded-lg p-10 text-center text-xs text-stone-500">
          Loading eligible receivable projects...
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="bg-white border border-[#e8decb] rounded-lg p-10 text-center space-y-2">
          <Building2 className="w-8 h-8 text-[#c79e7c] mx-auto" />
          <div className="text-sm font-bold text-[#24160c]">No Outstanding Eligible Projects Found</div>
          <p className="text-xs text-[#7d6553] max-w-md mx-auto">
            There are no projects in Confirmed, Scheduled, Active Rental / Installed, or Removal Pending status with a pending balance matching your filters.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredRows.map(({ project: p, total, received, balance, installDate, removalDate, overdueDays }) => {
              const badge = getStatusBadgeConfig(p.status);
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="block bg-white border border-[#e8decb] rounded-lg p-3.5 shadow-2xs space-y-2.5 hover:border-[#8c5e39] transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono font-bold text-xs text-[#24160c] flex items-center gap-1.5">
                        <span>{p.projectCode}</span>
                        <ExternalLink className="w-3 h-3 text-[#8c5e39]" />
                      </div>
                      <div className="font-semibold text-xs text-[#4d301c] mt-0.5">{p.customerName}</div>
                      <div className="text-[11px] text-[#7d6553]">{p.siteName}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#f2eadf] text-[11px]">
                    <div>
                      <div className="text-[#9c826e] text-[10px]">Total</div>
                      <div className="font-mono font-semibold text-[#24160c]">{formatINR(total).replace(/\.00$/, '')}</div>
                    </div>
                    <div>
                      <div className="text-[#9c826e] text-[10px]">Received</div>
                      <div className="font-mono font-semibold text-emerald-700">{formatINR(received).replace(/\.00$/, '')}</div>
                    </div>
                    <div>
                      <div className="text-[#9c826e] text-[10px]">Outstanding</div>
                      <div className="font-mono font-bold text-amber-800">{formatINR(balance).replace(/\.00$/, '')}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#7d6553] pt-1">
                    <span>Install: {installDate ? formatDate(installDate) : '—'}</span>
                    <span>Removal: {removalDate ? formatDate(removalDate) : '—'}</span>
                    {overdueDays > 0 && (
                      <span className="font-bold text-rose-700">{overdueDays}d overdue</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white border border-[#e8decb] rounded-lg shadow-2xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#fbf9f5] text-[10px] font-bold uppercase tracking-wider text-[#7d6553] border-b border-[#e8decb]">
                <tr>
                  <th className="px-3.5 py-3">Project ID</th>
                  <th className="px-3.5 py-3">Customer</th>
                  <th className="px-3.5 py-3">Site</th>
                  <th className="px-3.5 py-3">Status</th>
                  <th className="px-3.5 py-3">Install Date</th>
                  <th className="px-3.5 py-3">Removal / Expiry</th>
                  <th className="px-3.5 py-3 text-right">Total Amount</th>
                  <th className="px-3.5 py-3 text-right">Received</th>
                  <th className="px-3.5 py-3 text-right">Outstanding</th>
                  <th className="px-3.5 py-3 text-right">Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2eadf]">
                {filteredRows.map(({ project: p, total, received, balance, installDate, removalDate, overdueDays }) => {
                  const badge = getStatusBadgeConfig(p.status);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/projects/${p.id}`)}
                      className="hover:bg-[#fcfaf6] transition cursor-pointer"
                    >
                      <td className="px-3.5 py-2.5 font-mono font-bold text-[#24160c] whitespace-nowrap">
                        <Link
                          href={`/projects/${p.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline inline-flex items-center gap-1"
                        >
                          <span>{p.projectCode}</span>
                          <ExternalLink className="w-3 h-3 text-[#8c5e39]" />
                        </Link>
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-[#24160c]">{p.customerName}</td>
                      <td className="px-3.5 py-2.5 text-[#574830]">{p.siteName}</td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-[#574830] whitespace-nowrap">
                        {installDate ? formatDate(installDate) : '—'}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-[#574830] whitespace-nowrap">
                        {removalDate ? formatDate(removalDate) : '—'}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-right text-[#24160c]">
                        {formatINR(total).replace(/\.00$/, '')}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-right text-emerald-700">
                        {formatINR(received).replace(/\.00$/, '')}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-right font-bold text-amber-800">
                        {formatINR(balance).replace(/\.00$/, '')}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-right whitespace-nowrap">
                        {overdueDays > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]">
                            {overdueDays}d
                          </span>
                        ) : (
                          <span className="text-[#9c826e]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-[#fbf9f5] border-t border-[#e8decb] font-bold text-xs">
                <tr>
                  <td colSpan={8} className="px-3.5 py-2.5 text-right text-[#4d301c]">
                    Total Eligible Receivables:
                  </td>
                  <td className="px-3.5 py-2.5 font-mono text-right text-amber-900">
                    {formatINR(totalReceivables).replace(/\.00$/, '')}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </PageContainer>
  );
}

export default function CustomerReceivablesPage() {
  return (
    <Suspense fallback={<PageContainer className="p-8 text-xs text-stone-500">Loading receivables...</PageContainer>}>
      <CustomerReceivablesContent />
    </Suspense>
  );
}
