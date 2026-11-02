'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Scale,
  TrendingUp,
  Building2,
  AlertTriangle,
  Receipt,
  RefreshCw,
  BookOpen,
  DollarSign,
  Download
} from 'lucide-react';
import { formatINR } from '@/lib/formatters';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    BALANCED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    UNBALANCED: 'bg-rose-50 text-rose-800 border-rose-200',
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

export default function FinancialReportsPage() {
  const router = useRouter();
  const { currentUser } = useAuth();

  const [financials, setFinancials] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatement, setSelectedStatement] = useState<'ALL' | 'TB' | 'PL' | 'BS' | 'AGING'>('ALL');

  useEffect(() => {
    if (currentUser?.role !== 'ADMIN') {
      router.replace(currentUser?.role === 'SUPERVISOR' ? '/sites/new' : '/projects');
    }
  }, [currentUser, router]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/accounts/reports');
      const data = await res.json();
      if (data.success) {
        setFinancials(data.data);
      }
    } catch {
      // keep
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  if (loading) {
    return <div className="p-12 text-center text-xs text-stone-400">Loading statutory financial statements...</div>;
  }

  if (!financials) {
    return (
      <div className="p-12 text-center text-xs text-rose-600 bg-white rounded-lg border border-[#e8decb]">
        Unable to load financial statements. Please ensure the accounting engine is initialized.
      </div>
    );
  }

  const { trialBalance, profitAndLoss, balanceSheet, apAging, arAging } = financials;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#24160c] border border-[#19100a] rounded-lg p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono tracking-widest text-[#c79e7c] uppercase">
              Financial Reporting & Compliance
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-[#c79e7c]" />
            <span>Financial Statements</span>
          </h1>
          <p className="text-xs text-[#debfa6] mt-1">
            Trial Balance · Profit & Loss (P&L) · Balance Sheet · AP / AR Aging Analysis
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchReports}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#debfa6] bg-[#382315] hover:bg-[#4d3221] rounded-md transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Recalculate Statements</span>
          </button>
        </div>
      </div>

      {/* Financial Health Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs">
          <div className="text-stone-500 text-xs font-medium">Trial Balance Status</div>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
            {trialBalance.isBalanced ? 'Balanced ✓' : 'Variance Detected'}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">Σ {formatINR(trialBalance.totalDebit)}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs">
          <div className="text-stone-500 text-xs font-medium">Net Operating Result (P&L)</div>
          <div className={`text-xl font-bold font-mono mt-1 ${profitAndLoss.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatINR(profitAndLoss.netProfit)}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">
            Revenue: {formatINR(profitAndLoss.totalRevenue)}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs">
          <div className="text-stone-500 text-xs font-medium">Total Assets (Balance Sheet)</div>
          <div className="text-xl font-bold font-mono text-[#24160c] mt-1">
            {formatINR(balanceSheet.totalAssets)}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">
            Liab + Equity: {formatINR(balanceSheet.totalLiabilitiesAndEquity)}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs">
          <div className="text-stone-500 text-xs font-medium">Trade Payables Outstanding</div>
          <div className="text-xl font-bold font-mono text-rose-700 mt-1">
            {formatINR(apAging.totalOutstanding)}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">Across all vendor aging buckets</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 border-b border-[#e8decb] pb-2 text-xs font-semibold overflow-x-auto">
        {[
          { key: 'ALL', label: 'All Statements' },
          { key: 'TB', label: 'Trial Balance' },
          { key: 'PL', label: 'Profit & Loss (P&L)' },
          { key: 'BS', label: 'Balance Sheet' },
          { key: 'AGING', label: 'AP & AR Aging' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setSelectedStatement(t.key as any)}
            className={`px-3 py-1.5 rounded-md transition ${
              selectedStatement === t.key
                ? 'bg-[#8f6541] text-white'
                : 'text-stone-600 hover:bg-[#ede3d4]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* STATEMENT 1: TRIAL BALANCE */}
      {(selectedStatement === 'ALL' || selectedStatement === 'TB') && (
        <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-[#fbf9f5] border-b border-[#e8decb] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#8f6541]" />
              <h2 className="text-sm font-bold text-stone-900">Trial Balance (General Ledger Balances)</h2>
            </div>
            <StatusBadge status={trialBalance.isBalanced ? 'BALANCED' : 'UNBALANCED'} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#fcfaf7] border-b border-[#e8decb] text-stone-600 font-semibold text-[11px]">
                  <th className="px-4 py-2.5 text-left">Account Code</th>
                  <th className="px-4 py-2.5 text-left">Account Name</th>
                  <th className="px-4 py-2.5 text-left">Type</th>
                  <th className="px-4 py-2.5 text-right">Debit Balance (Dr)</th>
                  <th className="px-4 py-2.5 text-right">Credit Balance (Cr)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0e8db]">
                {trialBalance.rows
                  .filter((r: any) => r.netDebit > 0 || r.netCredit > 0)
                  .map((r: any) => (
                    <tr key={r.id} className="hover:bg-[#fbf9f5] transition">
                      <td className="px-4 py-2.5 font-mono font-bold text-[#8f6541]">{r.accountCode}</td>
                      <td className="px-4 py-2.5 text-stone-900 font-medium">{r.accountName}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={r.accountType} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-emerald-700">
                        {r.netDebit > 0 ? formatINR(r.netDebit) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-rose-700">
                        {r.netCredit > 0 ? formatINR(r.netCredit) : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#fcfaf7] border-t-2 border-[#e8decb] font-bold text-stone-900 text-xs">
                  <td colSpan={3} className="px-4 py-3 uppercase tracking-wide">
                    Total Trial Balance
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-800">
                    {formatINR(trialBalance.totalDebit)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-rose-800">
                    {formatINR(trialBalance.totalCredit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* STATEMENTS 2 & 3: P&L AND BALANCE SHEET */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* STATEMENT 2: PROFIT & LOSS */}
        {(selectedStatement === 'ALL' || selectedStatement === 'PL') && (
          <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[#fbf9f5] border-b border-[#e8decb] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#8f6541]" />
                <h2 className="text-sm font-bold text-stone-900">Profit & Loss Statement (Income Statement)</h2>
              </div>
              <span className="text-xs text-stone-500 font-mono">Fiscal YTD</span>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Revenue Section */}
              <div>
                <div className="font-bold text-emerald-800 uppercase tracking-wide text-[11px] pb-1 border-b border-[#e8decb]">
                  Operational Revenues
                </div>
                <div className="divide-y divide-[#f7f2ea]">
                  {profitAndLoss.revenueAccounts.map((a: any) => (
                    <div key={a.id} className="py-2 flex items-center justify-between">
                      <span className="text-stone-700">{a.accountName}</span>
                      <span className="font-mono font-semibold text-emerald-700">{formatINR(a.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 flex items-center justify-between font-bold text-stone-900 border-t border-[#e8decb]">
                  <span>Total Revenue</span>
                  <span className="font-mono text-emerald-800">{formatINR(profitAndLoss.totalRevenue)}</span>
                </div>
              </div>

              {/* Expenses Section */}
              <div>
                <div className="font-bold text-rose-800 uppercase tracking-wide text-[11px] pb-1 border-b border-[#e8decb]">
                  Operating & Administrative Expenses
                </div>
                <div className="divide-y divide-[#f7f2ea]">
                  {profitAndLoss.expenseAccounts.map((a: any) => (
                    <div key={a.id} className="py-2 flex items-center justify-between">
                      <span className="text-stone-700">{a.accountName}</span>
                      <span className="font-mono font-semibold text-rose-700">{formatINR(a.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 flex items-center justify-between font-bold text-stone-900 border-t border-[#e8decb]">
                  <span>Total Expenses</span>
                  <span className="font-mono text-rose-800">{formatINR(profitAndLoss.totalExpenses)}</span>
                </div>
              </div>

              {/* Net Profit Summary */}
              <div className="pt-4 border-t-2 border-[#e8decb] flex items-center justify-between text-sm font-bold">
                <span className="text-stone-900">Net Profit / (Loss)</span>
                <span
                  className={`font-mono text-base ${
                    profitAndLoss.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {formatINR(profitAndLoss.netProfit)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STATEMENT 3: BALANCE SHEET */}
        {(selectedStatement === 'ALL' || selectedStatement === 'BS') && (
          <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[#fbf9f5] border-b border-[#e8decb] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#8f6541]" />
                <h2 className="text-sm font-bold text-stone-900">Balance Sheet (Financial Position)</h2>
              </div>
              <StatusBadge status={balanceSheet.isBalanced ? 'BALANCED' : 'UNBALANCED'} />
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Assets Section */}
              <div>
                <div className="font-bold text-blue-800 uppercase tracking-wide text-[11px] pb-1 border-b border-[#e8decb]">
                  Assets (Fixed & Current)
                </div>
                <div className="divide-y divide-[#f7f2ea]">
                  {balanceSheet.assetAccounts.map((a: any) => (
                    <div key={a.id} className="py-2 flex items-center justify-between">
                      <span className="text-stone-700">{a.accountName}</span>
                      <span className="font-mono font-semibold text-blue-800">{formatINR(a.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 flex items-center justify-between font-bold text-stone-900 border-t border-[#e8decb]">
                  <span>Total Assets</span>
                  <span className="font-mono text-blue-900">{formatINR(balanceSheet.totalAssets)}</span>
                </div>
              </div>

              {/* Liabilities Section */}
              <div>
                <div className="font-bold text-purple-800 uppercase tracking-wide text-[11px] pb-1 border-b border-[#e8decb]">
                  Liabilities (Current & Statutory)
                </div>
                <div className="divide-y divide-[#f7f2ea]">
                  {balanceSheet.liabilityAccounts.map((a: any) => (
                    <div key={a.id} className="py-2 flex items-center justify-between">
                      <span className="text-stone-700">{a.accountName}</span>
                      <span className="font-mono font-semibold text-purple-800">{formatINR(a.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 flex items-center justify-between font-bold text-stone-900 border-t border-[#e8decb]">
                  <span>Total Liabilities</span>
                  <span className="font-mono text-purple-900">{formatINR(balanceSheet.totalLiabilities)}</span>
                </div>
              </div>

              {/* Equity Section */}
              <div>
                <div className="font-bold text-amber-800 uppercase tracking-wide text-[11px] pb-1 border-b border-[#e8decb]">
                  Shareholders&apos; Equity &amp; Reserves
                </div>
                <div className="divide-y divide-[#f7f2ea]">
                  {balanceSheet.equityAccounts.map((a: any) => (
                    <div key={a.id} className="py-2 flex items-center justify-between">
                      <span className="text-stone-700">{a.accountName}</span>
                      <span className="font-mono font-semibold text-amber-800">{formatINR(a.amount)}</span>
                    </div>
                  ))}
                  <div className="py-2 flex items-center justify-between text-stone-600 italic">
                    <span>Retained Earnings / Current Period Net Margin</span>
                    <span className="font-mono font-semibold">{formatINR(profitAndLoss.netProfit)}</span>
                  </div>
                </div>
                <div className="pt-2 flex items-center justify-between font-bold text-stone-900 border-t border-[#e8decb]">
                  <span>Total Equity</span>
                  <span className="font-mono text-amber-900">{formatINR(balanceSheet.totalEquity)}</span>
                </div>
              </div>

              {/* Balance Verification Check */}
              <div className="pt-4 border-t-2 border-[#e8decb] flex items-center justify-between text-xs font-bold bg-[#fbf9f5] p-3 rounded-md">
                <span className="text-stone-900">Total Liabilities + Equity</span>
                <span className="font-mono text-sm text-stone-900">
                  {formatINR(balanceSheet.totalLiabilitiesAndEquity)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* STATEMENT 4: AP & AR AGING */}
      {(selectedStatement === 'ALL' || selectedStatement === 'AGING') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* AP Aging */}
          <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#e8decb] pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-stone-900 text-sm">Accounts Payable (AP) Aging</h3>
              </div>
              <span className="font-mono font-bold text-rose-700 text-xs">
                {formatINR(apAging.totalOutstanding)}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-stone-600">0 - 30 Days (Current)</span>
                  <span className="font-mono font-bold text-stone-900">{formatINR(apAging.days0_30)}</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2">
                  <div
                    className="bg-emerald-600 h-2 rounded-full"
                    style={{ width: `${apAging.totalOutstanding ? (apAging.days0_30 / apAging.totalOutstanding) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-stone-600">31 - 60 Days</span>
                  <span className="font-mono font-bold text-stone-900">{formatINR(apAging.days31_60)}</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full"
                    style={{ width: `${apAging.totalOutstanding ? (apAging.days31_60 / apAging.totalOutstanding) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-stone-600">61 - 90 Days</span>
                  <span className="font-mono font-bold text-stone-900">{formatINR(apAging.days61_90)}</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2">
                  <div
                    className="bg-orange-600 h-2 rounded-full"
                    style={{ width: `${apAging.totalOutstanding ? (apAging.days61_90 / apAging.totalOutstanding) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-stone-600">90+ Days (Overdue)</span>
                  <span className="font-mono font-bold text-rose-700">{formatINR(apAging.days90Plus)}</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2">
                  <div
                    className="bg-rose-600 h-2 rounded-full"
                    style={{ width: `${apAging.totalOutstanding ? (apAging.days90Plus / apAging.totalOutstanding) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* AR Aging */}
          <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#e8decb] pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-stone-900 text-sm">Accounts Receivable (AR) Aging</h3>
              </div>
              <span className="font-mono font-bold text-emerald-700 text-xs">
                {formatINR(arAging.totalOutstanding)}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-stone-600">0 - 30 Days (Current)</span>
                  <span className="font-mono font-bold text-stone-900">{formatINR(arAging.days0_30)}</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2">
                  <div
                    className="bg-emerald-600 h-2 rounded-full"
                    style={{ width: `${arAging.totalOutstanding ? (arAging.days0_30 / arAging.totalOutstanding) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-stone-600">31 - 60 Days</span>
                  <span className="font-mono font-bold text-stone-900">{formatINR(arAging.days31_60)}</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full"
                    style={{ width: `${arAging.totalOutstanding ? (arAging.days31_60 / arAging.totalOutstanding) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-stone-600">61 - 90 Days</span>
                  <span className="font-mono font-bold text-stone-900">{formatINR(arAging.days61_90)}</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2">
                  <div
                    className="bg-orange-600 h-2 rounded-full"
                    style={{ width: `${arAging.totalOutstanding ? (arAging.days61_90 / arAging.totalOutstanding) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-stone-600">90+ Days (Overdue)</span>
                  <span className="font-mono font-bold text-rose-700">{formatINR(arAging.days90Plus)}</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2">
                  <div
                    className="bg-rose-600 h-2 rounded-full"
                    style={{ width: `${arAging.totalOutstanding ? (arAging.days90Plus / arAging.totalOutstanding) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
