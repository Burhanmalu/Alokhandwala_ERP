'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ReceiptIndianRupee, 
  Search, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowLeft,
  Building2,
  FolderKanban,
  FileText,
  CreditCard,
  Filter,
  X,
  ExternalLink,
  ChevronRight,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Eye,
  ArrowUpRight
} from 'lucide-react';
import { Invoice, Payment, Customer, Project, Quotation } from '@/lib/schema';
import { formatINR, formatDate } from '@/lib/formatters';
import { useAuth } from '@/lib/auth/auth-context';

export default function OutstandingPaymentsPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-xs text-[#7d6553]">Loading Outstanding Payments...</div>}>
      <OutstandingPaymentsContent />
    </React.Suspense>
  );
}

function OutstandingPaymentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can, currentUser } = useAuth();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedCustomerId, setSelectedCustomerId] = useState(searchParams.get('customerId') || 'ALL');
  const [selectedProjectId, setSelectedProjectId] = useState(searchParams.get('projectId') || 'ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>(searchParams.get('status') || 'PENDING');
  const [fromDate, setFromDate] = useState(searchParams.get('from') || '');
  const [toDate, setToDate] = useState(searchParams.get('to') || '');

  // Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailType, setDetailType] = useState<'CUSTOMER' | 'PROJECT' | 'INVOICE'>('CUSTOMER');
  const [selectedCustomerForDetail, setSelectedCustomerForDetail] = useState<Customer | null>(null);
  const [selectedProjectForDetail, setSelectedProjectForDetail] = useState<Project | null>(null);
  const [selectedInvoiceForDetail, setSelectedInvoiceForDetail] = useState<Invoice | null>(null);

  // Record Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'NEFT' | 'RTGS' | 'CHEQUE' | 'UPI' | 'CASH'>('NEFT');
  const [payRef, setPayRef] = useState('');
  const [payBank, setPayBank] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // New Invoice Modal State
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invCustomerId, setInvCustomerId] = useState('');
  const [invProjectId, setInvProjectId] = useState('');
  const [invType, setInvType] = useState<'RENTAL_CHARGE' | 'TRANSPORT' | 'LABOUR' | 'SHIFTING' | 'DAMAGE_PENALTY'>('RENTAL_CHARGE');
  const [invDate, setInvDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [invDueDate, setInvDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  });
  const [invDescription, setInvDescription] = useState('Scaffolding monthly rental charges');
  const [invRate, setInvRate] = useState<number>(0);
  const [submittingInvoice, setSubmittingInvoice] = useState(false);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'ADMIN') {
      if (currentUser.role === 'SUPERVISOR') {
        router.replace('/sites/new');
      } else {
        router.replace('/projects');
      }
    }
  }, [currentUser, router]);

  useEffect(() => {
    fetchReceivablesData();
  }, []);

  const fetchReceivablesData = async () => {
    setLoading(true);
    try {
      const [invRes, payRes, custRes, projRes, qtnRes] = await Promise.all([
        fetch('/api/billing/invoices'),
        fetch('/api/billing/payments'),
        fetch('/api/customers'),
        fetch('/api/projects'),
        fetch('/api/quotations'),
      ]);

      const [invJson, payJson, custJson, projJson, qtnJson] = await Promise.all([
        invRes.json(),
        payRes.json(),
        custRes.json(),
        projRes.json(),
        qtnRes.json(),
      ]);

      if (invJson.success) setInvoices(invJson.data || []);
      if (payJson.success) setPayments(payJson.data || []);
      if (custJson.success) {
        setCustomers(custJson.data || []);
        if (custJson.data.length > 0 && !invCustomerId) {
          setInvCustomerId(custJson.data[0].id);
        }
      }
      if (projJson.success) setProjects(projJson.data || []);
      if (qtnJson.success) setQuotations(qtnJson.data || []);
    } catch (e) {
      console.error('Error fetching receivables data:', e);
    } finally {
      setLoading(false);
    }
  };

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Compute Payment Status helper for any invoice
  const getInvoicePaymentStatus = (inv: Invoice): 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'OVERDUE' => {
    if (inv.outstandingAmount <= 0 || inv.paidAmount >= inv.totalAmount) {
      return 'PAID';
    }
    const isOverdue = inv.dueDate && inv.dueDate < todayStr;
    if (isOverdue) {
      return 'OVERDUE';
    }
    if (inv.paidAmount > 0) {
      return 'PARTIALLY_PAID';
    }
    return 'UNPAID';
  };

  // Find Quotation Number linked to an invoice (via project)
  const getInvoiceQuotationNumber = (inv: Invoice): string => {
    if (!inv.projectId) return 'Direct Invoice';
    const proj = projects.find(p => p.id === inv.projectId);
    if (proj?.quotationNumber) return proj.quotationNumber;
    const qtn = quotations.find(q => q.projectId === inv.projectId);
    if (qtn?.quotationNumber) return qtn.quotationNumber;
    return 'N/A';
  };

  // 1. Overall Financial Summary Cards Calculations (Actual DB records)
  const summaryMetrics = useMemo(() => {
    const validInvoices = invoices.filter(i => i.status !== 'CANCELLED');
    const totalOutstanding = validInvoices.reduce((sum, i) => sum + (i.outstandingAmount || 0), 0);

    const pendingInvoices = validInvoices.filter(i => (i.outstandingAmount || 0) > 0);
    const uniqueCustomerIds = new Set(pendingInvoices.map(i => i.customerId));
    const uniqueProjectIds = new Set(pendingInvoices.map(i => i.projectId).filter(Boolean));

    let unpaidInvoicesCount = 0;
    let partiallyPaidInvoicesCount = 0;
    let overdueAmount = 0;

    for (const inv of validInvoices) {
      const status = getInvoicePaymentStatus(inv);
      if (status === 'UNPAID') unpaidInvoicesCount++;
      if (status === 'PARTIALLY_PAID') partiallyPaidInvoicesCount++;
      if (status === 'OVERDUE') {
        overdueAmount += (inv.outstandingAmount || 0);
      }
    }

    return {
      totalOutstanding,
      customersCount: uniqueCustomerIds.size,
      projectsCount: uniqueProjectIds.size,
      unpaidInvoicesCount,
      partiallyPaidInvoicesCount,
      overdueAmount,
    };
  }, [invoices, todayStr]);

  // 2. Filter Invoices based on user criteria
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (inv.status === 'CANCELLED') return false;

      const pStatus = getInvoicePaymentStatus(inv);

      // Status Filter
      if (selectedStatusFilter === 'PENDING') {
        if (pStatus === 'PAID') return false; // Exclude fully paid invoices
      } else if (selectedStatusFilter === 'OVERDUE') {
        if (pStatus !== 'OVERDUE') return false;
      } else if (selectedStatusFilter === 'UNPAID') {
        if (pStatus !== 'UNPAID') return false;
      } else if (selectedStatusFilter === 'PARTIALLY_PAID') {
        if (pStatus !== 'PARTIALLY_PAID') return false;
      } else if (selectedStatusFilter === 'PAID') {
        if (pStatus !== 'PAID') return false;
      }
      // 'ALL' includes everything

      // Customer Filter
      if (selectedCustomerId !== 'ALL' && inv.customerId !== selectedCustomerId) {
        return false;
      }

      // Project Filter
      if (selectedProjectId !== 'ALL' && inv.projectId !== selectedProjectId) {
        return false;
      }

      // Date Range Filter
      if (fromDate && inv.invoiceDate < fromDate) {
        return false;
      }
      if (toDate && inv.invoiceDate > toDate) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const qtnNum = getInvoiceQuotationNumber(inv).toLowerCase();
        const match = 
          inv.customerName?.toLowerCase().includes(q) ||
          inv.invoiceNumber?.toLowerCase().includes(q) ||
          inv.projectCode?.toLowerCase().includes(q) ||
          qtnNum.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [invoices, selectedStatusFilter, selectedCustomerId, selectedProjectId, fromDate, toDate, searchQuery, todayStr, projects, quotations]);

  // Clear all filters handler
  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCustomerId('ALL');
    setSelectedProjectId('ALL');
    setSelectedStatusFilter('PENDING');
    setFromDate('');
    setToDate('');
    router.replace('/billing/outstanding');
  };

  // Open Details Modal for Customer
  const handleOpenCustomerDetail = (customerId: string) => {
    const cust = customers.find(c => c.id === customerId);
    if (!cust) return;
    setSelectedCustomerForDetail(cust);
    setSelectedProjectForDetail(null);
    setSelectedInvoiceForDetail(null);
    setDetailType('CUSTOMER');
    setDetailModalOpen(true);
  };

  // Open Details Modal for Project
  const handleOpenProjectDetail = (projectId: string) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    setSelectedProjectForDetail(proj);
    const cust = customers.find(c => c.id === proj.customerId);
    setSelectedCustomerForDetail(cust || null);
    setSelectedInvoiceForDetail(null);
    setDetailType('PROJECT');
    setDetailModalOpen(true);
  };

  // Open Details Modal for Invoice
  const handleOpenInvoiceDetail = (inv: Invoice) => {
    setSelectedInvoiceForDetail(inv);
    const cust = customers.find(c => c.id === inv.customerId);
    setSelectedCustomerForDetail(cust || null);
    const proj = projects.find(p => p.id === inv.projectId);
    setSelectedProjectForDetail(proj || null);
    setDetailType('INVOICE');
    setDetailModalOpen(true);
  };

  // Open Record Payment Modal
  const handleOpenRecordPayment = (inv: Invoice) => {
    setSelectedInvoiceForPayment(inv);
    setPayAmount(inv.outstandingAmount);
    setPayRef(`NEFT-${Date.now().toString().slice(-6)}`);
    setPayDate(new Date().toISOString().slice(0, 10));
    setPaymentModalOpen(true);
  };

  // Submit Payment Handler
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment) return;

    if (payAmount <= 0) {
      alert('Payment amount must be greater than zero.');
      return;
    }

    if (payAmount > selectedInvoiceForPayment.outstandingAmount) {
      alert(`Payment cannot exceed outstanding balance of ₹${selectedInvoiceForPayment.outstandingAmount}`);
      return;
    }

    setSubmittingPayment(true);
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
          actorId: currentUser?.id || 'usr-admin-01',
          actorName: currentUser?.fullName || 'Burhan Malu',
        }),
      });

      const json = await res.json();
      if (json.success) {
        setPaymentModalOpen(false);
        fetchReceivablesData();
      } else {
        alert(json.error || 'Failed to record payment');
      }
    } catch (err: any) {
      alert('Error recording payment: ' + err.message);
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Submit New Invoice Handler
  const handleSubmitNewInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invCustomerId) {
      alert('Please select a customer');
      return;
    }

    if (invRate <= 0) {
      alert('Invoice rate amount must be greater than zero.');
      return;
    }

    setSubmittingInvoice(true);
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
          actorId: currentUser?.id || 'usr-admin-01',
          actorName: currentUser?.fullName || 'Burhan Malu',
        }),
      });

      const json = await res.json();
      if (json.success) {
        setInvoiceModalOpen(false);
        fetchReceivablesData();
      } else {
        alert(json.error || 'Failed to issue invoice');
      }
    } catch (err: any) {
      alert('Error creating invoice: ' + err.message);
    } finally {
      setSubmittingInvoice(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-[#7d6553]">
        <Link href="/" className="hover:text-[#24160c] flex items-center gap-1 transition">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </Link>
        <span>/</span>
        <Link href="/billing" className="hover:text-[#24160c] transition">
          <span>Billing & Invoices</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-[#24160c]">Outstanding Payments</span>
      </div>

      {/* Enterprise Header Banner */}
      <div className="bg-[#1e130c] rounded-xl border border-[#3b2416] p-5 sm:p-6 text-[#fdfbf7] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#c79e7c]">
            <span>Commercial Accounts Control</span>
            <span>•</span>
            <span className="font-mono text-[#e8decb]">Receivables Ledger</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#fdfbf7] tracking-tight mt-1 flex items-center gap-2.5">
            <ReceiptIndianRupee className="w-6 h-6 text-[#c79e7c]" />
            <span>Outstanding Payments & Receivables</span>
          </h1>
          <p className="text-xs text-[#debfa6] mt-1 max-w-2xl">
            Live receivables tracking: view confirmed billed invoices, monitor pending customer balances, and record payment receipts.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={() => fetchReceivablesData()}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-[#d6beaa] hover:text-white transition cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/billing"
            className="px-3.5 py-2 text-xs font-semibold text-[#d6beaa] hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition cursor-pointer"
          >
            All Invoices Directory
          </Link>

          {can('BILLING_CREATE_INVOICE') && (
            <button
              onClick={() => setInvoiceModalOpen(true)}
              className="px-4 py-2 text-xs font-bold text-[#24160c] bg-[#c79e7c] hover:bg-[#dfcbab] rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Issue Tax Invoice</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 4: OUTSTANDING BALANCE SUMMARY CARDS (6 CARDS)     */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Total Outstanding Amount */}
        <div className="bg-white p-4 rounded-xl border border-[#e8decb] shadow-2xs border-l-4 border-l-[#8c5e39] flex flex-col justify-between">
          <div className="text-[10px] text-[#7d6553] uppercase font-bold tracking-wider">
            Total Outstanding
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#24160c] my-1">
            {formatINR(summaryMetrics.totalOutstanding, false)}
          </div>
          <div className="text-[10px] text-[#8c7360] font-sans">
            Confirmed billed amount due
          </div>
        </div>

        {/* 2. Customers with Pending Payments */}
        <div className="bg-white p-4 rounded-xl border border-[#e8decb] shadow-2xs border-l-4 border-l-blue-600 flex flex-col justify-between">
          <div className="text-[10px] text-[#7d6553] uppercase font-bold tracking-wider">
            Pending Customers
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-blue-800 my-1">
            {summaryMetrics.customersCount}
          </div>
          <div className="text-[10px] text-[#8c7360] font-sans">
            Commercial client accounts
          </div>
        </div>

        {/* 3. Projects with Pending Payments */}
        <div className="bg-white p-4 rounded-xl border border-[#e8decb] shadow-2xs border-l-4 border-l-indigo-600 flex flex-col justify-between">
          <div className="text-[10px] text-[#7d6553] uppercase font-bold tracking-wider">
            Pending Projects
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-indigo-800 my-1">
            {summaryMetrics.projectsCount}
          </div>
          <div className="text-[10px] text-[#8c7360] font-sans">
            Active/inspected projects
          </div>
        </div>

        {/* 4. Total Unpaid Invoices */}
        <div className="bg-white p-4 rounded-xl border border-[#e8decb] shadow-2xs border-l-4 border-l-slate-600 flex flex-col justify-between">
          <div className="text-[10px] text-[#7d6553] uppercase font-bold tracking-wider">
            Unpaid Invoices
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-800 my-1">
            {summaryMetrics.unpaidInvoicesCount}
          </div>
          <div className="text-[10px] text-[#8c7360] font-sans">
            Zero collections received
          </div>
        </div>

        {/* 5. Total Partially Paid Invoices */}
        <div className="bg-white p-4 rounded-xl border border-[#e8decb] shadow-2xs border-l-4 border-l-amber-600 flex flex-col justify-between">
          <div className="text-[10px] text-[#7d6553] uppercase font-bold tracking-wider">
            Partially Paid
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-amber-800 my-1">
            {summaryMetrics.partiallyPaidInvoicesCount}
          </div>
          <div className="text-[10px] text-[#8c7360] font-sans">
            Partial payments recorded
          </div>
        </div>

        {/* 6. Total Overdue Amount */}
        <div className="bg-white p-4 rounded-xl border border-[#e8decb] shadow-2xs border-l-4 border-l-rose-600 flex flex-col justify-between">
          <div className="text-[10px] text-[#7d6553] uppercase font-bold tracking-wider">
            Overdue Amount
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-rose-700 my-1">
            {formatINR(summaryMetrics.overdueAmount, false)}
          </div>
          <div className="text-[10px] text-rose-800 font-sans font-semibold">
            Due date exceeded
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* FILTER & SEARCH BAR                                       */}
      {/* ========================================================= */}
      <div className="bg-white p-4 rounded-xl border border-[#e8decb] shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-[#ebdcc9] pb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#24160c] uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-[#8c5e39]" />
            <span>Filter Outstanding Receivables</span>
          </div>
          <button
            onClick={handleClearFilters}
            className="text-[11px] font-semibold text-[#8c5e39] hover:text-[#24160c] flex items-center gap-1 transition cursor-pointer"
          >
            <X className="w-3 h-3" />
            <span>Reset All Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* 1. Search Query */}
          <div className="relative">
            <label className="block text-[10px] font-bold text-[#7d6553] uppercase mb-1">Search Keywords</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#9c826e] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Customer, Invoice #, Project ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#faf6ee]/50 border border-[#d8c8b4] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#8c5e39] text-[#24160c] placeholder:text-[#9c826e]"
              />
            </div>
          </div>

          {/* 2. Customer Select */}
          <div>
            <label className="block text-[10px] font-bold text-[#7d6553] uppercase mb-1">Customer</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#d8c8b4] rounded-md text-[#24160c] focus:outline-hidden focus:ring-1 focus:ring-[#8c5e39]"
            >
              <option value="ALL">All Customers ({customers.length})</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName} ({c.customerCode})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Project Select */}
          <div>
            <label className="block text-[10px] font-bold text-[#7d6553] uppercase mb-1">Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#d8c8b4] rounded-md text-[#24160c] focus:outline-hidden focus:ring-1 focus:ring-[#8c5e39]"
            >
              <option value="ALL">All Projects ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectCode} — {p.siteName}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Payment Status */}
          <div>
            <label className="block text-[10px] font-bold text-[#7d6553] uppercase mb-1">Payment Status</label>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#d8c8b4] rounded-md font-semibold text-[#24160c] focus:outline-hidden focus:ring-1 focus:ring-[#8c5e39]"
            >
              <option value="PENDING">All Pending (Unpaid / Partial / Overdue)</option>
              <option value="OVERDUE">Overdue Invoices Only</option>
              <option value="UNPAID">Unpaid (Zero Payment)</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid / Fully Settled</option>
              <option value="ALL">All Invoices (Inc. Settled)</option>
            </select>
          </div>

          {/* 5. Date Range */}
          <div>
            <label className="block text-[10px] font-bold text-[#7d6553] uppercase mb-1">Due Date Range</label>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-2 py-1 bg-white border border-[#d8c8b4] rounded-md text-[11px] text-[#24160c]"
                title="From Due Date"
              />
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-2 py-1 bg-white border border-[#d8c8b4] rounded-md text-[11px] text-[#24160c]"
                title="To Due Date"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 3: PAYMENT DETAILS TABLE                          */}
      {/* ========================================================= */}
      <div className="bg-white rounded-xl border border-[#e8decb] shadow-2xs overflow-hidden">
        <div className="px-5 py-3 border-b border-[#ebdcc9] bg-[#fdfcf9] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-bold text-[#24160c] uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#8c5e39]" />
              <span>Receivables Ledger ({filteredInvoices.length} Invoices Found)</span>
            </h2>
            <p className="text-[11px] text-[#7d6553] mt-0.5">
              Outstanding Balance formula: <code className="bg-[#faf6ee] px-1.5 py-0.5 rounded border border-[#ebdcc9] text-[#24160c] font-mono">Total Billed − Total Received</code>
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-[#7d6553]">Showing Filtered Total:</span>
            <span className="font-mono font-bold text-[#24160c] bg-[#faf6ee] px-2.5 py-1 rounded border border-[#ebdcc9]">
              {formatINR(filteredInvoices.reduce((sum, i) => sum + i.outstandingAmount, 0))}
            </span>
          </div>
        </div>

        {/* Mobile View Cards */}
        <div className="block md:hidden divide-y divide-[#f2eadf]">
          {filteredInvoices.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#7d6553] space-y-2">
              <p className="font-semibold text-[#24160c]">No outstanding invoices match your criteria.</p>
              <button onClick={handleClearFilters} className="text-xs font-bold text-[#8c5e39] underline">
                Clear filters to view all records
              </button>
            </div>
          ) : (
            filteredInvoices.map((inv) => {
              const pStatus = getInvoicePaymentStatus(inv);
              const qtnNum = getInvoiceQuotationNumber(inv);
              const isOverdue = pStatus === 'OVERDUE';

              return (
                <div key={inv.id} className="p-4 space-y-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <button
                        type="button"
                        onClick={() => handleOpenCustomerDetail(inv.customerId)}
                        className="font-bold text-sm text-[#24160c] hover:text-[#8c5e39] text-left hover:underline flex items-center gap-1.5"
                      >
                        <Building2 className="w-3.5 h-3.5 text-[#8c5e39] shrink-0" />
                        <span>{inv.customerName}</span>
                      </button>
                      <div className="text-[11px] text-[#7d6553] mt-0.5 flex items-center gap-2">
                        <span className="font-mono">{inv.invoiceNumber}</span>
                        <span>•</span>
                        <span>Due: {formatDate(inv.dueDate)}</span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                      pStatus === 'PAID'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : pStatus === 'PARTIALLY_PAID'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : pStatus === 'OVERDUE'
                        ? 'bg-rose-50 text-rose-800 border border-rose-200'
                        : 'bg-slate-100 text-slate-800 border border-slate-300'
                    }`}>
                      {pStatus.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-[#fbf9f5] p-2.5 rounded-lg border border-[#ebdcc9] text-[11px]">
                    <div>
                      <span className="text-[#7d6553] block text-[10px] uppercase font-bold">Project ID</span>
                      <button
                        type="button"
                        onClick={() => inv.projectId && handleOpenProjectDetail(inv.projectId)}
                        className="font-mono font-bold text-[#8c5e39] hover:underline"
                      >
                        {inv.projectCode || 'N/A'}
                      </button>
                    </div>
                    <div>
                      <span className="text-[#7d6553] block text-[10px] uppercase font-bold">Quotation #</span>
                      <span className="font-mono font-semibold text-[#24160c]">{qtnNum}</span>
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="grid grid-cols-3 gap-2 text-center font-mono text-[11px] p-2 bg-[#faf6ee] rounded-md border border-[#ebdcc9]">
                    <div>
                      <span className="text-[#7d6553] font-sans block text-[10px]">Total Billed</span>
                      <span className="font-bold text-[#24160c]">{formatINR(inv.totalAmount)}</span>
                    </div>
                    <div>
                      <span className="text-[#7d6553] font-sans block text-[10px]">Amount Paid</span>
                      <span className="font-bold text-emerald-700">{formatINR(inv.paidAmount)}</span>
                    </div>
                    <div>
                      <span className="text-[#7d6553] font-sans block text-[10px]">Outstanding</span>
                      <span className="font-bold text-rose-700">{formatINR(inv.outstandingAmount)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenInvoiceDetail(inv)}
                      className="px-3 py-1 bg-white border border-[#d8c8b4] rounded text-[11px] font-semibold text-[#24160c] hover:bg-[#faf6ee]"
                    >
                      History
                    </button>
                    {inv.outstandingAmount > 0 && can('BILLING_RECORD_PAYMENT') && (
                      <button
                        type="button"
                        onClick={() => handleOpenRecordPayment(inv)}
                        className="px-3 py-1 bg-[#24160c] text-white rounded text-[11px] font-bold hover:bg-[#382315]"
                      >
                        Record Payment
                      </button>
                    )}
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
                <th className="px-4 py-3">Customer Name</th>
                <th className="px-4 py-3">Project ID</th>
                <th className="px-4 py-3">Quotation #</th>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3 text-right">Total Billed</th>
                <th className="px-4 py-3 text-right text-emerald-800">Amount Paid</th>
                <th className="px-4 py-3 text-right text-rose-800 font-bold bg-[#faf6ee]/70 border-x border-[#ebdcc9]">
                  Outstanding Due
                </th>
                <th className="px-4 py-3 text-center">Payment Due Date</th>
                <th className="px-4 py-3 text-center">Payment Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2eadf] font-mono">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-xs text-[#7d6553] font-sans">
                    <p className="font-semibold text-sm text-[#24160c]">No outstanding invoices match your criteria.</p>
                    <p className="text-[11px] text-[#8c7360] mt-1">All accounts within this filter are settled or no records exist.</p>
                    <div className="pt-3">
                      <button
                        onClick={handleClearFilters}
                        className="px-3.5 py-1.5 bg-[#24160c] text-white rounded text-xs font-semibold hover:bg-[#382315] cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const pStatus = getInvoicePaymentStatus(inv);
                  const qtnNum = getInvoiceQuotationNumber(inv);
                  const isOverdue = pStatus === 'OVERDUE';

                  return (
                    <tr key={inv.id} className="hover:bg-[#faf6ee]/50 transition">
                      {/* 1. Customer Name */}
                      <td className="px-4 py-3 font-sans">
                        <button
                          type="button"
                          onClick={() => handleOpenCustomerDetail(inv.customerId)}
                          className="font-bold text-[#24160c] hover:text-[#8c5e39] text-left hover:underline flex items-center gap-1.5 cursor-pointer"
                          title="Click to view Customer Payment History"
                        >
                          <Building2 className="w-3.5 h-3.5 text-[#8c5e39] shrink-0" />
                          <span className="truncate max-w-[180px]">{inv.customerName}</span>
                        </button>
                      </td>

                      {/* 2. Project ID */}
                      <td className="px-4 py-3 font-mono">
                        {inv.projectId ? (
                          <button
                            type="button"
                            onClick={() => handleOpenProjectDetail(inv.projectId!)}
                            className="font-bold text-[#8c5e39] hover:underline cursor-pointer flex items-center gap-1"
                            title="Click to view Project Payment Breakdown"
                          >
                            <span>{inv.projectCode || 'Project'}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </button>
                        ) : (
                          <span className="text-[#8c7360] text-[11px]">N/A</span>
                        )}
                      </td>

                      {/* 3. Quotation # */}
                      <td className="px-4 py-3 font-mono text-[11px] text-[#574830] font-semibold">
                        {qtnNum}
                      </td>

                      {/* 4. Invoice # */}
                      <td className="px-4 py-3 font-mono font-bold text-[#24160c]">
                        <Link
                          href={`/billing/${inv.id}/invoice-view`}
                          className="hover:text-[#8c5e39] hover:underline flex items-center gap-1"
                          title="View Tax Invoice Document"
                        >
                          <span>{inv.invoiceNumber}</span>
                          <Eye className="w-3 h-3 text-[#9c826e]" />
                        </Link>
                      </td>

                      {/* 5. Total Billed Amount */}
                      <td className="px-4 py-3 text-right font-bold text-[#24160c]">
                        {formatINR(inv.totalAmount)}
                      </td>

                      {/* 6. Amount Paid */}
                      <td className="px-4 py-3 text-right text-emerald-700 font-semibold">
                        {formatINR(inv.paidAmount)}
                      </td>

                      {/* 7. Outstanding Amount */}
                      <td className="px-4 py-3 text-right font-bold text-rose-700 bg-[#faf6ee]/70 border-x border-[#ebdcc9]">
                        {formatINR(inv.outstandingAmount)}
                      </td>

                      {/* 8. Due Date */}
                      <td className="px-4 py-3 text-center font-sans">
                        <div className="font-mono text-[11px] text-[#24160c] font-medium">
                          {formatDate(inv.dueDate)}
                        </div>
                        {isOverdue && (
                          <span className="text-[10px] text-rose-700 font-semibold block">
                            Overdue
                          </span>
                        )}
                      </td>

                      {/* 9. Payment Status Badge */}
                      <td className="px-4 py-3 text-center font-sans">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          pStatus === 'PAID'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                            : pStatus === 'PARTIALLY_PAID'
                            ? 'bg-amber-50 text-amber-800 border border-amber-300'
                            : pStatus === 'OVERDUE'
                            ? 'bg-rose-50 text-rose-800 border border-rose-300'
                            : 'bg-slate-100 text-slate-800 border border-slate-300'
                        }`}>
                          {pStatus === 'PAID' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {pStatus === 'OVERDUE' && <AlertCircle className="w-3 h-3 text-rose-600" />}
                          {pStatus === 'PARTIALLY_PAID' && <Clock className="w-3 h-3 text-amber-600" />}
                          <span>{pStatus.replace('_', ' ')}</span>
                        </span>
                      </td>

                      {/* 10. Actions */}
                      <td className="px-4 py-3 text-center font-sans">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenInvoiceDetail(inv)}
                            className="p-1 text-[#7d6553] hover:text-[#24160c] hover:bg-[#ebdcc9]/50 rounded transition cursor-pointer"
                            title="View Payment History & Ledger"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          {inv.outstandingAmount > 0 && can('BILLING_RECORD_PAYMENT') && (
                            <button
                              type="button"
                              onClick={() => handleOpenRecordPayment(inv)}
                              className="px-2.5 py-1 bg-[#24160c] hover:bg-[#382315] text-white rounded text-[10px] font-bold transition shadow-2xs cursor-pointer whitespace-nowrap"
                            >
                              Collect
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
      </div>

      {/* ========================================================= */}
      {/* SECTION 5: DETAILED CUSTOMER / PROJECT PAYMENT HISTORY    */}
      {/* ========================================================= */}
      {detailModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-2xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-[#d8c8b4] shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#ebdcc9] bg-[#fbf9f5] flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-[#8c5e39] uppercase tracking-wider">
                  {detailType === 'CUSTOMER' ? 'Customer Account Statement' : detailType === 'PROJECT' ? 'Project Commercial Account' : 'Invoice Statement'}
                </div>
                <h3 className="text-base font-bold text-[#24160c] mt-0.5 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#8c5e39]" />
                  <span>
                    {selectedCustomerForDetail?.companyName || selectedProjectForDetail?.customerName || selectedInvoiceForDetail?.customerName}
                  </span>
                  {selectedProjectForDetail && (
                    <span className="text-xs font-mono font-semibold bg-[#faf6ee] text-[#5c3e24] px-2 py-0.5 rounded border border-[#ebdcc9]">
                      {selectedProjectForDetail.projectCode}
                    </span>
                  )}
                </h3>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-1.5 text-[#9c826e] hover:text-[#24160c] rounded-lg hover:bg-[#ebdcc9]/50 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
              {/* Profile Snapshot */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {selectedCustomerForDetail && (
                  <div className="p-3 bg-[#fbf9f5] rounded-xl border border-[#ebdcc9]">
                    <div className="text-[10px] font-bold text-[#7d6553] uppercase">Customer Code & GSTIN</div>
                    <div className="font-mono font-bold text-[#24160c] mt-0.5">
                      {selectedCustomerForDetail.customerCode}
                    </div>
                    <div className="text-[11px] text-[#574830] font-mono mt-0.5">
                      GSTIN: {selectedCustomerForDetail.gstin || 'N/A'}
                    </div>
                  </div>
                )}

                {selectedProjectForDetail && (
                  <div className="p-3 bg-[#fbf9f5] rounded-xl border border-[#ebdcc9]">
                    <div className="text-[10px] font-bold text-[#7d6553] uppercase">Site & Quotation</div>
                    <div className="font-bold text-[#24160c] mt-0.5 truncate">
                      {selectedProjectForDetail.siteName}
                    </div>
                    <div className="text-[11px] text-[#574830] font-mono mt-0.5">
                      {selectedProjectForDetail.quotationNumber || 'No Quotation'}
                    </div>
                  </div>
                )}

                {/* Account Balances Summary */}
                {(() => {
                  const targetCustId = selectedCustomerForDetail?.id;
                  const targetProjId = selectedProjectForDetail?.id;

                  const relevantInvoices = invoices.filter(i => {
                    if (targetProjId) return i.projectId === targetProjId;
                    if (targetCustId) return i.customerId === targetCustId;
                    return false;
                  });

                  const relBilled = relevantInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
                  const relPaid = relevantInvoices.reduce((sum, i) => sum + i.paidAmount, 0);
                  const relDue = relevantInvoices.reduce((sum, i) => sum + i.outstandingAmount, 0);

                  return (
                    <div className="p-3 bg-[#faf6ee] rounded-xl border border-[#ebdcc9] space-y-1">
                      <div className="text-[10px] font-bold text-[#7d6553] uppercase">Account Net Due</div>
                      <div className="text-lg font-bold font-mono text-rose-700">
                        {formatINR(relDue)}
                      </div>
                      <div className="text-[10px] text-[#8c7360] font-mono flex items-center justify-between">
                        <span>Billed: {formatINR(relBilled, false)}</span>
                        <span>Paid: {formatINR(relPaid, false)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Sub-Section 1: Invoices Issued */}
              <div className="space-y-2">
                <h4 className="font-bold text-[#24160c] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#8c5e39]" />
                  <span>Billed Tax Invoices</span>
                </h4>

                {(() => {
                  const targetCustId = selectedCustomerForDetail?.id;
                  const targetProjId = selectedProjectForDetail?.id;

                  const relevantInvoices = invoices.filter(i => {
                    if (targetProjId) return i.projectId === targetProjId;
                    if (targetCustId) return i.customerId === targetCustId;
                    return false;
                  });

                  if (relevantInvoices.length === 0) {
                    return (
                      <div className="p-4 bg-[#fbf9f5] border border-[#ebdcc9] rounded-lg text-center text-[#8c7360] text-xs">
                        No invoices have been issued for this account yet.
                      </div>
                    );
                  }

                  return (
                    <div className="border border-[#ebdcc9] rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#fbf9f5] text-[#7d6553] uppercase text-[10px] font-semibold border-b border-[#ebdcc9]">
                          <tr>
                            <th className="p-2.5">Invoice #</th>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Due Date</th>
                            <th className="p-2.5 text-right">Total Billed</th>
                            <th className="p-2.5 text-right text-emerald-800">Paid</th>
                            <th className="p-2.5 text-right text-rose-800">Outstanding</th>
                            <th className="p-2.5 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#ebdcc9] font-mono text-[11px]">
                          {relevantInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-[#faf6ee]/50">
                              <td className="p-2.5 font-bold text-[#24160c]">
                                <Link href={`/billing/${inv.id}/invoice-view`} className="hover:underline text-[#8c5e39]">
                                  {inv.invoiceNumber}
                                </Link>
                              </td>
                              <td className="p-2.5 font-sans">{formatDate(inv.invoiceDate)}</td>
                              <td className="p-2.5 font-sans">{formatDate(inv.dueDate)}</td>
                              <td className="p-2.5 text-right font-bold text-[#24160c]">{formatINR(inv.totalAmount)}</td>
                              <td className="p-2.5 text-right text-emerald-700">{formatINR(inv.paidAmount)}</td>
                              <td className="p-2.5 text-right font-bold text-rose-700">{formatINR(inv.outstandingAmount)}</td>
                              <td className="p-2.5 text-center font-sans">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                  inv.outstandingAmount <= 0
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}>
                                  {inv.outstandingAmount <= 0 ? 'PAID' : 'PENDING'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* Sub-Section 2: Payment Receipts Recorded */}
              <div className="space-y-2">
                <h4 className="font-bold text-[#24160c] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Collections & Payment Receipts</span>
                </h4>

                {(() => {
                  const targetCustId = selectedCustomerForDetail?.id;
                  const targetProjId = selectedProjectForDetail?.id;

                  const relevantPayments = payments.filter(p => {
                    if (targetProjId) return p.projectId === targetProjId;
                    if (targetCustId) return p.customerId === targetCustId;
                    return false;
                  });

                  if (relevantPayments.length === 0) {
                    return (
                      <div className="p-4 bg-[#fbf9f5] border border-[#ebdcc9] rounded-lg text-center text-[#8c7360] text-xs">
                        No payments recorded for this account yet.
                      </div>
                    );
                  }

                  return (
                    <div className="border border-[#ebdcc9] rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#fbf9f5] text-[#7d6553] uppercase text-[10px] font-semibold border-b border-[#ebdcc9]">
                          <tr>
                            <th className="p-2.5">Receipt #</th>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Method</th>
                            <th className="p-2.5">Transaction Ref</th>
                            <th className="p-2.5">Bank</th>
                            <th className="p-2.5 text-right font-bold text-emerald-800">Amount Received</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#ebdcc9] font-mono text-[11px]">
                          {relevantPayments.map((pay) => (
                            <tr key={pay.id} className="hover:bg-[#faf6ee]/50">
                              <td className="p-2.5 font-bold text-[#24160c]">{pay.receiptNumber}</td>
                              <td className="p-2.5 font-sans">{formatDate(pay.paymentDate)}</td>
                              <td className="p-2.5 font-bold text-blue-800">{pay.paymentMethod}</td>
                              <td className="p-2.5 text-[#574830]">{pay.transactionReference || '-'}</td>
                              <td className="p-2.5 font-sans">{pay.bankName || 'HDFC Bank'}</td>
                              <td className="p-2.5 text-right font-bold text-emerald-700">{formatINR(pay.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#ebdcc9] bg-[#fbf9f5] flex items-center justify-end">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 bg-[#24160c] hover:bg-[#382315] text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* RECORD PAYMENT MODAL                                      */}
      {/* ========================================================= */}
      {paymentModalOpen && selectedInvoiceForPayment && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-2xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-[#d8c8b4] shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-[#ebdcc9] bg-[#fbf9f5] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#8c5e39] uppercase tracking-wider">Commercial Collection</span>
                <h3 className="text-base font-bold text-[#24160c] mt-0.5">
                  Record Payment Receipt
                </h3>
              </div>
              <button onClick={() => setPaymentModalOpen(false)} className="text-[#9c826e] hover:text-[#24160c] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-[#faf6ee] rounded-lg border border-[#ebdcc9] space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#7d6553]">Invoice:</span>
                  <span className="font-mono font-bold text-[#24160c]">{selectedInvoiceForPayment.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#7d6553]">Customer:</span>
                  <span className="font-semibold text-[#24160c]">{selectedInvoiceForPayment.customerName}</span>
                </div>
                <div className="flex justify-between text-rose-700 font-bold border-t border-[#ebdcc9] pt-1 mt-1">
                  <span>Balance Due:</span>
                  <span className="font-mono">{formatINR(selectedInvoiceForPayment.outstandingAmount)}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#7d6553] uppercase mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  min="1"
                  max={selectedInvoiceForPayment.outstandingAmount}
                  step="any"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  required
                  className="w-full p-2.5 bg-white border border-[#d8c8b4] rounded-lg font-mono font-bold text-sm text-[#24160c] focus:outline-hidden focus:border-[#8c5e39]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#7d6553] uppercase mb-1">Payment Method</label>
                  <select
                    value={payMethod}
                    onChange={(e: any) => setPayMethod(e.target.value)}
                    className="w-full p-2 bg-white border border-[#d8c8b4] rounded-lg text-[#24160c] font-semibold"
                  >
                    <option value="NEFT">NEFT Transfer</option>
                    <option value="RTGS">RTGS Transfer</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="CHEQUE">Bank Cheque</option>
                    <option value="CASH">Cash Deposit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#7d6553] uppercase mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    required
                    className="w-full p-2 bg-white border border-[#d8c8b4] rounded-lg font-mono text-[#24160c]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#7d6553] uppercase mb-1">UTR / Transaction Reference</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. UTR-982348274 or Cheque #"
                  className="w-full p-2 bg-white border border-[#d8c8b4] rounded-lg font-mono text-[#24160c]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#7d6553] uppercase mb-1">Bank Name</label>
                <input
                  type="text"
                  value={payBank}
                  onChange={(e) => setPayBank(e.target.value)}
                  placeholder="e.g. HDFC Bank, SBI..."
                  className="w-full p-2 bg-white border border-[#d8c8b4] rounded-lg text-[#24160c]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#ebdcc9]">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-4 py-2 border border-[#d8c8b4] rounded-lg font-semibold text-[#7d6553] hover:bg-[#faf6ee] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-4 py-2 bg-[#24160c] hover:bg-[#382315] text-white font-bold rounded-lg transition shadow-2xs cursor-pointer"
                >
                  {submittingPayment ? 'Recording...' : 'Save Payment Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ISSUE TAX INVOICE MODAL                                   */}
      {/* ========================================================= */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-2xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#d8c8b4] shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-[#ebdcc9] bg-[#fbf9f5] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#8c5e39] uppercase tracking-wider">Commercial Billing</span>
                <h3 className="text-base font-bold text-[#24160c] mt-0.5">
                  Issue Tax Invoice
                </h3>
              </div>
              <button onClick={() => setInvoiceModalOpen(false)} className="text-[#9c826e] hover:text-[#24160c] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewInvoice} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-[#7d6553] uppercase mb-1">Customer Account *</label>
                <select
                  value={invCustomerId}
                  onChange={(e) => setInvCustomerId(e.target.value)}
                  required
                  className="w-full p-2 bg-white border border-[#d8c8b4] rounded-lg text-[#24160c] font-semibold"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.companyName} ({c.customerCode})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#7d6553] uppercase mb-1">Project (Optional)</label>
                <select
                  value={invProjectId}
                  onChange={(e) => setInvProjectId(e.target.value)}
                  className="w-full p-2 bg-white border border-[#d8c8b4] rounded-lg text-[#24160c]"
                >
                  <option value="">-- No Specific Project (General Bill) --</option>
                  {projects
                    .filter(p => !invCustomerId || p.customerId === invCustomerId)
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.projectCode} — {p.siteName}</option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#7d6553] uppercase mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={invDate}
                    onChange={(e) => setInvDate(e.target.value)}
                    required
                    className="w-full p-2 bg-white border border-[#d8c8b4] rounded-lg font-mono text-[#24160c]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#7d6553] uppercase mb-1">Due Date</label>
                  <input
                    type="date"
                    value={invDueDate}
                    onChange={(e) => setInvDueDate(e.target.value)}
                    required
                    className="w-full p-2 bg-white border border-[#d8c8b4] rounded-lg font-mono text-[#24160c]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#7d6553] uppercase mb-1">Description / Billing Line</label>
                <input
                  type="text"
                  value={invDescription}
                  onChange={(e) => setInvDescription(e.target.value)}
                  required
                  className="w-full p-2 bg-white border border-[#d8c8b4] rounded-lg text-[#24160c]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#7d6553] uppercase mb-1">Taxable Amount (₹ excl. GST) *</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={invRate || ''}
                  onChange={(e) => setInvRate(Number(e.target.value))}
                  required
                  placeholder="e.g. 25000"
                  className="w-full p-2.5 bg-white border border-[#d8c8b4] rounded-lg font-mono font-bold text-sm text-[#24160c]"
                />
                <span className="text-[10px] text-[#8c7360] mt-0.5 block">
                  18% GST (CGST 9% + SGST 9%) will be calculated automatically.
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#ebdcc9]">
                <button
                  type="button"
                  onClick={() => setInvoiceModalOpen(false)}
                  className="px-4 py-2 border border-[#d8c8b4] rounded-lg font-semibold text-[#7d6553] hover:bg-[#faf6ee] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingInvoice}
                  className="px-4 py-2 bg-[#24160c] hover:bg-[#382315] text-white font-bold rounded-lg transition shadow-2xs cursor-pointer"
                >
                  {submittingInvoice ? 'Generating...' : 'Issue Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

