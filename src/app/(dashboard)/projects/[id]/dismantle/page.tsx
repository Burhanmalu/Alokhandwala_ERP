'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Boxes, 
  Truck, 
  Warehouse, 
  ShieldAlert 
} from 'lucide-react';
import { Project, Warehouse as WarehouseType } from '@/lib/schema';
import { formatDate } from '@/lib/formatters';
import { useAuth } from '@/lib/auth/auth-context';

export default function ProjectDismantlingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { currentUser } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields - Clean initial state without default mock values
  const [actualDismantlingDate, setActualDismantlingDate] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [teamMembers, setTeamMembers] = useState('');
  const [transportDetails, setTransportDetails] = useState('');
  const [reconciliationNotes, setReconciliationNotes] = useState('');

  // Return breakdown per material
  const [returns, setReturns] = useState<
    {
      materialId: string;
      materialName: string;
      itemCode: string;
      expectedSiteQty: number;
      collectedQty: number;
      usableReturnedQty: number;
      damagedQty: number;
      missingQty: number;
    }[]
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
          setReturns(
            p.materials.map(m => ({
              materialId: m.materialId,
              materialName: m.materialName,
              itemCode: m.itemCode,
              expectedSiteQty: m.installedQuantity,
              collectedQty: m.installedQuantity,
              usableReturnedQty: m.installedQuantity,
              damagedQty: 0,
              missingQty: 0,
            }))
          );
        }
      }
      if (invJson.success && invJson.data.warehouses) {
        setWarehouses(invJson.data.warehouses);
        if (invJson.data.warehouses.length > 0) {
          setWarehouseId(invJson.data.warehouses[0].id);
        }
      }
    }).finally(() => setLoading(false));
  }, [id]);

  const handleReturnFieldChange = (
    idx: number,
    field: 'collectedQty' | 'usableReturnedQty' | 'damagedQty' | 'missingQty',
    val: number
  ) => {
    const updated = [...returns];
    updated[idx][field] = val;

    // Automatic reconciliation sanity check
    if (field === 'usableReturnedQty') {
      const remainingFromCollected = updated[idx].collectedQty - val;
      if (remainingFromCollected >= 0 && updated[idx].damagedQty === 0) {
        // Can be damaged
      }
    }
    setReturns(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate that usable + damaged + missing balances correctly
    for (const r of returns) {
      if (r.usableReturnedQty + r.damagedQty + r.missingQty > r.expectedSiteQty) {
        setError(`Returned quantities for ${r.materialName} cannot exceed expected site quantity of ${r.expectedSiteQty}.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${id}/dismantle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualDismantlingDate,
          warehouseId,
          supervisorId: currentUser.id,
          teamMembers,
          transportDetails,
          reconciliationNotes,
          materialReturns: returns.map(r => ({
            materialId: r.materialId,
            expectedSiteQty: Number(r.expectedSiteQty),
            collectedQty: Number(r.collectedQty),
            usableReturnedQty: Number(r.usableReturnedQty),
            damagedQty: Number(r.damagedQty),
            missingQty: Number(r.missingQty),
          })),
          actorId: currentUser.id,
          actorName: currentUser.fullName,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to submit dismantling returns');
      }

      router.push(`/projects/${id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !project) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading dismantling form...</div>;
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
        <span className="font-semibold text-slate-800">Dismantling & Reconciliation</span>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-rose-600" />
              <span>Dismantling & Material Condition Reconciliation</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Confirm physical return receipts at the warehouse. Only usable materials restore warehouse stock. Damaged & missing stock are isolated for billing/investigation.
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
          {/* Logistic Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Actual Dismantling Date *</label>
              <input
                type="date"
                value={actualDismantlingDate}
                onChange={(e) => setActualDismantlingDate(e.target.value)}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Receiving Warehouse Yard *</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                required
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.city})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Dismantling Supervisor & Team</label>
              <input
                type="text"
                value={teamMembers}
                onChange={(e) => setTeamMembers(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Transport Vehicle / Driver Details</label>
              <input
                type="text"
                value={transportDetails}
                onChange={(e) => setTransportDetails(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Reconciliation Notes & Discrepancies</label>
              <textarea
                rows={2}
                value={reconciliationNotes}
                onChange={(e) => setReconciliationNotes(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Material Return Lines & Condition Classification */}
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-emerald-600" />
                <span>Physical Material Inspection & Condition Classification</span>
              </h2>
              <p className="text-xs text-slate-500">
                Classify returned materials into Usable (restores warehouse stock), Damaged (quarantine), or Missing (billing recovery).
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">Material</th>
                    <th className="px-3 py-2.5 text-center">Expected on Site</th>
                    <th className="px-3 py-2.5 text-center">Collected Qty</th>
                    <th className="px-3 py-2.5 text-center font-bold text-emerald-800">Usable (Warehouse Stock) *</th>
                    <th className="px-3 py-2.5 text-center font-bold text-amber-700">Damaged (Quarantine) *</th>
                    <th className="px-3 py-2.5 text-center font-bold text-rose-700">Missing (Loss Recovery) *</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {returns.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-sans font-medium text-slate-900">
                        {row.materialName} ({row.itemCode})
                      </td>
                      <td className="px-3 py-2 text-center text-slate-600">
                        {row.expectedSiteQty}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={row.collectedQty}
                          onChange={(e) => handleReturnFieldChange(idx, 'collectedQty', Number(e.target.value))}
                          className="w-20 p-1 border border-slate-300 rounded text-center"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={row.usableReturnedQty}
                          onChange={(e) => handleReturnFieldChange(idx, 'usableReturnedQty', Number(e.target.value))}
                          className="w-20 p-1 border border-emerald-300 rounded text-center font-bold text-emerald-800 bg-emerald-50/50"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={row.damagedQty}
                          onChange={(e) => handleReturnFieldChange(idx, 'damagedQty', Number(e.target.value))}
                          className="w-20 p-1 border border-amber-300 rounded text-center font-bold text-amber-800 bg-amber-50/50"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={row.missingQty}
                          onChange={(e) => handleReturnFieldChange(idx, 'missingQty', Number(e.target.value))}
                          className="w-20 p-1 border border-rose-300 rounded text-center font-bold text-rose-800 bg-rose-50/50"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Reconciling Stock...' : 'Submit Warehouse Receipt & Reconcile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
