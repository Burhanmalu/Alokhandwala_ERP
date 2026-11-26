// ALOKHANDWALA - Formatting and Localization Utilities (en-IN, INR)

export const NON_ACTIVE_PROJECT_STATUSES = [
  'NOT_INSTALLED',
  'SITE_CREATED',
  'QUOTATION_DRAFT',
  'QUOTATION_SENT',
  'QUOTATION_ACCEPTED',
] as const;

export function isEligibleActiveProjectStatus(status?: string | null): boolean {
  if (!status) return false;
  return !(NON_ACTIVE_PROJECT_STATUSES as readonly string[]).includes(status);
}

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
  const start =
    typeof startDate === 'string'
      ? toUtcMidnightFromDateOnly(startDate) || new Date(startDate)
      : new Date(startDate);
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
 * Add days in UTC-safe calendar arithmetic (typically buffer or daily extensions)
 */
export function addDays(startDate: string | Date, daysToAdd: number): Date {
  const start =
    typeof startDate === 'string'
      ? toUtcMidnightFromDateOnly(startDate) || new Date(startDate)
      : new Date(startDate);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + daysToAdd));
}

/**
 * Extract clean YYYY-MM-DD string from any date input
 */
export function toDateOnlyString(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') {
    const clean = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
      return clean.slice(0, 10);
    }
    const d = new Date(clean);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }
  if (isNaN(dateInput.getTime())) return '';
  return dateInput.toISOString().slice(0, 10);
}

/**
 * Calculate New Removal Date = Current Effective Removal Date + Extension Duration (Days or Calendar Months)
 */
export function calculateExtendedRemovalDate(
  baseDate: string | Date,
  amount: number,
  unit: 'DAYS' | 'MONTHS'
): string {
  const safeAmount = Math.max(0, Math.trunc(Number(amount) || 0));
  const resultDate =
    unit === 'DAYS'
      ? addDays(baseDate, safeAmount)
      : addCalendarMonths(baseDate, safeAmount);
  return toDateOnlyString(resultDate);
}

/**
 * Calculate Removal Date from Installation Date + Rental Duration in Months (supports decimals e.g. 1.5, 2.5)
 * Example: 2026-12-01 + 3 Months => 2027-03-01
 */
export function calculateRemovalDateFromMonths(
  installationDate?: string | null,
  monthsValue?: number | string | null
): string {
  if (!installationDate) return '';
  const start = toUtcMidnightFromDateOnly(installationDate);
  if (!start) return '';
  const numMonths = Number(monthsValue);
  if (isNaN(numMonths) || numMonths <= 0) return '';

  const wholeMonths = Math.floor(numMonths);
  const fractionalMonths = numMonths - wholeMonths;
  const extraDays = Math.round(fractionalMonths * 30);

  let target = start;
  if (wholeMonths > 0) {
    target = addCalendarMonths(target, wholeMonths);
  }
  if (extraDays > 0) {
    target = addDays(target, extraDays);
  }
  return toDateOnlyString(target);
}

/**
 * Project statuses where Date of Installation and Date of Removal are not applicable:
 * 1. Not Installed (NOT_INSTALLED)
 * 2. Pending Approval (Draft Quotation) (QUOTATION_DRAFT)
 * 3. Quotation Accepted (QUOTATION_ACCEPTED)
 * 4. Confirmed (Reserved) (CONFIRMED_PROJECT)
 */
export function isDateNotApplicableStatus(status?: string | null): boolean {
  if (!status) return false;
  return (
    status === 'NOT_INSTALLED' ||
    status === 'QUOTATION_DRAFT' ||
    status === 'QUOTATION_ACCEPTED' ||
    status === 'CONFIRMED_PROJECT'
  );
}

/**
 * Single source of truth for Effective Removal Date across Directory, Project Details, Edit Form, & Dashboard
 */
export function getEffectiveRemovalDate(project: {
  bufferEndDate?: string | null;
  removalDate?: string | null;
  rentalEndDate?: string | null;
  actualDismantlingDate?: string | null;
} | null | undefined): string {
  if (!project) return '';
  return (
    project.bufferEndDate ||
    project.removalDate ||
    project.rentalEndDate ||
    project.actualDismantlingDate ||
    ''
  );
}

/**
 * Single source of truth for Project Installation Date
 */
export function getProjectInstallDateStr(project: {
  installationDate?: string | null;
  actualInstallationDate?: string | null;
  plannedInstallationDate?: string | null;
  rentalStartDate?: string | null;
} | null | undefined): string {
  if (!project) return '';
  return (
    project.installationDate ||
    project.actualInstallationDate ||
    project.plannedInstallationDate ||
    project.rentalStartDate ||
    ''
  );
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

export interface RentalDurationBreakdown {
  months: number;
  days: number;
  totalDays: number;
  isOngoing: boolean;
  isInvalid: boolean;
  isScheduled: boolean;
  display: string; // e.g. "2 Months, 15 Days" or "Ongoing – 3 Months, 5 Days"
}

/**
 * Calculate Rental Duration automatically from Installation Date & Removal Date
 * Formula: Rental Duration = Date of Removal - Date of Installation
 * If Removal Date is absent, calculates ongoing duration up to the current date.
 */
export function calculateRentalDurationBreakdown(
  installationDate?: string | null,
  removalDate?: string | null,
  referenceDate?: Date
): RentalDurationBreakdown {
  if (!installationDate || !installationDate.trim()) {
    return {
      months: 0,
      days: 0,
      totalDays: 0,
      isOngoing: false,
      isInvalid: false,
      isScheduled: false,
      display: '',
    };
  }

  const parseUtcDate = (isoDate: string): Date | null => {
    const clean = isoDate.slice(0, 10);
    const parts = clean.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  };

  const start = parseUtcDate(installationDate);
  if (!start) {
    return {
      months: 0,
      days: 0,
      totalDays: 0,
      isOngoing: false,
      isInvalid: false,
      isScheduled: false,
      display: '',
    };
  }

  const hasRemoval = Boolean(removalDate && removalDate.trim());
  const now = referenceDate || new Date();
  const end = hasRemoval
    ? parseUtcDate(removalDate!)
    : new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  if (!end) {
    return {
      months: 0,
      days: 0,
      totalDays: 0,
      isOngoing: false,
      isInvalid: false,
      isScheduled: false,
      display: '',
    };
  }

  if (hasRemoval && end.getTime() < start.getTime()) {
    return {
      months: 0,
      days: 0,
      totalDays: -1,
      isOngoing: false,
      isInvalid: true,
      isScheduled: false,
      display: 'Removal date cannot be earlier than installation date',
    };
  }

  if (!hasRemoval && end.getTime() < start.getTime()) {
    return {
      months: 0,
      days: 0,
      totalDays: 0,
      isOngoing: true,
      isInvalid: false,
      isScheduled: true,
      display: 'Scheduled (Not Started)',
    };
  }

  const sy = start.getUTCFullYear();
  const sm = start.getUTCMonth() + 1;
  const sd = start.getUTCDate();
  const ey = end.getUTCFullYear();
  const em = end.getUTCMonth() + 1;
  const ed = end.getUTCDate();

  let months = (ey - sy) * 12 + (em - sm);
  let days = ed - sd;

  if (days < 0) {
    months -= 1;
    const daysInPrevMonth = new Date(Date.UTC(ey, em - 1, 0)).getUTCDate();
    days = Math.max(0, daysInPrevMonth - sd) + ed;
  }

  const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const monthLabel = `${months} ${months === 1 ? 'Month' : 'Months'}`;
  const dayLabel = `${days} ${days === 1 ? 'Day' : 'Days'}`;

  let durationText = '';
  if (months > 0 && days > 0) {
    durationText = `${monthLabel}, ${dayLabel}`;
  } else if (months > 0 && days === 0) {
    durationText = monthLabel;
  } else {
    durationText = `${monthLabel}, ${dayLabel}`;
  }

  const display = !hasRemoval ? `Ongoing – ${durationText}` : durationText;

  return {
    months,
    days,
    totalDays,
    isOngoing: !hasRemoval,
    isInvalid: false,
    isScheduled: false,
    display,
  };
}

export type RemainingDaysSeverity = 'success' | 'warning' | 'danger' | 'overdue' | 'neutral';

export interface RemainingDaysInfo {
  days: number | null;
  label: string;
  severity: RemainingDaysSeverity;
  badgeClass: string;
  dotClass: string;
  isAlert: boolean; // true when <= 7 days or overdue
}

function toUtcMidnightFromDateOnly(dateInput?: string | Date | null): Date | null {
  if (!dateInput) return null;
  if (typeof dateInput === 'string') {
    const clean = dateInput.trim().slice(0, 10);
    const parts = clean.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    }
    const parsed = new Date(dateInput);
    if (isNaN(parsed.getTime())) return null;
    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  }
  if (isNaN(dateInput.getTime())) return null;
  return new Date(Date.UTC(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate()));
}

/**
 * Dynamic Remaining Rental Days Calculation & Expiry Alert Classification
 * Formula: Remaining Days = Date of Removal - Current Date (local calendar days)
 * Color Rules:
 *   > 15 days  -> Green (success)
 *   8–15 days  -> Orange (warning)
 *   0–7 days   -> Red Alert (danger)
 *   < 0 days   -> Red Overdue (overdue)
 */
export function getRemainingDaysInfo(
  removalDate?: string | null,
  status?: string,
  referenceDate?: Date
): RemainingDaysInfo {
  if (status === 'CLOSED' || status === 'RETURNED_RECONCILIATION' || status === 'CANCELLED') {
    return {
      days: null,
      label: status === 'CANCELLED' ? 'Cancelled' : 'Removed',
      severity: 'neutral',
      badgeClass: 'bg-stone-100 text-stone-700 border-stone-300',
      dotClass: 'bg-stone-500',
      isAlert: false,
    };
  }

  const target = toUtcMidnightFromDateOnly(removalDate);
  if (!target) {
    return {
      days: null,
      label: 'Not Scheduled',
      severity: 'neutral',
      badgeClass: 'bg-stone-100 text-stone-600 border-stone-200',
      dotClass: 'bg-stone-400',
      isAlert: false,
    };
  }

  const now = referenceDate || new Date();
  const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const diffDays = Math.round((target.getTime() - todayUtc.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays > 15) {
    return {
      days: diffDays,
      label: `${diffDays} Days Left`,
      severity: 'success',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      dotClass: 'bg-emerald-600',
      isAlert: false,
    };
  }

  if (diffDays >= 8) {
    return {
      days: diffDays,
      label: `${diffDays} Days Left`,
      severity: 'warning',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
      dotClass: 'bg-amber-500',
      isAlert: false,
    };
  }

  if (diffDays >= 1) {
    return {
      days: diffDays,
      label: diffDays === 1 ? '1 Day Left' : `${diffDays} Days Left`,
      severity: 'danger',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-400 font-bold',
      dotClass: 'bg-rose-600',
      isAlert: true,
    };
  }

  if (diffDays === 0) {
    return {
      days: 0,
      label: 'Due Today',
      severity: 'danger',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-500 font-bold',
      dotClass: 'bg-rose-600 animate-pulse',
      isAlert: true,
    };
  }

  const overdueDays = Math.abs(diffDays);
  return {
    days: diffDays,
    label: `Overdue by ${overdueDays} ${overdueDays === 1 ? 'Day' : 'Days'}`,
    severity: 'overdue',
    badgeClass: 'bg-rose-600 text-white border-rose-700 font-bold shadow-2xs',
    dotClass: 'bg-white animate-pulse',
    isAlert: true,
  };
}

export interface FollowUpStatusInfo {
  isOverdue: boolean;
  isDueToday: boolean;
  isAfterRemoval: boolean;
  daysDiff: number | null;
}

/**
 * Evaluate Follow-Up Date status (overdue, due today, or scheduled after removal date)
 */
export function getFollowUpStatus(
  followUpDate?: string | null,
  removalDate?: string | null,
  status?: string,
  referenceDate?: Date
): FollowUpStatusInfo {
  if (!followUpDate || status === 'CLOSED' || status === 'CANCELLED') {
    return { isOverdue: false, isDueToday: false, isAfterRemoval: false, daysDiff: null };
  }

  const followUtc = toUtcMidnightFromDateOnly(followUpDate);
  if (!followUtc) {
    return { isOverdue: false, isDueToday: false, isAfterRemoval: false, daysDiff: null };
  }

  const now = referenceDate || new Date();
  const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const daysDiff = Math.round((followUtc.getTime() - todayUtc.getTime()) / (1000 * 60 * 60 * 24));
  const removalUtc = toUtcMidnightFromDateOnly(removalDate);

  return {
    isOverdue: daysDiff < 0,
    isDueToday: daysDiff === 0,
    isAfterRemoval: Boolean(removalUtc && followUtc.getTime() > removalUtc.getTime()),
    daysDiff,
  };
}
