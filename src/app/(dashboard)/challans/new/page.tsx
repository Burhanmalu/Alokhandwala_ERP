'use client';

import React from 'react';
import Link from 'next/link';
import { ChallanForm } from '@/components/challans/ChallanForm';
import { useAuth } from '@/lib/auth/auth-context';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function NewChallanPage() {
  const { can } = useAuth();

  if (!can('CHALLAN_CREATE')) {
    return (
      <div className="max-w-lg mx-auto bg-white p-8 rounded-lg border border-[#e5dac8] text-center space-y-3 mt-10">
        <ShieldAlert className="w-8 h-8 text-rose-700 mx-auto" />
        <h2 className="text-sm font-bold text-[#24160c]">Access Restricted</h2>
        <p className="text-xs text-stone-500">
          Only authorized Administrators and Supervisors can create new challans.
        </p>
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

  return <ChallanForm />;
}

