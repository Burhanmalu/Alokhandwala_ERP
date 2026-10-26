'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Boxes, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowUpRight, 
  Warehouse as WarehouseIcon, 
  Layers, 
  ArrowRightLeft,
  ShieldAlert
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Material } from '@/lib/schema';
import { formatQuantity, formatINR } from '@/lib/formatters';

export default function InventoryOverviewPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  useEffect(() => {
    if (currentUser && currentUser.role !== 'ADMIN') {
      if (currentUser.role === 'SUPERVISOR') {
        router.replace('/sites/new');
      } else {
        router.replace('/projects');
      }
    }
  }, [currentUser, router]);

  useEffect(() => {
    fetch('/api/inventory')
      .then(r => r.json())
      .then(json => {
        if (json.success) setData(json.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading inventory analytics...</div>;
  }

  const materials: Material[] = data?.materials || [];
  const summary = data?.summary || {};
  const categories = data?.categories || [];
  const warehouses = data?.warehouses || [];

  const filteredMaterials = materials.filter(m => {
    if (selectedCategory !== 'ALL' && m.categoryId !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return m.name.toLowerCase().includes(q) || m.itemCode.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-emerald-600" />
            <span>Scaffolding Yard & Inventory Overview</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Physical stock tracking across central warehouses and active client sites.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/inventory/catalogue"
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            Material Catalogue
          </Link>
          <Link
            href="/inventory/movements"
            className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition"
          >
            Movement Ledger
          </Link>
        </div>
      </div>

      {/* Stock Conservation Formulas Banner */}
      <div className="p-4 bg-emerald-950 text-white rounded-2xl border border-emerald-900 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs font-mono">
        <div>
          <div className="text-[10px] text-emerald-400 uppercase tracking-widest font-sans font-bold">
            Asset Conservation Engine
          </div>
          <div className="text-sm font-bold text-white mt-0.5 font-sans">
            Available To Allocate = Usable Warehouse Stock - Active Reservations
          </div>
          <div className="text-[11px] text-slate-300 mt-1 font-sans">
            Total Owned: <span className="font-bold text-white font-mono">{formatQuantity(summary.totalOwnedQty)}</span> across all yards and customer sites.
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 self-stretch md:self-auto text-center">
          <div className="bg-white/10 p-2 rounded-lg">
            <div className="text-[10px] text-slate-300 font-sans">Warehouse</div>
            <div className="font-bold text-white text-xs mt-0.5">{formatQuantity(summary.usableWarehouseQty)}</div>
          </div>
          <div className="bg-white/10 p-2 rounded-lg">
            <div className="text-[10px] text-slate-300 font-sans">Reserved</div>
            <div className="font-bold text-blue-300 text-xs mt-0.5">{formatQuantity(summary.reservedQty)}</div>
          </div>
          <div className="bg-white/10 p-2 rounded-lg">
            <div className="text-[10px] text-slate-300 font-sans">On Sites</div>
            <div className="font-bold text-emerald-300 text-xs mt-0.5">{formatQuantity(summary.siteAllocatedQty)}</div>
          </div>
          <div className="bg-white/10 p-2 rounded-lg">
            <div className="text-[10px] text-slate-300 font-sans">Damaged</div>
            <div className="font-bold text-amber-300 text-xs mt-0.5">{formatQuantity(summary.damagedQty)}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search material by name or SKU (e.g. SCF-STD-3000)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium w-full sm:w-auto"
        >
          <option value="ALL">All Material Categories</option>
          {categories.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Stock Balances Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Mobile Inventory Cards View */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredMaterials.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No inventory materials match your search.
            </div>
          ) : (
            filteredMaterials.map((m) => {
              const available = m.usableWarehouseQty - m.reservedQty;
              const isLowStock = available <= m.minimumStockThreshold;

              return (
                <div key={m.id} className="p-4 space-y-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {m.itemCode}
                      </span>
                      <h3 className="font-bold text-sm text-slate-900 mt-1">{m.name}</h3>
                      <div className="text-[10px] text-slate-400">{m.categoryName}</div>
                    </div>
                    {isLowStock ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1 shrink-0">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>Low Stock</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Adequate</span>
                      </span>
                    )}
                  </div>

                  {/* Available Stock Highlight */}
                  <div className="p-2.5 bg-emerald-50/80 rounded-xl border border-emerald-100 flex items-center justify-between">
                    <span className="text-emerald-900 font-semibold text-xs">Available to Allocate:</span>
                    <span className="font-mono text-base font-bold text-emerald-800">{available} Nos</span>
                  </div>

                  {/* Stock Distribution Matrix */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl text-center font-mono text-[11px]">
                    <div>
                      <span className="text-slate-400 font-sans block text-[10px]">Total Owned</span>
                      <span className="font-bold text-slate-900">{m.totalOwnedQty}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-sans block text-[10px]">Warehouse</span>
                      <span className="font-bold text-slate-700">{m.usableWarehouseQty}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-sans block text-[10px]">Reserved</span>
                      <span className="font-bold text-blue-700">{m.reservedQty}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-sans block text-[10px]">On Sites</span>
                      <span className="font-bold text-emerald-700">{m.siteAllocatedQty}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-sans block text-[10px]">Damaged</span>
                      <span className="font-bold text-amber-700">{m.damagedQty}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-sans block text-[10px]">Missing</span>
                      <span className="font-bold text-rose-700">{m.missingQty}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Stock Balances Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Item Code</th>
                <th className="px-4 py-3">Material Description</th>
                <th className="px-4 py-3 text-center">Total Owned</th>
                <th className="px-4 py-3 text-center">Warehouse Usable</th>
                <th className="px-4 py-3 text-center text-blue-700">Reserved</th>
                <th className="px-4 py-3 text-center font-bold text-emerald-800">Available to Allocate *</th>
                <th className="px-4 py-3 text-center text-emerald-700">On Sites</th>
                <th className="px-4 py-3 text-center text-amber-700">Damaged</th>
                <th className="px-4 py-3 text-center text-rose-700">Missing</th>
                <th className="px-4 py-3 text-center">Health Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredMaterials.map((m) => {
                const available = m.usableWarehouseQty - m.reservedQty;
                const isLowStock = available <= m.minimumStockThreshold;

                return (
                  <tr key={m.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">{m.itemCode}</td>
                    <td className="px-4 py-3 font-sans">
                      <div className="font-semibold text-slate-800">{m.name}</div>
                      <div className="text-[10px] text-slate-400">{m.categoryName}</div>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900">{m.totalOwnedQty}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{m.usableWarehouseQty}</td>
                    <td className="px-4 py-3 text-center text-blue-700 font-bold">{m.reservedQty}</td>
                    <td className="px-4 py-3 text-center font-bold text-emerald-800 bg-emerald-50/50">
                      {available}
                    </td>
                    <td className="px-4 py-3 text-center text-emerald-700">{m.siteAllocatedQty}</td>
                    <td className="px-4 py-3 text-center text-amber-700">{m.damagedQty}</td>
                    <td className="px-4 py-3 text-center text-rose-700 font-bold">{m.missingQty}</td>
                    <td className="px-4 py-3 text-center font-sans">
                      {isLowStock ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center justify-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>Low Stock</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Adequate</span>
                        </span>
                      )}
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
