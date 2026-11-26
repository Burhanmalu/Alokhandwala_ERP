'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Project } from '@/lib/schema';
import { useAuth } from '@/lib/auth/auth-context';
import DismantleReconciliationPanel from '@/components/projects/DismantleReconciliationPanel';

export default function ProjectDismantlingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { currentUser } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((projJson) => {
        if (projJson.success && projJson.data) {
          setProject(projJson.data);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !project) {
    return (
      <div className="p-8 text-center text-xs text-[#7d6553]">
        Loading dismantling form...
      </div>
    );
  }

  const isEligibleForDismantle = Boolean(
    project &&
      ([
        'INSTALLED',
        'ACTIVE_RENTAL',
        'BUFFER_PERIOD',
        'EXTENDED',
        'REMOVAL_PENDING',
        'RETURNED_RECONCILIATION',
        'CLOSED',
      ].includes(project.status) ||
        Boolean(project.actualDismantlingDate) ||
        project.dismantleStatus === 'COMPLETED')
  );

  if (!isEligibleForDismantle) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl border border-[#d6c7b2] space-y-3 text-center">
        <h2 className="text-sm font-bold text-[#24160c]">Dismantling Not Available Yet</h2>
        <p className="text-xs text-[#7d6553]">
          Dismantling &amp; reconciliation can only be accessed after the project has been installed.
        </p>
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#c79e7c] bg-[#24160c] hover:bg-[#382315] rounded-md transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Project Details</span>
        </Link>
      </div>
    );
  }

  const challanRec = (project as any).challanReconciliation;
  if (challanRec && !challanRec.allowed) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl border border-rose-300 space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-rose-900">Cannot Dismantle Project</h2>
          <p className="text-xs text-stone-600">
            The following materials are still pending at the site:
          </p>
        </div>
        <ul className="space-y-1.5 bg-rose-50/70 border border-rose-200 rounded-lg p-3 text-xs font-mono text-rose-900">
          {(challanRec.pendingMaterials || []).map((m: any) => (
            <li key={m.materialId} className="font-semibold">
              • {m.materialName}{m.itemCode ? ` (${m.itemCode})` : ''} – {m.remaining} {m.unit}
            </li>
          ))}
        </ul>
        <p className="text-xs text-stone-600">
          Please complete material reconciliation in the Challan module before dismantling this project.
        </p>
        <div className="flex items-center gap-2.5 pt-1">
          <Link
            href={`/projects/${id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-[#faf6ee] border border-[#d6c7b2] rounded-md transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Project Details</span>
          </Link>
          <Link
            href="/challans"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#c79e7c] bg-[#24160c] hover:bg-[#382315] rounded-md transition"
          >
            <span>Open Challan Module</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-xs text-[#7d6553]">
        <Link href={`/projects/${id}`} className="hover:text-[#24160c] flex items-center gap-1 font-medium">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Project Workspace</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-[#24160c]">Dismantling & Reconciliation</span>
      </div>

      <DismantleReconciliationPanel
        project={project}
        currentUser={currentUser}
        onSaved={() => router.push(`/projects/${id}`)}
        onCancel={() => router.push(`/projects/${id}`)}
      />
    </div>
  );
}
