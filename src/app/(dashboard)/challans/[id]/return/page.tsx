'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ChallanForm } from '@/components/challans/ChallanForm';
import { Challan } from '@/lib/schema';
import { useAuth } from '@/lib/auth/auth-context';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function AddChallanReturnPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { can } = useAuth();
  const [challan, setChallan] = useState<Challan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/challans/${id}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(json => {
        if (json.success) setChallan(json.data);
        else setError(json.error || 'Challan not found');
      })
      .catch(() => setError('Failed to load challan details'))
      .finally(() => setLoading(false));
  }, [id]);

  if (!can('CHALLAN_RECORD_RETURN')) {
    return (
      <div className="max-w-lg mx-auto bg-white p-8 rounded-lg border border-[#e5dac8] text-center space-y-3 mt-10">
        <ShieldAlert className="w-8 h-8 text-rose-700 mx-auto" />
        <h2 className="text-sm font-bold text-[#24160c]">Access Restricted</h2>
        <p className="text-xs text-stone-500">
          Only authorized Administrators and Supervisors can record return entries.
        </p>
        <Link
          href={`/challans/${id}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#24160c] text-[#c79e7c] rounded-md text-xs font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Challan</span>
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="p-10 text-center text-xs text-stone-500">Loading existing challan for return entry...</div>;
  }

  if (error || !challan) {
    return (
      <div className="max-w-lg mx-auto bg-white p-8 rounded-lg border border-[#e5dac8] text-center space-y-3 mt-10">
        <h2 className="text-sm font-bold text-rose-800">{error || 'Challan not found'}</h2>
        <Link
          href="/challans"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#24160c] text-[#c79e7c] rounded-md text-xs font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Challan Directory</span>
        </Link>
      </div>
    );
  }

  return <ChallanForm editingChallan={challan} mode="return" />;
}

