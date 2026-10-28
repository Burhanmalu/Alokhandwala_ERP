// ALOKHANDWALA - Smart Material Recommendation & Estimation Engine
// Compliant with IS 4014 (Parts 1 & 2), BS EN 12811, and OSHA Scaffolding Safety Standards

import { dbStore } from '@/lib/db/store';
import { 
  Material, 
  ScaffoldingConfigurationType, 
  ScaffoldingFacadeFaces, 
  ScaffoldingDeckLevels,
  ScaffoldingMaterialPlanOption, 
  ScaffoldingPlanItem 
} from '@/lib/schema';

export interface ScaffoldingCalculationInput {
  length: number;
  width: number;
  height: number;
  unit: 'FEET' | 'METERS';
  configurationType: ScaffoldingConfigurationType;
  facadeFaces?: ScaffoldingFacadeFaces;
  deckLevels?: ScaffoldingDeckLevels;
  baySpacingPreference?: number; // 8, 7, 5
  jaliPreference?: 'MS' | 'BASS';
}

export interface ScaffoldingCalculationResult {
  input: ScaffoldingCalculationInput;
  normalizedDimensions: {
    lengthFt: number;
    widthFt: number;
    heightFt: number;
    lengthM: number;
    widthM: number;
    heightM: number;
  };
  options: ScaffoldingMaterialPlanOption[];
  generalSafetyRequirements: string[];
}

export class ScaffoldingCalculatorService {
  /**
   * Convert input dimensions to standard feet & meters
   */
  public static normalizeDimensions(length: number, width: number, height: number, unit: 'FEET' | 'METERS') {
    const l = Math.max(1, Number(length) || 1);
    const w = Math.max(1, Number(width) || 1);
    const h = Math.max(1, Number(height) || 1);

    if (unit === 'METERS') {
      return {
        lengthFt: Math.round(l * 3.28084 * 10) / 10,
        widthFt: Math.round(w * 3.28084 * 10) / 10,
        heightFt: Math.round(h * 3.28084 * 10) / 10,
        lengthM: l,
        widthM: w,
        heightM: h,
      };
    } else {
      return {
        lengthFt: l,
        widthFt: w,
        heightFt: h,
        lengthM: Math.round((l / 3.28084) * 100) / 100,
        widthM: Math.round((w / 3.28084) * 100) / 100,
        heightM: Math.round((h / 3.28084) * 100) / 100,
      };
    }
  }

  /**
   * Primary recommendation generator: computes 3-4 feasible, inventory-aware plans
   */
  public static async generatePlans(input: ScaffoldingCalculationInput): Promise<ScaffoldingCalculationResult> {
    const normalized = this.normalizeDimensions(input.length, input.width, input.height, input.unit);
    const catalog = dbStore.getMaterials();

    // Map inventory items by code for fast lookup
    const invMap = new Map<string, Material>();
    for (const item of catalog) {
      invMap.set(item.itemCode, item);
      invMap.set(item.id, item);
    }

    const options: ScaffoldingMaterialPlanOption[] = [];

    // Safety checks & warnings
    const generalSafetyRequirements: string[] = [
      'Base Jacks / Sole Plates must be set on firm, level ground or timber sole boards (IS 4014 Part 2).',
      'Double guardrail system (top rail @ 1.0m, mid rail @ 0.5m) and 150mm toe boards required on all open working edges.',
      'Face diagonal sway bracing required at a minimum of 1 bay every 4 bays across full scaffolding height.',
      'Scaffolding with height exceeding 3x the minimum base width must be tied to the permanent structure every 4m vertically.',
    ];

    if (normalized.heightFt > 3 * Math.min(normalized.lengthFt, normalized.widthFt)) {
      generalSafetyRequirements.unshift(
        '⚠️ HIGH ASPECT RATIO WARNING: Scaffolding height exceeds 3x minimum base dimension. Mandatory wall ties / rakers required before loading.'
      );
    }

    // 1. OPTION 1 — AVAILABLE STOCK PRIORITY PLAN
    // Prioritizes scaffolding materials currently available in sufficient quantities (usableWarehouseQty - reservedQty).
    // Never recommends quantities that exceed available stock.
    const stock8ft = (invMap.get('L-8FT-2.5M')?.usableWarehouseQty || 0) - (invMap.get('L-8FT-2.5M')?.reservedQty || 0);
    const stock7ft = (invMap.get('L-7FT-2M')?.usableWarehouseQty || 0) - (invMap.get('L-7FT-2M')?.reservedQty || 0);
    const stock5ft = (invMap.get('L-5FT-1.5M')?.usableWarehouseQty || 0) - (invMap.get('L-5FT-1.5M')?.reservedQty || 0);

    const bestBayLength = (stock8ft >= stock7ft && stock8ft >= stock5ft) ? 8 : (stock7ft >= stock5ft ? 7 : 5);

    const planAvailableStock = this.buildPlan({
      planId: 'PLAN_AVAILABLE_STOCK',
      planName: 'Option 1 — Available Stock Priority Plan',
      badge: 'Available Stock Guaranteed',
      description: `Prioritizes currently available warehouse inventory (${bestBayLength}ft bays & high-availability standards). Reservations never exceed available stock.`,
      input,
      normalized,
      invMap,
      bayLengthFt: bestBayLength,
      transomWidthFt: 4,
      liftHeightFt: 6.5,
      preferredJali: 'MS',
      stockOptimization: 'PREFER_ABUNDANT',
      capAtStock: true, // Strictly never exceed available stock!
    });
    planAvailableStock.isRecommended = true;
    options.push(planAvailableStock);

    // 2. OPTION 2 — STANDARD ENGINEERING PLAN (IS 4014 Standard 8ft Grid)
    const planStandard = this.buildPlan({
      planId: 'PLAN_STANDARD',
      planName: 'Option 2 — Standard 8ft Engineering Plan',
      badge: 'IS 4014 Standard Grid',
      description: 'Standard 8ft (2.5m) cuplock bay grid with 10ft standards, 8ft horizontal ledgers, MS anti-skid Jali decks, and safety guardrails.',
      input,
      normalized,
      invMap,
      bayLengthFt: 8,
      transomWidthFt: 4,
      liftHeightFt: 6.5, // 2.0m standard lift
      preferredJali: input.jaliPreference || 'MS',
      stockOptimization: 'NONE',
      capAtStock: false,
    });
    options.push(planStandard);

    // 3. OPTION 3 — ALTERNATIVE HEAVY-DUTY GRID PLAN
    const planAlternative = this.buildPlan({
      planId: 'PLAN_ALTERNATIVE_HEAVY',
      planName: 'Option 3 — Alternative Heavy-Duty Plan',
      badge: 'Reinforced 5ft Heavy-Duty Grid',
      description: 'High safe working load (SWL) configuration with dense 5ft bay grid, 8ft/5ft vertical standards, 5ft horizontal ledgers, and heavy-duty walkway platforms.',
      input,
      normalized,
      invMap,
      bayLengthFt: 5, // Tighter bay for heavy masonry/concrete access
      transomWidthFt: 4,
      liftHeightFt: 5.0, // 1.5m heavy-duty lift
      preferredJali: 'BASS',
      stockOptimization: 'HEAVY_DUTY',
      capAtStock: false,
    });
    options.push(planAlternative);

    return {
      input,
      normalizedDimensions: normalized,
      options,
      generalSafetyRequirements,
    };
  }

  /**
   * Internal builder for an individual scaffolding plan option
   */
  private static buildPlan(params: {
    planId: ScaffoldingMaterialPlanOption['planId'];
    planName: string;
    badge: string;
    description: string;
    input: ScaffoldingCalculationInput;
    normalized: { lengthFt: number; widthFt: number; heightFt: number; lengthM: number; widthM: number; heightM: number };
    invMap: Map<string, Material>;
    bayLengthFt: number;
    transomWidthFt: number;
    liftHeightFt: number;
    preferredJali: 'MS' | 'BASS';
    stockOptimization: 'NONE' | 'PREFER_ABUNDANT' | 'HEAVY_DUTY';
    capAtStock: boolean;
  }): ScaffoldingMaterialPlanOption {
    const { 
      planId, planName, badge, description, input, normalized, invMap, 
      bayLengthFt, transomWidthFt, liftHeightFt, preferredJali, stockOptimization, capAtStock 
    } = params;

    const { lengthFt, widthFt, heightFt } = normalized;
    const configType = input.configurationType || 'PERIMETER_FACADE';
    const facadeFaces = input.facadeFaces || '4_SIDES_PERIMETER';
    const deckLevels = input.deckLevels || 'TOP_DECK_ONLY';

    let totalRunLengthFt = 0;
    let isClosedLoop = false;
    let totalBays = 0;
    let totalLifts = Math.max(1, Math.ceil(heightFt / liftHeightFt));
    let totalVerticalLines = 0;
    let workingDeckCount = deckLevels === 'ALL_LIFTS' ? totalLifts : (deckLevels === 'TWO_DECKS' ? Math.min(2, totalLifts) : 1);

    // Geometry Calculation
    if (configType === 'PERIMETER_FACADE') {
      if (facadeFaces === '4_SIDES_PERIMETER') {
        totalRunLengthFt = 2 * (lengthFt + widthFt);
        isClosedLoop = true;
        totalBays = Math.ceil(totalRunLengthFt / bayLengthFt);
        totalVerticalLines = totalBays * 2; // Outer + Inner row standards
      } else if (facadeFaces === '2_LONG_SIDES') {
        totalRunLengthFt = 2 * lengthFt;
        isClosedLoop = false;
        totalBays = Math.ceil(totalRunLengthFt / bayLengthFt);
        totalVerticalLines = (totalBays + 2) * 2;
      } else if (facadeFaces === 'L_SHAPE') {
        totalRunLengthFt = lengthFt + widthFt;
        isClosedLoop = false;
        totalBays = Math.ceil(totalRunLengthFt / bayLengthFt);
        totalVerticalLines = (totalBays + 2) * 2;
      } else {
        // 1 Single Wall
        totalRunLengthFt = lengthFt;
        isClosedLoop = false;
        totalBays = Math.ceil(totalRunLengthFt / bayLengthFt);
        totalVerticalLines = (totalBays + 1) * 2;
      }
    } else if (configType === 'BIRDCAGE_VOLUME') {
      const baysX = Math.ceil(lengthFt / bayLengthFt);
      const baysY = Math.ceil(widthFt / transomWidthFt);
      totalBays = baysX * baysY;
      totalVerticalLines = (baysX + 1) * (baysY + 1);
    } else if (configType === 'MOBILE_ACCESS_TOWER') {
      totalBays = 1;
      totalVerticalLines = 4; // 4 standard corners
    } else {
      // INDEPENDENT_TIED
      totalRunLengthFt = lengthFt;
      totalBays = Math.ceil(totalRunLengthFt / bayLengthFt);
      totalVerticalLines = (totalBays + 1) * 2;
    }

    // Standard Heights Decomposition per column to match heightFt
    const verticalBreakdown = this.decomposeHeight(heightFt, stockOptimization);

    // Items list accumulator
    const rawItems: {
      itemCode: string;
      qty: number;
      notes?: string;
    }[] = [];

    // 1. VERTICAL STANDARDS
    for (const [vCode, countPerCol] of Object.entries(verticalBreakdown)) {
      if (countPerCol > 0) {
        rawItems.push({
          itemCode: vCode,
          qty: totalVerticalLines * countPerCol,
          notes: `${countPerCol} standard(s) per vertical column across ${totalVerticalLines} grid columns`,
        });
      }
    }

    // 2. HORIZONTAL LEDGERS & TRANSOMS
    // Longitudinal Ledgers: along bay length
    const ledgerCode = bayLengthFt === 8 ? 'L-8FT-2.5M' : (bayLengthFt === 7 ? 'L-7FT-2M' : 'L-5FT-1.5M');
    const transomCode = transomWidthFt === 5 ? 'L-5FT-1.5M' : (transomWidthFt === 4 ? 'L-4FT-1.25M' : 'L-3FT-1M');

    if (configType === 'BIRDCAGE_VOLUME') {
      const baysX = Math.ceil(lengthFt / bayLengthFt);
      const baysY = Math.ceil(widthFt / transomWidthFt);
      // X-direction ledgers
      rawItems.push({
        itemCode: ledgerCode,
        qty: baysX * (baysY + 1) * (totalLifts + 1),
        notes: `X-Direction grid ledgers for ${baysX} bays across ${totalLifts + 1} levels`,
      });
      // Y-direction transoms
      rawItems.push({
        itemCode: transomCode,
        qty: baysY * (baysX + 1) * (totalLifts + 1),
        notes: `Y-Direction transoms for ${baysY} bays across ${totalLifts + 1} levels`,
      });
    } else if (configType === 'MOBILE_ACCESS_TOWER') {
      rawItems.push({
        itemCode: ledgerCode,
        qty: 2 * (totalLifts + 1),
        notes: `Tower length ledgers at ${totalLifts + 1} levels`,
      });
      rawItems.push({
        itemCode: transomCode,
        qty: 2 * (totalLifts + 1),
        notes: `Tower width transoms at ${totalLifts + 1} levels`,
      });
    } else {
      // Perimeter / Facade / Tied
      // 2 ledger lines per bay (inner + outer) at every lift + base kicker lift
      const longitudinalQty = 2 * totalBays * (totalLifts + 1);
      rawItems.push({
        itemCode: ledgerCode,
        qty: longitudinalQty,
        notes: `Longitudinal ledgers on inner & outer faces across ${totalLifts + 1} levels`,
      });

      // Transoms (connecting inner and outer standard at each vertical column)
      const transomsPerLift = isClosedLoop ? totalBays : (totalBays + 1);
      const transomQty = transomsPerLift * (totalLifts + 1);
      rawItems.push({
        itemCode: transomCode,
        qty: transomQty,
        notes: `Transoms bridging inner/outer standards across ${totalLifts + 1} levels`,
      });
    }

    // 3. BASE JACKS OR WHEELS
    if (configType === 'MOBILE_ACCESS_TOWER') {
      rawItems.push({
        itemCode: 'WHEEL-CASTOR',
        qty: totalVerticalLines,
        notes: 'Heavy duty 8" castor wheels with dual safety brake locks',
      });
    } else {
      rawItems.push({
        itemCode: 'JACK-BASE',
        qty: totalVerticalLines,
        notes: 'Adjustable leveling base jacks (1 per vertical standard)',
      });
      rawItems.push({
        itemCode: 'BASE-PLATE-STD',
        qty: totalVerticalLines,
        notes: 'MS sole base plates for load distribution',
      });
    }

    // 4. CROSS BRACING (DIAGONAL BRACES)
    // 1 brace bay every 4 bays per lift (minimum 2 braces per lift)
    const braceBays = Math.max(2, Math.ceil(totalBays / 4));
    const diagonalBraceQty = braceBays * totalLifts * 2;
    // Uses 8ft or 7ft ledger pipes with swivel couplers for bracing
    const bracePipeCode = bayLengthFt >= 7 ? 'L-8FT-2.5M' : 'L-7FT-2M';
    rawItems.push({
      itemCode: bracePipeCode,
      qty: diagonalBraceQty,
      notes: `Diagonal face sway bracing tubes (${braceBays} braced bays across ${totalLifts} lifts)`,
    });

    // 5. COUPLERS & CLAMPS
    const swivelCouplersQty = diagonalBraceQty * 2; // 2 swivel clamps per diagonal brace
    const fixedCouplersQty = Math.ceil(totalBays * totalLifts * 0.75); // Intermediate ties & ledger locks

    rawItems.push({
      itemCode: 'CPL-SWIVEL',
      qty: swivelCouplersQty,
      notes: 'Forged swivel couplers (2 per diagonal cross brace)',
    });
    rawItems.push({
      itemCode: 'CPL-FIXED',
      qty: fixedCouplersQty,
      notes: 'Right-angle fixed double couplers for intermediate ties and transom locks',
    });

    // 6. WALKWAY JALI / WORKING PLATFORMS
    // 3 planks wide per bay per working deck level
    const jaliCode = preferredJali === 'BASS' 
      ? (bayLengthFt >= 8 ? 'JALI-8FT-BASS' : 'JALI-8FT-BASS')
      : (bayLengthFt >= 8 ? 'JALI-8FT-MS' : 'JALI-8FT-MS');
    const planksPerBay = 3;
    const totalJali = totalBays * planksPerBay * workingDeckCount;

    rawItems.push({
      itemCode: jaliCode,
      qty: Math.max(planksPerBay, totalJali),
      notes: `Anti-skid walkway jali across ${workingDeckCount} active working deck level(s)`,
    });

    // 7. SAFETY GUARDRAILS & TOE BOARDS
    // Double guardrails (top rail + mid rail) on outer working decks
    const guardrailLedgersQty = totalBays * 2 * workingDeckCount;
    rawItems.push({
      itemCode: ledgerCode,
      qty: guardrailLedgersQty,
      notes: `Top & mid safety guardrails for ${workingDeckCount} deck level(s)`,
    });

    // Safety Toe boards along working deck perimeters
    const toeBoardQty = totalBays * workingDeckCount;
    rawItems.push({
      itemCode: 'TOE-BOARD-8FT',
      qty: Math.max(1, toeBoardQty),
      notes: `Galvanized MS safety toe boards (150mm kick plate) along working platforms`,
    });

    // Consolidate raw items and build full ScaffoldingPlanItem breakdown against live inventory
    const consolidatedMap = new Map<string, { qty: number; notes: string }>();
    for (const itm of rawItems) {
      const existing = consolidatedMap.get(itm.itemCode);
      if (existing) {
        existing.qty += itm.qty;
        existing.notes += `; ${itm.notes}`;
      } else {
        consolidatedMap.set(itm.itemCode, { qty: itm.qty, notes: itm.notes || '' });
      }
    }

    const planItems: ScaffoldingPlanItem[] = [];
    let totalPieces = 0;
    let totalWeightKg = 0;
    let totalMonthlyRental = 0;
    let shortageItemsCount = 0;
    let totalShortagePieces = 0;
    let estimatedProcurementCost = 0;

    for (const [code, { qty, notes }] of consolidatedMap.entries()) {
      const mat = invMap.get(code);
      if (!mat) continue;

      const requiredQty = qty;
      const warehouseStock = mat.usableWarehouseQty;
      const currentlyReserved = mat.reservedQty;
      const availableStock = Math.max(0, warehouseStock - currentlyReserved);

      // In Plan 4 (Partial Stock), cap reservation strictly to available stock
      const proposedReserveQty = capAtStock 
        ? Math.min(requiredQty, availableStock)
        : requiredQty;

      const remainingStockAfterReservation = Math.max(0, availableStock - proposedReserveQty);
      const shortageQty = Math.max(0, requiredQty - availableStock);

      let status: ScaffoldingPlanItem['status'] = 'IN_STOCK';
      if (shortageQty > 0) {
        status = availableStock === 0 ? 'OUT_OF_STOCK' : 'PARTIAL_STOCK';
        shortageItemsCount++;
        totalShortagePieces += shortageQty;
        estimatedProcurementCost += shortageQty * (mat.purchaseCost || 1000);
      }

      const itemRentalTotal = proposedReserveQty * (mat.rentalRatePerMonth || 0);
      const itemWeight = requiredQty * (mat.standardWeightKg || 5);

      totalPieces += requiredQty;
      totalWeightKg += itemWeight;
      totalMonthlyRental += itemRentalTotal;

      planItems.push({
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
        monthlyRentalTotal: itemRentalTotal,
        purchaseCost: mat.purchaseCost || 0,
        status,
        weightKg: Math.round(itemWeight * 10) / 10,
        notes,
      });
    }

    // Sort items logically: Verticals first, then Ledgers, Jacks, Couplers, Jali, Safety
    planItems.sort((a, b) => {
      const order = (code: string) => {
        if (code.startsWith('V-')) return 1;
        if (code.startsWith('L-')) return 2;
        if (code.startsWith('JACK') || code.startsWith('BASE') || code.startsWith('WHEEL')) return 3;
        if (code.startsWith('CPL-')) return 4;
        if (code.startsWith('JALI')) return 5;
        return 6;
      };
      return order(a.itemCode) - order(b.itemCode);
    });

    const stockReadinessPercentage = totalPieces > 0 
      ? Math.round(((totalPieces - totalShortagePieces) / totalPieces) * 100)
      : 100;

    const safetyNotes: string[] = [
      `Configuration: ${totalBays} Bays (${bayLengthFt}ft) × ${totalLifts} Lifts (${liftHeightFt}ft) = ${totalVerticalLines} vertical standard lines.`,
      `Working Decks: ${workingDeckCount} fully planked platform(s) with double guardrails & toe boards.`,
      `Estimated structural tare weight: ${(totalWeightKg / 1000).toFixed(2)} Metric Tonnes.`,
    ];

    if (shortageItemsCount > 0) {
      safetyNotes.push(
        `Stock Warning: ${shortageItemsCount} component line(s) have shortages (${totalShortagePieces} units deficit). Procurement/external hire required.`
      );
    } else {
      safetyNotes.push('100% In-Stock: All materials verified available in Taloja Central Yard.');
    }

    return {
      planId,
      planName,
      badge,
      description,
      configurationSummary: {
        configurationType: configType,
        dimensions: {
          length: input.length,
          width: input.width,
          height: input.height,
          unit: input.unit,
          lengthFt,
          widthFt,
          heightFt,
        },
        bayLengthFt,
        transomWidthFt,
        liftHeightFt,
        totalBays,
        totalLifts,
        totalVerticalStandardsGrid: totalVerticalLines,
        workingDeckLevelsCount: workingDeckCount,
        safetyStandard: 'IS 4014 / BS EN 12811 / OSHA',
        loadRatingClass: stockOptimization === 'HEAVY_DUTY' ? 'Class 4 Heavy Duty (3.0 kN/m²)' : 'Class 3 Medium Duty (2.0 kN/m²)',
      },
      materials: planItems,
      totals: {
        totalPieces,
        totalWeightKg: Math.round(totalWeightKg),
        totalMonthlyRental,
        stockReadinessPercentage,
        shortageItemsCount,
        totalShortagePieces,
        estimatedProcurementCost,
      },
      safetyNotes,
    };
  }

  /**
   * Decompose a target height in feet into optimal Cuplock Vertical lengths:
   * 10ft (3.0m), 8ft (2.5m), 7ft (2.0m), 5ft (1.5m), 3ft (1.0m)
   */
  private static decomposeHeight(heightFt: number, mode: 'NONE' | 'PREFER_ABUNDANT' | 'HEAVY_DUTY'): Record<string, number> {
    const result: Record<string, number> = {
      'V-10FT-3M': 0,
      'V-8FT-2.5M': 0,
      'V-7FT-2M': 0,
      'V-5FT-1.5M': 0,
      'V-3FT-1M': 0,
    };

    let remaining = heightFt;

    if (mode === 'PREFER_ABUNDANT') {
      // Prioritize 8ft and 7ft which typically have deepest inventory stock
      while (remaining >= 8) {
        result['V-8FT-2.5M']++;
        remaining -= 8;
      }
      while (remaining >= 7) {
        result['V-7FT-2M']++;
        remaining -= 7;
      }
      while (remaining >= 5) {
        result['V-5FT-1.5M']++;
        remaining -= 5;
      }
      if (remaining > 0) {
        result['V-3FT-1M']++;
      }
    } else {
      // Standard greedy: 10ft standards first, followed by 8ft / 5ft / 3ft
      while (remaining >= 10) {
        result['V-10FT-3M']++;
        remaining -= 10;
      }
      if (remaining >= 8) {
        result['V-8FT-2.5M']++;
        remaining -= 8;
      } else if (remaining >= 7) {
        result['V-7FT-2M']++;
        remaining -= 7;
      } else if (remaining >= 5) {
        result['V-5FT-1.5M']++;
        remaining -= 5;
      } else if (remaining > 0) {
        result['V-3FT-1M']++;
      }
    }

    // Always ensure at least 1 standard if height > 0
    const totalCount = Object.values(result).reduce((a, b) => a + b, 0);
    if (totalCount === 0) {
      result['V-10FT-3M'] = 1;
    }

    return result;
  }
}
