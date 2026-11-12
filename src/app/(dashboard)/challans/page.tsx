'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ScrollText,
  Plus,
  Search,
  Download,
  Eye,
  Edit3,
  Trash2,
  Building2,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
} from 'lucide-react';
import { Challan } from '@/lib/schema';
import { formatDate } from '@/lib/formatters';
import { useAuth } from '@/lib/auth/auth-context';

const PAGE_SIZE = 10;

export default function ChallanDirectoryPage() {
  const { currentUser, can } = useAuth();

  const [challans, setChallans] = useState<Challan[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [siteFilter, setSiteFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNCLOSED' | 'CLOSED'>('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Delete Modal
  const [deleteTarget, setDeleteTarget] = useState<Challan | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchChallans = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/challans');
      const json = await res.json();
      if (json.success) {
        setChallans(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch challans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallans();
  }, []);

  const uniqueCustomers = useMemo(
    () =>
      Array.from(
        new Map(challans.map(c => [c.customerId, { id: c.customerId, name: c.customerName }])).values()
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [challans]
  );

  const uniqueSites = useMemo(() => {
    const base =
      customerFilter === 'ALL' ? challans : challans.filter(c => c.customerId === customerFilter);
    return Array.from(new Set(base.map(c => c.siteName).filter(Boolean))).sort();
  }, [challans, customerFilter]);

  const filteredChallans = useMemo(() => {
    return challans.filter(c => {
      if (customerFilter !== 'ALL' && c.customerId !== customerFilter) return false;
      if (siteFilter !== 'ALL' && c.siteName !== siteFilter) return false;
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (dateFilter && c.issueDate !== dateFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          c.challanNumber.toLowerCase().includes(q) ||
          c.customerName.toLowerCase().includes(q) ||
          c.siteName.toLowerCase().includes(q) ||
          (c.size && c.size.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [challans, customerFilter, siteFilter, statusFilter, dateFilter, searchQuery]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [customerFilter, siteFilter, statusFilter, dateFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredChallans.length / PAGE_SIZE));
  const paginatedChallans = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredChallans.slice(start, start + PAGE_SIZE);
  }, [filteredChallans, currentPage]);

  const summary = useMemo(() => {
    return {
      total: challans.length,
      unclosed: challans.filter(c => c.status === 'UNCLOSED').length,
      closed: challans.filter(c => c.status === 'CLOSED').length,
      totalOutput: challans.reduce((s, c) => s + (c.totalOutputQuantity || 0), 0),
      totalReturned: challans.reduce((s, c) => s + (c.totalReturnedQuantity || 0), 0),
      totalPendingAtSite: challans.reduce((s, c) => s + (c.remainingAtSiteQuantity ?? c.pendingQuantity ?? 0), 0),
    };
  }, [challans]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/challans/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorId: currentUser?.id || 'usr-admin-01',
          actorName: currentUser?.fullName || 'Admin',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to delete challan');
      }
      setChallans(prev => prev.filter(c => c.id !== deleteTarget.id));
      setBanner({
        type: 'success',
        text: `Challan ${deleteTarget.challanNumber} deleted and remaining warehouse allocations restored.`,
      });
      setDeleteTarget(null);
    } catch (err: any) {
      setBanner({ type: 'error', text: err.message || 'Delete failed.' });
    } finally {
      setDeleting(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Challan Number',
      'Customer Name',
      'Site Name',
      'Size',
      'Issue Date',
      'Total Output Quantity',
      'Total Returned Quantity',
      'Pending Quantity',
      'Lost Quantity',
      'Challan Status',
    ];
    const rows = filteredChallans.map(c => [
      c.challanNumber,
      `"${c.customerName.replace(/"/g, '""')}"`,
      `"${c.siteName.replace(/"/g, '""')}"`,
      `"${(c.size || '').replace(/"/g, '""')}"`,
      c.issueDate,
      c.totalOutputQuantity,
      c.totalReturnedQuantity,
      c.remainingAtSiteQuantity ?? c.pendingQuantity,
      c.totalLostQuantity || 0,
      c.status === 'CLOSED' ? 'Closed' : 'Unclosed',
    ]);
    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `alokhandwala_challans_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setCustomerFilter('ALL');
    setSiteFilter('ALL');
    setStatusFilter('ALL');
    setDateFilter('');
  };

  return (
    <div className="space-y-5">
      {/* Feedback Banner */}
      {banner && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center justify-between gap-2 shadow-2xs ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
            )}
            <span className="font-semibold">{banner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="p-1 opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-[#24160c] border border-[#19100a] rounded-lg p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <span className="text-[11px] font-mono tracking-widest text-[#c79e7c] uppercase block mb-1">
            Core Operations · Material Dispatch & Return
          </span>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-[#c79e7c]" />
            <span>Challan Directory</span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-200 bg-[#382315] hover:bg-[#4a301e] border border-[#523622] rounded-md transition shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#c79e7c]" />
            <span>Export CSV</span>
          </button>

          {can('CHALLAN_CREATE') && (
            <Link
              href="/challans/new"
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1c120c] bg-[#c79e7c] hover:bg-[#dfcbab] rounded-md shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Challan</span>
            </Link>
          )}
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-[#e5dac8] shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">Total Challans</span>
          <span className="text-lg font-bold font-mono text-[#24160c] mt-0.5 block">{summary.total}</span>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-[#e5dac8] shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Unclosed</span>
          <span className="text-lg font-bold font-mono text-amber-800 mt-0.5 block">{summary.unclosed}</span>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-[#e5dac8] shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Closed</span>
          <span className="text-lg font-bold font-mono text-emerald-800 mt-0.5 block">{summary.closed}</span>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-[#e5dac8] shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">Total Output Qty</span>
          <span className="text-lg font-bold font-mono text-[#24160c] mt-0.5 block">
            {summary.totalOutput.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-[#e5dac8] shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">Total Returned Qty</span>
          <span className="text-lg font-bold font-mono text-emerald-700 mt-0.5 block">
            {summary.totalReturned.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-[#e5dac8] shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">Pending at Site</span>
          <span className="text-lg font-bold font-mono text-amber-800 mt-0.5 block">
            {summary.totalPendingAtSite.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white rounded-lg border border-[#e5dac8] p-4 space-y-3 shadow-2xs text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-[#9c826e] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Challan Number, Customer Name, or Site Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c] focus:bg-white focus:border-[#8f6541] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 bg-[#f7f2eb] border border-[#e5dac8] rounded font-semibold text-[#24160c]">
              Challans Found: <strong className="font-mono">{filteredChallans.length}</strong>
            </span>
            {(searchQuery || customerFilter !== 'ALL' || siteFilter !== 'ALL' || statusFilter !== 'ALL' || dateFilter) && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-stone-600 hover:text-[#24160c] bg-[#fbf9f5] border border-[#d6c7b2] rounded cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
              Customer
            </label>
            <select
              value={customerFilter}
              onChange={(e) => {
                setCustomerFilter(e.target.value);
                setSiteFilter('ALL');
              }}
              className="w-full px-2.5 py-1.5 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c]"
            >
              <option value="ALL">All Customers</option>
              {uniqueCustomers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
              Site
            </label>
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c]"
            >
              <option value="ALL">All Sites</option>
              {uniqueSites.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-[#24160c]"
            >
              <option value="ALL">All Statuses</option>
              <option value="UNCLOSED">Unclosed</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
              Issue Date
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md font-mono text-[#24160c]"
            />
          </div>
        </div>
      </div>

      {/* Challan Table / Cards */}
      <div className="bg-white rounded-lg border border-[#e5dac8] shadow-2xs overflow-hidden">
        {/* Mobile Cards */}
        <div className="block md:hidden divide-y divide-[#f0e8db]">
          {loading ? (
            <div className="p-8 text-center text-xs text-stone-400">Loading challan records...</div>
          ) : paginatedChallans.length === 0 ? (
            <div className="p-8 text-center space-y-2 text-xs text-stone-500">
              <p>No challans match the current filters.</p>
              {can('CHALLAN_CREATE') && (
                <Link
                  href="/challans/new"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#24160c] text-[#c79e7c] rounded font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Challan</span>
                </Link>
              )}
            </div>
          ) : (
            paginatedChallans.map(c => {
              const pendingAtSite = c.remainingAtSiteQuantity ?? c.pendingQuantity;
              return (
                <div key={c.id} className="p-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <Link href={`/challans/${c.id}`} className="font-mono font-bold text-sm text-[#24160c] hover:underline">
                      {c.challanNumber}
                    </Link>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                        c.status === 'CLOSED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          c.status === 'CLOSED' ? 'bg-emerald-600' : 'bg-amber-600'
                        }`}
                      />
                      <span>{c.status === 'CLOSED' ? 'Closed' : 'Unclosed'}</span>
                    </span>
                  </div>

                  <div>
                    <div className="font-bold text-[#24160c]">{c.customerName}</div>
                    <div className="text-stone-500 flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="truncate">{c.siteName}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-[#f0e8db] text-[11px]">
                    <div>
                      <span className="text-stone-400 block">Size:</span>
                      <span className="font-mono text-stone-800">{c.size}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block">Issue Date:</span>
                      <span className="font-mono text-stone-800">{formatDate(c.issueDate)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-2 bg-[#fbf9f5] rounded border border-[#ede3d4] text-center font-mono">
                    <div>
                      <span className="text-[10px] text-stone-400 font-sans block">Output</span>
                      <span className="font-bold text-[#24160c]">{c.totalOutputQuantity}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 font-sans block">Returned</span>
                      <span className="font-bold text-emerald-700">{c.totalReturnedQuantity}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 font-sans block">Pending</span>
                      <span className={`font-bold ${pendingAtSite > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                        {pendingAtSite}
                      </span>
                    </div>
                  </div>

                  {c.hasLostMaterials && (
                    <div className="text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-1 rounded border border-rose-200">
                      Lost / Missing: {c.totalLostQuantity} unit(s)
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Link
                      href={`/challans/${c.id}`}
                      className="px-2.5 py-1 bg-[#f7f2eb] border border-[#d6c7b2] rounded font-semibold text-[#24160c]"
                    >
                      View
                    </Link>
                    {can('CHALLAN_EDIT') && (
                      <Link
                        href={`/challans/${c.id}/edit`}
                        className="px-2.5 py-1 bg-white border border-[#d6c7b2] rounded font-semibold text-[#714f36]"
                      >
                        Edit
                      </Link>
                    )}
                    {can('CHALLAN_DELETE') && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(c)}
                        className="px-2.5 py-1 bg-rose-50 border border-rose-300 rounded font-semibold text-rose-800 cursor-pointer"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#fbf9f5] text-[10px] font-bold uppercase tracking-wider text-stone-500 border-b border-[#e8decb]">
              <tr>
                <th className="px-3.5 py-3 whitespace-nowrap">Challan Number</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Customer Name</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Site Name</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Size</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Issue Date</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-right">Total Output Qty</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-right">Total Returned Qty</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-right">Pending Qty</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Challan Status</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0e8db]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-stone-400">
                    Loading challan directory...
                  </td>
                </tr>
              ) : paginatedChallans.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-stone-500 space-y-2">
                    <div>No challan records found.</div>
                    {can('CHALLAN_CREATE') && (
                      <Link
                        href="/challans/new"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#24160c] text-[#c79e7c] rounded-md font-bold mt-2"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Challan</span>
                      </Link>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedChallans.map(c => {
                  const pendingAtSite = c.remainingAtSiteQuantity ?? c.pendingQuantity;
                  return (
                    <tr key={c.id} className="hover:bg-[#fcfbf9] transition">
                      <td className="px-3.5 py-3 font-mono font-bold text-[#24160c] whitespace-nowrap">
                        <Link href={`/challans/${c.id}`} className="hover:underline hover:text-[#8f6541]">
                          {c.challanNumber}
                        </Link>
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="font-semibold text-stone-900 whitespace-nowrap">{c.customerName}</div>
                        {c.customerPhone && (
                          <div className="text-[10px] text-stone-400 font-mono">{c.customerPhone}</div>
                        )}
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="font-medium text-stone-800 max-w-[180px] truncate" title={c.siteName}>
                          {c.siteName}
                        </div>
                      </td>
                      <td className="px-3.5 py-3 font-mono text-stone-700 max-w-[170px] truncate" title={c.size}>
                        {c.size}
                      </td>
                      <td className="px-3.5 py-3 font-mono text-stone-700 whitespace-nowrap">
                        {formatDate(c.issueDate)}
                      </td>
                      <td className="px-3.5 py-3 font-mono font-bold text-right text-[#24160c] whitespace-nowrap">
                        {c.totalOutputQuantity.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3.5 py-3 font-mono font-bold text-right text-emerald-700 whitespace-nowrap">
                        {c.totalReturnedQuantity.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3.5 py-3 font-mono text-right whitespace-nowrap">
                        <span className={`font-bold ${pendingAtSite > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                          {pendingAtSite.toLocaleString('en-IN')}
                        </span>
                        {c.hasLostMaterials && (
                          <div className="text-[10px] font-sans font-bold text-rose-700">
                            {c.totalLostQuantity} Lost/Missing
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold border ${
                            c.status === 'CLOSED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              c.status === 'CLOSED' ? 'bg-emerald-600' : 'bg-amber-600'
                            }`}
                          />
                          <span>{c.status === 'CLOSED' ? 'Closed' : 'Unclosed'}</span>
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/challans/${c.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-stone-800 bg-[#f7f2eb] hover:bg-[#ebdcc9] border border-[#d6c7b2] rounded-md transition"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#8f6541]" />
                            <span>View</span>
                          </Link>
                          {can('CHALLAN_EDIT') && (
                            <Link
                              href={`/challans/${c.id}/edit`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#714f36] bg-white hover:bg-[#faf6ee] border border-[#d6c7b2] rounded-md transition"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </Link>
                          )}
                          {can('CHALLAN_DELETE') && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(c)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-md transition cursor-pointer"
                              title="Delete Challan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredChallans.length > PAGE_SIZE && (
          <div className="px-4 py-3 bg-[#fbf9f5] border-t border-[#e8decb] flex items-center justify-between text-xs">
            <span className="text-stone-600">
              Showing{' '}
              <strong>
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredChallans.length)}
              </strong>{' '}
              of <strong>{filteredChallans.length}</strong> challans
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-[#d6c7b2] rounded disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <span className="px-2 font-mono font-semibold text-[#24160c]">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-[#d6c7b2] rounded disabled:opacity-40 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#140b06]/70 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-2xl border border-[#d6c7b2] p-6 space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#24160c]">Delete Challan {deleteTarget.challanNumber}?</h3>
                <p className="text-stone-600 mt-1">
                  This will remove <strong>{deleteTarget.challanNumber}</strong> ({deleteTarget.customerName} ·{' '}
                  {deleteTarget.siteName}) and restore any unreturned material allocations back into warehouse stock.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#f0e8db]">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-1.5 border border-[#d6c7b2] rounded-md font-semibold text-stone-700 hover:bg-[#faf6ee] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-md font-bold cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

