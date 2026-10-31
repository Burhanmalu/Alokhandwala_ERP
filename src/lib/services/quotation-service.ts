// ALOKHANDWALA - Quotation Lifecycle & Commercial Pricing Engine

import { dbStore } from '../db/store';
import { Quotation, QuotationStatus, QuotationMaterialItem, Project, ProjectStatus } from '../schema';

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
    const ratePerSqFt = Math.max(0, Number(input.ratePerSqFt) || 0);
    const totalAreaSqFt = Math.max(0, Number(input.totalAreaSqFt) || 0);
    const durationMonths = Math.max(1, Number(input.durationMonths) || 1);
    const rentalDurationDays = input.rentalDurationDays || (durationMonths * 28);
    
    // Monthly rental amount = Area * Rate per sq.ft. * Months
    const monthlyRentalAmount = Math.round(totalAreaSqFt * ratePerSqFt * durationMonths * 100) / 100;

    // Walkway Jali charges
    const walkwayJaliIncludedQuantity = Math.max(0, Number(input.walkwayJaliIncludedQuantity) || 0);
    const extraJaliQuantity = Math.max(0, Number(input.extraJaliQuantity) || 0);
    const extraJaliRate = input.extraJaliRate !== undefined ? Number(input.extraJaliRate) : 200;
    const extraJaliCharges = extraJaliQuantity * extraJaliRate;

    // Transport & Other Charges
    const transportCharges = Math.max(0, Number(input.transportCharges) || 0);
    const shiftingCharges = Math.max(0, Number(input.shiftingCharges) || 0);
    const otherCharges = Math.max(0, Number(input.otherCharges) || 0);

    // Subtotal
    const subtotal = Math.round((monthlyRentalAmount + extraJaliCharges + transportCharges + shiftingCharges + otherCharges) * 100) / 100;

    // GST
    const gstPercentage = input.gstPercentage !== undefined ? Number(input.gstPercentage) : 18;
    const gstAmount = Math.round((subtotal * (gstPercentage / 100)) * 100) / 100;

    // Grand Total
    const grandTotal = Math.round((subtotal + gstAmount) * 100) / 100;

    // Payment Schedule (75% Advance, 25% Completion Due)
    const advancePercentage = 75;
    const advanceAmount = Math.round((grandTotal * 0.75) * 100) / 100;
    const remainingAmount = Math.round((grandTotal - advanceAmount) * 100) / 100;

    return {
      ratePerSqFt,
      totalAreaSqFt,
      rentalDurationDays,
      durationMonths,
      monthlyRentalAmount,
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
      remainingAmount,
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
    let length = meas?.length || 20;
    let width = meas?.width || 5;
    let height = meas?.height || 20;
    const unit = meas?.unit || 'FEET';

    // Convert to feet if in meters
    if (unit === 'METERS') {
      length = Math.round(length * 3.28084 * 10) / 10;
      width = Math.round(width * 3.28084 * 10) / 10;
      height = Math.round(height * 3.28084 * 10) / 10;
    }

    const totalAreaSqFt = Math.round(length * height);

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
    transportCharges?: number;
    shiftingCharges?: number;
    otherCharges?: number;
    gstPercentage?: number;
    materials: QuotationMaterialItem[];
    scaffoldingType?: string;
    termsAndConditions?: string[];
    notes?: string;
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

      // Measurements & Total Area
      let area = data.totalAreaSqFt;
      if (!area || area <= 0) {
        if (project.measurements?.length && project.measurements?.height) {
          let l = project.measurements.length;
          let h = project.measurements.height;
          if (project.measurements.unit === 'METERS') {
            l *= 3.28084;
            h *= 3.28084;
          }
          area = Math.round(l * h);
        } else {
          area = 500;
        }
      }

      // Calculate complete pricing
      const pricing = this.calculatePricing({
        ratePerSqFt: data.ratePerSqFt,
        totalAreaSqFt: area,
        durationMonths: data.durationMonths || 1,
        rentalDurationDays: data.rentalDurationDays || 28,
        walkwayJaliIncludedQuantity: data.walkwayJaliIncludedQuantity || 0,
        extraJaliQuantity: data.extraJaliQuantity || 0,
        transportCharges: data.transportCharges || 0,
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
            length: project.measurements.length,
            width: project.measurements.width,
            height: project.measurements.height,
            unit: project.measurements.unit,
            totalAreaSqFt: area,
            structureType: project.measurements.measurementType,
            description: project.measurements.description,
          } : undefined,
          materials: data.materials,
          scaffoldingType: data.scaffoldingType || project.measurements?.measurementType || 'FAÇADE_SCAFFOLD',
          ...pricing,
          termsAndConditions: data.termsAndConditions || [],
          notes: data.notes,
          siteImages,
          createdBy: data.actorId,
          createdByName: data.actorName,
          createdAt: now,
          updatedAt: now,
          sentAt: data.status === 'SENT' ? now : undefined,
          acceptedAt: data.status === 'ACCEPTED' ? now : undefined,
          rejectedAt: data.status === 'REJECTED' ? now : undefined,
          rejectionReason: data.rejectionReason,
        };
        state.quotations.unshift(newQuotation);
        quotation = newQuotation;
      } else {
        // Update existing quotation
        quotation.quotationDate = quotationDate;
        quotation.status = data.status;
        quotation.materials = data.materials;
        quotation.scaffoldingType = data.scaffoldingType || quotation.scaffoldingType;
        quotation.termsAndConditions = data.termsAndConditions || quotation.termsAndConditions;
        quotation.notes = data.notes;
        quotation.siteImages = siteImages.length > 0 ? siteImages : quotation.siteImages;
        quotation.updatedBy = data.actorId;
        quotation.updatedByName = data.actorName;
        quotation.updatedAt = now;

        // Apply updated pricing
        Object.assign(quotation, pricing);

        if (data.status === 'SENT' && !quotation.sentAt) {
          quotation.sentAt = now;
        }
        if (data.status === 'ACCEPTED') {
          quotation.acceptedAt = now;
        }
        if (data.status === 'REJECTED') {
          quotation.rejectedAt = now;
          quotation.rejectionReason = data.rejectionReason;
        }
      }

      // Link Quotation metadata to Project
      project.quotationId = quotation.id;
      project.quotationNumber = quotation.quotationNumber;
      project.quotationDate = quotation.quotationDate;
      project.quotationAmount = quotation.grandTotal;
      project.quotationStatus = quotation.status;
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
      const quotation = state.quotations.find(q => q.id === params.quotationId);
      if (!quotation) throw new Error(`Quotation ${params.quotationId} not found`);

      const project = state.projects.find(p => p.id === quotation.projectId);
      if (!project) throw new Error(`Associated project ${quotation.projectId} not found`);

      if (project.status === 'INSTALLED' && (params.status === 'REJECTED' || params.status === 'DRAFT')) {
        throw new Error('Project is already installed. Quotation status cannot be changed to Draft or Rejected.');
      }

      const now = new Date().toISOString();
      quotation.status = params.status;
      quotation.updatedBy = params.actorId;
      quotation.updatedByName = params.actorName;
      quotation.updatedAt = now;

      if (params.status === 'SENT') {
        quotation.sentAt = now;
      } else if (params.status === 'ACCEPTED') {
        quotation.acceptedAt = now;
      } else if (params.status === 'REJECTED') {
        quotation.rejectedAt = now;
        quotation.rejectionReason = params.reason;
      }

      // Synchronize project
      project.quotationStatus = quotation.status;
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

