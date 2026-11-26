// ALOKHANDWALA - Zod Schemas for Form & API Validation

import { z } from 'zod';

/**
 * Standard Indian 15-character GSTIN regular expression
 * 2 digits (State code) + 10 chars (PAN) + 1 entity num + 'Z' + 1 checksum char
 */
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidGSTIN(val?: string | null): boolean {
  if (!val || val === 'N/A') return false;
  return GSTIN_REGEX.test(val.trim().toUpperCase());
}

export const customerSchema = z.object({
  companyName: z.string().min(2, 'Customer name is required'),
  referenceName: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().min(10, 'Valid 10-digit phone number is required'),
  email: z.string().email('Valid email address is required').optional().or(z.literal('')),
  billingAddress: z.string().min(5, 'Address is required'),
  city: z.string().optional().default('Indore'),
  state: z.string().optional().default('Madhya Pradesh'),
  gstin: z.string().optional(),
  creditLimit: z.coerce.number().min(0).default(500000),
});

export const siteInspectionSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  referralName: z.string().optional(),
  referenceName: z.string().optional(),
  assignedSupervisorId: z.string().optional(),
  supervisorName: z.string().optional(),
  siteName: z.string().optional(),
  siteAddress: z.string().min(2, 'Site address is required'),
  address: z.string().optional(),
  landmark: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  locationType: z.enum(['ON_SITE', 'NOT_ON_SITE']).optional(),
  locationAccuracyMeters: z.coerce.number().optional(),
  houseNumber: z.string().optional(),
  street: z.string().optional(),
  locality: z.string().optional(),
  pincode: z.string().optional(),
  isLocationConfirmed: z.boolean().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  phone: z.string().optional(),
  hasClientGst: z.boolean().optional(),
  clientGstNumber: z.string().optional(),
  gstin: z.string().optional(),
  // Measurements / Size
  width: z.coerce.number().min(0).default(0),
  depth: z.coerce.number().min(0).default(3),
  height: z.coerce.number().min(0).default(0),
  length: z.coerce.number().min(0).default(0),
  unit: z.enum(['METERS', 'FEET']).default('FEET'),
  measurementType: z.enum([
    'FAÇADE_SCAFFOLD',
    'TOWER_SCAFFOLD',
    'CUP_LOCK_SYSTEM',
    'HEAVY_DUTY_SHORING',
    'SUSPENDED_CRADLE'
  ]).default('FAÇADE_SCAFFOLD'),
  size: z.string().optional(),
  siteRemarks: z.string().optional(),
  remark: z.string().optional(),
  photoUrls: z.array(z.string()).default([]),
});

export const projectConfirmationSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  quotationNumber: z.string().min(1, 'Quotation number is required'),
  quotationDate: z.string().min(1, 'Quotation date is required'),
  agreedProjectPrice: z.coerce.number().min(0, 'Total price must be non-negative'),
  pricingModel: z.enum(['MONTHLY_RENTAL', 'LUMP_SUM', 'METRIC_RATE']).default('MONTHLY_RENTAL'),
  monthlyRentalRate: z.coerce.number().min(0, 'Monthly rental amount must be non-negative'),
  plannedInstallationDate: z.string().min(1, 'Planned installation date is required'),
  durationMonths: z.coerce.number().min(1).default(1),
  depositAmount: z.coerce.number().min(0).default(0),
  transportCharges: z.coerce.number().min(0).default(0),
  installationLabourCharges: z.coerce.number().min(0).default(0),
  paymentTerms: z.string().optional(),
  remarks: z.string().optional(),
  materials: z.array(
    z.object({
      materialId: z.string().min(1),
      requiredQuantity: z.coerce.number().int().positive('Quantity must be greater than 0'),
      monthlyRentalRate: z.coerce.number().min(0).default(0),
    })
  ).min(1, 'At least one material must be reserved for the project'),
  scaffoldingPlan: z.any().optional(),
  siteDimensions: z.any().optional(),
  termsSnapshot: z.any().optional(),
  ratePerSqFt: z.coerce.number().optional(),
  totalAreaSqFt: z.coerce.number().optional(),
  extraJaliQuantity: z.coerce.number().optional(),
  extraJaliCharges: z.coerce.number().optional(),
  twoWayTransportCharges: z.coerce.number().optional(),
  advancePercentage: z.coerce.number().optional(),
  advanceRequiredAmount: z.coerce.number().optional(),
  completionDueAmount: z.coerce.number().optional(),
  clientAccepted: z.boolean().optional(),
  clientAcceptanceVerified: z.boolean().optional(),
});

export const installationSubmissionSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  actualInstallationDate: z.string().min(1, 'Actual installation date and time is required'),
  supervisorId: z.string().min(1, 'Supervisor is required'),
  executingSupervisorName: z.string().optional(),
  isSameSupervisor: z.boolean().default(true).optional(),
  supervisorDelegationRemarks: z.string().optional(),
  teamMembers: z.string().optional(),
  workersList: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1, 'Worker name is required'),
      role: z.string().default('Scaffolder'),
    })
  ).default([]).optional(),
  actualMeasurements: z.object({
    length: z.coerce.number().min(0),
    width: z.coerce.number().min(0),
    height: z.coerce.number().min(0),
    unit: z.enum(['METERS', 'FEET']).default('METERS'),
    isCorrect: z.boolean().default(true),
    variancePercentage: z.coerce.number().optional(),
    remarks: z.string().optional(),
  }).optional(),
  safetyChecklistCompleted: z.boolean().default(true).optional(),
  clientRepresentativeName: z.string().optional(),
  clientSignOff: z.boolean().default(true),
  remarks: z.string().optional(),
  afterPhotoUrls: z.array(z.string()).default([]),
  materialsUsed: z.array(
    z.object({
      materialId: z.string().min(1),
      installedQuantity: z.coerce.number().int().min(0),
      unusedReturnedQty: z.coerce.number().int().min(0).default(0),
    })
  ).min(1, 'Material installation records are required'),
});

export const bufferRequestSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  requestedBufferDays: z.coerce.number().int().min(1, 'Buffer days must be at least 1').max(3650).optional(),
  reason: z.string().trim().min(2).default('Configured rental buffer period activated'),
  additionalCharges: z.coerce.number().min(0).default(0),
});

export const extensionRequestSchema = z
  .object({
    projectId: z.string().min(1, 'Project ID is required'),
    extensionType: z.enum(['DAYS', 'MONTHS']).optional(),
    extensionValue: z.coerce.number().int().min(1, 'Extension duration must be at least 1').max(3650).optional(),
    durationMonths: z.coerce.number().int().min(1).optional(),
    extensionReason: z.string().trim().max(500).optional().default('Rental extension approved'),
    monthlyRentalRate: z.coerce.number().min(0).optional(),
    additionalCharges: z.coerce.number().min(0).default(0),
  })
  .refine(
    (val) =>
      (val.extensionValue !== undefined && val.extensionValue >= 1) ||
      (val.durationMonths !== undefined && val.durationMonths >= 1),
    { message: 'Extension duration must be a positive number' }
  );

export const shiftingRequestSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  shiftingType: z.enum(['TYPE_A_UNCHANGED', 'TYPE_B_QUANTITY_CHANGE']),
  destinationSiteId: z.string().optional(),
  destinationAreaDescription: z.string().min(2, 'Destination area description is required'),
  plannedShiftingDate: z.string().min(1, 'Shifting date is required'),
  labourCharges: z.coerce.number().min(0).default(0),
  transportCharges: z.coerce.number().min(0).default(0),
  teamMembers: z.string().optional(),
  remarks: z.string().optional(),
  materialModifications: z.array(
    z.object({
      materialId: z.string().min(1),
      newRequiredQuantity: z.coerce.number().int().min(0),
    })
  ).optional(),
});

export const removalDismantlingSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  actualDismantlingDate: z.string().min(1, 'Dismantling date is required'),
  warehouseId: z.string().min(1, 'Receiving warehouse is required'),
  supervisorId: z.string().min(1, 'Supervisor is required'),
  teamMembers: z.string().optional(),
  transportDetails: z.string().optional(),
  reconciliationNotes: z.string().optional(),
  afterPhotoUrls: z.array(z.string()).default([]),
  materialReturns: z.array(
    z.object({
      materialId: z.string().min(1),
      expectedSiteQty: z.coerce.number().int().min(0),
      collectedQty: z.coerce.number().int().min(0),
      usableReturnedQty: z.coerce.number().int().min(0),
      damagedQty: z.coerce.number().int().min(0).default(0),
      missingQty: z.coerce.number().int().min(0).default(0),
      remarks: z.string().optional(),
    })
  ).min(1, 'Return records are required for all allocated materials'),
});

export const invoiceGenerationSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  projectId: z.string().optional(),
  invoiceType: z.enum(['RENTAL_CHARGE', 'TRANSPORT', 'LABOUR', 'SHIFTING', 'DAMAGE_PENALTY']).default('RENTAL_CHARGE'),
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  notes: z.string().optional(),
  lines: z.array(
    z.object({
      description: z.string().min(1, 'Line description is required'),
      hsnSacCode: z.string().default('997312'),
      quantity: z.coerce.number().int().positive().default(1),
      rate: z.coerce.number().min(0),
    })
  ).min(1, 'At least one invoice line item is required'),
});

export const paymentRecordSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice is required'),
  customerId: z.string().min(1, 'Customer is required'),
  projectId: z.string().optional(),
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  paymentDate: z.string().min(1, 'Payment date is required'),
  paymentMethod: z.enum(['NEFT', 'RTGS', 'CHEQUE', 'UPI', 'CASH']),
  transactionReference: z.string().min(1, 'Transaction reference/UTR number is required'),
  bankName: z.string().optional(),
  remarks: z.string().optional(),
});

export const addProjectSchema = z.object({
  mode: z.literal('DIRECT_PROJECT').optional(),
  customerId: z.string().optional(),
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().optional(),
  customerEmail: z.string().optional(),
  siteId: z.string().optional(),
  siteName: z.string().min(1, 'Site name is required'),
  siteAddress: z.string().min(1, 'Complete site address is required'),
  assignedSupervisorId: z.string().min(1, 'Supervisor assignment is required'),
  supervisorName: z.string().optional(),
  staffIds: z.array(z.string()).default([]),
  staffNames: z.array(z.string()).default([]),
  status: z.enum([
    'SITE_CREATED',
    'NOT_INSTALLED',
    'QUOTATION_DRAFT',
    'QUOTATION_SENT',
    'QUOTATION_ACCEPTED',
    'QUOTATION_REJECTED',
    'CONFIRMED_PROJECT',
    'SCHEDULED',
    'INSTALLED',
    'ACTIVE_RENTAL',
    'BUFFER_PERIOD',
    'EXTENSION_REQUESTED',
    'EXTENDED',
    'SHIFTING_PENDING',
    'SHIFTING_IN_PROGRESS',
    'REMOVAL_PENDING',
    'RETURNED_RECONCILIATION',
    'CLOSED',
    'CANCELLED',
  ]).default('NOT_INSTALLED'),
  width: z.coerce.number().min(0).default(0),
  depth: z.coerce.number().min(0).default(0),
  height: z.coerce.number().min(0).default(0),
  unit: z.enum(['FEET', 'METERS']).default('FEET'),
  installationDate: z.string().optional(),
  removalDate: z.string().optional(),
  rentalDurationMonths: z.coerce.number().int().min(0).optional(),
  rentalDurationDays: z.coerce.number().int().min(0).optional(),
  rentalDurationDisplay: z.string().optional(),
  totalAmount: z.coerce.number().min(0, 'Total amount cannot be negative').default(0),
  paymentReceived: z.coerce.number().min(0, 'Payment received cannot be negative').default(0),
  balanceAmount: z.coerce.number().min(0).optional(),
  remark: z.string().optional(),
  followUpDate: z.string().optional(),
  followUpNotes: z.string().optional(),
}).refine((data) => data.paymentReceived <= data.totalAmount, {
  message: 'Payment Received cannot exceed Total Amount',
  path: ['paymentReceived'],
}).refine(
  (data) => !(data.installationDate && data.removalDate && data.removalDate < data.installationDate),
  {
    message: 'Date of Removal cannot be earlier than Date of Installation',
    path: ['removalDate'],
  }
);

export const challanMaterialEntrySchema = z.object({
  id: z.string().optional(),
  date: z.string().min(1, 'Entry date is required'),
  materialId: z.string().min(1, 'Material is required'),
  materialName: z.string().optional(),
  itemCode: z.string().optional(),
  unit: z.string().optional(),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  remarks: z.string().optional(),
});

export const challanLostEntrySchema = z.object({
  id: z.string().optional(),
  date: z.string().min(1, 'Loss date is required'),
  materialId: z.string().min(1, 'Material is required'),
  materialName: z.string().optional(),
  itemCode: z.string().optional(),
  unit: z.string().optional(),
  quantity: z.coerce.number().int().min(1, 'Lost quantity must be at least 1'),
  reason: z.string().optional(),
});

export const challanUpsertSchema = z.object({
  customerId: z.string().min(1, 'Customer selection is required'),
  siteId: z.string().optional(),
  siteName: z.string().optional(),
  projectId: z.string().optional(),
  size: z.string().trim().min(1, 'Scaffolding size/dimensions is required'),
  issueDate: z.string().optional(),
  outputEntries: z.array(challanMaterialEntrySchema).min(1, 'At least one output material entry is required'),
  inputEntries: z.array(challanMaterialEntrySchema).default([]),
  lostEntries: z.array(challanLostEntrySchema).default([]),
  status: z.enum(['UNCLOSED', 'CLOSED']).optional(),
  lossApproved: z.boolean().optional(),
  notes: z.string().optional(),
  clientRequestId: z.string().optional(),
});

export const challanAddReturnSchema = z.object({
  entries: z.array(challanMaterialEntrySchema).min(1, 'At least one return entry is required'),
});

export const challanRecordLossSchema = z.object({
  entries: z.array(challanLostEntrySchema).min(1, 'At least one lost material entry is required'),
  approveLoss: z.boolean().optional(),
});
