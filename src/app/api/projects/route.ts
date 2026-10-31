import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { ProjectService } from '@/lib/services/project-service';
import { siteInspectionSchema } from '@/lib/validations';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const supervisorId = searchParams.get('supervisorId');
    const search = searchParams.get('search')?.toLowerCase();

    let projects = dbStore.getProjects();

    if (status && status !== 'ALL') {
      projects = projects.filter(p => p.status === status);
    }
    if (customerId) {
      projects = projects.filter(p => p.customerId === customerId);
    }
    if (supervisorId) {
      projects = projects.filter(p => p.assignedSupervisorId === supervisorId);
    }
    if (search) {
      projects = projects.filter(p => 
        p.projectCode.toLowerCase().includes(search) ||
        p.customerName.toLowerCase().includes(search) ||
        p.siteName.toLowerCase().includes(search) ||
        p.supervisorName.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ success: true, count: projects.length, data: projects });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = siteInspectionSchema.parse(body);

    const siteAddress = validated.siteAddress || validated.address || 'Site Location';
    const customerName = validated.customerName || (body.customerName as string | undefined);
    const siteName = validated.siteName || `${customerName || 'Commercial'} Site`;
    const contactPhone = validated.contactPhone || validated.phone;
    const referralName = validated.referralName || validated.referenceName;
    const siteRemarks = validated.siteRemarks || validated.remark;

    const project = await ProjectService.createProjectFromInspection({
      customerId: validated.customerId,
      customerName: customerName,
      referralName: referralName,
      siteName: siteName,
      siteAddress: siteAddress,
      latitude: validated.latitude,
      longitude: validated.longitude,
      locationType: validated.locationType,
      locationAccuracyMeters: validated.locationAccuracyMeters,
      landmark: validated.landmark,
      city: validated.city,
      state: validated.state,
      contactPerson: validated.contactPerson || customerName,
      contactPhone: contactPhone,
      assignedSupervisorId: validated.assignedSupervisorId,
      supervisorName: validated.supervisorName,
      measurements: {
        width: validated.width,
        depth: validated.depth !== undefined ? validated.depth : 3,
        height: validated.height,
        length: validated.length !== undefined ? validated.length : validated.width,
        unit: validated.unit,
        measurementType: validated.measurementType,
        description: siteRemarks || validated.size,
      },
      siteRemarks: siteRemarks,
      photoUrls: validated.photoUrls,
      actorId: body.actorId || 'usr-sup-01',
      actorName: body.actorName || 'Mustafa Alokhandwala',
    });

    return NextResponse.json({ success: true, data: project }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
