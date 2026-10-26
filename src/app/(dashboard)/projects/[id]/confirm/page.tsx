'use client';

import React, { useEffect, useState, use } from 'react';
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
  Building2 
} from 'lucide-react';
import { Material, Project, ScaffoldingMaterialPlanOption } from '@/lib/schema';
import { formatINR, formatDate } from '@/lib/formatters';
import { useAuth } from '@/lib/auth/auth-context';
import { SmartMaterialRecommendation } from '@/components/scaffolding/SmartMaterialRecommendation';

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
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [transportCharges, setTransportCharges] = useState<number>(0);
  const [installationLabourCharges, setInstallationLabourCharges] = useState<number>(0);
  const [paymentTerms, setPaymentTerms] = useState('');
  const [remarks, setRemarks] = useState('');

  // Selected Materials for Reservation & Recommended Plan
  const [selectedMaterials, setSelectedMaterials] = useState<
    { materialId: string; requiredQuantity: number; monthlyRentalRate: number }[]
  >([]);
  const [selectedPlan, setSelectedPlan] = useState<ScaffoldingMaterialPlanOption | null>(null);
  const [siteDimensions, setSiteDimensions] = useState<any>(null);

  const handlePlanSelected = (
    plan: ScaffoldingMaterialPlanOption,
    materials: { materialId: string; requiredQuantity: number; monthlyRentalRate: number }[]
  ) => {
    setSelectedPlan(plan);
    setSelectedMaterials(materials);
    setSiteDimensions(plan.configurationSummary.dimensions);
    if (plan.totals.totalMonthlyRental > 0) {
      setMonthlyRentalRate(plan.totals.totalMonthlyRental);
      setAgreedProjectPrice(plan.totals.totalMonthlyRental + (transportCharges || 0) + (installationLabourCharges || 0));
    }
  };

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${id}`).then(r => r.json()),
      fetch('/api/inventory').then(r => r.json()),
    ]).then(([projJson, invJson]) => {
      if (projJson.success) setProject(projJson.data);
      if (invJson.success) {
        const mats: Material[] = invJson.data.materials;
        setCatalogMaterials(mats);
      }
    }).finally(() => setLoading(false));
  }, [id]);

  const handleAddMaterialRow = () => {
    if (catalogMaterials.length === 0) return;
    const firstMat = catalogMaterials[0];
    setSelectedMaterials([
      ...selectedMaterials,
      { materialId: firstMat.id, requiredQuantity: 50, monthlyRentalRate: firstMat.rentalRatePerMonth },
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
              <label className="block font-semibold text-slate-700 mb-1">Planned Installation Date *</label>
              <input
                type="date"
                value={plannedInstallationDate}
                onChange={(e) => setPlannedInstallationDate(e.target.value)}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Monthly Rental Rate (INR) *</label>
              <input
                type="number"
                value={monthlyRentalRate}
                onChange={(e) => setMonthlyRentalRate(Number(e.target.value))}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-emerald-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Agreed Total Project Price (INR)</label>
              <input
                type="number"
                value={agreedProjectPrice}
                onChange={(e) => setAgreedProjectPrice(Number(e.target.value))}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Terms</label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="e.g. Net 30 days"
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
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
