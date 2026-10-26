import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/lib/services/inventory-service';
import { shiftingRequestSchema } from '@/lib/validations';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const validated = shiftingRequestSchema.parse({
      ...body,
      projectId: id,
    });

    const result = await InventoryService.executeShifting({
      projectId: id,
      shiftingType: validated.shiftingType,
      destinationSiteId: validated.destinationSiteId,
      destinationAreaDescription: validated.destinationAreaDescription,
      plannedShiftingDate: validated.plannedShiftingDate,
      labourCharges: validated.labourCharges,
      transportCharges: validated.transportCharges,
      teamMembers: validated.teamMembers,
      remarks: validated.remarks,
      materialModifications: validated.materialModifications,
      actorId: body.actorId || 'usr-sup-01',
      actorName: body.actorName || 'Mustafa Alokhandwala',
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
