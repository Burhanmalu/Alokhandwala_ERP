// ALOKHANDWALA - Quotation Lifecycle & Commercial Pricing Engine

import { dbStore } from '../db/store';
import { Quotation, QuotationStatus, QuotationMaterialItem, Project, ProjectStatus } from '../schema';
import { calculateScaffoldingArea, extractProjectDimensions } from '../formatters';
import { calculateCommercialPricing } from './pricing-service';

export interface QuotationCalculationInput {
  ratePerSqFt: number;
  totalAreaSqFt: number;
  durationMonths?: number;
  rentalDurationDays?: number;
  walkwayJaliIncludedQuantity?: number;
  extraJaliQuantity?: number;
  extraJaliRate?: number;
  transportCharges?: number;
  shiftingCharges?: number;
  otherCharges?: number;
  gstPercentage?: number;
}

export interface QuotationCalculationOutput {
  ratePerSqFt: number;
  totalAreaSqFt: number;
  rentalDurationDays: number;
  durationMonths: number;
  monthlyRentalAmount: number;
  rentalTotalAmount?: number;
  walkwayJaliIncludedQuantity: number;
  extraJaliQuantity: number;
  extraJaliRate: number;
  extraJaliCharges: number;
  transportCharges: number;
  shiftingCharges: number;
  otherCharges: number;
  subtotal: number;
  gstPercentage: number;
  gstAmount: number;
  grandTotal: number;
  advancePercentage: number;
  advanceAmount: number;
  remainingAmount: number;
}

export class QuotationService {
  /**
   * Generate next sequential human-readable Quotation Number (e.g. QTN-000001)
   */
  public static generateNextQuotationNumber(existingQuotations: Quotation[]): string {
    const maxNumber = existingQuotations.reduce((max, q) => {
      const match = q.quotationNumber.match(/(?:QTN|AW-QTN)-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 0);

    const nextNum = maxNumber + 1;
    return `QTN-${nextNum.toString().padStart(6, '0')}`;
  }

  /**
   * Deterministic commercial calculation engine for scaffolding quotations
   * Follows Alokhandwala ERP business rules:
   * - 28 days = 1 commercial rental month
   * - Extra jali = ₹200 per piece
   * - 75% advance / 25% balance completion payment schedule
   * - 18% standard GST (or configured company rate)
   */
  public static calculatePricing(input: QuotationCalculationInput): QuotationCalculationOutput {
    const pricing = calculateCommercialPricing({
      totalAreaSqFt: input.totalAreaSqFt,
      ratePerSqFt: input.ratePerSqFt,
      durationMonths: input.durationMonths,
      rentalDurationDays: input.rentalDurationDays,
      walkwayJaliIncludedQuantity: input.walkwayJaliIncludedQuantity,
      extraJaliQuantity: input.extraJaliQuantity,
      extraJaliRate: input.extraJaliRate,
      transportCharges: input.transportCharges,
      shiftingCharges: input.shiftingCharges,
      otherCharges: input.otherCharges,
      gstPercentage: input.gstPercentage,
    });

    return {
      ratePerSqFt: pricing.ratePerSqFt,
      totalAreaSqFt: pricing.applicableAreaSqFt,
      rentalDurationDays: pricing.rentalDurationDays,
      durationMonths: pricing.durationMonths,
      monthlyRentalAmount: pricing.monthlyRentalAmount,
      rentalTotalAmount: pricing.rentalTotalAmount,
      walkwayJaliIncludedQuantity: pricing.walkwayJaliIncludedQuantity,
      extraJaliQuantity: pricing.extraJaliQuantity,
      extraJaliRate: pricing.extraJaliRate,
      extraJaliCharges: pricing.extraJaliCharges,
      transportCharges: pricing.transportCharges,
      shiftingCharges: pricing.shiftingCharges,
      otherCharges: pricing.otherCharges,
      subtotal: pricing.subtotal,
      gstPercentage: pricing.gstPercentage,
      gstAmount: pricing.gstAmount,
      grandTotal: pricing.grandTotal,
      advancePercentage: pricing.advancePercentage,
      advanceAmount: pricing.advanceAmount,
      remainingAmount: pricing.remainingAmount,
    };
  }

  /**
   * Suggest material requirements based on Site Form dimensions and structure type
   */
  public static suggestMaterialsForProject(project: Project): {
    materials: QuotationMaterialItem[];
    totalAreaSqFt: number;
    recommendedPlanTitle: string;
  } {
    const meas = project.measurements;
    const width = meas?.width || meas?.length || 20;
    const depth = meas?.depth !== undefined ? meas.depth : 3;
    const height = meas?.height || 20;
    const unit = meas?.unit || 'FEET';

    const totalAreaSqFt = calculateScaffoldingArea(width, depth, height, unit);
    let length = width;
    if (unit === 'METERS') {
      length = Math.round(length * 3.28084 * 10) / 10;
    }

    // Calculate standard scaffolding components derived from project dimensions
    const baysLength = Math.max(1, Math.ceil(length / 8));
    const liftsHeight = Math.max(1, Math.ceil(height / 6.5));
    const standardsCount = (baysLength + 1) * 2;
    const verticalsCount = standardsCount * liftsHeight;
    const ledgersCount = baysLength * 2 * (liftsHeight + 1);
    const transomsCount = (baysLength + 1) * 2 * (liftsHeight + 1);
    const jaliCount = baysLength * 2;

    const catalog = dbStore.getMaterials();
    const requirements = [
      { code: 'V-10FT-3M', qty: verticalsCount, fallbackName: 'VERTICAL 10FT/3MTR (Standard Pipe)', rate: 45 },
      { code: 'L-8FT-2.5M', qty: ledgersCount, fallbackName: 'LEDGER 8FT/2.5MTR (Horizontal Pipe)', rate: 35 },
      { code: 'L-4FT-1.25M', qty: transomsCount, fallbackName: 'LEDGER 4FT/1.25MTR (Cross Transom Pipe)', rate: 25 },
      { code: 'JACK-BASE', qty: standardsCount, fallbackName: 'BASE JACK / ADJUSTABLE JACK', rate: 20 },
      { code: 'JALI-8FT-MS', qty: jaliCount, fallbackName: 'WALKWAY JALI 8FT MS (Steel Deck Platform)', rate: 65 },
      { code: 'CPL-SWIVEL', qty: baysLength * 4, fallbackName: 'COUPLER SWIVEL', rate: 14 },
    ];

    const materials: QuotationMaterialItem[] = [];
    for (const req of requirements) {
      const mat = catalog.find(m => m.itemCode === req.code);
      const rate = mat?.rentalRatePerMonth || req.rate;
      materials.push({
        materialId: mat?.id,
        itemCode: req.code,
        materialName: mat?.name || req.fallbackName,
        categoryName: mat?.categoryName || 'Scaffolding',
        unit: mat?.unitOfMeasurement || 'NOS',
        quantity: req.qty,
        monthlyRentalRate: rate,
        totalMonthlyRent: Math.round(req.qty * rate * 100) / 100,
      });
    }

    return {
      materials,
      totalAreaSqFt,
      recommendedPlanTitle: 'Façade Scaffolding System Plan',
    };
  }

  /**
   * Create or update a formal commercial quotation for a project
   */
  public static async saveQuotation(data: {
    id?: string;
    projectId: string;
    status: QuotationStatus;
    quotationDate?: string;
    ratePerSqFt: number;
    totalAreaSqFt?: number;
    durationMonths?: number;
    rentalDurationDays?: number;
    walkwayJaliIncludedQuantity?: number;
    extraJaliQuantity?: number;
    extraJaliRate?: number;
    transportCharges?: number;
    shiftingCharges?: number;
    otherCharges?: number;
    gstPercentage?: number;
    materials: QuotationMaterialItem[];
    scaffoldingType?: string;
    termsAndConditions?: string[];
    notes?: string;
    hasCompanyGst?: boolean;
    companyGstNumber?: string;
    hasClientGst?: boolean;
    clientGstNumber?: string;
    rejectionReason?: string;
    actorId: string;
    actorName: string;
  }): Promise<{ quotation: Quotation; project: Project }> {
    return await dbStore.transaction(async (state) => {
      const project = state.projects.find(p => p.id === data.projectId);
      if (!project) throw new Error(`Project with ID ${data.projectId} not found`);

      // Cannot create or update quotation for closed or cancelled projects
      if (project.status === 'CLOSED' || project.status === 'CANCELLED') {
        throw new Error(`Cannot modify quotation for project in status ${project.status}`);
      }

      // If project is already INSTALLED, quotation cannot be reopened as Draft or Rejected
      if ((project.status === 'INSTALLED' || project.status === 'ACTIVE_RENTAL') && 
          (data.status === 'DRAFT' || data.status === 'REJECTED')) {
        throw new Error(`Project is already installed and commissioned. Quotation status cannot be changed to ${data.status}`);
      }

      const customer = state.customers.find(c => c.id === project.customerId);
      const site = state.sites.find(s => s.id === project.siteId);

      // Measurements & Total Area (Engineering Dimensions Formula - Single Source of Truth)
      const projectDims = extractProjectDimensions(project);
      const area = projectDims.elevationAreaSqFt > 0
        ? projectDims.elevationAreaSqFt
        : (data.totalAreaSqFt && data.totalAreaSqFt > 0 ? data.totalAreaSqFt : 1000);

      // Calculate complete pricing
      const pricing = this.calculatePricing({
        ratePerSqFt: data.ratePerSqFt !== undefined ? data.ratePerSqFt : 22,
        totalAreaSqFt: area,
        durationMonths: data.durationMonths || 1,
        rentalDurationDays: data.rentalDurationDays || 28,
        walkwayJaliIncludedQuantity: data.walkwayJaliIncludedQuantity || 0,
        extraJaliQuantity: data.extraJaliQuantity || 0,
        extraJaliRate: data.extraJaliRate || 200,
        transportCharges: data.transportCharges !== undefined ? data.transportCharges : (project.transportCharges || 4500),
        shiftingCharges: data.shiftingCharges || 0,
        otherCharges: data.otherCharges || 0,
        gstPercentage: data.gstPercentage !== undefined ? data.gstPercentage : (state.companySettings?.defaultGstRate || 18),
      });

      // Collect site images
      const siteImages = (project.photos || [])
        .filter(p => p.stageLabel === 'BEFORE_INSTALLATION' || !p.stageLabel)
        .map(p => p.fileUrl);

      // Find existing quotation or generate new
      let quotation = data.id 
        ? state.quotations.find(q => q.id === data.id) 
        : state.quotations.find(q => q.projectId === project.id);
      const isNew = !quotation;
      const quotationNumber = quotation?.quotationNumber || this.generateNextQuotationNumber(state.quotations);
      const quotationDate = data.quotationDate || quotation?.quotationDate || new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();

      if (!quotation) {
        const newQuotation: Quotation = {
          id: data.id || `qtn-${Date.now()}`,
          quotationNumber,
          projectId: project.id,
          projectCode: project.projectCode,
          customerId: project.customerId,
          customerName: project.customerName,
          customerPhone: customer?.phone,
          customerEmail: customer?.email,
          siteId: project.siteId,
          siteName: project.siteName,
          siteAddress: project.siteAddress,
          quotationDate,
          status: data.status,
          dimensions: project.measurements ? {
            width: projectDims.width,
            depth: projectDims.depth,
            height: projectDims.height,
            length: projectDims.width,
            unit: projectDims.unit,
            totalAreaSqFt: area,
            structureType: project.measurements.measurementType || 'FAÇADE_SCAFFOLD',
            description: projectDims.formattedDimensions,
          } : undefined,
          materials: data.materials,
          scaffoldingType: data.scaffoldingType || project.measurements?.measurementType || 'FAÇADE_SCAFFOLD',
          ...pricing,
          termsAndConditions: data.termsAndConditions || [],
          notes: data.notes,
          siteImages,
          hasCompanyGst: data.hasCompanyGst !== undefined ? data.hasCompanyGst : true,
          companyGstNumber: data.hasCompanyGst !== false 
            ? (data.companyGstNumber && data.companyGstNumber !== 'N/A' ? data.companyGstNumber.trim().toUpperCase() : (state.companySettings?.gstin || '23AABCA1234F1Z5')) 
            : 'N/A',
          hasClientGst: data.hasClientGst !== undefined 
            ? data.hasClientGst 
            : (project.hasClientGst !== undefined ? project.hasClientGst : Boolean(customer?.gstin && customer.gstin !== 'N/A')),
          clientGstNumber: data.hasClientGst !== false 
            ? (data.clientGstNumber && data.clientGstNumber !== 'N/A' ? data.clientGstNumber.trim().toUpperCase() : (project.clientGstNumber || customer?.gstin || 'N/A')) 
            : 'N/A',
          createdBy: data.actorId,
          createdByName: data.actorName,
          createdAt: now,
          updatedAt: now,
          sentAt: data.status === 'SENT' ? now : undefined,
          acceptedAt: data.status === 'ACCEPTED' ? now : undefined,
          rejectedAt: data.status === 'REJECTED' ? now : undefined,
          rejectionReason: data.rejectionReason,
          rejection_reason: data.rejectionReason,
          quotation_status: data.status,
          approval_status: data.status === 'ACCEPTED' ? 'ACCEPTED' : data.status === 'REJECTED' ? 'REJECTED' : 'PENDING_APPROVAL',
          approved_at: data.status === 'ACCEPTED' ? now : undefined,
          approved_by: data.status === 'ACCEPTED' ? data.actorId : undefined,
          approvedByName: data.status === 'ACCEPTED' ? data.actorName : undefined,
          rejected_at: data.status === 'REJECTED' ? now : undefined,
          rejected_by: data.status === 'REJECTED' ? data.actorId : undefined,
          rejectedByName: data.status === 'REJECTED' ? data.actorName : undefined,
          last_edited_by: data.actorId,
          lastEditedByName: data.actorName,
        };
        state.quotations.unshift(newQuotation);
        quotation = newQuotation;
      } else {
        // Update existing quotation
        quotation.quotationDate = quotationDate;
        quotation.status = data.status;
        quotation.quotation_status = data.status;
        quotation.materials = data.materials;
        quotation.scaffoldingType = data.scaffoldingType || quotation.scaffoldingType;
        quotation.termsAndConditions = data.termsAndConditions || quotation.termsAndConditions;
        quotation.notes = data.notes;
        quotation.siteImages = siteImages.length > 0 ? siteImages : quotation.siteImages;
        quotation.updatedBy = data.actorId;
        quotation.updatedByName = data.actorName;
        quotation.last_edited_by = data.actorId;
        quotation.lastEditedByName = data.actorName;
        quotation.updatedAt = now;

        if (data.hasCompanyGst !== undefined) {
          quotation.hasCompanyGst = data.hasCompanyGst;
          quotation.companyGstNumber = data.hasCompanyGst
            ? (data.companyGstNumber && data.companyGstNumber !== 'N/A' ? data.companyGstNumber.trim().toUpperCase() : (state.companySettings?.gstin || '23AABCA1234F1Z5'))
            : 'N/A';
        }
        if (data.hasClientGst !== undefined) {
          quotation.hasClientGst = data.hasClientGst;
          quotation.clientGstNumber = data.hasClientGst
            ? (data.clientGstNumber && data.clientGstNumber !== 'N/A' ? data.clientGstNumber.trim().toUpperCase() : (project.clientGstNumber || customer?.gstin || 'N/A'))
            : 'N/A';
        }

        if (quotation.dimensions) {
          quotation.dimensions.width = projectDims.width || quotation.dimensions.width;
          quotation.dimensions.depth = projectDims.depth || quotation.dimensions.depth;
          quotation.dimensions.height = projectDims.height || quotation.dimensions.height;
          quotation.dimensions.totalAreaSqFt = area;
          quotation.dimensions.description = projectDims.formattedDimensions;
        }

        // Apply updated pricing
        Object.assign(quotation, pricing);

        if (data.status === 'SENT') {
          quotation.sentAt = quotation.sentAt || now;
          quotation.approval_status = 'PENDING_APPROVAL';
        } else if (data.status === 'ACCEPTED') {
          quotation.acceptedAt = now;
          quotation.approval_status = 'ACCEPTED';
          quotation.approved_at = now;
          quotation.approved_by = data.actorId;
          quotation.approvedByName = data.actorName;
          quotation.rejected_at = undefined;
          quotation.rejected_by = undefined;
          quotation.rejection_reason = undefined;
          quotation.rejectionReason = undefined;
        } else if (data.status === 'REJECTED') {
          quotation.rejectedAt = now;
          quotation.rejected_at = now;
          quotation.rejected_by = data.actorId;
          quotation.rejectedByName = data.actorName;
          quotation.rejectionReason = data.rejectionReason;
          quotation.rejection_reason = data.rejectionReason;
          quotation.approval_status = 'REJECTED';
          quotation.approved_at = undefined;
          quotation.approved_by = undefined;
        } else {
          // If quotation was edited and re-saved as DRAFT, invalidate previous approval
          quotation.approval_status = 'PENDING_APPROVAL';
          quotation.approved_at = undefined;
          quotation.approved_by = undefined;
          quotation.approvedByName = undefined;
          quotation.rejected_at = undefined;
          quotation.rejected_by = undefined;
          quotation.rejectedByName = undefined;
          quotation.rejection_reason = undefined;
          quotation.rejectionReason = undefined;
        }
      }

      // Link Quotation metadata to Project
      project.quotationId = quotation.id;
      project.quotationNumber = quotation.quotationNumber;
      project.quotationDate = quotation.quotationDate;
      project.quotationAmount = quotation.grandTotal;
      project.quotationStatus = quotation.status;
      project.quotation_status = quotation.status;
      project.approval_status = quotation.approval_status;
      project.approved_at = quotation.approved_at;
      project.approved_by = quotation.approved_by;
      project.approvedByName = quotation.approvedByName;
      project.rejected_at = quotation.rejected_at;
      project.rejected_by = quotation.rejected_by;
      project.rejectedByName = quotation.rejectedByName;
      project.rejection_reason = quotation.rejection_reason;
      project.last_edited_by = quotation.last_edited_by;
      project.lastEditedByName = quotation.lastEditedByName;
      project.monthlyRentalRate = quotation.monthlyRentalAmount;
      project.agreedProjectPrice = quotation.grandTotal;
      project.ratePerSqFt = quotation.ratePerSqFt;
      project.totalAreaSqFt = quotation.totalAreaSqFt;
      project.transportCharges = quotation.transportCharges;
      project.extraJaliCharges = quotation.extraJaliCharges;
      project.shiftingCharges = quotation.shiftingCharges;
      project.advancePercentage = quotation.advancePercentage;
      project.advanceRequiredAmount = quotation.advanceAmount;
      project.completionDueAmount = quotation.remainingAmount;
      project.gstPercentage = quotation.gstPercentage;
      if (quotation.hasCompanyGst !== undefined) project.hasCompanyGst = quotation.hasCompanyGst;
      if (quotation.companyGstNumber !== undefined) project.companyGstNumber = quotation.companyGstNumber;
      if (quotation.hasClientGst !== undefined) project.hasClientGst = quotation.hasClientGst;
      if (quotation.clientGstNumber !== undefined) project.clientGstNumber = quotation.clientGstNumber;
      project.updatedAt = now;

      // Update Project Workflow Status based on quotation action
      let targetProjectStatus: ProjectStatus = project.status;
      if (data.status === 'DRAFT') {
        targetProjectStatus = 'QUOTATION_DRAFT';
      } else if (data.status === 'SENT') {
        targetProjectStatus = 'QUOTATION_SENT';
      } else if (data.status === 'ACCEPTED') {
        targetProjectStatus = 'QUOTATION_ACCEPTED';
      } else if (data.status === 'REJECTED') {
        targetProjectStatus = 'QUOTATION_REJECTED';
      } else if (data.status === 'CANCELLED') {
        targetProjectStatus = 'CANCELLED' as Project['status'];
      }
      // Only transition if not already confirmed or installed
      if (project.status === 'NOT_INSTALLED' || 
          project.status === 'SITE_CREATED' || 
          project.status === 'QUOTATION_DRAFT' || 
          project.status === 'QUOTATION_SENT' || 
          project.status === 'QUOTATION_ACCEPTED' || 
          project.status === 'QUOTATION_REJECTED') {
        project.status = targetProjectStatus;
      }

      // Activity Logging
      state.activityEvents.unshift({
        id: `act-${Date.now()}`,
        projectId: project.id,
        eventType: `QUOTATION_${data.status}`,
        eventTitle: `Quotation ${data.status.replace('_', ' ')}`,
        eventDescription: `Commercial quotation ${quotation.quotationNumber} (${quotation.status}) saved for ₹${quotation.grandTotal.toLocaleString('en-IN')}. By ${data.actorName}.`,
        actorId: data.actorId,
        actorName: data.actorName,
        metadata: {
          quotationId: quotation.id,
          quotationNumber: quotation.quotationNumber,
          grandTotal: quotation.grandTotal,
          status: quotation.status,
        },
        createdAt: now,
      });

      // Audit Log
      state.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        actorId: data.actorId,
        actorEmail: data.actorName,
        action: isNew ? 'CREATE_QUOTATION' : 'UPDATE_QUOTATION',
        entityTable: 'quotations',
        entityId: quotation.id,
        newState: quotation,
        createdAt: now,
      });

      return { quotation, project };
    });
  }

  /**
   * Update quotation status (e.g. Mark as Sent, Accepted, Rejected, Cancelled)
   */
  public static async updateStatus(params: {
    quotationId: string;
    status: QuotationStatus;
    reason?: string;
    actorId: string;
    actorName: string;
  }): Promise<{ quotation: Quotation; project: Project }> {
    return await dbStore.transaction(async (state) => {
      let quotation = state.quotations.find(q => q.id === params.quotationId || q.projectId === params.quotationId);
      if (!quotation) {
        const proj = state.projects.find(p => p.id === params.quotationId);
        if (proj && proj.quotationId) {
          quotation = state.quotations.find(q => q.id === proj.quotationId);
        }
      }
      if (!quotation) throw new Error(`Quotation ${params.quotationId} not found`);

      const project = state.projects.find(p => p.id === quotation.projectId || p.id === params.quotationId);
      if (!project) throw new Error(`Associated project ${quotation.projectId} not found`);

      if (project.status === 'INSTALLED' && (params.status === 'REJECTED' || params.status === 'DRAFT')) {
        throw new Error('Project is already installed. Quotation status cannot be changed to Draft or Rejected.');
      }

      if (params.status === 'REJECTED') {
        if (!params.reason || !params.reason.trim()) {
          throw new Error('Rejection reason is mandatory when rejecting a quotation.');
        }
      }

      const now = new Date().toISOString();
      quotation.status = params.status;
      quotation.quotation_status = params.status;
      quotation.updatedBy = params.actorId;
      quotation.updatedByName = params.actorName;
      quotation.updatedAt = now;

      if (params.status === 'ACCEPTED') {
        quotation.approval_status = 'ACCEPTED';
        quotation.approved_at = now;
        quotation.approved_by = params.actorId;
        quotation.approvedByName = params.actorName;
        quotation.acceptedAt = now;
        quotation.rejected_at = undefined;
        quotation.rejected_by = undefined;
        quotation.rejectedByName = undefined;
        quotation.rejection_reason = undefined;
        quotation.rejectionReason = undefined;
      } else if (params.status === 'REJECTED') {
        const cleanReason = params.reason!.trim();
        quotation.approval_status = 'REJECTED';
        quotation.rejected_at = now;
        quotation.rejected_by = params.actorId;
        quotation.rejectedByName = params.actorName;
        quotation.rejectedAt = now;
        quotation.rejection_reason = cleanReason;
        quotation.rejectionReason = cleanReason;
        quotation.approved_at = undefined;
        quotation.approved_by = undefined;
        quotation.approvedByName = undefined;
        quotation.acceptedAt = undefined;
      } else if (params.status === 'SENT') {
        quotation.approval_status = 'PENDING_APPROVAL';
        quotation.sentAt = quotation.sentAt || now;
      } else {
        quotation.approval_status = 'PENDING_APPROVAL';
        quotation.approved_at = undefined;
        quotation.approved_by = undefined;
        quotation.approvedByName = undefined;
        quotation.rejected_at = undefined;
        quotation.rejected_by = undefined;
        quotation.rejectedByName = undefined;
        quotation.rejection_reason = undefined;
        quotation.rejectionReason = undefined;
      }

      // Synchronize project
      project.quotationStatus = quotation.status;
      project.quotation_status = quotation.status;
      project.approval_status = quotation.approval_status;
      project.approved_at = quotation.approved_at;
      project.approved_by = quotation.approved_by;
      project.approvedByName = quotation.approvedByName;
      project.rejected_at = quotation.rejected_at;
      project.rejected_by = quotation.rejected_by;
      project.rejectedByName = quotation.rejectedByName;
      project.rejection_reason = quotation.rejection_reason;
      project.updatedAt = now;

      if (project.status === 'NOT_INSTALLED' || 
          project.status === 'SITE_CREATED' || 
          project.status.startsWith('QUOTATION_')) {
        if (params.status === 'DRAFT') project.status = 'QUOTATION_DRAFT';
        else if (params.status === 'SENT') project.status = 'QUOTATION_SENT';
        else if (params.status === 'ACCEPTED') project.status = 'QUOTATION_ACCEPTED';
        else if (params.status === 'REJECTED') project.status = 'QUOTATION_REJECTED';
        else if (params.status === 'CANCELLED') project.status = 'CANCELLED';
      }

      state.activityEvents.unshift({
        id: `act-${Date.now()}`,
        projectId: project.id,
        eventType: `QUOTATION_STATUS_${params.status}`,
        eventTitle: `Quotation Marked as ${params.status}`,
        eventDescription: `Quotation ${quotation.quotationNumber} marked as ${params.status} by ${params.actorName}.${params.reason ? ` Reason: ${params.reason}` : ''}`,
        actorId: params.actorId,
        actorName: params.actorName,
        createdAt: now,
      });

      state.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        actorId: params.actorId,
        actorEmail: params.actorName,
        action: 'UPDATE_QUOTATION_STATUS',
        entityTable: 'quotations',
        entityId: quotation.id,
        newState: quotation,
        createdAt: now,
      });

      return { quotation, project };
    });
  }
}

