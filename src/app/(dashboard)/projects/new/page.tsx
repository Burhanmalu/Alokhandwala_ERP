'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Building2, 
  Ruler, 
  Camera, 
  FileText, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  Trash2,
  UploadCloud,
  FolderKanban,
  Loader2,
  Sparkles,
  Check,
  ImageIcon
} from 'lucide-react';
import { Customer, UserProfile } from '@/lib/schema';
import { processAndUploadImage } from '@/lib/image-utils';

export default function NewSiteInspectionPage() {
  const router = useRouter();
  const { currentUser } = useAuth();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [supervisors, setSupervisors] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State - Clean initial state without default mock values
  const [customerId, setCustomerId] = useState('');
  const [siteName, setSiteName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [assignedSupervisorId, setAssignedSupervisorId] = useState('');
  const [length, setLength] = useState<number | ''>('');
  const [width, setWidth] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  const [unit, setUnit] = useState<'METERS' | 'FEET'>('METERS');
  const [measurementType, setMeasurementType] = useState<string>('FAÇADE_SCAFFOLD');
  const [siteRemarks, setSiteRemarks] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [customPhotoInput, setCustomPhotoInput] = useState('');

  // Fast Customer Creation Modal
  const [newCustModalOpen, setNewCustModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustContact, setNewCustContact] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');

  useEffect(() => {
    // Load customers
    fetch('/api/customers')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setCustomers(json.data);
        }
      });
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'WORKER') {
      router.replace('/projects?denied=inspection_create');
    }
  }, [currentUser, router]);

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAddPhoto = () => {
    let url = customPhotoInput.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && !url.startsWith('data:') && !url.startsWith('/')) {
      url = `https://${url}`;
    }
    if (!photoUrls.includes(url)) {
      setPhotoUrls([...photoUrls, url]);
    }
    setCustomPhotoInput('');
  };

  const handleFiles = async (files: FileList | File[]) => {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (valid.length === 0) return;

    setIsUploadingPhoto(true);
    try {
      const urls = await Promise.all(valid.map(f => processAndUploadImage(f)));
      setPhotoUrls(prev => [...prev, ...urls.filter(u => Boolean(u) && !prev.includes(u))]);
    } catch (err) {
      console.error('Error uploading photo:', err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoUrls(photoUrls.filter((_, i) => i !== index));
  };

  const handleCreateFastCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) {
      alert('Company Name and Phone are required');
      return;
    }
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: newCustName,
          contactPerson: newCustContact || newCustName,
          phone: newCustPhone,
          email: newCustEmail || 'billing@client.com',
          billingAddress: newCustAddress || 'Mumbai, Maharashtra',
          city: 'Mumbai',
          state: 'Maharashtra',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCustomers([json.data, ...customers]);
        setCustomerId(json.data.id);
        setNewCustModalOpen(false);
        setNewCustName('');
        setNewCustContact('');
        setNewCustPhone('');
      } else {
        alert(json.error || 'Failed to create customer');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerId) {
      setError('Please select or create a customer.');
      return;
    }
    if (!siteName.trim()) {
      setError('Site Name is required.');
      return;
    }
    if (!siteAddress.trim()) {
      setError('Site Address is required.');
      return;
    }
    if (!length || !width || !height) {
      setError('Length, width, and height dimensions are required.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          siteName: siteName.trim(),
          siteAddress: siteAddress.trim(),
          landmark: landmark.trim(),
          city: 'Mumbai',
          state: 'Maharashtra',
          contactPerson: contactPerson.trim(),
          contactPhone: contactPhone.trim(),
          assignedSupervisorId,
          length: Number(length),
          width: Number(width),
          height: Number(height),
          unit,
          measurementType,
          siteRemarks: siteRemarks.trim(),
          photoUrls,
          actorId: currentUser.id,
          actorName: currentUser.fullName,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to submit site inspection');
      }

      // Redirect directly to the newly created project workspace
      router.push(`/projects/${json.data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/projects" className="hover:text-emerald-700 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Projects Directory</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800">New Site Inspection</span>
      </div>

      {/* Page Title */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Ruler className="w-5 h-5 text-emerald-600" />
            <span>Site Inspection & Project Creation</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Record physical site dimensions, upload before-installation photographs, and generate an initial NOT_INSTALLED project record.
          </p>
        </div>
        <div className="hidden sm:block text-right">
          <div className="text-[10px] uppercase font-bold text-slate-400">Recorded By</div>
          <div className="text-xs font-semibold text-slate-800">{currentUser.fullName}</div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Inspection Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer & Site Details Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>1. Customer & Site Location</span>
            </h2>
            <button
              type="button"
              onClick={() => setNewCustModalOpen(true)}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Customer</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Customer Dropdown */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Select Customer <span className="text-red-500">*</span>
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} ({c.customerCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Site Name */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Site / Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Godrej Sky Greens BKC Tower 1"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            {/* Site Address */}
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Site Address & Access Road Details <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                placeholder="Plot/Building number, street, landmark, road width for scaffolding transport trucks..."
                value={siteAddress}
                onChange={(e) => setSiteAddress(e.target.value)}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>



            {/* Contact Person & Phone */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Site Contact Person</label>
              <input
                type="text"
                placeholder="e.g. Mahesh Jadhav (Site Engineer)"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Site Contact Phone</label>
              <input
                type="tel"
                placeholder="e.g. +91 98200 12345"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Physical Measurements Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Ruler className="w-4 h-4 text-emerald-600" />
              <span>2. Scaffolding Measurements & Staging Type</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Length <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 35.0"
                value={length}
                onChange={(e) => setLength(e.target.value === '' ? '' : Number(e.target.value))}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Width <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 12.0"
                value={width}
                onChange={(e) => setWidth(e.target.value === '' ? '' : Number(e.target.value))}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Height <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 28.5"
                value={height}
                onChange={(e) => setHeight(e.target.value === '' ? '' : Number(e.target.value))}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Unit of Measure</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as any)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none font-medium"
              >
                <option value="METERS">Meters (m)</option>
                <option value="FEET">Feet (ft)</option>
              </select>
            </div>

            <div className="col-span-2 md:col-span-4">
              <label className="block font-semibold text-slate-700 mb-1">Scaffolding Staging Type</label>
              <select
                value={measurementType}
                onChange={(e) => setMeasurementType(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none font-medium"
              >
                <option value="FAÇADE_SCAFFOLD">Façade Scaffold (External Access / Painting / Cladding)</option>
                <option value="CUP_LOCK_SYSTEM">Cuplock System (Heavy Duty Structural Shoring)</option>
                <option value="TOWER_SCAFFOLD">Free-Standing Mobile / Static Tower Scaffold</option>
                <option value="HEAVY_DUTY_SHORING">Heavy Duty Bridge / Slab Shoring</option>
                <option value="SUSPENDED_CRADLE">Suspended Cradle / Temporary Roof Support</option>
              </select>
            </div>

            <div className="col-span-2 md:col-span-4">
              <label className="block font-semibold text-slate-700 mb-1">Inspection Remarks & Site Constraints</label>
              <textarea
                rows={2}
                placeholder="Ground stability, overhead high tension cables, tie-in anchors requirement, access restrictions..."
                value={siteRemarks}
                onChange={(e) => setSiteRemarks(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            {/* Live Billable Area & Commercial Quotation Preview */}
            {length && height ? (() => {
              const lFt = unit === 'METERS' ? Number(length) * 3.28084 : Number(length);
              const hFt = unit === 'METERS' ? Number(height) * 3.28084 : Number(height);
              const areaSqFt = Math.round(lFt * hFt);

              return (
                <div className="col-span-2 md:col-span-4 p-3.5 bg-amber-50/70 border border-amber-200/90 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <span>Term 1: Estimated Billable Façade Area</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full">
                      {areaSqFt} sq. ft. ({Math.round(lFt * 10) / 10}&apos; L × {Math.round(hFt * 10) / 10}&apos; H)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-amber-900 pt-1">
                    <div>• <span className="font-semibold">Pricing Basis:</span> Per sq. ft. actual area (Term 1)</div>
                    <div>• <span className="font-semibold">Rental Cycle:</span> 28 days = 1 month (Term 2)</div>
                    <div>• <span className="font-semibold">Transportation:</span> 2-Way charges extra (Term 3)</div>
                    <div>• <span className="font-semibold">Payment Terms:</span> 75% advance before installation, 25% on completion (Term 7)</div>
                  </div>
                </div>
              );
            })() : null}
          </div>
        </div>

        {/* Site Photographs (Mobile / Field Upload Simulation) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-600" />
              <span>3. Before-Installation Site Photographs</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Securely stored photographic evidence of ground condition and structure before material reservation and dispatch.
            </p>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = '';
            }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {photoUrls.map((url, idx) => (
              <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-200 group bg-slate-900 aspect-video shadow-xs">
                <img src={url} alt={`Inspection Photo ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition duration-300 opacity-90 group-hover:opacity-100" />
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 bg-slate-950/80 text-white text-[10px] rounded backdrop-blur-xs font-mono flex items-center gap-1">
                  <ImageIcon className="w-3 h-3 text-emerald-400" />
                  <span>Photo #{idx + 1}</span>
                </div>
              </div>
            ))}

            {/* Add photo input card */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingPhoto(true); }}
              onDragLeave={() => setIsDraggingPhoto(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingPhoto(false);
                if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
              }}
              className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 aspect-video cursor-pointer transition select-none ${
                isDraggingPhoto
                  ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-400/30'
                  : 'border-slate-300 hover:border-emerald-500 bg-slate-50/80 hover:bg-emerald-50/30'
              }`}
            >
              {isUploadingPhoto ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-6 h-6 text-emerald-600 animate-spin mb-1" />
                  <span className="text-xs font-semibold text-emerald-800">Uploading photo...</span>
                </div>
              ) : (
                <>
                  <UploadCloud className={`w-6 h-6 transition ${isDraggingPhoto ? 'text-emerald-600 scale-110' : 'text-slate-400'}`} />
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Click to Upload Photo</span>
                    <span className="text-[10px] text-slate-400">or drag & drop image</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Photo URL manual input */}
          <div className="pt-2 border-t border-slate-100">

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Or paste photo image URL..."
                value={customPhotoInput}
                onChange={(e) => setCustomPhotoInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPhoto();
                  }
                }}
                className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-emerald-600 transition"
              />
              <button
                type="button"
                onClick={handleAddPhoto}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition"
              >
                Add URL
              </button>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/projects"
            className="px-5 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{loading ? 'Submitting & Creating Project...' : 'Submit Inspection (Set NOT_INSTALLED)'}</span>
          </button>
        </div>
      </form>

      {/* Fast Customer Creation Modal */}
      {newCustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Add New Customer</h3>
            <form onSubmit={handleCreateFastCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company / Client Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Shapoorji Pallonji Real Estate"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  required
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Amitabh Sen"
                  value={newCustContact}
                  onChange={(e) => setNewCustContact(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  placeholder="e.g. +91 98200 99999"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  required
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Billing Address</label>
                <textarea
                  rows={2}
                  placeholder="Billing address in Mumbai / Maharashtra..."
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewCustModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg font-bold"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
