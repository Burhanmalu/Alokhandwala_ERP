// ALOKHANDWALA - Formatting and Localization Utilities (en-IN, INR)

/**
 * Format a number as Indian Currency (INR / ₹)
 * Supports Indian number numbering system (e.g. ₹ 1,50,000.00 or ₹ 12,50,000)
 */
/**
 * Scaffolding Engineering Dimensions Area Calculation - GLOBAL BUSINESS FORMULA
 *
 * Rules:
 *   Condition 1: When Depth > 3 ft:
 *     Elevation Area = Width × (Depth / 3) × Height
 *   Condition 2: When Depth < 3 ft:
 *     Elevation Area = Width × 1 × Height
 *   Condition 3: When Depth = 3 ft:
 *     Elevation Area = Width × 1 × Height
 *
 * Reusable Standard Formula:
 *   const effectiveDepth = depthFt > 3 ? depthFt / 3 : 1;
 *   const area = widthFt * effectiveDepth * heightFt;
 *
 * All inputs normalized to Feet (ft).
 * Returns calculated elevation area in sq. ft. rounded to 2 decimal places.
 */
export function calculateScaffoldingArea(
  width: number,
  depth: number,
  height: number,
  unit: 'FEET' | 'METERS' = 'FEET'
): number {
  if (width <= 0 || height <= 0 || depth <= 0) return 0;

  // Convert meters to feet if unit is METERS (1m = 1 / 0.3048 ft)
  const widthFt = unit === 'METERS' ? width / 0.3048 : width;
  const depthFt = unit === 'METERS' ? depth / 0.3048 : depth;
  const heightFt = unit === 'METERS' ? height / 0.3048 : height;

  // Global Scaffolding Business Formula
  const effectiveDepth = depthFt > 3 ? depthFt / 3 : 1;
  const area = widthFt * effectiveDepth * heightFt;

  return Math.round(area * 100) / 100;
}

export interface ExtractedDimensions {
  width: number;
  depth: number;
  height: number;
  unit: 'FEET' | 'METERS';
  elevationAreaSqFt: number;
  formattedDimensions: string; // e.g. "10 (W) × 15 (D) × 20 (H) FEET"
  formattedArea: string; // e.g. "1,000 sq. ft."
}

/**
 * Robustly extract, normalize, and format scaffolding dimensions from any
 * project, site measurement, or quotation record as the single source of truth.
 */
export function extractProjectDimensions(source: any): ExtractedDimensions {
  if (!source) {
    return {
      width: 0,
      depth: 0,
      height: 0,
      unit: 'FEET',
      elevationAreaSqFt: 0,
      formattedDimensions: 'Dimensions Pending',
      formattedArea: '0 sq. ft.',
    };
  }

  // Handle nested objects: project.measurements, project.siteDimensions, quotation.dimensions, or flat object
  const meas = source.measurements || source.siteDimensions || source.dimensions || source;

  // Width: width or length (in legacy records, length was used as width)
  const width = Number(
    meas.width !== undefined && meas.width !== null
      ? meas.width
      : meas.length !== undefined && meas.length !== null
        ? meas.length
        : meas.w || 0
  ) || 0;

  // Depth: depth or d, default to 3 if not specified
  const depth = Number(
    meas.depth !== undefined && meas.depth !== null
      ? meas.depth
      : meas.d !== undefined && meas.d !== null
        ? meas.d
        : 3
  ) || 3;

  // Height: height or h
  const height = Number(
    meas.height !== undefined && meas.height !== null
      ? meas.height
      : meas.h || 0
  ) || 0;

  // Unit: FEET or METERS
  const rawUnit = (meas.unit || source.unit || 'FEET').toString().toUpperCase();
  const unit: 'FEET' | 'METERS' = rawUnit.includes('M') ? 'METERS' : 'FEET';

  // Elevation Area (Sq. Ft.) - Always calculate from dimensions using Global Formula as Single Source of Truth
  const calculatedArea = (width > 0 && height > 0)
    ? calculateScaffoldingArea(width, depth, height, unit)
    : 0;

  const elevationAreaSqFt = calculatedArea > 0
    ? calculatedArea
    : Number(
        meas.elevationAreaSqFt ||
          source.elevationAreaSqFt ||
          meas.totalAreaSqFt ||
          source.totalAreaSqFt ||
          0
      );

  const formattedDimensions = (width > 0 && height > 0)
    ? `${width} (W) × ${depth} (D) × ${height} (H) ${unit}`
    : 'Dimensions Pending';

  const formattedArea = `${Math.round(elevationAreaSqFt).toLocaleString('en-IN')} sq. ft.`;

  return {
    width,
    depth,
    height,
    unit,
    elevationAreaSqFt: Math.round(elevationAreaSqFt * 100) / 100,
    formattedDimensions,
    formattedArea,
  };
}

export function formatINR(amount: number | undefined | null, includeDecimals = true): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '₹0.00';
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  }).format(absAmount);

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Format quantity with unit (e.g. "1,200 Nos", "500 Sets")
 */
export function formatQuantity(quantity: number | undefined | null, unit = 'Nos'): string {
  if (quantity === undefined || quantity === null) return `0 ${unit}`;
  return `${new Intl.NumberFormat('en-IN').format(quantity)} ${unit}`;
}

/**
 * Format Date to readable Indian standard format (DD MMM YYYY)
 */
export function formatDate(dateString?: string | Date | null): string {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '-';
  
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format Date & Time for audit and activity logs
 */
export function formatDateTime(dateString?: string | Date | null): string {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '-';

  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Calculate difference in days between two dates
 */
export function getDaysDifference(targetDate?: string | Date | null, baseDate = new Date()): number | null {
  if (!targetDate) return null;
  const target = new Date(targetDate);
  if (isNaN(target.getTime())) return null;

  const diffTime = target.getTime() - baseDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calendar-month date addition arithmetic
 * Accurately handles variable month lengths (28, 30, 31 days)
 */
export function addCalendarMonths(startDate: string | Date, monthsToAdd: number): Date {
  const start = new Date(startDate);
  // Use UTC methods to prevent local timezone offsets from shifting dates across midnight
  const targetYear = start.getUTCFullYear();
  const targetMonth = start.getUTCMonth() + monthsToAdd;
  const originalDay = start.getUTCDate();

  const result = new Date(Date.UTC(targetYear, targetMonth, 1));
  const maxDaysInTargetMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(originalDay, maxDaysInTargetMonth));
  
  return result;
}

/**
 * Add buffer days (typically 2-3 days)
 */
export function addDays(startDate: string | Date, daysToAdd: number): Date {
  const result = new Date(startDate);
  result.setDate(result.getDate() + daysToAdd);
  return result;
}

/**
 * Calculate GST Breakdown (Intra-state = CGST 9% + SGST 9%, Inter-state = IGST 18%)
 */
export function calculateGST(
  taxableAmount: number,
  clientState = 'Maharashtra',
  companyState = 'Maharashtra',
  gstRate = 18
) {
  const isIntraState = clientState.trim().toLowerCase() === companyState.trim().toLowerCase();
  const totalTaxAmount = Math.round(((taxableAmount * gstRate) / 100) * 100) / 100;

  if (isIntraState) {
    const halfRate = gstRate / 2;
    const halfTax = Math.round((totalTaxAmount / 2) * 100) / 100;
    return {
      isIntraState: true,
      cgstRate: halfRate,
      cgstAmount: halfTax,
      sgstRate: halfRate,
      sgstAmount: halfTax,
      igstRate: 0,
      igstAmount: 0,
      totalTax: halfTax * 2,
      totalAmount: taxableAmount + halfTax * 2,
    };
  } else {
    return {
      isIntraState: false,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: gstRate,
      igstAmount: totalTaxAmount,
      totalTax: totalTaxAmount,
      totalAmount: taxableAmount + totalTaxAmount,
    };
  }
}

/**
 * Get human readable status label and Tailwind badge classes
 */
export function getStatusBadgeConfig(status: string) {
  switch (status) {
    case 'SITE_CREATED':
      return {
        label: 'Site Created',
        className: 'bg-stone-100 text-stone-800 border-stone-300',
        dotColor: 'bg-stone-500',
      };
    case 'QUOTATION_DRAFT':
    case 'QUOTATION_SENT':
      return {
        label: 'Pending Approval',
        className: 'bg-amber-50 text-amber-900 border-amber-300',
        dotColor: 'bg-amber-600',
      };
    case 'QUOTATION_ACCEPTED':
      return {
        label: 'Quotation Accepted',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        dotColor: 'bg-emerald-600',
      };
    case 'QUOTATION_REJECTED':
      return {
        label: 'Quotation Rejected',
        className: 'bg-rose-50 text-rose-800 border-rose-300',
        dotColor: 'bg-rose-600',
      };
    case 'NOT_INSTALLED':
      return {
        label: 'Not Installed',
        className: 'bg-slate-100 text-slate-800 border-slate-300',
        dotColor: 'bg-slate-500',
      };
    case 'CONFIRMED_PROJECT':
      return {
        label: 'Confirmed (Reserved)',
        className: 'bg-blue-50 text-blue-700 border-blue-200',
        dotColor: 'bg-blue-600',
      };
    case 'SCHEDULED':
      return {
        label: 'Installation Scheduled',
        className: 'bg-purple-50 text-purple-700 border-purple-200',
        dotColor: 'bg-purple-600',
      };
    case 'INSTALLED':
    case 'ACTIVE_RENTAL':
      return {
        label: 'Active Rental',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        dotColor: 'bg-emerald-600',
      };
    case 'BUFFER_PERIOD':
      return {
        label: 'Buffer Period',
        className: 'bg-amber-50 text-amber-800 border-amber-300',
        dotColor: 'bg-amber-600',
      };
    case 'EXTENSION_REQUESTED':
      return {
        label: 'Extension Requested',
        className: 'bg-cyan-50 text-cyan-800 border-cyan-300',
        dotColor: 'bg-cyan-600',
      };
    case 'EXTENDED':
      return {
        label: 'Rental Extended',
        className: 'bg-teal-50 text-teal-800 border-teal-300',
        dotColor: 'bg-teal-600',
      };
    case 'SHIFTING_PENDING':
    case 'SHIFTING_IN_PROGRESS':
      return {
        label: 'Shifting Active',
        className: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        dotColor: 'bg-indigo-600',
      };
    case 'REMOVAL_PENDING':
      return {
        label: 'Removal Pending',
        className: 'bg-orange-50 text-orange-800 border-orange-300',
        dotColor: 'bg-orange-600',
      };
    case 'RETURNED_RECONCILIATION':
      return {
        label: 'Reconciliation',
        className: 'bg-rose-50 text-rose-800 border-rose-300',
        dotColor: 'bg-rose-600',
      };
    case 'CLOSED':
      return {
        label: 'Project Closed',
        className: 'bg-gray-100 text-gray-700 border-gray-300',
        dotColor: 'bg-gray-500',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        className: 'bg-red-50 text-red-700 border-red-200',
        dotColor: 'bg-red-600',
      };
    default:
      return {
        label: status,
        className: 'bg-slate-100 text-slate-700 border-slate-200',
        dotColor: 'bg-slate-500',
      };
  }
}
