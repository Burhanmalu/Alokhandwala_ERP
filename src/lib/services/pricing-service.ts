/**
 * ALOKHANDWALA ERP - Commercial Pricing & Rental Calculation Service
 * 
 * Single source of truth calculation logic for:
 * - Commercial Quotation (/quotation)
 * - Approved Quotation & Commercial Rental Terms (/confirmation and /projects/[id]/confirm)
 * - Quotation Service backend & PDF generator
 * 
 * Commercial Rental Calculation Rules:
 * 1. Monthly Rental = Applicable Façade Elevation Area (sq. ft.) × Rental Rate per sq. ft.
 * 2. Rental Total = Monthly Rental × Duration (Months) (28-day cycle per month)
 * 3. Extra Walkway Jali = (Total Jali - Included Jali) × ₹200/pc (default 1 jali per unit included)
 * 4. Subtotal = Rental Total + Extra Jali Charges + Transport Charges + Shifting Charges + Other Charges
 * 5. GST Amount = Subtotal × (GST Percentage / 100) (default 18%)
 * 6. Grand Total = Subtotal + GST Amount
 * 7. Payment Schedule: 75% Advance (payable prior to delivery) / 25% Balance on Installation Completion
 */

export interface PricingInput {
  totalAreaSqFt: number;
  ratePerSqFt?: number;
  durationMonths?: number;
  rentalDurationDays?: number;
  extraJaliQuantity?: number;
  extraJaliRate?: number;
  walkwayJaliIncludedQuantity?: number;
  totalJaliQuantity?: number;
  transportCharges?: number;
  shiftingCharges?: number;
  otherCharges?: number;
  gstPercentage?: number;
}

export interface PricingBreakdown {
  applicableAreaSqFt: number;
  ratePerSqFt: number;
  monthlyRentalAmount: number; // Monthly rental for 1 month (28 days) = Area * Rate
  durationMonths: number;
  rentalDurationDays: number;
  rentalTotalAmount: number;   // monthlyRentalAmount * durationMonths

  // Walkway Jali
  totalJaliQuantity: number;
  walkwayJaliIncludedQuantity: number;
  extraJaliQuantity: number;
  extraJaliRate: number;
  extraJaliCharges: number;

  // Logistics & Ancillary
  transportCharges: number;
  shiftingCharges: number;
  otherCharges: number;

  // Subtotal & Taxes
  subtotal: number;
  gstPercentage: number;
  gstAmount: number;
  grandTotal: number;

  // Payment Schedule
  advancePercentage: number;
  advanceAmount: number;
  balanceAmount: number;
  remainingAmount: number; // alias for balanceAmount

  // Backwards compatibility aliases
  monthlyRent: number;
  extraJali: number;
  transport: number;
  shifting: number;
  other: number;
  advance75: number;
  balance25: number;
}

export const PRICING_DEFAULTS = {
  DEFAULT_RATE_PER_SQFT: 22,
  DEFAULT_DURATION_MONTHS: 1,
  DEFAULT_DAYS_PER_MONTH: 28,
  DEFAULT_EXTRA_JALI_RATE: 200,
  DEFAULT_GST_PERCENTAGE: 18,
  DEFAULT_ADVANCE_PERCENTAGE: 75,
  DEFAULT_BALANCE_PERCENTAGE: 25,
  DEFAULT_TRANSPORT_CHARGES: 4500,
};

/**
 * Calculate commercial pricing breakdown consistently across all modules.
 */
export function calculateCommercialPricing(input: PricingInput): PricingBreakdown {
  const applicableAreaSqFt = Math.max(0, Number(input.totalAreaSqFt) || 0);
  const ratePerSqFt = input.ratePerSqFt !== undefined && !isNaN(Number(input.ratePerSqFt))
    ? Math.max(0, Number(input.ratePerSqFt))
    : PRICING_DEFAULTS.DEFAULT_RATE_PER_SQFT;
  
  const durationMonths = Math.max(1, Number(input.durationMonths) || PRICING_DEFAULTS.DEFAULT_DURATION_MONTHS);
  const rentalDurationDays = input.rentalDurationDays || (durationMonths * PRICING_DEFAULTS.DEFAULT_DAYS_PER_MONTH);

  // 1. Monthly Rental Amount (for 1 month / 28 days)
  const monthlyRentalAmount = Math.round(applicableAreaSqFt * ratePerSqFt * 100) / 100;

  // 2. Duration Rental Total
  const rentalTotalAmount = Math.round(monthlyRentalAmount * durationMonths * 100) / 100;

  // 3. Walkway Jali Calculation
  const extraJaliRate = input.extraJaliRate !== undefined && !isNaN(Number(input.extraJaliRate))
    ? Number(input.extraJaliRate)
    : PRICING_DEFAULTS.DEFAULT_EXTRA_JALI_RATE;

  let extraJaliQuantity = Math.max(0, Number(input.extraJaliQuantity) || 0);
  let walkwayJaliIncludedQuantity = Math.max(0, Number(input.walkwayJaliIncludedQuantity) || 0);
  let totalJaliQuantity = Math.max(0, Number(input.totalJaliQuantity) || 0);

  // If total and included are provided, compute extra
  if (totalJaliQuantity > 0 && walkwayJaliIncludedQuantity > 0 && input.extraJaliQuantity === undefined) {
    extraJaliQuantity = Math.max(0, totalJaliQuantity - walkwayJaliIncludedQuantity);
  } else if (extraJaliQuantity > 0 && totalJaliQuantity === 0) {
    totalJaliQuantity = walkwayJaliIncludedQuantity + extraJaliQuantity;
  }

  const extraJaliCharges = Math.round(extraJaliQuantity * extraJaliRate * 100) / 100;

  // 4. Transport & Other Charges (Preserve transport charges, never reset to 0 unless explicitly 0)
  const transportCharges = input.transportCharges !== undefined && !isNaN(Number(input.transportCharges))
    ? Math.max(0, Number(input.transportCharges))
    : 0;
  const shiftingCharges = Math.max(0, Number(input.shiftingCharges) || 0);
  const otherCharges = Math.max(0, Number(input.otherCharges) || 0);

  // 5. Subtotal = Rental Total + Extra Jali + Transport + Shifting + Other
  const subtotal = Math.round(
    (rentalTotalAmount + extraJaliCharges + transportCharges + shiftingCharges + otherCharges) * 100
  ) / 100;

  // 6. GST Calculation
  const gstPercentage = input.gstPercentage !== undefined && !isNaN(Number(input.gstPercentage))
    ? Number(input.gstPercentage)
    : PRICING_DEFAULTS.DEFAULT_GST_PERCENTAGE;
  const gstAmount = Math.round((subtotal * (gstPercentage / 100)) * 100) / 100;

  // 7. Grand Total
  const grandTotal = Math.round((subtotal + gstAmount) * 100) / 100;

  // 8. Payment Schedule (75% Advance, 25% Balance on Completion)
  const advancePercentage = PRICING_DEFAULTS.DEFAULT_ADVANCE_PERCENTAGE;
  const advanceAmount = Math.round((grandTotal * 0.75) * 100) / 100;
  const balanceAmount = Math.round((grandTotal - advanceAmount) * 100) / 100;

  return {
    applicableAreaSqFt,
    ratePerSqFt,
    monthlyRentalAmount,
    durationMonths,
    rentalDurationDays,
    rentalTotalAmount,
    totalJaliQuantity,
    walkwayJaliIncludedQuantity,
    extraJaliQuantity,
    extraJaliRate,
    extraJaliCharges,
    transportCharges,
    shiftingCharges,
    otherCharges,
    subtotal,
    gstPercentage,
    gstAmount,
    grandTotal,
    advancePercentage,
    advanceAmount,
    balanceAmount,
    remainingAmount: balanceAmount,
    monthlyRent: monthlyRentalAmount,
    extraJali: extraJaliCharges,
    transport: transportCharges,
    shifting: shiftingCharges,
    other: otherCharges,
    advance75: advanceAmount,
    balance25: balanceAmount,
  };
}
