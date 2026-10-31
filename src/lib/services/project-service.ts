// ALOKHANDWALA - Project Lifecycle & State Machine Service

import { dbStore } from '../db/store';
import { Project, ProjectStatus, SiteMeasurement, FileAttachment } from '../schema';
import { calculateScaffoldingArea } from '../formatters';

export const VALID_STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  SITE_CREATED: ['QUOTATION_DRAFT', 'QUOTATION_SENT', 'NOT_INSTALLED', 'CANCELLED'],
  NOT_INSTALLED: ['QUOTATION_DRAFT', 'QUOTATION_SENT', 'QUOTATION_ACCEPTED', 'CONFIRMED_PROJECT', 'CANCELLED'],
  QUOTATION_DRAFT: ['QUOTATION_SENT', 'QUOTATION_ACCEPTED', 'QUOTATION_REJECTED', 'CANCELLED'],
  QUOTATION_SENT: ['QUOTATION_ACCEPTED', 'QUOTATION_REJECTED', 'QUOTATION_DRAFT', 'CANCELLED'],
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
    landmark?: string;
    city?: string;
    state?: string;
    contactPerson?: string;
    contactPhone?: string;
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
            email: `${data.customerName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'client'}@scaffold-client.com`,
            billingAddress: data.siteAddress.trim(),
            city: data.city || 'Mumbai',
            state: data.state || 'Maharashtra',
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
          referralName: data.referralName || customer.referenceName,
          landmark: data.landmark,
          city: data.city || 'Mumbai',
          state: data.state || 'Maharashtra',
          contactPerson: data.contactPerson || customer.contactPerson,
          contactPhone: data.contactPhone || customer.phone,
          assignedSupervisorId: supervisor.id,
          supervisorName: supervisor.fullName,
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
        referralName: data.referralName || customer.referenceName,
        assignedSupervisorId: supervisor.id,
        supervisorName: supervisor.fullName,
        status: 'NOT_INSTALLED',
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

      return project;
    });
  }
}
