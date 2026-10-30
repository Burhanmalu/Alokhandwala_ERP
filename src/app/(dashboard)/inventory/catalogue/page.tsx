'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Boxes, 
  Search, 
  Ruler, 
  ReceiptIndianRupee, 
  Scale 
} from 'lucide-react';
import { Material } from '@/lib/schema';
import { formatINR, formatQuantity } from '@/lib/formatters';

export default function MaterialCataloguePage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch('/api/inventory')
      .then(r => r.json())
      .then(json => {
        if (json.success) setMaterials(json.data.materials);
      })
      .finally(() => setLoading(false));
  }, []);

  const EXCLUDED_ITEM_CODES = ['BASE-PLATE-STD', 'TOE-BOARD-8FT', 'CPL-SWIVEL', 'CPL-FIXED'];
  const filtered = materials.filter(m => {
    if (EXCLUDED_ITEM_CODES.includes(m.itemCode)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.itemCode.toLowerCase().includes(q) || m.categoryName?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/inventory" className="hover:text-emerald-700 flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Inventory Overview</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800">Material Catalogue</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-emerald-600" />
            <span>Scaffolding Master Catalogue & SKU Specifications</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Standard specifications, unit weights, purchase costs, and monthly rental tariffs.
          </p>
        </div>
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search material specifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
          />
        </div>
        <div className="text-slate-500 font-medium">Total Items: <span className="font-bold text-slate-800">{filtered.length}</span></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((mat) => (
          <div key={mat.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3 hover:border-emerald-300 transition">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                  {mat.itemCode}
                </span>
                <h3 className="font-bold text-sm text-slate-900 mt-1">{mat.name}</h3>
                <div className="text-[11px] text-emerald-700 font-semibold">{mat.categoryName}</div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                Active
              </span>
            </div>

            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
              {mat.description}
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs font-mono">
              <div className="bg-slate-50 p-2 rounded-lg">
                <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                  <Scale className="w-3 h-3 text-slate-400" />
                  <span>Std Weight</span>
                </div>
                <div className="font-bold text-slate-800 mt-0.5">{mat.standardWeightKg} kg</div>
              </div>

              <div className="bg-slate-50 p-2 rounded-lg">
                <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                  <ReceiptIndianRupee className="w-3 h-3 text-slate-400" />
                  <span>Rental Rate/mo</span>
                </div>
                <div className="font-bold text-emerald-700 mt-0.5">{formatINR(mat.rentalRatePerMonth)}</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-500">
              <span>Purchase Cost: {formatINR(mat.purchaseCost)}</span>
              <span>Min Alert: {mat.minimumStockThreshold} {mat.unitOfMeasurement}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
