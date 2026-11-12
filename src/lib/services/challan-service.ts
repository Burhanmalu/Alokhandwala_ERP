// ALOKHANDWALA - Challan Management Service (Material Issue, Return, Loss Reconciliation & Inventory Integration)

import { dbStore } from '../db/store';
import { hasPermission, PermissionKey } from '../auth';
import {
  Challan,
  ChallanHistoryEntry,
  ChallanLostEntry,
  ChallanMaterialEntry,
  ChallanReconciliationLine,
  ChallanStatus,
  InventoryTransaction,
  Material,
} from '../schema';

export class ChallanService {
  /**
   * Generate next unique sequential Challan Number (e.g. CHL-2026-000001)
   */
  public static generateNextChallanNumber(existingChallans: Challan[]): string {
    const year = new Date().getFullYear();
    const maxNum = existingChallans.reduce((max, c) => {
      const m = c.challanNumber?.match(/CHL-\d{4}-(\d+)/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    return `CHL-${year}-${(maxNum + 1).toString().padStart(6, '0')}`;
  }

  private static generateTxnNumber(existingTxns: InventoryTransaction[]): string {
    const year = new Date().getFullYear();
    const maxNum = existingTxns.reduce((max, t) => {
      const m = t.transactionNumber?.match(/TXN-\d{4}-(\d+)/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, existingTxns.length);
    return `TXN-${year}-${(maxNum + 1).toString().padStart(6, '0')}`;
  }

  private static assertRolePermission(
    users: { id: string; role: any }[],
    actorId: string | undefined,
    permission: PermissionKey
  ) {
    if (!actorId || actorId === 'system') return;
    const user = users.find(u => u.id === actorId);
    if (user && !hasPermission(user.role, permission)) {
      throw new Error(`Permission denied: role ${user.role} cannot perform ${permission}.`);
    }
  }

  /**
   * Normalize entries against Material catalog & compute exact per-material reconciliation.
   * Rejects returns/losses for unissued materials or quantities exceeding issued quantity.
   */
  public static computeReconciliation(
    outputEntries: Array<{
      id?: string;
      date: string;
      materialId: string;
      materialName?: string;
      itemCode?: string;
      unit?: string;
      quantity: number;
      remarks?: string;
    }>,
    inputEntries: Array<{
      id?: string;
      date: string;
      materialId: string;
      materialName?: string;
      itemCode?: string;
      unit?: string;
      quantity: number;
      remarks?: string;
    }>,
    lostEntries: Array<{
      id?: string;
      date: string;
      materialId: string;
      materialName?: string;
      itemCode?: string;
      unit?: string;
      quantity: number;
      reason?: string;
      approvedById?: string;
      approvedByName?: string;
      recordedAt?: string;
    }>,
    materials: Material[],
    actorId: string,
    actorName: string
  ): {
    normalizedOutputs: ChallanMaterialEntry[];
    normalizedInputs: ChallanMaterialEntry[];
    normalizedLost: ChallanLostEntry[];
    reconciliation: ChallanReconciliationLine[];
    totalOutputQuantity: number;
    totalReturnedQuantity: number;
    totalLostQuantity: number;
    pendingQuantity: number;
    remainingAtSiteQuantity: number;
    hasLostMaterials: boolean;
    issueDate: string;
  } {
    const materialMap = new Map(materials.map(m => [m.id, m]));
    const issuedByMat = new Map<string, number>();
    const returnedByMat = new Map<string, number>();
    const lostByMat = new Map<string, number>();
    const materialOrder: string[] = [];

    const now = new Date().toISOString();

    const normalizedOutputs: ChallanMaterialEntry[] = outputEntries.map((entry, idx) => {
      const mat = materialMap.get(entry.materialId);
      if (!mat) throw new Error(`Issued material not found in inventory (${entry.materialId}).`);
      const qty = Math.trunc(Number(entry.quantity));
      if (!Number.isFinite(qty) || qty < 1) {
        throw new Error(`Issued quantity for ${mat.name} must be at least 1.`);
      }
      if (!issuedByMat.has(mat.id)) {
        materialOrder.push(mat.id);
      }
      issuedByMat.set(mat.id, (issuedByMat.get(mat.id) || 0) + qty);
      return {
        id: entry.id || `chl-out-${Date.now()}-${idx}`,
        date: entry.date,
        materialId: mat.id,
        materialName: mat.name,
        itemCode: mat.itemCode,
        unit: mat.unitOfMeasurement,
        quantity: qty,
        remarks: entry.remarks?.trim() || undefined,
      };
    });

    const normalizedInputs: ChallanMaterialEntry[] = inputEntries.map((entry, idx) => {
      const mat = materialMap.get(entry.materialId);
      if (!mat) throw new Error(`Returned material not found in inventory (${entry.materialId}).`);
      if (!issuedByMat.has(mat.id)) {
        throw new Error(
          `Cannot record return for "${mat.name}" because it was not issued in this challan.`
        );
      }
      const qty = Math.trunc(Number(entry.quantity));
      if (!Number.isFinite(qty) || qty < 1) {
        throw new Error(`Returned quantity for ${mat.name} must be at least 1.`);
      }
      returnedByMat.set(mat.id, (returnedByMat.get(mat.id) || 0) + qty);
      return {
        id: entry.id || `chl-in-${Date.now()}-${idx}`,
        date: entry.date,
        materialId: mat.id,
        materialName: mat.name,
        itemCode: mat.itemCode,
        unit: mat.unitOfMeasurement,
        quantity: qty,
        remarks: entry.remarks?.trim() || undefined,
      };
    });

    const normalizedLost: ChallanLostEntry[] = lostEntries.map((entry, idx) => {
      const mat = materialMap.get(entry.materialId);
      if (!mat) throw new Error(`Lost material not found in inventory (${entry.materialId}).`);
      if (!issuedByMat.has(mat.id)) {
        throw new Error(
          `Cannot record lost/missing entry for "${mat.name}" because it was not issued in this challan.`
        );
      }
      const qty = Math.trunc(Number(entry.quantity));
      if (!Number.isFinite(qty) || qty < 1) {
        throw new Error(`Lost quantity for ${mat.name} must be at least 1.`);
      }
      lostByMat.set(mat.id, (lostByMat.get(mat.id) || 0) + qty);
      return {
        id: entry.id || `chl-lost-${Date.now()}-${idx}`,
        date: entry.date,
        materialId: mat.id,
        materialName: mat.name,
        itemCode: mat.itemCode,
        unit: mat.unitOfMeasurement,
        quantity: qty,
        reason: entry.reason?.trim() || 'Marked missing/lost during reconciliation',
        approvedById: entry.approvedById || actorId,
        approvedByName: entry.approvedByName || actorName,
        recordedAt: entry.recordedAt || now,
      };
    });

    const reconciliation: ChallanReconciliationLine[] = [];
    let totalOutputQuantity = 0;
    let totalReturnedQuantity = 0;
    let totalLostQuantity = 0;
    let remainingAtSiteQuantity = 0;

    for (const matId of materialOrder) {
      const mat = materialMap.get(matId)!;
      const issued = issuedByMat.get(matId) || 0;
      const returned = returnedByMat.get(matId) || 0;
      const lost = lostByMat.get(matId) || 0;

      if (returned > issued) {
        throw new Error(
          `Returned quantity (${returned}) for ${mat.name} cannot exceed issued quantity (${issued}).`
        );
      }
      if (returned + lost > issued) {
        throw new Error(
          `Returned (${returned}) + Lost (${lost}) quantity for ${mat.name} cannot exceed issued quantity (${issued}).`
        );
      }

      const pending = Math.max(0, issued - returned);
      const remainingAtSite = Math.max(0, issued - returned - lost);

      reconciliation.push({
        materialId: mat.id,
        materialName: mat.name,
        itemCode: mat.itemCode,
        unit: mat.unitOfMeasurement,
        issuedQuantity: issued,
        returnedQuantity: returned,
        pendingQuantity: pending,
        lostQuantity: lost,
        remainingAtSite,
      });

      totalOutputQuantity += issued;
      totalReturnedQuantity += returned;
      totalLostQuantity += lost;
      remainingAtSiteQuantity += remainingAtSite;
    }

    const pendingQuantity = Math.max(0, totalOutputQuantity - totalReturnedQuantity);
    const hasLostMaterials = totalLostQuantity > 0;
    const sortedDates = normalizedOutputs.map(o => o.date).filter(Boolean).sort();
    const issueDate = sortedDates[0] || new Date().toISOString().slice(0, 10);

    return {
      normalizedOutputs,
      normalizedInputs,
      normalizedLost,
      reconciliation,
      totalOutputQuantity,
      totalReturnedQuantity,
      totalLostQuantity,
      pendingQuantity,
      remainingAtSiteQuantity,
      hasLostMaterials,
      issueDate,
    };
  }

  /**
   * Determine final status based on reconciliation rules & explicit close/loss approval.
   */
  private static resolveChallanStatus(params: {
    remainingAtSiteQuantity: number;
    hasLostMaterials: boolean;
    totalOutputQuantity: number;
    requestedStatus?: ChallanStatus;
    lossApproved?: boolean;
  }): ChallanStatus {
    const {
      remainingAtSiteQuantity,
      hasLostMaterials,
      totalOutputQuantity,
      requestedStatus,
      lossApproved,
    } = params;

    if (totalOutputQuantity === 0 || remainingAtSiteQuantity > 0) {
      if (requestedStatus === 'CLOSED') {
        throw new Error(
          `Cannot close challan while ${remainingAtSiteQuantity} unit(s) remain unreturned at site.`
        );
      }
      return 'UNCLOSED';
    }

    // remainingAtSiteQuantity === 0
    if (hasLostMaterials) {
      if (lossApproved || requestedStatus === 'CLOSED') {
        if (!lossApproved) {
          throw new Error(
            'Lost/missing material quantities must be explicitly approved by an authorized admin before closing this challan.'
          );
        }
        return 'CLOSED';
      }
      return 'UNCLOSED';
    }

    // Every issued item returned cleanly with zero losses
    return requestedStatus === 'UNCLOSED' ? 'CLOSED' : 'CLOSED';
  }

  /**
   * Apply atomic inventory delta adjustments (prevents duplicate deductions/returns on Edit)
   * Preserves stock conservation invariant:
   *   totalOwnedQty = usableWarehouseQty + siteAllocatedQty + inTransitQty + damagedQty + missingQty
   */
  private static applyInventoryDeltas(params: {
    materials: Material[];
    transactions: InventoryTransaction[];
    oldLines: ChallanReconciliationLine[];
    newLines: ChallanReconciliationLine[];
    challanNumber: string;
    siteName: string;
    actorId: string;
    actorName: string;
    actionContext: string;
  }) {
    const {
      materials,
      transactions,
      oldLines,
      newLines,
      challanNumber,
      siteName,
      actorId,
      actorName,
      actionContext,
    } = params;

    const oldMap = new Map(oldLines.map(l => [l.materialId, l]));
    const newMap = new Map(newLines.map(l => [l.materialId, l]));
    const allMatIds = new Set([...oldMap.keys(), ...newMap.keys()]);

    const issueTxnLines: InventoryTransaction['lines'] = [];
    const returnTxnLines: InventoryTransaction['lines'] = [];
    const lossTxnLines: InventoryTransaction['lines'] = [];
    const adjustmentTxnLines: InventoryTransaction['lines'] = [];

    for (const matId of allMatIds) {
      const material = materials.find(m => m.id === matId);
      if (!material) throw new Error(`Material ${matId} not found in warehouse inventory.`);

      const prev = oldMap.get(matId);
      const next = newMap.get(matId);

      const oldIssued = prev?.issuedQuantity || 0;
      const newIssued = next?.issuedQuantity || 0;
      const oldReturned = prev?.returnedQuantity || 0;
      const newReturned = next?.returnedQuantity || 0;
      const oldLost = prev?.lostQuantity || 0;
      const newLost = next?.lostQuantity || 0;

      const deltaIssued = newIssued - oldIssued;
      const deltaReturned = newReturned - oldReturned;
      const deltaLost = newLost - oldLost;

      if (deltaIssued === 0 && deltaReturned === 0 && deltaLost === 0) {
        continue;
      }

      // 1. Validate warehouse stock before net outflow from warehouse
      // Note: you must have enough available stock to fulfill additional issued qty (or reduced returned qty)
      const warehouseOutflow = deltaIssued - deltaReturned;
      const available = material.usableWarehouseQty - material.reservedQty;
      if (warehouseOutflow > available) {
        throw new Error(
          `Insufficient available warehouse stock for "${material.name}" (${material.itemCode}). Required outflow: ${warehouseOutflow}, Available: ${Math.max(0, available)}.`
        );
      }

      // 2. Apply atomic stock movement maintaining totalOwnedQty invariant
      material.usableWarehouseQty = material.usableWarehouseQty - deltaIssued + deltaReturned;
      material.siteAllocatedQty = Math.max(
        0,
        material.siteAllocatedQty + deltaIssued - deltaReturned - deltaLost
      );
      material.missingQty = Math.max(0, material.missingQty + deltaLost);
      material.availableToAllocate = material.usableWarehouseQty - material.reservedQty;

      // 3. Collect audit transaction lines
      if (deltaIssued > 0) {
        issueTxnLines.push({
          materialId: material.id,
          materialName: material.name,
          itemCode: material.itemCode,
          quantity: deltaIssued,
          condition: 'GOOD',
          remarks: `Challan ${challanNumber} output issued (${actionContext})`,
        });
      } else if (deltaIssued < 0) {
        adjustmentTxnLines.push({
          materialId: material.id,
          materialName: material.name,
          itemCode: material.itemCode,
          quantity: Math.abs(deltaIssued),
          condition: 'GOOD',
          remarks: `Challan ${challanNumber} output reduced by ${Math.abs(deltaIssued)} (${actionContext})`,
        });
      }

      if (deltaReturned > 0) {
        returnTxnLines.push({
          materialId: material.id,
          materialName: material.name,
          itemCode: material.itemCode,
          quantity: deltaReturned,
          condition: 'GOOD',
          remarks: `Challan ${challanNumber} physical return to warehouse (${actionContext})`,
        });
      } else if (deltaReturned < 0) {
        adjustmentTxnLines.push({
          materialId: material.id,
          materialName: material.name,
          itemCode: material.itemCode,
          quantity: Math.abs(deltaReturned),
          condition: 'GOOD',
          remarks: `Challan ${challanNumber} return entry reduced by ${Math.abs(deltaReturned)} (${actionContext})`,
        });
      }

      if (deltaLost > 0) {
        lossTxnLines.push({
          materialId: material.id,
          materialName: material.name,
          itemCode: material.itemCode,
          quantity: deltaLost,
          condition: 'MISSING',
          remarks: `Challan ${challanNumber} lost/missing recorded (${actionContext})`,
        });
      } else if (deltaLost < 0) {
        adjustmentTxnLines.push({
          materialId: material.id,
          materialName: material.name,
          itemCode: material.itemCode,
          quantity: Math.abs(deltaLost),
          condition: 'MISSING',
          remarks: `Challan ${challanNumber} lost entry reduced by ${Math.abs(deltaLost)} (${actionContext})`,
        });
      }
    }

    const now = new Date().toISOString();

    if (issueTxnLines.length > 0) {
      transactions.unshift({
        id: `txn-co-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        transactionNumber: this.generateTxnNumber(transactions),
        movementType: 'MATERIAL_ISSUE_DISPATCH',
        sourceLocation: 'Indore Central Scaffolding Yard',
        destinationLocation: siteName,
        referenceDocument: challanNumber,
        actorId,
        actorName,
        remarks: `Challan ${challanNumber} issue dispatch (${actionContext})`,
        lines: issueTxnLines,
        createdAt: now,
      });
    }

    if (returnTxnLines.length > 0) {
      transactions.unshift({
        id: `txn-ci-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        transactionNumber: this.generateTxnNumber(transactions),
        movementType: 'WAREHOUSE_RETURN',
        sourceLocation: siteName,
        destinationLocation: 'Indore Central Scaffolding Yard',
        referenceDocument: challanNumber,
        actorId,
        actorName,
        remarks: `Challan ${challanNumber} material return (${actionContext})`,
        lines: returnTxnLines,
        createdAt: now,
      });
    }

    if (lossTxnLines.length > 0) {
      transactions.unshift({
        id: `txn-cl-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        transactionNumber: this.generateTxnNumber(transactions),
        movementType: 'MISSING_STOCK_ADJUSTMENT',
        sourceLocation: siteName,
        destinationLocation: 'Missing / Loss Ledger',
        referenceDocument: challanNumber,
        actorId,
        actorName,
        remarks: `Challan ${challanNumber} missing/lost material logged (${actionContext})`,
        lines: lossTxnLines,
        createdAt: now,
      });
    }

    if (adjustmentTxnLines.length > 0) {
      transactions.unshift({
        id: `txn-ca-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        transactionNumber: this.generateTxnNumber(transactions),
        movementType: 'PHYSICAL_COUNT_CORRECTION',
        sourceLocation: siteName,
        destinationLocation: 'Indore Central Scaffolding Yard',
        referenceDocument: challanNumber,
        actorId,
        actorName,
        remarks: `Challan ${challanNumber} delta adjustment (${actionContext})`,
        lines: adjustmentTxnLines,
        createdAt: now,
      });
    }
  }

  /**
   * Create a new Challan with atomic stock integration & duplicate-click protection
   */
  public static async createChallan(data: {
    customerId: string;
    siteId?: string;
    siteName?: string;
    projectId?: string;
    size: string;
    issueDate?: string;
    outputEntries: Array<{
      id?: string;
      date: string;
      materialId: string;
      quantity: number;
      remarks?: string;
    }>;
    inputEntries?: Array<{
      id?: string;
      date: string;
      materialId: string;
      quantity: number;
      remarks?: string;
    }>;
    lostEntries?: Array<{
      id?: string;
      date: string;
      materialId: string;
      quantity: number;
      reason?: string;
    }>;
    status?: ChallanStatus;
    lossApproved?: boolean;
    notes?: string;
    clientRequestId?: string;
    actorId: string;
    actorName: string;
  }): Promise<Challan> {
    return await dbStore.transaction(async (state) => {
      if (!state.challans) state.challans = [];

      this.assertRolePermission(state.users, data.actorId, 'CHALLAN_CREATE');

      // Idempotency guard against accidental duplicate clicks
      if (data.clientRequestId) {
        const existing = state.challans.find(c => c.clientRequestId === data.clientRequestId);
        if (existing) {
          return existing;
        }
      }

      const customer = state.customers.find(c => c.id === data.customerId);
      if (!customer) throw new Error('Selected customer not found.');

      const site = data.siteId
        ? state.sites.find(s => s.id === data.siteId)
        : state.sites.find(s => s.customerId === customer.id && s.siteName === data.siteName);

      const resolvedSiteName = site?.siteName || data.siteName?.trim() || `${customer.companyName} Site`;
      const resolvedSiteId = site?.id || '';
      const resolvedSiteAddress = site?.siteAddress || customer.billingAddress;

      const project = data.projectId
        ? state.projects.find(p => p.id === data.projectId)
        : undefined;

      if ((data.lostEntries || []).length > 0) {
        this.assertRolePermission(state.users, data.actorId, 'CHALLAN_RECORD_LOSS');
      }

      const computed = this.computeReconciliation(
        data.outputEntries,
        data.inputEntries || [],
        data.lostEntries || [],
        state.materials,
        data.actorId,
        data.actorName
      );

      const resolvedStatus = this.resolveChallanStatus({
        remainingAtSiteQuantity: computed.remainingAtSiteQuantity,
        hasLostMaterials: computed.hasLostMaterials,
        totalOutputQuantity: computed.totalOutputQuantity,
        requestedStatus: data.status,
        lossApproved: data.lossApproved,
      });

      const challanNumber = this.generateNextChallanNumber(state.challans);

      // Apply inventory movements atomically (deducts output, returns input, records lost)
      this.applyInventoryDeltas({
        materials: state.materials,
        transactions: state.transactions,
        oldLines: [],
        newLines: computed.reconciliation,
        challanNumber,
        siteName: resolvedSiteName,
        actorId: data.actorId,
        actorName: data.actorName,
        actionContext: 'New Challan Created',
      });

      const now = new Date().toISOString();
      const challanId = `chl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const history: ChallanHistoryEntry[] = [
        {
          id: `chl-h-${Date.now()}`,
          actionType: 'CREATED',
          description: `Created ${challanNumber} with ${computed.totalOutputQuantity} issued unit(s)${computed.totalReturnedQuantity > 0 ? `, ${computed.totalReturnedQuantity} returned` : ''}${computed.totalLostQuantity > 0 ? `, ${computed.totalLostQuantity} lost/missing` : ''}. Status: ${resolvedStatus}.`,
          actorId: data.actorId,
          actorName: data.actorName,
          timestamp: now,
        },
      ];

      const newChallan: Challan = {
        id: challanId,
        challanNumber,
        customerId: customer.id,
        customerName: customer.companyName,
        customerPhone: customer.phone,
        siteId: resolvedSiteId,
        siteName: resolvedSiteName,
        siteAddress: resolvedSiteAddress,
        projectId: project?.id,
        projectCode: project?.projectCode,
        size: data.size.trim(),
        issueDate: data.issueDate || computed.issueDate,
        outputEntries: computed.normalizedOutputs,
        inputEntries: computed.normalizedInputs,
        lostEntries: computed.normalizedLost,
        totalOutputQuantity: computed.totalOutputQuantity,
        totalReturnedQuantity: computed.totalReturnedQuantity,
        totalLostQuantity: computed.totalLostQuantity,
        pendingQuantity: computed.pendingQuantity,
        remainingAtSiteQuantity: computed.remainingAtSiteQuantity,
        reconciliation: computed.reconciliation,
        status: resolvedStatus,
        hasLostMaterials: computed.hasLostMaterials,
        lossApproved: computed.hasLostMaterials ? Boolean(data.lossApproved) : undefined,
        lossApprovedBy:
          computed.hasLostMaterials && data.lossApproved ? data.actorName : undefined,
        lossApprovedAt:
          computed.hasLostMaterials && data.lossApproved ? now : undefined,
        notes: data.notes?.trim() || undefined,
        history,
        clientRequestId: data.clientRequestId,
        createdBy: data.actorId,
        createdByName: data.actorName,
        closedBy: resolvedStatus === 'CLOSED' ? data.actorId : undefined,
        closedByName: resolvedStatus === 'CLOSED' ? data.actorName : undefined,
        closedAt: resolvedStatus === 'CLOSED' ? now : undefined,
        createdAt: now,
        updatedAt: now,
      };

      state.challans.unshift(newChallan);

      state.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        actorId: data.actorId,
        actorEmail: data.actorName,
        action: 'CHALLAN_CREATED',
        entityTable: 'challans',
        entityId: challanId,
        newState: {
          challanNumber,
          customerName: newChallan.customerName,
          siteName: newChallan.siteName,
          totalOutputQuantity: newChallan.totalOutputQuantity,
          totalReturnedQuantity: newChallan.totalReturnedQuantity,
          totalLostQuantity: newChallan.totalLostQuantity,
          status: newChallan.status,
        },
        createdAt: now,
      });

      return newChallan;
    });
  }

  /**
   * Update an existing Challan using delta inventory reconciliation
   */
  public static async updateChallan(
    challanId: string,
    data: {
      customerId: string;
      siteId?: string;
      siteName?: string;
      projectId?: string;
      size: string;
      issueDate?: string;
      outputEntries: Array<{
        id?: string;
        date: string;
        materialId: string;
        quantity: number;
        remarks?: string;
      }>;
      inputEntries?: Array<{
        id?: string;
        date: string;
        materialId: string;
        quantity: number;
        remarks?: string;
      }>;
      lostEntries?: Array<{
        id?: string;
        date: string;
        materialId: string;
        quantity: number;
        reason?: string;
      }>;
      status?: ChallanStatus;
      lossApproved?: boolean;
      notes?: string;
      actorId: string;
      actorName: string;
    }
  ): Promise<Challan> {
    return await dbStore.transaction(async (state) => {
      if (!state.challans) state.challans = [];

      this.assertRolePermission(state.users, data.actorId, 'CHALLAN_EDIT');

      const challan = state.challans.find(c => c.id === challanId || c.challanNumber === challanId);
      if (!challan) throw new Error('Challan not found.');

      const customer = state.customers.find(c => c.id === data.customerId);
      if (!customer) throw new Error('Selected customer not found.');

      const site = data.siteId
        ? state.sites.find(s => s.id === data.siteId)
        : state.sites.find(s => s.customerId === customer.id && s.siteName === data.siteName);

      const resolvedSiteName = site?.siteName || data.siteName?.trim() || challan.siteName;
      const resolvedSiteId = site?.id || '';
      const resolvedSiteAddress = site?.siteAddress || customer.billingAddress;
      const project = data.projectId
        ? state.projects.find(p => p.id === data.projectId)
        : undefined;

      const oldLostSignature = JSON.stringify(challan.lostEntries || []);
      const newLostInput = data.lostEntries || [];
      if (newLostInput.length > 0 && oldLostSignature !== JSON.stringify(newLostInput)) {
        this.assertRolePermission(state.users, data.actorId, 'CHALLAN_RECORD_LOSS');
      }

      const computed = this.computeReconciliation(
        data.outputEntries,
        data.inputEntries || [],
        newLostInput,
        state.materials,
        data.actorId,
        data.actorName
      );

      const effectiveLossApproved =
        data.lossApproved !== undefined ? data.lossApproved : challan.lossApproved;

      const resolvedStatus = this.resolveChallanStatus({
        remainingAtSiteQuantity: computed.remainingAtSiteQuantity,
        hasLostMaterials: computed.hasLostMaterials,
        totalOutputQuantity: computed.totalOutputQuantity,
        requestedStatus: data.status,
        lossApproved: effectiveLossApproved,
      });

      const oldLines = challan.reconciliation || [];

      this.applyInventoryDeltas({
        materials: state.materials,
        transactions: state.transactions,
        oldLines,
        newLines: computed.reconciliation,
        challanNumber: challan.challanNumber,
        siteName: resolvedSiteName,
        actorId: data.actorId,
        actorName: data.actorName,
        actionContext: 'Challan Updated',
      });

      const now = new Date().toISOString();
      const oldStatus = challan.status;

      challan.customerId = customer.id;
      challan.customerName = customer.companyName;
      challan.customerPhone = customer.phone;
      challan.siteId = resolvedSiteId;
      challan.siteName = resolvedSiteName;
      challan.siteAddress = resolvedSiteAddress;
      challan.projectId = project?.id;
      challan.projectCode = project?.projectCode;
      challan.size = data.size.trim();
      challan.issueDate = data.issueDate || computed.issueDate;
      challan.outputEntries = computed.normalizedOutputs;
      challan.inputEntries = computed.normalizedInputs;
      challan.lostEntries = computed.normalizedLost;
      challan.totalOutputQuantity = computed.totalOutputQuantity;
      challan.totalReturnedQuantity = computed.totalReturnedQuantity;
      challan.totalLostQuantity = computed.totalLostQuantity;
      challan.pendingQuantity = computed.pendingQuantity;
      challan.remainingAtSiteQuantity = computed.remainingAtSiteQuantity;
      challan.reconciliation = computed.reconciliation;
      challan.status = resolvedStatus;
      challan.hasLostMaterials = computed.hasLostMaterials;
      challan.lossApproved = computed.hasLostMaterials ? Boolean(effectiveLossApproved) : undefined;
      if (computed.hasLostMaterials && effectiveLossApproved && !challan.lossApprovedBy) {
        challan.lossApprovedBy = data.actorName;
        challan.lossApprovedAt = now;
      }
      challan.notes = data.notes?.trim() || undefined;
      challan.updatedAt = now;

      if (resolvedStatus === 'CLOSED') {
        challan.closedBy = challan.closedBy || data.actorId;
        challan.closedByName = challan.closedByName || data.actorName;
        challan.closedAt = challan.closedAt || now;
      } else {
        challan.closedBy = undefined;
        challan.closedByName = undefined;
        challan.closedAt = undefined;
      }

      if (!challan.history) challan.history = [];
      challan.history.unshift({
        id: `chl-h-${Date.now()}`,
        actionType: oldStatus === 'CLOSED' && resolvedStatus === 'UNCLOSED' ? 'REOPENED' : 'EDITED',
        description: `Updated ${challan.challanNumber}: Output=${computed.totalOutputQuantity}, Returned=${computed.totalReturnedQuantity}, Lost=${computed.totalLostQuantity}, Remaining at Site=${computed.remainingAtSiteQuantity}, Status=${resolvedStatus}.`,
        actorId: data.actorId,
        actorName: data.actorName,
        timestamp: now,
      });

      state.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        actorId: data.actorId,
        actorEmail: data.actorName,
        action: 'CHALLAN_UPDATED',
        entityTable: 'challans',
        entityId: challan.id,
        oldState: { status: oldStatus },
        newState: {
          status: challan.status,
          totalOutputQuantity: challan.totalOutputQuantity,
          totalReturnedQuantity: challan.totalReturnedQuantity,
          totalLostQuantity: challan.totalLostQuantity,
          remainingAtSiteQuantity: challan.remainingAtSiteQuantity,
        },
        createdAt: now,
      });

      return challan;
    });
  }

  /**
   * Append additional Input (Return) entries to a Challan
   */
  public static async addReturnEntries(
    challanId: string,
    entries: Array<{ date: string; materialId: string; quantity: number; remarks?: string }>,
    actorId: string,
    actorName: string
  ): Promise<Challan> {
    return await dbStore.transaction(async (state) => {
      if (!state.challans) state.challans = [];

      this.assertRolePermission(state.users, actorId, 'CHALLAN_RECORD_RETURN');

      const challan = state.challans.find(c => c.id === challanId || c.challanNumber === challanId);
      if (!challan) throw new Error('Challan not found.');

      const combinedInputs = [...(challan.inputEntries || []), ...entries];

      const computed = this.computeReconciliation(
        challan.outputEntries || [],
        combinedInputs,
        challan.lostEntries || [],
        state.materials,
        actorId,
        actorName
      );

      const resolvedStatus = this.resolveChallanStatus({
        remainingAtSiteQuantity: computed.remainingAtSiteQuantity,
        hasLostMaterials: computed.hasLostMaterials,
        totalOutputQuantity: computed.totalOutputQuantity,
        lossApproved: challan.lossApproved,
      });

      this.applyInventoryDeltas({
        materials: state.materials,
        transactions: state.transactions,
        oldLines: challan.reconciliation || [],
        newLines: computed.reconciliation,
        challanNumber: challan.challanNumber,
        siteName: challan.siteName,
        actorId,
        actorName,
        actionContext: 'Material Return Entry Added',
      });

      const now = new Date().toISOString();
      const addedQty = entries.reduce((sum, e) => sum + Number(e.quantity || 0), 0);

      challan.inputEntries = computed.normalizedInputs;
      challan.totalReturnedQuantity = computed.totalReturnedQuantity;
      challan.pendingQuantity = computed.pendingQuantity;
      challan.remainingAtSiteQuantity = computed.remainingAtSiteQuantity;
      challan.reconciliation = computed.reconciliation;
      challan.status = resolvedStatus;
      challan.updatedAt = now;

      if (resolvedStatus === 'CLOSED') {
        challan.closedBy = actorId;
        challan.closedByName = actorName;
        challan.closedAt = now;
      }

      if (!challan.history) challan.history = [];
      challan.history.unshift({
        id: `chl-h-${Date.now()}`,
        actionType: 'RETURN_RECORDED',
        description: `Recorded return entry of ${addedQty} unit(s). Total returned: ${computed.totalReturnedQuantity}/${computed.totalOutputQuantity}. Remaining at site: ${computed.remainingAtSiteQuantity}.`,
        actorId,
        actorName,
        timestamp: now,
      });

      state.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        actorId,
        actorEmail: actorName,
        action: 'CHALLAN_RETURN_RECORDED',
        entityTable: 'challans',
        entityId: challan.id,
        newState: {
          addedQty,
          totalReturnedQuantity: computed.totalReturnedQuantity,
          remainingAtSiteQuantity: computed.remainingAtSiteQuantity,
          status: resolvedStatus,
        },
        createdAt: now,
      });

      return challan;
    });
  }

  /**
   * Record Missing / Lost materials separately (never returned into warehouse stock)
   */
  public static async recordLostMaterials(
    challanId: string,
    entries: Array<{ date: string; materialId: string; quantity: number; reason?: string }>,
    approveLoss: boolean,
    actorId: string,
    actorName: string
  ): Promise<Challan> {
    return await dbStore.transaction(async (state) => {
      if (!state.challans) state.challans = [];

      this.assertRolePermission(state.users, actorId, 'CHALLAN_RECORD_LOSS');

      const challan = state.challans.find(c => c.id === challanId || c.challanNumber === challanId);
      if (!challan) throw new Error('Challan not found.');

      const combinedLost = [...(challan.lostEntries || []), ...entries];

      const computed = this.computeReconciliation(
        challan.outputEntries || [],
        challan.inputEntries || [],
        combinedLost,
        state.materials,
        actorId,
        actorName
      );

      const resolvedStatus = this.resolveChallanStatus({
        remainingAtSiteQuantity: computed.remainingAtSiteQuantity,
        hasLostMaterials: computed.hasLostMaterials,
        totalOutputQuantity: computed.totalOutputQuantity,
        lossApproved: approveLoss,
      });

      this.applyInventoryDeltas({
        materials: state.materials,
        transactions: state.transactions,
        oldLines: challan.reconciliation || [],
        newLines: computed.reconciliation,
        challanNumber: challan.challanNumber,
        siteName: challan.siteName,
        actorId,
        actorName,
        actionContext: 'Lost/Missing Material Recorded',
      });

      const now = new Date().toISOString();
      const lostAddedQty = entries.reduce((sum, e) => sum + Number(e.quantity || 0), 0);

      challan.lostEntries = computed.normalizedLost;
      challan.totalLostQuantity = computed.totalLostQuantity;
      challan.pendingQuantity = computed.pendingQuantity;
      challan.remainingAtSiteQuantity = computed.remainingAtSiteQuantity;
      challan.reconciliation = computed.reconciliation;
      challan.hasLostMaterials = computed.hasLostMaterials;
      challan.lossApproved = approveLoss;
      if (approveLoss) {
        challan.lossApprovedBy = actorName;
        challan.lossApprovedAt = now;
      }
      challan.status = resolvedStatus;
      challan.updatedAt = now;

      if (resolvedStatus === 'CLOSED') {
        challan.closedBy = actorId;
        challan.closedByName = actorName;
        challan.closedAt = now;
      }

      if (!challan.history) challan.history = [];
      challan.history.unshift({
        id: `chl-h-${Date.now()}`,
        actionType: 'LOSS_RECORDED',
        description: `Recorded ${lostAddedQty} lost/missing unit(s). Total lost: ${computed.totalLostQuantity}. Remaining at site: ${computed.remainingAtSiteQuantity}.`,
        actorId,
        actorName,
        timestamp: now,
      });

      state.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        actorId,
        actorEmail: actorName,
        action: 'CHALLAN_LOSS_RECORDED',
        entityTable: 'challans',
        entityId: challan.id,
        newState: {
          lostAddedQty,
          totalLostQuantity: computed.totalLostQuantity,
          remainingAtSiteQuantity: computed.remainingAtSiteQuantity,
          lossApproved: approveLoss,
          status: resolvedStatus,
        },
        createdAt: now,
      });

      return challan;
    });
  }

  /**
   * Close a fully reconciled Challan (Authorized Admin only)
   */
  public static async closeChallan(
    challanId: string,
    actorId: string,
    actorName: string,
    approveLoss = false
  ): Promise<Challan> {
    return await dbStore.transaction(async (state) => {
      if (!state.challans) state.challans = [];

      this.assertRolePermission(state.users, actorId, 'CHALLAN_CLOSE');

      const challan = state.challans.find(c => c.id === challanId || c.challanNumber === challanId);
      if (!challan) throw new Error('Challan not found.');

      if (challan.status === 'CLOSED') {
        return challan;
      }

      const unreconciledLines = (challan.reconciliation || []).filter(l => l.remainingAtSite > 0);
      if (unreconciledLines.length > 0 || challan.remainingAtSiteQuantity > 0) {
        const names = unreconciledLines.map(l => `${l.materialName} (${l.remainingAtSite} at site)`).join(', ');
        throw new Error(
          `Cannot close challan: materials are still pending reconciliation (${names}).`
        );
      }

      if (challan.hasLostMaterials && !challan.lossApproved && !approveLoss) {
        throw new Error(
          'This challan has lost/missing materials. Admin confirmation approving the recorded losses is required to close.'
        );
      }

      const now = new Date().toISOString();
      challan.status = 'CLOSED';
      if (challan.hasLostMaterials && approveLoss) {
        challan.lossApproved = true;
        challan.lossApprovedBy = actorName;
        challan.lossApprovedAt = now;
      }
      challan.closedBy = actorId;
      challan.closedByName = actorName;
      challan.closedAt = now;
      challan.updatedAt = now;

      if (!challan.history) challan.history = [];
      challan.history.unshift({
        id: `chl-h-${Date.now()}`,
        actionType: 'CLOSED',
        description: `Challan ${challan.challanNumber} closed by ${actorName}.${challan.hasLostMaterials ? ` (Approved ${challan.totalLostQuantity} lost/missing unit(s))` : ' All materials cleanly returned.'}`,
        actorId,
        actorName,
        timestamp: now,
      });

      state.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        actorId,
        actorEmail: actorName,
        action: 'CHALLAN_CLOSED',
        entityTable: 'challans',
        entityId: challan.id,
        newState: {
          status: 'CLOSED',
          totalOutputQuantity: challan.totalOutputQuantity,
          totalReturnedQuantity: challan.totalReturnedQuantity,
          totalLostQuantity: challan.totalLostQuantity,
        },
        createdAt: now,
      });

      return challan;
    });
  }

  /**
   * Delete a Challan safely and reverse its net stock effects
   */
  public static async deleteChallan(
    challanId: string,
    actorId: string,
    actorName: string
  ): Promise<{ challanNumber: string }> {
    return await dbStore.transaction(async (state) => {
      if (!state.challans) state.challans = [];

      this.assertRolePermission(state.users, actorId, 'CHALLAN_DELETE');

      const idx = state.challans.findIndex(c => c.id === challanId || c.challanNumber === challanId);
      if (idx === -1) throw new Error('Challan not found.');

      const challan = state.challans[idx];

      // Reverse any unreturned site allocations or logged losses attributable to this challan
      const reversalTxnLines: InventoryTransaction['lines'] = [];
      for (const line of challan.reconciliation || []) {
        const material = state.materials.find(m => m.id === line.materialId);
        if (!material) continue;

        const remainingAtSite = Math.max(0, line.remainingAtSite);
        const lost = Math.max(0, line.lostQuantity);

        if (remainingAtSite > 0 || lost > 0) {
          const siteDec = Math.min(material.siteAllocatedQty, remainingAtSite);
          const lossDec = Math.min(material.missingQty, lost);
          material.siteAllocatedQty = Math.max(0, material.siteAllocatedQty - siteDec);
          material.missingQty = Math.max(0, material.missingQty - lossDec);
          material.usableWarehouseQty += siteDec + lossDec;
          material.availableToAllocate = material.usableWarehouseQty - material.reservedQty;

          reversalTxnLines.push({
            materialId: material.id,
            materialName: material.name,
            itemCode: material.itemCode,
            quantity: siteDec + lossDec,
            condition: 'GOOD',
            remarks: `Stock restored on deletion of challan ${challan.challanNumber}`,
          });
        }
      }

      if (reversalTxnLines.length > 0) {
        state.transactions.unshift({
          id: `txn-cd-${Date.now()}`,
          transactionNumber: this.generateTxnNumber(state.transactions),
          movementType: 'PHYSICAL_COUNT_CORRECTION',
          sourceLocation: challan.siteName,
          destinationLocation: 'Indore Central Scaffolding Yard',
          referenceDocument: challan.challanNumber,
          actorId,
          actorName,
          remarks: `Inventory reversed on deletion of ${challan.challanNumber}`,
          lines: reversalTxnLines,
          createdAt: new Date().toISOString(),
        });
      }

      state.challans.splice(idx, 1);

      state.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        actorId,
        actorEmail: actorName,
        action: 'CHALLAN_DELETED',
        entityTable: 'challans',
        entityId: challan.id,
        oldState: {
          challanNumber: challan.challanNumber,
          customerName: challan.customerName,
          siteName: challan.siteName,
          status: challan.status,
        },
        createdAt: new Date().toISOString(),
      });

      return { challanNumber: challan.challanNumber };
    });
  }
}

