'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Boxes, 
  ReceiptIndianRupee, 
  Trash2, 
  Plus, 
  Building2, 
  Ruler, 
  Camera, 
  Search, 
  ArrowLeft,
  Calendar,
  Layers,
  Check,
  MapPin,
  Phone,
  Compass,
  Clock,
  UploadCloud,
  Loader2,
  Sparkles,
  X,
  Maximize2,
  ImageIcon,
  FileText,
  ShieldAlert
} from 'lucide-react';
import { Material, Project, ScaffoldingMaterialPlanOption } from '@/lib/schema';
import { formatINR, formatDate } from '@/lib/formatters';
import { useAuth } from '@/lib/auth/auth-context';
import { processAndUploadImage } from '@/lib/image-utils';
import { OFFICIAL_TERMS_AND_CONDITIONS, DEFAULT_PAYMENT_TERMS_TEXT, RENTAL_CONSTANTS, BusinessTerm } from '@/lib/constants/terms-and-conditions';
import { SmartMaterialRecommendation } from '@/components/scaffolding/SmartMaterialRecommendation';

export default function ConfirmationFormPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading Confirmation Form...</div>}>
      <ConfirmationFormContent />
    </React.Suspense>
  );
}

function ConfirmationFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProjectId = searchParams.get('projectId');
  const { currentUser } = useAuth();

  const [notInstalledProjects, setNotInstalledProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const [catalogMaterials, setCatalogMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'ADMIN') {
      if (currentUser.role === 'SUPERVISOR') {
        router.replace('/sites/new');
      } else {
        router.replace('/projects');
      }
    }
  }, [currentUser, router]);

  // Confirmation Form Fields - Clean initial state without default mock values
  const [quotationNumber, setQuotationNumber] = useState('');
  const [quotationDate, setQuotationDate] = useState('');
  const [pricingModel, setPricingModel] = useState<'MONTHLY_RENTAL' | 'LUMP_SUM' | 'METRIC_RATE'>('MONTHLY_RENTAL');
  const [agreedProjectPrice, setAgreedProjectPrice] = useState<number>(0);
  const [monthlyRentalRate, setMonthlyRentalRate] = useState<number>(0);
  const [plannedInstallationDate, setPlannedInstallationDate] = useState('');
  const [durationMonths, setDurationMonths] = useState<number>(1);

  // Auto-calculated expected return / rental end date (Term 2: 28 Days per Month)
  const calculatedEndDate = useMemo(() => {
    if (!plannedInstallationDate || !durationMonths) return '';
    try {
      const d = new Date(plannedInstallationDate);
      if (isNaN(d.getTime())) return '';
      // Official Business Term 2: 28 days = 1 rental period
      d.setDate(d.getDate() + Number(durationMonths || 1) * RENTAL_CONSTANTS.RENTAL_DAYS_PER_MONTH);
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  }, [plannedInstallationDate, durationMonths]);

  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [transportCharges, setTransportCharges] = useState<number>(0);
  const [installationLabourCharges, setInstallationLabourCharges] = useState<number>(0);
  const [paymentTerms, setPaymentTerms] = useState(DEFAULT_PAYMENT_TERMS_TEXT);
  const [remarks, setRemarks] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [showAllTerms, setShowAllTerms] = useState(false);

  // Site photo upload inside Confirmation Form
  const [uploadingSitePhoto, setUploadingSitePhoto] = useState(false);
  const [previewSitePhoto, setPreviewSitePhoto] = useState<string | null>(null);
  const [newSitePhotoUrl, setNewSitePhotoUrl] = useState('');
  const sitePhotoInputRef = React.useRef<HTMLInputElement>(null);

  const handleDurationChange = (months: number) => {
    const val = Math.max(1, months);
    setDurationMonths(val);
    if (monthlyRentalRate) {
      setAgreedProjectPrice((monthlyRentalRate || 0) * val);
    }
  };

  // Selected Material Reservations & Smart Recommended Plan
  const [selectedMaterials, setSelectedMaterials] = useState<
    { materialId: string; requiredQuantity: number; monthlyRentalRate: number }[]
  >([]);
  const [selectedPlan, setSelectedPlan] = useState<ScaffoldingMaterialPlanOption | null>(null);
  const [siteDimensions, setSiteDimensions] = useState<any>(null);

  // Billable Area Calculation (Term 1: Façade elevation surface area basis)
  const areaDetails = useMemo(() => {
    const m = selectedProject?.measurements;
    if (!m) return { areaSqFt: 0, lengthFt: 0, heightFt: 0, ratePerSqFt: 0 };
    const lengthFt = m.unit === 'METERS' ? m.length * 3.28084 : m.length;
    const heightFt = m.unit === 'METERS' ? m.height * 3.28084 : m.height;
    const areaSqFt = Math.round(lengthFt * heightFt);
    const ratePerSqFt = areaSqFt > 0 ? (monthlyRentalRate / areaSqFt) : 0;
    return {
      areaSqFt,
      lengthFt: Math.round(lengthFt * 10) / 10,
      heightFt: Math.round(heightFt * 10) / 10,
      ratePerSqFt: Math.round(ratePerSqFt * 100) / 100,
    };
  }, [selectedProject?.measurements, monthlyRentalRate]);

  // Walkway Jali Tracker (Term 4: 1 Jali included per unit, extra @ Rs. 200/pc)
  const jaliDetails = useMemo(() => {
    const jaliItems = selectedMaterials.filter(sm => {
      const mat = catalogMaterials.find(c => c.id === sm.materialId);
      return mat?.itemCode?.startsWith('JALI') || mat?.name?.toLowerCase().includes('jali');
    });
    const totalJali = jaliItems.reduce((sum, item) => sum + item.requiredQuantity, 0);
    const baysCount = selectedPlan?.configurationSummary?.baysCount || Math.ceil((areaDetails.lengthFt || 10) / 8);
    const includedJali = baysCount * RENTAL_CONSTANTS.INCLUDED_WALKWAY_JALI_PER_UNIT;
    const extraJali = Math.max(0, totalJali - includedJali);
    const extraJaliCharge = extraJali * RENTAL_CONSTANTS.EXTRA_WALKWAY_JALI_RATE;
    return {
      totalJali,
      includedJali,
      extraJali,
      extraJaliCharge,
    };
  }, [selectedMaterials, catalogMaterials, selectedPlan, areaDetails]);

  const handlePlanSelected = (
    plan: ScaffoldingMaterialPlanOption, 
    materials: { materialId: string; requiredQuantity: number; monthlyRentalRate: number }[]
  ) => {
    setSelectedPlan(plan);
    setSelectedMaterials(materials);
    setSiteDimensions(plan.configurationSummary.dimensions);
    if (plan.totals.totalMonthlyRental > 0) {
      setMonthlyRentalRate(plan.totals.totalMonthlyRental);
      setAgreedProjectPrice(plan.totals.totalMonthlyRental * (durationMonths || 1));
    }
  };

  const handleAttachSitePhotos = async (filesOrUrls: (File | string)[]) => {
    if (!selectedProject) return;
    setUploadingSitePhoto(true);
    try {
      const urls: string[] = [];
      for (const item of filesOrUrls) {
        if (typeof item === 'string') {
          urls.push(item);
        } else {
          const u = await processAndUploadImage(item);
          if (u) urls.push(u);
        }
      }

      if (urls.length === 0) return;

      const res = await fetch(`/api/projects/${selectedProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addPhotos: urls,
          stageLabel: 'SITE_INSPECTION',
          actorId: currentUser.id,
          actorName: currentUser.fullName,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setSelectedProject(json.data);
        setNotInstalledProjects(prev => prev.map(p => p.id === json.data.id ? json.data : p));
      } else {
        const newAttachments = urls.map((u, i) => ({
          id: `pht-loc-${Date.now()}-${i}`,
          fileUrl: u,
          fileName: `site_inspection_${i + 1}.jpg`,
          stageLabel: 'BEFORE_INSTALLATION' as const,
          entityType: 'SITE_INSPECTION' as const,
          entityId: selectedProject.id,
          fileSizeBytes: 2048000,
          mimeType: 'image/jpeg',
          uploadedBy: currentUser.id,
          uploaderName: currentUser.fullName,
          createdAt: new Date().toISOString(),
        }));
        setSelectedProject((prev: any) => prev ? ({
          ...prev,
          photos: [...(prev.photos || []), ...newAttachments]
        }) : null);
      }
    } catch (err: any) {
      console.error('Error attaching photo:', err);
    } finally {
      setUploadingSitePhoto(false);
    }
  };

  // Auto-fill quotation defaults when a project is chosen
  const applyProjectAutoFill = (project: Project) => {
    setSelectedProject(project);
    setQuotationNumber(`QTN-${project.projectCode}`);
    if (project.siteRemarks) {
      setRemarks(`Site: ${project.siteAddress}. ${project.siteRemarks}`);
    }
    if (project.measurements && project.monthlyRentalRate) {
      setMonthlyRentalRate(project.monthlyRentalRate);
      setAgreedProjectPrice(project.agreedProjectPrice || (project.monthlyRentalRate * (durationMonths || 1)));
    }
  };

  useEffect(() => {
    Promise.all([
      fetch('/api/projects?status=NOT_INSTALLED').then(r => r.json()),
      fetch('/api/inventory').then(r => r.json()),
    ]).then(([projJson, invJson]) => {
      if (projJson.success) {
        const allProjects: Project[] = projJson.data || [];
        // Strictly filter to ONLY NOT_INSTALLED projects
        const unconfirmed = allProjects.filter(p => p.status === 'NOT_INSTALLED');
        setNotInstalledProjects(unconfirmed);

        const targetId = preselectedProjectId || '';
        if (targetId) {
          const match = unconfirmed.find(p => p.id === targetId);
          if (match) {
            setSelectedProjectId(match.id);
            applyProjectAutoFill(match);
          }
        }
      }

      if (invJson.success) {
        const mats: Material[] = invJson.data.materials;
        setCatalogMaterials(mats);
      }
    }).finally(() => setLoading(false));
  }, [preselectedProjectId]);

  const handleSelectProject = (projId: string) => {
    setSelectedProjectId(projId);
    const found = notInstalledProjects.find(p => p.id === projId);
    if (found) {
      applyProjectAutoFill(found);
    } else {
      setSelectedProject(null);
    }
  };

  const handleAddMaterialRow = () => {
    if (catalogMaterials.length === 0) return;
    const firstMat = catalogMaterials[0];
    setSelectedMaterials([
      ...selectedMaterials,
      { materialId: firstMat.id, requiredQuantity: 1, monthlyRentalRate: firstMat.rentalRatePerMonth },
    ]);
  };

  const handleRemoveMaterialRow = (idx: number) => {
    setSelectedMaterials(selectedMaterials.filter((_, i) => i !== idx));
  };

  const handleUpdateMaterial = (idx: number, field: string, val: any) => {
    const updated = [...selectedMaterials];
    if (field === 'materialId') {
      const mat = catalogMaterials.find(m => m.id === val);
      updated[idx].materialId = val;
      if (mat) updated[idx].monthlyRentalRate = mat.rentalRatePerMonth;
    } else if (field === 'requiredQuantity') {
      updated[idx].requiredQuantity = Number(val);
    } else if (field === 'monthlyRentalRate') {
      updated[idx].monthlyRentalRate = Number(val);
    }
    setSelectedMaterials(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProjectId) {
      setError('Please select a project to confirm.');
      return;
    }

    if (selectedMaterials.length === 0) {
      setError('Please select at least one material to reserve.');
      return;
    }

    // Check stock availability
    for (const item of selectedMaterials) {
      const mat = catalogMaterials.find(m => m.id === item.materialId);
      if (mat) {
        const available = mat.usableWarehouseQty - mat.reservedQty;
        if (item.requiredQuantity > available) {
          setError(`Insufficient stock for ${mat.name}. Required: ${item.requiredQuantity}, Available: ${available}.`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotationNumber,
          quotationDate,
          pricingModel,
          agreedProjectPrice: Number(agreedProjectPrice),
          monthlyRentalRate: Number(monthlyRentalRate),
          plannedInstallationDate,
          durationMonths: Number(durationMonths || 1),
          depositAmount: Number(depositAmount),
          transportCharges: Number(transportCharges),
          installationLabourCharges: Number(installationLabourCharges),
          paymentTerms,
          remarks,
          materials: selectedMaterials,
          scaffoldingPlan: selectedPlan,
          siteDimensions: siteDimensions || (selectedProject?.measurements ? {
            length: selectedProject.measurements.length,
            width: selectedProject.measurements.width,
            height: selectedProject.measurements.height,
            unit: selectedProject.measurements.unit,
          } : undefined),
          termsSnapshot: OFFICIAL_TERMS_AND_CONDITIONS,
          ratePerSqFt: areaDetails.ratePerSqFt,
          totalAreaSqFt: areaDetails.areaSqFt,
          extraJaliQuantity: jaliDetails.extraJali,
          extraJaliCharges: jaliDetails.extraJaliCharge,
          twoWayTransportCharges: Number(transportCharges),
          advancePercentage: 75,
          advanceRequiredAmount: Math.round(Number(agreedProjectPrice || 0) * 0.75),
          completionDueAmount: Math.round(Number(agreedProjectPrice || 0) * 0.25),
          actorId: currentUser.id,
          actorName: currentUser.fullName,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to confirm project');
      }

      router.push(`/projects/${selectedProjectId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading Confirmation Form...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/projects" className="hover:text-emerald-700 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Projects Lifecycle</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800">Project Confirmation & Stock Reservation Form</span>
      </div>

      {/* Hero Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
            <span>Project Confirmation Form</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Confirm inspected projects (NOT_INSTALLED status), approve commercial quotations, and transactionally reserve scaffolding stock.
          </p>
        </div>
        <div className="shrink-0 flex items-center">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200/90 whitespace-nowrap shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span>{notInstalledProjects.length} {notInstalledProjects.length === 1 ? 'Project' : 'Projects'} Awaiting Confirmation</span>
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Project Selector Section (Strictly NOT_INSTALLED Projects) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-3">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
            Select Inspected Project (NOT_INSTALLED) *
          </label>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium text-blue-700 bg-blue-50 border border-blue-200 whitespace-nowrap shrink-0">
            {notInstalledProjects.length} Unconfirmed Site{notInstalledProjects.length === 1 ? '' : 's'}
          </span>
        </div>
        {notInstalledProjects.length === 0 ? (
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center space-y-2">
            <p className="font-semibold text-slate-700">No unconfirmed projects currently in NOT_INSTALLED status.</p>
            <p className="text-slate-400">All registered sites have already been confirmed and scheduled for installation.</p>
            <div className="pt-2">
              <Link
                href="/sites/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition"
              >
                <span>+ Register New Site Form</span>
              </Link>
            </div>
          </div>
        ) : (
          <select
            value={selectedProjectId}
            onChange={(e) => handleSelectProject(e.target.value)}
            className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-medium text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden transition"
          >
            <option value="">-- Choose a Not Installed Project to Confirm --</option>
            {notInstalledProjects.map(p => (
              <option key={p.id} value={p.id}>
                {p.projectCode} — {p.customerName} | {p.siteName} (Supervisor: {p.supervisorName})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Auto-Filled Site & Inspection Details (Loaded automatically from Site Form) */}
      {selectedProject && (() => {
        const m = selectedProject.measurements;
        const photosList = (selectedProject.photos || [])
          .map((p: any) => (typeof p === 'string' ? p : p.fileUrl))
          .filter(Boolean);
        const area = (m?.length || 0) * (m?.height || 0);
        const unitLabel = m?.unit === 'METERS' ? 'm' : 'ft';
        const areaLabel = m?.unit === 'METERS' ? 'sq.m' : 'sq.ft';

        return (
          <div className="bg-white p-6 rounded-2xl border border-blue-200/90 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-900 flex flex-wrap items-center gap-2">
                    <span>Auto-Filled Site Information</span>
                    <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-mono font-semibold whitespace-nowrap">
                      {selectedProject.projectCode} • NOT_INSTALLED
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Automatically retrieved from Site Form inspection. All details populated below.
                  </p>
                </div>
              </div>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0">
                <Check className="w-3 h-3 text-emerald-600" />
                <span>Auto-Filled Successfully</span>
              </span>
            </div>

            {/* Grid of Auto-Filled Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {/* 1. Customer Name */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                <div className="text-[10px] uppercase font-bold text-slate-400">Customer Name</div>
                <div className="font-bold text-slate-900 text-sm mt-0.5 truncate">{selectedProject.customerName}</div>
              </div>

              {/* 2. Referral Name */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                <div className="text-[10px] uppercase font-bold text-slate-400">Referral Name</div>
                <div className="font-semibold text-slate-800 text-sm mt-0.5 truncate">
                  {selectedProject.referralName || 'Direct Client'}
                </div>
              </div>

              {/* 3. Supervisor Name */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                <div className="text-[10px] uppercase font-bold text-slate-400">Supervisor Name</div>
                <div className="font-semibold text-slate-800 text-sm mt-0.5 truncate">
                  {selectedProject.supervisorName || 'Mustafa Alokhandwala'}
                </div>
              </div>

              {/* 4. Site Name */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                <div className="text-[10px] uppercase font-bold text-slate-400">Site Location Name</div>
                <div className="font-semibold text-slate-800 text-sm mt-0.5 truncate">
                  {selectedProject.siteName}
                </div>
              </div>

              {/* 5. Address */}
              <div className="sm:col-span-2 md:col-span-3 bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-600" />
                  <span>Site Delivery & Erection Address</span>
                </div>
                <div className="font-medium text-slate-800 mt-0.5">
                  {selectedProject.siteAddress}
                </div>
              </div>

              {/* 6. Size */}
              <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/80">
                <div className="text-[10px] uppercase font-bold text-emerald-800 flex items-center gap-1">
                  <Ruler className="w-3 h-3 text-emerald-700" />
                  <span>Scaffolding Size</span>
                </div>
                <div className="font-mono font-bold text-emerald-950 text-sm mt-0.5">
                  {m ? `${m.length} × ${m.width} × ${m.height} ${unitLabel}` : 'Dimensions Pending'}
                </div>
                <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                  Area: {area} {areaLabel}
                </div>
              </div>
            </div>

            {/* 7. Remark */}
            {selectedProject.siteRemarks && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 text-xs">
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Site Remarks & Conditions</div>
                <div className="text-slate-700 font-medium">{selectedProject.siteRemarks}</div>
              </div>
            )}

            {/* 8. Photo of a Site */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                  <span>Site Inspection Photos ({photosList.length} Photos)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => sitePhotoInputRef.current?.click()}
                    disabled={uploadingSitePhoto}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {uploadingSitePhoto ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3 h-3" />
                        <span>Add Site Photo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Hidden file input */}
              <input
                ref={sitePhotoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleAttachSitePhotos(Array.from(e.target.files));
                  e.target.value = '';
                }}
              />

              {photosList.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {photosList.map((url, idx) => (
                    <div 
                      key={idx} 
                      className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video group shadow-xs cursor-pointer"
                      onClick={() => setPreviewSitePhoto(url)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Site photo ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition duration-300 opacity-90 group-hover:opacity-100" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <span className="p-1 bg-black/60 rounded-full text-white shadow-xs">
                          <Maximize2 className="w-3.5 h-3.5" />
                        </span>
                      </div>
                      <div className="absolute bottom-1 left-1.5 bg-black/70 px-1.5 py-0.5 rounded text-[9px] text-white font-mono flex items-center gap-1">
                        <ImageIcon className="w-2.5 h-2.5 text-blue-400" />
                        <span>Site Photo #{idx + 1}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  onClick={() => sitePhotoInputRef.current?.click()}
                  className="p-6 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl text-center bg-slate-50/70 hover:bg-blue-50/30 cursor-pointer transition select-none"
                >
                  <UploadCloud className="w-7 h-7 text-slate-400 mx-auto mb-1.5" />
                  <div className="text-xs font-bold text-slate-700">No site inspection photographs attached yet</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Click here to upload on-site inspection photos</div>
                </div>
              )}

              {/* Photo URL manual input */}
              <div className="mt-3 pt-2.5 border-t border-slate-100">

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSitePhotoUrl}
                    onChange={(e) => setNewSitePhotoUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newSitePhotoUrl.trim()) {
                          handleAttachSitePhotos([newSitePhotoUrl.trim()]);
                          setNewSitePhotoUrl('');
                        }
                      }
                    }}
                    placeholder="Or paste photo image URL..."
                    className="flex-1 text-xs px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newSitePhotoUrl.trim()) {
                        handleAttachSitePhotos([newSitePhotoUrl.trim()]);
                        setNewSitePhotoUrl('');
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition cursor-pointer"
                  >
                    Add URL
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirmation Form */}
      {selectedProject && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Commercial & Contract Terms */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ReceiptIndianRupee className="w-4 h-4 text-emerald-600" />
                <span>1. Approved Quotation & Commercial Rental Terms</span>
              </h2>
              <span className="text-[11px] text-slate-500">Installation Date & Rental Duration Schedule</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quotation Number *</label>
                <input
                  type="text"
                  value={quotationNumber}
                  onChange={(e) => setQuotationNumber(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quotation Date *</label>
                <input
                  type="date"
                  value={quotationDate}
                  onChange={(e) => setQuotationDate(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Installation Date */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Installation Date *</span>
                </label>
                <input
                  type="date"
                  value={plannedInstallationDate}
                  onChange={(e) => setPlannedInstallationDate(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Rental Duration */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Rental Duration *</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={durationMonths}
                    onChange={(e) => handleDurationChange(Number(e.target.value))}
                    className="w-20 p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-center text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-900"
                  />
                  <span className="text-slate-700 font-semibold text-xs">
                    Month{durationMonths > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Duration Buttons (1 Month, 2 Months, 3 Months, 6 Months, 12 Months) */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="text-[11px] text-slate-500 font-semibold">Quick Select Duration:</span>
              {[1, 2, 3, 6, 12].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleDurationChange(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    durationMonths === m
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {m} Month{m > 1 ? 's' : ''}
                </button>
              ))}
            </div>

            {/* Rental Timeline & Period Subtotal Banner */}
            <div className="bg-gradient-to-r from-blue-50 via-slate-50 to-emerald-50 p-4 rounded-xl border border-blue-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Installation Date</div>
                  <div className="font-mono font-bold text-slate-900 text-xs">
                    {plannedInstallationDate ? formatDate(plannedInstallationDate) : 'Not Set'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 font-bold shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Duration & Expected Return</div>
                  <div className="font-mono font-bold text-slate-900 text-xs">
                    {durationMonths} Month{durationMonths > 1 ? 's' : ''} → {calculatedEndDate ? formatDate(calculatedEndDate) : '—'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 sm:border-l sm:border-slate-200 sm:pl-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                  <ReceiptIndianRupee className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Duration Rental Total</div>
                  <div className="font-mono font-bold text-emerald-700 text-xs">
                    ₹{formatINR((monthlyRentalRate || 0) * (durationMonths || 1), false)}
                    <span className="text-[10px] text-slate-400 font-sans font-normal ml-1">
                      (@ ₹{formatINR(monthlyRentalRate, false)}/mo)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Fields & Commercial Terms Alignment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs pt-1">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Monthly Rental Amount (INR) *
                  <span className="text-[10px] text-blue-600 block font-normal">Term 2: Quoted per 28-day cycle</span>
                </label>
                <input
                  type="number"
                  value={monthlyRentalRate}
                  onChange={(e) => {
                    const rate = Number(e.target.value);
                    setMonthlyRentalRate(rate);
                    setAgreedProjectPrice(rate * (durationMonths || 1) + (transportCharges * 2) + jaliDetails.extraJaliCharge);
                  }}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-emerald-800 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Transportation (Per Way INR)
                  <span className="text-[10px] text-amber-600 block font-normal">Term 3: Charged 2-way (Delivery + Return)</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={transportCharges}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setTransportCharges(val);
                      setAgreedProjectPrice((monthlyRentalRate * (durationMonths || 1)) + (val * 2) + jaliDetails.extraJaliCharge);
                    }}
                    placeholder="0"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  {transportCharges > 0 && (
                    <div className="text-[10px] text-slate-500 mt-1">
                      2-way Total: <span className="font-semibold text-slate-800">₹{formatINR(transportCharges * 2, false)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Total Agreed Project Price (INR)
                  <span className="text-[10px] text-slate-500 block font-normal">Rental + Transport + Extras</span>
                </label>
                <input
                  type="number"
                  value={agreedProjectPrice}
                  onChange={(e) => setAgreedProjectPrice(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Area Pricing & Walkway Jali Commercial Cards */}
              <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Term 1: Area Details */}
                <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Term 1: Area-Based Pricing</span>
                    </div>
                    <div className="text-xs text-amber-900 mt-0.5">
                      Façade Area: <span className="font-bold">{areaDetails.areaSqFt} sq. ft.</span>
                      {areaDetails.lengthFt > 0 && (
                        <span className="text-amber-700 font-normal"> ({areaDetails.lengthFt}&apos; L × {areaDetails.heightFt}&apos; H)</span>
                      )}
                    </div>
                    <div className="text-[11px] text-amber-700 mt-0.5">
                      Effective Rate: <span className="font-semibold">₹{areaDetails.ratePerSqFt}/sq. ft.</span> per 28 days
                    </div>
                  </div>
                  <div className="text-[10px] text-right text-amber-600 bg-amber-100/70 px-2 py-1 rounded-md">
                    Actual site area measured at installation
                  </div>
                </div>

                {/* Term 4: Walkway Jali Tracker */}
                <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-xl flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Term 4: Walkway Jali Allowance</span>
                    </div>
                    <div className="text-xs text-blue-900 mt-0.5">
                      Total Jali: <span className="font-bold">{jaliDetails.totalJali} pcs</span> | Included: <span className="font-semibold text-emerald-700">{jaliDetails.includedJali} pcs (1/unit)</span>
                    </div>
                    <div className="text-[11px] text-blue-700 mt-0.5">
                      Extra Jali: <span className="font-semibold">{jaliDetails.extraJali} pcs</span> → <span className="font-bold text-blue-900">+₹{formatINR(jaliDetails.extraJaliCharge, false)}</span> (@ ₹200/pc)
                    </div>
                  </div>
                  <div className="text-[10px] text-right text-blue-600 bg-blue-100/70 px-2 py-1 rounded-md">
                    1 Jali/unit included
                  </div>
                </div>
              </div>

              {/* Term 7 & 8: Payment Terms & Advance Split */}
              <div className="sm:col-span-2 lg:col-span-3 p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/90 rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-emerald-200/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                      Term 7 & 8: Payment Schedule Breakdown
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                    75% Advance / 25% On Completion
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-xs">
                  <div className="bg-white/80 p-3 rounded-lg border border-emerald-100 shadow-2xs">
                    <div className="text-[10px] text-slate-500 font-medium uppercase">Advance Required (75%)</div>
                    <div className="text-sm font-bold text-emerald-700 font-mono mt-0.5">
                      ₹{formatINR(Math.round((agreedProjectPrice || 0) * 0.75), false)}
                    </div>
                    <div className="text-[10px] text-emerald-600 mt-1">Must be received before site installation</div>
                  </div>
                  <div className="bg-white/80 p-3 rounded-lg border border-teal-100 shadow-2xs">
                    <div className="text-[10px] text-slate-500 font-medium uppercase">Installation Balance (25%)</div>
                    <div className="text-sm font-bold text-teal-700 font-mono mt-0.5">
                      ₹{formatINR(Math.round((agreedProjectPrice || 0) * 0.25), false)}
                    </div>
                    <div className="text-[10px] text-teal-600 mt-1">Payable immediately after installation completion</div>
                  </div>
                  <div className="bg-white/80 p-3 rounded-lg border border-blue-100 shadow-2xs">
                    <div className="text-[10px] text-slate-500 font-medium uppercase">Extension Billing Due</div>
                    <div className="text-xs font-bold text-blue-900 font-mono mt-0.5">
                      Next day after 28 days
                    </div>
                    <div className="text-[10px] text-blue-600 mt-1">Term 8: Next-day billing for each 28-day cycle</div>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block font-semibold text-slate-700 mb-1">Commercial & Credit Remarks</label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="Official Terms 1-11 apply as standardized"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Official 11 Terms & Conditions Review Card */}
            <div className="mt-4 border border-amber-200/80 rounded-xl bg-amber-50/30 overflow-hidden text-xs">
              <div 
                className="p-3.5 bg-amber-100/60 border-b border-amber-200 flex items-center justify-between cursor-pointer select-none"
                onClick={() => setShowAllTerms(!showAllTerms)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-900 flex items-center justify-center font-bold text-xs">
                    §
                  </div>
                  <div>
                    <span className="font-bold text-amber-950">Official Business Terms & Conditions (11 Clauses)</span>
                    <span className="text-[10px] text-amber-700 ml-2 font-normal">Applicable across quotation, confirmation & invoice</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-amber-900 hover:text-amber-950 underline cursor-pointer"
                >
                  {showAllTerms ? 'Collapse Terms ▲' : 'Review All 11 Terms ▼'}
                </button>
              </div>

              {showAllTerms && (
                <div className="p-4 bg-white/95 space-y-3 max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {OFFICIAL_TERMS_AND_CONDITIONS.map((term) => (
                    <div key={term.id} className="pt-2.5 first:pt-0">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                          {term.id}
                        </span>
                        <span className="font-bold text-slate-800 text-xs">{term.title}</span>
                        <span className="text-[10px] text-slate-400 uppercase font-mono ml-auto">{term.category}</span>
                      </div>
                      <p className="text-slate-600 text-xs mt-1 leading-relaxed pl-7">{term.content}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 bg-amber-50/90 border-t border-amber-200/60 flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="acceptTermsConfirmation"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                />
                <label htmlFor="acceptTermsConfirmation" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Customer has been informed of and agrees to all <span className="font-bold text-slate-900">11 Official Terms & Conditions</span> (Pricing per sq. ft., 28-day rental, 75% advance, 2-way transport, walkway Jali rules & delivery challan responsibility).
                </label>
              </div>
            </div>
          </div>

          {/* Smart Scaffolding Material Requirements & Stock Reservation */}
          <SmartMaterialRecommendation
            initialDimensions={selectedProject?.measurements ? {
              length: selectedProject.measurements.length,
              width: selectedProject.measurements.width,
              height: selectedProject.measurements.height,
              unit: selectedProject.measurements.unit,
            } : undefined}
            catalogMaterials={catalogMaterials}
            onPlanSelected={handlePlanSelected}
            onMaterialsChange={(mats) => setSelectedMaterials(mats)}
          />

          {/* Submit Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-3">
            <Link
              href="/projects"
              className="px-5 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition text-center min-h-[42px] flex items-center justify-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition flex items-center justify-center gap-2 min-h-[42px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Reserving Stock...' : 'Confirm Project & Reserve Materials'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Lightbox / Preview Modal for Confirmation */}
      {previewSitePhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewSitePhoto(null)}
        >
          <div 
            className="relative max-w-3xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-white text-xs">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-400" />
                <span className="font-semibold">Site Inspection Photo Preview</span>
              </div>
              <button 
                type="button"
                onClick={() => setPreviewSitePhoto(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-hidden flex items-center justify-center bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewSitePhoto} alt="Site Photo Preview" className="max-w-full max-h-[75vh] object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
