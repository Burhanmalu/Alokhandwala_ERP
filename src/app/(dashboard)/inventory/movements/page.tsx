'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  ArrowRightLeft, 
  Search, 
  ArrowRight, 
  Boxes, 
  Filter,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { InventoryTransaction } from '@/lib/schema';
import { formatDateTime } from '@/lib/formatters';

export default function StockMovementLedgerPage() {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  const fetchTransactions = () => {
    setLoading(true);
    fetch('/api/inventory')
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data.transactions) {
          setTransactions(json.data.transactions);
        }
      })
      .catch((e) => console.error('Failed to load transactions:', e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTransactions();
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
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'RESERVATION':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'RESERVATION_RELEASE':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'WAREHOUSE_RETURN':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'SITE_TO_SITE_TRANSFER':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'DAMAGED_TRANSFER':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'OPENING_STOCK':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      default:
        return 'bg-stone-50 text-stone-800 border-stone-200';
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

  return (
    <div className="space-y-5">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-stone-500">
        <Link href="/inventory" className="hover:text-[#24160c] flex items-center gap-1 transition">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Inventory</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-stone-800">Inventory Ledger</span>
      </div>

      {/* Header Banner - Matching Master Inventory Style */}
      <div className="bg-[#1e130c] p-5 rounded-lg border border-[#3b2416] text-[#fdfbf7] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="text-[10px] text-[#c79e7c] uppercase tracking-wider font-sans font-bold">
            Audit Trail & Double-Entry Ledger
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#fdfbf7] mt-0.5 flex items-center gap-2.5">
            <ArrowRightLeft className="w-6 h-6 text-[#c79e7c]" />
            <span>Inventory Ledger</span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchTransactions}
            className="px-3 py-1.5 rounded-md bg-[#2d1b11] hover:bg-[#3d2617] border border-[#52331f] text-xs font-semibold text-[#debfa6] hover:text-white transition flex items-center gap-1.5"
            title="Refresh transactions"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <div className="px-3 py-1.5 rounded-md bg-[#2d1b11] border border-[#52331f] text-xs font-mono text-[#debfa6]">
            Total Entries: <span className="font-bold text-white ml-1">{transactions.length}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar - Matching Master Inventory Style */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[#9c826e] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by ID (#001), Material, Project, Route, or Purpose..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-[#d8c8b4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#8c5e39] text-[#24160c] placeholder:text-[#9c826e]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <Filter className="w-4 h-4 text-[#8c5e39] shrink-0" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full sm:w-auto py-2 px-3 bg-white border border-[#d8c8b4] rounded-md text-xs text-[#24160c] font-medium focus:outline-none focus:border-[#8c5e39]"
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

      {/* Master Inventory Consistent Table Card */}
      <div className="bg-white rounded-lg border border-[#ebdcc9] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-stone-500 font-sans">
            Loading inventory transactions from backend store...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-stone-500 font-sans space-y-3">
            <FolderOpen className="w-8 h-8 text-[#9c826e] mx-auto opacity-50" />
            <div className="text-xs font-semibold text-[#24160c]">
              {transactions.length === 0 
                ? 'No inventory movements recorded yet.' 
                : 'No transactions match your search or filter.'}
            </div>
            <p className="text-2xs text-[#7d6553] max-w-sm mx-auto">
              {transactions.length === 0 
                ? 'Confirming a project, dispatching site installation, or adding initial material intake automatically creates double-entry ledger transactions.'
                : 'Try clearing your search keyword or selecting "All Movements".'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#fbf9f5] text-[#7d6553] uppercase tracking-wider text-[10px] font-semibold border-b border-[#ebdcc9]">
                <tr>
                  <th className="px-4 py-2.5 text-center">Id</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Where (Route / Site)</th>
                  <th className="px-4 py-2.5">Project / Doc</th>
                  <th className="px-4 py-2.5 text-center">Quantities</th>
                  <th className="px-4 py-2.5">Authorized By</th>
                  <th className="px-4 py-2.5 text-right">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2eadf] font-mono">
                {filtered.map((t) => {
                  const totalPieces = t.lines.reduce((sum, l) => sum + l.quantity, 0);
                  const compactId = formatCompactId(t.transactionNumber);

                  return (
                    <tr 
                      key={t.id} 
                      className="hover:bg-[#faf6ee]/60 transition group cursor-pointer"
                      title="Click to view full entry details"
                    >
                      {/* Compact Id */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <Link
                          href={`/inventory/movements/${t.id}`}
                          className="font-bold font-mono text-[#24160c] group-hover:text-[#8c5e39] group-hover:border-[#8c5e39] px-2 py-0.5 rounded bg-[#faf6ee] border border-[#ebdcc9] text-xs inline-block transition"
                          title={t.transactionNumber}
                        >
                          {compactId}
                        </Link>
                      </td>

                      {/* Type Badge */}
                      <td className="px-4 py-3 whitespace-nowrap font-sans">
                        <Link href={`/inventory/movements/${t.id}`} className="block">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${getMovementBadge(t.movementType)}`}>
                            {t.movementType.replace(/_/g, ' ')}
                          </span>
                        </Link>
                      </td>

                      {/* Where (Route / Site) */}
                      <td className="px-4 py-3 font-sans">
                        <Link href={`/inventory/movements/${t.id}`} className="block">
                          <div className="flex items-center gap-2 text-xs">
                            <span 
                              className="font-medium text-stone-600 truncate max-w-[180px]" 
                              title={t.sourceLocation}
                            >
                              {t.sourceLocation}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#8c5e39] shrink-0" />
                            <span 
                              className="font-bold text-[#24160c] truncate max-w-[200px]" 
                              title={t.destinationLocation}
                            >
                              {t.destinationLocation}
                            </span>
                          </div>
                        </Link>
                      </td>

                      {/* Project / Doc */}
                      <td className="px-4 py-3">
                        {t.projectCode ? (
                          <Link 
                            href={t.projectId ? `/projects/${t.projectId}` : '/projects'}
                            onClick={(e) => e.stopPropagation()}
                            className="font-bold text-[#8c5e39] hover:underline font-mono text-xs block truncate"
                            title={t.projectCode}
                          >
                            {t.projectCode}
                          </Link>
                        ) : (
                          <span className="text-stone-400 font-mono text-xs">-</span>
                        )}
                        {t.referenceDocument && (
                          <div className="text-[10px] text-stone-500 font-mono truncate" title={t.referenceDocument}>
                            {t.referenceDocument}
                          </div>
                        )}
                      </td>

                      {/* Quantities */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="font-bold font-mono text-[#24160c]">
                          {totalPieces.toLocaleString()} Nos
                        </span>
                        <div className="text-[10px] text-[#7d6553] font-sans">{t.lines.length} lines</div>
                      </td>

                      {/* Authorized By */}
                      <td className="px-4 py-3 text-xs font-semibold text-[#24160c] font-sans whitespace-nowrap truncate" title={t.actorName}>
                        <Link href={`/inventory/movements/${t.id}`} className="block truncate">
                          {t.actorName}
                        </Link>
                      </td>

                      {/* Date & Time */}
                      <td className="px-4 py-3 text-[11px] font-mono text-stone-600 text-right whitespace-nowrap">
                        <Link href={`/inventory/movements/${t.id}`} className="block">
                          {formatDateTime(t.createdAt)}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
