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
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-white border border-[#ebdcc9] rounded-lg"></div>
        <div className="h-28 bg-[#1e130c] rounded-lg"></div>
        <div className="h-64 bg-white border border-[#ebdcc9] rounded-lg"></div>
      </div>
    );
  }

  const EXCLUDED_ITEM_CODES = ['BASE-PLATE-STD', 'TOE-BOARD-8FT', 'CPL-SWIVEL', 'CPL-FIXED'];
  const rawMaterials: Material[] = data?.materials || [];
  const materials: Material[] = rawMaterials.filter(m => !EXCLUDED_ITEM_CODES.includes(m.itemCode));
  const categories = data?.categories || [];

  const summary = {
    totalOwnedQty: materials.reduce((sum, m) => sum + (m.totalOwnedQty || 0), 0),
    usableWarehouseQty: materials.reduce((sum, m) => sum + (m.usableWarehouseQty || 0), 0),
    reservedQty: materials.reduce((sum, m) => sum + (m.reservedQty || 0), 0),
    siteAllocatedQty: materials.reduce((sum, m) => sum + (m.siteAllocatedQty || 0), 0),
    damagedQty: materials.reduce((sum, m) => sum + (m.damagedQty || 0), 0),
    missingQty: materials.reduce((sum, m) => sum + (m.missingQty || 0), 0),
  };

  const filteredMaterials = materials.filter(m => {
    if (selectedCategory !== 'ALL' && m.categoryId !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return m.name.toLowerCase().includes(q) || m.itemCode.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5dac8]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#9c826e]">
            <span>Inventory</span>
          </div>
          <h1 className="text-xl font-bold text-[#24160c] mt-0.5 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-[#8c5e39]" />
            <span>Scaffolding Yard & Inventory</span>
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/inventory/catalogue"
            className="px-3 py-1.5 text-xs font-semibold text-[#4d301c] bg-white border border-[#d8c8b4] rounded-md hover:bg-[#faf6ee] transition shadow-2xs"
          >
            Material Catalogue
          </Link>
          <Link
            href="/inventory/movements"
            className="px-3 py-1.5 text-xs font-semibold text-white bg-[#24150c] hover:bg-[#382315] border border-[#4d301c] rounded-md shadow-2xs transition"
          >
            Movement Ledger
          </Link>
        </div>
      </div>

      {/* Stock Conservation Formulas Banner */}
      <div className="p-4 bg-[#1e130c] text-[#fdfbf7] rounded-lg border border-[#3b2416] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs font-mono">
        <div>
          <div className="text-[10px] text-[#c79e7c] uppercase tracking-wider font-sans font-bold">
            Asset Conservation Engine
          </div>
          <div className="text-sm font-bold text-[#fdfbf7] mt-0.5 font-sans">
            Available To Allocate = Usable Yard Stock − Active Reservations
          </div>
          <div className="text-[11px] text-[#debfa6] mt-0.5 font-sans">
            Total Owned Fleet: <span className="font-bold text-white font-mono">{formatQuantity(summary.totalOwnedQty)} Nos</span> across all yards and sites.
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 self-stretch md:self-auto text-center">
          <div className="bg-white/5 border border-white/10 p-2 rounded-md">
            <div className="text-[10px] text-[#debfa6] font-sans">Yard Usable</div>
            <div className="font-bold text-[#fdfbf7] text-xs mt-0.5">{formatQuantity(summary.usableWarehouseQty)}</div>
          </div>
          <div className="bg-white/5 border border-white/10 p-2 rounded-md">
            <div className="text-[10px] text-[#debfa6] font-sans">Reserved</div>
            <div className="font-bold text-blue-300 text-xs mt-0.5">{formatQuantity(summary.reservedQty)}</div>
          </div>
          <div className="bg-white/5 border border-white/10 p-2 rounded-md">
            <div className="text-[10px] text-[#debfa6] font-sans">On Sites</div>
            <div className="font-bold text-emerald-300 text-xs mt-0.5">{formatQuantity(summary.siteAllocatedQty)}</div>
          </div>
          <div className="bg-white/5 border border-white/10 p-2 rounded-md">
            <div className="text-[10px] text-[#debfa6] font-sans">Damaged</div>
            <div className="font-bold text-amber-300 text-xs mt-0.5">{formatQuantity(summary.damagedQty)}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-2.5 rounded-lg border border-[#e8decb] shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 text-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[#9c826e] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search material by name or SKU (e.g. SCF-STD-3000)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#faf6ee]/50 border border-[#d8c8b4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#8c5e39] text-[#24160c] placeholder:text-[#9c826e]"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-1.5 bg-white border border-[#d8c8b4] rounded-md font-medium text-[#24160c] focus:outline-none focus:ring-1 focus:ring-[#8c5e39] w-full sm:w-auto"
        >
          <option value="ALL">All Categories ({categories.length})</option>
          {categories.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Stock Balances Container */}
      <div className="bg-white rounded-lg border border-[#e8decb] shadow-2xs overflow-hidden">
        {/* Mobile Inventory Cards View */}
        <div className="block md:hidden divide-y divide-[#f2eadf]">
          {filteredMaterials.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#9c826e]">
              No inventory materials match your search.
            </div>
          ) : (
            filteredMaterials.map((m) => {
              const available = m.usableWarehouseQty - m.reservedQty;
              const isLowStock = available <= m.minimumStockThreshold;

              return (
                <div key={m.id} className="p-3.5 space-y-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[10px] font-bold text-[#59371d] bg-[#faf6ee] border border-[#ebdcc9] px-1.5 py-0.5 rounded">
                        {m.itemCode}
                      </span>
                      <h3 className="font-bold text-sm text-[#24160c] mt-1">{m.name}</h3>
                      <div className="text-[10px] text-[#7d6553]">{m.categoryName}</div>
                    </div>
                    {isLowStock ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 shrink-0">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>Low Stock</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Adequate</span>
                      </span>
                    )}
                  </div>

                  {/* Available Stock Highlight */}
                  <div className="p-2 bg-[#fbf9f5] rounded-md border border-[#ebdcc9] flex items-center justify-between">
                    <span className="text-[#574830] font-semibold text-xs">Available to Allocate:</span>
                    <span className="font-mono text-sm font-bold text-[#24160c]">{available} Nos</span>
                  </div>

                  {/* Stock Distribution Matrix */}
                  <div className="grid grid-cols-3 gap-2 bg-[#faf6ee]/50 p-2 rounded-md text-center font-mono text-[11px] border border-[#f2eadf]">
                    <div>
                      <span className="text-[#7d6553] font-sans block text-[10px]">Total Owned</span>
                      <span className="font-bold text-[#24160c]">{m.totalOwnedQty}</span>
                    </div>
                    <div>
                      <span className="text-[#7d6553] font-sans block text-[10px]">Warehouse</span>
                      <span className="font-bold text-[#574830]">{m.usableWarehouseQty}</span>
                    </div>
                    <div>
                      <span className="text-[#7d6553] font-sans block text-[10px]">Reserved</span>
                      <span className="font-bold text-blue-700">{m.reservedQty}</span>
                    </div>
                    <div>
                      <span className="text-[#7d6553] font-sans block text-[10px]">On Sites</span>
                      <span className="font-bold text-emerald-700">{m.siteAllocatedQty}</span>
                    </div>
                    <div>
                      <span className="text-[#7d6553] font-sans block text-[10px]">Damaged</span>
                      <span className="font-bold text-amber-700">{m.damagedQty}</span>
                    </div>
                    <div>
                      <span className="text-[#7d6553] font-sans block text-[10px]">Missing</span>
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
            <thead className="bg-[#fbf9f5] text-[#7d6553] uppercase tracking-wider text-[10px] font-semibold border-b border-[#ebdcc9]">
              <tr>
                <th className="px-4 py-2.5">Item Code</th>
                <th className="px-4 py-2.5">Material Description</th>
                <th className="px-4 py-2.5 text-center">Total Owned</th>
                <th className="px-4 py-2.5 text-center">Yard Usable</th>
                <th className="px-4 py-2.5 text-center text-blue-700">Reserved</th>
                <th className="px-4 py-2.5 text-center font-bold text-[#24160c] bg-[#faf6ee]/70 border-x border-[#ebdcc9]">
                  Available to Allocate
                </th>
                <th className="px-4 py-2.5 text-center text-emerald-700">On Sites</th>
                <th className="px-4 py-2.5 text-center text-amber-700">Damaged</th>
                <th className="px-4 py-2.5 text-center text-rose-700">Missing</th>
                <th className="px-4 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2eadf] font-mono">
              {filteredMaterials.map((m) => {
                const available = m.usableWarehouseQty - m.reservedQty;
                const isLowStock = available <= m.minimumStockThreshold;

                return (
                  <tr key={m.id} className="hover:bg-[#faf6ee]/50 transition">
                    <td className="px-4 py-2.5 font-bold text-[#24160c] whitespace-nowrap">{m.itemCode}</td>
                    <td className="px-4 py-2.5 font-sans">
                      <div className="font-semibold text-[#24160c]">{m.name}</div>
                      <div className="text-[10px] text-[#7d6553]">{m.categoryName}</div>
                    </td>
                    <td className="px-4 py-2.5 text-center font-bold text-[#24160c]">{m.totalOwnedQty}</td>
                    <td className="px-4 py-2.5 text-center text-[#574830]">{m.usableWarehouseQty}</td>
                    <td className="px-4 py-2.5 text-center text-blue-700 font-bold">{m.reservedQty}</td>
                    <td className="px-4 py-2.5 text-center font-bold text-[#24160c] bg-[#faf6ee]/70 border-x border-[#ebdcc9]">
                      {available}
                    </td>
                    <td className="px-4 py-2.5 text-center text-emerald-700">{m.siteAllocatedQty}</td>
                    <td className="px-4 py-2.5 text-center text-amber-700">{m.damagedQty}</td>
                    <td className="px-4 py-2.5 text-center text-rose-700 font-bold">{m.missingQty}</td>
                    <td className="px-4 py-2.5 text-center font-sans">
                      {isLowStock ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>Low Stock</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
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
