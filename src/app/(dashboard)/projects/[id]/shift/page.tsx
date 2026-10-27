'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  ArrowRightLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Boxes, 
  Truck, 
  MapPin 
} from 'lucide-react';
import { Project, Material } from '@/lib/schema';
import { formatQuantity, formatINR } from '@/lib/formatters';
import { useAuth } from '@/lib/auth/auth-context';
import { RENTAL_CONSTANTS } from '@/lib/constants/terms-and-conditions';

export default function ProjectShiftingPage({
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
  const [shiftingType, setShiftingType] = useState<'TYPE_A_UNCHANGED' | 'TYPE_B_QUANTITY_CHANGE'>('TYPE_A_UNCHANGED');
  const [destinationAreaDescription, setDestinationAreaDescription] = useState('');
  const [plannedShiftingDate, setPlannedShiftingDate] = useState('');
  const [labourCharges, setLabourCharges] = useState<number>(0);
  const [transportCharges, setTransportCharges] = useState<number>(0);
  const [teamMembers, setTeamMembers] = useState('');
  const [remarks, setRemarks] = useState('');
  const [shiftingCalculationMode, setShiftingCalculationMode] = useState<'SQFT' | 'PERCENTAGE' | 'CUSTOM'>('SQFT');

  // Type B Material modifications
  const [modifications, setModifications] = useState<
    { materialId: string; materialName: string; itemCode: string; previousQuantity: number; newRequiredQuantity: number }[]
  >([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${id}`).then(r => r.json()),
      fetch('/api/inventory').then(r => r.json()),
    ]).then(([projJson, invJson]) => {
      if (projJson.success) {
        const p: Project = projJson.data;
        setProject(p);
        if (p.materials && p.materials.length > 0) {
          setModifications(
            p.materials.map(m => ({
              materialId: m.materialId,
              materialName: m.materialName,
              itemCode: m.itemCode,
              previousQuantity: m.installedQuantity,
              newRequiredQuantity: m.installedQuantity,
            }))
          );
        }
      }
      if (invJson.success) {
        setCatalogMaterials(invJson.data.materials);
      }
    }).finally(() => setLoading(false));
  }, [id]);

  const handleQtyChange = (idx: number, newQty: number) => {
    const updated = [...modifications];
    updated[idx].newRequiredQuantity = newQty;
    setModifications(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/projects/${id}/shift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftingType,
          destinationAreaDescription,
          plannedShiftingDate,
          labourCharges: Number(labourCharges),
          transportCharges: Number(transportCharges),
          teamMembers,
          remarks,
          materialModifications: shiftingType === 'TYPE_B_QUANTITY_CHANGE'
            ? modifications.map(m => ({
                materialId: m.materialId,
                newRequiredQuantity: Number(m.newRequiredQuantity),
              }))
            : undefined,
          actorId: currentUser.id,
          actorName: currentUser.fullName,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to execute shifting operation');
      }

      router.push(`/projects/${id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !project) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading shifting manager...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href={`/projects/${id}`} className="hover:text-emerald-700 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Project Workspace</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800">Shifting Management</span>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
              <span>Scaffolding Shifting Workflow</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Record physical shifting to a new site area or building wing, tracking unchanged or modified material allocations.
            </p>
          </div>
          <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-1 rounded">
            {project.projectCode}
          </span>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 text-xs">
          {/* Shifting Type Selector */}
          <div>
            <label className="block font-semibold text-slate-700 mb-2">Select Shifting Type *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShiftingType('TYPE_A_UNCHANGED')}
                className={`p-3 rounded-xl border text-left transition ${
                  shiftingType === 'TYPE_A_UNCHANGED'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-600'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5 text-indigo-900">
                  <span>Type A: Unchanged Materials</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Reuses existing site allocation with zero warehouse inventory deducted.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setShiftingType('TYPE_B_QUANTITY_CHANGE')}
                className={`p-3 rounded-xl border text-left transition ${
                  shiftingType === 'TYPE_B_QUANTITY_CHANGE'
                    ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-600'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5 text-indigo-900">
                  <span>Type B: Material Quantity Changes</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Requires additional stock dispatch or surplus return reconciliation.
                </div>
              </button>
            </div>
          </div>

          {/* Location & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Destination Area / New Elevation Description *
              </label>
              <input
                type="text"
                value={destinationAreaDescription}
                onChange={(e) => setDestinationAreaDescription(e.target.value)}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Planned Shifting Date *</label>
              <input
                type="date"
                value={plannedShiftingDate}
                onChange={(e) => setPlannedShiftingDate(e.target.value)}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Rigger Team</label>
              <input
                type="text"
                value={teamMembers}
                onChange={(e) => setTeamMembers(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            {/* Official Term 5: Shifting Charges Calculation Helper */}
            <div className="sm:col-span-2 p-4 bg-amber-50/70 border border-amber-200/90 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 font-bold text-xs flex items-center justify-center">5</span>
                  <span className="font-bold text-amber-950 text-xs">
                    Term 5: Official Shifting Charges Policy
                  </span>
                </div>
                <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-medium">
                  Extra charge borne by customer
                </span>
              </div>
              <p className="text-[11px] text-amber-900 leading-relaxed">
                Shifting charges are extra and shall be borne by the customer. Charges will be <span className="font-bold">₹6 per sq. ft.</span> or <span className="font-bold">60% of the per-unit amount</span>, as applicable.
              </p>

              {/* Mode Selection and Quick Apply */}
              {(() => {
                const m = project.measurements;
                const lengthFt = m ? (m.unit === 'METERS' ? m.length * 3.28084 : m.length) : 0;
                const heightFt = m ? (m.unit === 'METERS' ? m.height * 3.28084 : m.height) : 0;
                const areaSqFt = project.totalAreaSqFt || Math.round(lengthFt * heightFt) || 0;
                const mode1Cost = Math.round(areaSqFt * RENTAL_CONSTANTS.SHIFTING_RATE_PER_SQFT);
                const mode2Cost = Math.round((project.monthlyRentalRate || 0) * RENTAL_CONSTANTS.SHIFTING_PERCENTAGE_OF_UNIT_RENTAL);

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShiftingCalculationMode('SQFT');
                        if (mode1Cost > 0) setLabourCharges(mode1Cost);
                      }}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition ${
                        shiftingCalculationMode === 'SQFT'
                          ? 'border-amber-600 bg-white ring-1 ring-amber-500 shadow-xs'
                          : 'border-amber-200 bg-amber-100/40 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-xs">Mode 1: ₹6 / sq. ft.</span>
                        <span className="text-xs font-mono font-bold text-amber-800">₹{formatINR(mode1Cost, false)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {areaSqFt > 0 ? `${areaSqFt} sq. ft. × ₹6/sq. ft.` : 'Area calculated from site dimensions'}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShiftingCalculationMode('PERCENTAGE');
                        if (mode2Cost > 0) setLabourCharges(mode2Cost);
                      }}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition ${
                        shiftingCalculationMode === 'PERCENTAGE'
                          ? 'border-amber-600 bg-white ring-1 ring-amber-500 shadow-xs'
                          : 'border-amber-200 bg-amber-100/40 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-xs">Mode 2: 60% of Unit Rate</span>
                        <span className="text-xs font-mono font-bold text-amber-800">₹{formatINR(mode2Cost, false)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        60% of monthly rental (₹{formatINR(project.monthlyRentalRate || 0, false)})
                      </div>
                    </button>
                  </div>
                );
              })()}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Applied Shifting Labour Charges (INR) *
              </label>
              <input
                type="number"
                value={labourCharges}
                onChange={(e) => {
                  setLabourCharges(Number(e.target.value));
                  setShiftingCalculationMode('CUSTOM');
                }}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-amber-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Transport Mobilization (INR)
                <span className="text-[10px] text-slate-500 font-normal block">Term 3: Extra if mobilization is needed</span>
              </label>
              <input
                type="number"
                value={transportCharges}
                onChange={(e) => setTransportCharges(Number(e.target.value))}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Shifting Remarks</label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Type B Material Delta Comparison Table */}
          {shiftingType === 'TYPE_B_QUANTITY_CHANGE' && (
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>Material Allocation Comparison (Previous vs New Required)</span>
                <span className="text-[11px] text-slate-500 font-normal">Surplus does not restore stock until return.</span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Material</th>
                      <th className="px-3 py-2 text-center">Previous Installed Qty</th>
                      <th className="px-3 py-2 text-center font-bold text-indigo-900">New Required Qty</th>
                      <th className="px-3 py-2 text-center">Difference (Delta)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {modifications.map((row, idx) => {
                      const delta = row.newRequiredQuantity - row.previousQuantity;
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-sans font-medium text-slate-900">
                            {row.materialName} ({row.itemCode})
                          </td>
                          <td className="px-3 py-2 text-center text-slate-700">
                            {row.previousQuantity}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={row.newRequiredQuantity}
                              onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
                              className="w-24 p-1 border border-indigo-300 rounded text-center font-bold bg-indigo-50/50"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            {delta > 0 ? (
                              <span className="text-blue-700 font-bold font-sans">
                                +{delta} (Additional Issue)
                              </span>
                            ) : delta < 0 ? (
                              <span className="text-amber-700 font-bold font-sans">
                                {delta} (Surplus Return)
                              </span>
                            ) : (
                              <span className="text-slate-400 font-sans">No Change</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Link
              href={`/projects/${id}`}
              className="px-4 py-2 text-slate-600 hover:text-slate-900"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Executing Shifting...' : 'Complete Shifting Operation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
