'use client';

import React, { useEffect, useState, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Boxes, 
  ReceiptIndianRupee, 
  Trash2, 
  Plus, 
  Ruler, 
  Building2,
  Calendar,
  Clock
} from 'lucide-react';
import { Material, Project, ScaffoldingMaterialPlanOption } from '@/lib/schema';
import { formatINR, formatDate } from '@/lib/formatters';
import { useAuth } from '@/lib/auth/auth-context';
import { SmartMaterialRecommendation } from '@/components/scaffolding/SmartMaterialRecommendation';
import { 
  OFFICIAL_TERMS_AND_CONDITIONS, 
  RENTAL_CONSTANTS, 
  DEFAULT_PAYMENT_TERMS_TEXT 
} from '@/lib/constants/terms-and-conditions';

export default function ProjectConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { currentUser } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [catalogMaterials, setCatalogMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields - Clean initial state without default mock values
  const [quotationNumber, setQuotationNumber] = useState('');
  const [quotationDate, setQuotationDate] = useState('');
  const [agreedProjectPrice, setAgreedProjectPrice] = useState<number>(0);
  const [monthlyRentalRate, setMonthlyRentalRate] = useState<number>(0);
  const [plannedInstallationDate, setPlannedInstallationDate] = useState('');
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [transportCharges, setTransportCharges] = useState<number>(0);
  const [installationLabourCharges, setInstallationLabourCharges] = useState<number>(0);
  const [paymentTerms, setPaymentTerms] = useState(DEFAULT_PAYMENT_TERMS_TEXT);
  const [remarks, setRemarks] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [showAllTerms, setShowAllTerms] = useState(false);

  // Auto-calculated expected return / rental end date (Term 2: 28 Days per Month)
  const calculatedEndDate = useMemo(() => {
    if (!plannedInstallationDate || !durationMonths) return '';
    try {
      const d = new Date(plannedInstallationDate);
      if (isNaN(d.getTime())) return '';
      d.setDate(d.getDate() + Number(durationMonths || 1) * RENTAL_CONSTANTS.RENTAL_DAYS_PER_MONTH);
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  }, [plannedInstallationDate, durationMonths]);

  // Selected Materials for Reservation & Recommended Plan
  const [selectedMaterials, setSelectedMaterials] = useState<
    { materialId: string; requiredQuantity: number; monthlyRentalRate: number }[]
  >([]);
  const [selectedPlan, setSelectedPlan] = useState<ScaffoldingMaterialPlanOption | null>(null);
  const [siteDimensions, setSiteDimensions] = useState<any>(null);

  // Billable Area Calculation (Term 1: Façade elevation surface area basis)
  const areaDetails = useMemo(() => {
    const m = project?.measurements;
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
  }, [project?.measurements, monthlyRentalRate]);

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
      setAgreedProjectPrice(plan.totals.totalMonthlyRental * (durationMonths || 1) + (transportCharges * 2));
    }
  };

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${id}`).then(r => r.json()),
      fetch('/api/inventory').then(r => r.json()),
    ]).then(([projJson, invJson]) => {
      if (projJson.success) {
        setProject(projJson.data);
        setQuotationNumber(`QTN-${projJson.data.projectCode}`);
        if (projJson.data.monthlyRentalRate) {
          setMonthlyRentalRate(projJson.data.monthlyRentalRate);
          setAgreedProjectPrice(projJson.data.monthlyRentalRate * (durationMonths || 1));
        }
      }
      if (invJson.success) {
        const mats: Material[] = invJson.data.materials;
        setCatalogMaterials(mats);
      }
    }).finally(() => setLoading(false));
  }, [id, durationMonths]);

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

    if (selectedMaterials.length === 0) {
      setError('Please select at least one material to reserve.');
      return;
    }

    // Check for any stock shortages before submitting
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
      const res = await fetch(`/api/projects/${id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotationNumber,
          quotationDate,
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
          siteDimensions: siteDimensions || (project?.measurements ? {
            length: project.measurements.length,
            width: project.measurements.width,
            height: project.measurements.height,
            unit: project.measurements.unit,
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

      router.push(`/projects/${id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !project) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading project details...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href={`/projects/${id}`} className="hover:text-emerald-700 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Project Workspace</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800">Quotation Confirmation & Stock Reservation</span>
      </div>

      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
            <span>Confirm Project {project.projectCode}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review inspection data, record agreed commercial terms, and atomically reserve warehouse stock.
          </p>
        </div>
        <div className="text-right">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
            Current: {project.status}
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Read-Only Historical Inspection Summary */}
      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-500" />
          <span>Historical Site Inspection Records (Read-Only)</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <div className="text-slate-400">Customer</div>
            <div className="font-semibold text-slate-800">{project.customerName}</div>
          </div>
          <div>
            <div className="text-slate-400">Site Location</div>
            <div className="font-semibold text-slate-800">{project.siteName}</div>
          </div>
          <div>
            <div className="text-slate-400">Supervisor</div>
            <div className="font-semibold text-slate-800">{project.supervisorName}</div>
          </div>
          <div>
            <div className="text-slate-400">Site Dimensions</div>
            <div className="font-mono font-semibold text-slate-800">
              {project.measurements?.length}m x {project.measurements?.width}m x {project.measurements?.height}m
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Commercial Terms */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <ReceiptIndianRupee className="w-4 h-4 text-emerald-600" />
            <span>1. Commercial & Rental Contract Details</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Quotation Number *</label>
              <input
                type="text"
                value={quotationNumber}
                onChange={(e) => setQuotationNumber(e.target.value)}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Quotation Date *</label>
              <input
                type="date"
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Rental Duration (Months) *
                <span className="text-[10px] text-blue-600 block font-normal">Term 2: 28 Days = 1 Month</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={durationMonths}
                  onChange={(e) => {
                    const m = Math.max(1, Number(e.target.value));
                    setDurationMonths(m);
                    if (monthlyRentalRate) {
                      setAgreedProjectPrice(monthlyRentalRate * m + (transportCharges * 2) + jaliDetails.extraJaliCharge);
                    }
                  }}
                  required
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-blue-800 text-xs"
                />
                <span className="text-xs text-slate-500 font-semibold shrink-0">
                  Month{durationMonths > 1 ? 's' : ''} ({durationMonths * RENTAL_CONSTANTS.RENTAL_DAYS_PER_MONTH} Days)
                </span>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Planned Installation Date *</label>
              <input
                type="date"
                value={plannedInstallationDate}
                onChange={(e) => setPlannedInstallationDate(e.target.value)}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Monthly Rental Rate (INR) *
                <span className="text-[10px] text-emerald-600 block font-normal">Term 2: Per 28-day cycle</span>
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
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-emerald-800 text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Transportation (Per Way INR)
                <span className="text-[10px] text-amber-600 block font-normal">Term 3: Charged 2-way (Delivery + Return)</span>
              </label>
              <input
                type="number"
                value={transportCharges}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setTransportCharges(val);
                  setAgreedProjectPrice((monthlyRentalRate * (durationMonths || 1)) + (val * 2) + jaliDetails.extraJaliCharge);
                }}
                placeholder="0"
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs"
              />
              {transportCharges > 0 && (
                <div className="text-[10px] text-slate-500 mt-0.5">
                  2-way Total: <span className="font-semibold text-slate-800">₹{formatINR(transportCharges * 2, false)}</span>
                </div>
              )}
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
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 text-xs"
              />
            </div>

            {/* Quick Duration Buttons */}
            <div className="sm:col-span-3 flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="text-[11px] text-slate-500 font-semibold">Quick Select Duration:</span>
              {[1, 2, 3, 6, 12].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setDurationMonths(m);
                    if (monthlyRentalRate) {
                      setAgreedProjectPrice(monthlyRentalRate * m + (transportCharges * 2) + jaliDetails.extraJaliCharge);
                    }
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    durationMonths === m
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {m} Month{m > 1 ? 's' : ''} ({m * 28}d)
                </button>
              ))}
            </div>

            {/* Rental Timeline Banner */}
            <div className="sm:col-span-3 bg-gradient-to-r from-blue-50 via-slate-50 to-emerald-50 p-4 rounded-xl border border-blue-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
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
                      (@ ₹{formatINR(monthlyRentalRate, false)}/28d)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Commercial Area & Walkway Jali Cards */}
            <div className="sm:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Term 1: Area Details */}
              <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                    Term 1: Area-Based Pricing
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
                  <div className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">
                    Term 4: Walkway Jali Allowance
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
            <div className="sm:col-span-3 p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/90 rounded-xl">
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

            <div className="sm:col-span-3">
              <label className="block font-semibold text-slate-700 mb-1">Commercial & Credit Remarks</label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="Official Terms 1-11 apply as standardized"
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            {/* Official 11 Terms & Conditions Review Card */}
            <div className="sm:col-span-3 border border-amber-200/80 rounded-xl bg-amber-50/30 overflow-hidden text-xs">
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
                    <span className="text-[10px] text-amber-700 ml-2 font-normal">Standard across all ALOKHANDWALA contracts</span>
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
                  id="acceptTermsProjectConfirm"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                />
                <label htmlFor="acceptTermsProjectConfirm" className="text-xs text-slate-700 font-medium cursor-pointer">
                  Customer has been informed of and agrees to all <span className="font-bold text-slate-900">11 Official Terms & Conditions</span> (Pricing per sq. ft., 28-day rental, 75% advance, 2-way transport, walkway Jali rules & delivery challan responsibility).
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Smart Scaffolding Material Requirements & Stock Reservation */}
        <SmartMaterialRecommendation
          initialDimensions={project?.measurements ? {
            length: project.measurements.length,
            width: project.measurements.width,
            height: project.measurements.height,
            unit: project.measurements.unit,
          } : undefined}
          catalogMaterials={catalogMaterials}
          onPlanSelected={handlePlanSelected}
          onMaterialsChange={(mats) => setSelectedMaterials(mats)}
        />

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href={`/projects/${id}`}
            className="px-5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting ? 'Reserving Stock...' : 'Confirm Project & Reserve Materials'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
