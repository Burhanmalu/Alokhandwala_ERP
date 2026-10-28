'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Boxes, 
  Ruler, 
  Calculator, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  TrendingUp, 
  PackageCheck, 
  RefreshCw, 
  ShoppingBag, 
  Layers, 
  Plus, 
  Trash2, 
  Info, 
  Truck,
  Check,
  ChevronRight,
  SlidersHorizontal,
  ShieldAlert
} from 'lucide-react';
import { 
  Material, 
  ScaffoldingMaterialPlanOption, 
  ScaffoldingPlanItem 
} from '@/lib/schema';
import { formatINR } from '@/lib/formatters';

interface SmartMaterialRecommendationProps {
  initialDimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit?: 'FEET' | 'METERS';
  };
  catalogMaterials: Material[];
  onPlanSelected: (plan: ScaffoldingMaterialPlanOption, materials: { materialId: string; requiredQuantity: number; monthlyRentalRate: number }[]) => void;
  onMaterialsChange: (materials: { materialId: string; requiredQuantity: number; monthlyRentalRate: number }[]) => void;
}

export function SmartMaterialRecommendation({
  initialDimensions,
  catalogMaterials,
  onPlanSelected,
  onMaterialsChange,
}: SmartMaterialRecommendationProps) {
  // Dimension inputs (Only length, width, height, and unit)
  const [length, setLength] = useState<number>(initialDimensions?.length || 60);
  const [width, setWidth] = useState<number>(initialDimensions?.width || 40);
  const [height, setHeight] = useState<number>(initialDimensions?.height || 20);
  const [unit, setUnit] = useState<'FEET' | 'METERS'>(initialDimensions?.unit || 'FEET');

  // Calculation state
  const [recommendedPlans, setRecommendedPlans] = useState<ScaffoldingMaterialPlanOption[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('PLAN_AVAILABLE_STOCK');
  const [calculating, setCalculating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [overReservationWarning, setOverReservationWarning] = useState<string | null>(null);
  const [safetyNotes, setSafetyNotes] = useState<string[]>([]);

  // Active editable materials breakdown
  const [activePlanMaterials, setActivePlanMaterials] = useState<ScaffoldingPlanItem[]>([]);
  
  // Dedicated state for Option 4 (Custom Option)
  const [customMaterials, setCustomMaterials] = useState<ScaffoldingPlanItem[]>([]);

  // Helper to map inventory item to a plan item
  const mapCatalogToPlanItem = useCallback((mat: Material, initialQty = 10, notes = 'Custom material selection'): ScaffoldingPlanItem => {
    const warehouseStock = mat.usableWarehouseQty;
    const currentlyReserved = mat.reservedQty;
    const availableStock = Math.max(0, warehouseStock - currentlyReserved);
    const requiredQty = initialQty;
    const proposedReserveQty = Math.min(requiredQty, availableStock);
    const remainingStockAfterReservation = Math.max(0, availableStock - proposedReserveQty);
    const shortageQty = Math.max(0, requiredQty - availableStock);

    return {
      materialId: mat.id,
      itemCode: mat.itemCode,
      name: mat.name,
      categoryName: mat.categoryName || 'Scaffolding Component',
      unit: mat.unitOfMeasurement || 'NOS',
      requiredQty,
      warehouseStock,
      currentlyReserved,
      availableStock,
      proposedReserveQty,
      remainingStockAfterReservation,
      shortageQty,
      monthlyRentalRate: mat.rentalRatePerMonth || 0,
      monthlyRentalTotal: proposedReserveQty * (mat.rentalRatePerMonth || 0),
      purchaseCost: mat.purchaseCost || 0,
      status: shortageQty > 0 ? (availableStock === 0 ? 'OUT_OF_STOCK' : 'PARTIAL_STOCK') : 'IN_STOCK',
      weightKg: (mat.standardWeightKg || 5) * requiredQty,
      notes,
    };
  }, []);

  // Initialize baseline custom materials from catalog if empty
  useEffect(() => {
    if (catalogMaterials.length > 0 && customMaterials.length === 0) {
      // Pick standard cuplock components: Verticals, Ledgers, Jacks, Jali, Couplers
      const baselineCodes = ['V-10FT-3M', 'L-8FT-2.5M', 'L-4FT-1.25M', 'JACK-BASE', 'JALI-8FT-MS', 'CPL-SWIVEL'];
      const initialItems: ScaffoldingPlanItem[] = [];
      
      for (const code of baselineCodes) {
        const found = catalogMaterials.find(m => m.itemCode === code);
        if (found) {
          initialItems.push(mapCatalogToPlanItem(found, 20, 'Baseline scaffolding item'));
        }
      }

      if (initialItems.length === 0 && catalogMaterials[0]) {
        initialItems.push(mapCatalogToPlanItem(catalogMaterials[0], 20, 'Baseline item'));
      }

      setCustomMaterials(initialItems);
    }
  }, [catalogMaterials, customMaterials.length, mapCatalogToPlanItem]);

  // Construct Option 4: Custom Option dynamically
  const customPlanOption = useMemo<ScaffoldingMaterialPlanOption>(() => {
    let totalPieces = 0;
    let totalWeightKg = 0;
    let totalMonthlyRental = 0;
    let shortageItemsCount = 0;
    let totalShortagePieces = 0;
    let estimatedProcurementCost = 0;

    for (const item of customMaterials) {
      totalPieces += item.requiredQty;
      totalWeightKg += (item.weightKg || 0);
      totalMonthlyRental += (item.proposedReserveQty * item.monthlyRentalRate);
      if (item.shortageQty > 0) {
        shortageItemsCount++;
        totalShortagePieces += item.shortageQty;
        estimatedProcurementCost += item.shortageQty * (item.purchaseCost || 1000);
      }
    }

    const stockReadinessPercentage = totalPieces > 0 
      ? Math.round(((totalPieces - totalShortagePieces) / totalPieces) * 100)
      : 100;

    return {
      planId: 'PLAN_CUSTOM',
      planName: 'Option 4 — Custom Material Option',
      badge: 'User-Configured & Stock-Validated',
      description: 'Manually select materials and enter custom quantities with real-time warehouse stock validation and over-reservation prevention.',
      configurationSummary: {
        configurationType: 'PERIMETER_FACADE',
        dimensions: {
          length: Number(length) || 60,
          width: Number(width) || 40,
          height: Number(height) || 20,
          unit,
          lengthFt: unit === 'FEET' ? Number(length) : Math.round(Number(length) * 3.28084),
          widthFt: unit === 'FEET' ? Number(width) : Math.round(Number(width) * 3.28084),
          heightFt: unit === 'FEET' ? Number(height) : Math.round(Number(height) * 3.28084),
        },
        bayLengthFt: 8,
        transomWidthFt: 4,
        liftHeightFt: 6.5,
        totalBays: Math.ceil((2 * (Number(length) + Number(width))) / 8),
        totalLifts: Math.ceil(Number(height) / 6.5),
        totalVerticalStandardsGrid: Math.ceil((2 * (Number(length) + Number(width))) / 8) * 2,
        workingDeckLevelsCount: 1,
        safetyStandard: 'Custom User Specification',
        loadRatingClass: 'Custom Configured',
      },
      materials: customMaterials,
      totals: {
        totalPieces,
        totalWeightKg: Math.round(totalWeightKg),
        totalMonthlyRental,
        stockReadinessPercentage,
        shortageItemsCount,
        totalShortagePieces,
        estimatedProcurementCost,
      },
      safetyNotes: [
        'Custom user-defined material configuration.',
        'All quantities validated in real time against available warehouse stock (Usable Stock - Active Reservations).',
        'Over-reservation is strictly prohibited: material reservations cannot exceed available stock.',
      ],
    };
  }, [customMaterials, length, width, height, unit]);

  // Combine exactly 3 recommended options from backend + 1 Custom Option
  const allFourPlans = useMemo<ScaffoldingMaterialPlanOption[]>(() => {
    return [...recommendedPlans, customPlanOption];
  }, [recommendedPlans, customPlanOption]);

  // Calculate the 3 recommended options from backend API
  const handleCalculatePlans = useCallback(async () => {
    if (!length || !width || !height || length <= 0 || width <= 0 || height <= 0) {
      setError('Please provide valid positive site dimensions (Length, Width, and Height).');
      return;
    }

    setCalculating(true);
    setError(null);
    setOverReservationWarning(null);

    try {
      const res = await fetch('/api/scaffolding/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          length: Number(length),
          width: Number(width),
          height: Number(height),
          unit,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to calculate scaffolding material plans');
      }

      const backendPlans: ScaffoldingMaterialPlanOption[] = json.data.options || [];
      setRecommendedPlans(backendPlans);
      setSafetyNotes(json.data.generalSafetyRequirements || []);

      // If user hasn't explicitly selected the custom plan, select Option 1 (Available Stock)
      if (selectedPlanId !== 'PLAN_CUSTOM') {
        const option1 = backendPlans.find(p => p.planId === 'PLAN_AVAILABLE_STOCK') || backendPlans[0];
        if (option1) {
          setSelectedPlanId(option1.planId);
          setActivePlanMaterials(option1.materials);

          const formMaterials = option1.materials.map(m => ({
            materialId: m.materialId,
            requiredQuantity: m.proposedReserveQty,
            monthlyRentalRate: m.monthlyRentalRate,
          }));
          onPlanSelected(option1, formMaterials);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error running calculation');
    } finally {
      setCalculating(false);
    }
  }, [length, width, height, unit, selectedPlanId, onPlanSelected]);

  // Calculate on initial mount
  useEffect(() => {
    handleCalculatePlans();
  }, []); // Run once on mount

  // Switch between any of the 4 options
  const handleSelectPlan = (plan: ScaffoldingMaterialPlanOption) => {
    setSelectedPlanId(plan.planId);
    setOverReservationWarning(null);

    const materialsToUse = plan.planId === 'PLAN_CUSTOM' ? customMaterials : plan.materials;
    setActivePlanMaterials(materialsToUse);

    const formMaterials = materialsToUse.map(m => ({
      materialId: m.materialId,
      requiredQuantity: m.proposedReserveQty,
      monthlyRentalRate: m.monthlyRentalRate,
    }));
    onPlanSelected(plan, formMaterials);
  };

  // Inline edit quantity with real-time stock validation & over-reservation prevention
  const handleUpdateItemQty = (idx: number, newQty: number) => {
    const qty = Math.max(0, Number(newQty) || 0);

    setActivePlanMaterials(prev => {
      const updated = [...prev];
      const item = { ...updated[idx] };
      const available = item.availableStock;

      item.requiredQty = qty;

      // VALIDATE STOCK AVAILABILITY & PREVENT OVER-RESERVATION
      if (qty > available) {
        // Strictly cap reservation to available stock
        item.proposedReserveQty = available;
        item.shortageQty = qty - available;
        item.status = available === 0 ? 'OUT_OF_STOCK' : 'PARTIAL_STOCK';
        setOverReservationWarning(
          `⚠️ Over-reservation prevented for "${item.name}": Required quantity (${qty}) exceeds available warehouse stock (${available}). The system has capped the reserved quantity to ${available} and recorded a shortage of ${item.shortageQty} units.`
        );
      } else {
        item.proposedReserveQty = qty;
        item.shortageQty = 0;
        item.status = 'IN_STOCK';
        setOverReservationWarning(null);
      }

      item.remainingStockAfterReservation = Math.max(0, available - item.proposedReserveQty);
      item.monthlyRentalTotal = item.proposedReserveQty * item.monthlyRentalRate;

      updated[idx] = item;

      // If active plan is Custom Option, keep customMaterials in sync
      if (selectedPlanId === 'PLAN_CUSTOM') {
        setCustomMaterials(updated);
      }

      const formMaterials = updated.map(m => ({
        materialId: m.materialId,
        requiredQuantity: m.proposedReserveQty,
        monthlyRentalRate: m.monthlyRentalRate,
      }));
      onMaterialsChange(formMaterials);

      return updated;
    });
  };

  // Dropdown replacement of material on a row (Custom Option)
  const handleMaterialChange = (idx: number, newMaterialId: string) => {
    const mat = catalogMaterials.find(m => m.id === newMaterialId);
    if (!mat) return;

    setActivePlanMaterials(prev => {
      const updated = [...prev];
      const currentQty = updated[idx]?.requiredQty || 10;
      const newItem = mapCatalogToPlanItem(mat, currentQty, 'Custom material selected by user');

      updated[idx] = newItem;

      if (selectedPlanId === 'PLAN_CUSTOM') {
        setCustomMaterials(updated);
      }

      const formMaterials = updated.map(m => ({
        materialId: m.materialId,
        requiredQuantity: m.proposedReserveQty,
        monthlyRentalRate: m.monthlyRentalRate,
      }));
      onMaterialsChange(formMaterials);

      return updated;
    });
  };

  // Remove a component row
  const handleRemoveRow = (idx: number) => {
    setActivePlanMaterials(prev => {
      const updated = prev.filter((_, i) => i !== idx);

      if (selectedPlanId === 'PLAN_CUSTOM') {
        setCustomMaterials(updated);
      }

      const formMaterials = updated.map(m => ({
        materialId: m.materialId,
        requiredQuantity: m.proposedReserveQty,
        monthlyRentalRate: m.monthlyRentalRate,
      }));
      onMaterialsChange(formMaterials);

      return updated;
    });
  };

  // Add a new component row (Custom Option)
  const handleAddMaterialRow = () => {
    if (catalogMaterials.length === 0) return;
    
    // Pick first material not already in the active list, or the first catalog item
    const existingIds = new Set(activePlanMaterials.map(m => m.materialId));
    const nextMat = catalogMaterials.find(m => !existingIds.has(m.id)) || catalogMaterials[0];
    const newItem = mapCatalogToPlanItem(nextMat, 10, 'Custom line item added by user');

    setActivePlanMaterials(prev => {
      const updated = [...prev, newItem];

      if (selectedPlanId === 'PLAN_CUSTOM') {
        setCustomMaterials(updated);
      }

      const formMaterials = updated.map(m => ({
        materialId: m.materialId,
        requiredQuantity: m.proposedReserveQty,
        monthlyRentalRate: m.monthlyRentalRate,
      }));
      onMaterialsChange(formMaterials);

      return updated;
    });
  };

  // Currently active plan for display
  const activePlan = useMemo(() => {
    return allFourPlans.find(p => p.planId === selectedPlanId) || allFourPlans[0];
  }, [allFourPlans, selectedPlanId]);

  // Visual component classification badge
  const getComponentBadge = (itemCode: string, categoryName: string) => {
    if (itemCode.startsWith('V-')) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
          Vertical Pipe (Standard)
        </span>
      );
    }
    if (itemCode.startsWith('L-')) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
          Horizontal Pipe (Ledger/Transom)
        </span>
      );
    }
    if (itemCode.startsWith('JACK') || itemCode.startsWith('BASE') || itemCode.startsWith('WHEEL')) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
          Base Jack / Sole Plate
        </span>
      );
    }
    if (itemCode.startsWith('CPL-')) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
          Coupler / Clamp
        </span>
      );
    }
    if (itemCode.startsWith('JALI')) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
          Walkway Jali Deck
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-200">
        {categoryName || 'Accessory'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. SITE DIMENSIONS CARD */}
      <div className="bg-[#fcfaf7] border border-[#e8ded1] rounded-2xl p-5 shadow-xs transition hover:border-[#8c5e39]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#e8ded1]">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#59371d] text-white">
                <Ruler className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-bold text-slate-900">
                1. Project Site Dimensions
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Enter length, width, and height to calculate Cuplock standards, ledgers, transoms, base jacks, and walkway platforms.
            </p>
          </div>

          {/* Unit Toggle */}
          <div className="flex items-center bg-[#f0e8dc] p-1 rounded-xl self-start sm:self-center">
            <button
              type="button"
              onClick={() => setUnit('FEET')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                unit === 'FEET' 
                  ? 'bg-[#59371d] text-white shadow-xs' 
                  : 'text-[#6d4627] hover:text-[#422915]'
              }`}
            >
              Feet (ft)
            </button>
            <button
              type="button"
              onClick={() => setUnit('METERS')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                unit === 'METERS' 
                  ? 'bg-[#59371d] text-white shadow-xs' 
                  : 'text-[#6d4627] hover:text-[#422915]'
              }`}
            >
              Meters (m)
            </button>
          </div>
        </div>

        {/* Inputs Grid (Only Length, Width, Height) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Site Length ({unit === 'FEET' ? 'ft' : 'm'}) *
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="0.5"
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="w-full p-2.5 bg-white border border-[#d6c7b2] rounded-xl font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#8c5e39] focus:outline-hidden"
                placeholder="e.g. 60"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">
                {unit === 'FEET' ? 'ft' : 'm'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Site Width ({unit === 'FEET' ? 'ft' : 'm'}) *
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="0.5"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full p-2.5 bg-white border border-[#d6c7b2] rounded-xl font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#8c5e39] focus:outline-hidden"
                placeholder="e.g. 40"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">
                {unit === 'FEET' ? 'ft' : 'm'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Scaffolding Height ({unit === 'FEET' ? 'ft' : 'm'}) *
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="0.5"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full p-2.5 bg-white border border-[#d6c7b2] rounded-xl font-mono text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#8c5e39] focus:outline-hidden"
                placeholder="e.g. 20"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">
                {unit === 'FEET' ? 'ft' : 'm'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#e8ded1]">
          <div className="flex items-center gap-2 text-[11px] text-slate-600">
            <Info className="w-3.5 h-3.5 text-[#8c5e39] shrink-0" />
            <span>
              Real-time available stock = Usable Warehouse Stock minus active reservations.
            </span>
          </div>

          <button
            type="button"
            onClick={handleCalculatePlans}
            disabled={calculating}
            className="px-4 py-2 bg-[#59371d] hover:bg-[#452b17] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <Calculator className={`w-3.5 h-3.5 ${calculating ? 'animate-spin' : ''}`} />
            <span>{calculating ? 'Evaluating Real Inventory...' : '⚡ Re-evaluate Options'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. RECOMMENDED MATERIAL PLANS (EXACTLY 3 OPTIONS + 1 CUSTOM OPTION) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-[#8c5e39]" />
              <span>2. Recommended Scaffolding Material Plans (3 Recommendations + 1 Custom Option)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Evaluated against real warehouse stock and active reservations. Select an option to inspect component breakdown.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCalculatePlans}
            className="text-xs font-semibold text-[#8c5e39] hover:text-[#59371d] flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Real Stock</span>
          </button>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allFourPlans.map((plan) => {
            const isSelected = selectedPlanId === plan.planId;
            const isCustom = plan.planId === 'PLAN_CUSTOM';
            const isAvailableStockPlan = plan.planId === 'PLAN_AVAILABLE_STOCK';
            const isReady = plan.totals.shortageItemsCount === 0;

            return (
              <div
                key={plan.planId}
                onClick={() => handleSelectPlan(plan)}
                className={`relative p-5 rounded-2xl border-2 transition cursor-pointer text-left flex flex-col justify-between ${
                  isSelected
                    ? 'border-[#59371d] bg-[#fbf8f4] shadow-md ring-2 ring-[#8c5e39]/20'
                    : 'border-slate-200 bg-white hover:border-[#8c5e39]/60 hover:shadow-xs'
                }`}
              >
                <div>
                  {/* Card Header & Badges */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-900">{plan.planName}</span>
                        {plan.isRecommended && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" /> Recommended
                          </span>
                        )}
                        {isCustom && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 flex items-center gap-1">
                            <SlidersHorizontal className="w-2.5 h-2.5" /> Editable
                          </span>
                        )}
                      </div>
                      <span className="inline-block mt-0.5 text-[10px] font-semibold text-[#8c5e39]">
                        {plan.badge}
                      </span>
                    </div>

                    {/* Stock Status Badge */}
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                        isReady
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : isAvailableStockPlan
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-amber-100 text-amber-900 border border-amber-200'
                      }`}
                    >
                      {isReady 
                        ? '✓ 100% In Stock' 
                        : isAvailableStockPlan
                        ? 'Available Stock Capped'
                        : `Shortage: ${plan.totals.totalShortagePieces} pcs`}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                    {plan.description}
                  </p>
                </div>

                <div>
                  {/* Metrics Matrix */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-white/90 rounded-xl border border-[#ede3d4] text-center font-mono">
                    <div>
                      <span className="block text-[10px] uppercase text-slate-400 font-sans">Components</span>
                      <span className="text-xs font-bold text-slate-800">{plan.totals.totalPieces} pcs</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-slate-400 font-sans">Tare Weight</span>
                      <span className="text-xs font-bold text-slate-800">{(plan.totals.totalWeightKg / 1000).toFixed(1)} T</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-slate-400 font-sans">Monthly Rental</span>
                      <span className="text-xs font-bold text-emerald-800">{formatINR(plan.totals.totalMonthlyRental)}</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 font-sans border-t border-slate-100 pt-2">
                    <span>
                      {isCustom 
                        ? `${customMaterials.length} Custom Component Line(s)`
                        : `${plan.configurationSummary.totalBays} Bays (${plan.configurationSummary.bayLengthFt}ft) × ${plan.configurationSummary.totalLifts} Lifts`}
                    </span>
                    <span className="font-semibold text-[#8c5e39] flex items-center gap-1">
                      {isSelected ? 'Selected Plan' : 'Select Plan'}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Over-reservation alert banner */}
      {overReservationWarning && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 shadow-xs">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium leading-relaxed">
            {overReservationWarning}
          </div>
        </div>
      )}

      {/* 3. DETAILED COMPONENT BREAKDOWN & STOCK RESERVATION TABLE */}
      {activePlan && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-emerald-700" />
                <h4 className="text-sm font-bold text-slate-900">
                  {activePlan.planName} — Component Manifest & Stock Reservation
                </h4>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Formula verified: Available Stock = Usable Warehouse Stock minus active reservations. Over-reservation is prevented.
              </p>
            </div>

            {/* Custom option button to add extra materials */}
            <button
              type="button"
              onClick={handleAddMaterialRow}
              className="text-xs font-semibold px-3 py-1.5 bg-[#f5ede3] text-[#59371d] hover:bg-[#ebdccb] border border-[#d6c4ae] rounded-lg flex items-center gap-1 self-start sm:self-center transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Material to Manifest</span>
            </button>
          </div>

          {/* Component Manifest Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f9f6f1] text-[#4d2f19] uppercase tracking-wider text-[10px] font-bold border-b border-[#ebdccb]">
                <tr>
                  <th className="px-3 py-2.5">Component & Type</th>
                  <th className="px-2 py-2.5 text-center">Unit</th>
                  <th className="px-2 py-2.5 text-center" title="Physical stock in warehouse">Warehouse Stock</th>
                  <th className="px-2 py-2.5 text-center" title="Usable Stock minus Active Reservations">Available Stock</th>
                  <th className="px-2 py-2.5 text-center" title="Quantity required for full structure">Required Qty</th>
                  <th className="px-2 py-2.5 text-center text-emerald-900" title="Quantity actually reserved in database (cannot exceed available stock)">Reserve Qty *</th>
                  <th className="px-2 py-2.5 text-center">Remaining Stock</th>
                  <th className="px-3 py-2.5 text-right">Rental Rate/mo</th>
                  <th className="px-2 py-2.5 text-center">Stock Status</th>
                  <th className="px-2 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {activePlanMaterials.map((row, idx) => {
                  const isShortage = row.shortageQty > 0;
                  const isCustomOption = selectedPlanId === 'PLAN_CUSTOM';

                  return (
                    <tr key={`${row.materialId}-${idx}`} className={`hover:bg-slate-50/80 transition ${isShortage ? 'bg-red-50/20' : ''}`}>
                      {/* Name, Code, and Component Type Badge */}
                      <td className="px-3 py-2 font-sans min-w-[220px]">
                        {isCustomOption ? (
                          <div className="space-y-1">
                            <select
                              value={row.materialId}
                              onChange={(e) => handleMaterialChange(idx, e.target.value)}
                              className="w-full p-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#8c5e39]"
                            >
                              {catalogMaterials.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.itemCode})
                                </option>
                              ))}
                            </select>
                            <div>{getComponentBadge(row.itemCode, row.categoryName)}</div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-bold text-slate-900">{row.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[10px] text-slate-400 font-mono">{row.itemCode}</span>
                              {getComponentBadge(row.itemCode, row.categoryName)}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Unit */}
                      <td className="px-2 py-2 font-sans text-center text-slate-500">
                        {row.unit}
                      </td>

                      {/* Warehouse Stock */}
                      <td className="px-2 py-2 text-center text-slate-600">
                        {row.warehouseStock}
                      </td>

                      {/* Available Stock */}
                      <td className="px-2 py-2 text-center font-bold text-slate-800 bg-slate-50/60">
                        {row.availableStock}
                      </td>

                      {/* Required Qty (Editable) */}
                      <td className="px-2 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={row.requiredQty}
                          onChange={(e) => handleUpdateItemQty(idx, Number(e.target.value))}
                          className="w-20 p-1 bg-white border border-slate-300 rounded text-center font-bold text-xs focus:ring-1 focus:ring-[#8c5e39]"
                        />
                      </td>

                      {/* Proposed Reservation Qty (Protected from over-reservation) */}
                      <td className="px-2 py-2 text-center font-bold text-emerald-800 bg-emerald-50/30">
                        {row.proposedReserveQty}
                      </td>

                      {/* Remaining Available Stock */}
                      <td className="px-2 py-2 text-center text-slate-600">
                        {row.remainingStockAfterReservation}
                      </td>

                      {/* Rental Rate */}
                      <td className="px-3 py-2 text-right text-slate-800">
                        {formatINR(row.monthlyRentalRate)}
                      </td>

                      {/* Stock Status Badge */}
                      <td className="px-2 py-2 text-center font-sans">
                        {isShortage ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-800 font-bold border border-red-200 inline-block whitespace-nowrap">
                            Shortage ({row.shortageQty})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 inline-block whitespace-nowrap">
                            In Stock
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                          title="Remove item from plan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Manifest Totals Summary Bar */}
          <div className="p-4 bg-[#f8f5ee] rounded-xl border border-[#e6dac7] grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
            <div>
              <span className="block text-[10px] uppercase text-[#6d4627] font-sans font-semibold">Total Reserved Units</span>
              <span className="text-sm font-bold text-[#422915]">
                {activePlanMaterials.reduce((sum, m) => sum + m.proposedReserveQty, 0)} NOS
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase text-[#6d4627] font-sans font-semibold">Structural Tare Weight</span>
              <span className="text-sm font-bold text-[#422915]">
                {(activePlanMaterials.reduce((sum, m) => sum + (m.weightKg || 0), 0) / 1000).toFixed(2)} Tonnes
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase text-[#6d4627] font-sans font-semibold">Monthly Rental Total</span>
              <span className="text-sm font-bold text-emerald-800">
                {formatINR(activePlanMaterials.reduce((sum, m) => sum + (m.proposedReserveQty * m.monthlyRentalRate), 0))}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase text-[#6d4627] font-sans font-semibold">Shortage Deficit</span>
              <span className={`text-sm font-bold ${
                activePlanMaterials.some(m => m.shortageQty > 0) ? 'text-red-700' : 'text-emerald-700'
              }`}>
                {activePlanMaterials.reduce((sum, m) => sum + m.shortageQty, 0)} Units
              </span>
            </div>
          </div>

          {/* Safety & Standards Checklist */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>IS 4014 Engineering & Safety Compliance Verification</span>
            </div>
            <ul className="text-[11px] text-slate-600 space-y-0.5 list-disc list-inside">
              {safetyNotes.map((note, nIdx) => (
                <li key={nIdx}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
