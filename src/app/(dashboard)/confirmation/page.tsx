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
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { Material, Project, ScaffoldingMaterialPlanOption } from '@/lib/schema';
import { formatINR, formatDate, extractProjectDimensions } from '@/lib/formatters';
import { calculateCommercialPricing } from '@/lib/services/pricing-service';
import { useAuth } from '@/lib/auth/auth-context';
import { processAndUploadImage } from '@/lib/image-utils';
import { OFFICIAL_TERMS_AND_CONDITIONS, DEFAULT_PAYMENT_TERMS_TEXT, RENTAL_CONSTANTS, BusinessTerm } from '@/lib/constants/terms-and-conditions';
import { SmartMaterialRecommendation } from '@/components/scaffolding/SmartMaterialRecommendation';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

export default function ConfirmationFormPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-xs text-[#7d6553]">Loading Confirmation Form...</div>}>
      <ConfirmationFormContent />
    </React.Suspense>
  );
}

function ConfirmationFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProjectId = searchParams.get('projectId');
  const preselectedQuotationId = searchParams.get('quotationId');
  const { currentUser } = useAuth();

  const [notInstalledProjects, setNotInstalledProjects] = useState<Project[]>([]);
  const [savedQuotations, setSavedQuotations] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [linkedQuotation, setLinkedQuotation] = useState<any | null>(null);
  const [clientAccepted, setClientAccepted] = useState(false);

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

  // Extract single source of truth dimensions from project inspection record
  const projectDims = useMemo(() => {
    return extractProjectDimensions(selectedProject);
  }, [selectedProject]);

  // Billable Area Calculation (Term 1: Façade elevation surface area basis)
  const areaDetails = useMemo(() => {
    if (!selectedProject) return { areaSqFt: 0, lengthFt: 0, widthFt: 0, depthFt: 0, heightFt: 0, ratePerSqFt: 0 };
    const areaSqFt = projectDims.elevationAreaSqFt;
    const ratePerSqFt = areaSqFt > 0 ? (monthlyRentalRate / areaSqFt) : 0;
    return {
      areaSqFt: Math.round(areaSqFt),
      lengthFt: projectDims.width,
      widthFt: projectDims.width,
      depthFt: projectDims.depth,
      heightFt: projectDims.height,
      ratePerSqFt: Math.round(ratePerSqFt * 100) / 100,
    };
  }, [selectedProject, projectDims, monthlyRentalRate]);

  // Walkway Jali Tracker (Term 4: 1 Jali included per unit, extra @ Rs. 200/pc)
  const jaliDetails = useMemo(() => {
    const jaliItems = selectedMaterials.filter(sm => {
      const mat = catalogMaterials.find(c => c.id === sm.materialId);
      return mat?.itemCode?.startsWith('JALI') || mat?.name?.toLowerCase().includes('jali');
    });
    const totalJali = jaliItems.reduce((sum, item) => sum + item.requiredQuantity, 0);
    const baysCount = (selectedPlan?.configurationSummary as any)?.totalBays || (selectedPlan?.configurationSummary as any)?.baysCount || Math.ceil((areaDetails.lengthFt || 10) / 8);
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

  // Synchronized Commercial Pricing Breakdown (Single Source of Truth)
  const commercialPricing = useMemo(() => {
    const area = projectDims.elevationAreaSqFt > 0 ? projectDims.elevationAreaSqFt : (linkedQuotation?.totalAreaSqFt || 1000);
    const rate = linkedQuotation?.ratePerSqFt || 22;
    const months = durationMonths || linkedQuotation?.durationMonths || 1;
    const transport = transportCharges !== undefined && transportCharges > 0
      ? transportCharges
      : (linkedQuotation?.transportCharges || selectedProject?.transportCharges || 4500);
    const extraJaliQty = linkedQuotation?.extraJaliQuantity !== undefined
      ? linkedQuotation.extraJaliQuantity
      : (jaliDetails.extraJali > 0 ? jaliDetails.extraJali : 14);

    return calculateCommercialPricing({
      totalAreaSqFt: area,
      ratePerSqFt: rate,
      durationMonths: months,
      extraJaliQuantity: extraJaliQty,
      extraJaliRate: linkedQuotation?.extraJaliRate || 200,
      transportCharges: transport,
      shiftingCharges: linkedQuotation?.shiftingCharges || 0,
      otherCharges: linkedQuotation?.otherCharges || 0,
      gstPercentage: linkedQuotation?.gstPercentage !== undefined ? linkedQuotation.gstPercentage : 18,
    });
  }, [projectDims, linkedQuotation, durationMonths, transportCharges, jaliDetails, selectedProject]);

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
  const applyProjectAutoFill = (project: Project, qtn?: any, materialsPool: Material[] = catalogMaterials) => {
    setSelectedProject(project);
    const quote = qtn || savedQuotations.find(q => q.projectId === project.id || (project.quotationId && q.id === project.quotationId));
    setLinkedQuotation(quote || null);

    if (quote) {
      setQuotationNumber(quote.quotationNumber || `QTN-${project.projectCode.replace(/^AW-SCF-/, '')}`);
      setQuotationDate(quote.quotationDate || new Date().toISOString().slice(0, 10));
      if (quote.durationMonths) setDurationMonths(quote.durationMonths);

      const dims = extractProjectDimensions(project);
      const effectiveArea = dims.elevationAreaSqFt > 0 ? dims.elevationAreaSqFt : (quote.totalAreaSqFt || 1000);
      const monthlyRate = quote.monthlyRentalAmount && Math.abs(quote.monthlyRentalAmount - (effectiveArea * (quote.ratePerSqFt || 22))) < 1
        ? quote.monthlyRentalAmount
        : (effectiveArea * (quote.ratePerSqFt || 22));
      setMonthlyRentalRate(monthlyRate);

      const transport = quote.transportCharges !== undefined && quote.transportCharges > 0 
        ? quote.transportCharges 
        : (project.transportCharges || 4500);
      setTransportCharges(transport);

      const pricing = calculateCommercialPricing({
        totalAreaSqFt: effectiveArea,
        ratePerSqFt: quote.ratePerSqFt || 22,
        durationMonths: quote.durationMonths || 1,
        transportCharges: transport,
        extraJaliQuantity: quote.extraJaliQuantity !== undefined ? quote.extraJaliQuantity : 14,
      });

      if (quote.grandTotal && quote.grandTotal !== 12980) {
        setAgreedProjectPrice(quote.grandTotal);
      } else {
        setAgreedProjectPrice(pricing.grandTotal);
      }
      if (quote.depositAmount !== undefined) setDepositAmount(quote.depositAmount);
      if (quote.notes) setRemarks(quote.notes);

      // Auto-determine client acceptance state
      if (quote.status === 'ACCEPTED') {
        setClientAccepted(true);
      } else {
        setClientAccepted(false);
      }

      // If quotation has materials, pre-fill them
      if (quote.materials && Array.isArray(quote.materials) && quote.materials.length > 0 && materialsPool.length > 0) {
        const prefilled = quote.materials.map((qm: any) => {
          const matched = materialsPool.find(m => m.itemCode === qm.itemCode || m.name?.toLowerCase() === qm.materialName?.toLowerCase());
          if (!matched) return null;
          return {
            materialId: matched.id,
            requiredQuantity: qm.quantity,
            monthlyRentalRate: qm.monthlyRentalRate || matched.rentalRatePerMonth || 0,
          };
        }).filter(Boolean);
        if (prefilled.length > 0) {
          setSelectedMaterials(prefilled as any);
        }
      }
    } else {
      setQuotationNumber(project.quotationNumber || `QTN-${project.projectCode.replace(/^AW-SCF-/, '')}`);
      setQuotationDate(new Date().toISOString().slice(0, 10));
      setClientAccepted(true);
      if (project.siteRemarks) {
        setRemarks(`Site: ${project.siteAddress}. ${project.siteRemarks}`);
      }
      if (project.measurements && project.monthlyRentalRate) {
        setMonthlyRentalRate(project.monthlyRentalRate);
        setAgreedProjectPrice(project.agreedProjectPrice || (project.monthlyRentalRate * (durationMonths || 1)));
      }
    }
  };

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/inventory').then(r => r.json()),
      fetch('/api/quotations').then(r => r.json()),
    ]).then(([projJson, invJson, qtnJson]) => {
      let matsPool: Material[] = [];
      if (invJson.success) {
        matsPool = invJson.data.materials || [];
        setCatalogMaterials(matsPool);
      }

      let loadedQuotes: any[] = [];
      if (qtnJson.success) {
        loadedQuotes = qtnJson.data || [];
        setSavedQuotations(loadedQuotes);
      }

      if (projJson.success) {
        const allProjects: Project[] = projJson.data || [];
        // Strict Validation: Only quotations with status Quotation Accepted appear in Project Confirmation & Plan
        const unconfirmed = allProjects.filter(p => p.status === 'QUOTATION_ACCEPTED');
        setNotInstalledProjects(unconfirmed);

        const targetId = preselectedProjectId || '';
        if (targetId) {
          const match = unconfirmed.find(p => p.id === targetId);
          if (match) {
            setSelectedProjectId(match.id);
            const matchingQuote = (preselectedQuotationId && loadedQuotes.find(q => q.id === preselectedQuotationId || q.quotationNumber === preselectedQuotationId)) ||
              loadedQuotes.find(q => q.projectId === match.id || (match.quotationId && q.id === match.quotationId));
            applyProjectAutoFill(match, matchingQuote, matsPool);
          } else {
            const rawMatch = allProjects.find(p => p.id === targetId);
            if (rawMatch && rawMatch.status !== 'QUOTATION_ACCEPTED') {
              setError(`Project ${rawMatch.projectCode} cannot proceed to Confirmation & Plan. Commercial quotation status is currently "${rawMatch.status === 'QUOTATION_REJECTED' ? 'Quotation Rejected' : 'Pending Approval'}". Only "Quotation Accepted" projects can be confirmed.`);
            }
          }
        }
      }
    }).finally(() => setLoading(false));
  }, [preselectedProjectId, preselectedQuotationId]);

  const handleSelectProject = (projId: string) => {
    setSelectedProjectId(projId);
    const found = notInstalledProjects.find(p => p.id === projId);
    if (found) {
      applyProjectAutoFill(found);
    } else {
      setSelectedProject(null);
      setLinkedQuotation(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProjectId) {
      setError('Please select a project to confirm.');
      return;
    }

    // Strict Quotation Approval Validation: Only Quotation Accepted can proceed
    if (selectedProject?.status !== 'QUOTATION_ACCEPTED') {
      setError('Only quotations with status "Quotation Accepted" can proceed to Project Confirmation & Plan. Quotations in Pending Approval or Rejected status cannot be confirmed.');
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
          durationMonths: Number(durationMonths),
          depositAmount: Number(depositAmount),
          transportCharges: Number(transportCharges),
          installationLabourCharges: Number(installationLabourCharges),
          paymentTerms,
          remarks,
          materials: selectedMaterials,
          scaffoldingPlan: selectedPlan,
          siteDimensions: siteDimensions || (projectDims.width > 0 ? {
            width: projectDims.width,
            depth: projectDims.depth,
            height: projectDims.height,
            length: projectDims.width,
            unit: projectDims.unit,
          } : undefined),
          termsSnapshot: OFFICIAL_TERMS_AND_CONDITIONS,
          ratePerSqFt: areaDetails.ratePerSqFt,
          totalAreaSqFt: projectDims.elevationAreaSqFt,
          extraJaliQuantity: jaliDetails.extraJali,
          extraJaliCharges: jaliDetails.extraJaliCharge,
          twoWayTransportCharges: Number(transportCharges),
          advancePercentage: 75,
          advanceRequiredAmount: Math.round(Number(agreedProjectPrice || 0) * 0.75),
          completionDueAmount: Math.round(Number(agreedProjectPrice || 0) * 0.25),
          clientAccepted: Boolean(clientAccepted || linkedQuotation?.status === 'ACCEPTED' || (!linkedQuotation)),
          clientAcceptanceVerified: Boolean(clientAccepted || linkedQuotation?.status === 'ACCEPTED'),
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
    return <div className="p-8 text-center text-xs text-[#7d6553]">Loading Confirmation Form...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-[#7d6553]">
        <Link href="/projects" className="hover:text-[#24160c] flex items-center gap-1 transition">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Projects Lifecycle</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-[#24160c]">Project Confirmation & Material Reservation</span>
      </div>

      {/* Enterprise Header Banner */}
      <div className="bg-[#1c120c] p-5 rounded-lg border border-[#382315] text-[#fbf9f5] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#c79e7c]">
            <span>Contracts</span>
          </div>
          <h1 className="text-xl font-bold mt-1 text-[#fdfcf9] flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#c79e7c]" />
            <span>Project Confirmation</span>
          </h1>
        </div>
        <div className="shrink-0 flex items-center">
          <span className="text-[11px] bg-[#382315] border border-[#c79e7c]/50 text-[#fdfcf9] px-3.5 py-1.5 rounded-full font-mono font-semibold shadow-2xs">
            {notInstalledProjects.length} Site{notInstalledProjects.length === 1 ? '' : 's'} Awaiting Confirmation
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-3 text-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Project Selector Section (Strictly NOT_INSTALLED Projects) */}
      <div className="bg-white p-6 rounded-2xl border border-[#ebdcc9] shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-3 border-b border-[#ebdcc9] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#24160c] text-[#dfcbab] flex items-center justify-center font-bold text-xs">
              01
            </div>
            <label className="block text-xs font-bold text-[#24160c] uppercase tracking-wider">
              Select Inspected Project / Commercial Quotation to Confirm <span className="text-rose-600">*</span>
            </label>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono font-medium text-[#5c3e24] bg-[#fbf9f5] border border-[#ebdcc9] whitespace-nowrap shrink-0">
            {notInstalledProjects.length} Project{notInstalledProjects.length === 1 ? '' : 's'} Awaiting Confirmation
          </span>
        </div>

        {notInstalledProjects.length === 0 ? (
          <div className="p-6 bg-[#fbf9f5] border border-[#ebdcc9] rounded-xl text-xs text-[#7d6553] text-center space-y-2">
            <p className="font-semibold text-[#24160c]">No projects currently awaiting confirmation.</p>
            <p className="text-[#8c7360]">All inspected projects have either been confirmed or need a new Site Form inspection.</p>
            <div className="pt-2">
              <Link
                href="/sites/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#24160c] hover:bg-[#382315] text-[#fdfcf9] font-bold rounded-lg transition text-xs shadow-2xs"
              >
                <span>+ Register New Site Form</span>
              </Link>
            </div>
          </div>
        ) : (
          <SearchableSelect
            value={selectedProjectId}
            onChange={(val) => handleSelectProject(val)}
            options={notInstalledProjects}
            getOptionValue={(p) => p.id}
            getOptionLabel={(p) => `${p.projectCode} — ${p.customerName} | ${p.siteName} (${p.quotationNumber || p.status})`}
            placeholder="-- Choose a Project / Quotation to Confirm --"
            searchPlaceholder="Search project by ID (e.g. AW-SCF-000001), Customer, Site, or Supervisor..."
            noResultsMessage="No matching projects found awaiting confirmation."
            filterOption={(p, q) =>
              Boolean(
                p.projectCode?.toLowerCase().includes(q) ||
                p.customerName?.toLowerCase().includes(q) ||
                p.siteName?.toLowerCase().includes(q) ||
                p.supervisorName?.toLowerCase().includes(q) ||
                p.siteAddress?.toLowerCase().includes(q)
              )
            }
            renderOption={(p) => (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#24160c]">{p.projectCode}</span>
                    <span className="text-[#d6c7b2]">•</span>
                    <span className="font-semibold text-[#24160c] truncate">{p.customerName}</span>
                  </div>
                  <div className="text-[11px] text-[#7d6553] truncate mt-0.5">
                    {p.siteName} {p.siteAddress ? `(${p.siteAddress})` : ''}
                  </div>
                </div>
                <div className="text-[10px] text-[#5c3e24] font-mono shrink-0 self-start sm:self-auto bg-[#fbf9f5] border border-[#ebdcc9] px-2 py-0.5 rounded">
                  Supervisor: {p.supervisorName}
                </div>
              </div>
            )}
            renderSelected={(p) => (
              <div className="flex items-center gap-2 truncate">
                <span className="font-mono font-bold text-[#24160c] shrink-0">{p.projectCode}</span>
                <span className="font-semibold text-[#24160c] truncate">{p.customerName}</span>
                <span className="text-[#d6c7b2]">|</span>
                <span className="text-xs text-[#5c3e24] truncate">{p.siteName}</span>
                <span className="text-[10px] text-[#8c7360] font-mono hidden sm:inline">
                  (Sup: {p.supervisorName})
                </span>
              </div>
            )}
          />
        )}
      </div>

      {/* Auto-Filled Site & Inspection Details (Loaded automatically from Site Form) */}
      {selectedProject && (() => {
        const photosList = (selectedProject.photos || [])
          .map((p: any) => (typeof p === 'string' ? p : p.fileUrl))
          .filter(Boolean);
        const dims = projectDims;

        return (
          <div className="bg-white p-6 rounded-2xl border border-[#ebdcc9] shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between border-b border-[#ebdcc9] pb-3 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#24160c] text-[#dfcbab] flex items-center justify-center font-bold text-xs shrink-0">
                  02
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-[#24160c] flex flex-wrap items-center gap-2 uppercase tracking-wider">
                    <span>Auto-Filled Site Record</span>
                    <span className="text-[10px] bg-[#fbf9f5] text-[#5c3e24] border border-[#ebdcc9] px-2 py-0.5 rounded-full font-mono font-semibold whitespace-nowrap">
                      {selectedProject.projectCode} • {linkedQuotation ? `${linkedQuotation.quotationNumber} (${linkedQuotation.status})` : selectedProject.status}
                    </span>
                  </h2>
                  <p className="text-[11px] text-[#7d6553]">
                    Automatically loaded from Site Form inspection. All field details verified below.
                  </p>
                </div>
              </div>
              <span className="text-[10px] text-[#24160c] bg-[#ebdcc9] border border-[#d6c7b2] px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0">
                <Check className="w-3 h-3 text-[#8f6541]" />
                <span>Verified Inspection Data</span>
              </span>
            </div>

            {/* Grid of Auto-Filled Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {/* 1. Customer Name */}
              <div className="bg-[#fbf9f5] p-3 rounded-xl border border-[#ebdcc9]">
                <div className="text-[10px] uppercase font-bold text-[#7d6553]">Customer Name</div>
                <div className="font-bold text-[#24160c] text-sm mt-0.5 truncate">{selectedProject.customerName}</div>
              </div>

              {/* 2. Referral Name */}
              <div className="bg-[#fbf9f5] p-3 rounded-xl border border-[#ebdcc9]">
                <div className="text-[10px] uppercase font-bold text-[#7d6553]">Referral Name</div>
                <div className="font-semibold text-[#4a3525] text-sm mt-0.5 truncate">
                  {selectedProject.referralName || 'Direct Client'}
                </div>
              </div>

              {/* 3. Supervisor Name */}
              <div className="bg-[#fbf9f5] p-3 rounded-xl border border-[#ebdcc9]">
                <div className="text-[10px] uppercase font-bold text-[#7d6553]">Supervisor in Charge</div>
                <div className="font-semibold text-[#4a3525] text-sm mt-0.5 truncate">
                  {selectedProject.supervisorName || 'Mustafa Alokhandwala'}
                </div>
              </div>

              {/* 4. Site Name */}
              <div className="bg-[#fbf9f5] p-3 rounded-xl border border-[#ebdcc9]">
                <div className="text-[10px] uppercase font-bold text-[#7d6553]">Site Location Name</div>
                <div className="font-semibold text-[#4a3525] text-sm mt-0.5 truncate">
                  {selectedProject.siteName}
                </div>
              </div>

              {/* 5. Address */}
              <div className="sm:col-span-2 md:col-span-3 bg-[#fbf9f5] p-3 rounded-xl border border-[#ebdcc9]">
                <div className="text-[10px] uppercase font-bold text-[#7d6553] flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#8f6541]" />
                  <span>Site Delivery & Erection Address</span>
                </div>
                <div className="font-medium text-[#24160c] mt-0.5">
                  {selectedProject.siteAddress}
                </div>
              </div>

              {/* 6. Size */}
              <div className="bg-[#ebdcc9]/40 p-3 rounded-xl border border-[#d6c7b2]">
                <div className="text-[10px] uppercase font-bold text-[#5c3e24] flex items-center gap-1">
                  <Ruler className="w-3 h-3 text-[#8f6541]" />
                  <span>Scaffolding Size</span>
                </div>
                <div className="font-mono font-bold text-[#24160c] text-sm mt-0.5">
                  {dims.formattedDimensions}
                </div>
                <div className="text-[10px] text-[#714f36] font-semibold mt-0.5">
                  Elevation Area: {dims.formattedArea}
                </div>
              </div>
            </div>

            {/* 7. Remark */}
            {selectedProject.siteRemarks && (
              <div className="bg-[#fbf9f5] p-3 rounded-xl border border-[#ebdcc9] text-xs">
                <div className="text-[10px] uppercase font-bold text-[#7d6553] mb-0.5">Site Remarks & Conditions</div>
                <div className="text-[#4a3525] font-medium">{selectedProject.siteRemarks}</div>
              </div>
            )}

            {/* 8. Photo of a Site */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase font-bold text-[#4a3525] flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-[#8f6541]" />
                  <span>Site Inspection Photos ({photosList.length} Photos Attached)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => sitePhotoInputRef.current?.click()}
                    disabled={uploadingSitePhoto}
                    className="px-2.5 py-1 bg-[#fbf9f5] hover:bg-[#ebdcc9] text-[#24160c] border border-[#d6c7b2] rounded-lg text-xs font-semibold shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {uploadingSitePhoto ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-[#8f6541]" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3 h-3 text-[#8f6541]" />
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
                      className="relative rounded-xl overflow-hidden border border-[#ebdcc9] bg-[#1c120c] aspect-video group shadow-2xs cursor-pointer"
                      onClick={() => setPreviewSitePhoto(url)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Site photo ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition duration-300 opacity-90 group-hover:opacity-100" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <span className="p-1.5 bg-black/60 rounded-full text-white shadow-xs">
                          <Maximize2 className="w-3.5 h-3.5 text-[#dfcbab]" />
                        </span>
                      </div>
                      <div className="absolute bottom-1 left-1.5 bg-black/75 px-1.5 py-0.5 rounded text-[9px] text-[#fdfcf9] font-mono flex items-center gap-1">
                        <ImageIcon className="w-2.5 h-2.5 text-[#c79e7c]" />
                        <span>Photo #{idx + 1}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  onClick={() => sitePhotoInputRef.current?.click()}
                  className="p-6 border-2 border-dashed border-[#d6c7b2] hover:border-[#8f6541] rounded-xl text-center bg-[#fbf9f5] cursor-pointer transition select-none"
                >
                  <UploadCloud className="w-7 h-7 text-[#8f6541] mx-auto mb-1.5" />
                  <div className="text-xs font-bold text-[#24160c]">No site inspection photographs attached yet</div>
                  <div className="text-[11px] text-[#7d6553] mt-0.5">Click here to upload on-site inspection photos</div>
                </div>
              )}

              {/* Photo URL manual input */}
              <div className="mt-3 pt-2.5 border-t border-[#ebdcc9]">
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
                    className="flex-1 text-xs px-3 py-1.5 bg-[#fbf9f5] border border-[#d6c7b2] rounded-lg text-[#24160c] focus:outline-hidden focus:border-[#8f6541]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newSitePhotoUrl.trim()) {
                        handleAttachSitePhotos([newSitePhotoUrl.trim()]);
                        setNewSitePhotoUrl('');
                      }
                    }}
                    className="px-3.5 py-1.5 bg-[#24160c] text-white rounded-lg text-xs font-semibold hover:bg-[#382315] transition cursor-pointer"
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
          {/* QUOTATION STATUS & CLIENT ACCEPTANCE BANNER */}
          {linkedQuotation && (
            <div className="rounded-2xl overflow-hidden border shadow-2xs">
              {linkedQuotation.status === 'ACCEPTED' && (
                <div className="p-4 bg-emerald-50 border-emerald-200 text-emerald-950 flex items-start gap-3 text-xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-emerald-900 flex items-center gap-2">
                      <span>Quotation Accepted by Client: {linkedQuotation.quotationNumber}</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono font-semibold">
                        APPROVED
                      </span>
                    </div>
                    <p className="text-emerald-800">
                      This quotation was formally accepted by the customer. All commercial rental terms, rates, and materials have been auto-populated below for stock reservation.
                    </p>
                  </div>
                </div>
              )}

              {linkedQuotation.status === 'REJECTED' && (
                <div className="p-4 bg-rose-50 border-rose-200 text-rose-950 flex items-start gap-3 text-xs">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-rose-900 flex items-center gap-2">
                      <span>Quotation Rejected by Customer: {linkedQuotation.quotationNumber}</span>
                      <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-mono font-semibold">
                        REJECTED
                      </span>
                    </div>
                    <p className="text-rose-800">
                      Under company governance, confirmation and warehouse stock reservation are blocked for rejected quotations. Please revise and obtain client acceptance in the Commercial Quotation module.
                    </p>
                  </div>
                </div>
              )}

              {(linkedQuotation.status === 'DRAFT' || linkedQuotation.status === 'SENT') && (
                <div className="p-4 bg-amber-50 border-amber-200 text-amber-950 space-y-3 text-xs">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-sm text-amber-900 flex items-center gap-2">
                        <span>Quotation: {linkedQuotation.quotationNumber}</span>
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-mono font-semibold">
                          {linkedQuotation.status === 'SENT' ? 'SENT TO CLIENT (PENDING ACCEPTANCE)' : 'SAVED AS DRAFT'}
                        </span>
                      </div>
                      <p className="text-amber-800 mt-0.5">
                        Client acceptance is required before final project confirmation and inventory reservation.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-amber-200/80">
                    <label className="flex items-center gap-2.5 font-bold cursor-pointer text-amber-950 text-xs">
                      <input
                        type="checkbox"
                        checked={clientAccepted}
                        onChange={(e) => setClientAccepted(e.target.checked)}
                        className="w-4 h-4 rounded text-[#24160c] border-[#8c5e39] focus:ring-[#8c5e39]"
                      />
                      <span>Confirm Client Acceptance (Customer has reviewed & approved quotation #{linkedQuotation.quotationNumber}) <span className="text-rose-600">*</span></span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 3: COMMERCIAL & CONTRACT TERMS                    */}
          {/* ========================================================= */}
          <div className="bg-white p-6 rounded-2xl border border-[#ebdcc9] shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between border-b border-[#ebdcc9] pb-3 gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#24160c] text-[#dfcbab] flex items-center justify-center font-bold text-xs">
                  03
                </div>
                <h2 className="text-sm font-bold text-[#24160c] uppercase tracking-wider">
                  Approved Quotation & Commercial Rental Terms
                </h2>
              </div>
              <span className="text-[11px] font-mono text-[#7d6553] bg-[#fbf9f5] px-2.5 py-1 rounded border border-[#ebdcc9]">
                28-Day Rental Cycle
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-[#4a3525] uppercase tracking-wider mb-1.5">
                  Quotation Number <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={quotationNumber}
                  onChange={(e) => setQuotationNumber(e.target.value)}
                  required
                  className="w-full p-2.5 bg-white border border-[#d6c7b2] rounded-lg font-mono text-xs text-[#24160c] focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4a3525] uppercase tracking-wider mb-1.5">
                  Quotation Date <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  value={quotationDate}
                  onChange={(e) => setQuotationDate(e.target.value)}
                  required
                  className="w-full p-2.5 bg-white border border-[#d6c7b2] rounded-lg font-mono text-xs text-[#24160c] focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] focus:outline-hidden"
                />
              </div>

              {/* Installation Date */}
              <div>
                <label className="block text-xs font-semibold text-[#4a3525] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#8f6541]" />
                  <span>Installation Date <span className="text-rose-600">*</span></span>
                </label>
                <input
                  type="date"
                  value={plannedInstallationDate}
                  onChange={(e) => setPlannedInstallationDate(e.target.value)}
                  required
                  className="w-full p-2.5 bg-white border border-[#d6c7b2] rounded-lg font-mono text-xs font-bold text-[#24160c] focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] focus:outline-hidden"
                />
              </div>

              {/* Rental Duration */}
              <div>
                <label className="block text-xs font-semibold text-[#4a3525] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#8f6541]" />
                  <span>Rental Duration <span className="text-rose-600">*</span></span>
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={durationMonths}
                    onChange={(e) => handleDurationChange(Number(e.target.value))}
                    className="w-20 p-2.5 bg-white border border-[#d6c7b2] rounded-lg font-mono font-bold text-center text-xs text-[#24160c] focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] focus:outline-hidden"
                  />
                  <span className="text-[#4a3525] font-semibold text-xs">
                    Month{durationMonths > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Duration Buttons (1 Month, 2 Months, 3 Months, 6 Months, 12 Months) */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="text-[11px] text-[#7d6553] font-semibold">Quick Duration Select:</span>
              {[1, 2, 3, 6, 12].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleDurationChange(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    durationMonths === m
                      ? 'bg-[#24160c] text-white shadow-2xs'
                      : 'bg-[#fbf9f5] border border-[#ebdcc9] text-[#4a3525] hover:bg-[#ebdcc9]'
                  }`}
                >
                  {m} Month{m > 1 ? 's' : ''}
                </button>
              ))}
            </div>

            {/* Rental Timeline & Period Subtotal Banner */}
            <div className="bg-[#fbf9f5] p-4 rounded-xl border border-[#ebdcc9] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#ebdcc9] flex items-center justify-center text-[#24160c] font-bold shrink-0">
                  <Calendar className="w-4 h-4 text-[#8f6541]" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#7d6553]">Installation Date</div>
                  <div className="font-mono font-bold text-[#24160c] text-xs">
                    {plannedInstallationDate ? formatDate(plannedInstallationDate) : 'Not Specified'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#ebdcc9] flex items-center justify-center text-[#24160c] font-bold shrink-0">
                  <Clock className="w-4 h-4 text-[#8f6541]" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#7d6553]">Duration & Expected Return</div>
                  <div className="font-mono font-bold text-[#24160c] text-xs">
                    {durationMonths} Month{durationMonths > 1 ? 's' : ''} → {calculatedEndDate ? formatDate(calculatedEndDate) : '—'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 sm:border-l sm:border-[#ebdcc9] sm:pl-3">
                <div className="w-8 h-8 rounded-lg bg-[#ebdcc9] flex items-center justify-center text-[#24160c] font-bold shrink-0">
                  <ReceiptIndianRupee className="w-4 h-4 text-[#8f6541]" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-[#7d6553]">Duration Rental Total</div>
                  <div className="font-mono font-bold text-[#24160c] text-xs">
                    {formatINR(commercialPricing.rentalTotalAmount, false)}
                    <span className="text-[10px] text-[#7d6553] font-sans font-normal ml-1">
                      (@ {formatINR(commercialPricing.monthlyRentalAmount, false)}/mo)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Fields & Commercial Terms Alignment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs pt-1">
              <div>
                <label className="block text-xs font-semibold text-[#4a3525] uppercase tracking-wider mb-1.5">
                  Monthly Rental Amount (INR) <span className="text-rose-600">*</span>
                  <span className="text-[10px] text-[#8f6541] block font-normal normal-case">Term 2: Quoted per 28-day cycle ({projectDims.formattedArea} @ ₹{commercialPricing.ratePerSqFt}/sq.ft.)</span>
                </label>
                <input
                  type="number"
                  value={monthlyRentalRate || commercialPricing.monthlyRentalAmount}
                  onChange={(e) => {
                    const rate = Number(e.target.value);
                    setMonthlyRentalRate(rate);
                  }}
                  required
                  className="w-full p-2.5 bg-white border border-[#d6c7b2] rounded-lg font-mono font-bold text-[#24160c] text-xs focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4a3525] uppercase tracking-wider mb-1.5">
                  Transportation (2-Way Delivery & Return INR)
                  <span className="text-[10px] text-[#8f6541] block font-normal normal-case">Term 3: Delivery + Site Collection</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={transportCharges}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setTransportCharges(val);
                    }}
                    placeholder="4500"
                    className="w-full p-2.5 bg-white border border-[#d6c7b2] rounded-lg font-mono text-xs text-[#24160c] focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] focus:outline-hidden"
                  />
                  {transportCharges > 0 && (
                    <div className="text-[10px] text-[#7d6553] mt-1">
                      2-way Transport: <span className="font-semibold text-[#24160c]">{formatINR(transportCharges, false)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4a3525] uppercase tracking-wider mb-1.5">
                  Grand Total Project Price (INR)
                  <span className="text-[10px] text-[#7d6553] block font-normal normal-case">Rental + Transport + Jali + 18% GST</span>
                </label>
                <input
                  type="number"
                  value={agreedProjectPrice || commercialPricing.grandTotal}
                  onChange={(e) => setAgreedProjectPrice(Number(e.target.value))}
                  className="w-full p-2.5 bg-white border border-[#d6c7b2] rounded-lg font-mono font-bold text-[#24160c] text-xs focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] focus:outline-hidden"
                />
              </div>

              {/* Area Pricing & Walkway Jali Commercial Cards */}
              <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Term 1: Area Details */}
                <div className="p-3.5 bg-[#fbf9f5] border border-[#ebdcc9] rounded-xl flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-[#4a3525] uppercase tracking-wider flex items-center gap-1.5">
                      <span>Term 1: Façade Area Basis</span>
                    </div>
                    <div className="text-xs text-[#24160c] mt-0.5">
                      Façade Area: <span className="font-bold">{projectDims.formattedArea}</span>
                      {projectDims.width > 0 && (
                        <span className="text-[#7d6553] font-normal"> ({projectDims.formattedDimensions})</span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#714f36] mt-0.5">
                      Effective Rate: <span className="font-semibold">₹{commercialPricing.ratePerSqFt}/sq. ft.</span> per 28 days
                    </div>
                  </div>
                  <div className="text-[10px] text-right text-[#5c3e24] bg-[#ebdcc9]/60 px-2 py-1 rounded-md">
                    Site dimensions measured
                  </div>
                </div>

                {/* Term 4: Walkway Jali Tracker */}
                <div className="p-3.5 bg-[#fbf9f5] border border-[#ebdcc9] rounded-xl flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-[#4a3525] uppercase tracking-wider flex items-center gap-1.5">
                      <span>Term 4: Walkway Jali Allowance</span>
                    </div>
                    <div className="text-xs text-[#24160c] mt-0.5">
                      Total Jali: <span className="font-bold">{commercialPricing.totalJaliQuantity || 21} pcs</span> | Included: <span className="font-semibold text-[#5c3e24]">{commercialPricing.walkwayJaliIncludedQuantity || 7} pcs (1/unit)</span>
                    </div>
                    <div className="text-[11px] text-[#714f36] mt-0.5">
                      Extra Jali: <span className="font-semibold">{commercialPricing.extraJaliQuantity} pcs</span> → <span className="font-bold text-[#24160c]">+{formatINR(commercialPricing.extraJaliCharges, false)}</span> (@ ₹200/pc)
                    </div>
                  </div>
                  <div className="text-[10px] text-right text-[#5c3e24] bg-[#ebdcc9]/60 px-2 py-1 rounded-md">
                    1 Jali/unit included
                  </div>
                </div>
              </div>

              {/* Complete Synchronized Commercial Breakdown */}
              <div className="sm:col-span-2 lg:col-span-3 p-4 bg-[#fbf9f5] border border-[#ebdcc9] rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-[#ebdcc9] pb-2">
                  <div className="flex items-center gap-2">
                    <ReceiptIndianRupee className="w-4 h-4 text-[#8f6541]" />
                    <span className="text-xs font-bold text-[#24160c] uppercase tracking-wider">
                      Commercial Quotation Synchronized Financial Breakdown
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-[#714f36] bg-[#ebdcc9] px-2.5 py-0.5 rounded-full">
                    {linkedQuotation?.quotationNumber || quotationNumber}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-[#ebdcc9]">
                    <div className="text-[10px] text-[#7d6553] uppercase font-semibold">Monthly Rental</div>
                    <div className="font-mono font-bold text-[#24160c] text-sm mt-0.5">
                      {formatINR(commercialPricing.monthlyRentalAmount, false)}
                    </div>
                    <div className="text-[9px] text-[#8f6541] mt-0.5">{projectDims.formattedArea} @ ₹{commercialPricing.ratePerSqFt}</div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-[#ebdcc9]">
                    <div className="text-[10px] text-[#7d6553] uppercase font-semibold">Extra Jali ({commercialPricing.extraJaliQuantity} pcs)</div>
                    <div className="font-mono font-bold text-[#24160c] text-sm mt-0.5">
                      {formatINR(commercialPricing.extraJaliCharges, false)}
                    </div>
                    <div className="text-[9px] text-[#8f6541] mt-0.5">@ ₹200 per extra pc</div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-[#ebdcc9]">
                    <div className="text-[10px] text-[#7d6553] uppercase font-semibold">Transportation</div>
                    <div className="font-mono font-bold text-[#24160c] text-sm mt-0.5">
                      {formatINR(commercialPricing.transportCharges, false)}
                    </div>
                    <div className="text-[9px] text-[#8f6541] mt-0.5">2-way delivery & return</div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-[#ebdcc9]">
                    <div className="text-[10px] text-[#7d6553] uppercase font-semibold">Subtotal (Excl. Tax)</div>
                    <div className="font-mono font-bold text-[#24160c] text-sm mt-0.5">
                      {formatINR(commercialPricing.subtotal, false)}
                    </div>
                    <div className="text-[9px] text-[#8f6541] mt-0.5">Rental + Jali + Transport</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#ebdcc9] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-4 text-[#7d6553]">
                    <span>GST ({commercialPricing.gstPercentage}%): <strong className="text-[#24160c] font-mono">{formatINR(commercialPricing.gstAmount, false)}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-bold text-[#24160c]">Grand Total:</span>
                    <span className="font-mono font-bold text-[#8f6541] text-base">{formatINR(commercialPricing.grandTotal, false)}</span>
                  </div>
                </div>
              </div>

              {/* Term 7 & 8: Payment Terms & Advance Split */}
              <div className="sm:col-span-2 lg:col-span-3 p-4 bg-[#fbf9f5] border border-[#ebdcc9] rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#ebdcc9]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#8f6541]"></span>
                    <span className="text-xs font-bold text-[#24160c] uppercase tracking-wider">
                      Term 7 & 8: Standard Payment Schedule Breakdown
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-[#5c3e24] bg-[#ebdcc9] px-2.5 py-0.5 rounded-full">
                    75% Advance / 25% On Completion
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-xs">
                  <div className="bg-white p-3 rounded-lg border border-[#ebdcc9] shadow-2xs">
                    <div className="text-[10px] text-[#7d6553] font-medium uppercase tracking-wider">Advance Required (75%)</div>
                    <div className="text-sm font-bold text-[#24160c] font-mono mt-0.5">
                      {formatINR(commercialPricing.advanceAmount, false)}
                    </div>
                    <div className="text-[10px] text-[#8f6541] mt-1 font-medium">Payable prior to material dispatch & erection</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-[#ebdcc9] shadow-2xs">
                    <div className="text-[10px] text-[#7d6553] font-medium uppercase tracking-wider">Installation Balance (25%)</div>
                    <div className="text-sm font-bold text-[#24160c] font-mono mt-0.5">
                      {formatINR(commercialPricing.balanceAmount, false)}
                    </div>
                    <div className="text-[10px] text-[#8f6541] mt-1 font-medium">Payable immediately upon erection completion</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-[#ebdcc9] shadow-2xs">
                    <div className="text-[10px] text-[#7d6553] font-medium uppercase tracking-wider">Extension Billing Due</div>
                    <div className="text-xs font-bold text-[#24160c] font-mono mt-0.5">
                      Next day after 28 days
                    </div>
                    <div className="text-[10px] text-[#8f6541] mt-1 font-medium">Term 8: Next-day billing for each 28-day cycle</div>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-semibold text-[#4a3525] uppercase tracking-wider mb-1.5">
                  Commercial & Credit Remarks
                </label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="Official Terms 1-11 apply as standardized"
                  className="w-full p-2.5 bg-white border border-[#d6c7b2] rounded-lg font-medium text-xs text-[#24160c] focus:ring-2 focus:ring-[#8f6541]/20 focus:border-[#8f6541] focus:outline-hidden"
                />
              </div>
            </div>

            {/* Official 11 Terms & Conditions Review Card */}
            <div className="mt-4 border border-[#ebdcc9] rounded-xl bg-[#fbf9f5] overflow-hidden text-xs">
              <div 
                className="p-3.5 bg-[#ebdcc9]/50 border-b border-[#ebdcc9] flex items-center justify-between cursor-pointer select-none"
                onClick={() => setShowAllTerms(!showAllTerms)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#24160c] text-[#dfcbab] flex items-center justify-center font-bold text-xs">
                    §
                  </div>
                  <div>
                    <span className="font-bold text-[#24160c]">Official Business Terms & Conditions (11 Clauses)</span>
                    <span className="text-[10px] text-[#7d6553] ml-2 font-normal">Applicable across quotation, confirmation & invoice</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-[#24160c] hover:underline cursor-pointer"
                >
                  {showAllTerms ? 'Collapse Terms ▲' : 'Review All 11 Terms ▼'}
                </button>
              </div>

              {showAllTerms && (
                <div className="p-4 bg-white space-y-3 max-h-80 overflow-y-auto divide-y divide-[#ebdcc9]">
                  {OFFICIAL_TERMS_AND_CONDITIONS.map((term) => (
                    <div key={term.id} className="pt-2.5 first:pt-0">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#fbf9f5] border border-[#ebdcc9] text-[#24160c] font-bold text-[10px] flex items-center justify-center shrink-0">
                          {term.id}
                        </span>
                        <span className="font-bold text-[#24160c] text-xs">{term.title}</span>
                        <span className="text-[10px] text-[#8c7360] uppercase font-mono ml-auto">{term.category}</span>
                      </div>
                      <p className="text-[#5c3e24] text-xs mt-1 leading-relaxed pl-7">{term.fullText || (term as any).content}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3.5 bg-[#fbf9f5] border-t border-[#ebdcc9] flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="acceptTermsConfirmation"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="w-4 h-4 rounded text-[#24160c] focus:ring-[#8f6541] border-[#d6c7b2] cursor-pointer"
                />
                <label htmlFor="acceptTermsConfirmation" className="text-xs text-[#4a3525] font-medium cursor-pointer">
                  Customer has been informed of and agrees to all <span className="font-bold text-[#24160c]">11 Official Terms & Conditions</span> (Pricing per sq. ft., 28-day rental, 75% advance, 2-way transport, walkway Jali rules & delivery challan responsibility).
                </label>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION 4: SMART MATERIAL RECOMMENDATION & RESERVATION     */}
          {/* ========================================================= */}
          <div className="bg-white p-6 rounded-2xl border border-[#ebdcc9] shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#ebdcc9] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#24160c] text-[#dfcbab] flex items-center justify-center font-bold text-xs">
                  04
                </div>
                <h2 className="text-sm font-bold text-[#24160c] uppercase tracking-wider">
                  Scaffolding Material Requirements & Stock Reservation
                </h2>
              </div>
              <span className="text-[11px] font-mono text-[#7d6553] bg-[#fbf9f5] px-2.5 py-1 rounded border border-[#ebdcc9]">
                Inventory Allocation
              </span>
            </div>

            <SmartMaterialRecommendation
              initialDimensions={selectedProject ? {
                length: projectDims.width,
                width: projectDims.depth,
                depth: projectDims.depth,
                height: projectDims.height,
                unit: projectDims.unit,
              } : undefined}
              catalogMaterials={catalogMaterials}
              onPlanSelected={handlePlanSelected}
              onMaterialsChange={(mats) => setSelectedMaterials(mats)}
            />
          </div>

          {/* Bottom Action Bar */}
          <div className="bg-white p-4 rounded-xl border border-[#ebdcc9] shadow-2xs flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="text-xs text-[#7d6553] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#8f6541]"></span>
              <span>Confirming this project transitions status to CONFIRMED_PROJECT and locks warehouse stock.</span>
            </div>

            <div className="flex items-center gap-3 justify-end">
              <Link
                href="/projects"
                className="px-5 py-2.5 rounded-lg border border-[#d6c7b2] text-[#24160c] hover:bg-[#fbf9f5] text-xs font-semibold transition text-center min-h-[40px] flex items-center justify-center cursor-pointer"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#24160c] hover:bg-[#382315] disabled:bg-[#d6c7b2] text-[#fbf9f5] text-xs font-bold rounded-lg shadow-sm transition cursor-pointer min-h-[40px]"
              >
                <CheckCircle2 className="w-4 h-4 text-[#c79e7c]" />
                <span>{submitting ? 'Reserving Stock & Confirming...' : 'Confirm Project & Reserve Materials'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Lightbox / Preview Modal for Confirmation */}
      {previewSitePhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewSitePhoto(null)}
        >
          <div 
            className="relative max-w-3xl w-full bg-[#1c120c] rounded-2xl overflow-hidden shadow-2xl border border-[#382315]"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-3 bg-[#120a06] border-b border-[#382315] flex items-center justify-between text-white text-xs">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#c79e7c]" />
                <span className="font-semibold text-[#fdfcf9]">Site Inspection Photo Preview</span>
              </div>
              <button 
                type="button"
                onClick={() => setPreviewSitePhoto(null)}
                className="p-1 rounded-lg hover:bg-[#382315] text-[#d6c7b2] hover:text-white transition cursor-pointer"
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
