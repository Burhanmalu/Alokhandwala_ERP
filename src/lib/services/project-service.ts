// ALOKHANDWALA - Project Lifecycle & State Machine Service

import { dbStore } from '../db/store';
import { Project, ProjectStatus, SiteMeasurement, FileAttachment, InventoryTransaction } from '../schema';
import { calculateScaffoldingArea, calculateRentalDurationBreakdown, computeCustomerStatsFromProjects } from '../formatters';
import { ReminderService } from './reminder-service';

export const VALID_STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  SITE_CREATED: ['QUOTATION_DRAFT', 'QUOTATION_SENT', 'NOT_INSTALLED', 'CONFIRMED_PROJECT', 'CANCELLED'],
  NOT_INSTALLED: ['QUOTATION_DRAFT', 'QUOTATION_SENT', 'QUOTATION_ACCEPTED', 'CONFIRMED_PROJECT', 'CANCELLED'],
  QUOTATION_DRAFT: ['QUOTATION_SENT', 'QUOTATION_ACCEPTED', 'CONFIRMED_PROJECT', 'QUOTATION_REJECTED', 'CANCELLED'],
  QUOTATION_SENT: ['QUOTATION_ACCEPTED', 'CONFIRMED_PROJECT', 'QUOTATION_REJECTED', 'QUOTATION_DRAFT', 'CANCELLED'],
  QUOTATION_ACCEPTED: ['CONFIRMED_PROJECT', 'QUOTATION_DRAFT', 'CANCELLED'],
  QUOTATION_REJECTED: ['QUOTATION_DRAFT', 'CANCELLED'],
  CONFIRMED_PROJECT: ['SCHEDULED', 'INSTALLED', 'ACTIVE_RENTAL', 'CANCELLED', 'NOT_INSTALLED', 'QUOTATION_ACCEPTED'],
  SCHEDULED: ['INSTALLED', 'ACTIVE_RENTAL', 'CONFIRMED_PROJECT', 'CANCELLED'],
  INSTALLED: ['ACTIVE_RENTAL', 'BUFFER_PERIOD', 'EXTENSION_REQUESTED', 'EXTENDED', 'SHIFTING_PENDING', 'REMOVAL_PENDING'],
  ACTIVE_RENTAL: ['BUFFER_PERIOD', 'EXTENSION_REQUESTED', 'EXTENDED', 'SHIFTING_PENDING', 'REMOVAL_PENDING'],
  BUFFER_PERIOD: ['REMOVAL_PENDING', 'EXTENSION_REQUESTED', 'EXTENDED'],
  EXTENSION_REQUESTED: ['ACTIVE_RENTAL', 'EXTENDED'],
  EXTENDED: ['BUFFER_PERIOD', 'SHIFTING_PENDING', 'REMOVAL_PENDING', 'EXTENSION_REQUESTED'],
  SHIFTING_PENDING: ['SHIFTING_IN_PROGRESS', 'ACTIVE_RENTAL', 'EXTENDED'],
  SHIFTING_IN_PROGRESS: ['ACTIVE_RENTAL', 'EXTENDED'],
  REMOVAL_PENDING: ['RETURNED_RECONCILIATION'],
  RETURNED_RECONCILIATION: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

export class ProjectService {
  /**
   * Validate if a status transition is permitted by the state machine
   */
  public static canTransition(currentStatus: ProjectStatus, targetStatus: ProjectStatus): boolean {
    const allowed = VALID_STATUS_TRANSITIONS[currentStatus];
    return allowed ? allowed.includes(targetStatus) : false;
  }

  /**
   * Generate next sequential human-readable Project Code (e.g. AW-SCF-000005)
   */
  public static generateNextProjectCode(existingProjects: Project[]): string {
    const maxNumber = existingProjects.reduce((max, p) => {
      const match = p.projectCode.match(/AW-SCF-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 0);

    const nextNum = maxNumber + 1;
    return `AW-SCF-${nextNum.toString().padStart(6, '0')}`;
  }

  /**
   * Create a new project from site inspection
   */
  public static async createProjectFromInspection(data: {
    customerId?: string;
    customerName?: string;
    referralName?: string;
    siteId?: string;
    siteName: string;
    siteAddress: string;
    latitude?: number;
    longitude?: number;
    locationType?: 'ON_SITE' | 'NOT_ON_SITE';
    locationAccuracyMeters?: number;
    houseNumber?: string;
    street?: string;
    locality?: string;
    pincode?: string;
    isLocationConfirmed?: boolean;
    landmark?: string;
    city?: string;
    state?: string;
    contactPerson?: string;
    contactPhone?: string;
    hasClientGst?: boolean;
    clientGstNumber?: string;
    hasCompanyGst?: boolean;
    companyGstNumber?: string;
    assignedSupervisorId?: string;
    supervisorName?: string;
    measurements: {
      width: number;
      depth?: number;
      height: number;
      length?: number;
      unit: 'METERS' | 'FEET';
      measurementType?: 'FAÇADE_SCAFFOLD' | 'TOWER_SCAFFOLD' | 'CUP_LOCK_SYSTEM' | 'HEAVY_DUTY_SHORING' | 'SUSPENDED_CRADLE';
      description?: string;
    };
    siteRemarks?: string;
    photoUrls?: string[];
    actorId: string;
    actorName: string;
  }): Promise<Project> {
    return await dbStore.transaction(async (state) => {
      const resolvedHasClientGst = Boolean(data.hasClientGst);
      const resolvedClientGstNumber = resolvedHasClientGst && data.clientGstNumber && data.clientGstNumber !== 'N/A'
        ? data.clientGstNumber.trim().toUpperCase()
        : 'N/A';

      let customer = data.customerId ? state.customers.find(c => c.id === data.customerId) : undefined;
      if (!customer && data.customerName) {
        customer = state.customers.find(c => c.companyName.toLowerCase() === data.customerName?.trim().toLowerCase());
        if (!customer) {
          const nextCustNum = state.customers.length + 1;
          customer = {
            id: `cust-${Date.now()}`,
            customerCode: `CUST-${nextCustNum.toString().padStart(4, '0')}`,
            companyName: data.customerName.trim(),
            referenceName: data.referralName?.trim() || undefined,
            contactPerson: data.contactPerson?.trim() || data.customerName.trim(),
            phone: data.contactPhone?.trim() || '9820000000',
            email: '',
            billingAddress: data.siteAddress.trim(),
            city: data.city || 'Indore',
            state: data.state || 'Madhya Pradesh',
            gstin: resolvedHasClientGst && resolvedClientGstNumber !== 'N/A' ? resolvedClientGstNumber : undefined,
            status: 'ACTIVE',
            creditLimit: 500000,
            outstandingBalance: 0,
            sitesCount: 0,
            projectsCount: 0,
            activeRentalsCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          state.customers.push(customer);
        }
      }
      if (!customer) {
        customer = state.customers[0];
      }
      if (resolvedHasClientGst && resolvedClientGstNumber !== 'N/A' && !customer.gstin) {
        customer.gstin = resolvedClientGstNumber;
      }
      if (data.referralName && !customer.referenceName) {
        customer.referenceName = data.referralName.trim();
      }

      let supervisor = data.assignedSupervisorId ? state.users.find(u => u.id === data.assignedSupervisorId) : undefined;
      if (!supervisor && data.supervisorName) {
        supervisor = state.users.find(u => u.fullName.toLowerCase().includes(data.supervisorName!.toLowerCase()));
      }
      if (!supervisor) {
        supervisor = state.users.find(u => u.role === 'SUPERVISOR') || state.users[0];
      }

      // Create or use site
      let site = state.sites.find(s => s.id === data.siteId);
      if (!site) {
        const nextSiteNum = state.sites.length + 1;
        site = {
          id: `site-${Date.now()}`,
          siteCode: `SITE-${nextSiteNum.toString().padStart(4, '0')}`,
          customerId: customer.id,
          customerName: customer.companyName,
          siteName: data.siteName,
          siteAddress: data.siteAddress,
          latitude: data.latitude,
          longitude: data.longitude,
          locationType: data.locationType,
          locationAccuracyMeters: data.locationAccuracyMeters,
          houseNumber: data.houseNumber,
          street: data.street,
          locality: data.locality,
          pincode: data.pincode,
          isLocationConfirmed: data.isLocationConfirmed !== undefined ? data.isLocationConfirmed : true,
          referralName: data.referralName || customer.referenceName,
          landmark: data.landmark,
          city: data.city || 'Indore',
          state: data.state || 'Madhya Pradesh',
          contactPerson: data.contactPerson || customer.contactPerson,
          contactPhone: data.contactPhone || customer.phone,
          assignedSupervisorId: supervisor.id,
          supervisorName: supervisor.fullName,
          hasClientGst: resolvedHasClientGst,
          clientGstNumber: resolvedClientGstNumber,
          gstin: resolvedClientGstNumber,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        };
        state.sites.push(site);
        customer.sitesCount = (customer.sitesCount || 0) + 1;
      }

      const projectCode = this.generateNextProjectCode(state.projects);
      const projectId = `proj-${Date.now()}`;

      const mWidth = data.measurements.width || data.measurements.length || 0;
      const mDepth = data.measurements.depth !== undefined ? data.measurements.depth : 3;
      const mHeight = data.measurements.height || 0;
      const mLength = data.measurements.length !== undefined ? data.measurements.length : mWidth;
      const areaSqFt = calculateScaffoldingArea(mWidth, mDepth, mHeight, data.measurements.unit);

      const measurementRecord: SiteMeasurement = {
        id: `meas-${Date.now()}`,
        siteId: site.id,
        projectId: projectId,
        width: mWidth,
        depth: mDepth,
        height: mHeight,
        length: mLength,
        unit: data.measurements.unit,
        elevationAreaSqFt: areaSqFt,
        measurementType: data.measurements.measurementType || 'FAÇADE_SCAFFOLD',
        description: data.measurements.description,
        measuredBy: supervisor.fullName,
        measuredAt: new Date().toISOString(),
      };

      const photos: FileAttachment[] = (data.photoUrls || []).map((url, idx) => ({
        id: `pht-${Date.now()}-${idx}`,
        entityType: 'SITE_INSPECTION',
        entityId: projectId,
        fileName: `site_inspection_${idx + 1}.jpg`,
        fileUrl: url,
        fileSizeBytes: 2048000,
        mimeType: 'image/jpeg',
        stageLabel: 'BEFORE_INSTALLATION',
        uploadedBy: supervisor.id,
        uploaderName: supervisor.fullName,
        createdAt: new Date().toISOString(),
      }));

      const newProject: Project = {
        id: projectId,
        projectCode,
        customerId: customer.id,
        customerName: customer.companyName,
        siteId: site.id,
        siteName: site.siteName,
        siteAddress: site.siteAddress,
        latitude: data.latitude,
        longitude: data.longitude,
        locationType: data.locationType,
        locationAccuracyMeters: data.locationAccuracyMeters,
        houseNumber: data.houseNumber,
        street: data.street,
        locality: data.locality,
        pincode: data.pincode,
        isLocationConfirmed: data.isLocationConfirmed !== undefined ? data.isLocationConfirmed : true,
        referralName: data.referralName || customer.referenceName,
        assignedSupervisorId: supervisor.id,
        supervisorName: supervisor.fullName,
        hasClientGst: resolvedHasClientGst,
        clientGstNumber: resolvedClientGstNumber,
        hasCompanyGst: data.hasCompanyGst !== undefined ? Boolean(data.hasCompanyGst) : true,
        companyGstNumber: data.hasCompanyGst !== false ? (data.companyGstNumber || state.companySettings?.gstin || undefined) : undefined,
        status: 'NOT_INSTALLED',
        totalAreaSqFt: areaSqFt,
        elevationAreaSqFt: areaSqFt,
        pricingModel: 'MONTHLY_RENTAL',
        monthlyRentalRate: 0,
        agreedProjectPrice: 0,
        depositAmount: 0,
        transportCharges: 0,
        installationLabourCharges: 0,
        shiftingCharges: 0,
        dismantlingLabourCharges: 0,
        gstPercentage: state.companySettings.defaultGstRate || 18,
        siteRemarks: data.siteRemarks,
        measurements: measurementRecord,
        photos: photos,
        materials: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      state.projects.unshift(newProject);
      customer.projectsCount = (customer.projectsCount || 0) + 1;
      ReminderService.syncProjectReminderInState(state, newProject);
      ReminderService.syncProjectRentalExpiryInState(state, newProject);

      // Activity log
      state.activityEvents.push({
        id: `act-${Date.now()}`,
        projectId: projectId,
        eventType: 'INSPECTION_SUBMITTED',
        eventTitle: 'Site Inspection Submitted',
        eventDescription: `Inspection completed by ${supervisor.fullName} with dimensions ${data.measurements.length}m x ${data.measurements.width}m x ${data.measurements.height}m. Project set to NOT_INSTALLED.`,
        actorId: data.actorId,
        actorName: data.actorName,
        createdAt: new Date().toISOString(),
      });

      // Notification to Admin
      state.notifications.unshift({
        id: `notif-${Date.now()}`,
        roleTarget: 'ADMIN',
        title: `New Project Inspection: ${projectCode}`,
        message: `${customer.companyName} - ${site.siteName} has been inspected and awaits confirmation.`,
        type: 'INFO',
        entityType: 'PROJECT',
        entityId: projectId,
        isRead: false,
        createdAt: new Date().toISOString(),
      });

      // System audit
      state.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        actorId: data.actorId,
        actorEmail: data.actorName,
        action: 'CREATE_PROJECT',
        entityTable: 'projects',
        entityId: projectId,
        newState: newProject,
        createdAt: new Date().toISOString(),
      });

      return newProject;
    });
  }

  /**
   * Transition project status with validation, history tracking, and audit
   */
  public static async transitionStatus(
    projectId: string,
    targetStatus: ProjectStatus,
    reason: string,
    actorId: string,
    actorName: string
  ): Promise<Project> {
    return await dbStore.transaction(async (state) => {
      const project = state.projects.find(p => p.id === projectId);
      if (!project) throw new Error('Project not found');

      if (!this.canTransition(project.status, targetStatus)) {
        throw new Error(`Invalid status transition from ${project.status} to ${targetStatus}`);
      }

      const oldStatus = project.status;
      project.status = targetStatus;
      project.updatedAt = new Date().toISOString();

      if (targetStatus === 'CLOSED') {
        project.closureDate = new Date().toISOString();
      } else if (targetStatus === 'CANCELLED') {
        project.cancellationReason = reason;
      }

      // Record Activity
      state.activityEvents.unshift({
        id: `act-${Date.now()}`,
        projectId: project.id,
        eventType: 'STATUS_CHANGED',
        eventTitle: `Status Changed to ${targetStatus}`,
        eventDescription: `Project status updated from ${oldStatus} to ${targetStatus}. Reason: ${reason || 'Operational progression'}`,
        actorId,
        actorName,
        metadata: { from: oldStatus, to: targetStatus, reason },
        createdAt: new Date().toISOString(),
      });

      // Audit Log
      state.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        actorId,
        actorEmail: actorName,
        action: 'PROJECT_STATUS_TRANSITION',
        entityTable: 'projects',
        entityId: project.id,
        oldState: { status: oldStatus },
        newState: { status: targetStatus, reason },
        createdAt: new Date().toISOString(),
      });

      ReminderService.syncProjectReminderInState(state, project);
      ReminderService.syncProjectRentalExpiryInState(state, project);

      return project;
    });
  }

  /**
   * Cancel Project in Pre-installation Stage
   * - Enforces pre-installation only (cannot cancel installed or active rentals)
   * - Requires mandatory cancellation reason
   * - Releases active reserved warehouse materials atomically
   * - Updates project status to CANCELLED and records cancellation metadata
   * - Cancels linked quotations
   * - Creates inventory transaction and audit records
   */
  public static async cancelProject(data: {
    projectId: string;
    reason: string;
    actorId: string;
    actorName: string;
  }): Promise<{ project: Project; releasedMaterialsCount: number; transaction?: InventoryTransaction }> {
    return await dbStore.transaction(async (state) => {
      const project = state.projects.find(p => p.id === data.projectId);
      if (!project) throw new Error(`Project with ID ${data.projectId} not found.`);

      if (project.status === 'CANCELLED') {
        throw new Error('Project is already cancelled.');
      }

      if (!data.reason || !data.reason.trim()) {
        throw new Error('Cancellation reason is mandatory.');
      }

      const PRE_INSTALLATION_STATUSES: ProjectStatus[] = [
        'SITE_CREATED',
        'NOT_INSTALLED',
        'QUOTATION_DRAFT',
        'QUOTATION_SENT',
        'QUOTATION_ACCEPTED',
        'QUOTATION_REJECTED',
        'CONFIRMED_PROJECT',
        'SCHEDULED',
      ];

      // Restrict cancellation if installation has started or completed
      if (!PRE_INSTALLATION_STATUSES.includes(project.status) || project.actualInstallationDate) {
        throw new Error(
          `Cannot cancel project in status '${project.status}'. Cancellation is strictly prohibited once installation has commenced or been commissioned on site.`
        );
      }

      // Release active reserved materials
      let releasedCount = 0;
      const txnLines: InventoryTransaction['lines'] = [];

      if (project.materials && project.materials.length > 0) {
        for (const projMat of project.materials) {
          const reserved = projMat.reservedQuantity || 0;
          if (reserved > 0) {
            const material = state.materials.find(m => m.id === projMat.materialId);
            if (material) {
              material.reservedQty = Math.max(0, (material.reservedQty || 0) - reserved);
              material.availableToAllocate = Math.max(0, (material.usableWarehouseQty || 0) - material.reservedQty);
            }
            txnLines.push({
              materialId: projMat.materialId,
              materialName: projMat.materialName,
              itemCode: projMat.itemCode,
              quantity: reserved,
              condition: 'GOOD',
              remarks: `Released upon project cancellation: ${project.projectCode}`,
            });
            releasedCount += reserved;
            projMat.reservedQuantity = 0; // Prevent duplicate stock releases
          }
        }
      }

      let transaction: InventoryTransaction | undefined = undefined;
      const cancelTimestamp = new Date().toISOString();

      if (txnLines.length > 0) {
        const year = new Date().getFullYear();
        const count = state.transactions.length + 1;
        const txnNumber = `TXN-${year}-${count.toString().padStart(6, '0')}`;
        transaction = {
          id: `txn-${Date.now()}`,
          transactionNumber: txnNumber,
          movementType: 'RESERVATION_RELEASE',
          sourceLocation: project.siteName || 'Site Location',
          destinationLocation: 'Indore Central Scaffolding Yard',
          projectId: project.id,
          projectCode: project.projectCode,
          referenceDocument: project.quotationNumber || 'CANCELLATION',
          actorId: data.actorId,
          actorName: data.actorName,
          remarks: `Cancellation stock release: ${data.reason.trim()}`,
          lines: txnLines,
          createdAt: cancelTimestamp,
        };
        state.transactions.unshift(transaction);
      }

      // Cancel linked quotations if any
      const linkedQuotes = state.quotations.filter(q => q.projectId === project.id);
      for (const q of linkedQuotes) {
        if (q.status !== 'CANCELLED') {
          q.status = 'CANCELLED';
          q.updatedAt = cancelTimestamp;
          q.updatedBy = data.actorId;
          q.updatedByName = data.actorName;
        }
      }

      const oldStatus = project.status;
      project.status = 'CANCELLED';
      project.cancellationReason = data.reason.trim();
      project.cancelledAt = cancelTimestamp;
      project.cancelledBy = data.actorId;
      project.cancelledByName = data.actorName;
      project.updatedAt = cancelTimestamp;

      // Activity Event
      state.activityEvents.unshift({
        id: `act-${Date.now()}`,
        projectId: project.id,
        eventType: 'STATUS_CHANGED',
        eventTitle: 'Project Cancelled (Pre-installation)',
        eventDescription: `Project cancelled by ${data.actorName}. Reason: ${data.reason.trim()}.${releasedCount > 0 ? ` Automatically released ${releasedCount} reserved scaffolding items back to warehouse stock.` : ''}`,
        actorId: data.actorId,
        actorName: data.actorName,
        metadata: { from: oldStatus, to: 'CANCELLED', reason: data.reason.trim(), releasedCount },
        createdAt: cancelTimestamp,
      });

      // Audit Log
      state.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        actorId: data.actorId,
        actorEmail: data.actorName,
        action: 'PROJECT_CANCELLED',
        entityTable: 'projects',
        entityId: project.id,
        oldState: { status: oldStatus },
        newState: { status: 'CANCELLED', reason: data.reason.trim(), cancelledAt: cancelTimestamp, releasedCount },
        createdAt: cancelTimestamp,
      });

      return { project, releasedMaterialsCount: releasedCount, transaction };
    });
  }

  /**
   * Create a new project directly from Project Directory (+ Add Project form)
   */
  public static async createDirectProject(data: {
    customerId?: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    siteId?: string;
    siteName: string;
    siteAddress: string;
    assignedSupervisorId: string;
    supervisorName?: string;
    staffIds?: string[];
    staffNames?: string[];
    width?: number;
    depth?: number;
    height?: number;
    unit?: 'FEET' | 'METERS';
    scaffoldingType?: string;
    actualDismantlingDate?: string;
    monthlyRentalRate?: number;
    status: ProjectStatus;
    rentalMode?: 'BY_MONTH' | 'BY_DATE';
    installationDate?: string;
    removalDate?: string;
    totalAmount: number;
    paymentReceived: number;
    remark?: string;
    followUpDate?: string;
    followUpNotes?: string;
    actorId: string;
    actorName: string;
  }): Promise<Project> {
    return await dbStore.transaction(async (state) => {
      const totalAmount = Math.max(0, Number(data.totalAmount) || 0);
      const paymentReceived = Math.max(0, Number(data.paymentReceived) || 0);
      if (paymentReceived > totalAmount) {
        throw new Error('Payment Received cannot exceed Total Amount.');
      }
      const balanceAmount = Math.round((totalAmount - paymentReceived) * 100) / 100;

      // Compute Rental Duration automatically from Installation & Removal dates
      const rentalDuration = calculateRentalDurationBreakdown(data.installationDate, data.removalDate);
      if (rentalDuration.isInvalid) {
        throw new Error('Date of Removal cannot be earlier than Date of Installation.');
      }

      // Compute Site Dimensions & Elevation Area via single source of truth formula
      const dimWidth = Math.max(0, Number(data.width) || 0);
      const dimDepth = Math.max(0, Number(data.depth) || 0);
      const dimHeight = Math.max(0, Number(data.height) || 0);
      const dimUnit: 'FEET' | 'METERS' = data.unit === 'METERS' ? 'METERS' : 'FEET';
      const elevationAreaSqFt = (dimWidth > 0 && dimHeight > 0 && dimDepth > 0)
        ? calculateScaffoldingArea(dimWidth, dimDepth, dimHeight, dimUnit)
        : 0;

      // Resolve or create Customer without duplicating existing records
      let customer = data.customerId ? state.customers.find(c => c.id === data.customerId) : undefined;
      if (!customer) {
        customer = state.customers.find(
          c => c.companyName.toLowerCase().trim() === data.customerName.toLowerCase().trim()
        );
      }
      const now = new Date().toISOString();
      if (!customer) {
        const nextCustNum = state.customers.length + 1;
        customer = {
          id: `cust-${Date.now()}`,
          customerCode: `CUST-${nextCustNum.toString().padStart(4, '0')}`,
          companyName: data.customerName.trim(),
          contactPerson: data.customerName.trim(),
          phone: data.customerPhone?.trim() || '9820000000',
          email: data.customerEmail?.trim() || '',
          billingAddress: data.siteAddress.trim(),
          city: 'Indore',
          state: 'Madhya Pradesh',
          status: 'ACTIVE',
          creditLimit: 500000,
          outstandingBalance: balanceAmount,
          sitesCount: 0,
          projectsCount: 0,
          activeRentalsCount: 0,
          createdAt: now,
          updatedAt: now,
        };
        state.customers.push(customer);
      } else {
        if (data.customerPhone && !customer.phone) customer.phone = data.customerPhone.trim();
        if (data.customerEmail && !customer.email) customer.email = data.customerEmail.trim();
        customer.outstandingBalance = Math.round(((customer.outstandingBalance || 0) + balanceAmount) * 100) / 100;
        customer.updatedAt = now;
      }

      // Resolve or create Site
      let site = data.siteId ? state.sites.find(s => s.id === data.siteId) : undefined;
      const supervisor =
        state.users.find(u => u.id === data.assignedSupervisorId) ||
        state.users.find(u => u.role === 'SUPERVISOR') ||
        state.users[0];

      if (!site) {
        site = state.sites.find(
          s => s.customerId === customer!.id && s.siteName.toLowerCase().trim() === data.siteName.toLowerCase().trim()
        );
      }
      if (!site) {
        const nextSiteNum = state.sites.length + 1;
        site = {
          id: `site-${Date.now()}`,
          siteCode: `SITE-${nextSiteNum.toString().padStart(4, '0')}`,
          customerId: customer.id,
          customerName: customer.companyName,
          siteName: data.siteName.trim(),
          siteAddress: data.siteAddress.trim(),
          city: 'Indore',
          state: 'Madhya Pradesh',
          contactPerson: customer.contactPerson,
          contactPhone: data.customerPhone?.trim() || customer.phone,
          assignedSupervisorId: supervisor?.id || data.assignedSupervisorId,
          supervisorName: data.supervisorName?.trim() || supervisor?.fullName || 'Supervisor',
          status: 'ACTIVE',
          createdAt: now,
        };
        state.sites.push(site);
        customer.sitesCount = (customer.sitesCount || 0) + 1;
      }

      const staffIds = data.staffIds || [];
      const resolvedStaff = staffIds.map((id, idx) => {
        const found = state.users.find(u => u.id === id);
        return {
          id,
          name: found?.fullName || data.staffNames?.[idx] || id,
          role: found?.role || 'Staff',
        };
      });
      const staffNames = resolvedStaff.map(s => s.name);

      const projectCode = this.generateNextProjectCode(state.projects);
      const projectId = `proj-${Date.now()}`;
      const isInstalledOrActive = ['INSTALLED', 'ACTIVE_RENTAL', 'EXTENDED', 'BUFFER_PERIOD', 'REMOVAL_PENDING', 'CLOSED'].includes(data.status);

      const measurementRecord: SiteMeasurement | undefined =
        (dimWidth > 0 || dimHeight > 0 || dimDepth > 0)
          ? {
              id: `meas-${Date.now()}`,
              siteId: site.id,
              projectId,
              width: dimWidth,
              depth: dimDepth || 3,
              height: dimHeight,
              length: dimWidth,
              unit: dimUnit,
              elevationAreaSqFt,
              measurementType: 'FAÇADE_SCAFFOLD',
              description: `${dimWidth} (W) × ${dimDepth} (D) × ${dimHeight} (H) ${dimUnit}`,
              measuredBy: data.actorName,
              measuredAt: now,
            }
          : undefined;

      const newProject: Project = {
        id: projectId,
        projectCode,
        customerId: customer.id,
        customerName: customer.companyName,
        customerPhone: data.customerPhone?.trim() || customer.phone,
        customerEmail: data.customerEmail?.trim() || customer.email,
        siteId: site.id,
        siteName: site.siteName,
        siteAddress: site.siteAddress,
        assignedSupervisorId: supervisor?.id || data.assignedSupervisorId,
        supervisorName: data.supervisorName?.trim() || supervisor?.fullName || 'Supervisor',
        assignedWorkerIds: staffIds,
        staffIds,
        staffNames,
        installationWorkers: resolvedStaff.length > 0 ? resolvedStaff : undefined,
        status: data.status || 'NOT_INSTALLED',
        scaffoldingType: data.scaffoldingType || undefined,
        pricingModel: 'LUMP_SUM',
        monthlyRentalRate: data.monthlyRentalRate !== undefined ? data.monthlyRentalRate : 0,
        agreedProjectPrice: totalAmount,
        depositAmount: 0,
        transportCharges: 0,
        installationLabourCharges: 0,
        shiftingCharges: 0,
        dismantlingLabourCharges: 0,
        gstPercentage: state.companySettings?.defaultGstRate || 18,
        totalAreaSqFt: elevationAreaSqFt,
        elevationAreaSqFt,
        measurements: measurementRecord,
        siteDimensions: measurementRecord
          ? {
              length: dimWidth,
              width: dimWidth,
              height: dimHeight,
              unit: dimUnit,
              configurationType: 'PERIMETER_FACADE',
            }
          : undefined,
        installationDate: data.installationDate || undefined,
        plannedInstallationDate: data.installationDate || undefined,
        actualInstallationDate: isInstalledOrActive && data.installationDate ? data.installationDate : undefined,
        rentalStartDate: data.installationDate || undefined,
        removalDate: data.removalDate || undefined,
        rentalEndDate: data.removalDate || undefined,
        originalRemovalDate: data.removalDate || undefined,
        originalRentalEndDate: data.removalDate || undefined,
        actualDismantlingDate: data.status === 'CLOSED' ? (data.actualDismantlingDate || data.removalDate || undefined) : undefined,
        rentalMode: data.rentalMode || undefined,
        durationMonths: data.installationDate ? Math.max(1, rentalDuration.months || 0) : undefined,
        rentalDurationMonths: data.installationDate ? rentalDuration.months : undefined,
        rentalDurationDays: data.installationDate ? rentalDuration.days : undefined,
        rentalDurationDisplay: rentalDuration.display || undefined,
        totalAmount,
        paymentReceived,
        balanceAmount,
        advancePaidAmount: paymentReceived,
        completionDueAmount: balanceAmount,
        remark: data.remark?.trim() || undefined,
        siteRemarks: data.remark?.trim() || undefined,
        followUpDate: data.followUpDate || undefined,
        followUpNotes: data.followUpNotes?.trim() || undefined,
        materials: [],
        photos: [],
        createdAt: now,
        updatedAt: now,
      };

      state.projects.unshift(newProject);
      customer.projectsCount = (customer.projectsCount || 0) + 1;
      ReminderService.syncProjectReminderInState(state, newProject);
      ReminderService.syncProjectRentalExpiryInState(state, newProject);

      state.activityEvents.unshift({
        id: `act-${Date.now()}`,
        projectId,
        eventType: 'PROJECT_CREATED',
        eventTitle: 'Project Created',
        eventDescription: `Project ${projectCode} created for ${customer.companyName} (${site.siteName}) with Total ₹${totalAmount.toLocaleString('en-IN')} and Balance ₹${balanceAmount.toLocaleString('en-IN')}.`,
        actorId: data.actorId,
        actorName: data.actorName,
        createdAt: now,
      });

      state.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        actorId: data.actorId,
        actorEmail: data.actorName,
        action: 'PROJECT_CREATED',
        entityTable: 'projects',
        entityId: projectId,
        newState: {
          projectCode,
          customerName: customer.companyName,
          siteName: site.siteName,
          status: newProject.status,
          totalAmount,
          paymentReceived,
          balanceAmount,
        },
        createdAt: now,
      });

      return newProject;
    });
  }

  /**
   * Delete a project and clean up reservations safely
   */
  public static async deleteProject(projectId: string, actorId: string, actorName: string): Promise<{ projectCode: string }> {
    return await dbStore.transaction(async (state) => {
      const idx = state.projects.findIndex(p => p.id === projectId || p.projectCode === projectId);
      if (idx === -1) {
        throw new Error('Project not found');
      }
      const project = state.projects[idx];

      // Release any reserved warehouse materials safely
      if (project.materials && project.materials.length > 0) {
        for (const reqMat of project.materials) {
          const mat = state.materials.find(m => m.id === reqMat.materialId);
          if (mat && reqMat.reservedQuantity > 0) {
            mat.reservedQty = Math.max(0, mat.reservedQty - reqMat.reservedQuantity);
          }
        }
      }

      // Remove linked quotations & project
      state.quotations = state.quotations.filter(q => q.projectId !== project.id);
      state.projects.splice(idx, 1);

      // Remove orphan site if no remaining project references it
      if (project.siteId && !state.projects.some(p => p.siteId === project.siteId)) {
        state.sites = state.sites.filter(s => s.id !== project.siteId);
      }

      // Recompute customer counts & outstanding balance from remaining genuine projects
      const customer = state.customers.find(c => c.id === project.customerId);
      if (customer) {
        const stats = computeCustomerStatsFromProjects(customer.id, state.projects);
        customer.sitesCount = stats.sitesCount;
        customer.projectsCount = stats.projectsCount;
        customer.activeRentalsCount = stats.activeRentalsCount;
        customer.outstandingBalance = stats.outstandingBalance;
        customer.updatedAt = new Date().toISOString();
      }

      state.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        actorId,
        actorEmail: actorName,
        action: 'PROJECT_DELETED',
        entityTable: 'projects',
        entityId: project.id,
        oldState: { projectCode: project.projectCode, customerName: project.customerName, status: project.status },
        createdAt: new Date().toISOString(),
      });

      return { projectCode: project.projectCode };
    });
  }
}
