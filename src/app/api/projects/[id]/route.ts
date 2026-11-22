import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { ProjectService } from '@/lib/services/project-service';
import {
  calculateScaffoldingArea,
  calculateRentalDurationBreakdown,
  getEffectiveRemovalDate,
  toDateOnlyString,
} from '@/lib/formatters';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = dbStore.getProjects().find(p => p.id === id || p.projectCode === id);

    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const activity = dbStore.getActivityEvents(project.id);
    const relatedInvoices = dbStore.getInvoices().filter(i => i.projectId === project.id);
    const relatedShiftings = dbStore.getShiftingRequests().filter(s => s.projectId === project.id);
    const relatedRemovals = dbStore.getRemovalRequests().filter(r => r.projectId === project.id);
    const relatedExtensions = dbStore.getRentalExtensions().filter(e => e.projectId === project.id);
    const relatedBuffers = dbStore.getBufferRequests().filter(b => b.projectId === project.id);

    const customer = dbStore.getCustomers().find(c => c.id === project.customerId);
    const site = dbStore.getSites().find(s => s.id === project.siteId);
    const companySettings = dbStore.getCompanySettings();

    return NextResponse.json({
      success: true,
      data: {
        ...project,
        configuredBufferDays: companySettings?.bufferDaysDefault || 3,
        customer,
        site,
        activity,
        invoices: relatedInvoices,
        shiftings: relatedShiftings,
        removals: relatedRemovals,
        extensions: relatedExtensions,
        buffers: relatedBuffers,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (body.targetStatus) {
      const updated = await ProjectService.transitionStatus(
        id,
        body.targetStatus,
        body.reason || 'Status update',
        body.actorId || 'usr-admin-01',
        body.actorName || 'Burhan Malu'
      );
      return NextResponse.json({ success: true, data: updated });
    }

    if (body.addPhotos && Array.isArray(body.addPhotos)) {
      const updated = await dbStore.transaction((state) => {
        const proj = state.projects.find(p => p.id === id || p.projectCode === id);
        if (!proj) throw new Error('Project not found');
        if (!proj.photos) proj.photos = [];

        const stageLabel = body.stageLabel || 'SITE_INSPECTION';
        const newAttachments = body.addPhotos.map((url: string, idx: number) => ({
          id: `pht-${Date.now()}-${idx}`,
          entityType: 'SITE_INSPECTION',
          entityId: proj.id,
          fileName: `site_photo_${Date.now()}_${idx + 1}.jpg`,
          fileUrl: url,
          fileSizeBytes: 2048000,
          mimeType: 'image/jpeg',
          stageLabel: stageLabel,
          uploadedBy: body.actorId || 'usr-admin-01',
          uploaderName: body.actorName || 'Supervisor',
          createdAt: new Date().toISOString(),
        }));

        proj.photos.push(...newAttachments);
        proj.updatedAt = new Date().toISOString();
        return proj;
      });

      return NextResponse.json({ success: true, data: updated });
    }

    if (body.updateSiteForm) {
      const updated = await dbStore.transaction((state) => {
        const proj = state.projects.find(p => p.id === id || p.projectCode === id);
        if (!proj) throw new Error('Project not found');

        if (body.customerName) proj.customerName = body.customerName.trim();
        if (body.referralName !== undefined) proj.referralName = body.referralName ? body.referralName.trim() : undefined;
        if (body.supervisorName) proj.supervisorName = body.supervisorName.trim();
        if (body.assignedSupervisorId) proj.assignedSupervisorId = body.assignedSupervisorId;
        if (body.siteAddress) proj.siteAddress = body.siteAddress.trim();
        if (body.latitude !== undefined) proj.latitude = body.latitude;
        if (body.longitude !== undefined) proj.longitude = body.longitude;
        if (body.locationType !== undefined) proj.locationType = body.locationType;
        if (body.locationAccuracyMeters !== undefined) proj.locationAccuracyMeters = body.locationAccuracyMeters;
        if (body.houseNumber !== undefined) proj.houseNumber = body.houseNumber;
        if (body.street !== undefined) proj.street = body.street;
        if (body.locality !== undefined) proj.locality = body.locality;
        if (body.pincode !== undefined) proj.pincode = body.pincode;
        if (body.isLocationConfirmed !== undefined) proj.isLocationConfirmed = body.isLocationConfirmed;
        if (body.siteRemarks !== undefined) proj.siteRemarks = body.siteRemarks;

        if (body.hasClientGst !== undefined) {
          proj.hasClientGst = Boolean(body.hasClientGst);
        }
        if (body.clientGstNumber !== undefined) {
          proj.clientGstNumber = proj.hasClientGst
            ? (body.clientGstNumber && body.clientGstNumber !== 'N/A' ? body.clientGstNumber.trim().toUpperCase() : 'N/A')
            : 'N/A';
        }
        if (body.hasCompanyGst !== undefined) {
          proj.hasCompanyGst = Boolean(body.hasCompanyGst);
        }
        if (body.companyGstNumber !== undefined) {
          proj.companyGstNumber = proj.hasCompanyGst
            ? (body.companyGstNumber && body.companyGstNumber !== 'N/A' ? body.companyGstNumber.trim().toUpperCase() : undefined)
            : undefined;
        }

        if ((body.width !== undefined || body.length !== undefined) && body.height !== undefined) {
          const numW = Number(body.width !== undefined ? body.width : body.length);
          const numD = Number(body.depth !== undefined ? body.depth : 3);
          const numH = Number(body.height);
          const numL = Number(body.length !== undefined ? body.length : numW);
          const unit = body.unit || 'FEET';
          const area = calculateScaffoldingArea(numW, numD, numH, unit);

          if (!proj.measurements) {
            proj.measurements = {
              id: `meas-${Date.now()}`,
              siteId: proj.siteId,
              projectId: proj.id,
              width: numW,
              depth: numD,
              height: numH,
              length: numL,
              unit: unit,
              elevationAreaSqFt: area,
              measurementType: 'FAÇADE_SCAFFOLD',
              description: body.siteRemarks || `${numW} x ${numD} x ${numH} ${unit}`,
              measuredBy: proj.supervisorName,
              measuredAt: new Date().toISOString(),
            };
          } else {
            proj.measurements.width = numW;
            proj.measurements.depth = numD;
            proj.measurements.height = numH;
            proj.measurements.length = numL;
            proj.measurements.unit = unit;
            proj.measurements.elevationAreaSqFt = area;
          }
          proj.totalAreaSqFt = area;
          proj.elevationAreaSqFt = area;

          // Sync quotation dimensions if quotation exists
          const qtn = state.quotations.find(q => q.projectId === proj.id || (proj.quotationId && q.id === proj.quotationId));
          if (qtn && qtn.dimensions) {
            qtn.dimensions.width = numW;
            qtn.dimensions.depth = numD;
            qtn.dimensions.height = numH;
            qtn.dimensions.length = numL;
            qtn.dimensions.unit = unit;
            qtn.dimensions.totalAreaSqFt = area;
            qtn.dimensions.description = `${numW} (W) × ${numD} (D) × ${numH} (H) ${unit}`;
            qtn.totalAreaSqFt = area;
          }
        }

        if (body.photoUrls && Array.isArray(body.photoUrls)) {
          proj.photos = body.photoUrls.map((url: string, idx: number) => ({
            id: `pht-${Date.now()}-${idx}`,
            entityType: 'SITE_INSPECTION',
            entityId: proj.id,
            fileName: `site_inspection_${idx + 1}.jpg`,
            fileUrl: url,
            fileSizeBytes: 2048000,
            mimeType: 'image/jpeg',
            stageLabel: 'BEFORE_INSTALLATION',
            uploadedBy: proj.assignedSupervisorId,
            uploaderName: proj.supervisorName,
            createdAt: new Date().toISOString(),
          }));
        }

        const site = state.sites.find(s => s.id === proj.siteId);
        if (site) {
          if (body.siteAddress) site.siteAddress = body.siteAddress.trim();
          if (body.landmark !== undefined) site.landmark = body.landmark ? body.landmark.trim() : undefined;
          if (body.latitude !== undefined) site.latitude = body.latitude;
          if (body.longitude !== undefined) site.longitude = body.longitude;
          if (body.locationType !== undefined) site.locationType = body.locationType;
          if (body.locationAccuracyMeters !== undefined) site.locationAccuracyMeters = body.locationAccuracyMeters;
          if (body.houseNumber !== undefined) site.houseNumber = body.houseNumber;
          if (body.street !== undefined) site.street = body.street;
          if (body.locality !== undefined) site.locality = body.locality;
          if (body.pincode !== undefined) site.pincode = body.pincode;
          if (body.isLocationConfirmed !== undefined) site.isLocationConfirmed = body.isLocationConfirmed;
          if (body.phone) site.contactPhone = body.phone.trim();
          if (body.referralName !== undefined) site.referralName = body.referralName;
          if (proj.hasClientGst !== undefined) site.hasClientGst = proj.hasClientGst;
          if (proj.clientGstNumber !== undefined) {
            site.clientGstNumber = proj.clientGstNumber;
            site.gstin = proj.clientGstNumber;
          }
        }

        const customer = state.customers.find(c => c.id === proj.customerId);
        if (customer && proj.hasClientGst && proj.clientGstNumber && proj.clientGstNumber !== 'N/A') {
          customer.gstin = proj.clientGstNumber;
        }

        proj.updatedAt = new Date().toISOString();
        return proj;
      });

      return NextResponse.json({ success: true, data: updated });
    }

    if (body.updateProjectDetails) {
      const totalAmount = Number(body.totalAmount ?? 0);
      const paymentReceived = Number(body.paymentReceived ?? 0);
      if (totalAmount < 0 || paymentReceived < 0) {
        return NextResponse.json({ success: false, error: 'Financial amounts cannot be negative.' }, { status: 400 });
      }
      if (paymentReceived > totalAmount) {
        return NextResponse.json({ success: false, error: 'Payment Received cannot exceed Total Amount.' }, { status: 400 });
      }
      const balanceAmount = Math.round((totalAmount - paymentReceived) * 100) / 100;
      const rentalDuration = calculateRentalDurationBreakdown(body.installationDate, body.removalDate);
      if (rentalDuration.isInvalid) {
        return NextResponse.json(
          { success: false, error: 'Date of Removal cannot be earlier than Date of Installation.' },
          { status: 400 }
        );
      }

      const updated = await dbStore.transaction((state) => {
        const proj = state.projects.find(p => p.id === id || p.projectCode === id);
        if (!proj) throw new Error('Project not found');

        const oldStatus = proj.status;
        if (body.customerId) proj.customerId = body.customerId;
        if (body.customerName) proj.customerName = body.customerName.trim();
        if (body.customerPhone !== undefined) proj.customerPhone = body.customerPhone ? body.customerPhone.trim() : undefined;
        if (body.customerEmail !== undefined) proj.customerEmail = body.customerEmail ? body.customerEmail.trim() : undefined;

        if (body.siteId) proj.siteId = body.siteId;
        if (body.siteName) proj.siteName = body.siteName.trim();
        if (body.siteAddress) proj.siteAddress = body.siteAddress.trim();

        if (body.assignedSupervisorId) {
          proj.assignedSupervisorId = body.assignedSupervisorId;
          const sup = state.users.find(u => u.id === body.assignedSupervisorId);
          proj.supervisorName = body.supervisorName?.trim() || sup?.fullName || proj.supervisorName;
        } else if (body.supervisorName) {
          proj.supervisorName = body.supervisorName.trim();
        }

        if (Array.isArray(body.staffIds)) {
          proj.staffIds = body.staffIds;
          proj.assignedWorkerIds = body.staffIds;
          const resolvedStaff = body.staffIds.map((sid: string, idx: number) => {
            const u = state.users.find(user => user.id === sid);
            return {
              id: sid,
              name: u?.fullName || body.staffNames?.[idx] || sid,
              role: u?.role || 'Staff',
            };
          });
          proj.staffNames = resolvedStaff.map((s: any) => s.name);
          proj.installationWorkers = resolvedStaff.length > 0 ? resolvedStaff : undefined;
        }

        if (body.status) proj.status = body.status;

        proj.installationDate = body.installationDate || undefined;
        proj.plannedInstallationDate = body.installationDate || proj.plannedInstallationDate;
        proj.rentalStartDate = body.installationDate || proj.rentalStartDate;
        if (['INSTALLED', 'ACTIVE_RENTAL', 'EXTENDED', 'BUFFER_PERIOD', 'REMOVAL_PENDING', 'CLOSED'].includes(proj.status) && body.installationDate) {
          proj.actualInstallationDate = body.installationDate;
        }

        const previousEffectiveRemoval = toDateOnlyString(getEffectiveRemovalDate(proj));
        const nextRemovalStr = toDateOnlyString(body.removalDate);
        if (nextRemovalStr && nextRemovalStr !== previousEffectiveRemoval) {
          if (!proj.originalRemovalDate && previousEffectiveRemoval) {
            proj.originalRemovalDate = proj.originalRentalEndDate || previousEffectiveRemoval;
          }
          if (!proj.originalRentalEndDate && proj.originalRemovalDate) {
            proj.originalRentalEndDate = proj.originalRemovalDate;
          }
          // Manual removal date edit supersedes any prior buffer expiry
          if (proj.bufferEndDate && nextRemovalStr !== toDateOnlyString(proj.bufferEndDate)) {
            proj.bufferEndDate = undefined;
            proj.bufferDaysApplied = undefined;
            proj.bufferActivatedAt = undefined;
          }
          if (!proj.rentalHistory) proj.rentalHistory = [];
          proj.rentalHistory.unshift({
            id: `rh-man-${Date.now()}`,
            projectId: proj.id,
            projectCode: proj.projectCode,
            actionType: 'MANUAL_DATE_UPDATE',
            originalRemovalDate: proj.originalRemovalDate || previousEffectiveRemoval || nextRemovalStr,
            previousRemovalDate: previousEffectiveRemoval || nextRemovalStr,
            newRemovalDate: nextRemovalStr,
            addedValue: 0,
            addedUnit: 'DAYS',
            reason: 'Removal date updated via Project Details Edit Form',
            changedAt: new Date().toISOString(),
            changedById: body.actorId || 'usr-admin-01',
            changedByName: body.actorName || 'Admin',
          });
        } else if (!nextRemovalStr) {
          proj.bufferEndDate = undefined;
        }

        proj.removalDate = body.removalDate || undefined;
        proj.rentalEndDate = body.removalDate || undefined;
        proj.durationMonths = body.installationDate ? Math.max(1, rentalDuration.months || 0) : proj.durationMonths;
        proj.rentalDurationMonths = body.installationDate ? rentalDuration.months : undefined;
        proj.rentalDurationDays = body.installationDate ? rentalDuration.days : undefined;
        proj.rentalDurationDisplay = rentalDuration.display || undefined;

        // Update Site Dimensions if provided
        if (body.width !== undefined || body.depth !== undefined || body.height !== undefined || body.unit !== undefined) {
          const dimW = Math.max(0, Number(body.width ?? proj.measurements?.width ?? 0));
          const dimD = Math.max(0, Number(body.depth ?? proj.measurements?.depth ?? 0));
          const dimH = Math.max(0, Number(body.height ?? proj.measurements?.height ?? 0));
          const dimUnit: 'FEET' | 'METERS' = (body.unit || proj.measurements?.unit) === 'METERS' ? 'METERS' : 'FEET';
          const area = (dimW > 0 && dimH > 0 && dimD > 0)
            ? calculateScaffoldingArea(dimW, dimD, dimH, dimUnit)
            : 0;

          if (!proj.measurements) {
            proj.measurements = {
              id: `meas-${Date.now()}`,
              siteId: proj.siteId,
              projectId: proj.id,
              width: dimW,
              depth: dimD || 3,
              height: dimH,
              length: dimW,
              unit: dimUnit,
              elevationAreaSqFt: area,
              measurementType: 'FAÇADE_SCAFFOLD',
              description: `${dimW} (W) × ${dimD} (D) × ${dimH} (H) ${dimUnit}`,
              measuredBy: proj.supervisorName,
              measuredAt: new Date().toISOString(),
            };
          } else {
            proj.measurements.width = dimW;
            proj.measurements.depth = dimD;
            proj.measurements.height = dimH;
            proj.measurements.length = dimW;
            proj.measurements.unit = dimUnit;
            proj.measurements.elevationAreaSqFt = area;
            proj.measurements.description = `${dimW} (W) × ${dimD} (D) × ${dimH} (H) ${dimUnit}`;
          }
          proj.totalAreaSqFt = area;
          proj.elevationAreaSqFt = area;
          proj.siteDimensions = {
            length: dimW,
            width: dimW,
            height: dimH,
            unit: dimUnit,
            configurationType: proj.siteDimensions?.configurationType || 'PERIMETER_FACADE',
          };
        }

        proj.totalAmount = totalAmount;
        proj.agreedProjectPrice = totalAmount;
        proj.paymentReceived = paymentReceived;
        proj.advancePaidAmount = paymentReceived;
        proj.balanceAmount = balanceAmount;
        proj.completionDueAmount = balanceAmount;

        proj.remark = body.remark !== undefined ? (body.remark ? body.remark.trim() : undefined) : proj.remark;
        proj.siteRemarks = proj.remark;
        proj.followUpDate = body.followUpDate || undefined;
        proj.followUpNotes = body.followUpNotes !== undefined ? (body.followUpNotes ? body.followUpNotes.trim() : undefined) : proj.followUpNotes;

        // Sync linked customer & site details
        const customer = state.customers.find(c => c.id === proj.customerId);
        if (customer) {
          if (body.customerName) customer.companyName = body.customerName.trim();
          if (body.customerPhone) customer.phone = body.customerPhone.trim();
          if (body.customerEmail !== undefined) customer.email = body.customerEmail.trim();
          customer.updatedAt = new Date().toISOString();
        }
        const site = state.sites.find(s => s.id === proj.siteId);
        if (site) {
          if (body.siteName) site.siteName = body.siteName.trim();
          if (body.siteAddress) site.siteAddress = body.siteAddress.trim();
          if (proj.assignedSupervisorId) site.assignedSupervisorId = proj.assignedSupervisorId;
          if (proj.supervisorName) site.supervisorName = proj.supervisorName;
        }

        proj.updatedAt = new Date().toISOString();

        state.auditLogs.unshift({
          id: `aud-${Date.now()}`,
          actorId: body.actorId || 'usr-admin-01',
          actorEmail: body.actorName || 'Admin',
          action: 'PROJECT_UPDATED',
          entityTable: 'projects',
          entityId: proj.id,
          oldState: { status: oldStatus },
          newState: { status: proj.status, totalAmount, paymentReceived, balanceAmount },
          createdAt: proj.updatedAt,
        });

        return proj;
      });

      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ success: false, error: 'No valid action specified' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let actorId = 'usr-admin-01';
    let actorName = 'Administrator';
    try {
      const body = await req.json();
      if (body?.actorId) actorId = body.actorId;
      if (body?.actorName) actorName = body.actorName;
    } catch {
      // Optional DELETE body
    }

    const result = await ProjectService.deleteProject(id, actorId, actorName);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.message === 'Project not found' ? 404 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
