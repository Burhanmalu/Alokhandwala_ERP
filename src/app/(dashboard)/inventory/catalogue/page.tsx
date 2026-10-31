'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Boxes, 
  Search, 
  Scale, 
  ReceiptIndianRupee, 
  Plus, 
  Layers, 
  Package, 
  Filter,
  CheckCircle2,
  FolderOpen
} from 'lucide-react';
import { Material, MaterialCategory } from '@/lib/schema';
import { formatINR, formatQuantity } from '@/lib/formatters';

export default function MaterialCataloguePage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');

  useEffect(() => {
    fetch('/api/inventory')
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setMaterials(json.data.materials || []);
          setCategories(json.data.categories || []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const EXCLUDED_ITEM_CODES = ['BASE-PLATE-STD', 'TOE-BOARD-8FT', 'CPL-SWIVEL', 'CPL-FIXED'];

  const filteredMaterials = materials.filter(m => {
    if (EXCLUDED_ITEM_CODES.includes(m.itemCode)) return false;
    if (selectedCategoryId !== 'ALL' && m.categoryId !== selectedCategoryId) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.itemCode.toLowerCase().includes(q) ||
      m.categoryName?.toLowerCase().includes(q) ||
      m.description?.toLowerCase().includes(q)
    );
  });

  // Group materials under Material Categories umbrella
  const groupedCategories = categories
    .map(cat => ({
      ...cat,
      items: filteredMaterials.filter(m => m.categoryId === cat.id),
    }))
    .filter(group => selectedCategoryId === 'ALL' || group.id === selectedCategoryId)
    // Only show category if it has items or no search is active
    .filter(group => group.items.length > 0 || !searchQuery.trim());

  // Also catch any materials whose categoryId doesn't match standard category list
  const uncategorizedItems = filteredMaterials.filter(
    m => !categories.some(cat => cat.id === m.categoryId)
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-stone-500">
        <Link href="/inventory" className="hover:text-[#24160c] flex items-center gap-1 transition">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Inventory Overview</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-stone-800">Inventory Catalogue</span>
      </div>

      {/* Header Banner */}
      <div className="bg-[#24160c] border border-[#19100a] rounded-xl p-5 sm:p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xs font-mono tracking-widest text-[#c79e7c] uppercase">Master Specifications</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Boxes className="w-6 h-6 text-[#c79e7c]" />
            <span>Inventory Catalogue</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/inventory/new"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-[#1c120c] bg-[#c79e7c] hover:bg-[#dfcbab] rounded-lg shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Material</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#ebdcc9] shadow-2xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[#9c826e] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search material SKU, description, dimensions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#fbf9f5] border border-[#d8c8b4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8c5e39]/20 focus:border-[#8c5e39] text-[#24160c] placeholder:text-[#9c826e]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <Filter className="w-4 h-4 text-[#8c5e39] shrink-0" />
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="w-full sm:w-auto py-2.5 px-3 bg-white border border-[#d8c8b4] rounded-lg text-sm text-[#24160c] font-medium focus:outline-none focus:border-[#8c5e39]"
          >
            <option value="ALL">All Categories ({categories.length})</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-stone-500 bg-white rounded-xl border border-[#ebdcc9]">
          Loading inventory catalogue from database...
        </div>
      ) : groupedCategories.length === 0 && uncategorizedItems.length === 0 ? (
        <div className="p-12 text-center text-sm text-stone-500 bg-white rounded-xl border border-[#ebdcc9] space-y-3">
          <FolderOpen className="w-10 h-10 text-[#9c826e] mx-auto opacity-60" />
          <p className="font-semibold text-[#24160c]">No material records matched your filters.</p>
          <Link
            href="/inventory/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#24160c] rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Material</span>
          </Link>
        </div>
      ) : (
        /* Render Inventory beneath the umbrella of Material Categories */
        <div className="space-y-6">
          {groupedCategories.map((group) => {
            if (group.items.length === 0) return null;

            return (
              <div 
                key={group.id} 
                className="bg-white rounded-xl border border-[#ebdcc9] shadow-2xs overflow-hidden"
              >
                {/* Category Umbrella Header */}
                <div className="bg-[#fbf9f5] px-5 py-4 border-b border-[#ebdcc9] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#24160c] text-[#dfcbab] flex items-center justify-center font-bold text-sm shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-[#24160c] tracking-tight">
                        {group.name}
                      </h2>
                      {group.description && (
                        <p className="text-2xs text-[#7d6553]">{group.description}</p>
                      )}
                    </div>
                  </div>

                  <span className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-[#ebdcc9] text-[#4d301c] border border-[#d8c8b4] self-start sm:self-auto">
                    {group.items.length} Material SKU{group.items.length === 1 ? '' : 's'}
                  </span>
                </div>

                {/* Flat Table List under this Category Umbrella */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#faf6ee]/50 text-[#7d6553] uppercase tracking-wider text-2xs font-bold border-b border-[#ebdcc9]">
                      <tr>
                        <th className="px-5 py-3">Item Code</th>
                        <th className="px-5 py-3">Specification / Description</th>
                        <th className="px-5 py-3 text-right">Standard Weight</th>
                        <th className="px-5 py-3 text-right">Purchase Cost</th>
                        <th className="px-5 py-3 text-right">Rental Rate/mo</th>
                        <th className="px-5 py-3 text-right">Yard Balance</th>
                        <th className="px-5 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f5efe6] font-mono">
                      {group.items.map((mat) => (
                        <tr key={mat.id} className="hover:bg-[#fbf9f5]/80 transition">
                          <td className="px-5 py-3.5 font-bold text-[#24160c] whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-md bg-[#fbf9f5] border border-[#ebdcc9] text-[#24160c]">
                              {mat.itemCode}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-sans">
                            <div className="font-bold text-[#24160c]">{mat.name}</div>
                            {mat.description && (
                              <div className="text-2xs text-[#7d6553] line-clamp-1 max-w-md">{mat.description}</div>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right font-medium text-stone-700">
                            {mat.standardWeightKg} kg
                          </td>
                          <td className="px-5 py-3.5 text-right font-semibold text-stone-900">
                            {formatINR(mat.purchaseCost)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-[#8c5e39]">
                            {formatINR(mat.rentalRatePerMonth)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-emerald-800">
                            {formatQuantity(mat.usableWarehouseQty, mat.unitOfMeasurement)}
                          </td>
                          <td className="px-5 py-3.5 text-center font-sans">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Active
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* Any Uncategorized Items */}
          {uncategorizedItems.length > 0 && (
            <div className="bg-white rounded-xl border border-[#ebdcc9] shadow-2xs overflow-hidden">
              <div className="bg-[#fbf9f5] px-5 py-4 border-b border-[#ebdcc9] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-[#8c5e39]" />
                  <h2 className="text-base font-bold text-[#24160c]">General & Uncategorized</h2>
                </div>
                <span className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-[#ebdcc9] text-[#4d301c]">
                  {uncategorizedItems.length} SKUs
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <tbody className="divide-y divide-[#f5efe6] font-mono">
                    {uncategorizedItems.map((mat) => (
                      <tr key={mat.id} className="hover:bg-[#fbf9f5]/80 transition">
                        <td className="px-5 py-3.5 font-bold text-[#24160c]">{mat.itemCode}</td>
                        <td className="px-5 py-3.5 font-sans font-bold text-[#24160c]">{mat.name}</td>
                        <td className="px-5 py-3.5 text-right font-medium">{mat.standardWeightKg} kg</td>
                        <td className="px-5 py-3.5 text-right font-bold text-[#8c5e39]">{formatINR(mat.rentalRatePerMonth)}</td>
                        <td className="px-5 py-3.5 text-right font-bold text-emerald-800">{mat.usableWarehouseQty} Nos</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
