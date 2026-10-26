import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/lib/services/inventory-service';
import { removalDismantlingSchema } from '@/lib/validations';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const validated = removalDismantlingSchema.parse({
      ...body,
      projectId: id,
    });

    const result = await InventoryService.reconcileDismantling({
      projectId: id,
      actualDismantlingDate: validated.actualDismantlingDate,
      warehouseId: validated.warehouseId,
      supervisorId: validated.supervisorId,
      teamMembers: validated.teamMembers,
      transportDetails: validated.transportDetails,
      reconciliationNotes: validated.reconciliationNotes,
      afterPhotoUrls: validated.afterPhotoUrls,
      materialReturns: validated.materialReturns,
      actorId: body.actorId || 'usr-sup-01',
      actorName: body.actorName || 'Mustafa Alokhandwala',
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
