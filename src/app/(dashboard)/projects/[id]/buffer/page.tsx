'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, CheckCircle2, AlertTriangle, Calendar } from 'lucide-react';
import { Project } from '@/lib/schema';
import { formatDate, addDays } from '@/lib/formatters';
import { useAuth } from '@/lib/auth/auth-context';

export default function ProjectBufferPage({
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

  const [requestedBufferDays, setRequestedBufferDays] = useState<number>(3);
  const [reason, setReason] = useState('');
  const [additionalCharges, setAdditionalCharges] = useState<number>(0);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setProject(json.data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const currentEndDate = project?.rentalEndDate ? new Date(project.rentalEndDate) : new Date();
  const proposedDeadline = addDays(currentEndDate, requestedBufferDays);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/projects/${id}/buffer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedBufferDays: Number(requestedBufferDays),
          reason,
          additionalCharges: Number(additionalCharges),
          actorId: currentUser.id,
          actorName: currentUser.fullName,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to approve buffer time');
      }

      router.push(`/projects/${id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !project) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading buffer details...</div>;
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
        <span className="font-semibold text-slate-800">Buffer Time Management</span>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              <span>Request / Approve Removal Buffer Time</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Grant a short buffer window (2 to 3 days) for dismantling planning without triggering a full rental month charge.
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

        {/* Existing Dates */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-200 text-xs">
          <div>
            <span className="text-slate-500">Contractual Rental End Date:</span>
            <div className="font-mono font-bold text-slate-800 mt-0.5">{formatDate(project.rentalEndDate)}</div>
          </div>
          <div>
            <span className="text-amber-800 font-semibold">Proposed Removal Deadline:</span>
            <div className="font-mono font-bold text-amber-900 mt-0.5">{formatDate(proposedDeadline)}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Requested Buffer Days *</label>
            <div className="flex gap-3">
              {[2, 3, 5].map((days) => (
                <button
                  type="button"
                  key={days}
                  onClick={() => setRequestedBufferDays(days)}
                  className={`flex-1 py-2 rounded-lg font-bold border transition ${
                    requestedBufferDays === days
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {days} Days Grace
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason for Buffer *</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Applicable Buffer Charges (INR, if any)</label>
            <input
              type="number"
              value={additionalCharges}
              onChange={(e) => setAdditionalCharges(Number(e.target.value))}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">Under standard company policy, initial 2-3 day buffers are waived from rental charge.</p>
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
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-xs transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Applying...' : 'Approve Buffer Period'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
