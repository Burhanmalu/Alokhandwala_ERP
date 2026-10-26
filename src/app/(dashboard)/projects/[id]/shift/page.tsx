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

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Shifting Labour Charges (INR)</label>
              <input
                type="number"
                value={labourCharges}
                onChange={(e) => setLabourCharges(Number(e.target.value))}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Transport Mobilization (INR)</label>
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
