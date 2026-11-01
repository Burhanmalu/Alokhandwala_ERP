'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  X,
  CreditCard,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ReceiptIndianRupee
} from 'lucide-react';
import { formatINR, formatDate } from '@/lib/formatters';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import type { ChartOfAccount, VendorBill } from '@/lib/schema';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    POSTED: 'bg-blue-50 text-blue-800 border-blue-200',
    PARTIALLY_PAID: 'bg-amber-50 text-amber-800 border-amber-200',
    PAID: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    CANCELLED: 'bg-rose-50 text-rose-800 border-rose-200',
    DRAFT: 'bg-stone-100 text-stone-700 border-stone-200',
  };
  const cls = map[status] ?? 'bg-stone-100 text-stone-700 border-stone-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function VendorBillsPage() {
  const router = useRouter();
  const { currentUser } = useAuth();

  const [bills, setBills] = useState<VendorBill[]>([]);
  const [coaList, setCoaList] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [billSearch, setBillSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // New Bill Modal
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [billVendorInv, setBillVendorInv] = useState('');
  const [billSupplierId, setBillSupplierId] = useState('vnd-001');
  const [billSupplierName, setBillSupplierName] = useState('');
  const [billDate, setBillDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [billDueDate, setBillDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [billLines, setBillLines] = useState([
    { description: '', quantity: 1, unitPrice: 0, taxRate: 18, accountId: 'coa-5050' },
  ]);
  const [billNotes, setBillNotes] = useState('');

  // Payment Disbursement Modal
  const [payBillModal, setPayBillModal] = useState<VendorBill | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<'NEFT' | 'RTGS' | 'CHEQUE' | 'UPI' | 'CASH'>('NEFT');
  const [payRef, setPayRef] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser?.role !== 'ADMIN') {
      router.replace(currentUser?.role === 'SUPERVISOR' ? '/sites/new' : '/projects');
    }
  }, [currentUser, router]);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const [billsRes, coaRes] = await Promise.all([
        fetch('/api/accounts/bills'),
        fetch('/api/accounts/chart'),
      ]);
      const [billsData, coaData] = await Promise.all([billsRes.json(), coaRes.json()]);
      if (billsData.success) setBills(billsData.data);
      if (coaData.success) setCoaList(coaData.data);
    } catch {
      // keep
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/accounts/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorInvoiceNumber: billVendorInv,
          supplierId: billSupplierId || 'vnd-001',
          billDate,
          dueDate: billDueDate,
          lines: billLines,
          notes: billNotes,
          actorId: currentUser?.id,
          actorName: currentUser?.fullName,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error);
        return;
      }
      setBillModalOpen(false);
      setBillLines([{ description: '', quantity: 1, unitPrice: 0, taxRate: 18, accountId: 'coa-5050' }]);
      setBillVendorInv('');
      setBillSupplierName('');
      setBillNotes('');
      fetchBills();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handlePayBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payBillModal) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/accounts/disbursements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billId: payBillModal.id,
          paymentDate: payDate,
          amount: payAmount,
          paymentMethod: payMethod,
          referenceNumber: payRef,
          actorId: currentUser?.id,
          actorName: currentUser?.fullName,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error);
        return;
      }
      setPayBillModal(null);
      setPayAmount(0);
      setPayRef('');
      fetchBills();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const filteredBills = bills.filter((b) => {
    const matchesSearch =
      !billSearch ||
      b.billNumber.toLowerCase().includes(billSearch.toLowerCase()) ||
      b.supplierName.toLowerCase().includes(billSearch.toLowerCase()) ||
      b.vendorInvoiceNumber.toLowerCase().includes(billSearch.toLowerCase());
    const matchesStatus = !statusFilter || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPayable = bills.reduce((sum, b) => sum + b.totalAmount, 0);
  const totalPaid = bills.reduce((sum, b) => sum + b.paidAmount, 0);
  const totalOutstanding = bills.reduce((sum, b) => sum + b.outstandingAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#24160c] border border-[#19100a] rounded-lg p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono tracking-widest text-[#c79e7c] uppercase">
              Accounts Payable (AP)
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#c79e7c]" />
            <span>Vendor Bills & Disbursements</span>
          </h1>
          <p className="text-xs text-[#debfa6] mt-1">
            Vendor invoicing · Statutory GST credit recording · Outflow disbursements
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setBillModalOpen(true);
              setError('');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1c120c] bg-[#c79e7c] hover:bg-[#dfcbab] rounded-md shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Vendor Bill</span>
          </button>
          <button
            onClick={fetchBills}
            className="p-2 rounded-md bg-[#382315] hover:bg-[#4d3221] text-[#debfa6] transition"
            title="Refresh Vendor Bills"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Financial Health Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs">
          <div className="text-stone-500 text-xs font-medium">Total Vendor Invoices Booked</div>
          <div className="text-2xl font-bold font-mono text-[#24160c] mt-1">{formatINR(totalPayable)}</div>
          <div className="text-[11px] text-stone-500 mt-1">{bills.length} bills in register</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs">
          <div className="text-stone-500 text-xs font-medium">Disbursed Settlements</div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">{formatINR(totalPaid)}</div>
          <div className="text-[11px] text-stone-500 mt-1">Cleared via Bank/Cash</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs">
          <div className="text-stone-500 text-xs font-medium">Pending Payables (Outflow)</div>
          <div className="text-2xl font-bold font-mono text-rose-700 mt-1">{formatINR(totalOutstanding)}</div>
          <div className="text-[11px] text-rose-600 font-semibold mt-1">Current AP liability</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            value={billSearch}
            onChange={(e) => setBillSearch(e.target.value)}
            placeholder="Search by bill #, supplier or inv #..."
            className="w-full pl-9 pr-3 py-2 bg-[#fcfaf7] border border-[#e8decb] rounded-md text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#8f6541]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[#fcfaf7] border border-[#e8decb] rounded-md text-xs text-stone-700 focus:outline-none focus:border-[#8f6541]"
          >
            <option value="">All Payment Statuses</option>
            <option value="POSTED">Unpaid (Posted)</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Fully Settled</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <span className="text-xs text-stone-500 whitespace-nowrap">{filteredBills.length} bills</span>
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-stone-400">Loading vendor bills...</div>
        ) : filteredBills.length === 0 ? (
          <div className="p-12 text-center text-xs text-stone-500">
            No vendor bills found. Click <strong className="text-[#8f6541]">New Vendor Bill</strong> to book a purchase or service invoice.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#fbf9f5] border-b border-[#e8decb] text-stone-600 font-semibold text-[11px]">
                  <th className="px-4 py-3 text-left">Bill #</th>
                  <th className="px-4 py-3 text-left">Vendor Inv #</th>
                  <th className="px-4 py-3 text-left">Supplier Name</th>
                  <th className="px-4 py-3 text-left">Bill Date</th>
                  <th className="px-4 py-3 text-left">Due Date</th>
                  <th className="px-4 py-3 text-right">Total (Incl Tax)</th>
                  <th className="px-4 py-3 text-right">Settled Amount</th>
                  <th className="px-4 py-3 text-right">Balance Due</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0e8db]">
                {filteredBills.map((b) => (
                  <tr key={b.id} className="hover:bg-[#fcfaf7] transition">
                    <td className="px-4 py-3 font-mono font-bold text-[#8f6541]">{b.billNumber}</td>
                    <td className="px-4 py-3 font-mono text-stone-600">{b.vendorInvoiceNumber}</td>
                    <td className="px-4 py-3 font-semibold text-stone-900">{b.supplierName}</td>
                    <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{formatDate(b.billDate)}</td>
                    <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{formatDate(b.dueDate)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-stone-900 whitespace-nowrap">
                      {formatINR(b.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700 whitespace-nowrap">
                      {formatINR(b.paidAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                      {formatINR(b.outstandingAmount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(b.status === 'POSTED' || b.status === 'PARTIALLY_PAID') && (
                        <button
                          onClick={() => {
                            setPayBillModal(b);
                            setPayAmount(b.outstandingAmount);
                            setPayRef('');
                            setError('');
                          }}
                          className="px-2.5 py-1 rounded text-xs font-bold text-white bg-[#8f6541] hover:bg-[#764f30] transition shadow-2xs"
                        >
                          Disburse
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

      {/* MODAL: NEW VENDOR BILL */}
      {billModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-xs overflow-y-auto py-8 px-4">
          <form
            onSubmit={handleCreateBill}
            className="bg-white border border-[#e8decb] rounded-xl shadow-2xl w-full max-w-2xl"
          >
            <div className="px-6 py-4 border-b border-[#e8decb] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#8f6541]" />
                <span className="font-bold text-stone-900 text-sm">Create New Vendor Bill (AP)</span>
              </div>
              <button
                type="button"
                onClick={() => setBillModalOpen(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Supplier / Vendor Name *</label>
                  <input
                    value={billSupplierName}
                    onChange={(e) => setBillSupplierName(e.target.value)}
                    required
                    placeholder="Enter vendor company name..."
                    className="w-full px-3 py-2 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Vendor Invoice # *</label>
                  <input
                    value={billVendorInv}
                    onChange={(e) => setBillVendorInv(e.target.value)}
                    required
                    placeholder="e.g. INV-2026-99"
                    className="w-full px-3 py-2 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Bill Date *</label>
                  <input
                    type="date"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Due Date *</label>
                  <input
                    type="date"
                    value={billDueDate}
                    onChange={(e) => setBillDueDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
                  />
                </div>
              </div>

              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-stone-700 uppercase tracking-wide">Expense / Inventory Items</span>
                  <button
                    type="button"
                    onClick={() =>
                      setBillLines((l) => [
                        ...l,
                        { description: '', quantity: 1, unitPrice: 0, taxRate: 18, accountId: 'coa-5050' },
                      ])
                    }
                    className="text-xs font-semibold text-[#8f6541] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {billLines.map((line, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <input
                          placeholder="Item description"
                          value={line.description}
                          onChange={(e) => {
                            const l = [...billLines];
                            l[i].description = e.target.value;
                            setBillLines(l);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={line.quantity}
                          onChange={(e) => {
                            const l = [...billLines];
                            l[i].quantity = Number(e.target.value);
                            setBillLines(l);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Rate (₹)"
                          value={line.unitPrice || ''}
                          onChange={(e) => {
                            const l = [...billLines];
                            l[i].unitPrice = Number(e.target.value);
                            setBillLines(l);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
                        />
                      </div>
                      <div className="col-span-3">
                        <select
                          value={line.accountId}
                          onChange={(e) => {
                            const l = [...billLines];
                            l[i].accountId = e.target.value;
                            setBillLines(l);
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
                        >
                          {coaList
                            .filter((a) => (a.accountType === 'EXPENSE' || a.accountType === 'ASSET') && !a.isControlAccount)
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.accountCode} - {a.accountName}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="col-span-1 text-center">
                        {billLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setBillLines((l) => l.filter((_, idx) => idx !== i))}
                            className="text-stone-400 hover:text-rose-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Notes / Terms</label>
                <textarea
                  value={billNotes}
                  onChange={(e) => setBillNotes(e.target.value)}
                  rows={2}
                  placeholder="Additional delivery or invoice notes..."
                  className="w-full px-3 py-2 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541] resize-none"
                />
              </div>

              {error && <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#e8decb]">
                <button
                  type="button"
                  onClick={() => setBillModalOpen(false)}
                  className="px-4 py-2 rounded-md text-xs font-semibold text-stone-600 hover:bg-stone-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-md text-xs font-bold text-white bg-[#8f6541] hover:bg-[#764f30] transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Book Bill & Post Journal'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: DISBURSE VENDOR PAYMENT */}
      {payBillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs px-4">
          <form
            onSubmit={handlePayBill}
            className="bg-white border border-[#e8decb] rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#8f6541]" />
              <h3 className="font-bold text-stone-900 text-sm">Disburse Vendor Payment</h3>
            </div>

            <div className="p-3 bg-[#fbf9f5] rounded-md border border-[#e8decb] text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-500">Bill:</span>
                <span className="font-mono font-bold text-[#8f6541]">{payBillModal.billNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Vendor:</span>
                <span className="font-semibold text-stone-900">{payBillModal.supplierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Balance Due:</span>
                <span className="font-mono font-bold text-rose-700">{formatINR(payBillModal.outstandingAmount)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Disbursement Amount *</label>
                <input
                  type="number"
                  min="1"
                  max={payBillModal.outstandingAmount}
                  step="0.01"
                  value={payAmount || ''}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Payment Date *</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Disbursement Mode</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}
                  className="w-full px-3 py-2 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
                >
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Reference / UTR # *</label>
                <input
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  required
                  placeholder="Bank UTR number"
                  className="w-full px-3 py-2 bg-white border border-[#e8decb] rounded-md text-xs text-stone-900 focus:outline-none focus:border-[#8f6541]"
                />
              </div>
            </div>

            {error && <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#e8decb]">
              <button
                type="button"
                onClick={() => setPayBillModal(null)}
                className="px-4 py-2 rounded-md text-xs font-semibold text-stone-600 hover:bg-stone-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-md text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition disabled:opacity-50"
              >
                {saving ? 'Processing...' : 'Confirm Disbursement'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
