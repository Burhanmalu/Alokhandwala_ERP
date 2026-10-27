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
  UploadCloud,
  Trash2,
  Plus,
  Users,
  Compass,
  Check,
  Loader2,
  Sparkles,
  X,
  Maximize2,
  ImageIcon
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Customer, UserProfile } from '@/lib/schema';
import { processAndUploadImage } from '@/lib/image-utils';

export default function SiteFormPage() {
  const router = useRouter();
  const { currentUser } = useAuth();

  // Reference lists
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([]);
  const [supervisors, setSupervisors] = useState<UserProfile[]>([]);

  // Form Fields as requested:
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
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
  const handleSelectCustomer = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
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



  // Add custom photo URL
  const handleAddPhotoUrl = () => {
    let url = newPhotoUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && !url.startsWith('data:') && !url.startsWith('/')) {
      url = `https://${url}`;
    }
    if (!photos.includes(url)) {
      setPhotos(prev => [...prev, url]);
    }
    setNewPhotoUrl('');
  };

  // Process selected files or dropped files
  const handleFiles = async (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    setIsUploading(true);
    try {
      const uploadPromises = validFiles.map(f => processAndUploadImage(f));
      const newUrls = await Promise.all(uploadPromises);
      setPhotos(prev => [...prev, ...newUrls.filter(u => Boolean(u) && !prev.includes(u))]);
    } catch (err) {
      console.error('Error uploading site photos:', err);
      setError('Could not process some image files. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Clipboard paste listener to allow pasting screenshots or copied images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        handleFiles(imageFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Remove photo
  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
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
        throw new Error(json.error || 'Failed to submit site inspection form.');
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/projects" className="hover:text-emerald-700 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Projects & Sites</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800">Site Registration & Inspection Form</span>
      </div>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0e1c14] to-[#1e3b2e] p-6 rounded-2xl border border-emerald-900/40 text-white shadow-md flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <span>ALOKHANDWALA Field Operations</span>
            <span>•</span>
            <span className="font-mono">Step 1: Site Inspection</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 text-white flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-emerald-400" />
            <span>Site Form</span>
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Register new site details, capture dimensions, upload photos, and assign supervisors for quotation and scaffolding installation.
          </p>
        </div>
        <div className="hidden sm:block text-right">
          <span className="text-[11px] bg-emerald-950 border border-emerald-700/60 text-emerald-300 px-3 py-1 rounded-full font-mono">
            Status: NOT_INSTALLED
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Site Form submitted successfully! Redirecting to project workspace...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ========================================================= */}
        {/* SECTION 1: CUSTOMER & REFERRAL                            */}
        {/* ========================================================= */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>Customer & Referral Details</span>
            </h2>
            <span className="text-[11px] text-slate-400">Client Identification</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quick Select Existing Customer (Optional) */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Select Existing Customer (or type new below)
              </label>
              <select
                value={selectedCustomerId}
                onChange={handleSelectCustomer}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              >
                <option value="">-- Choose Existing Client or Enter New Below --</option>
                {existingCustomers.map(cust => (
                  <option key={cust.id} value={cust.id}>
                    {cust.companyName} ({cust.customerCode}) - {cust.phone}
                  </option>
                ))}
              </select>
            </div>

            {/* 1. Customer Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customer Name <span className="text-rose-500">*</span>
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
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
              />
            </div>

            {/* 2. Referral Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Referral Name
              </label>
              <input
                type="text"
                value={referralName}
                onChange={e => setReferralName(e.target.value)}
                placeholder="e.g. Imran Builder / Architect Mehta / Contractor Rao"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Broker, architect, contractor, or business source
              </span>
            </div>

            {/* 3. Supervisor Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supervisor Name <span className="text-rose-500">*</span>
              </label>
              <div className="space-y-1.5">
                <select
                  value={assignedSupervisorId}
                  onChange={handleSelectSupervisor}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                >
                  <option value="">Select Supervisor...</option>
                  {supervisors.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.role.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4. Phone Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-xs font-medium">
                  +91
                </div>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="9820012345"
                  maxLength={10}
                  className="w-full text-sm pl-11 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-mono transition"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 2: ADDRESS                                        */}
        {/* ========================================================= */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Site Location & Address</span>
            </h2>
            <span className="text-[11px] text-slate-400">Delivery & Erection Point</span>
          </div>

          <div className="space-y-4">
            {/* 5. Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Site Address <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Plot No. 42, Sector 15, Near Metro Pillar 124, Andheri East"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Landmark
              </label>
              <input
                type="text"
                value={landmark}
                onChange={e => setLandmark(e.target.value)}
                placeholder="Opposite D-Mart / Near Signal"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
              />
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 3: SIZE / MEASUREMENTS                            */}
        {/* ========================================================= */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Ruler className="w-4 h-4 text-emerald-600" />
              <span>Scaffolding Size & Dimensions</span>
            </h2>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setUnit('FEET')}
                className={`px-3 py-1 rounded-md transition ${unit === 'FEET' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Feet (ft)
              </button>
              <button
                type="button"
                onClick={() => setUnit('METERS')}
                className={`px-3 py-1 rounded-md transition ${unit === 'METERS' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Meters (m)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Length ({unit === 'FEET' ? 'ft' : 'm'}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min={1}
                step="0.5"
                value={length}
                onChange={e => setLength(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 25"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-mono transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Width / Depth ({unit === 'FEET' ? 'ft' : 'm'})
              </label>
              <input
                type="number"
                min={0}
                step="0.5"
                value={width}
                onChange={e => setWidth(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 5"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-mono transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Height ({unit === 'FEET' ? 'ft' : 'm'}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min={1}
                step="0.5"
                value={height}
                onChange={e => setHeight(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 40"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-mono transition"
              />
            </div>
          </div>

          {/* Size Calculation Card */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <Compass className="w-5 h-5 text-emerald-700" />
              <div>
                <span className="font-semibold text-emerald-950">Calculated Elevation Area:</span>
                <span className="font-mono font-bold text-emerald-900 ml-1.5 text-sm">
                  {facadeArea} {unit === 'FEET' ? 'sq.ft' : 'sq.m'}
                </span>
                {numW > 0 && (
                  <span className="text-slate-500 ml-2 font-mono text-[11px]">
                    (Volume: {totalVolume} {unit === 'FEET' ? 'cu.ft' : 'cu.m'})
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                value={customSizeRemark}
                onChange={e => setCustomSizeRemark(e.target.value)}
                placeholder="Additional size notes: e.g. 3 façade sides + elevator shaft"
                className="w-full text-xs px-3 py-1.5 rounded-lg border border-emerald-300/80 bg-white focus:outline-hidden focus:border-emerald-600 transition"
              />
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 4: PHOTO OF A SITE                                */}
        {/* ========================================================= */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-600" />
              <span>Photo of a Site</span>
              {photos.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                  {photos.length} {photos.length === 1 ? 'photo' : 'photos'} attached
                </span>
              )}
            </h2>
            <span className="text-[11px] text-slate-400">Pre-Installation Site Conditions</span>
          </div>

          {/* Hidden file input for native device upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                handleFiles(e.target.files);
              }
              e.target.value = '';
            }}
          />

          {/* Thumbnail Gallery & Upload Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {photos.map((url, idx) => (
              <div 
                key={idx} 
                className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video shadow-xs cursor-pointer"
                onClick={() => setPreviewPhoto(url)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={url} 
                  alt={`Site photo ${idx + 1}`} 
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300 opacity-90 group-hover:opacity-100" 
                />
                
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                  <span className="p-1.5 bg-black/60 rounded-full text-white shadow-sm">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemovePhoto(idx);
                  }}
                  className="absolute top-1.5 right-1.5 p-1.5 bg-rose-600/90 hover:bg-rose-700 text-white rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition z-10"
                  title="Remove photo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div className="absolute bottom-1.5 left-1.5 bg-black/75 px-2 py-0.5 rounded text-[10px] text-white font-mono flex items-center gap-1">
                  <ImageIcon className="w-3 h-3 text-emerald-400" />
                  <span>Photo #{idx + 1}</span>
                </div>
              </div>
            ))}

            {/* Quick Upload / Add Card */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`border-2 border-dashed rounded-xl p-3 flex flex-col items-center justify-center text-center transition aspect-video cursor-pointer select-none ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-400/30'
                  : 'border-slate-300 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/30'
              }`}
            >
              {isUploading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-6 h-6 text-emerald-600 animate-spin mb-1" />
                  <span className="text-[11px] font-semibold text-emerald-800">Processing image...</span>
                </div>
              ) : (
                <>
                  <UploadCloud className={`w-6 h-6 mb-1 transition ${isDragging ? 'text-emerald-600 scale-110' : 'text-slate-400'}`} />
                  <span className="text-[11px] font-semibold text-slate-700">Click to Upload Photo</span>
                  <span className="text-[9px] text-slate-400">or drag & drop / paste image</span>
                </>
              )}
            </div>
          </div>



          {/* Add Photo Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newPhotoUrl}
              onChange={e => setNewPhotoUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddPhotoUrl();
                }
              }}
              placeholder="Paste photo image URL or cloud link..."
              className="flex-1 text-sm px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:border-emerald-600 transition bg-white"
            />
            <button
              type="button"
              onClick={handleAddPhotoUrl}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
            >
              Add URL
            </button>
          </div>

          {/* Lightbox / Preview Modal */}
          {previewPhoto && (
            <div 
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
              onClick={() => setPreviewPhoto(null)}
            >
              <div 
                className="relative max-w-3xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-white text-xs">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold">Site Inspection Photo Preview</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setPreviewPhoto(null)}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-[75vh] overflow-hidden flex items-center justify-center bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewPhoto} alt="Site Inspection Large Preview" className="max-w-full max-h-[75vh] object-contain" />
                </div>
                <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
                  <span className="font-mono text-[11px] text-slate-400">Pre-installation inspection record</span>
                  <button
                    type="button"
                    onClick={() => {
                      const idx = photos.indexOf(previewPhoto);
                      if (idx >= 0) handleRemovePhoto(idx);
                      setPreviewPhoto(null);
                    }}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Photo</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* SECTION 5: REMARK                                         */}
        {/* ========================================================= */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>Remark</span>
            </h2>
            <span className="text-[11px] text-slate-400">Site Notes & Safety Precautions</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Inspection Remark & Notes
            </label>
            <textarea
              rows={3}
              value={remark}
              onChange={e => setRemark(e.target.value)}
              placeholder="e.g. Ground soil is firm, no overhead electrical lines, nighttime vehicle entry only between 11 PM and 5 AM. Client requests galvanized pipes."
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Include ground conditions, access restrictions, crane positioning, and special requests.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
          <Link
            href="/projects"
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition text-center min-h-[42px] flex items-center justify-center"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || success}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-950/20 transition cursor-pointer min-h-[42px]"
          >
            {loading ? (
              <span>Saving Site Form...</span>
            ) : success ? (
              <>
                <Check className="w-4 h-4" />
                <span>Submitted!</span>
              </>
            ) : (
              <>
                <Building2 className="w-4 h-4" />
                <span>Submit Site Form</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
