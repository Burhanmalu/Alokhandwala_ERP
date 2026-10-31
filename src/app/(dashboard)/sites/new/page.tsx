'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Building2, 
  MapPin, 
  Phone, 
  UserCheck, 
  UserPlus, 
  Ruler, 
  Camera, 
  FileText, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  Users,
  Compass,
  Check,
  Sparkles,
  X,
  Layers,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Customer, UserProfile } from '@/lib/schema';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { ImageUploaderWithLightbox } from '@/components/ui/ImageUploaderWithLightbox';

export default function SiteFormPage() {
  const router = useRouter();
  const { currentUser } = useAuth();

  // Reference lists
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([]);
  const [supervisors, setSupervisors] = useState<UserProfile[]>([]);

  // Form Fields:
  // 1. Customer Name
  const [customerName, setCustomerName] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  
  // 2. Referral Name
  const [referralName, setReferralName] = useState('');

  // 3. Supervisor Name
  const [supervisorName, setSupervisorName] = useState('');
  const [assignedSupervisorId, setAssignedSupervisorId] = useState('');

  // 4. Phone Number
  const [phone, setPhone] = useState('');

  // 5. Address
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');

  // 6. Photo of a site
  const [photos, setPhotos] = useState<string[]>([]);

  // 7. Size
  const [length, setLength] = useState<number | ''>('');
  const [width, setWidth] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  const [unit, setUnit] = useState<'FEET' | 'METERS'>('FEET');
  const [customSizeRemark, setCustomSizeRemark] = useState('');

  // 8. Remark
  const [remark, setRemark] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Fetch customers safely
    fetch('/api/customers')
      .then(async (res) => {
        if (!res.ok) return null;
        const ct = res.headers.get('content-type');
        return ct && ct.includes('application/json') ? res.json() : null;
      })
      .then((json) => {
        if (json && json.success && Array.isArray(json.data)) {
          setExistingCustomers(json.data);
        }
      })
      .catch((e) => console.error('Error fetching customers:', e));

    // Fetch users for supervisors safely
    fetch('/api/users')
      .then(async (res) => {
        if (!res.ok) return null;
        const ct = res.headers.get('content-type');
        return ct && ct.includes('application/json') ? res.json() : null;
      })
      .then((json) => {
        if (json && json.success && Array.isArray(json.data)) {
          const sups = json.data.filter((u: UserProfile) => u.role === 'SUPERVISOR' || u.role === 'ADMIN');
          setSupervisors(sups);
        }
      })
      .catch((e) => console.error('Error fetching users:', e));
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'WORKER') {
      router.replace('/projects?denied=site_create');
    }
  }, [currentUser, router]);

  // Handle existing customer selection
  const handleSelectCustomer = (val: string) => {
    setSelectedCustomerId(val);
    if (!val) {
      setCustomerName('');
      setPhone('');
      setReferralName('');
      return;
    }
    const cust = existingCustomers.find(c => c.id === val);
    if (cust) {
      setCustomerName(cust.companyName);
      setPhone(cust.phone || '');
      setReferralName(cust.referenceName || '');
      if (cust.billingAddress && !address) {
        setAddress(cust.billingAddress);
      }
    }
  };

  // Supervisor selection
  const handleSelectSupervisor = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setAssignedSupervisorId(val);
    const sup = supervisors.find(s => s.id === val);
    if (sup) {
      setSupervisorName(sup.fullName);
    }
  };

  // Calculate area
  const numL = Number(length) || 0;
  const numW = Number(width) || 0;
  const numH = Number(height) || 0;
  const facadeArea = numL * numH;
  const totalVolume = numL * numW * numH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerName.trim()) {
      setError('Customer Name is required.');
      return;
    }
    if (!phone.trim()) {
      setError('Phone Number is required.');
      return;
    }
    if (!address.trim()) {
      setError('Site Address is required.');
      return;
    }
    if (numL <= 0 || numH <= 0) {
      setError('Please provide valid size dimensions (Length and Height).');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId || undefined,
          customerName: customerName.trim(),
          referralName: referralName.trim() || undefined,
          supervisorName: supervisorName.trim(),
          assignedSupervisorId: assignedSupervisorId || currentUser.id,
          phone: phone.trim(),
          contactPhone: phone.trim(),
          address: address.trim(),
          siteAddress: address.trim(),
          landmark: landmark.trim() || undefined,
          city: 'Mumbai',
          state: 'Maharashtra',
          photoUrls: photos,
          length: numL,
          width: numW || 1,
          height: numH,
          unit,
          size: `${numL} x ${numW} x ${numH} ${unit}${customSizeRemark ? ` (${customSizeRemark})` : ''}`,
          remark: remark.trim() || undefined,
          siteRemarks: remark.trim() || undefined,
          actorId: currentUser.id,
          actorName: currentUser.fullName,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to submit site form.');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/projects/${json.data.id}`);
      }, 1200);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1500px] w-full mx-auto space-y-5">
      {/* Header Banner */}
      <div className="bg-[#1c120c] p-5 rounded-lg border border-[#382315] text-[#fbf9f5] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#c79e7c]">
            <span>Field Operations</span>
          </div>
          <h1 className="text-xl font-bold mt-1 text-[#fdfcf9] flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-[#c79e7c]" />
            <span>Site Form</span>
          </h1>
        </div>
        <div className="shrink-0 flex items-center">
          <span className="text-[11px] bg-[#382315] border border-[#c79e7c]/50 text-[#fdfcf9] px-3.5 py-1.5 rounded-full font-mono font-semibold shadow-2xs">
            Initial Status: NOT_INSTALLED
          </span>
        </div>
      </div>

      {/* Structured Progress Indicator Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#ebdcc9] shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm font-medium text-[#7d6553]">
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-[#fbf9f5] border border-[#ebdcc9] text-[#24160c] font-semibold">
            <span className="w-6 h-6 rounded-full bg-[#24160c] text-white text-xs flex items-center justify-center font-bold">1</span>
            <span className="truncate">Client & Contact</span>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-[#fbf9f5] border border-[#ebdcc9] text-[#24160c] font-semibold">
            <span className="w-6 h-6 rounded-full bg-[#24160c] text-white text-xs flex items-center justify-center font-bold">2</span>
            <span className="truncate">Site Location</span>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-[#fbf9f5] border border-[#ebdcc9] text-[#24160c] font-semibold">
            <span className="w-6 h-6 rounded-full bg-[#24160c] text-white text-xs flex items-center justify-center font-bold">3</span>
            <span className="truncate">Dimensions</span>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-[#fbf9f5] border border-[#ebdcc9] text-[#24160c] font-semibold">
            <span className="w-6 h-6 rounded-full bg-[#24160c] text-white text-xs flex items-center justify-center font-bold">4</span>
            <span className="truncate">Site Photos</span>
          </div>
          <div className="col-span-2 sm:col-span-1 flex items-center gap-2.5 p-3 rounded-lg bg-[#fbf9f5] border border-[#ebdcc9] text-[#24160c] font-semibold">
            <span className="w-6 h-6 rounded-full bg-[#24160c] text-white text-xs flex items-center justify-center font-bold">5</span>
            <span className="truncate">Site Remarks</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-3 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 text-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-medium">Site Form submitted successfully! Initializing project workspace...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ========================================================= */}
        {/* SECTION 1: CUSTOMER & REFERRAL                            */}
        {/* ========================================================= */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#ebdcc9] shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#ebdcc9] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#24160c] text-[#dfcbab] flex items-center justify-center font-bold text-sm">
                01
              </div>
              <h2 className="text-base font-bold text-[#24160c] uppercase tracking-wider">
                Customer & Referral Identification
              </h2>
            </div>
            <span className="text-xs font-mono text-[#7d6553] bg-[#fbf9f5] px-3 py-1 rounded-md border border-[#ebdcc9]">
              Client Profile
            </span>
          </div>

          <div className="space-y-4">
            {/* Quick Select Existing Customer (Optional) */}
            <div>
              <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                Select Existing Customer (or type new below)
              </label>
              <SearchableSelect
                value={selectedCustomerId}
                onChange={handleSelectCustomer}
                options={existingCustomers}
                getOptionValue={(c) => c.id}
                getOptionLabel={(c) => `${c.companyName} (${c.customerCode || 'CUST'}) - ${c.phone || ''}`}
                placeholder="-- Search & Choose Existing Client or Type New Below --"
                searchPlaceholder="Search customer by company name, customer code, contact, phone..."
                noResultsMessage="No matching customers found. You can type a new customer name below."
                filterOption={(c, q) =>
                  Boolean(
                    c.companyName?.toLowerCase().includes(q) ||
                    c.customerCode?.toLowerCase().includes(q) ||
                    c.phone?.includes(q) ||
                    c.contactPerson?.toLowerCase().includes(q) ||
                    c.referenceName?.toLowerCase().includes(q) ||
                    c.city?.toLowerCase().includes(q)
                  )
                }
                renderOption={(c) => (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1">
                    <div className="min-w-0">
                      <div className="font-semibold text-[#24160c] truncate">{c.companyName}</div>
                      <div className="text-[11px] text-[#7d6553] truncate">
                        {c.contactPerson ? `Contact: ${c.contactPerson}` : ''} {c.phone ? `• ${c.phone}` : ''}
                      </div>
                    </div>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-[#fbf9f5] border border-[#ebdcc9] text-[#5c3e24] shrink-0 self-start sm:self-auto">
                      {c.customerCode}
                    </span>
                  </div>
                )}
                renderSelected={(c) => (
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-semibold text-[#24160c] truncate">{c.companyName}</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#ebdcc9] text-[#24160c] border border-[#d6c7b2] shrink-0">
                      {c.customerCode}
                    </span>
                    {c.phone && <span className="text-[11px] text-[#7d6553] truncate">({c.phone})</span>}
                  </div>
                )}
              />
            </div>

            {/* Two-Column Grid for Client Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Customer Name */}
              <div>
                <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                  Customer Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={e => {
                    setCustomerName(e.target.value);
                    setSelectedCustomerId('');
                  }}
                  placeholder="e.g. Shapoorji Pallonji / Oberoi Realty"
                  className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-hidden focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] transition"
                />
              </div>

              {/* 2. Referral Name */}
              <div>
                <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                  Referral Name
                </label>
                <input
                  type="text"
                  value={referralName}
                  onChange={e => setReferralName(e.target.value)}
                  placeholder="e.g. Architect Mehta / Contractor Rao / Direct"
                  className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-hidden focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] transition"
                />
                <span className="text-2xs text-[#8c7360] mt-1.5 block">
                  Broker, architect, contractor, or business source
                </span>
              </div>

              {/* 3. Supervisor Name */}
              <div>
                <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                  Supervisor in Charge <span className="text-rose-600">*</span>
                </label>
                <select
                  value={assignedSupervisorId}
                  onChange={handleSelectSupervisor}
                  className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-hidden focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] transition"
                >
                  <option value="">-- Choose Assigned Supervisor --</option>
                  {supervisors.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.role.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Phone Number */}
              <div>
                <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                  Phone Number <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#7d6553] text-sm font-semibold">
                    +91
                  </div>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="9820012345"
                    maxLength={10}
                    className="w-full text-sm pl-13 pr-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-hidden focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] font-mono transition"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 2: ADDRESS & SITE LOCATION                        */}
        {/* ========================================================= */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#ebdcc9] shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#ebdcc9] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#24160c] text-[#dfcbab] flex items-center justify-center font-bold text-sm">
                02
              </div>
              <h2 className="text-base font-bold text-[#24160c] uppercase tracking-wider">
                Site Location & Delivery Point
              </h2>
            </div>
            <span className="text-xs font-mono text-[#7d6553] bg-[#fbf9f5] px-3 py-1 rounded-md border border-[#ebdcc9]">
              Physical Location
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 5. Address */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                Site Address <span className="text-rose-600">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Plot No. 42, Sector 15, Near Metro Pillar 124, Andheri East, Mumbai"
                className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-hidden focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] transition"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                Landmark & Unloading Access Notes
              </label>
              <input
                type="text"
                value={landmark}
                onChange={e => setLandmark(e.target.value)}
                placeholder="e.g. Opposite D-Mart, gate no. 2; 14-wheeler truck entry permitted after 9 PM"
                className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-hidden focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] transition"
              />
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 3: SIZE / MEASUREMENTS                            */}
        {/* ========================================================= */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#ebdcc9] shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#ebdcc9] pb-4 gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#24160c] text-[#dfcbab] flex items-center justify-center font-bold text-sm">
                03
              </div>
              <h2 className="text-base font-bold text-[#24160c] uppercase tracking-wider">
                Scaffolding Engineering Dimensions
              </h2>
            </div>
            {/* Unit Toggle Tabs */}
            <div className="flex items-center gap-1 bg-[#fbf9f5] border border-[#ebdcc9] p-1 rounded-lg text-xs font-semibold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setUnit('FEET')}
                className={`px-3 py-1 rounded transition text-xs ${
                  unit === 'FEET' 
                    ? 'bg-[#24160c] text-white shadow-2xs' 
                    : 'text-[#7d6553] hover:text-[#24160c]'
                }`}
              >
                Feet (ft)
              </button>
              <button
                type="button"
                onClick={() => setUnit('METERS')}
                className={`px-3 py-1 rounded transition text-xs ${
                  unit === 'METERS' 
                    ? 'bg-[#24160c] text-white shadow-2xs' 
                    : 'text-[#7d6553] hover:text-[#24160c]'
                }`}
              >
                Meters (m)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                Length ({unit === 'FEET' ? 'ft' : 'm'}) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                required
                min={1}
                step="0.5"
                value={length}
                onChange={e => setLength(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 25"
                className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-hidden focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] font-mono transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                Width / Depth ({unit === 'FEET' ? 'ft' : 'm'})
              </label>
              <input
                type="number"
                min={0}
                step="0.5"
                value={width}
                onChange={e => setWidth(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 5"
                className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-hidden focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] font-mono transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                Height ({unit === 'FEET' ? 'ft' : 'm'}) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                required
                min={1}
                step="0.5"
                value={height}
                onChange={e => setHeight(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 40"
                className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-hidden focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] font-mono transition"
              />
            </div>
          </div>

          {/* Size Calculation Card */}
          <div className="bg-[#fbf9f5] border border-[#ebdcc9] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#ebdcc9] text-[#24160c] flex items-center justify-center shrink-0">
                <Compass className="w-4 h-4 text-[#8f6541]" />
              </div>
              <div>
                <span className="font-semibold text-[#4a3525]">Calculated Elevation Area:</span>
                <span className="font-mono font-bold text-[#24160c] ml-1.5 text-sm">
                  {facadeArea} {unit === 'FEET' ? 'sq.ft' : 'sq.m'}
                </span>
                {numW > 0 && (
                  <span className="text-[#7d6553] ml-2 font-mono text-[11px]">
                    (Volume: {totalVolume} {unit === 'FEET' ? 'cu.ft' : 'cu.m'})
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-[220px]">
              <input
                type="text"
                value={customSizeRemark}
                onChange={e => setCustomSizeRemark(e.target.value)}
                placeholder="Additional size notes: e.g. 3 façade sides + elevator shaft"
                className="w-full text-xs px-3 py-1.5 rounded-md border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-hidden focus:border-[#8f6541] transition"
              />
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 4: PHOTO OF A SITE                                */}
        {/* ========================================================= */}
        <div className="bg-white p-6 rounded-2xl border border-[#ebdcc9] shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#ebdcc9] pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#24160c] text-[#dfcbab] flex items-center justify-center font-bold text-xs">
                04
              </div>
              <h2 className="text-sm font-bold text-[#24160c] uppercase tracking-wider">
                Photo of a Site & Field Evidence
              </h2>
            </div>
            <span className="text-[11px] font-mono text-[#7d6553] bg-[#fbf9f5] px-2.5 py-1 rounded border border-[#ebdcc9]">
              Visual Documentation
            </span>
          </div>

          <ImageUploaderWithLightbox
            images={photos}
            onChange={setPhotos}
            title="Site Inspection Photos"
            subtitle="Take live site camera photos or upload multiple images directly from your device gallery. Click any photo to preview, zoom in/out, or replace before saving."
            maxFiles={20}
          />
        </div>

        {/* ========================================================= */}
        {/* SECTION 5: REMARK                                         */}
        {/* ========================================================= */}
        <div className="bg-white p-6 rounded-2xl border border-[#ebdcc9] shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#ebdcc9] pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#24160c] text-[#dfcbab] flex items-center justify-center font-bold text-xs">
                05
              </div>
              <h2 className="text-sm font-bold text-[#24160c] uppercase tracking-wider">
                Remark & Operational Precautions
              </h2>
            </div>
            <span className="text-[11px] font-mono text-[#7d6553] bg-[#fbf9f5] px-2.5 py-1 rounded border border-[#ebdcc9]">
              Safety & Access
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4a3525] uppercase tracking-wider mb-1.5">
              Site Remarks & Notes
            </label>
            <textarea
              rows={3}
              value={remark}
              onChange={e => setRemark(e.target.value)}
              placeholder="e.g. Ground soil is firm, no overhead electrical lines, nighttime vehicle entry only between 11 PM and 5 AM. Client requests galvanized pipes."
              className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-hidden focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] transition"
            />
            <span className="text-2xs text-[#8c7360] mt-1.5 block">
              Include ground conditions, overhead hazard clearances, crane positioning, and vehicle restrictions.
            </span>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-[#ebdcc9] shadow-2xs flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="text-sm text-[#7d6553] flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8f6541]"></span>
            <span>All required fields (*) will create an inspected site ready for quotation confirmation.</span>
          </div>

          <div className="flex items-center gap-3 justify-end">
            <Link
              href="/projects"
              className="px-6 py-3 rounded-lg border border-[#d6c7b2] text-[#24160c] hover:bg-[#fbf9f5] text-sm font-semibold transition text-center min-h-[44px] flex items-center justify-center cursor-pointer"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || success}
              className="flex items-center justify-center gap-2 px-7 py-3 bg-[#24160c] hover:bg-[#382315] disabled:bg-[#d6c7b2] text-[#fbf9f5] text-sm font-bold rounded-lg shadow-sm transition cursor-pointer min-h-[44px]"
            >
              {loading ? (
                <span>Saving Site Record...</span>
              ) : success ? (
                <>
                  <Check className="w-4 h-4 text-[#c79e7c]" />
                  <span>Site Record Saved!</span>
                </>
              ) : (
                <>
                  <Building2 className="w-4 h-4 text-[#c79e7c]" />
                  <span>Submit Site Form</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
