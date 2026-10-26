// ALOKHANDWALA - Zod Schemas for Form & API Validation

import { z } from 'zod';

export const customerSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  referenceName: z.string().optional(),
  contactPerson: z.string().min(2, 'Contact person name is required'),
  phone: z.string().min(10, 'Valid 10-digit phone number is required'),
  email: z.string().email('Valid email address is required'),
  billingAddress: z.string().min(5, 'Billing address is required'),
  city: z.string().default('Mumbai'),
  state: z.string().default('Maharashtra'),
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
  city: z.string().default('Mumbai'),
  state: z.string().default('Maharashtra'),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  phone: z.string().optional(),
  // Measurements / Size
  length: z.coerce.number().min(0).default(10),
  width: z.coerce.number().min(0).default(5),
  height: z.coerce.number().min(0).default(15),
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
  requestedBufferDays: z.coerce.number().int().min(1).max(7).default(3),
  reason: z.string().min(3, 'Reason for buffer period is required'),
  additionalCharges: z.coerce.number().min(0).default(0),
});

export const extensionRequestSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  durationMonths: z.coerce.number().int().min(1).default(1),
  extensionReason: z.string().min(3, 'Reason for rental extension is required'),
  monthlyRentalRate: z.coerce.number().min(0),
  additionalCharges: z.coerce.number().min(0).default(0),
});

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
