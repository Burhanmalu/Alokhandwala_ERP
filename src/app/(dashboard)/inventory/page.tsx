'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Boxes,
  Search,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  Warehouse as WarehouseIcon,
  Layers,
  ArrowRightLeft,
  ShieldAlert,
  ArrowLeft,
  X,
  Building2,
  Clock,
  Filter,
  Check,
  ChevronDown,
  ChevronRight,
  Info
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { Material, Project } from '@/lib/schema';
import { formatQuantity, formatINR } from '@/lib/formatters';

export default function InventoryOverviewPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-xs text-[#7d6553]">Loading Inventory...</div>}>
      <InventoryOverviewContent />
    </React.Suspense>
  );
}

type StockFilterType = 'all' | 'usable' | 'reserved' | 'allocated' | 'damaged' | 'missing';

function InventoryOverviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterParam = (searchParams.get('filter')?.toLowerCase() as StockFilterType) || 'all';

  const { currentUser } = useAuth();
  const [data, setData] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStockFilter, setSelectedStockFilter] = useState<StockFilterType>(filterParam);
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'ADMIN') {
      if (currentUser.role === 'SUPERVISOR') {
        router.replace('/sites/new');
      } else {
        router.replace('/projects');
      }
    }
  }, [currentUser, router]);

  // Sync state if URL search param changes (e.g. back/forward navigation or dashboard click)
  useEffect(() => {
    if (filterParam && ['all', 'usable', 'reserved', 'allocated', 'damaged', 'missing'].includes(filterParam)) {
      setSelectedStockFilter(filterParam);
    }
  }, [filterParam]);

  useEffect(() => {
    Promise.all([
      fetch('/api/inventory').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
    ])
      .then(([invJson, projJson]) => {
        if (invJson.success) setData(invJson.data);
        if (projJson.success) setProjects(projJson.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSelectStockFilter = (filterKey: StockFilterType) => {
    setSelectedStockFilter(filterKey);
    const params = new URLSearchParams(searchParams.toString());
    if (filterKey === 'all') {
      params.delete('filter');
    } else {
      params.set('filter', filterKey);
    }
    const newQuery = params.toString() ? `?${params.toString()}` : '';
    router.replace(`/inventory${newQuery}`);
  };

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-10 bg-white border border-[#ebdcc9] rounded-lg"></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-24 bg-white border border-[#ebdcc9] rounded-xl"></div>
          <div className="h-24 bg-white border border-[#ebdcc9] rounded-xl"></div>
          <div className="h-24 bg-white border border-[#ebdcc9] rounded-xl"></div>
          <div className="h-24 bg-white border border-[#ebdcc9] rounded-xl"></div>
        </div>
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

  // Filter materials based on search, category, and selected stock filter
  const filteredMaterials = materials.filter(m => {
    // 1. Stock Category Filter from Dashboard
    if (selectedStockFilter === 'usable' && (m.usableWarehouseQty || 0) <= 0) return false;
    if (selectedStockFilter === 'reserved' && (m.reservedQty || 0) <= 0) return false;
    if (selectedStockFilter === 'allocated' && (m.siteAllocatedQty || 0) <= 0) return false;
    if (selectedStockFilter === 'damaged' && (m.damagedQty || 0) <= 0) return false;
    if (selectedStockFilter === 'missing' && (m.missingQty || 0) <= 0) return false;

    // 2. Material Category Dropdown Filter
    if (selectedCategory !== 'ALL' && m.categoryId !== selectedCategory) return false;

    // 3. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.itemCode.toLowerCase().includes(q) ||
        (m.categoryName && m.categoryName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Project linkages helper for allocated and reserved materials
  const getMaterialProjectDetails = (materialId: string) => {
    const reservedList: { project: Project; qty: number }[] = [];
    const allocatedList: { project: Project; qty: number }[] = [];

    for (const p of projects) {
      if (!p.materials || !Array.isArray(p.materials)) continue;
      for (const pm of p.materials) {
        if (pm.materialId === materialId) {
          if (pm.reservedQuantity > 0) {
            reservedList.push({ project: p, qty: pm.reservedQuantity });
          }
          if (pm.installedQuantity > 0) {
            allocatedList.push({ project: p, qty: pm.installedQuantity });
          }
        }
      }
    }

    return { reservedList, allocatedList };
  };

  const FILTER_CONFIG: Record<StockFilterType, { label: string; count: number; colorClass: string; desc: string }> = {
    all: {
      label: 'All Materials',
      count: materials.length,
      colorClass: 'text-[#24160c] border-[#8c5e39] bg-[#faf6ee]',
      desc: 'Complete inventory fleet catalog and stock distribution.',
    },
    usable: {
      label: 'Warehouse Usable',
      count: materials.filter(m => (m.usableWarehouseQty || 0) > 0).length,
      colorClass: 'text-[#24160c] border-[#8c5e39] bg-[#faf6ee]',
      desc: 'Usable stock stored at Indore Central Scaffolding Yard ready for dispatch.',
    },
    reserved: {
      label: 'Reserved for Sites',
      count: materials.filter(m => (m.reservedQty || 0) > 0).length,
      colorClass: 'text-blue-800 border-blue-400 bg-blue-50',
      desc: 'Stock held for confirmed site projects awaiting field installation.',
    },
    allocated: {
      label: 'Allocated on Sites',
      count: materials.filter(m => (m.siteAllocatedQty || 0) > 0).length,
      colorClass: 'text-emerald-800 border-emerald-400 bg-emerald-50',
      desc: 'Materials currently installed and on active client rental sites.',
    },
    damaged: {
      label: 'Damage Material',
      count: materials.filter(m => (m.damagedQty || 0) > 0).length,
      colorClass: 'text-amber-800 border-amber-400 bg-amber-50',
      desc: 'Materials returned in damaged condition in yard quarantine awaiting repair/scrap.',
    },
    missing: {
      label: 'Missing Material',
      count: materials.filter(m => (m.missingQty || 0) > 0).length,
      colorClass: 'text-rose-800 border-rose-400 bg-rose-50',
      desc: 'Unreconciled missing items identified during site dismantling for billing recovery.',
    },
  };

  return (
    <div className="space-y-5">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-[#7d6553]">
        <Link href="/" className="hover:text-[#24160c] flex items-center gap-1 transition">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-[#24160c]">Inventory Management</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5dac8]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#9c826e]">
            <span>Asset Control & Fleet</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#24160c] mt-0.5 flex items-center gap-2.5">
            <Boxes className="w-6 h-6 text-[#8c5e39]" />
            <span>Inventory Fleet Control</span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/inventory/new"
            className="px-3.5 py-2 text-xs font-bold text-white bg-[#24150c] hover:bg-[#382315] border border-[#4d301c] rounded-lg shadow-2xs transition flex items-center gap-1.5"
          >
            <span>+ Add Material</span>
          </Link>
        </div>
      </div>

      {/* Numeric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#e8decb] shadow-2xs">
          <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#7d6553]">
            Yard Usable
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#24160c] font-mono mt-1">
            {formatQuantity(summary.usableWarehouseQty)} <span className="text-xs sm:text-sm font-sans font-normal text-[#7d6553]">Nos</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#e8decb] shadow-2xs">
          <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#7d6553]">
            Reserved
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-blue-700 font-mono mt-1">
            {formatQuantity(summary.reservedQty)} <span className="text-xs sm:text-sm font-sans font-normal text-[#7d6553]">Nos</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#e8decb] shadow-2xs">
          <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#7d6553]">
            On Sites
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-700 font-mono mt-1">
            {formatQuantity(summary.siteAllocatedQty)} <span className="text-xs sm:text-sm font-sans font-normal text-[#7d6553]">Nos</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#e8decb] shadow-2xs">
          <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#7d6553]">
            Damaged
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-700 font-mono mt-1">
            {formatQuantity(summary.damagedQty)} <span className="text-xs sm:text-sm font-sans font-normal text-[#7d6553]">Nos</span>
          </div>
        </div>
      </div>

      {/* Interactive Stock Filter Tabs (Linked directly to Dashboard Cards) */}
      <div className="bg-white p-3 rounded-lg border border-[#e8decb] shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-[#f2eadf] pb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#24160c] uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-[#8c5e39]" />
            <span>Filter Inventory by Stock Category</span>
          </div>
          {selectedStockFilter !== 'all' && (
            <button
              onClick={() => handleSelectStockFilter('all')}
              className="text-[11px] font-semibold text-[#8c5e39] hover:text-[#24160c] flex items-center gap-1 transition cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Clear Filter (Show All)</span>
            </button>
          )}
        </div>

        {/* 6 Quick Category Filter Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {(['all', 'usable', 'reserved', 'allocated', 'damaged', 'missing'] as StockFilterType[]).map((fKey) => {
            const conf = FILTER_CONFIG[fKey];
            const isSelected = selectedStockFilter === fKey;

            return (
              <button
                key={fKey}
                type="button"
                onClick={() => handleSelectStockFilter(fKey)}
                className={`p-2.5 rounded-lg border text-left transition duration-150 cursor-pointer flex flex-col justify-between ${isSelected
                    ? `${conf.colorClass} border-2 shadow-xs font-bold`
                    : 'bg-[#fbf9f5] border-[#ebdcc9] text-[#7d6553] hover:border-[#8c5e39] hover:bg-white'
                  }`}
              >
                <div className="flex items-center justify-between text-[10px] uppercase font-semibold">
                  <span className="truncate">{conf.label}</span>
                  {isSelected && <Check className="w-3 h-3 shrink-0" />}
                </div>
                <div className="text-sm font-bold font-mono mt-1">
                  {conf.count} <span className="text-[10px] font-sans font-normal text-[#8c7360]">SKUs</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Filter Notification Bar */}
        {selectedStockFilter !== 'all' && (
          <div className="p-3 bg-[#faf6ee] border border-[#ebdcc9] rounded-lg text-xs text-[#574830] flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#8c5e39] shrink-0" />
              <div>
                <span className="font-bold text-[#24160c]">Active Filter: {FILTER_CONFIG[selectedStockFilter].label}.</span>{' '}
                <span className="text-[#7d6553]">{FILTER_CONFIG[selectedStockFilter].desc}</span>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold text-[#24160c] bg-white px-2 py-0.5 rounded border border-[#ebdcc9]">
                {filteredMaterials.length} of {materials.length} Materials
              </span>
              <button
                onClick={() => handleSelectStockFilter('all')}
                className="px-2.5 py-1 text-[11px] font-semibold bg-[#24160c] text-white rounded hover:bg-[#382315] transition cursor-pointer"
              >
                Reset Filter
              </button>
            </div>
          </div>
        )}
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
            className="w-full pl-9 pr-3 py-1.5 bg-[#faf6ee]/50 border border-[#d8c8b4] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#8c5e39] text-[#24160c] placeholder:text-[#9c826e]"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-1.5 bg-white border border-[#d8c8b4] rounded-md font-medium text-[#24160c] focus:outline-hidden focus:ring-1 focus:ring-[#8c5e39] w-full sm:w-auto cursor-pointer"
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
            <div className="p-8 text-center text-xs text-[#9c826e] space-y-2">
              <p className="font-semibold text-[#24160c]">No inventory materials match the selected filter.</p>
              <button
                onClick={() => handleSelectStockFilter('all')}
                className="text-xs text-[#8c5e39] font-bold underline"
              >
                Clear filter and show all materials
              </button>
            </div>
          ) : (
            filteredMaterials.map((m) => {
              const available = m.usableWarehouseQty - m.reservedQty;
              const isLowStock = available <= m.minimumStockThreshold;
              const { reservedList, allocatedList } = getMaterialProjectDetails(m.id);
              const isExpanded = expandedMaterialId === m.id;

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
                    <div className={selectedStockFilter === 'usable' ? 'bg-amber-100 rounded' : ''}>
                      <span className="text-[#7d6553] font-sans block text-[10px]">Yard Usable</span>
                      <span className="font-bold text-[#574830]">{m.usableWarehouseQty}</span>
                    </div>
                    <div className={selectedStockFilter === 'reserved' ? 'bg-blue-100 rounded' : ''}>
                      <span className="text-[#7d6553] font-sans block text-[10px]">Reserved</span>
                      <span className="font-bold text-blue-700">{m.reservedQty}</span>
                    </div>
                    <div className={selectedStockFilter === 'allocated' ? 'bg-emerald-100 rounded' : ''}>
                      <span className="text-[#7d6553] font-sans block text-[10px]">On Sites</span>
                      <span className="font-bold text-emerald-700">{m.siteAllocatedQty}</span>
                    </div>
                    <div className={selectedStockFilter === 'damaged' ? 'bg-amber-200 rounded' : ''}>
                      <span className="text-[#7d6553] font-sans block text-[10px]">Damage Material</span>
                      <span className="font-bold text-amber-700">{m.damagedQty}</span>
                    </div>
                    <div className={selectedStockFilter === 'missing' ? 'bg-rose-100 rounded' : ''}>
                      <span className="text-[#7d6553] font-sans block text-[10px]">Missing Material</span>
                      <span className="font-bold text-rose-700">{m.missingQty}</span>
                    </div>
                  </div>

                  {/* Project Allocations Collapsible */}
                  {(reservedList.length > 0 || allocatedList.length > 0) && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setExpandedMaterialId(isExpanded ? null : m.id)}
                        className="text-[11px] font-semibold text-[#8c5e39] flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        <span>Site & Project Allocation Details ({reservedList.length + allocatedList.length})</span>
                      </button>

                      {isExpanded && (
                        <div className="mt-2 p-2.5 bg-white border border-[#ebdcc9] rounded-lg space-y-2 text-[11px]">
                          {reservedList.length > 0 && (
                            <div>
                              <div className="font-bold text-blue-900 mb-1">Reserved In Projects:</div>
                              <div className="space-y-1">
                                {reservedList.map(({ project, qty }) => (
                                  <div key={project.id} className="flex justify-between items-center text-[#24160c] bg-blue-50/50 p-1 rounded">
                                    <span>
                                      <Link href={`/projects/${project.id}`} className="font-bold hover:underline">{project.projectCode}</Link> - {project.siteName}
                                    </span>
                                    <span className="font-mono font-bold text-blue-700">{qty} Nos</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {allocatedList.length > 0 && (
                            <div>
                              <div className="font-bold text-emerald-900 mb-1">Active On Sites:</div>
                              <div className="space-y-1">
                                {allocatedList.map(({ project, qty }) => (
                                  <div key={project.id} className="flex justify-between items-center text-[#24160c] bg-emerald-50/50 p-1 rounded">
                                    <span>
                                      <Link href={`/projects/${project.id}`} className="font-bold hover:underline">{project.projectCode}</Link> - {project.siteName}
                                    </span>
                                    <span className="font-mono font-bold text-emerald-700">{qty} Nos</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
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
                <th className={`px-4 py-2.5 text-center ${selectedStockFilter === 'usable' ? 'bg-[#ebdcc9]/50 font-bold text-[#24160c]' : 'text-[#574830]'}`}>
                  Yard Usable
                </th>
                <th className={`px-4 py-2.5 text-center ${selectedStockFilter === 'reserved' ? 'bg-blue-100 font-bold text-blue-900' : 'text-blue-700'}`}>
                  Reserved
                </th>
                <th className="px-4 py-2.5 text-center font-bold text-[#24160c] bg-[#faf6ee]/70 border-x border-[#ebdcc9]">
                  Available to Allocate
                </th>
                <th className={`px-4 py-2.5 text-center ${selectedStockFilter === 'allocated' ? 'bg-emerald-100 font-bold text-emerald-900' : 'text-emerald-700'}`}>
                  Allocated on Sites
                </th>
                <th className={`px-4 py-2.5 text-center ${selectedStockFilter === 'damaged' ? 'bg-amber-100 font-bold text-amber-900' : 'text-amber-700'}`}>
                  Damage Material
                </th>
                <th className={`px-4 py-2.5 text-center ${selectedStockFilter === 'missing' ? 'bg-rose-100 font-bold text-rose-900' : 'text-rose-700'}`}>
                  Missing Material
                </th>
                <th className="px-4 py-2.5 text-center">Location / Project Linkage</th>
                <th className="px-4 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2eadf] font-mono">
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-xs text-[#9c826e] font-sans">
                    <p className="font-semibold text-sm text-[#24160c]">No inventory materials match the selected filter ({FILTER_CONFIG[selectedStockFilter].label}).</p>
                    <p className="text-[11px] text-[#7d6553] mt-1">There are currently zero items recorded in this stock category.</p>
                    <div className="pt-3">
                      <button
                        onClick={() => handleSelectStockFilter('all')}
                        className="px-3.5 py-1.5 bg-[#24160c] hover:bg-[#382315] text-white rounded-md text-xs font-semibold transition cursor-pointer"
                      >
                        Clear Filter & View All Materials
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMaterials.map((m) => {
                  const available = m.usableWarehouseQty - m.reservedQty;
                  const isLowStock = available <= m.minimumStockThreshold;
                  const { reservedList, allocatedList } = getMaterialProjectDetails(m.id);

                  // Primary Location text
                  let locationText = 'Indore Central Yard';
                  if (selectedStockFilter === 'allocated' && allocatedList.length > 0) {
                    locationText = `${allocatedList.length} Site(s): ${allocatedList[0].project.projectCode}`;
                  } else if (selectedStockFilter === 'reserved' && reservedList.length > 0) {
                    locationText = `${reservedList.length} Project(s): ${reservedList[0].project.projectCode}`;
                  } else if (selectedStockFilter === 'damaged') {
                    locationText = 'Yard Quarantine';
                  } else if (selectedStockFilter === 'missing') {
                    locationText = 'Missing Ledger';
                  }

                  return (
                    <tr key={m.id} className="hover:bg-[#faf6ee]/50 transition">
                      <td className="px-4 py-2.5 font-bold text-[#24160c] whitespace-nowrap">{m.itemCode}</td>
                      <td className="px-4 py-2.5 font-sans">
                        <div className="font-semibold text-[#24160c]">{m.name}</div>
                        <div className="text-[10px] text-[#7d6553]">{m.categoryName}</div>
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-[#24160c]">{m.totalOwnedQty}</td>
                      <td className={`px-4 py-2.5 text-center ${selectedStockFilter === 'usable' ? 'bg-[#ebdcc9]/30 font-bold text-[#24160c]' : 'text-[#574830]'}`}>
                        {m.usableWarehouseQty}
                      </td>
                      <td className={`px-4 py-2.5 text-center font-bold ${selectedStockFilter === 'reserved' ? 'bg-blue-50 text-blue-900' : 'text-blue-700'}`}>
                        {m.reservedQty}
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-[#24160c] bg-[#faf6ee]/70 border-x border-[#ebdcc9]">
                        {available}
                      </td>
                      <td className={`px-4 py-2.5 text-center ${selectedStockFilter === 'allocated' ? 'bg-emerald-50 font-bold text-emerald-900' : 'text-emerald-700'}`}>
                        {m.siteAllocatedQty}
                      </td>
                      <td className={`px-4 py-2.5 text-center font-bold ${selectedStockFilter === 'damaged' ? 'bg-amber-50 text-amber-900' : 'text-amber-700'}`}>
                        {m.damagedQty}
                      </td>
                      <td className={`px-4 py-2.5 text-center font-bold ${selectedStockFilter === 'missing' ? 'bg-rose-50 text-rose-900' : 'text-rose-700'}`}>
                        {m.missingQty}
                      </td>
                      <td className="px-4 py-2.5 text-center font-sans text-[11px]">
                        <span className="text-[#574830] font-medium" title={locationText}>
                          {locationText}
                        </span>
                        {(reservedList.length > 0 || allocatedList.length > 0) && (
                          <div className="text-[10px] text-[#8c7360] flex items-center justify-center gap-1 mt-0.5">
                            {reservedList.length > 0 && <span className="text-blue-700 font-semibold">{reservedList.length} Rsv</span>}
                            {reservedList.length > 0 && allocatedList.length > 0 && <span>•</span>}
                            {allocatedList.length > 0 && <span className="text-emerald-700 font-semibold">{allocatedList.length} Alloc</span>}
                          </div>
                        )}
                      </td>
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
