import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { ProjectService } from '@/lib/services/project-service';
import { calculateScaffoldingArea } from '@/lib/formatters';

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

    return NextResponse.json({
      success: true,
      data: {
        ...project,
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
        if (body.siteRemarks !== undefined) proj.siteRemarks = body.siteRemarks;

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
          if (body.phone) site.contactPhone = body.phone.trim();
          if (body.referralName !== undefined) site.referralName = body.referralName;
        }

        proj.updatedAt = new Date().toISOString();
        return proj;
      });

      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ success: false, error: 'No valid action specified' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
