'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ArrowLeftRight,
  FileText,
  TrendingUp,
  TrendingDown,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Scale,
  Building2,
  Search,
  RefreshCw,
  Receipt,
  Landmark,
  BarChart3,
  AlertTriangle,
  CreditCard,
  ExternalLink,
  Layers
} from 'lucide-react';
import { formatINR, formatDate } from '@/lib/formatters';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import type { ChartOfAccount, JournalEntry, VendorBill, AccountingPeriod } from '@/lib/schema';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    POSTED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    DRAFT: 'bg-amber-50 text-amber-800 border-amber-200',
    REVERSED: 'bg-rose-50 text-rose-800 border-rose-200',
    PAID: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    PARTIALLY_PAID: 'bg-amber-50 text-amber-800 border-amber-200',
    ACTIVE: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    ARCHIVED: 'bg-stone-100 text-stone-700 border-stone-200',
    ASSET: 'bg-blue-50 text-blue-800 border-blue-200',
    LIABILITY: 'bg-purple-50 text-purple-800 border-purple-200',
    EQUITY: 'bg-amber-50 text-amber-800 border-amber-200',
    REVENUE: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    EXPENSE: 'bg-rose-50 text-rose-800 border-rose-200',
  };
  const cls = map[status] ?? 'bg-stone-100 text-stone-700 border-stone-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function AccountsOverviewPage() {
  const router = useRouter();
  const { currentUser } = useAuth();

  const [coaList, setCoaList] = useState<ChartOfAccount[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [financials, setFinancials] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [coaSearch, setCoaSearch] = useState('');

  useEffect(() => {
    if (currentUser?.role !== 'ADMIN') {
      router.replace(currentUser?.role === 'SUPERVISOR' ? '/sites/new' : '/projects');
    }
  }, [currentUser, router]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [coaRes, jRes, bRes, repRes] = await Promise.all([
        fetch('/api/accounts/chart'),
        fetch('/api/accounts/journals'),
        fetch('/api/accounts/bills'),
        fetch('/api/accounts/reports'),
      ]);
      const [coaData, jData, bData, repData] = await Promise.all([
        coaRes.json(),
        jRes.json(),
        bRes.json(),
        repRes.json(),
      ]);
      if (coaData.success) setCoaList(coaData.data);
      if (jData.success) setJournals(jData.data);
      if (bData.success) setBills(bData.data);
      if (repData.success) setFinancials(repData.data);
    } catch {
      // keep
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filteredCoa = coaList.filter(
    (a) =>
      !coaSearch ||
      a.accountCode.toLowerCase().includes(coaSearch.toLowerCase()) ||
      a.accountName.toLowerCase().includes(coaSearch.toLowerCase())
  );

  const coaByType: Record<string, ChartOfAccount[]> = {};
  for (const a of filteredCoa) {
    if (!coaByType[a.accountType]) coaByType[a.accountType] = [];
    coaByType[a.accountType].push(a);
  }
  const typeOrder = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#24160c] border border-[#19100a] rounded-lg p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono tracking-widest text-[#c79e7c] uppercase">
              Financial Management
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Landmark className="w-5 h-5 text-[#c79e7c]" />
            <span>Accounts & Finance</span>
          </h1>
          <p className="text-xs text-[#debfa6] mt-1">
            Integrated General Ledger · Receivables & Payables · Statutory Chart of Accounts
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/accounts/ledger"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#1c120c] bg-[#c79e7c] hover:bg-[#dfcbab] rounded-md transition shadow-xs"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>General Ledger</span>
          </Link>
          <Link
            href="/accounts/bills"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#debfa6] bg-[#382315] hover:bg-[#4d3221] rounded-md transition"
          >
            <FileText className="w-4 h-4" />
            <span>Vendor Bills</span>
          </Link>
          <Link
            href="/accounts/billing"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#debfa6] bg-[#382315] hover:bg-[#4d3221] rounded-md transition"
          >
            <Receipt className="w-4 h-4" />
            <span>Invoices (AR)</span>
          </Link>
          <button
            onClick={fetchAll}
            className="p-2 rounded-md bg-[#382315] hover:bg-[#4d3221] text-[#debfa6] transition"
            title="Refresh Financials"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Financial Health Summary KPIs */}
      {financials && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs">
            <div className="text-stone-500 text-xs font-medium">Fiscal Revenue (YTD)</div>
            <div className="text-2xl font-bold font-mono text-[#24160c] mt-1">
              {formatINR(financials.profitAndLoss.totalRevenue)}
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1">Operational sales turnover</div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs">
            <div className="text-stone-500 text-xs font-medium">Operating Expenses (YTD)</div>
            <div className="text-2xl font-bold font-mono text-rose-700 mt-1">
              {formatINR(financials.profitAndLoss.totalExpenses)}
            </div>
            <div className="text-[11px] text-stone-500 mt-1">Site costs & procurement outflows</div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs">
            <div className="text-stone-500 text-xs font-medium">Net Operating Result</div>
            <div
              className={`text-2xl font-bold font-mono mt-1 ${
                financials.profitAndLoss.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {formatINR(financials.profitAndLoss.netProfit)}
            </div>
            <div className="text-[11px] text-stone-500 mt-1">
              {financials.profitAndLoss.netProfit >= 0 ? 'Profitable performance' : 'Net deficit'}
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs">
            <div className="text-stone-500 text-xs font-medium">Ledger Balancing Check</div>
            <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">
              {financials.trialBalance.isBalanced ? 'Balanced ✓' : 'Variance Detected'}
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1">
              Σ {formatINR(financials.trialBalance.totalDebit)}
            </div>
          </div>
        </div>
      )}

      {/* Quick Nav Cards: The 4 Core Financial Modules */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link
          href="/accounts/ledger"
          className="bg-white p-5 rounded-lg border border-[#e8decb] hover:border-[#8f6541] hover:shadow-xs transition group space-y-2 block"
        >
          <div className="w-9 h-9 rounded-md bg-[#faf6ee] border border-[#ebdcc9] flex items-center justify-center text-[#8f6541] group-hover:bg-[#8f6541] group-hover:text-white transition">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div className="font-bold text-stone-900 text-sm flex items-center justify-between">
            <span>General Ledger</span>
            <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#8f6541]" />
          </div>
          <p className="text-xs text-stone-500">
            Double-entry journals, reverse adjustments, and complete audit trail.
          </p>
          <div className="text-xs font-semibold text-[#8f6541] pt-1">
            {journals.length} posted entries →
          </div>
        </Link>

        <Link
          href="/accounts/bills"
          className="bg-white p-5 rounded-lg border border-[#e8decb] hover:border-[#8f6541] hover:shadow-xs transition group space-y-2 block"
        >
          <div className="w-9 h-9 rounded-md bg-[#faf6ee] border border-[#ebdcc9] flex items-center justify-center text-[#8f6541] group-hover:bg-[#8f6541] group-hover:text-white transition">
            <FileText className="w-5 h-5" />
          </div>
          <div className="font-bold text-stone-900 text-sm flex items-center justify-between">
            <span>Vendor Bills (AP)</span>
            <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#8f6541]" />
          </div>
          <p className="text-xs text-stone-500">
            Vendor invoicing, GST input credits, and payment disbursements.
          </p>
          <div className="text-xs font-semibold text-[#8f6541] pt-1">
            {bills.length} vendor bills →
          </div>
        </Link>

        <Link
          href="/accounts/billing"
          className="bg-white p-5 rounded-lg border border-[#e8decb] hover:border-[#8f6541] hover:shadow-xs transition group space-y-2 block"
        >
          <div className="w-9 h-9 rounded-md bg-[#faf6ee] border border-[#ebdcc9] flex items-center justify-center text-[#8f6541] group-hover:bg-[#8f6541] group-hover:text-white transition">
            <Receipt className="w-5 h-5" />
          </div>
          <div className="font-bold text-stone-900 text-sm flex items-center justify-between">
            <span>Billing & Invoices (AR)</span>
            <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#8f6541]" />
          </div>
          <p className="text-xs text-stone-500">
            Customer tax invoicing, rental billing, and collection receipts.
          </p>
          <div className="text-xs font-semibold text-[#8f6541] pt-1">
            Customer receivables →
          </div>
        </Link>

        <Link
          href="/accounts/reports"
          className="bg-white p-5 rounded-lg border border-[#e8decb] hover:border-[#8f6541] hover:shadow-xs transition group space-y-2 block"
        >
          <div className="w-9 h-9 rounded-md bg-[#faf6ee] border border-[#ebdcc9] flex items-center justify-center text-[#8f6541] group-hover:bg-[#8f6541] group-hover:text-white transition">
            <Scale className="w-5 h-5" />
          </div>
          <div className="font-bold text-stone-900 text-sm flex items-center justify-between">
            <span>Financial Statements</span>
            <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#8f6541]" />
          </div>
          <p className="text-xs text-stone-500">
            Live Trial Balance, Profit & Loss, Balance Sheet, and Aging schedules.
          </p>
          <div className="text-xs font-semibold text-[#8f6541] pt-1">
            Statutory compliance →
          </div>
        </Link>
      </div>

      {/* CHART OF ACCOUNTS TREE SECTION */}
      <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 bg-[#fbf9f5] border-b border-[#e8decb] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#8f6541]" />
            <h2 className="text-sm font-bold text-stone-900">Standard Chart of Accounts (COA Tree)</h2>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
            <input
              value={coaSearch}
              onChange={(e) => setCoaSearch(e.target.value)}
              placeholder="Search accounts..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
            />
          </div>
        </div>

        <div className="p-5 space-y-6">
          {typeOrder.map((type) => {
            const accounts = coaByType[type] || [];
            if (accounts.length === 0) return null;

            return (
              <div key={type} className="border border-[#e8decb] rounded-lg overflow-hidden">
                <div className="bg-[#fbf9f5] px-4 py-2 border-b border-[#e8decb] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={type} />
                    <span className="text-xs text-stone-600 font-semibold">({accounts.length} Accounts)</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#fcfaf7] border-b border-[#e8decb] text-stone-500 font-semibold text-[11px]">
                        <th className="px-4 py-2 text-left">Code</th>
                        <th className="px-4 py-2 text-left">Account Name</th>
                        <th className="px-4 py-2 text-left">Classification</th>
                        <th className="px-4 py-2 text-right">Current Ledger Balance</th>
                        <th className="px-4 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0e8db]">
                      {accounts.map((acc) => (
                        <tr key={acc.id} className="hover:bg-[#fbf9f5] transition">
                          <td className="px-4 py-2.5 font-mono font-bold text-[#8f6541]">{acc.accountCode}</td>
                          <td className="px-4 py-2.5 text-stone-900 font-medium">
                            <div className="flex items-center gap-2">
                              {acc.parentId && <span className="w-3 h-0.5 bg-[#8f6541]/40 rounded-full" />}
                              <span>{acc.accountName}</span>
                              {acc.isControlAccount && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-stone-100 text-stone-700 border border-stone-200 uppercase font-bold">
                                  Control
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-stone-500 uppercase text-[10px] tracking-wide">
                            {acc.classification?.replace(/_/g, ' ')}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-stone-900">
                            {formatINR(acc.currentBalance)}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <StatusBadge status={acc.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
