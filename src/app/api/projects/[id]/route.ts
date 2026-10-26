import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { ProjectService } from '@/lib/services/project-service';

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

    return NextResponse.json({
      success: true,
      data: {
        ...project,
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

    return NextResponse.json({ success: false, error: 'No valid action specified' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
