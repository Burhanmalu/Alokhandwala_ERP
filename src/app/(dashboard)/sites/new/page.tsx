'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Customer, UserProfile } from '@/lib/schema';
import { calculateScaffoldingArea } from '@/lib/formatters';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { ImageUploaderWithLightbox } from '@/components/ui/ImageUploaderWithLightbox';
import { SiteLocationMap, LocationData } from '@/components/maps/SiteLocationMap';

export default function SiteFormPage() {
  return (
    <Suspense fallback={
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-2 border-[#8c5e39] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <p className="text-xs font-semibold text-[#7d6553]">Loading Site Form...</p>
      </div>
    }>
      <SiteFormContent />
    </Suspense>
  );
}

function SiteFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editProjectId = searchParams.get('id') || searchParams.get('projectId');

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

  // 5. Address & Coordinates
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [locationType, setLocationType] = useState<'ON_SITE' | 'NOT_ON_SITE' | undefined>(undefined);
  const [locationAccuracyMeters, setLocationAccuracyMeters] = useState<number | undefined>(undefined);
  const [isLocationConfirmed, setIsLocationConfirmed] = useState<boolean>(false);

  // 6. Photo of a site
  const [photos, setPhotos] = useState<string[]>([]);

  // 7. Scaffolding Engineering Dimensions (Width, Depth, Height)
  const [width, setWidth] = useState<number | ''>('');
  const [depth, setDepth] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  const [unit, setUnit] = useState<'FEET' | 'METERS'>('FEET');
  const [customSizeRemark, setCustomSizeRemark] = useState('');

  // 8. Remark
  const [remark, setRemark] = useState('');

  const [loading, setLoading] = useState(false);
  const [fetchingProject, setFetchingProject] = useState(false);
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

  // Restore saved site form when editing an existing project
  useEffect(() => {
    if (!editProjectId) return;

    setFetchingProject(true);
    fetch(`/api/projects/${editProjectId}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((json) => {
        if (json && json.success && json.data) {
          const p = json.data;
          setCustomerName(p.customerName || '');
          setSelectedCustomerId(p.customerId || '');
          setReferralName(p.referralName || '');
          setSupervisorName(p.supervisorName || '');
          setAssignedSupervisorId(p.assignedSupervisorId || '');
          
          const rawPhone = p.contactPhone || p.customer?.phone || '';
          setPhone(rawPhone.replace(/\D/g, '').slice(-10));

          setAddress(p.siteAddress || p.address || '');
          setLandmark(p.landmark || p.site?.landmark || '');
          
          if (p.latitude !== undefined && p.longitude !== undefined) {
            setLatitude(p.latitude);
            setLongitude(p.longitude);
          } else if (p.site?.latitude !== undefined && p.site?.longitude !== undefined) {
            setLatitude(p.site.latitude);
            setLongitude(p.site.longitude);
          }

          const savedLocType = p.locationType || p.site?.locationType;
          if (savedLocType) {
            setLocationType(savedLocType);
            setIsLocationConfirmed(true);
          } else if (p.latitude !== undefined && p.longitude !== undefined) {
            setLocationType('ON_SITE');
            setIsLocationConfirmed(true);
          }

          const savedLocAccuracy = p.locationAccuracyMeters ?? p.site?.locationAccuracyMeters;
          if (savedLocAccuracy !== undefined) {
            setLocationAccuracyMeters(savedLocAccuracy);
          }

          if (p.measurements) {
            setWidth(p.measurements.width !== undefined ? p.measurements.width : (p.measurements.length || ''));
            setDepth(p.measurements.depth !== undefined ? p.measurements.depth : 3);
            setHeight(p.measurements.height || '');
            setUnit(p.measurements.unit || 'FEET');
          }

          if (p.siteRemarks || p.remark) {
            setRemark(p.siteRemarks || p.remark || '');
          }

          if (p.photos && Array.isArray(p.photos)) {
            setPhotos(p.photos.map((f: any) => f.fileUrl).filter(Boolean));
          }
        }
      })
      .catch((e) => {
        console.error('Failed to load project for edit:', e);
        setError('Failed to load project details for editing.');
      })
      .finally(() => {
        setFetchingProject(false);
      });
  }, [editProjectId]);

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
      const cleanPhone = (cust.phone || '').replace(/\D/g, '').slice(-10);
      setPhone(cleanPhone);
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

  // Handle Map Location Change
  const handleMapLocationChange = (loc: LocationData) => {
    if (loc.address) {
      setAddress(loc.address);
    }
    if (loc.latitude !== undefined) {
      setLatitude(loc.latitude);
    }
    if (loc.longitude !== undefined) {
      setLongitude(loc.longitude);
    }
    if (loc.locationType) {
      setLocationType(loc.locationType);
    }
    if (loc.locationAccuracyMeters !== undefined) {
      setLocationAccuracyMeters(loc.locationAccuracyMeters);
    }
    setIsLocationConfirmed(loc.isConfirmed);
  };

  // Unit Conversion Handler
  const handleUnitToggle = (targetUnit: 'FEET' | 'METERS') => {
    if (targetUnit === unit) return;
    if (targetUnit === 'METERS') {
      // Convert current values from Feet to Meters (1 ft = 0.3048 m)
      if (width !== '') setWidth(Number((Number(width) * 0.3048).toFixed(2)));
      if (depth !== '') setDepth(Number((Number(depth) * 0.3048).toFixed(2)));
      if (height !== '') setHeight(Number((Number(height) * 0.3048).toFixed(2)));
    } else {
      // Convert current values from Meters to Feet (1 m = 1 / 0.3048 ft)
      if (width !== '') setWidth(Number((Number(width) / 0.3048).toFixed(2)));
      if (depth !== '') setDepth(Number((Number(depth) / 0.3048).toFixed(2)));
      if (height !== '') setHeight(Number((Number(height) / 0.3048).toFixed(2)));
    }
    setUnit(targetUnit);
  };

  // Dimensions & Area Calculation
  const numW = Number(width) || 0;
  const numD = Number(depth) || 0;
  const numH = Number(height) || 0;

  // Exact Formula:
  // const adjustedDepth = depth <= 3 ? 1 : depth / 3;
  // const area = width * adjustedDepth * height;
  const calculatedElevationAreaSqFt = calculateScaffoldingArea(numW, numD, numH, unit);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerName.trim()) {
      setError('Customer Name is required.');
      return;
    }
    if (!phone.trim() || phone.trim().length !== 10) {
      setError('Please provide a valid 10-digit Indian phone number.');
      return;
    }
    if (!address.trim()) {
      setError('Site Address is required. Search on the map or type an address below.');
      return;
    }
    if (numW <= 0 || numD <= 0 || numH <= 0) {
      setError('Please provide valid positive numbers for Width, Depth, and Height.');
      return;
    }

    if (locationType && !isLocationConfirmed) {
      setError('Please click "Confirm Location" on the map to confirm the site location before saving.');
      return;
    }

    setLoading(true);

    try {
      if (editProjectId) {
        // Edit Mode: Update existing project and site record
        const res = await fetch(`/api/projects/${editProjectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updateSiteForm: true,
            customerName: customerName.trim(),
            referralName: referralName.trim() || undefined,
            supervisorName: supervisorName.trim(),
            assignedSupervisorId: assignedSupervisorId || currentUser?.id,
            phone: phone.trim(),
            siteAddress: address.trim(),
            landmark: landmark.trim() || undefined,
            latitude,
            longitude,
            locationType,
            locationAccuracyMeters,
            photoUrls: photos,
            width: numW,
            depth: numD,
            height: numH,
            length: numW,
            unit,
            areaSqFt: calculatedElevationAreaSqFt,
            siteRemarks: remark.trim() || undefined,
            actorId: currentUser?.id,
            actorName: currentUser?.fullName,
          }),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to update site record.');
        }

        setSuccess(true);
        setTimeout(() => {
          router.push(`/projects/${editProjectId}`);
        }, 1200);
      } else {
        // Create Mode: Register new site inspection
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: selectedCustomerId || undefined,
            customerName: customerName.trim(),
            referralName: referralName.trim() || undefined,
            supervisorName: supervisorName.trim(),
            assignedSupervisorId: assignedSupervisorId || currentUser?.id,
            phone: phone.trim(),
            contactPhone: phone.trim(),
            address: address.trim(),
            siteAddress: address.trim(),
            landmark: landmark.trim() || undefined,
            latitude,
            longitude,
            locationType,
            locationAccuracyMeters,
            city: 'Mumbai',
            state: 'Maharashtra',
            photoUrls: photos,
            width: numW,
            depth: numD,
            height: numH,
            length: numW,
            unit,
            areaSqFt: calculatedElevationAreaSqFt,
            size: `${numW} x ${numD} x ${numH} ${unit}${customSizeRemark ? ` (${customSizeRemark})` : ''}`,
            remark: remark.trim() || undefined,
            siteRemarks: remark.trim() || undefined,
            actorId: currentUser?.id,
            actorName: currentUser?.fullName,
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
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the site form.');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingProject) {
    return (
      <div className="py-24 text-center">
        <div className="w-8 h-8 border-2 border-[#8c5e39] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <p className="text-xs font-semibold text-[#7d6553]">Loading site inspection data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1500px] w-full mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-[#1c120c] p-5 rounded-lg border border-[#382315] text-[#fbf9f5] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#c79e7c]">
            <span>Field Operations</span>
          </div>
          <h1 className="text-xl font-bold mt-1 text-[#fdfcf9] flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-[#c79e7c]" />
            <span>{editProjectId ? 'Edit Site Inspection Form' : 'Site Form'}</span>
          </h1>
        </div>
        <div className="shrink-0 flex items-center">
          <span className="text-[11px] bg-[#382315] border border-[#c79e7c]/50 text-[#fdfcf9] px-3.5 py-1.5 rounded-full font-mono font-semibold shadow-2xs">
            {editProjectId ? 'Editing Project Site' : 'Initial Status: NOT_INSTALLED'}
          </span>
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
          <span className="font-medium">
            {editProjectId 
              ? 'Site inspection record updated successfully! Returning to project workspace...' 
              : 'Site Form submitted successfully! Initializing project workspace...'}
          </span>
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
                  className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-none focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] transition"
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
                  className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-none focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] transition"
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
                  className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-none focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] transition"
                >
                  <option value="">-- Choose Assigned Supervisor --</option>
                  {supervisors.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.role.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Phone Number Input (Clean prefix group, zero overlapping text/placeholder) */}
              <div>
                <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                  Phone Number <span className="text-rose-600">*</span>
                </label>
                <div className="flex rounded-lg border border-[#d6c7b2] bg-white overflow-hidden shadow-2xs focus-within:ring-2 focus-within:ring-[#8f6541]/20 focus-within:border-[#8f6541] transition">
                  <span className="inline-flex items-center px-3.5 bg-[#fbf9f5] border-r border-[#ebdcc9] text-[#5c3e24] text-sm font-bold font-mono select-none shrink-0">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="Enter 10-digit mobile number"
                    maxLength={10}
                    className="w-full text-sm px-3.5 py-3 bg-white text-[#24160c] placeholder:text-[#a9927d] focus:outline-none font-mono"
                  />
                </div>
                {phone && phone.length < 10 && (
                  <span className="text-[11px] text-amber-700 font-medium mt-1 block">
                    Please enter full 10-digit mobile number ({10 - phone.length} digits remaining)
                  </span>
                )}
                {phone && phone.length === 10 && (
                  <span className="text-[11px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Valid 10-digit Indian mobile number
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 2: ADDRESS & GOOGLE MAPS SITE LOCATION            */}
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
              Physical Location & GPS Pin
            </span>
          </div>

          {/* Interactive Google Map with Current Location Button & Places Autocomplete */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                Pinpoint Site on Google Map (or Use Current Location)
              </label>
              <SiteLocationMap
                initialAddress={address}
                initialLatitude={latitude}
                initialLongitude={longitude}
                initialLocationType={locationType}
                initialLocationAccuracy={locationAccuracyMeters}
                onLocationChange={handleMapLocationChange}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Site Address Textarea */}
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
                  className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-none focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] transition"
                />
              </div>

              {/* Landmark & Unloading Access Notes */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                  Landmark & Unloading Access Notes
                </label>
                <input
                  type="text"
                  value={landmark}
                  onChange={e => setLandmark(e.target.value)}
                  placeholder="e.g. Opposite D-Mart, gate no. 2; 14-wheeler truck entry permitted after 9 PM"
                  className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-none focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] transition"
                />
              </div>
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
                onClick={() => handleUnitToggle('FEET')}
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
                onClick={() => handleUnitToggle('METERS')}
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
            {/* 1. Width */}
            <div>
              <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                Width ({unit === 'FEET' ? 'ft' : 'm'}) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                required
                min={0.1}
                step="0.5"
                value={width}
                onChange={e => setWidth(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={unit === 'FEET' ? 'e.g. 10' : 'e.g. 3.0'}
                className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-none focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] font-mono transition"
              />
            </div>

            {/* 2. Depth */}
            <div>
              <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Depth ({unit === 'FEET' ? 'ft' : 'm'}) <span className="text-rose-600">*</span></span>
              </label>
              <input
                type="number"
                required
                min={0.1}
                step="0.5"
                value={depth}
                onChange={e => setDepth(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={unit === 'FEET' ? 'e.g. 3' : 'e.g. 1.0'}
                className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-none focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] font-mono transition"
              />
            </div>

            {/* 3. Height */}
            <div>
              <label className="block text-xs font-bold text-[#4a3525] uppercase tracking-wider mb-2">
                Height ({unit === 'FEET' ? 'ft' : 'm'}) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                required
                min={0.1}
                step="0.5"
                value={height}
                onChange={e => setHeight(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={unit === 'FEET' ? 'e.g. 20' : 'e.g. 6.0'}
                className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-none focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] font-mono transition"
              />
            </div>
          </div>

          {/* Scaffolding Engineering Dimensions Area Calculation Card */}
          <div className="bg-[#fbf9f5] border border-[#ebdcc9] rounded-xl p-4 space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#24160c] text-[#dfcbab] flex items-center justify-center shrink-0">
                  <Compass className="w-5 h-5 text-[#c79e7c]" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-[#8c5e39] uppercase tracking-wider">
                    Calculated Elevation Area (sq. ft.)
                  </div>
                  <div className="font-mono font-bold text-[#24160c] text-xl mt-0.5">
                    {calculatedElevationAreaSqFt > 0 ? calculatedElevationAreaSqFt.toLocaleString('en-IN') : 0}{' '}
                    <span className="text-xs font-sans font-semibold text-[#7d6553]">sq. ft.</span>
                  </div>
                </div>
              </div>

              {/* Engineering Formula Rule Pill */}
              <div className="bg-white border border-[#ebdcc9] rounded-lg p-2.5 sm:text-right text-[11px] text-[#7d6553]">
                <div className="font-semibold text-[#24160c]">
                  Formula: Width × Adjusted Depth × Height
                </div>
                <div className="text-[10px] text-[#8c5e39] font-mono mt-0.5">
                  Depth ≤ 3 ft → Multiplier: 1 | Depth &gt; 3 ft → Multiplier: Depth / 3
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#f2eadf] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-[11px] text-[#7d6553]">
                Dimensions captured: <strong>{numW || 0}</strong> {unit === 'FEET' ? 'ft' : 'm'} (W) ×{' '}
                <strong>{numD || 0}</strong> {unit === 'FEET' ? 'ft' : 'm'} (D) ×{' '}
                <strong>{numH || 0}</strong> {unit === 'FEET' ? 'ft' : 'm'} (H)
              </span>

              <div className="w-full sm:w-auto sm:min-w-[260px]">
                <input
                  type="text"
                  value={customSizeRemark}
                  onChange={e => setCustomSizeRemark(e.target.value)}
                  placeholder="Optional size remarks (e.g. 3 façade sides, lift shaft)"
                  className="w-full text-xs px-3 py-1.5 rounded-md border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-none focus:border-[#8f6541] transition"
                />
              </div>
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
              className="w-full text-sm px-4 py-3 rounded-lg border border-[#d6c7b2] bg-white text-[#24160c] focus:outline-none focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] transition"
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
              className="flex items-center justify-center gap-2 px-7 py-3 bg-[#24160c] hover:bg-[#382315] disabled:bg-[#d6c7b2] text-[#fdfcf9] text-sm font-bold rounded-lg shadow-sm transition cursor-pointer min-h-[44px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#c79e7c]" />
                  <span>{editProjectId ? 'Updating Site Record...' : 'Saving Site Record...'}</span>
                </>
              ) : success ? (
                <>
                  <Check className="w-4 h-4 text-[#c79e7c]" />
                  <span>{editProjectId ? 'Site Record Updated!' : 'Site Record Saved!'}</span>
                </>
              ) : (
                <>
                  <Building2 className="w-4 h-4 text-[#c79e7c]" />
                  <span>{editProjectId ? 'Update Site Record' : 'Submit Site Form'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
