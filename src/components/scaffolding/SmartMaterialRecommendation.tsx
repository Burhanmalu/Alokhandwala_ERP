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
  ChevronRight
} from 'lucide-react';
import { 
  Material, 
  ScaffoldingConfigurationType, 
  ScaffoldingFacadeFaces, 
  ScaffoldingDeckLevels, 
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
    configurationType?: ScaffoldingConfigurationType;
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
  // Dimension inputs
  const [length, setLength] = useState<number>(initialDimensions?.length || 60);
  const [width, setWidth] = useState<number>(initialDimensions?.width || 40);
  const [height, setHeight] = useState<number>(initialDimensions?.height || 20);
  const [unit, setUnit] = useState<'FEET' | 'METERS'>(initialDimensions?.unit || 'FEET');
  
  // Configuration options
  const [configurationType, setConfigurationType] = useState<ScaffoldingConfigurationType>(
    initialDimensions?.configurationType || 'PERIMETER_FACADE'
  );
  const [facadeFaces, setFacadeFaces] = useState<ScaffoldingFacadeFaces>('4_SIDES_PERIMETER');
  const [deckLevels, setDeckLevels] = useState<ScaffoldingDeckLevels>('TOP_DECK_ONLY');
  const [baySpacingPreference, setBaySpacingPreference] = useState<number>(8);
  const [jaliPreference, setJaliPreference] = useState<'MS' | 'BASS'>('MS');

  // Calculation state
  const [plans, setPlans] = useState<ScaffoldingMaterialPlanOption[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('PLAN_STANDARD');
  const [calculating, setCalculating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [safetyNotes, setSafetyNotes] = useState<string[]>([]);

  // Editable materials in the currently active plan
  const [activePlanMaterials, setActivePlanMaterials] = useState<ScaffoldingPlanItem[]>([]);

  // Fetch / Calculate plans
  const handleCalculatePlans = useCallback(async () => {
    if (!length || !width || !height || length <= 0 || width <= 0 || height <= 0) {
      setError('Please provide valid positive site dimensions (Length, Width, and Height).');
      return;
    }

    setCalculating(true);
    setError(null);

    try {
      const res = await fetch('/api/scaffolding/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          length: Number(length),
          width: Number(width),
          height: Number(height),
          unit,
          configurationType,
          facadeFaces,
          deckLevels,
          baySpacingPreference,
          jaliPreference,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to calculate scaffolding material plans');
      }

      const generatedPlans: ScaffoldingMaterialPlanOption[] = json.data.options || [];
      setPlans(generatedPlans);
      setSafetyNotes(json.data.generalSafetyRequirements || []);

      // Auto-select recommended or standard plan
      const recommended = generatedPlans.find(p => p.isRecommended) || generatedPlans[0];
      if (recommended) {
        setSelectedPlanId(recommended.planId);
        setActivePlanMaterials(recommended.materials);

        const formMaterials = recommended.materials.map(m => ({
          materialId: m.materialId,
          requiredQuantity: m.proposedReserveQty,
          monthlyRentalRate: m.monthlyRentalRate,
        }));
        onPlanSelected(recommended, formMaterials);
      }
    } catch (err: any) {
      setError(err.message || 'Error running calculation');
    } finally {
      setCalculating(false);
    }
  }, [length, width, height, unit, configurationType, facadeFaces, deckLevels, baySpacingPreference, jaliPreference, onPlanSelected]);

  // Initial calculation on mount or when initialDimensions change
  useEffect(() => {
    handleCalculatePlans();
  }, []); // Run on mount

  // When admin clicks a plan card
  const handleSelectPlan = (plan: ScaffoldingMaterialPlanOption) => {
    setSelectedPlanId(plan.planId);
    setActivePlanMaterials(plan.materials);

    const formMaterials = plan.materials.map(m => ({
      materialId: m.materialId,
      requiredQuantity: m.proposedReserveQty,
      monthlyRentalRate: m.monthlyRentalRate,
    }));
    onPlanSelected(plan, formMaterials);
  };

  // Inline edit quantity in active plan
  const handleUpdateItemQty = (idx: number, newQty: number) => {
    const updated = [...activePlanMaterials];
    const item = updated[idx];
    const qty = Math.max(0, Number(newQty) || 0);
    const available = item.availableStock;

    item.requiredQty = qty;
    item.proposedReserveQty = Math.min(qty, available);
    item.remainingStockAfterReservation = Math.max(0, available - item.proposedReserveQty);
    item.shortageQty = Math.max(0, qty - available);
    item.status = item.shortageQty > 0 ? (available === 0 ? 'OUT_OF_STOCK' : 'PARTIAL_STOCK') : 'IN_STOCK';
    item.monthlyRentalTotal = item.proposedReserveQty * item.monthlyRentalRate;

    setActivePlanMaterials(updated);

    const formMaterials = updated.map(m => ({
      materialId: m.materialId,
      requiredQuantity: m.proposedReserveQty,
      monthlyRentalRate: m.monthlyRentalRate,
    }));
    onMaterialsChange(formMaterials);
  };

  // Remove an item row
  const handleRemoveRow = (idx: number) => {
    const updated = activePlanMaterials.filter((_, i) => i !== idx);
    setActivePlanMaterials(updated);

    const formMaterials = updated.map(m => ({
      materialId: m.materialId,
      requiredQuantity: m.proposedReserveQty,
      monthlyRentalRate: m.monthlyRentalRate,
    }));
    onMaterialsChange(formMaterials);
  };

  // Add a custom material row
  const handleAddMaterialRow = () => {
    if (catalogMaterials.length === 0) return;
    const first = catalogMaterials[0];
    const available = Math.max(0, first.usableWarehouseQty - first.reservedQty);
    
    const newItem: ScaffoldingPlanItem = {
      materialId: first.id,
      itemCode: first.itemCode,
      name: first.name,
      categoryName: first.categoryName || 'Scaffolding Component',
      unit: first.unitOfMeasurement || 'NOS',
      requiredQty: 20,
      warehouseStock: first.usableWarehouseQty,
      currentlyReserved: first.reservedQty,
      availableStock: available,
      proposedReserveQty: Math.min(20, available),
      remainingStockAfterReservation: Math.max(0, available - Math.min(20, available)),
      shortageQty: Math.max(0, 20 - available),
      monthlyRentalRate: first.rentalRatePerMonth || 0,
      monthlyRentalTotal: Math.min(20, available) * (first.rentalRatePerMonth || 0),
      purchaseCost: first.purchaseCost || 0,
      status: 20 > available ? 'PARTIAL_STOCK' : 'IN_STOCK',
      weightKg: (first.standardWeightKg || 5) * 20,
      notes: 'Custom line item added by admin',
    };

    const updated = [...activePlanMaterials, newItem];
    setActivePlanMaterials(updated);

    const formMaterials = updated.map(m => ({
      materialId: m.materialId,
      requiredQuantity: m.proposedReserveQty,
      monthlyRentalRate: m.monthlyRentalRate,
    }));
    onMaterialsChange(formMaterials);
  };

  const activePlan = useMemo(() => {
    return plans.find(p => p.planId === selectedPlanId) || plans[0];
  }, [plans, selectedPlanId]);

  return (
    <div className="space-y-6">
      {/* 1. SITE DIMENSIONS & CONFIGURATION CARD */}
      <div className="bg-cream-50 border border-cream-200 rounded-2xl p-5 shadow-xs transition hover:border-brown-400">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-cream-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-brown-800 text-cream-100">
                <Ruler className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-bold text-brown-900">
                1. Site Dimensions & Scaffolding Configuration
              </h3>
            </div>
            <p className="text-xs text-brown-700 mt-1">
              Enter site measurements to estimate Cuplock standards, ledgers, transoms, base jacks, and safety platforms.
            </p>
          </div>

          {/* Unit Toggle */}
          <div className="flex items-center bg-cream-200 p-1 rounded-xl self-start sm:self-center">
            <button
              type="button"
              onClick={() => setUnit('FEET')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                unit === 'FEET' 
                  ? 'bg-brown-800 text-cream-100 shadow-xs' 
                  : 'text-brown-800 hover:text-brown-900'
              }`}
            >
              Feet (ft)
            </button>
            <button
              type="button"
              onClick={() => setUnit('METERS')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                unit === 'METERS' 
                  ? 'bg-brown-800 text-cream-100 shadow-xs' 
                  : 'text-brown-800 hover:text-brown-900'
              }`}
            >
              Meters (m)
            </button>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div>
            <label className="block text-xs font-bold text-brown-900 mb-1">
              Site Length ({unit === 'FEET' ? 'ft' : 'm'}) *
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="0.5"
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="w-full p-2.5 bg-white border border-cream-300 rounded-xl font-mono text-xs font-bold text-brown-900 focus:ring-2 focus:ring-brown-600 focus:outline-hidden"
                placeholder="e.g. 60"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs text-brown-500 font-mono">
                {unit === 'FEET' ? 'ft' : 'm'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-brown-900 mb-1">
              Site Width ({unit === 'FEET' ? 'ft' : 'm'}) *
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="0.5"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full p-2.5 bg-white border border-cream-300 rounded-xl font-mono text-xs font-bold text-brown-900 focus:ring-2 focus:ring-brown-600 focus:outline-hidden"
                placeholder="e.g. 40"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs text-brown-500 font-mono">
                {unit === 'FEET' ? 'ft' : 'm'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-brown-900 mb-1">
              Scaffolding Height ({unit === 'FEET' ? 'ft' : 'm'}) *
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="0.5"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full p-2.5 bg-white border border-cream-300 rounded-xl font-mono text-xs font-bold text-brown-900 focus:ring-2 focus:ring-brown-600 focus:outline-hidden"
                placeholder="e.g. 20"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs text-brown-500 font-mono">
                {unit === 'FEET' ? 'ft' : 'm'}
              </span>
            </div>
          </div>
        </div>

        {/* Configuration Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4 border-t border-cream-200 mt-4">
          <div>
            <label className="block text-xs font-semibold text-brown-800 mb-1">
              Configuration / Staging Type
            </label>
            <select
              value={configurationType}
              onChange={(e) => setConfigurationType(e.target.value as ScaffoldingConfigurationType)}
              className="w-full p-2 bg-white border border-cream-300 rounded-xl text-xs text-brown-900 font-medium focus:ring-2 focus:ring-brown-600 focus:outline-hidden"
            >
              <option value="PERIMETER_FACADE">Façade / Perimeter Scaffolding</option>
              <option value="BIRDCAGE_VOLUME">Full Birdcage Slab / Ceiling Shoring</option>
              <option value="INDEPENDENT_TIED">Independent Tied Double-Row</option>
              <option value="MOBILE_ACCESS_TOWER">Mobile Access Tower (With Wheels)</option>
            </select>
          </div>

          {configurationType === 'PERIMETER_FACADE' && (
            <div>
              <label className="block text-xs font-semibold text-brown-800 mb-1">
                Façade Elevation Faces
              </label>
              <select
                value={facadeFaces}
                onChange={(e) => setFacadeFaces(e.target.value as ScaffoldingFacadeFaces)}
                className="w-full p-2 bg-white border border-cream-300 rounded-xl text-xs text-brown-900 font-medium focus:ring-2 focus:ring-brown-600 focus:outline-hidden"
              >
                <option value="4_SIDES_PERIMETER">4-Sides Perimeter (Full Wrap)</option>
                <option value="2_LONG_SIDES">2 Long Sides (Front & Rear)</option>
                <option value="1_SINGLE_WALL">1 Single Wall Façade</option>
                <option value="L_SHAPE">L-Shape (Length + Width)</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-brown-800 mb-1">
              Working Deck Platforms
            </label>
            <select
              value={deckLevels}
              onChange={(e) => setDeckLevels(e.target.value as ScaffoldingDeckLevels)}
              className="w-full p-2 bg-white border border-cream-300 rounded-xl text-xs text-brown-900 font-medium focus:ring-2 focus:ring-brown-600 focus:outline-hidden"
            >
              <option value="TOP_DECK_ONLY">1 Level (Top Working Lift)</option>
              <option value="TWO_DECKS">2 Levels (Working + Staging Deck)</option>
              <option value="ALL_LIFTS">All Lifts (Full Height Decked)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-brown-800 mb-1">
              Walkway Jali Specification
            </label>
            <select
              value={jaliPreference}
              onChange={(e) => setJaliPreference(e.target.value as 'MS' | 'BASS')}
              className="w-full p-2 bg-white border border-cream-300 rounded-xl text-xs text-brown-900 font-medium focus:ring-2 focus:ring-brown-600 focus:outline-hidden"
            >
              <option value="MS">MS Anti-Skid Perforated (Standard)</option>
              <option value="BASS">Heavy Bass Reinforced (Heavy Duty)</option>
            </select>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-cream-200">
          <div className="flex items-center gap-2 text-[11px] text-brown-700">
            <Info className="w-3.5 h-3.5 text-brown-600 shrink-0" />
            <span>
              Calculates standards, ledgers, transoms, base jacks, and safety platforms based on IS 4014 engineering standards.
            </span>
          </div>

          <button
            type="button"
            onClick={handleCalculatePlans}
            disabled={calculating}
            className="px-4 py-2 bg-brown-800 hover:bg-brown-900 text-cream-100 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2"
          >
            <Calculator className={`w-3.5 h-3.5 ${calculating ? 'animate-spin' : ''}`} />
            <span>{calculating ? 'Calculating Options...' : '⚡ Recommend Material Plans'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. RECOMMENDED MATERIAL PLANS (3-4 OPTIONS) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-brown-700" />
              <span>2. Recommended Scaffolding Material Plans (Live Inventory Integrated)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Evaluated against real-time PostgreSQL warehouse availability. Compare and select the best plan.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCalculatePlans}
            className="text-xs font-semibold text-brown-700 hover:text-brown-900 flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Stock</span>
          </button>
        </div>

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map((plan) => {
            const isSelected = selectedPlanId === plan.planId;
            const isReady = plan.totals.shortageItemsCount === 0;

            return (
              <div
                key={plan.planId}
                onClick={() => handleSelectPlan(plan)}
                className={`relative p-5 rounded-2xl border-2 transition cursor-pointer text-left ${
                  isSelected
                    ? 'border-brown-800 bg-cream-50 shadow-md ring-2 ring-brown-600/20'
                    : 'border-slate-200 bg-white hover:border-brown-400 hover:shadow-xs'
                }`}
              >
                {/* Header & Badges */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{plan.planName}</span>
                      {plan.isRecommended && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" /> Recommended
                        </span>
                      )}
                    </div>
                    <span className="inline-block mt-0.5 text-[10px] font-semibold text-brown-700">
                      {plan.badge}
                    </span>
                  </div>

                  {/* Stock Readiness Badge */}
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                      isReady
                        ? 'bg-emerald-100 text-emerald-800'
                        : plan.planId === 'PLAN_PROCUREMENT_HYBRID'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {isReady 
                      ? '✓ 100% In Stock' 
                      : plan.planId === 'PLAN_PROCUREMENT_HYBRID'
                      ? `Procure ${plan.totals.totalShortagePieces} pcs`
                      : `Shortage: ${plan.totals.totalShortagePieces} pcs`}
                  </span>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                  {plan.description}
                </p>

                {/* Metrics Matrix */}
                <div className="grid grid-cols-3 gap-2 p-2.5 bg-white/80 rounded-xl border border-cream-200 text-center font-mono">
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

                {/* Configuration Specs footer */}
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 font-sans border-t border-slate-100 pt-2">
                  <span>
                    {plan.configurationSummary.totalBays} Bays ({plan.configurationSummary.bayLengthFt}ft) × {plan.configurationSummary.totalLifts} Lifts
                  </span>
                  <span className="font-semibold text-brown-800 flex items-center gap-1">
                    {isSelected ? 'Selected Plan' : 'Select Plan'}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. DETAILED BREAKDOWN & STOCK RESERVATION TABLE */}
      {activePlan && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-emerald-700" />
                <h4 className="text-sm font-bold text-slate-900">
                  {activePlan.planName} — Component Manifest & Stock Reservation
                </h4>
              </div>
              <p className="text-xs text-slate-500">
                Formula verified: Usable Warehouse Stock minus active reservations = Available Stock.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddMaterialRow}
              className="text-xs font-semibold text-brown-700 hover:text-brown-900 flex items-center gap-1 self-start sm:self-center"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Material</span>
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-cream-100 text-brown-900 uppercase tracking-wider text-[10px] font-bold border-b border-cream-200">
                <tr>
                  <th className="px-3 py-2.5">Component & Specification</th>
                  <th className="px-2 py-2.5 text-center">Unit</th>
                  <th className="px-2 py-2.5 text-center">Warehouse Stock</th>
                  <th className="px-2 py-2.5 text-center">Available Stock</th>
                  <th className="px-2 py-2.5 text-center">Required Qty</th>
                  <th className="px-2 py-2.5 text-center">Reserve Qty *</th>
                  <th className="px-2 py-2.5 text-center">Remaining Stock</th>
                  <th className="px-3 py-2.5 text-right">Rental Rate/mo</th>
                  <th className="px-2 py-2.5 text-center">Stock Status</th>
                  <th className="px-2 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {activePlanMaterials.map((row, idx) => {
                  const isShortage = row.shortageQty > 0;

                  return (
                    <tr key={idx} className="hover:bg-cream-50/60 transition">
                      {/* Name & Code */}
                      <td className="px-3 py-2 font-sans">
                        <div className="font-bold text-slate-900">{row.name}</div>
                        <div className="text-[10px] text-brown-600 font-mono">{row.itemCode}</div>
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
                      <td className="px-2 py-2 text-center font-bold text-slate-800">
                        {row.availableStock}
                      </td>

                      {/* Required Qty */}
                      <td className="px-2 py-2 text-center">
                        <input
                          type="number"
                          min="1"
                          value={row.requiredQty}
                          onChange={(e) => handleUpdateItemQty(idx, Number(e.target.value))}
                          className="w-20 p-1 bg-white border border-slate-300 rounded text-center font-bold text-xs focus:ring-1 focus:ring-brown-600"
                        />
                      </td>

                      {/* Proposed Reservation Qty */}
                      <td className="px-2 py-2 text-center font-bold text-emerald-800">
                        {row.proposedReserveQty}
                      </td>

                      {/* Remaining Available */}
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
                          <span className="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-800 font-bold">
                            Shortage ({row.shortageQty})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                            In Stock
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="p-1 text-slate-400 hover:text-red-600 transition"
                          title="Remove item"
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
          <div className="p-4 bg-cream-100 rounded-xl border border-cream-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
            <div>
              <span className="block text-[10px] uppercase text-brown-700 font-sans font-semibold">Total Reserved Units</span>
              <span className="text-sm font-bold text-brown-900">
                {activePlanMaterials.reduce((sum, m) => sum + m.proposedReserveQty, 0)} NOS
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase text-brown-700 font-sans font-semibold">Total Structural Weight</span>
              <span className="text-sm font-bold text-brown-900">
                {(activePlanMaterials.reduce((sum, m) => sum + (m.weightKg || 0), 0) / 1000).toFixed(2)} Tonnes
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase text-brown-700 font-sans font-semibold">Monthly Rental Total</span>
              <span className="text-sm font-bold text-emerald-800">
                {formatINR(activePlanMaterials.reduce((sum, m) => sum + (m.proposedReserveQty * m.monthlyRentalRate), 0))}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase text-brown-700 font-sans font-semibold">Shortage Deficit</span>
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
              <span>IS 4014 Engineering & Safety Compliance Check</span>
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
