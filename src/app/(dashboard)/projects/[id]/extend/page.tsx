'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Repeat, CheckCircle2, AlertTriangle, Calendar, ReceiptIndianRupee } from 'lucide-react';
import { Project } from '@/lib/schema';
import { formatDate, formatINR, addDays } from '@/lib/formatters';
import { useAuth } from '@/lib/auth/auth-context';
import { RENTAL_CONSTANTS } from '@/lib/constants/terms-and-conditions';

export default function ProjectExtensionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { currentUser } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [extensionReason, setExtensionReason] = useState('');
  const [monthlyRentalRate, setMonthlyRentalRate] = useState<number>(0);
  const [additionalCharges, setAdditionalCharges] = useState<number>(0);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setProject(json.data);
          setMonthlyRentalRate(json.data.monthlyRentalRate || 0);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const currentEndDate = project?.rentalEndDate ? new Date(project.rentalEndDate) : new Date();
  // Term 2: 28 days = 1 month
  const newEndDate = addDays(currentEndDate, durationMonths * RENTAL_CONSTANTS.RENTAL_DAYS_PER_MONTH);
  // Term 8: Payment due next day after cycle ends
  const nextPaymentDueDate = addDays(currentEndDate, 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/projects/${id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationMonths: Number(durationMonths),
          extensionReason,
          monthlyRentalRate: Number(monthlyRentalRate),
          additionalCharges: Number(additionalCharges),
          actorId: currentUser.id,
          actorName: currentUser.fullName,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to extend rental');
      }

      router.push(`/projects/${id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !project) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading extension details...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href={`/projects/${id}`} className="hover:text-emerald-700 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Project Workspace</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800">Rental Extension</span>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Repeat className="w-5 h-5 text-teal-600" />
              <span>Extend Project Rental Period</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Extends contractual rental duration based on official 28-day monthly cycles without consuming warehouse inventory.
            </p>
          </div>
          <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-1 rounded">
            {project.projectCode}
          </span>
        </div>

        {/* Official Term 2 & 8 Policy Banner */}
        <div className="p-3.5 bg-blue-50/70 border border-blue-200/90 rounded-xl space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-900 font-bold text-xs flex items-center justify-center">§</span>
            <span className="font-bold text-blue-950">Terms 2 & 8: Extension Commercial Rules</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-blue-900 leading-relaxed pt-1">
            <div className="bg-white/80 p-2.5 rounded-lg border border-blue-100">
              <span className="font-bold block text-blue-950">Term 2: 28 Days Rental Period</span>
              Quoted price covers 28 days (1 month). If the rental exceeds 28 days by even 1 day, full monthly charges apply.
            </div>
            <div className="bg-white/80 p-2.5 rounded-lg border border-blue-100">
              <span className="font-bold block text-blue-950">Term 8: Next-Day Monthly Payment</span>
              Rental payment for extended periods must be made on the next day after completion of each 28-day cycle.
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Existing vs Proposed Dates & Payment Due Date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-teal-50/50 rounded-xl border border-teal-200 text-xs">
          <div>
            <span className="text-slate-500">Current Cycle Expiry:</span>
            <div className="font-mono font-bold text-slate-800 mt-0.5">{formatDate(project.rentalEndDate)}</div>
          </div>
          <div>
            <span className="text-teal-800 font-semibold">New Expiry (+{durationMonths * 28}d):</span>
            <div className="font-mono font-bold text-teal-900 mt-0.5">{formatDate(newEndDate)}</div>
          </div>
          <div className="bg-white/80 p-2 rounded-lg border border-teal-200 sm:col-span-1">
            <span className="text-emerald-700 font-bold block text-[10px] uppercase">Payment Due Date (Term 8):</span>
            <div className="font-mono font-bold text-emerald-900 mt-0.5">{formatDate(nextPaymentDueDate)}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Extension Duration (28-Day Monthly Cycles) *
            </label>
            <div className="flex gap-3">
              {[1, 2, 3, 6].map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setDurationMonths(m)}
                  className={`flex-1 py-2 rounded-lg font-bold border transition cursor-pointer ${
                    durationMonths === m
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  +{m} Month{m > 1 ? 's' : ''} ({m * 28}d)
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Monthly Rental Rate (INR) *</label>
            <input
              type="number"
              value={monthlyRentalRate}
              onChange={(e) => setMonthlyRentalRate(Number(e.target.value))}
              required
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-teal-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Extension Reason *</label>
            <textarea
              rows={3}
              value={extensionReason}
              onChange={(e) => setExtensionReason(e.target.value)}
              required
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Additional Fixed Charges (INR, if any)</label>
            <input
              type="number"
              value={additionalCharges}
              onChange={(e) => setAdditionalCharges(Number(e.target.value))}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <Link
              href={`/projects/${id}`}
              className="px-4 py-2 text-slate-600 hover:text-slate-900"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold shadow-xs transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Applying Extension...' : 'Confirm Extension & Update Schedule'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
