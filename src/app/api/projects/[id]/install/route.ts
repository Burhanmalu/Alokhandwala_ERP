import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/lib/services/inventory-service';
import { installationSubmissionSchema } from '@/lib/validations';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const validated = installationSubmissionSchema.parse({
      ...body,
      projectId: id,
    });

    const result = await InventoryService.submitInstallation({
      projectId: id,
      actualInstallationDate: validated.actualInstallationDate,
      supervisorId: validated.supervisorId,
      executingSupervisorName: validated.executingSupervisorName,
      isSameSupervisor: validated.isSameSupervisor,
      supervisorDelegationRemarks: validated.supervisorDelegationRemarks,
      teamMembers: validated.teamMembers,
      workersList: validated.workersList,
      actualMeasurements: validated.actualMeasurements,
      clientRepresentativeName: validated.clientRepresentativeName,
      clientSignOff: validated.clientSignOff,
      remarks: validated.remarks,
      afterPhotoUrls: validated.afterPhotoUrls,
      materialsUsed: validated.materialsUsed,
      actorId: body.actorId || 'usr-sup-01',
      actorName: body.actorName || 'Mustafa Alokhandwala',
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: any) {
    const message = error?.errors && Array.isArray(error.errors) && error.errors.length > 0
      ? error.errors.map((e: any) => e.message).join(', ')
      : (error.message || 'Failed to submit installation');
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
