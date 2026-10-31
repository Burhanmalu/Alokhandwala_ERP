'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  ArrowRightLeft, 
  Building2, 
  Calendar, 
  User, 
  FileText, 
  Boxes, 
  ArrowRight, 
  MapPin, 
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { InventoryTransaction, Project } from '@/lib/schema';
import { formatDateTime, formatDate } from '@/lib/formatters';

export default function StockMovementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [transaction, setTransaction] = useState<InventoryTransaction | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/inventory/movements/${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data.transaction) {
          setTransaction(json.data.transaction);
          if (json.data.project) setProject(json.data.project);
        } else {
          setError(json.error || 'Transaction not found');
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to load transaction';
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const getMovementBadge = (type: string) => {
    switch (type) {
      case 'MATERIAL_ISSUE_DISPATCH':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'RESERVATION':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'RESERVATION_RELEASE':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'WAREHOUSE_RETURN':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'SITE_TO_SITE_TRANSFER':
        return 'bg-indigo-100 text-indigo-900 border-indigo-300';
      case 'DAMAGED_TRANSFER':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      case 'OPENING_STOCK':
        return 'bg-teal-100 text-teal-900 border-teal-300';
      default:
        return 'bg-stone-100 text-stone-900 border-stone-300';
    }
  };

  const formatCompactId = (txnNumber: string) => {
    const match = txnNumber.match(/TXN-\d{4}-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      return `#${num.toString().padStart(3, '0')}`;
    }
    return txnNumber;
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-stone-500 bg-white rounded-xl border border-[#ebdcc9]">
        Loading transaction detail...
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="space-y-4">
        <Link href="/inventory/movements" className="hover:text-[#24160c] flex items-center gap-1.5 text-xs text-stone-500 transition">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Inventory Ledger</span>
        </Link>
        <div className="p-8 text-center text-rose-800 bg-rose-50 rounded-xl border border-rose-200 text-sm font-semibold">
          {error || 'Transaction record not found'}
        </div>
      </div>
    );
  }

  const totalPieces = transaction.lines.reduce((sum, l) => sum + l.quantity, 0);
  const compactId = formatCompactId(transaction.transactionNumber);

  return (
    <div className="space-y-6 max-w-[1500px] w-full mx-auto">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-stone-500">
        <Link href="/inventory" className="hover:text-[#24160c] flex items-center gap-1 transition">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Inventory Overview</span>
        </Link>
        <span>/</span>
        <Link href="/inventory/movements" className="hover:text-[#24160c] transition">
          <span>Inventory Ledger</span>
        </Link>
        <span>/</span>
        <span className="font-mono font-semibold text-stone-800">{transaction.transactionNumber}</span>
      </div>

      {/* Header Banner */}
      <div className="bg-[#24160c] border border-[#19100a] rounded-xl p-5 sm:p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xs font-mono tracking-widest text-[#c79e7c] uppercase">Ledger Transaction Entry</span>
            <span className="text-stone-500">•</span>
            <span className="font-mono text-xs text-[#ebdcc9]">{compactId}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <ArrowRightLeft className="w-6 h-6 text-[#c79e7c]" />
            <span>Transaction {transaction.transactionNumber}</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getMovementBadge(transaction.movementType)}`}>
            {transaction.movementType.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Transaction Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Route & Logistics */}
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-[#ebdcc9] shadow-2xs space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-[#5c3e24] flex items-center gap-2 border-b border-[#f0e8db] pb-2.5">
            <MapPin className="w-4 h-4 text-[#8c5e39]" />
            <span>Logistics Route</span>
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <div className="text-stone-400 font-semibold uppercase text-2xs">Source Origin</div>
              <div className="font-bold text-[#24160c] text-sm mt-0.5">{transaction.sourceLocation}</div>
            </div>
            <div className="pt-2 border-t border-[#f5efe6]">
              <div className="text-stone-400 font-semibold uppercase text-2xs">Destination Site / Yard</div>
              <div className="font-bold text-emerald-800 text-sm mt-0.5">{transaction.destinationLocation}</div>
            </div>
          </div>
        </div>

        {/* Card 2: Reason & Purpose */}
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-[#ebdcc9] shadow-2xs space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-[#5c3e24] flex items-center gap-2 border-b border-[#f0e8db] pb-2.5">
            <FileText className="w-4 h-4 text-[#8c5e39]" />
            <span>Reason & Movement Purpose</span>
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <div className="text-stone-400 font-semibold uppercase text-2xs">Movement Reason / Remarks</div>
              <div className="font-semibold text-[#24160c] text-sm mt-0.5 leading-snug">
                {transaction.remarks || 'Standard inventory transfer'}
              </div>
            </div>
            {transaction.referenceDocument && (
              <div className="pt-2 border-t border-[#f5efe6]">
                <div className="text-stone-400 font-semibold uppercase text-2xs">Reference Document</div>
                <div className="font-mono font-bold text-stone-700 text-xs mt-0.5">{transaction.referenceDocument}</div>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Custody, Authorization & Timestamp */}
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-[#ebdcc9] shadow-2xs space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-[#5c3e24] flex items-center gap-2 border-b border-[#f0e8db] pb-2.5">
            <User className="w-4 h-4 text-[#8c5e39]" />
            <span>Authorization & Audit</span>
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <div className="text-stone-400 font-semibold uppercase text-2xs">Authorized By (Actor)</div>
              <div className="font-bold text-[#24160c] text-sm mt-0.5">{transaction.actorName}</div>
              <div className="text-stone-400 font-mono text-2xs">{transaction.actorId}</div>
            </div>
            <div className="pt-2 border-t border-[#f5efe6]">
              <div className="text-stone-400 font-semibold uppercase text-2xs">Recorded Timestamp</div>
              <div className="font-mono font-bold text-stone-700 text-xs mt-0.5">{formatDateTime(transaction.createdAt)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Linked Project Card (If Applicable) */}
      {project && (
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-[#ebdcc9] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#24160c] text-[#dfcbab] flex items-center justify-center font-bold text-sm shrink-0">
              <Building2 className="w-5 h-5 text-[#c79e7c]" />
            </div>
            <div>
              <div className="text-2xs font-mono font-semibold uppercase tracking-wider text-[#8c5e39]">
                Linked Contract Project
              </div>
              <div className="font-bold text-base text-[#24160c]">
                {project.projectCode} • {project.customerName}
              </div>
              <div className="text-xs text-stone-500">{project.siteName}</div>
            </div>
          </div>

          <Link
            href={`/projects/${project.id}`}
            className="px-4 py-2 bg-[#24160c] hover:bg-[#382315] text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>View Project Dossier</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Material Line Breakdown Table */}
      <div className="bg-white rounded-xl border border-[#ebdcc9] shadow-2xs overflow-hidden">
        <div className="bg-[#fbf9f5] px-5 py-4 border-b border-[#ebdcc9] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Boxes className="w-5 h-5 text-[#8c5e39]" />
            <h2 className="text-base font-bold text-[#24160c]">Material Breakdown Lines</h2>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-[#ebdcc9] text-[#24160c]">
            {totalPieces.toLocaleString()} Total Nos ({transaction.lines.length} lines)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#faf6ee]/50 text-[#7d6553] uppercase tracking-wider text-2xs font-bold border-b border-[#ebdcc9]">
              <tr>
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">Item Code</th>
                <th className="px-5 py-3">Material Description</th>
                <th className="px-5 py-3 text-right">Quantity Moved</th>
                <th className="px-5 py-3 text-center">Material Condition</th>
                <th className="px-5 py-3">Line Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f5efe6] font-mono">
              {transaction.lines.map((line, index) => (
                <tr key={index} className="hover:bg-[#fbf9f5]/80 transition">
                  <td className="px-5 py-4 text-xs text-stone-400 font-sans">{index + 1}</td>
                  <td className="px-5 py-4 font-bold text-[#24160c] whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-[#f5ede3] border border-[#e5dac8] text-xs">
                      {line.itemCode}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-sans font-medium text-[#24160c]">
                    {line.materialName}
                  </td>
                  <td className="px-5 py-4 text-right font-bold text-[#8c5e39] text-base">
                    {line.quantity.toLocaleString()} Nos
                  </td>
                  <td className="px-5 py-4 text-center font-sans">
                    <span className="px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {line.condition || 'GOOD'}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-sans text-xs text-stone-500">
                    {line.remarks || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
