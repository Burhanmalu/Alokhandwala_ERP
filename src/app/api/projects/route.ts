import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { ProjectService } from '@/lib/services/project-service';
import { siteInspectionSchema, addProjectSchema } from '@/lib/validations';
import { isEligibleActiveProjectStatus } from '@/lib/formatters';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await dbStore.ensureSynced();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const supervisorId = searchParams.get('supervisorId');
    const eligibleForChallan = searchParams.get('eligibleForChallan') === 'true';
    const search = searchParams.get('search')?.toLowerCase();

    let projects = dbStore.getProjects();

    if (eligibleForChallan) {
      projects = projects.filter(p => p.status !== 'CANCELLED' && isEligibleActiveProjectStatus(p.status));
    }

    if (status && status !== 'ALL') {
      if (status === 'OVERDUE_AMOUNT') {
        projects = projects.filter(p => {
          if (p.status === 'CANCELLED') return false;
          const total = Number(p.totalAmount ?? p.agreedProjectPrice ?? p.quotationAmount ?? 0);
          const received = Number(p.paymentReceived ?? p.advancePaidAmount ?? 0);
          return Math.round((total - received) * 100) / 100 > 0;
        });
      } else {
        projects = projects.filter(p => p.status === status);
      }
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

    // Handle direct project creation from Project Directory (+ Add Project form)
    if (body.mode === 'DIRECT_PROJECT') {
      const validated = addProjectSchema.parse(body);
      const project = await ProjectService.createDirectProject({
        customerId: validated.customerId,
        customerName: validated.customerName,
        customerPhone: validated.customerPhone,
        customerEmail: validated.customerEmail,
        siteId: validated.siteId,
        siteName: validated.siteName,
        siteAddress: validated.siteAddress,
        assignedSupervisorId: validated.assignedSupervisorId,
        supervisorName: validated.supervisorName,
        staffIds: validated.staffIds,
        staffNames: validated.staffNames,
        width: validated.width,
        depth: validated.depth,
        height: validated.height,
        unit: validated.unit,
        status: validated.status,
        installationDate: validated.installationDate,
        removalDate: validated.removalDate,
        totalAmount: validated.totalAmount,
        paymentReceived: validated.paymentReceived,
        remark: validated.remark,
        followUpDate: validated.followUpDate,
        followUpNotes: validated.followUpNotes,
        actorId: body.actorId || 'usr-admin-01',
        actorName: body.actorName || 'Ali/Abdeali(Admin)',
      });
      return NextResponse.json({ success: true, data: project }, { status: 201 });
    }

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
      houseNumber: validated.houseNumber || (body.houseNumber as string | undefined),
      street: validated.street || (body.street as string | undefined),
      locality: validated.locality || (body.locality as string | undefined),
      pincode: validated.pincode || (body.pincode as string | undefined),
      isLocationConfirmed: validated.isLocationConfirmed !== undefined ? validated.isLocationConfirmed : body.isLocationConfirmed,
      landmark: validated.landmark,
      city: validated.city,
      state: validated.state,
      contactPerson: validated.contactPerson || customerName,
      contactPhone: contactPhone,
      hasClientGst: validated.hasClientGst,
      clientGstNumber: validated.clientGstNumber || validated.gstin,
      hasCompanyGst: body.hasCompanyGst !== undefined ? Boolean(body.hasCompanyGst) : undefined,
      companyGstNumber: body.companyGstNumber as string | undefined,
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
