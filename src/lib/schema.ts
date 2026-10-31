// ALOKHANDWALA - TypeScript Data Types & Schema Definitions

export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'WORKER';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  password?: string;
  assignedSupervisorId?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  customerCode: string; // CUST-0001
  companyName: string;
  referenceName?: string;
  contactPerson: string;
  phone: string;
  email: string;
  billingAddress: string;
  city: string;
  state: string;
  gstin?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  creditLimit: number;
  outstandingBalance: number;
  sitesCount: number;
  projectsCount: number;
  activeRentalsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Site {
  id: string;
  siteCode: string; // SITE-0001
  customerId: string;
  customerName?: string;
  siteName: string;
  siteAddress: string;
  landmark?: string;
  city: string;
  state: string;
  contactPerson?: string;
  contactPhone?: string;
  referralName?: string;
  assignedSupervisorId?: string;
  supervisorName?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface SiteMeasurement {
  id: string;
  siteId: string;
  projectId?: string;
  length: number;
  width: number;
  height: number;
  unit: 'METERS' | 'FEET';
  measurementType: 'FAÇADE_SCAFFOLD' | 'TOWER_SCAFFOLD' | 'CUP_LOCK_SYSTEM' | 'HEAVY_DUTY_SHORING' | 'SUSPENDED_CRADLE';
  description?: string;
  measuredBy: string;
  measuredAt: string;
}

export interface FileAttachment {
  id: string;
  entityType: 'SITE_INSPECTION' | 'INSTALLATION' | 'SHIFTING' | 'DISMANTLING' | 'DAMAGED_PROOF' | 'AGREEMENT';
  entityId: string;
  fileName: string;
  fileUrl: string;
  fileSizeBytes: number;
  mimeType: string;
  stageLabel?: 'BEFORE_INSTALLATION' | 'AFTER_INSTALLATION' | 'BEFORE_SHIFTING' | 'AFTER_SHIFTING' | 'DISMANTLED' | 'DAMAGED' | 'SITE_INSPECTION';
  uploadedBy: string;
  uploaderName?: string;
  createdAt: string;
}

export type QuotationStatus = 
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED';

export interface QuotationMaterialItem {
  id?: string;
  materialId?: string;
  itemCode: string;
  materialName: string;
  categoryName?: string;
  unit: string;
  quantity: number;
  monthlyRentalRate?: number;
  totalMonthlyRent?: number;
  remarks?: string;
}

export interface Quotation {
  id: string;
  quotationNumber: string; // e.g. QTN-000001
  projectId: string;
  projectCode: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  siteId: string;
  siteName: string;
  siteAddress: string;
  quotationDate: string;
  status: QuotationStatus;
  
  // Scaffolding Specifications
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: 'METERS' | 'FEET';
    totalAreaSqFt: number;
    structureType?: string;
    description?: string;
  };
  
  // Material Requirements
  materials: QuotationMaterialItem[];
  scaffoldingType?: string;
  
  // Pricing & Commercial Breakdown
  ratePerSqFt: number;
  totalAreaSqFt: number;
  rentalDurationDays: number; // default 28 days
  durationMonths: number; // default 1
  monthlyRentalAmount: number;
  walkwayJaliIncludedQuantity: number;
  extraJaliQuantity: number;
  extraJaliRate: number; // 200
  extraJaliCharges: number;
  transportCharges: number; // delivery and return
  shiftingCharges: number;
  otherCharges: number;
  subtotal: number;
  gstPercentage: number;
  gstAmount: number;
  grandTotal: number;
  advancePercentage: number; // 75
  advanceAmount: number; // 75%
  remainingAmount: number; // 25%
  
  // Terms & Conditions
  termsAndConditions?: string[];
  notes?: string;
  
  // Site Images
  siteImages?: string[];
  
  // Tracking & Audit
  createdBy: string;
  createdByName: string;
  updatedBy?: string;
  updatedByName?: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export type ProjectStatus = 
  | 'SITE_CREATED'
  | 'NOT_INSTALLED'
  | 'QUOTATION_DRAFT'
  | 'QUOTATION_SENT'
  | 'QUOTATION_ACCEPTED'
  | 'QUOTATION_REJECTED'
  | 'CONFIRMED_PROJECT'
  | 'SCHEDULED'
  | 'INSTALLED'
  | 'ACTIVE_RENTAL'
  | 'BUFFER_PERIOD'
  | 'EXTENSION_REQUESTED'
  | 'EXTENDED'
  | 'SHIFTING_PENDING'
  | 'SHIFTING_IN_PROGRESS'
  | 'REMOVAL_PENDING'
  | 'RETURNED_RECONCILIATION'
  | 'CLOSED'
  | 'CANCELLED';

export interface ProjectMaterialRequirement {
  id: string;
  projectId: string;
  materialId: string;
  materialName: string;
  itemCode: string;
  unit: string;
  requiredQuantity: number;
  reservedQuantity: number;
  issuedQuantity: number;
  installedQuantity: number;
  returnedUsableQuantity: number;
  returnedDamagedQuantity: number;
  missingQuantity: number;
  monthlyRentalRate: number;
}

export interface Project {
  id: string;
  projectCode: string; // e.g. AW-SCF-000001
  customerId: string;
  customerName: string;
  siteId: string;
  siteName: string;
  siteAddress: string;
  referralName?: string;
  assignedSupervisorId: string;
  supervisorName: string;
  status: ProjectStatus;
  pricingModel: 'MONTHLY_RENTAL' | 'LUMP_SUM' | 'METRIC_RATE';
  monthlyRentalRate: number;
  agreedProjectPrice: number;
  depositAmount: number;
  transportCharges: number;
  installationLabourCharges: number;
  shiftingCharges: number;
  dismantlingLabourCharges: number;
  gstPercentage: number;
  plannedInstallationDate?: string;
  durationMonths?: number;
  actualInstallationDate?: string;
  rentalStartDate?: string;
  rentalEndDate?: string;
  originalRentalEndDate?: string;
  bufferEndDate?: string;
  actualDismantlingDate?: string;
  closureDate?: string;
  cancellationReason?: string;
  quotationId?: string;
  quotationNumber?: string;
  quotationDate?: string;
  quotationAmount?: number;
  quotationStatus?: QuotationStatus;
  paymentTerms?: string;
  siteRemarks?: string;
  termsSnapshot?: any;
  ratePerSqFt?: number;
  totalAreaSqFt?: number;
  extraJaliQuantity?: number;
  extraJaliCharges?: number;
  twoWayTransportCharges?: number;
  advancePercentage?: number;
  advanceRequiredAmount?: number;
  advancePaidAmount?: number;
  completionDueAmount?: number;
  materials?: ProjectMaterialRequirement[];
  photos?: FileAttachment[];
  measurements?: SiteMeasurement;
  actualMeasurements?: {
    length: number;
    width: number;
    height: number;
    unit: 'METERS' | 'FEET';
    isCorrect: boolean;
    variancePercentage?: number;
    remarks?: string;
    verifiedBy?: string;
    verifiedAt?: string;
  };
  installationSupervisor?: {
    assignedSupervisorId: string;
    assignedSupervisorName: string;
    executingSupervisorId: string;
    executingSupervisorName: string;
    isSameSupervisor: boolean;
    delegationRemarks?: string;
  };
  installationWorkers?: {
    id: string;
    name: string;
    role: string;
  }[];
  assignedWorkerIds?: string[];
  clientRepresentativeName?: string;
  clientSignOff?: boolean;
  scaffoldingPlan?: ScaffoldingMaterialPlanOption;
  siteDimensions?: {
    length: number;
    width: number;
    height: number;
    unit: 'FEET' | 'METERS';
    configurationType: ScaffoldingConfigurationType;
  };
  createdAt: string;
  updatedAt: string;
}

export type ScaffoldingConfigurationType = 
  | 'PERIMETER_FACADE'
  | 'BIRDCAGE_VOLUME'
  | 'INDEPENDENT_TIED'
  | 'MOBILE_ACCESS_TOWER';

export type ScaffoldingFacadeFaces = 
  | '4_SIDES_PERIMETER'
  | '2_LONG_SIDES'
  | '1_SINGLE_WALL'
  | 'L_SHAPE';

export type ScaffoldingDeckLevels = 
  | 'TOP_DECK_ONLY'
  | 'TWO_DECKS'
  | 'ALL_LIFTS';

export interface ScaffoldingPlanItem {
  materialId: string;
  itemCode: string;
  name: string;
  categoryName: string;
  unit: string;
  requiredQty: number;
  warehouseStock: number;
  currentlyReserved: number;
  availableStock: number;
  proposedReserveQty: number;
  remainingStockAfterReservation: number;
  shortageQty: number;
  monthlyRentalRate: number;
  monthlyRentalTotal: number;
  purchaseCost: number;
  status: 'IN_STOCK' | 'PARTIAL_STOCK' | 'OUT_OF_STOCK';
  weightKg: number;
  notes?: string;
}

export interface ScaffoldingMaterialPlanOption {
  planId: 'PLAN_AVAILABLE_STOCK' | 'PLAN_STANDARD' | 'PLAN_ALTERNATIVE_HEAVY' | 'PLAN_CUSTOM' | 'PLAN_STOCK_OPTIMIZED' | 'PLAN_PROCUREMENT_HYBRID' | string;
  planName: string;
  badge: string;
  description: string;
  configurationSummary: {
    configurationType: ScaffoldingConfigurationType;
    dimensions: {
      length: number;
      width: number;
      height: number;
      unit: 'FEET' | 'METERS';
      lengthFt: number;
      widthFt: number;
      heightFt: number;
    };
    bayLengthFt: number;
    transomWidthFt: number;
    liftHeightFt: number;
    totalBays: number;
    totalLifts: number;
    totalVerticalStandardsGrid: number;
    workingDeckLevelsCount: number;
    safetyStandard: string;
    loadRatingClass: string;
  };
  materials: ScaffoldingPlanItem[];
  totals: {
    totalPieces: number;
    totalWeightKg: number;
    totalMonthlyRental: number;
    stockReadinessPercentage: number;
    shortageItemsCount: number;
    totalShortagePieces: number;
    estimatedProcurementCost: number;
  };
  safetyNotes: string[];
  isRecommended?: boolean;
}

export interface MaterialCategory {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface Material {
  id: string;
  itemCode: string; // e.g. SCF-STD-3000
  name: string;
  categoryId: string;
  categoryName?: string;
  description: string;
  unitOfMeasurement: 'NOS' | 'SETS' | 'METERS' | 'KG';
  standardWeightKg: number;
  purchaseCost: number;
  rentalRatePerMonth: number;
  minimumStockThreshold: number;
  isActive: boolean;
  totalOwnedQty: number;
  usableWarehouseQty: number;
  reservedQty: number;
  siteAllocatedQty: number;
  inTransitQty: number;
  damagedQty: number;
  missingQty: number;
  underInspectionQty: number;
  availableToAllocate: number; // calculated: usableWarehouseQty - reservedQty
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  contactPerson: string;
  contactPhone: string;
  isPrimary: boolean;
  isActive: boolean;
}

export type InventoryMovementType = 
  | 'OPENING_STOCK'
  | 'PURCHASE_RECEIPT'
  | 'RESERVATION'
  | 'RESERVATION_RELEASE'
  | 'MATERIAL_ISSUE_DISPATCH'
  | 'SITE_RECEIPT'
  | 'SITE_TO_SITE_TRANSFER'
  | 'WAREHOUSE_RETURN'
  | 'DAMAGED_TRANSFER'
  | 'REPAIR_COMPLETION'
  | 'WRITE_OFF'
  | 'MISSING_STOCK_ADJUSTMENT'
  | 'PHYSICAL_COUNT_CORRECTION';

export interface InventoryTransaction {
  id: string;
  transactionNumber: string; // TXN-2026-000001
  movementType: InventoryMovementType;
  sourceLocation: string;
  destinationLocation: string;
  projectId?: string;
  projectCode?: string;
  referenceDocument?: string;
  actorId: string;
  actorName: string;
  remarks?: string;
  lines: {
    materialId: string;
    materialName: string;
    itemCode: string;
    quantity: number;
    condition: 'GOOD' | 'DAMAGED' | 'SCRAP' | 'MISSING';
    remarks?: string;
  }[];
  createdAt: string;
}

export interface BufferRequest {
  id: string;
  projectId: string;
  projectCode: string;
  currentRentalEndDate: string;
  requestedBufferDays: number;
  proposedRemovalDeadline: string;
  reason: string;
  additionalCharges: number;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approverName?: string;
  approvedAt?: string;
  createdBy: string;
  creatorName: string;
  createdAt: string;
}

export interface RentalExtension {
  id: string;
  extensionNumber: string; // EXT-2026-000001
  projectId: string;
  projectCode: string;
  previousRentalEndDate: string;
  newRentalEndDate: string;
  durationMonths: number;
  extensionReason: string;
  monthlyRentalRate: number;
  additionalCharges: number;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approverName?: string;
  approvedAt?: string;
  createdBy: string;
  creatorName: string;
  createdAt: string;
}

export interface ShiftingRequest {
  id: string;
  shiftingNumber: string; // SHF-2026-000001
  projectId: string;
  projectCode: string;
  shiftingType: 'TYPE_A_UNCHANGED' | 'TYPE_B_QUANTITY_CHANGE';
  currentSiteId: string;
  currentSiteName: string;
  destinationSiteId?: string;
  destinationSiteName?: string;
  destinationAreaDescription: string;
  plannedShiftingDate: string;
  actualCompletionDate?: string;
  supervisorId: string;
  supervisorName: string;
  teamMembers?: string;
  labourCharges: number;
  transportCharges: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  remarks?: string;
  materialLines?: {
    materialId: string;
    materialName: string;
    itemCode: string;
    previousQuantity: number;
    newRequiredQuantity: number;
    quantityDifference: number; // new - previous
    additionalIssuedQty: number;
    surplusReturnedQty: number;
    damagedQty: number;
    missingQty: number;
  }[];
  createdAt: string;
}

export interface RemovalRequest {
  id: string;
  removalNumber: string; // RMV-2026-000001
  projectId: string;
  projectCode: string;
  customerName: string;
  siteName: string;
  requestedRemovalDate: string;
  actualDismantlingDate?: string;
  reason?: string;
  supervisorId: string;
  supervisorName: string;
  teamMembers?: string;
  transportDetails?: string;
  warehouseId: string;
  warehouseName: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'RECONCILED' | 'COMPLETED';
  receivedByWarehouseStaff?: string;
  warehouseReceiptAt?: string;
  reconciliationNotes?: string;
  returnLines: {
    materialId: string;
    materialName: string;
    itemCode: string;
    expectedSiteQty: number;
    collectedQty: number;
    usableReturnedQty: number;
    damagedQty: number;
    missingQty: number;
    quantityStillAtSite: number;
    inspectionResult: 'PASSED' | 'DAMAGED_DETECTED' | 'MISSING_DETECTED' | 'QUARANTINE';
    remarks?: string;
  }[];
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // INV-2026-000001
  customerId: string;
  customerName: string;
  customerGstin?: string;
  customerAddress: string;
  projectId?: string;
  projectCode?: string;
  invoiceType: 'RENTAL_CHARGE' | 'TRANSPORT' | 'LABOUR' | 'SHIFTING' | 'DAMAGE_PENALTY';
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  discountAmount: number;
  taxableValue: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  notes?: string;
  lines: {
    id: string;
    description: string;
    hsnSacCode: string;
    quantity: number;
    rate: number;
    amount: number;
  }[];
  createdAt: string;
}

export interface Payment {
  id: string;
  receiptNumber: string; // RCP-2026-000001
  customerId: string;
  customerName: string;
  projectId?: string;
  projectCode?: string;
  invoiceId: string;
  invoiceNumber: string;
  paymentDate: string;
  amount: number;
  paymentMethod: 'NEFT' | 'RTGS' | 'CHEQUE' | 'UPI' | 'CASH';
  transactionReference: string;
  bankName?: string;
  receivedBy: string;
  receiverName: string;
  remarks?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  supplierCode: string;
  companyName: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
  pan?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  totalAmount: number;
  status: 'ORDERED' | 'PARTIAL_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  lines: {
    materialId: string;
    materialName: string;
    itemCode: string;
    orderedQuantity: number;
    receivedQuantity: number;
    unitCost: number;
    totalCost: number;
  }[];
  createdAt: string;
}

export interface Notification {
  id: string;
  userId?: string;
  roleTarget?: UserRole;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'URGENT' | 'SUCCESS';
  entityType?: 'PROJECT' | 'RENTAL' | 'INVENTORY' | 'INVOICE';
  entityId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  entityTable: string;
  entityId: string;
  oldState?: any;
  newState?: any;
  ipAddress?: string;
  createdAt: string;
}

export interface ProjectActivityEvent {
  id: string;
  projectId: string;
  eventType: string;
  eventTitle: string;
  eventDescription: string;
  actorId: string;
  actorName: string;
  metadata?: any;
  createdAt: string;
}

export interface CompanySettings {
  companyName: string;
  gstin: string;
  pan: string;
  address: string;
  state: string;
  stateCode: string;
  contactPhone: string;
  contactEmail: string;
  defaultGstRate: number;
  bufferDaysDefault: number;
  extensionDurationMonthsDefault: number;
  lowStockThresholdDefault: number;
  rentalCurrency: string;
  termsAndConditions?: any[];
}
