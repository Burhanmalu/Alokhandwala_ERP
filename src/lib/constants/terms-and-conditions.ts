// ALOKHANDWALA - Official Business Terms & Conditions
// Centralized Source of Truth for Quotations, Confirmations, Installations, Invoices, and PDFs

export interface BusinessTerm {
  id: number;
  title: string;
  category: 'PRICING' | 'RENTAL' | 'LOGISTICS' | 'EQUIPMENT' | 'PAYMENT' | 'RESPONSIBILITY' | 'OPERATIONS';
  shortSummary: string;
  fullText: string;
}

export const OFFICIAL_TERMS_AND_CONDITIONS: BusinessTerm[] = [
  {
    id: 1,
    title: 'Pricing',
    category: 'PRICING',
    shortSummary: 'Per-square-foot basis; actual area depends on site conditions & installed quantity.',
    fullText: 'All prices are calculated on a per-square-foot (sq. ft.) basis. The actual area may vary depending on site conditions and the final quantity required during installation.',
  },
  {
    id: 2,
    title: 'Rental Period',
    category: 'RENTAL',
    shortSummary: 'Quoted price applicable for 28 days (1 month). Exceeding by 1 day incurs monthly charges.',
    fullText: 'The quoted price is applicable for 28 days (1 month). If the rental period exceeds 28 days by even 1 day, the applicable monthly charges will be charged.',
  },
  {
    id: 3,
    title: 'Transportation',
    category: 'LOGISTICS',
    shortSummary: 'Extra 2-way charges applicable for both delivery and return transportation.',
    fullText: 'Transportation charges are extra and will be charged for both delivery and return transportation (2-way charges).',
  },
  {
    id: 4,
    title: 'Walkway Jali',
    category: 'EQUIPMENT',
    shortSummary: '1 walkway Jali included per unit; additional Jali charged at ₹200 per piece.',
    fullText: '1 walkway Jali is included with each unit of scaffolding. Any additional walkway Jali will be charged at ₹200 per piece.',
  },
  {
    id: 5,
    title: 'Shifting Charges',
    category: 'LOGISTICS',
    shortSummary: 'Extra customer-borne charges: ₹6 per sq. ft. or 60% of the per-unit amount.',
    fullText: 'Shifting charges are extra and shall be borne by the customer. Charges will be ₹6 per sq. ft. or 60% of the per-unit amount, as applicable.',
  },
  {
    id: 6,
    title: 'Order Cancellation',
    category: 'OPERATIONS',
    shortSummary: 'Strictly non-cancellable once confirmed.',
    fullText: 'Once the order is confirmed, it cannot be cancelled.',
  },
  {
    id: 7,
    title: 'Payment Terms',
    category: 'PAYMENT',
    shortSummary: '75% advance before installation; remaining 25% post-installation completion.',
    fullText: '75% advance payment is required before installation. The remaining 25% shall be paid after completion of installation.',
  },
  {
    id: 8,
    title: 'Monthly Payment',
    category: 'PAYMENT',
    shortSummary: 'Due on next day after completion of each 28-day rental period.',
    fullText: 'For extended rental periods, the monthly rental payment must be made on the next day after completion of each 28-day/month rental period.',
  },
  {
    id: 9,
    title: 'Damage or Misplacement',
    category: 'RESPONSIBILITY',
    shortSummary: 'Customer liable for damage, loss, or misplacement at prevailing material values.',
    fullText: 'The customer shall be responsible for any damage, loss, or misplacement of scaffolding material at the site. The value of damaged or missing material will be charged according to the prevailing material value on the date of assessment.',
  },
  {
    id: 10,
    title: 'Post-Installation Visit',
    category: 'OPERATIONS',
    shortSummary: 'Visits after installation completion are chargeable by location and scope.',
    fullText: 'Any visit required after completion of installation will be chargeable, depending on the location and nature of the visit.',
  },
  {
    id: 11,
    title: 'Challan & Material Responsibility',
    category: 'RESPONSIBILITY',
    shortSummary: 'Customer must approve delivery challan; uninstallation reconciled against approved challan.',
    fullText: 'At the time of installation, the customer must verify and approve the delivery challan containing details of all scaffolding materials supplied at the site. The customer shall be responsible for the safekeeping of all materials during the rental period. At the time of uninstallation, the materials will be verified against the approved delivery challan, and any shortage, loss, misplacement, or damage shall be charged to the customer as per the applicable material value.',
  },
];

/**
 * Filter terms applicable to specific customer-facing documents
 */
export function getTermsForDocumentType(type: 'CONFIRMATION' | 'INSTALLATION' | 'INVOICE' | 'SHIFTING' | 'QUOTATION'): BusinessTerm[] {
  switch (type) {
    case 'CONFIRMATION':
    case 'QUOTATION':
      // Confirmation & Quotation require all 11 full commercial and operational terms
      return OFFICIAL_TERMS_AND_CONDITIONS;
    case 'INSTALLATION':
      // Installation certificate emphasizes material custody, challan verification, visits, damage, and rental continuity
      return OFFICIAL_TERMS_AND_CONDITIONS.filter(t => [11, 9, 10, 2, 8, 4].includes(t.id));
    case 'INVOICE':
      // Billing & Invoices emphasize pricing, rental duration, payment schedule, transportation, extra jali, and damage
      return OFFICIAL_TERMS_AND_CONDITIONS.filter(t => [1, 2, 7, 8, 3, 4, 9, 5].includes(t.id));
    case 'SHIFTING':
      // Shifting document emphasizes shifting charges, challan reconciliation, damage, and visit charges
      return OFFICIAL_TERMS_AND_CONDITIONS.filter(t => [5, 11, 9, 10, 2].includes(t.id));
    default:
      return OFFICIAL_TERMS_AND_CONDITIONS;
  }
}

/**
 * Default standard payment clause text formatted from the official terms
 */
export const DEFAULT_PAYMENT_TERMS_TEXT = 
  '75% advance payment required before installation. Remaining 25% payable after installation completion. For extended rentals, monthly payments must be made on the next day following completion of each 28-day rental period.';

/**
 * Standard business constants derived from official terms
 */
export const RENTAL_CONSTANTS = {
  RENTAL_DAYS_PER_MONTH: 28,
  ADVANCE_PAYMENT_PERCENTAGE: 75,
  COMPLETION_PAYMENT_PERCENTAGE: 25,
  INCLUDED_WALKWAY_JALI_PER_UNIT: 1,
  EXTRA_WALKWAY_JALI_RATE: 200, // ₹200 per piece
  SHIFTING_RATE_PER_SQFT: 6, // ₹6 per sq. ft.
  SHIFTING_PERCENTAGE_OF_UNIT: 0.60, // 60% of unit amount
  SHIFTING_PERCENTAGE_OF_UNIT_RENTAL: 0.60,
};
