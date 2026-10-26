'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  ArrowRightLeft, 
  Search, 
  History, 
  Building2, 
  User, 
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import { InventoryTransaction } from '@/lib/schema';
import { formatDateTime, formatDate } from '@/lib/formatters';

export default function StockMovementLedgerPage() {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');

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
      return matchTxn || matchProj || matchActor || matchDoc;
    }
    return true;
  });

  const getMovementBadge = (type: string) => {
    switch (type) {
      case 'MATERIAL_ISSUE_DISPATCH':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'RESERVATION':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'WAREHOUSE_RETURN':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'SITE_TO_SITE_TRANSFER':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'DAMAGED_TRANSFER':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/inventory" className="hover:text-emerald-700 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Inventory Overview</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800">Stock Movement Ledger</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
            <span>Immutable Stock Transaction Ledger</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-grade double entry recording of all reservations, dispatches, site-to-site shifts, and warehouse returns.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center gap-3 text-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Transaction ID (TXN-...), Project, or Document..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
          />
        </div>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium"
        >
          <option value="ALL">All Movement Types</option>
          <option value="MATERIAL_ISSUE_DISPATCH">Material Issue Dispatch</option>
          <option value="RESERVATION">Reservation</option>
          <option value="WAREHOUSE_RETURN">Warehouse Return</option>
          <option value="SITE_TO_SITE_TRANSFER">Site to Site Transfer</option>
          <option value="OPENING_STOCK">Opening Stock</option>
        </select>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Txn Number</th>
                <th className="px-4 py-3">Movement Type</th>
                <th className="px-4 py-3">Source & Destination</th>
                <th className="px-4 py-3">Project / Document</th>
                <th className="px-4 py-3 text-center">Items Moved</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filtered.map((t) => {
                const totalPieces = t.lines.reduce((sum, l) => sum + l.quantity, 0);

                return (
                  <tr key={t.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                      {t.transactionNumber}
                    </td>
                    <td className="px-4 py-3 font-sans whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getMovementBadge(t.movementType)}`}>
                        {t.movementType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans text-xs">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <span className="font-medium truncate max-w-[140px]">{t.sourceLocation}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-semibold text-emerald-800 truncate max-w-[140px]">{t.destinationLocation}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-sans">
                      <div className="font-bold text-slate-900 font-mono">{t.projectCode || '-'}</div>
                      <div className="text-[10px] text-slate-400">{t.referenceDocument || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-800">
                      {totalPieces} Nos ({t.lines.length} lines)
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-700 whitespace-nowrap">
                      {t.actorName}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatDateTime(t.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
