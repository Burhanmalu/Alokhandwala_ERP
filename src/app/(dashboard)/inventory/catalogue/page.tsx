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
  FolderOpen,
  ChevronRight,
  Warehouse,
  ArrowUpRight
} from 'lucide-react';
import { Material, MaterialCategory } from '@/lib/schema';
import { formatINR, formatQuantity } from '@/lib/formatters';
export default function MaterialCataloguePage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

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

  const activeMaterials = materials.filter(m => !EXCLUDED_ITEM_CODES.includes(m.itemCode));

  // Materials grouped by category with summary stats
  const categorySummaries = categories.map(cat => {
    const items = activeMaterials.filter(m => m.categoryId === cat.id);
    const totalYardUnits = items.reduce((acc, m) => acc + (m.usableWarehouseQty || 0), 0);
    const minRent = items.length > 0 ? Math.min(...items.map(m => m.rentalRatePerMonth || 0)) : 0;
    const maxRent = items.length > 0 ? Math.max(...items.map(m => m.rentalRatePerMonth || 0)) : 0;
    return {
      ...cat,
      items,
      itemCount: items.length,
      totalYardUnits,
      minRent,
      maxRent,
    };
  });

  // Also check uncategorized
  const uncategorizedItems = activeMaterials.filter(
    m => !categories.some(cat => cat.id === m.categoryId)
  );

  // When a category is active or search is entered, determine items to display
  const currentCategory = activeCategoryId
    ? categorySummaries.find(c => c.id === activeCategoryId) || (activeCategoryId === 'UNCATEGORIZED' ? {
        id: 'UNCATEGORIZED',
        name: 'General & Uncategorized',
        description: 'Items without a specific category assignment',
        code: 'UNCAT',
        items: uncategorizedItems,
        itemCount: uncategorizedItems.length,
        totalYardUnits: uncategorizedItems.reduce((acc, m) => acc + (m.usableWarehouseQty || 0), 0),
        minRent: uncategorizedItems.length > 0 ? Math.min(...uncategorizedItems.map(m => m.rentalRatePerMonth || 0)) : 0,
        maxRent: uncategorizedItems.length > 0 ? Math.max(...uncategorizedItems.map(m => m.rentalRatePerMonth || 0)) : 0,
      } : null)
    : null;

  const displayedItems = (currentCategory ? currentCategory.items : activeMaterials).filter(m => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.itemCode.toLowerCase().includes(q) ||
      m.categoryName?.toLowerCase().includes(q) ||
      m.description?.toLowerCase().includes(q)
    );
  });

  // Filter categories on front page if search query is present
  const filteredCategorySummaries = categorySummaries.filter(cat => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesCat = cat.name.toLowerCase().includes(q) || cat.description?.toLowerCase().includes(q);
    const matchesAnyItem = cat.items.some(m => 
      m.name.toLowerCase().includes(q) || 
      m.itemCode.toLowerCase().includes(q) ||
      m.description?.toLowerCase().includes(q)
    );
    return matchesCat || matchesAnyItem;
  });
  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-stone-500">
        <Link href="/inventory" className="hover:text-[#24160c] flex items-center gap-1 transition">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Inventory Overview</span>
        </Link>
        <span>/</span>
        {activeCategoryId ? (
          <>
            <button 
              onClick={() => { setActiveCategoryId(null); setSearchQuery(''); }}
              className="hover:text-[#24160c] transition cursor-pointer text-stone-600 underline-offset-2 hover:underline"
            >
              Inventory Catalogue
            </button>
            <span>/</span>
            <span className="font-semibold text-stone-800">{currentCategory?.name || 'Category'}</span>
          </>
        ) : (
          <span className="font-semibold text-stone-800">Inventory Catalogue</span>
        )}
      </div>

      {/* Header Banner */}
      <div className="bg-[#24160c] border border-[#19100a] rounded-xl p-5 sm:p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xs font-mono tracking-widest text-[#c79e7c] uppercase">Master Specifications</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Boxes className="w-6 h-6 text-[#c79e7c]" />
            <span>{activeCategoryId && currentCategory ? currentCategory.name : 'Inventory Catalogue'}</span>
          </h1>
          {activeCategoryId && currentCategory?.description && (
            <p className="text-xs text-[#debfa6] mt-1">{currentCategory.description}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {activeCategoryId && (
            <button
              onClick={() => { setActiveCategoryId(null); setSearchQuery(''); }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-[#fdfbf7] bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>All Categories</span>
            </button>
          )}
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
            placeholder={
              activeCategoryId
                ? `Search materials in ${currentCategory?.name || 'this category'}...`
                : "Search categories or material specifications..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#fbf9f5] border border-[#d8c8b4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8c5e39]/20 focus:border-[#8c5e39] text-[#24160c] placeholder:text-[#9c826e]"
          />
        </div>

        {activeCategoryId ? (
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={() => { setActiveCategoryId(null); setSearchQuery(''); }}
              className="w-full sm:w-auto px-4 py-2.5 bg-[#fbf9f5] hover:bg-[#f3ede2] border border-[#d8c8b4] rounded-lg text-xs font-bold text-[#4d301c] transition flex items-center justify-center gap-2"
            >
              <Layers className="w-4 h-4 text-[#8c5e39]" />
              <span>View All Categories</span>
            </button>
          </div>
        ) : (
          <div className="text-xs font-mono text-[#7d6553] px-2 py-1">
            <span className="font-bold text-[#24160c]">{filteredCategorySummaries.length}</span> Categories Available
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-stone-500 bg-white rounded-xl border border-[#ebdcc9]">
          Loading inventory catalogue from database...
        </div>
      ) : !activeCategoryId ? (
        /* FRONT PAGE: Square Category Cards with Basic Details */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCategorySummaries.map((cat) => (
              <div
                key={cat.id}
                onClick={() => {
                  setActiveCategoryId(cat.id);
                  setSearchQuery('');
                }}
                className="group bg-white rounded-xl border border-[#ebdcc9] hover:border-[#8c5e39] p-4 sm:p-4.5 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between relative overflow-hidden"
              >
                {/* Subtle decorative background accent */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#faf6ee] rounded-bl-full pointer-events-none -mr-4 -mt-4 transition group-hover:bg-[#f5efe6]" />

                {/* Top Section */}
                <div className="relative z-10 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-[#24160c] text-[#dfcbab] flex items-center justify-center font-bold shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                        <Layers className="w-5 h-5 text-[#c79e7c]" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-[#24160c] group-hover:text-[#8c5e39] transition leading-snug truncate">
                          {cat.name}
                        </h3>
                        <span className="inline-block text-2xs font-mono font-bold px-2 py-0.5 rounded-md bg-[#fbf9f5] border border-[#ebdcc9] text-[#7d6553] mt-0.5">
                          {cat.code}
                        </span>
                      </div>
                    </div>
                  </div>

                  {cat.description && (
                    <p className="text-xs text-[#7d6553] line-clamp-2 leading-relaxed">
                      {cat.description}
                    </p>
                  )}
                </div>

                {/* Bottom Section: Compact metric counters & footer */}
                <div className="relative z-10 pt-3 mt-3 border-t border-[#f2e7db] space-y-2.5">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-[#fbf9f5] rounded-lg px-2.5 py-1.5 border border-[#ebdcc9]">
                      <div className="text-[10px] text-[#9c826e] uppercase tracking-wider font-semibold">SKUs</div>
                      <div className="text-sm font-bold text-[#24160c] font-mono">
                        {cat.itemCount} <span className="text-[11px] font-normal text-[#7d6553]">items</span>
                      </div>
                    </div>
                    <div className="bg-[#fbf9f5] rounded-lg px-2.5 py-1.5 border border-[#ebdcc9]">
                      <div className="text-[10px] text-[#9c826e] uppercase tracking-wider font-semibold">Yard Units</div>
                      <div className="text-sm font-bold text-emerald-800 font-mono">
                        {cat.totalYardUnits.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#8c5e39] font-semibold group-hover:translate-x-0.5 transition-transform">
                    <span>
                      {cat.minRent > 0 ? (
                        <span className="font-mono text-[#7d6553] text-[11px]">
                          From <strong className="text-[#24160c]">{formatINR(cat.minRent)}</strong>/mo
                        </span>
                      ) : (
                        <span className="text-[#7d6553] text-[11px]">View catalogue</span>
                      )}
                    </span>
                    <div className="inline-flex items-center gap-1 font-bold">
                      <span>Open</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Uncategorized Card if any items exist */}
            {uncategorizedItems.length > 0 && (
              <div
                onClick={() => {
                  setActiveCategoryId('UNCATEGORIZED');
                  setSearchQuery('');
                }}
                className="group bg-white rounded-xl border border-[#ebdcc9] hover:border-[#8c5e39] p-4 sm:p-4.5 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between relative overflow-hidden"
              >
                <div className="relative z-10 space-y-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-stone-100 text-[#7d6553] flex items-center justify-center font-bold shrink-0">
                      <Package className="w-5 h-5 text-[#8c5e39]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-[#24160c] group-hover:text-[#8c5e39] transition truncate">
                        General & Uncategorized
                      </h3>
                      <span className="inline-block text-2xs font-mono font-bold px-2 py-0.5 rounded-md bg-[#fbf9f5] border border-[#ebdcc9] text-[#7d6553] mt-0.5">
                        MISC
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-[#7d6553] line-clamp-2 leading-relaxed">
                    Materials not categorized under standard headings
                  </p>
                </div>

                <div className="relative z-10 pt-3 mt-3 border-t border-[#f2e7db] space-y-2.5">
                  <div className="bg-[#fbf9f5] rounded-lg px-2.5 py-1.5 border border-[#ebdcc9]">
                    <div className="text-[10px] text-[#9c826e] uppercase tracking-wider font-semibold">SKUs</div>
                    <div className="text-sm font-bold text-[#24160c] font-mono">
                      {uncategorizedItems.length} <span className="text-[11px] font-normal text-[#7d6553]">items</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#8c5e39] font-bold">
                    <span>Open Category</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {filteredCategorySummaries.length === 0 && (
            <div className="p-12 text-center text-sm text-stone-500 bg-white rounded-xl border border-[#ebdcc9] space-y-3">
              <FolderOpen className="w-10 h-10 text-[#9c826e] mx-auto opacity-60" />
              <p className="font-semibold text-[#24160c]">No categories matched &quot;{searchQuery}&quot;</p>
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 text-xs font-bold text-[#24160c] bg-[#fbf9f5] border border-[#d8c8b4] rounded-lg hover:bg-stone-100"
              >
                Clear Search Filter
              </button>
            </div>
          )}
        </div>
      ) : (
        /* DRILL-DOWN: Flat list of materials under selected category */
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#ebdcc9] shadow-2xs overflow-hidden">
            {/* Category Umbrella Header */}
            <div className="bg-[#fbf9f5] px-5 py-4 border-b border-[#ebdcc9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setActiveCategoryId(null); setSearchQuery(''); }}
                  className="w-8 h-8 rounded-lg bg-white border border-[#d8c8b4] hover:bg-[#faf6ee] text-[#24160c] flex items-center justify-center transition cursor-pointer shrink-0"
                  title="Back to categories"
                >
                  <ArrowLeft className="w-4 h-4 text-[#4d301c]" />
                </button>
                <div className="w-8 h-8 rounded-lg bg-[#24160c] text-[#dfcbab] flex items-center justify-center font-bold text-sm shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#24160c] tracking-tight">
                    {currentCategory?.name}
                  </h2>
                  {currentCategory?.description && (
                    <p className="text-2xs text-[#7d6553]">{currentCategory.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-[#ebdcc9] text-[#4d301c] border border-[#d8c8b4]">
                  {displayedItems.length} Material SKU{displayedItems.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {displayedItems.length === 0 ? (
              <div className="p-12 text-center text-sm text-stone-500 space-y-3">
                <FolderOpen className="w-8 h-8 text-[#9c826e] mx-auto opacity-60" />
                <p className="font-semibold text-[#24160c]">No material records in this category matched your search.</p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-3.5 py-1.5 text-xs font-bold text-[#24160c] bg-[#fbf9f5] border border-[#d8c8b4] rounded-lg"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              /* Flat Table List under this Category Umbrella */
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
                    {displayedItems.map((mat) => (
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
