'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  ArrowRightLeft, 
  Search, 
  Building2, 
  Calendar,
  Layers,
  ArrowRight,
  Boxes,
  FileText,
  ChevronDown,
  ChevronRight,
  Filter
} from 'lucide-react';
import { InventoryTransaction } from '@/lib/schema';
import { formatDateTime, formatDate } from '@/lib/formatters';

export default function StockMovementLedgerPage() {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [expandedTxnId, setExpandedTxnId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/inventory')
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data.transactions) {
          setTransactions(json.data.transactions);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = transactions.filter(t => {
    if (selectedType !== 'ALL' && t.movementType !== selectedType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTxn = t.transactionNumber.toLowerCase().includes(q);
      const matchProj = t.projectCode?.toLowerCase().includes(q);
      const matchActor = t.actorName.toLowerCase().includes(q);
      const matchDoc = t.referenceDocument?.toLowerCase().includes(q);
      const matchDest = t.destinationLocation?.toLowerCase().includes(q);
      const matchSrc = t.sourceLocation?.toLowerCase().includes(q);
      const matchRemarks = t.remarks?.toLowerCase().includes(q);
      const matchItem = t.lines?.some(l => 
        l.materialName.toLowerCase().includes(q) || 
        l.itemCode.toLowerCase().includes(q)
      );
      return matchTxn || matchProj || matchActor || matchDoc || matchDest || matchSrc || matchRemarks || matchItem;
    }
    return true;
  });

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

  const getMovementPurpose = (t: InventoryTransaction) => {
    if (t.remarks) return t.remarks;
    switch (t.movementType) {
      case 'MATERIAL_ISSUE_DISPATCH':
        return `Site dispatch & erection handover for ${t.projectCode || 'project'}`;
      case 'RESERVATION':
        return `Inventory reserved under quotation ${t.referenceDocument || t.projectCode || ''}`;
      case 'RESERVATION_RELEASE':
        return `Reservation release back to free stock for ${t.projectCode || 'project'}`;
      case 'WAREHOUSE_RETURN':
        return `Post-dismantling return to yard for ${t.projectCode || 'project'}`;
      case 'SITE_TO_SITE_TRANSFER':
        return `Site relocation / shifting transfer to ${t.destinationLocation}`;
      case 'OPENING_STOCK':
        return 'Fleet procurement intake & opening balance';
      default:
        return t.movementType.replace(/_/g, ' ');
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-stone-500">
        <Link href="/inventory" className="hover:text-[#24160c] flex items-center gap-1 transition">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Inventory Overview</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-stone-800">Inventory Ledger</span>
      </div>

      {/* Header Banner */}
      <div className="bg-[#24160c] border border-[#19100a] rounded-xl p-5 sm:p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xs font-mono tracking-widest text-[#c79e7c] uppercase">Audit Trail</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <ArrowRightLeft className="w-6 h-6 text-[#c79e7c]" />
            <span>Inventory Ledger</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-lg bg-[#382315] border border-[#52331f] text-xs font-mono text-[#debfa6]">
            Total Entries: <span className="font-bold text-white ml-1">{transactions.length}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#ebdcc9] shadow-2xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#9c826e] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by Transaction ID (TXN-...), Material, Project, Destination, or Purpose..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#fbf9f5] border border-[#d8c8b4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8c5e39]/20 focus:border-[#8c5e39] text-[#24160c] placeholder:text-[#9c826e]"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Filter className="w-4 h-4 text-[#8c5e39] shrink-0" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="py-2.5 px-3 bg-white border border-[#d8c8b4] rounded-lg text-sm text-[#24160c] font-medium focus:outline-none focus:border-[#8c5e39]"
          >
            <option value="ALL">All Movements ({transactions.length})</option>
            <option value="MATERIAL_ISSUE_DISPATCH">Material Issue Dispatch</option>
            <option value="RESERVATION">Reservation</option>
            <option value="RESERVATION_RELEASE">Reservation Release</option>
            <option value="WAREHOUSE_RETURN">Warehouse Return</option>
            <option value="SITE_TO_SITE_TRANSFER">Site-to-Site Transfer</option>
            <option value="OPENING_STOCK">Opening Stock</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-[#ebdcc9] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#fbf9f5] text-[#5c3e24] uppercase tracking-wider text-2xs font-bold border-b border-[#ebdcc9]">
              <tr>
                <th className="px-5 py-3.5">Transaction ID</th>
                <th className="px-5 py-3.5">Type & Purpose</th>
                <th className="px-5 py-3.5">Where (Route / Site)</th>
                <th className="px-5 py-3.5">Project / Doc</th>
                <th className="px-5 py-3.5 text-center">Quantities Moved</th>
                <th className="px-5 py-3.5">Authorized By</th>
                <th className="px-5 py-3.5">Date & Time</th>
                <th className="px-4 py-3.5 text-center">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f5efe6]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm text-stone-500 font-sans">
                    Loading inventory transactions from backend store...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm text-stone-500 font-sans">
                    No transactions match your search or filter.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const totalPieces = t.lines.reduce((sum, l) => sum + l.quantity, 0);
                  const isExpanded = expandedTxnId === t.id;

                  return (
                    <React.Fragment key={t.id}>
                      <tr 
                        className={`hover:bg-[#fbf9f5]/80 transition cursor-pointer ${isExpanded ? 'bg-[#fbf9f5]' : ''}`}
                        onClick={() => setExpandedTxnId(isExpanded ? null : t.id)}
                      >
                        <td className="px-5 py-4 font-bold text-[#24160c] font-mono whitespace-nowrap">
                          {t.transactionNumber}
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-2xs font-bold border ${getMovementBadge(t.movementType)}`}>
                              {t.movementType.replace(/_/g, ' ')}
                            </span>
                            <div className="text-xs text-[#574830] font-medium max-w-xs truncate" title={getMovementPurpose(t)}>
                              {getMovementPurpose(t)}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium text-stone-600 truncate max-w-[150px]" title={t.sourceLocation}>
                              {t.sourceLocation}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#8c5e39] shrink-0" />
                            <span className="font-bold text-[#24160c] truncate max-w-[170px]" title={t.destinationLocation}>
                              {t.destinationLocation}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {t.projectCode ? (
                            <Link 
                              href={t.projectId ? `/projects/${t.projectId}` : '/projects'}
                              onClick={(e) => e.stopPropagation()}
                              className="font-bold text-[#8c5e39] hover:underline font-mono"
                            >
                              {t.projectCode}
                            </Link>
                          ) : (
                            <span className="text-stone-400 font-mono">-</span>
                          )}
                          {t.referenceDocument && (
                            <div className="text-2xs text-stone-500 font-mono">{t.referenceDocument}</div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="font-bold font-mono text-[#24160c]">
                            {totalPieces.toLocaleString()} Nos
                          </span>
                          <div className="text-2xs text-[#7d6553]">{t.lines.length} material lines</div>
                        </td>
                        <td className="px-5 py-4 text-xs font-medium text-stone-700 whitespace-nowrap">
                          {t.actorName}
                        </td>
                        <td className="px-5 py-4 text-xs font-mono text-stone-600 whitespace-nowrap">
                          {formatDateTime(t.createdAt)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            className="p-1 rounded-md hover:bg-[#ebdcc9] text-[#7d6553] transition"
                            title={isExpanded ? 'Hide item lines' : 'View item lines'}
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-[#24160c]' : ''}`} />
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Material Lines Detail Row */}
                      {isExpanded && (
                        <tr className="bg-[#faf6ee] border-y border-[#ebdcc9]">
                          <td colSpan={8} className="p-4 sm:p-5">
                            <div className="bg-white rounded-lg border border-[#ebdcc9] p-4 shadow-2xs space-y-3">
                              <div className="flex items-center justify-between border-b border-[#f0e8db] pb-2">
                                <div className="text-xs font-bold uppercase tracking-wider text-[#5c3e24] flex items-center gap-2">
                                  <Boxes className="w-4 h-4 text-[#8c5e39]" />
                                  <span>Material Line Breakdown for {t.transactionNumber}</span>
                                </div>
                                <span className="text-2xs font-mono text-stone-500">
                                  Purpose: {getMovementPurpose(t)}
                                </span>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-[#fbf9f5] text-[#5c3e24] font-semibold">
                                    <tr>
                                      <th className="px-3 py-2">Item Code</th>
                                      <th className="px-3 py-2">Material Description</th>
                                      <th className="px-3 py-2 text-right">Quantity</th>
                                      <th className="px-3 py-2">Condition</th>
                                      <th className="px-3 py-2">Line Remarks</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#f2eadf] font-mono">
                                    {t.lines.map((l, idx) => (
                                      <tr key={idx} className="hover:bg-[#faf6ee]">
                                        <td className="px-3 py-2 font-bold text-[#24160c]">{l.itemCode}</td>
                                        <td className="px-3 py-2 font-sans font-medium text-stone-800">{l.materialName}</td>
                                        <td className="px-3 py-2 text-right font-bold text-[#8c5e39]">
                                          {l.quantity.toLocaleString()} Nos
                                        </td>
                                        <td className="px-3 py-2 font-sans">
                                          <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                            {l.condition || 'GOOD'}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 font-sans text-stone-500">{l.remarks || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
