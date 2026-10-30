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
  Building2,
  X,
  Layers,
  ArrowUpRight
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

  // New Invoice Modal
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invCustomerId, setInvCustomerId] = useState('');
  const [invProjectId, setInvProjectId] = useState('');
  const [invType, setInvType] = useState<'RENTAL_CHARGE' | 'TRANSPORT' | 'LABOUR' | 'SHIFTING' | 'DAMAGE_PENALTY'>('RENTAL_CHARGE');
  const [invDate, setInvDate] = useState('');
  const [invDueDate, setInvDueDate] = useState('');
  const [invDescription, setInvDescription] = useState('');
  const [invRate, setInvRate] = useState<number>(0);

  // New Payment Modal
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
          actorId: currentUser?.id,
          actorName: currentUser?.fullName,
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
          actorId: currentUser?.id,
          actorName: currentUser?.fullName,
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
      {/* Header Banner */}
      <div className="bg-[#24160c] border border-[#19100a] rounded-lg p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono tracking-widest text-[#c79e7c] uppercase">Commercial Accounts</span>
            <span className="text-stone-500">|</span>
            <span className="text-xs text-stone-300">GST SAC 997312</span>
          </div>
          <h1 className="text-xl font-serif font-bold tracking-tight text-white flex items-center gap-2">
            <ReceiptIndianRupee className="w-5 h-5 text-[#c79e7c]" />
            <span>Billing, Invoices & Payment Ledger</span>
          </h1>
          <p className="text-xs text-stone-300 mt-1">
            GST-compliant invoicing, rental cycle collections, advances, and commercial client receivables.
          </p>
        </div>

        {can('BILLING_CREATE_INVOICE') && (
          <button
            onClick={() => setInvoiceModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1c120c] bg-[#c79e7c] hover:bg-[#dfcbab] rounded-md shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Issue Tax Invoice</span>
          </button>
        )}
      </div>

      {/* Financial Health Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs">
          <div className="text-stone-500 text-xs font-medium">Total Invoiced (Gross)</div>
          <div className="text-2xl font-bold font-mono text-[#24160c] mt-1">{formatINR(totalBilled)}</div>
          <div className="text-[11px] text-stone-400 mt-1">{invoices.length} invoices issued</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs">
          <div className="text-stone-500 text-xs font-medium">Collections Received</div>
          <div className="text-2xl font-bold font-mono text-[#714f36] mt-1">{formatINR(totalReceived)}</div>
          <div className="text-[11px] text-stone-500 mt-1">{payments.length} settled receipts</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-[#e8decb] shadow-2xs">
          <div className="text-stone-500 text-xs font-medium">Outstanding Receivables</div>
          <div className="text-2xl font-bold font-mono text-rose-700 mt-1">{formatINR(totalOutstanding)}</div>
          <div className="text-[11px] text-rose-600 font-semibold mt-1">Pending settlement</div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-4 border-b border-[#e8decb] text-xs font-medium">
        <button
          onClick={() => setActiveSubTab('invoices')}
          className={`pb-3 border-b-2 transition ${
            activeSubTab === 'invoices'
              ? 'border-[#8f6541] text-[#24160c] font-bold'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Invoices Directory ({invoices.length})
        </button>
        <button
          onClick={() => setActiveSubTab('payments')}
          className={`pb-3 border-b-2 transition ${
            activeSubTab === 'payments'
              ? 'border-[#8f6541] text-[#24160c] font-bold'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          Payment Receipts Ledger ({payments.length})
        </button>
      </div>

      {/* INVOICES SECTION */}
      {activeSubTab === 'invoices' && (
        <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
          {/* Mobile View */}
          <div className="block md:hidden divide-y divide-[#f0e8db]">
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-400">
                No invoices found in database.
              </div>
            ) : (
              invoices.map((inv) => (
                <div key={inv.id} className="p-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <Link href={`/billing/${inv.id}/invoice-view`} className="font-mono font-bold text-[#24160c] text-sm hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      inv.status === 'PAID' ? 'bg-[#fbf7f0] text-[#714f36] border-[#ebdcc9]' : 'bg-amber-100 text-amber-800 border-amber-200'
                    }`}>
                      {inv.status}
                    </span>
                  </div>

                  <div>
                    <div className="font-semibold text-stone-900">{inv.customerName}</div>
                    {inv.projectCode && (
                      <div className="text-stone-400 font-mono text-[11px]">Project: {inv.projectCode}</div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-[#fbf9f5] p-2.5 rounded-md border border-[#ede3d4] font-mono text-[11px]">
                    <div>
                      <span className="text-stone-400 font-sans block text-[10px]">Total (Inc GST)</span>
                      <span className="font-bold text-stone-900">{formatINR(inv.totalAmount)}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 font-sans block text-[10px]">Outstanding</span>
                      <span className="font-bold text-rose-700">{formatINR(inv.outstandingAmount)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-stone-400">
                    <span>Date: {formatDate(inv.invoiceDate)}</span>
                    <span>Due: {formatDate(inv.dueDate)}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      href={`/billing/${inv.id}/invoice-view`}
                      className="flex-1 text-center py-2 px-3 bg-[#f7f2eb] hover:bg-[#ebdcc9] text-stone-700 font-semibold rounded-md border border-[#d6c7b2] transition min-h-[38px] flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Invoice</span>
                    </Link>
                    {inv.outstandingAmount > 0 && can('BILLING_RECORD_PAYMENT') && (
                      <button
                        onClick={() => handleOpenPayment(inv)}
                        className="flex-1 py-2 px-3 bg-[#24160c] hover:bg-[#382315] text-[#c79e7c] border border-[#19100a] font-semibold rounded-md transition min-h-[38px] flex items-center justify-center"
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
              <thead className="bg-[#fbf9f5] text-stone-600 uppercase tracking-wider text-[10px] font-semibold border-b border-[#e8decb]">
                <tr>
                  <th className="px-4 py-3">Invoice Number</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Invoice Date</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3 text-right">Taxable</th>
                  <th className="px-4 py-3 text-right">GST</th>
                  <th className="px-4 py-3 text-right font-bold text-stone-900">Total Amount</th>
                  <th className="px-4 py-3 text-right text-rose-700 font-bold">Outstanding</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0e8db] font-mono">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#fcfbf9] transition">
                    <td className="px-4 py-3 font-bold text-[#24160c] whitespace-nowrap">
                      <Link href={`/billing/${inv.id}/invoice-view`} className="hover:underline hover:text-[#8f6541]">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-sans font-semibold text-stone-800">
                      {inv.customerName}
                    </td>
                    <td className="px-4 py-3 font-mono text-stone-500">
                      {inv.projectCode || '-'}
                    </td>
                    <td className="px-4 py-3">{formatDate(inv.invoiceDate)}</td>
                    <td className="px-4 py-3">{formatDate(inv.dueDate)}</td>
                    <td className="px-4 py-3 text-right">{formatINR(inv.taxableValue)}</td>
                    <td className="px-4 py-3 text-right text-stone-600">{formatINR((inv.cgstAmount || 0) + (inv.sgstAmount || 0) + (inv.igstAmount || 0))}</td>
                    <td className="px-4 py-3 text-right font-bold text-stone-900">{formatINR(inv.totalAmount)}</td>
                    <td className="px-4 py-3 text-right font-bold text-rose-700">{formatINR(inv.outstandingAmount)}</td>
                    <td className="px-4 py-3 text-center font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        inv.status === 'PAID' ? 'bg-[#fbf7f0] text-[#714f36] border-[#ebdcc9]' : 'bg-amber-100 text-amber-800 border-amber-200'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-sans whitespace-nowrap space-x-1">
                      <Link
                        href={`/billing/${inv.id}/invoice-view`}
                        className="p-1 text-stone-500 hover:text-stone-800 transition inline-block"
                        title="Print GST Invoice"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Link>
                      {inv.outstandingAmount > 0 && can('BILLING_RECORD_PAYMENT') && (
                        <button
                          onClick={() => handleOpenPayment(inv)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-[#f7f2eb] text-[#24160c] hover:bg-[#ebdcc9] border border-[#d6c7b2] rounded transition"
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
        <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
          {/* Mobile View */}
          <div className="block md:hidden divide-y divide-[#f0e8db]">
            {payments.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-400">
                No payment receipts logged yet.
              </div>
            ) : (
              payments.map((p) => (
                <div key={p.id} className="p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[#24160c]">{p.receiptNumber}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#fbf9f5] border border-[#ede3d4] text-stone-700 font-sans">
                      {p.paymentMethod}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-stone-800">{p.customerName}</div>
                    <div className="text-stone-400 text-[11px]">Invoice: {p.invoiceNumber}</div>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-[#f0e8db] font-mono">
                    <span className="text-stone-400 font-sans">Amount Paid:</span>
                    <span className="font-bold text-[#714f36] text-sm">{formatINR(p.amount)}</span>
                  </div>
                  <div className="text-[10px] text-stone-400 flex items-center justify-between pt-0.5">
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
              <thead className="bg-[#fbf9f5] text-stone-600 uppercase tracking-wider text-[10px] font-semibold border-b border-[#e8decb]">
                <tr>
                  <th className="px-4 py-3">Receipt Number</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Invoice Ref</th>
                  <th className="px-4 py-3">Payment Date</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">UTR / Reference</th>
                  <th className="px-4 py-3 text-right font-bold text-[#714f36]">Amount Paid</th>
                  <th className="px-4 py-3">Received By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0e8db] font-mono">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-[#fcfbf9] transition">
                    <td className="px-4 py-3 font-bold text-[#24160c]">{p.receiptNumber}</td>
                    <td className="px-4 py-3 font-sans font-semibold text-stone-800">{p.customerName}</td>
                    <td className="px-4 py-3 text-stone-600">{p.invoiceNumber}</td>
                    <td className="px-4 py-3">{formatDate(p.paymentDate)}</td>
                    <td className="px-4 py-3 font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#fbf9f5] border border-[#ede3d4] text-stone-700">
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-600 text-[11px]">{p.transactionReference}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#714f36]">{formatINR(p.amount)}</td>
                    <td className="px-4 py-3 font-sans text-stone-600">{p.receiverName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Issue Tax Invoice */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#140b06]/70 backdrop-blur-xs">
          <div className="bg-white rounded-lg max-w-lg w-full p-5 sm:p-6 shadow-xl border border-[#d6c7b2] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#f0e8db] pb-3">
              <h3 className="text-base font-serif font-bold text-[#24160c]">Issue GST Tax Invoice</h3>
              <button onClick={() => setInvoiceModalOpen(false)} className="text-stone-400 hover:text-stone-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Customer *</label>
                <select
                  value={invCustomerId}
                  onChange={(e) => setInvCustomerId(e.target.value)}
                  required
                  className="w-full p-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-xs focus:bg-white focus:border-[#8f6541] focus:outline-none"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Related Project</label>
                <select
                  value={invProjectId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setInvProjectId(pid);
                    const proj = projects.find(p => p.id === pid);
                    if (proj) {
                      setInvCustomerId(proj.customerId);
                      if (proj.status === 'NOT_INSTALLED' || proj.status === 'CONFIRMED_PROJECT' || (proj.status as string) === 'CONFIRMED') {
                        const adv = proj.advanceRequiredAmount || Math.round((proj.agreedProjectPrice || 0) * 0.75);
                        setInvRate(adv);
                        setInvDescription(`75% Advance Payment before installation (Term 7) - ${proj.projectCode}`);
                      } else {
                        setInvRate(proj.monthlyRentalRate || 0);
                        setInvDescription(`28-Day Monthly Rental Cycle (Term 2) - ${proj.projectCode}`);
                      }
                    }
                  }}
                  className="w-full p-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md font-mono text-xs focus:bg-white focus:border-[#8f6541] focus:outline-none"
                >
                  <option value="">None / General Billing</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.projectCode} - {p.siteName} ({p.status})</option>
                  ))}
                </select>
              </div>

              {/* Terms Quick Pre-set Buttons */}
              {invProjectId && (() => {
                const proj = projects.find(p => p.id === invProjectId);
                if (!proj) return null;
                const adv75 = proj.advanceRequiredAmount || Math.round((proj.agreedProjectPrice || 0) * 0.75);
                const bal25 = proj.completionDueAmount || Math.round((proj.agreedProjectPrice || 0) * 0.25);
                const shiftCost = Math.round((proj.totalAreaSqFt || 0) * 6) || Math.round((proj.monthlyRentalRate || 0) * 0.6);
                const transport2Way = (proj.twoWayTransportCharges || proj.transportCharges || 0) * 2;

                return (
                  <div className="p-2.5 bg-[#fbf9f5] border border-[#ede3d4] rounded-md space-y-1.5">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                      Quick Commercial Preset (Terms 1-11):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setInvRate(adv75);
                          setInvDescription(`75% Advance Payment before installation (Term 7) - ${proj.projectCode}`);
                        }}
                        className="px-2 py-1 bg-[#fbf7f0] hover:bg-[#f4ebe1] text-[#714f36] border border-[#ebdcc9] rounded font-semibold text-[10px]"
                      >
                        75% Advance: ₹{formatINR(adv75, false)}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setInvRate(bal25);
                          setInvDescription(`25% Completion Balance after installation (Term 7) - ${proj.projectCode}`);
                        }}
                        className="px-2 py-1 bg-[#fbf7f0] hover:bg-[#f4ebe1] text-[#714f36] border border-[#ebdcc9] rounded font-semibold text-[10px]"
                      >
                        25% Balance: ₹{formatINR(bal25, false)}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setInvRate(proj.monthlyRentalRate || 0);
                          setInvDescription(`28-Day Monthly Rental (Term 2) - ${proj.projectCode}`);
                        }}
                        className="px-2 py-1 bg-[#f7f2eb] hover:bg-[#ebdcc9] text-[#24160c] border border-[#d6c7b2] rounded font-semibold text-[10px]"
                      >
                        28d Rental: ₹{formatINR(proj.monthlyRentalRate || 0, false)}
                      </button>

                      {transport2Way > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setInvRate(transport2Way);
                            setInvDescription(`2-Way Transportation (Delivery & Return - Term 3) - ${proj.projectCode}`);
                          }}
                          className="px-2 py-1 bg-[#fbf7f0] hover:bg-[#f4ebe1] text-[#78350f] border border-[#ebdcc9] rounded font-semibold text-[10px]"
                        >
                          2-Way Transport: ₹{formatINR(transport2Way, false)}
                        </button>
                      )}

                      {shiftCost > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setInvRate(shiftCost);
                            setInvDescription(`Shifting Charges (Term 5) - ${proj.projectCode}`);
                          }}
                          className="px-2 py-1 bg-[#fbf9f5] hover:bg-[#ede3d4] text-stone-800 border border-[#ede3d4] rounded font-semibold text-[10px]"
                        >
                          Shifting: ₹{formatINR(shiftCost, false)}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Invoice Date *</label>
                  <input
                    type="date"
                    value={invDate}
                    onChange={(e) => setInvDate(e.target.value)}
                    required
                    className="w-full p-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md font-mono text-xs focus:bg-white focus:border-[#8f6541] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Due Date *</label>
                  <input
                    type="date"
                    value={invDueDate}
                    onChange={(e) => setInvDueDate(e.target.value)}
                    required
                    className="w-full p-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md font-mono text-xs focus:bg-white focus:border-[#8f6541] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Invoice Line Description *</label>
                <input
                  type="text"
                  value={invDescription}
                  onChange={(e) => setInvDescription(e.target.value)}
                  required
                  className="w-full p-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md text-xs focus:bg-white focus:border-[#8f6541] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Taxable Amount (INR) *</label>
                <input
                  type="number"
                  value={invRate}
                  onChange={(e) => setInvRate(Number(e.target.value))}
                  required
                  className="w-full p-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md font-mono font-bold text-stone-900 text-xs focus:bg-white focus:border-[#8f6541] focus:outline-none"
                />
                <p className="text-[10px] text-stone-400 mt-1">
                  18% GST (CGST 9% + SGST 9%) will be automatically calculated on submission.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f0e8db]">
                <button
                  type="button"
                  onClick={() => setInvoiceModalOpen(false)}
                  className="px-3.5 py-2 text-stone-600 hover:text-stone-900 text-center rounded-md border border-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#24160c] hover:bg-[#382315] text-white rounded-md font-bold transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#140b06]/70 backdrop-blur-xs">
          <div className="bg-white rounded-lg max-w-md w-full p-5 sm:p-6 shadow-xl border border-[#d6c7b2] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#f0e8db] pb-3">
              <h3 className="text-base font-serif font-bold text-[#24160c]">Record Customer Payment</h3>
              <button onClick={() => setPaymentModalOpen(false)} className="text-stone-400 hover:text-stone-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-[#fbf9f5] rounded-md border border-[#ede3d4] text-xs space-y-1">
              <div>Invoice: <span className="font-bold font-mono text-[#24160c]">{selectedInvoiceForPayment.invoiceNumber}</span></div>
              <div>Customer: <span className="font-semibold text-stone-800">{selectedInvoiceForPayment.customerName}</span></div>
              <div>Outstanding: <span className="font-mono font-bold text-rose-700">{formatINR(selectedInvoiceForPayment.outstandingAmount)}</span></div>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Amount Paid (INR) *</label>
                <input
                  type="number"
                  max={selectedInvoiceForPayment.outstandingAmount}
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  required
                  className="w-full p-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md font-mono font-bold text-[#714f36] text-xs focus:bg-white focus:border-[#8f6541] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Payment Method</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="w-full p-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md font-medium text-xs focus:bg-white focus:border-[#8f6541] focus:outline-none"
                  >
                    <option value="NEFT">NEFT Transfer</option>
                    <option value="RTGS">RTGS Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="UPI">UPI Payment</option>
                    <option value="CASH">Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full p-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md font-mono text-xs focus:bg-white focus:border-[#8f6541] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Bank / UTR Reference Number *</label>
                <input
                  type="text"
                  placeholder="e.g. NEFT-HDFC-9823419082"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  required
                  className="w-full p-2 bg-[#fbf9f5] border border-[#d6c7b2] rounded-md font-mono text-xs focus:bg-white focus:border-[#8f6541] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f0e8db]">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-3.5 py-2 text-stone-600 hover:text-stone-900 text-center rounded-md border border-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#24160c] hover:bg-[#382315] text-white rounded-md font-bold transition"
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
