// ALOKHANDWALA - Concurrency-Safe Transactional Inventory Engine

import { dbStore } from '../db/store';
import { 
  Material, 
  InventoryTransaction, 
  Project, 
  ProjectMaterialRequirement,
  RemovalRequest
} from '../schema';
import { ProjectService } from './project-service';
import { OFFICIAL_TERMS_AND_CONDITIONS, DEFAULT_PAYMENT_TERMS_TEXT } from '../constants/terms-and-conditions';
import { verifyProjectChallanReconciliation } from '../formatters';

export class InventoryService {
  /**
   * Generate next sequential transaction number (e.g. TXN-2026-000004)
   */
  private static generateTransactionNumber(existingTxns: InventoryTransaction[]): string {
    const year = new Date().getFullYear();
    const count = existingTxns.length + 1;
    return `TXN-${year}-${count.toString().padStart(6, '0')}`;
  }

  /**
   * Transactional Reservation for Project Confirmation
   * Verifies stock availability and reserves atomically.
   */
  public static async reserveMaterialsForProject(data: {
    projectId: string;
    quotationNumber: string;
    quotationDate: string;
    agreedProjectPrice: number;
    monthlyRentalRate: number;
    plannedInstallationDate: string;
    durationMonths?: number;
    depositAmount?: number;
    transportCharges?: number;
    installationLabourCharges?: number;
    paymentTerms?: string;
    remarks?: string;
    materials: { materialId: string; requiredQuantity: number; monthlyRentalRate?: number }[];
    scaffoldingPlan?: any;
    siteDimensions?: any;
    termsSnapshot?: any;
    ratePerSqFt?: number;
    totalAreaSqFt?: number;
    extraJaliQuantity?: number;
    extraJaliCharges?: number;
    twoWayTransportCharges?: number;
    advancePercentage?: number;
    advanceRequiredAmount?: number;
    completionDueAmount?: number;
    clientAccepted?: boolean;
    clientAcceptanceVerified?: boolean;
    actorId: string;
    actorName: string;
  }): Promise<{ project: Project; transaction: InventoryTransaction }> {
    return await dbStore.transaction(async (state) => {
      const project = state.projects.find(p => p.id === data.projectId);
      if (!project) throw new Error('Project not found');

      // Prevent duplicate reservations
      if (project.status === 'CONFIRMED_PROJECT' || project.status === 'SCHEDULED' || project.status === 'INSTALLED' || project.status === 'ACTIVE_RENTAL') {
        throw new Error(`Project is already confirmed or active (${project.status}). Duplicate reservation is prevented.`);
      }

      // Prevent confirmation if quotation was rejected
      if (project.status === 'QUOTATION_REJECTED') {
        throw new Error('Cannot confirm project with a rejected quotation. Quotation must be revised and accepted first.');
      }

      // Enforce quotation acceptance: only Quotation Accepted can proceed to Confirmation & Plan
      if ((project.status === 'QUOTATION_DRAFT' || project.status === 'QUOTATION_SENT') && !data.clientAccepted && !data.clientAcceptanceVerified) {
        throw new Error('Client quotation acceptance is required before final project confirmation. Only quotations with status "Quotation Accepted" can proceed to Project Confirmation & Plan.');
      }

      // If client acceptance was verified on confirmation, promote to QUOTATION_ACCEPTED
      if ((project.status === 'QUOTATION_DRAFT' || project.status === 'QUOTATION_SENT') && (data.clientAccepted || data.clientAcceptanceVerified)) {
        const now = new Date().toISOString();
        project.status = 'QUOTATION_ACCEPTED';
        project.quotationStatus = 'ACCEPTED';
        project.approval_status = 'ACCEPTED';
        project.approved_at = now;
        project.approved_by = data.actorId;
        project.approvedByName = data.actorName;
        const linkedQ = state.quotations.find(q => q.id === project.quotationId || q.projectId === project.id);
        if (linkedQ) {
          linkedQ.status = 'ACCEPTED';
          linkedQ.approval_status = 'ACCEPTED';
          linkedQ.approved_at = now;
          linkedQ.approved_by = data.actorId;
          linkedQ.approvedByName = data.actorName;
        }
      }

      if (
        project.status !== 'NOT_INSTALLED' && 
        project.status !== 'SITE_CREATED' && 
        project.status !== 'QUOTATION_ACCEPTED' && 
        project.status !== 'QUOTATION_DRAFT' && 
        project.status !== 'QUOTATION_SENT'
      ) {
        throw new Error(`Cannot confirm project in status ${project.status}. Must be in an eligible quotation or unconfirmed status.`);
      }

      // Check stock availability for all requested items
      const shortages: { materialName: string; required: number; available: number }[] = [];
      const validatedMaterials: { material: Material; requiredQty: number; rate: number }[] = [];

      for (const item of data.materials) {
        const material = state.materials.find(m => m.id === item.materialId);
        if (!material) throw new Error(`Material ${item.materialId} not found`);

        const available = material.usableWarehouseQty - material.reservedQty;
        if (item.requiredQuantity > available) {
          shortages.push({
            materialName: material.name,
            required: item.requiredQuantity,
            available: Math.max(0, available),
          });
        }

        validatedMaterials.push({
          material,
          requiredQty: item.requiredQuantity,
          rate: item.monthlyRentalRate || material.rentalRatePerMonth,
        });
      }

      if (shortages.length > 0) {
        const detail = shortages
          .map(s => `${s.materialName} (Req: ${s.required}, Avail: ${s.available})`)
          .join(', ');
        throw new Error(`Insufficient stock for reservation: ${detail}`);
      }

      // Apply reservations atomically
      const txnNumber = this.generateTransactionNumber(state.transactions);
      const txnLines: InventoryTransaction['lines'] = [];
      const projectMaterialList: ProjectMaterialRequirement[] = [];

      for (const { material, requiredQty, rate } of validatedMaterials) {
        material.reservedQty += requiredQty;
        material.availableToAllocate = material.usableWarehouseQty - material.reservedQty;

        txnLines.push({
          materialId: material.id,
          materialName: material.name,
          itemCode: material.itemCode,
          quantity: requiredQty,
          condition: 'GOOD',
          remarks: `Reserved for ${project.projectCode}`,
        });

        projectMaterialList.push({
          id: `pm-${Date.now()}-${material.id}`,
          projectId: project.id,
          materialId: material.id,
          materialName: material.name,
          itemCode: material.itemCode,
          unit: material.unitOfMeasurement,
          requiredQuantity: requiredQty,
          reservedQuantity: requiredQty,
          issuedQuantity: 0,
          installedQuantity: 0,
          returnedUsableQuantity: 0,
          returnedDamagedQuantity: 0,
          missingQuantity: 0,
          monthlyRentalRate: rate,
        });
      }

      // Update project confirmation details
      project.status = 'CONFIRMED_PROJECT';
      project.quotationNumber = data.quotationNumber;
      project.quotationDate = data.quotationDate;
      project.agreedProjectPrice = data.agreedProjectPrice;
      project.monthlyRentalRate = data.monthlyRentalRate;
      project.plannedInstallationDate = data.plannedInstallationDate;
      project.durationMonths = data.durationMonths || 1;
      project.depositAmount = data.depositAmount || 0;
      project.transportCharges = data.transportCharges || 0;
      project.installationLabourCharges = data.installationLabourCharges || 0;
      project.paymentTerms = data.paymentTerms || DEFAULT_PAYMENT_TERMS_TEXT;
      project.termsSnapshot = data.termsSnapshot || state.companySettings?.termsAndConditions || OFFICIAL_TERMS_AND_CONDITIONS;
      project.ratePerSqFt = data.ratePerSqFt;
      project.totalAreaSqFt = data.totalAreaSqFt;
      project.extraJaliQuantity = data.extraJaliQuantity || 0;
      project.extraJaliCharges = data.extraJaliCharges || 0;
      project.twoWayTransportCharges = data.transportCharges || 0;
      project.advancePercentage = data.advancePercentage || 75;
      project.advanceRequiredAmount = data.advanceRequiredAmount ?? ((data.agreedProjectPrice || 0) * 0.75);
      project.completionDueAmount = data.completionDueAmount ?? ((data.agreedProjectPrice || 0) * 0.25);
      project.materials = projectMaterialList;
      if (data.scaffoldingPlan) project.scaffoldingPlan = data.scaffoldingPlan;
      if (data.siteDimensions) project.siteDimensions = data.siteDimensions;
      project.updatedAt = new Date().toISOString();

      // Automatically sync and accept linked quotation record if pending
      const linkedQuotation = state.quotations.find(q => q.projectId === project.id || (project.quotationId && q.id === project.quotationId));
      if (linkedQuotation && (linkedQuotation.status === 'DRAFT' || linkedQuotation.status === 'SENT')) {
        linkedQuotation.status = 'ACCEPTED';
        linkedQuotation.acceptedAt = new Date().toISOString();
      }
      project.quotationStatus = 'ACCEPTED';

      // Record immutable inventory transaction
      const transaction: InventoryTransaction = {
        id: `txn-${Date.now()}`,
        transactionNumber: txnNumber,
        movementType: 'RESERVATION',
        sourceLocation: 'Indore Central Scaffolding Yard',
        destinationLocation: project.siteName,
        projectId: project.id,
        projectCode: project.projectCode,
        referenceDocument: data.quotationNumber,
        actorId: data.actorId,
        actorName: data.actorName,
        remarks: data.remarks || `Material reservation for quotation ${data.quotationNumber}`,
        lines: txnLines,
        createdAt: new Date().toISOString(),
      };
      state.transactions.unshift(transaction);

      // Record Activity Event
      state.activityEvents.unshift({
        id: `act-${Date.now()}`,
        projectId: project.id,
        eventType: 'PROJECT_CONFIRMED',
        eventTitle: 'Project Confirmed & Materials Reserved',
        eventDescription: `Reserved ${projectMaterialList.length} items (${txnLines.reduce((sum, l) => sum + l.quantity, 0)} total pieces) under Quotation ${data.quotationNumber}.`,
        actorId: data.actorId,
        actorName: data.actorName,
        metadata: { quotationNumber: data.quotationNumber, materialsCount: projectMaterialList.length },
        createdAt: new Date().toISOString(),
      });

      return { project, transaction };
    });
  }

  /**
   * Release Project Reservation
   * Restores reserved quantities back to available warehouse pool.
   * Reverts project status back to NOT_INSTALLED with complete audit trail.
   */
  public static async releaseProjectReservation(data: {
    projectId: string;
    actorId: string;
    actorName: string;
    reason?: string;
  }): Promise<{ project: Project; transaction: InventoryTransaction }> {
    return await dbStore.transaction(async (state) => {
      const project = state.projects.find(p => p.id === data.projectId);
      if (!project) throw new Error('Project not found');

      if (!project.materials || project.materials.length === 0) {
        throw new Error('Project has no reserved materials to release');
      }

      const txnLines: InventoryTransaction['lines'] = [];

      for (const projMat of project.materials) {
        const reserved = projMat.reservedQuantity || 0;
        if (reserved <= 0) continue;

        const material = state.materials.find(m => m.id === projMat.materialId);
        if (material) {
          material.reservedQty = Math.max(0, material.reservedQty - reserved);
          material.availableToAllocate = material.usableWarehouseQty - material.reservedQty;
        }

        txnLines.push({
          materialId: projMat.materialId,
          materialName: projMat.materialName,
          itemCode: projMat.itemCode,
          quantity: reserved,
          condition: 'GOOD',
          remarks: `Released from ${project.projectCode}`,
        });

        projMat.reservedQuantity = 0;
      }

      project.status = 'NOT_INSTALLED';
      project.updatedAt = new Date().toISOString();

      const txnNumber = this.generateTransactionNumber(state.transactions);
      const transaction: InventoryTransaction = {
        id: `txn-${Date.now()}`,
        transactionNumber: txnNumber,
        movementType: 'RESERVATION_RELEASE',
        sourceLocation: project.siteName,
        destinationLocation: 'Indore Central Scaffolding Yard',
        projectId: project.id,
        projectCode: project.projectCode,
        referenceDocument: project.quotationNumber || 'RELEASE',
        actorId: data.actorId,
        actorName: data.actorName,
        remarks: data.reason || `Reservation released for project ${project.projectCode}`,
        lines: txnLines,
        createdAt: new Date().toISOString(),
      };
      state.transactions.unshift(transaction);

      state.activityEvents.unshift({
        id: `act-${Date.now()}`,
        projectId: project.id,
        eventType: 'RESERVATION_RELEASED',
        eventTitle: 'Material Reservation Released',
        eventDescription: `Released ${txnLines.reduce((sum, l) => sum + l.quantity, 0)} reserved pieces back to warehouse stock.`,
        actorId: data.actorId,
        actorName: data.actorName,
        metadata: { reason: data.reason },
        createdAt: new Date().toISOString(),
      });

      return { project, transaction };
    });
  }

  /**
   * Revise Project Reservation
   * Adjusts reserved quantities atomically with delta availability verification and audit trail.
   */
  public static async reviseProjectReservation(data: {
    projectId: string;
    materials: { materialId: string; requiredQuantity: number; monthlyRentalRate?: number }[];
    actorId: string;
    actorName: string;
    reason?: string;
  }): Promise<{ project: Project; transaction: InventoryTransaction }> {
    return await dbStore.transaction(async (state) => {
      const project = state.projects.find(p => p.id === data.projectId);
      if (!project) throw new Error('Project not found');

      if (!project.materials) project.materials = [];

      const txnLines: InventoryTransaction['lines'] = [];

      for (const item of data.materials) {
        const material = state.materials.find(m => m.id === item.materialId);
        if (!material) throw new Error(`Material ${item.materialId} not found`);

        let projMat = project.materials.find(m => m.materialId === item.materialId);
        const oldReserved = projMat ? projMat.reservedQuantity : 0;
        const delta = item.requiredQuantity - oldReserved;

        if (delta > 0) {
          const available = material.usableWarehouseQty - material.reservedQty;
          if (delta > available) {
            throw new Error(`Insufficient stock to increase reservation for ${material.name}. Additional required: ${delta}, Available: ${available}`);
          }
        }

        material.reservedQty += delta;
        material.availableToAllocate = material.usableWarehouseQty - material.reservedQty;

        if (projMat) {
          projMat.requiredQuantity = item.requiredQuantity;
          projMat.reservedQuantity = item.requiredQuantity;
          if (item.monthlyRentalRate) projMat.monthlyRentalRate = item.monthlyRentalRate;
        } else {
          project.materials.push({
            id: `pm-${Date.now()}-${material.id}`,
            projectId: project.id,
            materialId: material.id,
            materialName: material.name,
            itemCode: material.itemCode,
            unit: material.unitOfMeasurement,
            requiredQuantity: item.requiredQuantity,
            reservedQuantity: item.requiredQuantity,
            issuedQuantity: 0,
            installedQuantity: 0,
            returnedUsableQuantity: 0,
            returnedDamagedQuantity: 0,
            missingQuantity: 0,
            monthlyRentalRate: item.monthlyRentalRate || material.rentalRatePerMonth,
          });
        }

        txnLines.push({
          materialId: material.id,
          materialName: material.name,
          itemCode: material.itemCode,
          quantity: item.requiredQuantity,
          condition: 'GOOD',
          remarks: `Revised reservation (delta: ${delta >= 0 ? '+' : ''}${delta})`,
        });
      }

      project.updatedAt = new Date().toISOString();

      const txnNumber = this.generateTransactionNumber(state.transactions);
      const transaction: InventoryTransaction = {
        id: `txn-${Date.now()}`,
        transactionNumber: txnNumber,
        movementType: 'RESERVATION',
        sourceLocation: 'Indore Central Scaffolding Yard',
        destinationLocation: project.siteName,
        projectId: project.id,
        projectCode: project.projectCode,
        referenceDocument: project.quotationNumber || 'REVISION',
        actorId: data.actorId,
        actorName: data.actorName,
        remarks: data.reason || `Reservation revised for ${project.projectCode}`,
        lines: txnLines,
        createdAt: new Date().toISOString(),
      };
      state.transactions.unshift(transaction);

      state.activityEvents.unshift({
        id: `act-${Date.now()}`,
        projectId: project.id,
        eventType: 'RESERVATION_REVISED',
        eventTitle: 'Material Reservation Revised',
        eventDescription: `Revised reservation for ${project.materials.length} material lines. Reason: ${data.reason || 'Admin modification'}.`,
        actorId: data.actorId,
        actorName: data.actorName,
        metadata: { reason: data.reason },
        createdAt: new Date().toISOString(),
      });

      return { project, transaction };
    });
  }

  /**
   * Installation & Material Dispatch
   * Reduces physical warehouse stock, clears reservation, increases site allocation,
   * activates rental and calculates initial rental end date (1 calendar month).
   * Idempotent: will not double-issue if already installed.
   */
  public static async submitInstallation(data: {
    projectId: string;
    actualInstallationDate: string;
    supervisorId: string;
    executingSupervisorName?: string;
    isSameSupervisor?: boolean;
    supervisorDelegationRemarks?: string;
    teamMembers?: string;
    workersList?: { id?: string; name: string; role: string }[];
    actualMeasurements?: {
      length: number;
      width: number;
      height: number;
      unit?: 'METERS' | 'FEET';
      isCorrect?: boolean;
      variancePercentage?: number;
      remarks?: string;
    };
    clientRepresentativeName?: string;
    clientSignOff?: boolean;
    remarks?: string;
    afterPhotoUrls?: string[];
    materialsUsed: { materialId: string; installedQuantity: number; unusedReturnedQty?: number }[];
    actorId: string;
    actorName: string;
  }): Promise<{ project: Project; transaction: InventoryTransaction }> {
    return await dbStore.transaction(async (state) => {
      const project = state.projects.find(p => p.id === data.projectId);
      if (!project) throw new Error('Project not found');

      if (project.status === 'INSTALLED' || project.status === 'ACTIVE_RENTAL') {
        throw new Error('Project is already installed and rental is active. Operation is idempotent.');
      }

      if (project.status !== 'CONFIRMED_PROJECT' && project.status !== 'SCHEDULED') {
        throw new Error(`Cannot install project in status ${project.status}`);
      }

      const txnNumber = this.generateTransactionNumber(state.transactions);
      const txnLines: InventoryTransaction['lines'] = [];

      for (const used of data.materialsUsed) {
        const material = state.materials.find(m => m.id === used.materialId);
        if (!material) continue;

        const projMat = project.materials?.find(m => m.materialId === used.materialId);
        const reserved = projMat ? projMat.reservedQuantity : 0;
        const installedQty = used.installedQuantity;
        const unusedQty = used.unusedReturnedQty || 0;

        // Release reservation
        material.reservedQty = Math.max(0, material.reservedQty - reserved);
        
        // Deduct physical warehouse stock for installed
        material.usableWarehouseQty = Math.max(0, material.usableWarehouseQty - installedQty);
        
        // Increase site allocation
        material.siteAllocatedQty += installedQty;
        material.availableToAllocate = material.usableWarehouseQty - material.reservedQty;

        if (projMat) {
          projMat.reservedQuantity = 0;
          projMat.issuedQuantity = installedQty + unusedQty;
          projMat.installedQuantity = installedQty;
        }

        txnLines.push({
          materialId: material.id,
          materialName: material.name,
          itemCode: material.itemCode,
          quantity: installedQty,
          condition: 'GOOD',
          remarks: `Issued and installed at ${project.siteName}`,
        });
      }

      // Calculate 1 calendar-month rental duration
      const installDate = new Date(data.actualInstallationDate);
      const startDateStr = installDate.toISOString().split('T')[0];
      
      const endDate = new Date(installDate);
      endDate.setMonth(endDate.getMonth() + 1);
      const endDateStr = endDate.toISOString().split('T')[0];

      project.status = 'ACTIVE_RENTAL';
      project.actualInstallationDate = data.actualInstallationDate;
      project.rentalStartDate = startDateStr;
      project.rentalEndDate = endDateStr;
      project.originalRentalEndDate = endDateStr;
      project.updatedAt = new Date().toISOString();

      // Record actual site measurements if verified during installation
      if (data.actualMeasurements) {
        project.actualMeasurements = {
          length: data.actualMeasurements.length,
          width: data.actualMeasurements.width,
          height: data.actualMeasurements.height,
          unit: data.actualMeasurements.unit || 'METERS',
          isCorrect: data.actualMeasurements.isCorrect !== false,
          variancePercentage: data.actualMeasurements.variancePercentage,
          remarks: data.actualMeasurements.remarks,
          verifiedBy: data.actorName,
          verifiedAt: new Date().toISOString(),
        };
      }

      project.clientRepresentativeName = data.clientRepresentativeName;
      project.clientSignOff = data.clientSignOff ?? true;

      // Record supervisor verification & match status
      const isSame = data.isSameSupervisor ?? (data.supervisorId === project.assignedSupervisorId);
      project.installationSupervisor = {
        assignedSupervisorId: project.assignedSupervisorId,
        assignedSupervisorName: project.supervisorName,
        executingSupervisorId: data.supervisorId,
        executingSupervisorName: data.executingSupervisorName || data.actorName,
        isSameSupervisor: isSame,
        delegationRemarks: data.supervisorDelegationRemarks,
      };

      // Record erection workers
      if (data.workersList && data.workersList.length > 0) {
        project.installationWorkers = data.workersList.map((w, idx) => ({
          id: w.id || `wrk-${Date.now()}-${idx}`,
          name: w.name,
          role: w.role,
        }));
      }

      // Attach after photos
      if (data.afterPhotoUrls && data.afterPhotoUrls.length > 0) {
        const afterPhotos = data.afterPhotoUrls.map((url, idx) => ({
          id: `pht-inst-${Date.now()}-${idx}`,
          entityType: 'INSTALLATION' as const,
          entityId: project.id,
          fileName: `installation_completion_${idx + 1}.jpg`,
          fileUrl: url,
          fileSizeBytes: 2500000,
          mimeType: 'image/jpeg',
          stageLabel: 'AFTER_INSTALLATION' as const,
          uploadedBy: data.actorId,
          uploaderName: data.actorName,
          createdAt: new Date().toISOString(),
        }));
        project.photos = [...(project.photos || []), ...afterPhotos];
      }

      // Record transaction
      const transaction: InventoryTransaction = {
        id: `txn-${Date.now()}`,
        transactionNumber: txnNumber,
        movementType: 'MATERIAL_ISSUE_DISPATCH',
        sourceLocation: 'Indore Central Scaffolding Yard',
        destinationLocation: project.siteName,
        projectId: project.id,
        projectCode: project.projectCode,
        referenceDocument: `INSTALL-${project.projectCode}`,
        actorId: data.actorId,
        actorName: data.actorName,
        remarks: data.remarks || 'Material issued and successfully installed at site',
        lines: txnLines,
        createdAt: new Date().toISOString(),
      };
      state.transactions.unshift(transaction);

      // Build descriptive audit event
      const sizeDesc = data.actualMeasurements 
        ? `Size: ${data.actualMeasurements.length}m × ${data.actualMeasurements.width}m × ${data.actualMeasurements.height}m (${data.actualMeasurements.isCorrect ? 'Verified correct' : 'Variance reported: ' + (data.actualMeasurements.variancePercentage || 0) + '%'}). ` 
        : '';
      const supDesc = isSame 
        ? `Supervisor: ${project.supervisorName} (Assigned). `
        : `Supervisor: ${data.executingSupervisorName || data.actorName} (Delegated substitute; Assigned: ${project.supervisorName}). `;
      const workersDesc = data.workersList && data.workersList.length > 0
        ? `Crew: ${data.workersList.map(w => `${w.name} [${w.role}]`).join(', ')}.`
        : (data.teamMembers ? `Crew: ${data.teamMembers}.` : '');

      // Activity timeline
      state.activityEvents.unshift({
        id: `act-${Date.now()}`,
        projectId: project.id,
        eventType: 'INSTALLATION_COMPLETED',
        eventTitle: 'Installation Completed & Rental Activated',
        eventDescription: `Scaffolding installed on ${startDateStr}. ${sizeDesc}${supDesc}${workersDesc}`,
        actorId: data.actorId,
        actorName: data.actorName,
        createdAt: new Date().toISOString(),
      });

      return { project, transaction };
    });
  }

  /**
   * Dismantling & Returns Reconciliation
   * Classifies condition: Usable -> increases warehouse stock
   * Damaged -> quarantine
   * Missing -> flagged for recovery
   * Reduces site allocation
   */
  public static async reconcileDismantling(data: {
    projectId: string;
    actualDismantlingDate: string;
    warehouseId?: string;
    supervisorId: string;
    teamMembers?: string;
    transportDetails?: string;
    reconciliationNotes?: string;
    afterPhotoUrls?: string[];
    projectTotalAmount?: number;
    projectPaymentReceived?: number;
    projectBalanceAmount?: number;
    outstandingPaymentNote?: string;
    paymentDateType?: 'EXPECTED' | 'ACTUAL';
    outstandingPaymentDate?: string;
    materialReturns?: {
      materialId: string;
      expectedSiteQty: number;
      collectedQty: number;
      usableReturnedQty: number;
      damagedQty: number;
      missingQty: number;
      remarks?: string;
    }[];
    actorId: string;
    actorName: string;
  }): Promise<{ removalRequest: RemovalRequest; transaction: InventoryTransaction; project: Project }> {
    return await dbStore.transaction(async (state) => {
      const project = state.projects.find(p => p.id === data.projectId);
      if (!project) throw new Error('Project not found');

      // Strict Backend Challan Reconciliation Enforcement
      const challanCheck = verifyProjectChallanReconciliation(project, state.challans || []);
      if (!challanCheck.allowed) {
        const pendingSummary = challanCheck.pendingMaterials
          .map((m) => `${m.materialName}${m.itemCode ? ` (${m.itemCode})` : ''} – ${m.remaining} ${m.unit}`)
          .join(', ');
        throw new Error(
          `Cannot Dismantle Project: ${pendingSummary} still pending at site. Complete material reconciliation in the Challan module before dismantling.`
        );
      }

      const warehouse =
        (data.warehouseId ? state.warehouses.find(w => w.id === data.warehouseId) : undefined) ||
        state.warehouses[0];
      const removalNumber = `RMV-${new Date().getFullYear()}-${(state.removalRequests.length + 1).toString().padStart(6, '0')}`;
      const txnNumber = this.generateTransactionNumber(state.transactions);
      const txnLines: InventoryTransaction['lines'] = [];
      const materialReturns = data.materialReturns || [];

      let hasDiscrepancy = false;

      for (const ret of materialReturns) {
        const material = state.materials.find(m => m.id === ret.materialId);
        if (!material) continue;

        const usable = ret.usableReturnedQty;
        const damaged = ret.damagedQty;
        const missing = ret.missingQty;
        const collected = ret.collectedQty;

        // Reduce site allocated quantity
        material.siteAllocatedQty = Math.max(0, material.siteAllocatedQty - ret.expectedSiteQty);

        // Usable returns increase usable warehouse stock
        material.usableWarehouseQty += usable;
        material.availableToAllocate = material.usableWarehouseQty - material.reservedQty;

        // Damaged items go to quarantine
        material.damagedQty += damaged;

        // Missing items flagged in missing ledger
        material.missingQty += missing;

        if (damaged > 0 || missing > 0) {
          hasDiscrepancy = true;
        }

        const projMat = project.materials?.find(m => m.materialId === ret.materialId);
        if (projMat) {
          projMat.returnedUsableQuantity = usable;
          projMat.returnedDamagedQuantity = damaged;
          projMat.missingQuantity = missing;
          projMat.installedQuantity = 0;
        }

        if (usable > 0) {
          txnLines.push({
            materialId: material.id,
            materialName: material.name,
            itemCode: material.itemCode,
            quantity: usable,
            condition: 'GOOD',
            remarks: `Usable return from ${project.projectCode}`,
          });
        }
        if (damaged > 0) {
          txnLines.push({
            materialId: material.id,
            materialName: material.name,
            itemCode: material.itemCode,
            quantity: damaged,
            condition: 'DAMAGED',
            remarks: `Damaged stock quarantine from ${project.projectCode}`,
          });
        }
      }

      // Record transaction
      const transaction: InventoryTransaction = {
        id: `txn-${Date.now()}`,
        transactionNumber: txnNumber,
        movementType: 'WAREHOUSE_RETURN',
        sourceLocation: project.siteName,
        destinationLocation: warehouse.name,
        projectId: project.id,
        projectCode: project.projectCode,
        referenceDocument: removalNumber,
        actorId: data.actorId,
        actorName: data.actorName,
        remarks: data.reconciliationNotes || `Dismantling returns from ${project.projectCode}`,
        lines: txnLines,
        createdAt: new Date().toISOString(),
      };
      state.transactions.unshift(transaction);

      // Create removal record
      const removalRequest: RemovalRequest = {
        id: `rmv-${Date.now()}`,
        removalNumber,
        projectId: project.id,
        projectCode: project.projectCode,
        customerName: project.customerName,
        siteName: project.siteName,
        requestedRemovalDate: data.actualDismantlingDate,
        actualDismantlingDate: data.actualDismantlingDate,
        supervisorId: data.supervisorId,
        supervisorName: data.actorName,
        teamMembers: data.teamMembers,
        transportDetails: data.transportDetails,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        status: 'RECONCILED',
        warehouseReceiptAt: new Date().toISOString(),
        reconciliationNotes: data.reconciliationNotes,
        returnLines: materialReturns.map(r => {
          const mat = state.materials.find(m => m.id === r.materialId);
          return {
            materialId: r.materialId,
            materialName: mat ? mat.name : 'Unknown',
            itemCode: mat ? mat.itemCode : '',
            expectedSiteQty: r.expectedSiteQty,
            collectedQty: r.collectedQty,
            usableReturnedQty: r.usableReturnedQty,
            damagedQty: r.damagedQty,
            missingQty: r.missingQty,
            quantityStillAtSite: 0,
            inspectionResult: (r.damagedQty > 0 || r.missingQty > 0) ? 'DAMAGED_DETECTED' : 'PASSED',
            remarks: r.remarks,
          };
        }),
        createdAt: new Date().toISOString(),
      };
      state.removalRequests.unshift(removalRequest);

      // Update project financial settlement if provided
      const now = new Date().toISOString();
      const prevTotal = Number(project.totalAmount ?? project.agreedProjectPrice ?? project.quotationAmount ?? 0);
      const prevReceived = Number(project.paymentReceived ?? project.advancePaidAmount ?? 0);
      const prevBalance = Number(
        project.balanceAmount ?? Math.round((prevTotal - prevReceived) * 100) / 100
      );

      let nextTotal = prevTotal;
      let nextReceived = prevReceived;
      let nextBalance = prevBalance;

      if (
        data.projectTotalAmount !== undefined ||
        data.projectPaymentReceived !== undefined ||
        data.projectBalanceAmount !== undefined
      ) {
        nextTotal =
          data.projectTotalAmount !== undefined
            ? Math.round(Number(data.projectTotalAmount) * 100) / 100
            : prevTotal;
        nextReceived =
          data.projectPaymentReceived !== undefined
            ? Math.round(Number(data.projectPaymentReceived) * 100) / 100
            : prevReceived;
        nextBalance =
          data.projectBalanceAmount !== undefined
            ? Math.round(Number(data.projectBalanceAmount) * 100) / 100
            : Math.round((nextTotal - nextReceived) * 100) / 100;

        if (isNaN(nextTotal) || nextTotal < 0) {
          throw new Error('Total Agreed Price cannot be negative.');
        }
        if (isNaN(nextReceived) || nextReceived < 0) {
          throw new Error('Total Payment Received cannot be negative.');
        }
        if (isNaN(nextBalance) || nextBalance < 0) {
          throw new Error('Balance Amount cannot be negative.');
        }
        if (Math.abs((nextTotal - nextReceived) - nextBalance) > 0.01) {
          throw new Error('Balance Amount must equal Total Agreed Price − Total Payment Received.');
        }

        project.totalAmount = nextTotal;
        project.agreedProjectPrice = nextTotal;
        project.paymentReceived = nextReceived;
        project.advancePaidAmount = nextReceived;
        project.balanceAmount = nextBalance;
        project.completionDueAmount = nextBalance;

        const customer = state.customers.find(c => c.id === project.customerId);
        if (customer) {
          const balanceDelta = nextBalance - prevBalance;
          customer.outstandingBalance = Math.max(
            0,
            Math.round(((customer.outstandingBalance || 0) + balanceDelta) * 100) / 100
          );
          customer.updatedAt = now;
        }
      }

      // Preserve and append outstanding payment note & expected/actual date history
      const cleanNote = (data.outstandingPaymentNote || '').trim();
      const cleanDate = (data.outstandingPaymentDate || '').trim();
      const paymentDelta = Math.round((nextReceived - prevReceived) * 100) / 100;

      if (cleanNote || cleanDate || paymentDelta > 0) {
        const dateType: 'EXPECTED' | 'ACTUAL' =
          data.paymentDateType === 'ACTUAL' || paymentDelta > 0 ? 'ACTUAL' : 'EXPECTED';
        const effectiveDate = cleanDate || now.split('T')[0];

        if (cleanNote) {
          project.outstandingPaymentNote = cleanNote;
        }
        if (dateType === 'EXPECTED' && cleanDate) {
          project.expectedPaymentDate = cleanDate;
        } else if (dateType === 'ACTUAL') {
          project.actualPaymentDate = effectiveDate;
        }

        if (!project.outstandingPaymentHistory) {
          project.outstandingPaymentHistory = [];
        }
        project.outstandingPaymentHistory.unshift({
          id: `oph-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          note: cleanNote || undefined,
          dateType,
          paymentDate: effectiveDate,
          amountPaid: paymentDelta > 0 ? paymentDelta : undefined,
          totalAgreedPrice: nextTotal,
          totalPaymentReceived: nextReceived,
          balanceAmount: nextBalance,
          recordedAt: now,
          recordedByName: data.actorName,
        });
      }

      // Project status transition: RETURNED_RECONCILIATION -> or CLOSED
      project.actualDismantlingDate = data.actualDismantlingDate;
      project.dismantleStatus = 'COMPLETED';
      project.status = hasDiscrepancy ? 'RETURNED_RECONCILIATION' : 'CLOSED';
      if (!hasDiscrepancy) {
        project.closureDate = now;
      }
      project.updatedAt = now;

      // Timeline event
      state.activityEvents.unshift({
        id: `act-${Date.now()}`,
        projectId: project.id,
        eventType: 'DISMANTLING_RECONCILED',
        eventTitle: 'Materials Dismantled & Reconciled at Warehouse',
        eventDescription: `Dismantled and received at ${warehouse.name}. Status: ${project.status}.${hasDiscrepancy ? ' Discrepancies noted for financial recovery.' : ' Clean closure.'}`,
        actorId: data.actorId,
        actorName: data.actorName,
        createdAt: new Date().toISOString(),
      });

      // Genuine Dismantling & Payment Notifications
      if (!state.notifications) state.notifications = [];
      state.notifications.unshift({
        id: `notif-dism-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        roleTarget: 'ADMIN',
        title: 'Dismantling Completed',
        message: `Dismantling completed for Project ${project.projectCode} – ${project.customerName} on ${data.actualDismantlingDate}. Balance: ₹${nextBalance.toLocaleString('en-IN')}.`,
        type: nextBalance > 0 ? 'WARNING' : 'SUCCESS',
        entityType: 'PROJECT',
        entityId: project.id,
        projectCode: project.projectCode,
        customerName: project.customerName,
        siteAddress: project.siteAddress || project.siteName,
        removalDate: data.actualDismantlingDate,
        supervisorName: data.teamMembers || project.supervisorName,
        isRead: false,
        createdAt: now,
      });

      if (paymentDelta > 0) {
        state.notifications.unshift({
          id: `notif-pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          roleTarget: 'ADMIN',
          title: nextBalance === 0 ? 'Project Fully Paid' : 'Payment Received',
          message:
            nextBalance === 0
              ? `Final payment of ₹${paymentDelta.toLocaleString('en-IN')} received for Project ${project.projectCode} – ${project.customerName}. Balance is now ₹0.`
              : `Payment of ₹${paymentDelta.toLocaleString('en-IN')} received for Project ${project.projectCode} – ${project.customerName}. Remaining balance: ₹${nextBalance.toLocaleString('en-IN')}.`,
          type: 'SUCCESS',
          entityType: 'PROJECT',
          entityId: project.id,
          projectCode: project.projectCode,
          customerName: project.customerName,
          siteAddress: project.siteAddress || project.siteName,
          isRead: false,
          createdAt: now,
        });
      }

      return { removalRequest, transaction, project };
    });
  }
}
