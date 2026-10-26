'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ReceiptIndianRupee, 
  Search, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Download, 
  Eye, 
  CreditCard,
  Building2
} from 'lucide-react';
import { Invoice, Payment, Customer, Project } from '@/lib/schema';
import { formatINR, formatDate } from '@/lib/formatters';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

export default function BillingPage() {
  const router = useRouter();
  const { can, currentUser } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'ADMIN') {
      if (currentUser.role === 'SUPERVISOR') {
        router.replace('/sites/new');
      } else {
        router.replace('/projects');
      }
    }
  }, [currentUser, router]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'payments'>('invoices');

  // New Invoice Modal - Clean initial state without default mock values
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invCustomerId, setInvCustomerId] = useState('');
  const [invProjectId, setInvProjectId] = useState('');
  const [invType, setInvType] = useState<'RENTAL_CHARGE' | 'TRANSPORT' | 'LABOUR' | 'SHIFTING' | 'DAMAGE_PENALTY'>('RENTAL_CHARGE');
  const [invDate, setInvDate] = useState('');
  const [invDueDate, setInvDueDate] = useState('');
  const [invDescription, setInvDescription] = useState('');
  const [invRate, setInvRate] = useState<number>(0);

  // New Payment Modal - Clean initial state without default mock values
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'NEFT' | 'RTGS' | 'CHEQUE' | 'UPI' | 'CASH'>('NEFT');
  const [payRef, setPayRef] = useState('');
  const [payBank, setPayBank] = useState('');
  const [payDate, setPayDate] = useState('');

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      const [invRes, payRes, custRes, projRes] = await Promise.all([
        fetch('/api/billing/invoices'),
        fetch('/api/billing/payments'),
        fetch('/api/customers'),
        fetch('/api/projects'),
      ]);
      const [invJson, payJson, custJson, projJson] = await Promise.all([
        invRes.json(),
        payRes.json(),
        custRes.json(),
        projRes.json(),
      ]);

      if (invJson.success) setInvoices(invJson.data);
      if (payJson.success) setPayments(payJson.data);
      if (custJson.success) {
        setCustomers(custJson.data);
        if (custJson.data.length > 0) setInvCustomerId(custJson.data[0].id);
      }
      if (projJson.success) setProjects(projJson.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/billing/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: invCustomerId,
          projectId: invProjectId || undefined,
          invoiceType: invType,
          invoiceDate: invDate,
          dueDate: invDueDate,
          lines: [
            {
              description: invDescription,
              hsnSacCode: '997312',
              quantity: 1,
              rate: Number(invRate),
            },
          ],
          actorId: currentUser.id,
          actorName: currentUser.fullName,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setInvoiceModalOpen(false);
        fetchBillingData();
      } else {
        alert(json.error || 'Failed to issue invoice');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleOpenPayment = (inv: Invoice) => {
    setSelectedInvoiceForPayment(inv);
    setPayAmount(inv.outstandingAmount);
    setPayRef(`NEFT-${Date.now().toString().slice(-6)}`);
    setPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment) return;

    try {
      const res = await fetch('/api/billing/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: selectedInvoiceForPayment.id,
          amount: Number(payAmount),
          paymentDate: payDate,
          paymentMethod: payMethod,
          transactionReference: payRef,
          bankName: payBank,
          actorId: currentUser.id,
          actorName: currentUser.fullName,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setPaymentModalOpen(false);
        fetchBillingData();
      } else {
        alert(json.error || 'Failed to record payment');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const totalBilled = invoices.reduce((sum, i) => sum + i.totalAmount, 0);
  const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalOutstanding = invoices.reduce((sum, i) => sum + i.outstandingAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ReceiptIndianRupee className="w-5 h-5 text-emerald-600" />
            <span>Billing, Invoices & Payment Ledger</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            GST-compliant invoicing (SAC 997312), collections, and customer balance reconciliations.
          </p>
        </div>

        {can('BILLING_CREATE_INVOICE') && (
          <button
            onClick={() => setInvoiceModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Issue Tax Invoice</span>
          </button>
        )}
      </div>

      {/* Financial Health Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-slate-500 text-xs font-medium">Total Invoiced (Gross)</div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{formatINR(totalBilled)}</div>
          <div className="text-[11px] text-slate-400 mt-1">{invoices.length} invoices issued</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-slate-500 text-xs font-medium">Collections Received</div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">{formatINR(totalReceived)}</div>
          <div className="text-[11px] text-emerald-600 mt-1">{payments.length} settled receipts</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-slate-500 text-xs font-medium">Outstanding Receivables</div>
          <div className="text-2xl font-bold font-mono text-rose-600 mt-1">{formatINR(totalOutstanding)}</div>
          <div className="text-[11px] text-rose-700 font-semibold mt-1">Pending settlement</div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-4 border-b border-slate-200 text-xs font-medium">
        <button
          onClick={() => setActiveSubTab('invoices')}
          className={`pb-3 border-b-2 transition ${
            activeSubTab === 'invoices'
              ? 'border-emerald-600 text-emerald-800 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Invoices Directory ({invoices.length})
        </button>
        <button
          onClick={() => setActiveSubTab('payments')}
          className={`pb-3 border-b-2 transition ${
            activeSubTab === 'payments'
              ? 'border-emerald-600 text-emerald-800 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Payment Receipts Ledger ({payments.length})
        </button>
      </div>

      {/* INVOICES SECTION */}
      {activeSubTab === 'invoices' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Mobile Invoices Card List */}
          <div className="block md:hidden divide-y divide-slate-100">
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No invoices found in database.
              </div>
            ) : (
              invoices.map((inv) => (
                <div key={inv.id} className="p-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <Link href={`/billing/${inv.id}/invoice-view`} className="font-mono font-bold text-slate-900 text-sm hover:text-emerald-700 underline">
                      {inv.invoiceNumber}
                    </Link>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {inv.status}
                    </span>
                  </div>

                  <div>
                    <div className="font-semibold text-slate-900">{inv.customerName}</div>
                    {inv.projectCode && (
                      <div className="text-slate-400 font-mono text-[11px]">Project: {inv.projectCode}</div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl font-mono text-[11px]">
                    <div>
                      <span className="text-slate-400 font-sans block text-[10px]">Total (Inc GST)</span>
                      <span className="font-bold text-slate-900">{formatINR(inv.totalAmount)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-sans block text-[10px]">Outstanding</span>
                      <span className="font-bold text-rose-700">{formatINR(inv.outstandingAmount)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                    <span>Date: {formatDate(inv.invoiceDate)}</span>
                    <span>Due: {formatDate(inv.dueDate)}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      href={`/billing/${inv.id}/invoice-view`}
                      className="flex-1 text-center py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition min-h-[38px] flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Invoice</span>
                    </Link>
                    {inv.outstandingAmount > 0 && can('BILLING_RECORD_PAYMENT') && (
                      <button
                        onClick={() => handleOpenPayment(inv)}
                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition min-h-[38px] flex items-center justify-center"
                      >
                        Record Payment
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Invoices Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Invoice Number</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Invoice Date</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3 text-right">Taxable</th>
                  <th className="px-4 py-3 text-right">GST</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-900">Total Amount</th>
                  <th className="px-4 py-3 text-right text-rose-700 font-bold">Outstanding</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                      <Link href={`/billing/${inv.id}/invoice-view`} className="hover:text-emerald-700 underline">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-sans font-semibold text-slate-800">
                      {inv.customerName}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {inv.projectCode || '-'}
                    </td>
                    <td className="px-4 py-3">{formatDate(inv.invoiceDate)}</td>
                    <td className="px-4 py-3">{formatDate(inv.dueDate)}</td>
                    <td className="px-4 py-3 text-right">{formatINR(inv.taxableValue)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatINR((inv.cgstAmount || 0) + (inv.sgstAmount || 0) + (inv.igstAmount || 0))}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{formatINR(inv.totalAmount)}</td>
                    <td className="px-4 py-3 text-right font-bold text-rose-700">{formatINR(inv.outstandingAmount)}</td>
                    <td className="px-4 py-3 text-center font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-sans whitespace-nowrap space-x-1">
                      <Link
                        href={`/billing/${inv.id}/invoice-view`}
                        className="p-1 text-slate-500 hover:text-slate-800 transition inline-block"
                        title="Print GST Invoice"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Link>
                      {inv.outstandingAmount > 0 && can('BILLING_RECORD_PAYMENT') && (
                        <button
                          onClick={() => handleOpenPayment(inv)}
                          className="px-2 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded transition"
                        >
                          Record Pay
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PAYMENTS SECTION */}
      {activeSubTab === 'payments' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Mobile Payments Card List */}
          <div className="block md:hidden divide-y divide-slate-100">
            {payments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No payment receipts logged yet.
              </div>
            ) : (
              payments.map((p) => (
                <div key={p.id} className="p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">{p.receiptNumber}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 font-sans">
                      {p.paymentMethod}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">{p.customerName}</div>
                    <div className="text-slate-400 text-[11px]">Invoice: {p.invoiceNumber}</div>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 font-mono">
                    <span className="text-slate-400 font-sans">Amount Paid:</span>
                    <span className="font-bold text-emerald-700 text-sm">{formatINR(p.amount)}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-0.5">
                    <span>Date: {formatDate(p.paymentDate)}</span>
                    <span className="truncate">Ref: {p.transactionReference}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Payments Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Receipt Number</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Invoice Ref</th>
                  <th className="px-4 py-3">Payment Date</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">UTR / Reference</th>
                  <th className="px-4 py-3 text-right font-bold text-emerald-800">Amount Paid</th>
                  <th className="px-4 py-3">Received By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-bold text-slate-900">{p.receiptNumber}</td>
                    <td className="px-4 py-3 font-sans font-semibold text-slate-800">{p.customerName}</td>
                    <td className="px-4 py-3 text-slate-600">{p.invoiceNumber}</td>
                    <td className="px-4 py-3">{formatDate(p.paymentDate)}</td>
                    <td className="px-4 py-3 font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-[11px]">{p.transactionReference}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatINR(p.amount)}</td>
                    <td className="px-4 py-3 font-sans text-slate-600">{p.receiverName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Issue Tax Invoice */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900">Issue GST Tax Invoice</h3>
            <form onSubmit={handleCreateInvoice} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer *</label>
                <select
                  value={invCustomerId}
                  onChange={(e) => setInvCustomerId(e.target.value)}
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Related Project</label>
                <select
                  value={invProjectId}
                  onChange={(e) => setInvProjectId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono text-xs"
                >
                  <option value="">None / General Billing</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.projectCode} - {p.siteName}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Invoice Date *</label>
                  <input
                    type="date"
                    value={invDate}
                    onChange={(e) => setInvDate(e.target.value)}
                    required
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Due Date *</label>
                  <input
                    type="date"
                    value={invDueDate}
                    onChange={(e) => setInvDueDate(e.target.value)}
                    required
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Invoice Line Description *</label>
                <input
                  type="text"
                  value={invDescription}
                  onChange={(e) => setInvDescription(e.target.value)}
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Taxable Amount (INR) *</label>
                <input
                  type="number"
                  value={invRate}
                  onChange={(e) => setInvRate(Number(e.target.value))}
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  18% GST (CGST 9% + SGST 9%) will be automatically calculated on submission.
                </p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setInvoiceModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:text-slate-900 text-center min-h-[40px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition min-h-[40px]"
                >
                  Generate Tax Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Payment */}
      {paymentModalOpen && selectedInvoiceForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900">Record Customer Payment</h3>
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <div>Invoice: <span className="font-bold font-mono">{selectedInvoiceForPayment.invoiceNumber}</span></div>
              <div>Customer: <span className="font-semibold">{selectedInvoiceForPayment.customerName}</span></div>
              <div>Outstanding: <span className="font-mono font-bold text-rose-700">{formatINR(selectedInvoiceForPayment.outstandingAmount)}</span></div>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount Paid (INR) *</label>
                <input
                  type="number"
                  max={selectedInvoiceForPayment.outstandingAmount}
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono font-bold text-emerald-800 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-medium text-xs"
                  >
                    <option value="NEFT">NEFT Transfer</option>
                    <option value="RTGS">RTGS Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="UPI">UPI Payment</option>
                    <option value="CASH">Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bank / UTR Reference Number *</label>
                <input
                  type="text"
                  placeholder="e.g. NEFT-HDFC-9823419082"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono text-xs"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:text-slate-900 text-center min-h-[40px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition min-h-[40px]"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
