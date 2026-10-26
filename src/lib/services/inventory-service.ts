// ALOKHANDWALA - Concurrency-Safe Transactional Inventory Engine

import { dbStore } from '../db/store';
import { 
  Material, 
  InventoryTransaction, 
  Project, 
  ProjectMaterialRequirement,
  ShiftingRequest,
  RemovalRequest
} from '../schema';
import { ProjectService } from './project-service';

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
    actorId: string;
    actorName: string;
  }): Promise<{ project: Project; transaction: InventoryTransaction }> {
    return await dbStore.transaction(async (state) => {
      const project = state.projects.find(p => p.id === data.projectId);
      if (!project) throw new Error('Project not found');

      if (project.status !== 'NOT_INSTALLED') {
        throw new Error(`Cannot confirm project in status ${project.status}. Must be NOT_INSTALLED.`);
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
      project.paymentTerms = data.paymentTerms;
      project.materials = projectMaterialList;
      if (data.scaffoldingPlan) project.scaffoldingPlan = data.scaffoldingPlan;
      if (data.siteDimensions) project.siteDimensions = data.siteDimensions;
      project.updatedAt = new Date().toISOString();

      // Record immutable inventory transaction
      const transaction: InventoryTransaction = {
        id: `txn-${Date.now()}`,
        transactionNumber: txnNumber,
        movementType: 'RESERVATION',
        sourceLocation: 'Taloja Central Scaffolding Yard',
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
        destinationLocation: 'Taloja Central Scaffolding Yard',
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
        sourceLocation: 'Taloja Central Scaffolding Yard',
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
        sourceLocation: 'Taloja Central Scaffolding Yard',
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
   * Shifting Management (Type A: Unchanged, Type B: Additional / Surplus)
   */
  public static async executeShifting(data: {
    projectId: string;
    shiftingType: 'TYPE_A_UNCHANGED' | 'TYPE_B_QUANTITY_CHANGE';
    destinationSiteId?: string;
    destinationAreaDescription: string;
    plannedShiftingDate: string;
    labourCharges?: number;
    transportCharges?: number;
    teamMembers?: string;
    remarks?: string;
    materialModifications?: { materialId: string; newRequiredQuantity: number }[];
    actorId: string;
    actorName: string;
  }): Promise<{ shiftingRequest: ShiftingRequest; transaction?: InventoryTransaction }> {
    return await dbStore.transaction(async (state) => {
      const project = state.projects.find(p => p.id === data.projectId);
      if (!project) throw new Error('Project not found');

      const shiftingNumber = `SHF-${new Date().getFullYear()}-${(state.shiftingRequests.length + 1).toString().padStart(6, '0')}`;
      const shiftingLines: NonNullable<ShiftingRequest['materialLines']> = [];
      let transaction: InventoryTransaction | undefined = undefined;

      if (data.shiftingType === 'TYPE_A_UNCHANGED') {
        // Quantities remain unchanged - zero warehouse inventory deducted
        project.status = 'ACTIVE_RENTAL';
        project.shiftingCharges = (project.shiftingCharges || 0) + (data.labourCharges || 0) + (data.transportCharges || 0);

        state.activityEvents.unshift({
          id: `act-${Date.now()}`,
          projectId: project.id,
          eventType: 'SHIFTING_COMPLETED',
          eventTitle: 'Shifting Completed (Unchanged Quantities)',
          eventDescription: `Scaffolding relocated to ${data.destinationAreaDescription}. Existing material allocation maintained.`,
          actorId: data.actorId,
          actorName: data.actorName,
          createdAt: new Date().toISOString(),
        });
      } else {
        // TYPE B: Quantity changes
        const txnLines: InventoryTransaction['lines'] = [];

        for (const mod of data.materialModifications || []) {
          const material = state.materials.find(m => m.id === mod.materialId);
          if (!material) continue;

          const projMat = project.materials?.find(m => m.materialId === mod.materialId);
          const previousQty = projMat ? projMat.installedQuantity : 0;
          const newQty = mod.newRequiredQuantity;
          const delta = newQty - previousQty;

          if (delta > 0) {
            // Additional stock needed: check available
            const available = material.usableWarehouseQty - material.reservedQty;
            if (delta > available) {
              throw new Error(`Insufficient stock to shift additional ${delta}x ${material.name} (Available: ${available})`);
            }
            // Issue additional
            material.usableWarehouseQty -= delta;
            material.siteAllocatedQty += delta;
            material.availableToAllocate = material.usableWarehouseQty - material.reservedQty;

            txnLines.push({
              materialId: material.id,
              materialName: material.name,
              itemCode: material.itemCode,
              quantity: delta,
              condition: 'GOOD',
              remarks: `Additional issue for shifting ${shiftingNumber}`,
            });
          } else if (delta < 0) {
            // Surplus materials: DO NOT increase warehouse stock until physical return inspection!
            // Surplus is marked pending return
          }

          if (projMat) {
            projMat.installedQuantity = newQty;
          }

          shiftingLines.push({
            materialId: material.id,
            materialName: material.name,
            itemCode: material.itemCode,
            previousQuantity: previousQty,
            newRequiredQuantity: newQty,
            quantityDifference: delta,
            additionalIssuedQty: delta > 0 ? delta : 0,
            surplusReturnedQty: delta < 0 ? Math.abs(delta) : 0,
            damagedQty: 0,
            missingQty: 0,
          });
        }

        if (txnLines.length > 0) {
          const txnNumber = this.generateTransactionNumber(state.transactions);
          transaction = {
            id: `txn-${Date.now()}`,
            transactionNumber: txnNumber,
            movementType: 'SITE_TO_SITE_TRANSFER',
            sourceLocation: 'Taloja Central Scaffolding Yard',
            destinationLocation: data.destinationAreaDescription,
            projectId: project.id,
            projectCode: project.projectCode,
            referenceDocument: shiftingNumber,
            actorId: data.actorId,
            actorName: data.actorName,
            remarks: `Shifting adjustment dispatch for ${project.projectCode}`,
            lines: txnLines,
            createdAt: new Date().toISOString(),
          };
          state.transactions.unshift(transaction);
        }

        project.status = 'ACTIVE_RENTAL';
        project.shiftingCharges = (project.shiftingCharges || 0) + (data.labourCharges || 0) + (data.transportCharges || 0);

        state.activityEvents.unshift({
          id: `act-${Date.now()}`,
          projectId: project.id,
          eventType: 'SHIFTING_COMPLETED',
          eventTitle: 'Shifting Completed with Material Adjustment',
          eventDescription: `Relocated to ${data.destinationAreaDescription} with modified quantities.`,
          actorId: data.actorId,
          actorName: data.actorName,
          createdAt: new Date().toISOString(),
        });
      }

      const shiftingRequest: ShiftingRequest = {
        id: `shf-${Date.now()}`,
        shiftingNumber,
        projectId: project.id,
        projectCode: project.projectCode,
        shiftingType: data.shiftingType,
        currentSiteId: project.siteId,
        currentSiteName: project.siteName,
        destinationAreaDescription: data.destinationAreaDescription,
        plannedShiftingDate: data.plannedShiftingDate,
        actualCompletionDate: new Date().toISOString().split('T')[0],
        supervisorId: data.actorId,
        supervisorName: data.actorName,
        teamMembers: data.teamMembers,
        labourCharges: data.labourCharges || 0,
        transportCharges: data.transportCharges || 0,
        status: 'COMPLETED',
        approvalStatus: 'APPROVED',
        remarks: data.remarks,
        materialLines: shiftingLines,
        createdAt: new Date().toISOString(),
      };
      state.shiftingRequests.unshift(shiftingRequest);

      return { shiftingRequest, transaction };
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
    warehouseId: string;
    supervisorId: string;
    teamMembers?: string;
    transportDetails?: string;
    reconciliationNotes?: string;
    afterPhotoUrls?: string[];
    materialReturns: {
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

      const warehouse = state.warehouses.find(w => w.id === data.warehouseId) || state.warehouses[0];
      const removalNumber = `RMV-${new Date().getFullYear()}-${(state.removalRequests.length + 1).toString().padStart(6, '0')}`;
      const txnNumber = this.generateTransactionNumber(state.transactions);
      const txnLines: InventoryTransaction['lines'] = [];

      let hasDiscrepancy = false;

      for (const ret of data.materialReturns) {
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
        returnLines: data.materialReturns.map(r => {
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

      // Project status transition: RETURNED_RECONCILIATION -> or CLOSED
      project.actualDismantlingDate = data.actualDismantlingDate;
      project.status = hasDiscrepancy ? 'RETURNED_RECONCILIATION' : 'CLOSED';
      if (!hasDiscrepancy) {
        project.closureDate = new Date().toISOString();
      }
      project.updatedAt = new Date().toISOString();

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

      return { removalRequest, transaction, project };
    });
  }
}
