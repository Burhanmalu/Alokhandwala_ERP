'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  Landmark,
  Scale,
  FileText,
  DollarSign
} from 'lucide-react';
import { formatINR, formatDate } from '@/lib/formatters';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import type { ChartOfAccount, JournalEntry } from '@/lib/schema';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    POSTED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    DRAFT: 'bg-amber-50 text-amber-800 border-amber-200',
    REVERSED: 'bg-rose-50 text-rose-800 border-rose-200',
    GENERAL: 'bg-blue-50 text-blue-800 border-blue-200',
    OPENING: 'bg-purple-50 text-purple-800 border-purple-200',
    CONTRA: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    ADJUSTMENT: 'bg-orange-50 text-orange-800 border-orange-200',
    PAYROLL_AUTO: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    AP_AUTO: 'bg-amber-50 text-amber-800 border-amber-200',
    AR_AUTO: 'bg-teal-50 text-teal-800 border-teal-200',
  };
  const cls = map[status] ?? 'bg-stone-100 text-stone-700 border-stone-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function GeneralLedgerPage() {
  const router = useRouter();
  const { currentUser } = useAuth();

  const [coaList, setCoaList] = useState<ChartOfAccount[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [journalSearch, setJournalSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('');

  // Post Journal Modal
  const [journalModalOpen, setJournalModalOpen] = useState(false);
  const [jNarration, setJNarration] = useState('');
  const [jDate, setJDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [jKind, setJKind] = useState<JournalEntry['kind']>('GENERAL');
  const [jRef, setJRef] = useState('');
  const [jLines, setJLines] = useState([
    { accountId: '', debit: 0, credit: 0, memo: '' },
    { accountId: '', debit: 0, credit: 0, memo: '' },
  ]);

  // Reverse Modal
  const [reverseModalOpen, setReverseModalOpen] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser?.role !== 'ADMIN') {
      router.replace(currentUser?.role === 'SUPERVISOR' ? '/sites/new' : '/projects');
    }
  }, [currentUser, router]);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    try {
      const [coaRes, jRes] = await Promise.all([
        fetch('/api/accounts/chart'),
        fetch('/api/accounts/journals'),
      ]);
      const [coaData, jData] = await Promise.all([coaRes.json(), jRes.json()]);
      if (coaData.success) setCoaList(coaData.data);
      if (jData.success) setJournals(jData.data);
    } catch {
      // keep state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const handlePostJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/accounts/journals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postingDate: jDate,
          kind: jKind,
          referenceNumber: jRef,
          narration: jNarration,
          lines: jLines,
          status: 'POSTED',
          actorId: currentUser?.id,
          actorName: currentUser?.fullName,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error);
        return;
      }
      setJournalModalOpen(false);
      setJLines([
        { accountId: '', debit: 0, credit: 0, memo: '' },
        { accountId: '', debit: 0, credit: 0, memo: '' },
      ]);
      setJNarration('');
      setJRef('');
      fetchLedger();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleReverse = async () => {
    if (!reverseModalOpen) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/accounts/journals/${reverseModalOpen}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reverseReason,
          actorId: currentUser?.id,
          actorName: currentUser?.fullName,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error);
        return;
      }
      setReverseModalOpen(null);
      setReverseReason('');
      fetchLedger();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const totalDebit = jLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = jLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const filteredJournals = journals.filter((j) => {
    const matchesSearch =
      !journalSearch ||
      j.entryNumber.toLowerCase().includes(journalSearch.toLowerCase()) ||
      j.narration.toLowerCase().includes(journalSearch.toLowerCase());
    const matchesKind = !kindFilter || j.kind === kindFilter;
    return matchesSearch && matchesKind;
  });

  const totalPostedDebit = filteredJournals
    .filter((j) => j.status === 'POSTED')
    .reduce((sum, j) => sum + j.totalDebit, 0);
  const totalPostedCredit = filteredJournals
    .filter((j) => j.status === 'POSTED')
    .reduce((sum, j) => sum + j.totalCredit, 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#24160c] border border-[#19100a] rounded-lg p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono tracking-widest text-[#c79e7c] uppercase">
              Financial Ledger & Audit
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-[#c79e7c]" />
            <span>General Ledger</span>
          </h1>
          <p className="text-xs text-[#debfa6] mt-1">
            Immutable posted transactions · Double-entry debit/credit journals · Complete audit trail
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setJournalModalOpen(true);
              setError('');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1c120c] bg-[#c79e7c] hover:bg-[#dfcbab] rounded-md shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Post Journal Entry</span>
          </button>
          <button
            onClick={fetchLedger}
            className="p-2 rounded-md bg-[#382315] hover:bg-[#4d3221] text-[#debfa6] transition"
            title="Refresh Ledger"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs">
          <div className="text-stone-500 text-xs font-medium">Total Ledger Movements (Dr)</div>
          <div className="text-2xl font-bold font-mono text-[#24160c] mt-1">{formatINR(totalPostedDebit)}</div>
          <div className="text-[11px] text-stone-500 mt-1">{filteredJournals.length} total entries recorded</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs">
          <div className="text-stone-500 text-xs font-medium">Total Ledger Movements (Cr)</div>
          <div className="text-2xl font-bold font-mono text-[#714f36] mt-1">{formatINR(totalPostedCredit)}</div>
          <div className="text-[11px] text-stone-500 mt-1">Balanced double-entry flow</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs">
          <div className="text-stone-500 text-xs font-medium">Ledger Integrity State</div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">
            {Math.abs(totalPostedDebit - totalPostedCredit) < 0.05 ? 'Balanced ✓' : 'Variance Detected'}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">Zero unposted variance</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            value={journalSearch}
            onChange={(e) => setJournalSearch(e.target.value)}
            placeholder="Search by entry # or narration..."
            className="w-full pl-9 pr-3 py-2 bg-[#fcfaf7] border border-[#e8decb] rounded-md text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#8f6541]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="px-3 py-2 bg-[#fcfaf7] border border-[#e8decb] rounded-md text-xs text-stone-700 focus:outline-none focus:border-[#8f6541]"
          >
            <option value="">All Journal Types</option>
            <option value="GENERAL">General</option>
            <option value="OPENING">Opening</option>
            <option value="CONTRA">Contra</option>
            <option value="ADJUSTMENT">Adjustment</option>
            <option value="PAYROLL_AUTO">Payroll Auto</option>
            <option value="AP_AUTO">AP Auto</option>
          </select>
          <span className="text-xs text-stone-500 whitespace-nowrap">{filteredJournals.length} entries</span>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-stone-400">Loading General Ledger records...</div>
        ) : filteredJournals.length === 0 ? (
          <div className="p-12 text-center text-xs text-stone-500">
            No journal entries found. Click <strong className="text-[#8f6541]">Post Journal Entry</strong> to create the first entry.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#fbf9f5] border-b border-[#e8decb] text-stone-600 font-semibold text-[11px]">
                  <th className="px-4 py-3 text-left">Entry #</th>
                  <th className="px-4 py-3 text-left">Posting Date</th>
                  <th className="px-4 py-3 text-left">Classification</th>
                  <th className="px-4 py-3 text-left">Narration</th>
                  <th className="px-4 py-3 text-left">Account Breakdown</th>
                  <th className="px-4 py-3 text-right">Debit (Dr)</th>
                  <th className="px-4 py-3 text-right">Credit (Cr)</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0e8db]">
                {filteredJournals.map((j) => (
                  <tr key={j.id} className="hover:bg-[#fcfaf7] transition">
                    <td className="px-4 py-3 font-mono font-bold text-[#8f6541]">{j.entryNumber}</td>
                    <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{formatDate(j.postingDate)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={j.kind} />
                    </td>
                    <td className="px-4 py-3 text-stone-900 max-w-xs font-medium">
                      <div>{j.narration}</div>
                      {j.referenceNumber && (
                        <div className="text-[10px] text-stone-400 font-mono mt-0.5">Ref: {j.referenceNumber}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      <div className="space-y-1">
                        {j.lines.map((l, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px] gap-2">
                            <span className="truncate max-w-[160px]">
                              {l.accountCode} - {l.accountName}
                            </span>
                            <span className="font-mono text-stone-400">
                              {l.debit > 0 ? `Dr ${formatINR(l.debit)}` : `Cr ${formatINR(l.credit)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                      {formatINR(j.totalDebit)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                      {formatINR(j.totalCredit)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={j.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {j.status === 'POSTED' && (
                        <button
                          onClick={() => {
                            setReverseModalOpen(j.id);
                            setReverseReason('');
                            setError('');
                          }}
                          className="px-2 py-1 rounded text-[11px] font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 transition"
                        >
                          Reverse
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: POST JOURNAL ENTRY */}
      {journalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-xs overflow-y-auto py-8 px-4">
          <form
            onSubmit={handlePostJournal}
            className="bg-white border border-[#e8decb] rounded-xl shadow-2xl w-full max-w-2xl"
          >
            <div className="px-6 py-4 border-b border-[#e8decb] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-[#8f6541]" />
                <span className="font-bold text-stone-900 text-sm">Post New Journal Entry</span>
              </div>
              <button
                type="button"
                onClick={() => setJournalModalOpen(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Posting Date *</label>
                  <input
                    type="date"
                    value={jDate}
                    onChange={(e) => setJDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Journal Type *</label>
                  <select
                    value={jKind}
                    onChange={(e) => setJKind(e.target.value as JournalEntry['kind'])}
                    className="w-full px-3 py-2 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
                  >
                    <option value="GENERAL">General</option>
                    <option value="OPENING">Opening Balance</option>
                    <option value="CONTRA">Contra</option>
                    <option value="ADJUSTMENT">Adjustment</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Narration / Description *</label>
                  <input
                    value={jNarration}
                    onChange={(e) => setJNarration(e.target.value)}
                    required
                    placeholder="Enter journal description..."
                    className="w-full px-3 py-2 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Reference Number</label>
                  <input
                    value={jRef}
                    onChange={(e) => setJRef(e.target.value)}
                    placeholder="Voucher or PO number"
                    className="w-full px-3 py-2 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
                  />
                </div>
              </div>

              {/* Lines table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-stone-700 uppercase tracking-wide">Journal Lines</span>
                  <button
                    type="button"
                    onClick={() =>
                      setJLines((l) => [...l, { accountId: '', debit: 0, credit: 0, memo: '' }])
                    }
                    className="text-xs font-semibold text-[#8f6541] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Line
                  </button>
                </div>

                <div className="space-y-2">
                  {jLines.map((line, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <select
                          value={line.accountId}
                          onChange={(e) => {
                            const l = [...jLines];
                            l[i].accountId = e.target.value;
                            setJLines(l);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
                        >
                          <option value="">— Select Account —</option>
                          {coaList
                            .filter((a) => !a.isControlAccount && a.status === 'ACTIVE')
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.accountCode} - {a.accountName}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Debit (₹)"
                          value={line.debit || ''}
                          onChange={(e) => {
                            const l = [...jLines];
                            l[i].debit = Number(e.target.value);
                            l[i].credit = 0;
                            setJLines(l);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-[#e8decb] rounded-md text-xs text-emerald-700 font-mono focus:outline-none focus:border-[#8f6541]"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Credit (₹)"
                          value={line.credit || ''}
                          onChange={(e) => {
                            const l = [...jLines];
                            l[i].credit = Number(e.target.value);
                            l[i].debit = 0;
                            setJLines(l);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-[#e8decb] rounded-md text-xs text-rose-700 font-mono focus:outline-none focus:border-[#8f6541]"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        {jLines.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setJLines((l) => l.filter((_, idx) => idx !== i))}
                            className="text-stone-400 hover:text-rose-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  className={`mt-4 p-3 rounded-md border text-xs flex items-center justify-between ${
                    isBalanced
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isBalanced ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>
                      Total Dr: {formatINR(totalDebit)} &nbsp;|&nbsp; Total Cr: {formatINR(totalCredit)}
                    </span>
                  </div>
                  <span className="font-bold">
                    {isBalanced ? 'Balanced ✓' : `Variance: ${formatINR(Math.abs(totalDebit - totalCredit))}`}
                  </span>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#e8decb]">
                <button
                  type="button"
                  onClick={() => setJournalModalOpen(false)}
                  className="px-4 py-2 rounded-md text-xs font-semibold text-stone-600 hover:bg-stone-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !isBalanced}
                  className="px-4 py-2 rounded-md text-xs font-bold text-white bg-[#8f6541] hover:bg-[#764f30] transition disabled:opacity-50"
                >
                  {saving ? 'Posting...' : 'Post Journal Entry'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: REVERSE ENTRY */}
      {reverseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs px-4">
          <div className="bg-white border border-[#e8decb] rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              <h3 className="font-bold text-stone-900 text-sm">Reverse Journal Entry</h3>
            </div>
            <p className="text-xs text-stone-600">
              This will create a balanced offsetting reversal entry in the ledger. The original entry will be marked as REVERSED and remain immutable.
            </p>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Reason for Reversal *</label>
              <textarea
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                rows={3}
                placeholder="State the reason..."
                className="w-full px-3 py-2 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541] resize-none"
              />
            </div>
            {error && <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReverseModalOpen(null)}
                className="px-4 py-2 rounded-md text-xs font-semibold text-stone-600 hover:bg-stone-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReverse}
                disabled={saving || !reverseReason.trim()}
                className="px-4 py-2 rounded-md text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 transition disabled:opacity-50"
              >
                {saving ? 'Processing...' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
