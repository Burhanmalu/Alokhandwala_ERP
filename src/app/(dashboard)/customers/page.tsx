'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  MapPin, 
  ChevronRight, 
  FolderKanban,
  ReceiptIndianRupee,
  Users,
  Briefcase,
  Layers,
  X,
  CreditCard,
  LayoutGrid,
  Table as TableIcon,
  Download,
  ShieldCheck,
  ExternalLink,
  Info,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ArrowUpDown,
  FileSpreadsheet,
  BadgeCheck,
  Eye,
  FileText
} from 'lucide-react';
import { Customer } from '@/lib/schema';
import { formatINR, formatDate } from '@/lib/formatters';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

type ViewMode = 'grid' | 'table';
type FilterTab = 'ALL' | 'ACTIVE_RENTALS' | 'OUTSTANDING' | 'GST';
type SortField = 'NAME_ASC' | 'NAME_DESC' | 'OUTSTANDING_DESC' | 'PROJECTS_DESC' | 'RECENT';

export default function CustomersPage() {
  const router = useRouter();
  const { can, currentUser } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterTab, setFilterTab] = useState<FilterTab>('ALL');
  const [sortBy, setSortBy] = useState<SortField>('NAME_ASC');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Quick Register Form State
  const [companyName, setCompanyName] = useState('');
  const [referenceName, setReferenceName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [city, setCity] = useState('Mumbai');
  const [state, setState] = useState('Maharashtra');
  const [gstin, setGstin] = useState('');
  const [creditLimit, setCreditLimit] = useState<number>(500000);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const json = await res.json();
      if (json.success) setCustomers(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!companyName.trim() || !contactPerson.trim() || !phone.trim() || !email.trim() || !billingAddress.trim()) {
      setFormError('Please fill in all mandatory fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          referenceName: referenceName.trim() || undefined,
          contactPerson: contactPerson.trim(),
          phone: phone.trim(),
          email: email.trim(),
          billingAddress: billingAddress.trim(),
          city: city.trim() || 'Mumbai',
          state: state.trim() || 'Maharashtra',
          gstin: gstin.trim().toUpperCase() || undefined,
          creditLimit: Number(creditLimit) || 500000,
          actorId: currentUser?.id,
          actorName: currentUser?.fullName,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCustomers([json.data, ...customers]);
        setModalOpen(false);
        // Reset form
        setCompanyName('');
        setReferenceName('');
        setContactPerson('');
        setPhone('');
        setEmail('');
        setBillingAddress('');
        setGstin('');
        setCreditLimit(500000);
      } else {
        setFormError(json.error || 'Failed to create customer');
      }
    } catch (e: any) {
      setFormError(e.message || 'An error occurred during customer registration');
    } finally {
      setIsSubmitting(false);
    }
  };

  // KPI Calculations
  const totalOutstanding = useMemo(() => {
    return customers.reduce((acc, c) => acc + (c.outstandingBalance || 0), 0);
  }, [customers]);

  const totalActiveRentals = useMemo(() => {
    return customers.reduce((acc, c) => acc + (c.activeRentalsCount || 0), 0);
  }, [customers]);

  const totalCreditLimit = useMemo(() => {
    return customers.reduce((acc, c) => acc + (c.creditLimit || 0), 0);
  }, [customers]);

  // Filtering and Sorting
  const filteredCustomers = useMemo(() => {
    let result = [...customers];

    // Filter Tab
    if (filterTab === 'ACTIVE_RENTALS') {
      result = result.filter(c => (c.activeRentalsCount || 0) > 0);
    } else if (filterTab === 'OUTSTANDING') {
      result = result.filter(c => (c.outstandingBalance || 0) > 0);
    } else if (filterTab === 'GST') {
      result = result.filter(c => !!c.gstin && c.gstin.trim().length > 0);
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(c => 
        (c.customerCode && c.customerCode.toLowerCase().includes(q)) ||
        (c.companyName && c.companyName.toLowerCase().includes(q)) ||
        (c.referenceName && c.referenceName.toLowerCase().includes(q)) ||
        (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.gstin && c.gstin.toLowerCase().includes(q))
      );
    }

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'NAME_ASC':
          return a.companyName.localeCompare(b.companyName);
        case 'NAME_DESC':
          return b.companyName.localeCompare(a.companyName);
        case 'OUTSTANDING_DESC':
          return (b.outstandingBalance || 0) - (a.outstandingBalance || 0);
        case 'PROJECTS_DESC':
          return (b.projectsCount || 0) - (a.projectsCount || 0);
        case 'RECENT':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [customers, filterTab, searchQuery, sortBy]);

  // Export CSV function
  const exportToCSV = () => {
    const headers = [
      'Customer Code',
      'Company Name',
      'Reference Name',
      'Contact Person',
      'Phone',
      'Email',
      'GSTIN',
      'City',
      'State',
      'Sites Count',
      'Projects Count',
      'Active Rentals',
      'Outstanding Balance (INR)',
      'Credit Limit (INR)',
      'Status'
    ];

    const rows = filteredCustomers.map(c => [
      c.customerCode,
      `"${c.companyName.replace(/"/g, '""')}"`,
      `"${(c.referenceName || '').replace(/"/g, '""')}"`,
      `"${c.contactPerson.replace(/"/g, '""')}"`,
      `"${c.phone}"`,
      `"${c.email || ''}"`,
      `"${c.gstin || ''}"`,
      `"${c.city || ''}"`,
      `"${c.state || ''}"`,
      c.sitesCount || 0,
      c.projectsCount || 0,
      c.activeRentalsCount || 0,
      c.outstandingBalance || 0,
      c.creditLimit || 0,
      c.status || 'ACTIVE'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `alokhandwala_customers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Improved Initials generator that filters out symbols like '&'
  const getCompanyInitials = (name: string) => {
    if (!name) return 'CU';
    const words = name.trim().split(/\s+/).filter(w => /^[a-zA-Z0-9]/.test(w));
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Helper to format currency cleanly without unnecessary .00
  const formatCompactINR = (amount: number) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`;
    }
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2).replace(/\.00$/, '')} L`;
    }
    return formatINR(amount).replace(/\.00$/, '');
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#e5dac8]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#9c826e]">
            <span>Commercial Directory</span>
          </div>
          <h1 className="text-xl font-bold text-[#24160c] mt-0.5 tracking-tight">
            Customers
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            onClick={exportToCSV}
            title="Download CSV Spreadsheet"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#4d301c] bg-white border border-[#d8c8b4] rounded-md hover:bg-[#faf6ee] transition shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-[#8c5e39]" />
            <span>Export CSV</span>
          </button>
          <Link
            href="/customers/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#4d301c] bg-white border border-[#d8c8b4] rounded-md hover:bg-[#faf6ee] transition shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#8c5e39]" />
            <span>Full Form</span>
          </Link>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#24150c] hover:bg-[#382315] border border-[#4d301c] rounded-md shadow-2xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#c79e7c]" />
            <span>+ Quick Register</span>
          </button>
        </div>
      </div>

      {/* 2. REFINED KPI METRICS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-[#e8decb] rounded-lg p-3.5 shadow-2xs hover:border-[#c79e7c] transition-colors">
          <div className="flex items-center justify-between text-xs text-[#7d6553] mb-1">
            <span className="font-medium text-[11px] uppercase tracking-wider">Total Accounts</span>
            <div className="w-6 h-6 rounded-md bg-[#faf6ee] border border-[#ebdcc9] flex items-center justify-center text-[#8c5e39]">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold font-mono text-[#24160c] mt-0.5">{customers.length}</div>
          <div className="text-[11px] text-[#9c826e] mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            <span>Registered enterprise partners</span>
          </div>
        </div>

        <div className="bg-white border border-[#e8decb] rounded-lg p-3.5 shadow-2xs hover:border-[#c79e7c] transition-colors">
          <div className="flex items-center justify-between text-xs text-[#7d6553] mb-1">
            <span className="font-medium text-[11px] uppercase tracking-wider">Active Site Rentals</span>
            <div className="w-6 h-6 rounded-md bg-[#faf6ee] border border-[#ebdcc9] flex items-center justify-center text-[#8c5e39]">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold font-mono text-[#24160c] mt-0.5">{totalActiveRentals}</div>
          <div className="text-[11px] text-[#9c826e] mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            <span>Projects deployed on site</span>
          </div>
        </div>

        <div className="bg-white border border-[#e8decb] rounded-lg p-3.5 shadow-2xs hover:border-[#c79e7c] transition-colors">
          <div className="flex items-center justify-between text-xs text-[#7d6553] mb-1">
            <span className="font-medium text-[11px] uppercase tracking-wider">Total Receivables</span>
            <div className="w-6 h-6 rounded-md bg-[#faf6ee] border border-[#ebdcc9] flex items-center justify-center text-[#8c5e39]">
              <ReceiptIndianRupee className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`text-xl font-bold font-mono mt-0.5 ${totalOutstanding > 0 ? 'text-amber-800' : 'text-[#24160c]'}`}>
            {formatINR(totalOutstanding).replace(/\.00$/, '')}
          </div>
          <div className="text-[11px] text-[#9c826e] mt-1 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${totalOutstanding > 0 ? 'bg-amber-600' : 'bg-emerald-600'}`}></span>
            <span>{totalOutstanding > 0 ? 'Pending ledger dues' : 'All accounts fully settled'}</span>
          </div>
        </div>

        <div className="bg-white border border-[#e8decb] rounded-lg p-3.5 shadow-2xs hover:border-[#c79e7c] transition-colors">
          <div className="flex items-center justify-between text-xs text-[#7d6553] mb-1">
            <span className="font-medium text-[11px] uppercase tracking-wider">Credit Approved</span>
            <div className="w-6 h-6 rounded-md bg-[#faf6ee] border border-[#ebdcc9] flex items-center justify-center text-[#8c5e39]">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold font-mono text-[#5c3e24] mt-0.5">
            {formatCompactINR(totalCreditLimit)}
          </div>
          <div className="text-[11px] text-[#9c826e] mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8c5e39]"></span>
            <span>Total fleet credit limit</span>
          </div>
        </div>
      </div>

      {/* 3. UNIFIED SEARCH, FILTER TABS & TOOLBAR */}
      <div className="bg-white p-3 rounded-lg border border-[#e8decb] shadow-2xs space-y-2.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#9c826e] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by company name, client code (e.g. CUST-0001), contact person, phone, or GSTIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#faf6ee]/50 border border-[#d8c8b4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#8c5e39] text-[#24160c] placeholder:text-[#9c826e]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9c826e] hover:text-[#24160c] p-0.5"
                title="Clear search query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right Toolbar Controls */}
          <div className="flex items-center gap-2 self-end md:self-auto shrink-0 text-xs">
            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 bg-[#faf6ee] border border-[#d8c8b4] rounded-md px-2 py-1 text-[#4d301c]">
              <ArrowUpDown className="w-3 h-3 text-[#8c5e39]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                className="bg-transparent border-none text-xs text-[#24160c] font-medium focus:outline-none cursor-pointer"
              >
                <option value="NAME_ASC">Company Name (A–Z)</option>
                <option value="NAME_DESC">Company Name (Z–A)</option>
                <option value="OUTSTANDING_DESC">Highest Outstanding</option>
                <option value="PROJECTS_DESC">Most Projects</option>
                <option value="RECENT">Recently Registered</option>
              </select>
            </div>

            {/* View Switcher */}
            <div className="flex items-center border border-[#d8c8b4] rounded-md p-0.5 bg-[#faf6ee]">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded transition ${viewMode === 'grid' ? 'bg-white text-[#24160c] shadow-2xs font-semibold' : 'text-[#9c826e] hover:text-[#24160c]'}`}
                title="Card Grid View"
                aria-label="Card Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1 rounded transition ${viewMode === 'table' ? 'bg-white text-[#24160c] shadow-2xs font-semibold' : 'text-[#9c826e] hover:text-[#24160c]'}`}
                title="Table View"
                aria-label="Table View"
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Pills Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#f2eadf] text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[#9c826e] text-[10px] font-semibold uppercase tracking-wider mr-1">Filter:</span>
            <button
              onClick={() => setFilterTab('ALL')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                filterTab === 'ALL'
                  ? 'bg-[#24150c] text-white'
                  : 'bg-[#faf6ee] text-[#59371d] hover:bg-[#ebdcc9] border border-[#ebdcc9]'
              }`}
            >
              All Accounts ({customers.length})
            </button>
            <button
              onClick={() => setFilterTab('ACTIVE_RENTALS')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition flex items-center gap-1 ${
                filterTab === 'ACTIVE_RENTALS'
                  ? 'bg-[#24150c] text-white'
                  : 'bg-[#faf6ee] text-[#59371d] hover:bg-[#ebdcc9] border border-[#ebdcc9]'
              }`}
            >
              <span>Active Rentals</span>
              <span className={`px-1 rounded text-[10px] ${filterTab === 'ACTIVE_RENTALS' ? 'bg-white/20' : 'bg-[#ebdcc9]'}`}>
                {customers.filter(c => (c.activeRentalsCount || 0) > 0).length}
              </span>
            </button>
            <button
              onClick={() => setFilterTab('OUTSTANDING')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition flex items-center gap-1 ${
                filterTab === 'OUTSTANDING'
                  ? 'bg-[#24150c] text-white'
                  : 'bg-[#faf6ee] text-[#59371d] hover:bg-[#ebdcc9] border border-[#ebdcc9]'
              }`}
            >
              <span>Outstanding Dues</span>
              <span className={`px-1 rounded text-[10px] ${filterTab === 'OUTSTANDING' ? 'bg-white/20' : 'bg-[#ebdcc9]'}`}>
                {customers.filter(c => (c.outstandingBalance || 0) > 0).length}
              </span>
            </button>
            <button
              onClick={() => setFilterTab('GST')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition flex items-center gap-1 ${
                filterTab === 'GST'
                  ? 'bg-[#24150c] text-white'
                  : 'bg-[#faf6ee] text-[#59371d] hover:bg-[#ebdcc9] border border-[#ebdcc9]'
              }`}
            >
              <span>GST Registered</span>
              <span className={`px-1 rounded text-[10px] ${filterTab === 'GST' ? 'bg-white/20' : 'bg-[#ebdcc9]'}`}>
                {customers.filter(c => !!c.gstin && c.gstin.trim().length > 0).length}
              </span>
            </button>
          </div>

          <div className="text-[11px] text-[#7d6553] font-medium">
            Showing <span className="font-bold text-[#24160c] font-mono">{filteredCustomers.length}</span> of {customers.length} accounts
          </div>
        </div>
      </div>

      {/* 4. MAIN CONTENT DISPLAY: CARD GRID OR TABLE */}
      {loading ? (
        <div className="py-20 text-center bg-white border border-[#e8decb] rounded-lg shadow-2xs space-y-3">
          <div className="w-7 h-7 border-2 border-[#8c5e39] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-xs font-medium text-[#7d6553]">Loading master accounts directory...</div>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="py-16 text-center bg-white border border-[#e8decb] rounded-lg shadow-2xs space-y-2.5 p-6">
          <Building2 className="w-8 h-8 text-[#9c826e] mx-auto opacity-60" />
          <h3 className="text-sm font-bold text-[#24160c]">No Matching Accounts Found</h3>
          <p className="text-xs text-[#7d6553] max-w-md mx-auto">
            {searchQuery 
              ? `No corporate records matched "${searchQuery}". Please check your spelling or clear active filters.`
              : 'No corporate accounts match the selected category filter.'}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-3 py-1 text-xs font-semibold text-[#8c5e39] hover:underline"
            >
              Reset Search Filter
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* REFINED CARD GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCustomers.map((c) => {
            const hasOutstanding = (c.outstandingBalance || 0) > 0;
            const hasRentals = (c.activeRentalsCount || 0) > 0;
            const initials = getCompanyInitials(c.companyName);

            return (
              <div
                key={c.id}
                className="bg-white rounded-lg border border-[#e8decb] hover:border-[#c79e7c] transition-all flex flex-col justify-between shadow-2xs hover:shadow-xs group"
              >
                {/* Card Top Section */}
                <div className="p-4 space-y-3">
                  {/* Avatar, Customer Code, Status Badge */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-md bg-[#24150c] text-[#fdf8f4] flex items-center justify-center font-bold text-xs tracking-wider border border-[#4d301c] shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] font-bold text-[#59371d] bg-[#faf6ee] border border-[#ebdcc9] px-1.5 py-0.2 rounded">
                            {c.customerCode}
                          </span>
                          {c.gstin && (
                            <span className="font-mono text-[9px] text-[#7d6553] bg-[#fbf9f5] px-1 py-0.2 rounded border border-[#e8decb]" title={`GSTIN: ${c.gstin}`}>
                              GST
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-sm text-[#24160c] mt-0.5 leading-snug truncate group-hover:text-[#8c5e39] transition-colors" title={c.companyName}>
                          {c.companyName}
                        </h3>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#faf6ee] text-[#59371d] border border-[#ebdcc9] shrink-0">
                      {c.status || 'ACTIVE'}
                    </span>
                  </div>

                  {/* Reference / Division subtitle (fixed height so cards align evenly) */}
                  <div className="text-[11px] text-[#7d6553] flex items-center gap-1.5 h-4 overflow-hidden">
                    {c.referenceName ? (
                      <>
                        <span className="text-[#9c826e] font-medium">Ref:</span>
                        <span className="font-medium text-[#4d301c] truncate">{c.referenceName}</span>
                      </>
                    ) : (
                      <span className="text-[#9c826e] italic">Registered Commercial Account</span>
                    )}
                  </div>

                  {/* Contact Information List */}
                  <div className="space-y-1.5 text-xs text-[#574830] pt-2.5 border-t border-[#f2eadf]">
                    <div className="flex items-center gap-2 text-[#24160c]">
                      <Users className="w-3.5 h-3.5 text-[#8c5e39] shrink-0" />
                      <span className="font-medium truncate">{c.contactPerson}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-[#9c826e] shrink-0" />
                      <a 
                        href={`tel:${c.phone}`} 
                        className="truncate font-mono text-xs hover:text-[#8c5e39] hover:underline"
                        title="Click to dial"
                      >
                        {c.phone}
                      </a>
                    </div>

                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-[#9c826e] shrink-0" />
                      {c.email ? (
                        <a 
                          href={`mailto:${c.email}`} 
                          className="truncate hover:text-[#8c5e39] hover:underline"
                          title="Click to compose email"
                        >
                          {c.email}
                        </a>
                      ) : (
                        <span className="text-[#9c826e] italic">No email on record</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#9c826e] shrink-0" />
                      <span className="truncate">{c.city || 'Mumbai'}, {c.state || 'Maharashtra'}</span>
                    </div>
                  </div>
                </div>

                {/* Card Activity & Financial Footer */}
                <div className="bg-[#faf6ee]/50 border-t border-[#ebdcc9] p-3 space-y-2.5">
                  {/* Clean 3-Column Metrics Ribbon */}
                  <div className="grid grid-cols-3 divide-x divide-[#ebdcc9] bg-white border border-[#ebdcc9] rounded-md py-1.5 text-center font-mono text-xs">
                    <div>
                      <span className="text-[#7d6553] font-sans block text-[10px]">Sites</span>
                      <span className="font-bold text-[#24160c]">{c.sitesCount || 0}</span>
                    </div>
                    <div>
                      <span className="text-[#7d6553] font-sans block text-[10px]">Projects</span>
                      <span className="font-bold text-[#24160c]">{c.projectsCount || 0}</span>
                    </div>
                    <div>
                      <span className="text-[#7d6553] font-sans block text-[10px]">Rentals</span>
                      <span className={`font-bold ${hasRentals ? 'text-[#8c5e39]' : 'text-[#7d6553]'}`}>
                        {c.activeRentalsCount || 0}
                      </span>
                    </div>
                  </div>

                  {/* Financial & Action Buttons */}
                  <div className="flex items-center justify-between pt-0.5">
                    <div>
                      <div className="text-[10px] text-[#7d6553] uppercase tracking-wider font-mono font-semibold">
                        Outstanding Dues
                      </div>
                      <div className={`font-mono font-bold text-xs ${hasOutstanding ? 'text-amber-800' : 'text-[#24160c]'}`}>
                        {formatINR(c.outstandingBalance || 0).replace(/\.00$/, '')}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedCustomer(c)}
                        className="px-2.5 py-1 text-xs font-semibold text-[#4d301c] bg-white hover:bg-[#faf6ee] border border-[#d8c8b4] rounded-md transition shadow-2xs cursor-pointer"
                        title="View Detailed Account Dossier"
                      >
                        Details
                      </button>
                      <Link
                        href={`/projects?customerId=${c.id}`}
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-[#24150c] hover:bg-[#382315] border border-[#4d301c] rounded-md transition flex items-center gap-1 shadow-2xs"
                      >
                        <span>Projects</span>
                        <ChevronRight className="w-3 h-3 text-[#c79e7c]" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ENTERPRISE TABLE VIEW */
        <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#fbf9f5] text-[#7d6553] uppercase tracking-wider text-[10px] font-semibold border-b border-[#ebdcc9]">
                <tr>
                  <th className="px-4 py-2.5">Code</th>
                  <th className="px-4 py-2.5">Company & Division</th>
                  <th className="px-4 py-2.5">Contact Person</th>
                  <th className="px-4 py-2.5">Phone & Email</th>
                  <th className="px-4 py-2.5">Location & GST</th>
                  <th className="px-4 py-2.5 text-center">Engagements</th>
                  <th className="px-4 py-2.5 text-right">Outstanding</th>
                  <th className="px-4 py-2.5 text-right">Credit Limit</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                  <th className="px-4 py-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2eadf]">
                {filteredCustomers.map((c) => {
                  const hasOutstanding = (c.outstandingBalance || 0) > 0;
                  const initials = getCompanyInitials(c.companyName);

                  return (
                    <tr key={c.id} className="hover:bg-[#faf6ee]/60 transition-colors">
                      <td className="px-4 py-2.5 font-mono font-bold text-[#59371d] whitespace-nowrap">
                        <span className="bg-[#faf6ee] border border-[#ebdcc9] px-1.5 py-0.5 rounded text-[11px]">
                          {c.customerCode}
                        </span>
                      </td>

                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-[#24150c] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div 
                              className="font-bold text-[#24160c] hover:text-[#8c5e39] cursor-pointer" 
                              onClick={() => setSelectedCustomer(c)}
                            >
                              {c.companyName}
                            </div>
                            {c.referenceName && (
                              <div className="text-[10px] text-[#7d6553]">{c.referenceName}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-2.5 text-[#24160c] font-medium">
                        {c.contactPerson}
                      </td>

                      <td className="px-4 py-2.5">
                        <div className="font-mono text-[11px] text-[#4d301c]">
                          <a href={`tel:${c.phone}`} className="hover:text-[#8c5e39] hover:underline">{c.phone}</a>
                        </div>
                        <div className="text-[10px] text-[#7d6553] truncate max-w-[160px]">
                          {c.email || '—'}
                        </div>
                      </td>

                      <td className="px-4 py-2.5">
                        <div className="text-[#24160c]">{c.city || 'Mumbai'}, {c.state || 'Maharashtra'}</div>
                        {c.gstin ? (
                          <div className="font-mono text-[10px] text-[#59371d] font-semibold">{c.gstin}</div>
                        ) : (
                          <div className="text-[10px] text-[#9c826e] italic">No GSTIN</div>
                        )}
                      </td>

                      <td className="px-4 py-2.5 text-center font-mono">
                        <div className="inline-flex items-center gap-1.5 bg-[#faf6ee] border border-[#ebdcc9] px-2 py-0.5 rounded text-[11px]">
                          <span title="Sites">{c.sitesCount || 0}S</span>
                          <span className="text-[#d8c8b4]">/</span>
                          <span title="Projects">{c.projectsCount || 0}P</span>
                          <span className="text-[#d8c8b4]">/</span>
                          <span className="font-bold text-[#8c5e39]" title="Active Rentals">{c.activeRentalsCount || 0}R</span>
                        </div>
                      </td>

                      <td className={`px-4 py-2.5 text-right font-mono font-bold ${hasOutstanding ? 'text-amber-800' : 'text-[#24160c]'}`}>
                        {formatINR(c.outstandingBalance || 0).replace(/\.00$/, '')}
                      </td>

                      <td className="px-4 py-2.5 text-right font-mono text-[#574830]">
                        {formatCompactINR(c.creditLimit || 0)}
                      </td>

                      <td className="px-4 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#faf6ee] text-[#59371d] border border-[#ebdcc9]">
                          {c.status || 'ACTIVE'}
                        </span>
                      </td>

                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedCustomer(c)}
                            className="px-2 py-1 text-[11px] font-medium text-[#4d301c] bg-white hover:bg-[#faf6ee] border border-[#d8c8b4] rounded shadow-2xs transition cursor-pointer"
                            title="View Dossier"
                          >
                            Details
                          </button>
                          <Link
                            href={`/projects?customerId=${c.id}`}
                            className="px-2 py-1 text-[11px] font-medium text-white bg-[#24150c] hover:bg-[#382315] border border-[#4d301c] rounded shadow-2xs transition flex items-center gap-0.5"
                            title="View Projects"
                          >
                            <span>Projects</span>
                            <ChevronRight className="w-3 h-3 text-[#c79e7c]" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. CUSTOMER PROFILE DOSSIER MODAL */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#140b06]/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="fixed inset-0" 
            onClick={() => setSelectedCustomer(null)} 
          />
          <div className="relative z-10 bg-white rounded-lg max-w-2xl w-full p-5 shadow-2xl border border-[#d6c7b2] space-y-4 max-h-[90vh] overflow-y-auto main-scrollbar">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#f0e8db] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-[#24150c] text-white flex items-center justify-center font-bold text-xs tracking-wider border border-[#4d301c]">
                  {getCompanyInitials(selectedCustomer.companyName)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-[#59371d] bg-[#faf6ee] border border-[#ebdcc9] px-1.5 py-0.2 rounded">
                      {selectedCustomer.customerCode}
                    </span>
                    <span className="px-2 py-0.2 rounded text-[10px] font-semibold bg-[#faf6ee] text-[#59371d] border border-[#ebdcc9]">
                      {selectedCustomer.status || 'ACTIVE'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#24160c] mt-0.5">{selectedCustomer.companyName}</h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-[#9c826e] hover:text-[#24160c] p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dossier Body */}
            <div className="space-y-3.5 text-xs">
              {/* Financial Snapshot Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#faf6ee] p-3 rounded-md border border-[#ebdcc9] text-center font-mono">
                <div>
                  <div className="text-[10px] text-[#7d6553] font-sans">Outstanding Balance</div>
                  <div className={`font-bold text-sm mt-0.5 ${(selectedCustomer.outstandingBalance || 0) > 0 ? 'text-amber-800' : 'text-[#24160c]'}`}>
                    {formatINR(selectedCustomer.outstandingBalance || 0)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#7d6553] font-sans">Credit Limit</div>
                  <div className="font-bold text-sm text-[#24160c] mt-0.5">{formatINR(selectedCustomer.creditLimit || 0)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#7d6553] font-sans">Active Site Rentals</div>
                  <div className="font-bold text-sm text-[#8c5e39] mt-0.5">{selectedCustomer.activeRentalsCount || 0}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#7d6553] font-sans">Total Projects</div>
                  <div className="font-bold text-sm text-[#24160c] mt-0.5">{selectedCustomer.projectsCount || 0}</div>
                </div>
              </div>

              {/* Two Column Profile Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Column 1: Primary Contact */}
                <div className="p-3 bg-white border border-[#ebdcc9] rounded-md space-y-2">
                  <div className="text-[11px] font-bold text-[#59371d] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#f2eadf] pb-1.5">
                    <Users className="w-3.5 h-3.5 text-[#8c5e39]" />
                    <span>Primary Contact Profile</span>
                  </div>
                  <div className="space-y-1.5 text-[#574830]">
                    <div>
                      <span className="text-[#9c826e] block text-[10px]">Contact Person:</span>
                      <span className="font-semibold text-[#24160c]">{selectedCustomer.contactPerson}</span>
                    </div>
                    <div>
                      <span className="text-[#9c826e] block text-[10px]">Direct Phone:</span>
                      <a href={`tel:${selectedCustomer.phone}`} className="font-mono text-[#8c5e39] hover:underline font-semibold">
                        {selectedCustomer.phone}
                      </a>
                    </div>
                    <div>
                      <span className="text-[#9c826e] block text-[10px]">Email Address:</span>
                      <a href={`mailto:${selectedCustomer.email}`} className="text-[#8c5e39] hover:underline">
                        {selectedCustomer.email || '—'}
                      </a>
                    </div>
                    {selectedCustomer.referenceName && (
                      <div>
                        <span className="text-[#9c826e] block text-[10px]">Internal Reference / Division:</span>
                        <span className="font-medium text-[#24160c]">{selectedCustomer.referenceName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Column 2: Legal & Statutory Address */}
                <div className="p-3 bg-white border border-[#ebdcc9] rounded-md space-y-2">
                  <div className="text-[11px] font-bold text-[#59371d] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#f2eadf] pb-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#8c5e39]" />
                    <span>Statutory & Billing Details</span>
                  </div>
                  <div className="space-y-1.5 text-[#574830]">
                    <div>
                      <span className="text-[#9c826e] block text-[10px]">GSTIN Registration:</span>
                      {selectedCustomer.gstin ? (
                        <span className="font-mono font-bold text-[#59371d] bg-[#faf6ee] px-1.5 py-0.5 rounded border border-[#ebdcc9]">
                          {selectedCustomer.gstin}
                        </span>
                      ) : (
                        <span className="text-[#9c826e] italic">Unregistered Commercial Client</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[#9c826e] block text-[10px]">City & State:</span>
                      <span className="text-[#24160c]">{selectedCustomer.city || 'Mumbai'}, {selectedCustomer.state || 'Maharashtra'}</span>
                    </div>
                    <div>
                      <span className="text-[#9c826e] block text-[10px]">Registered Billing Address:</span>
                      <p className="text-[#574830] leading-relaxed bg-[#fbf9f5] p-2 rounded border border-[#ebdcc9]/60">
                        {selectedCustomer.billingAddress || 'No detailed address registered.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Shortcuts */}
              <div className="flex items-center justify-between pt-2.5 border-t border-[#f0e8db]">
                <div className="text-[11px] text-[#9c826e]">
                  Registered: {formatDate(selectedCustomer.createdAt)}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/sites/new?customerId=${selectedCustomer.id}`}
                    className="px-3 py-1.5 bg-white hover:bg-[#faf6ee] text-[#4d301c] font-semibold rounded-md border border-[#d8c8b4] transition shadow-2xs"
                  >
                    + New Site Form
                  </Link>
                  <Link
                    href={`/projects?customerId=${selectedCustomer.id}`}
                    className="px-3.5 py-1.5 bg-[#24150c] hover:bg-[#382315] text-white font-semibold rounded-md transition flex items-center gap-1 shadow-2xs border border-[#4d301c]"
                  >
                    <span>View All Projects</span>
                    <ExternalLink className="w-3 h-3 text-[#c79e7c]" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. QUICK REGISTER MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#140b06]/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="fixed inset-0" 
            onClick={() => setModalOpen(false)} 
          />
          <div className="relative z-10 bg-white rounded-lg max-w-xl w-full p-5 shadow-2xl border border-[#d6c7b2] space-y-4 max-h-[90vh] overflow-y-auto main-scrollbar">
            <div className="flex items-center justify-between border-b border-[#f0e8db] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#24160c] flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#8c5e39]" />
                  <span>Register Corporate Account</span>
                </h3>
                <p className="text-xs text-[#7d6553] mt-0.5">Quickly add a commercial partner to the master ERP database.</p>
              </div>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-[#9c826e] hover:text-[#24160c] p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-[#24160c] mb-1">
                    Company / Contractor Legal Name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shapoorji Pallonji Real Estate"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    className="w-full p-2 border border-[#d8c8b4] rounded-md text-xs bg-[#faf6ee]/50 focus:bg-white focus:border-[#8c5e39] focus:outline-none font-medium text-[#24160c]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#24160c] mb-1">
                    Internal Reference / Division Tag
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Commercial Division"
                    value={referenceName}
                    onChange={(e) => setReferenceName(e.target.value)}
                    className="w-full p-2 border border-[#d8c8b4] rounded-md text-xs bg-[#faf6ee]/50 focus:bg-white focus:border-[#8c5e39] focus:outline-none text-[#24160c]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#24160c] mb-1">
                    GSTIN (15 Characters)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 27AAACT1234F1Z9"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    maxLength={15}
                    className="w-full p-2 border border-[#d8c8b4] rounded-md uppercase font-mono text-xs bg-[#faf6ee]/50 focus:bg-white focus:border-[#8c5e39] focus:outline-none text-[#24160c]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#24160c] mb-1">
                    Key Contact Person <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Vikram Malhotra"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    required
                    className="w-full p-2 border border-[#d8c8b4] rounded-md text-xs bg-[#faf6ee]/50 focus:bg-white focus:border-[#8c5e39] focus:outline-none text-[#24160c]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#24160c] mb-1">
                    Phone / Mobile Number <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98200 45678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="w-full p-2 border border-[#d8c8b4] rounded-md text-xs bg-[#faf6ee]/50 focus:bg-white focus:border-[#8c5e39] focus:outline-none text-[#24160c]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#24160c] mb-1">
                    Email Address <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. accounts@contractor.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full p-2 border border-[#d8c8b4] rounded-md text-xs bg-[#faf6ee]/50 focus:bg-white focus:border-[#8c5e39] focus:outline-none text-[#24160c]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#24160c] mb-1">
                    Credit Limit (INR)
                  </label>
                  <input
                    type="number"
                    placeholder="500000"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(Number(e.target.value))}
                    min={0}
                    step={50000}
                    className="w-full p-2 border border-[#d8c8b4] rounded-md font-mono text-xs bg-[#faf6ee]/50 focus:bg-white focus:border-[#8c5e39] focus:outline-none text-[#24160c]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#24160c] mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full p-2 border border-[#d8c8b4] rounded-md text-xs bg-[#faf6ee]/50 focus:bg-white focus:border-[#8c5e39] focus:outline-none text-[#24160c]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#24160c] mb-1">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full p-2 border border-[#d8c8b4] rounded-md text-xs bg-[#faf6ee]/50 focus:bg-white focus:border-[#8c5e39] focus:outline-none text-[#24160c]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#24160c] mb-1">
                  Registered Billing Address <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Complete registered corporate billing address..."
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  required
                  className="w-full p-2 border border-[#d8c8b4] rounded-md text-xs bg-[#faf6ee]/50 focus:bg-white focus:border-[#8c5e39] focus:outline-none text-[#24160c]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f0e8db]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 text-[#7d6553] hover:text-[#24160c] rounded-md border border-[#d8c8b4] font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#24150c] hover:bg-[#382315] text-white rounded-md font-semibold transition flex items-center gap-1.5 shadow-2xs border border-[#4d301c] cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#c79e7c]" />
                      <span>Save Customer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
