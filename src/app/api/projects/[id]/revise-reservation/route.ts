import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/lib/services/inventory-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!body.materials || !Array.isArray(body.materials) || body.materials.length === 0) {
      return NextResponse.json({ success: false, error: 'Materials list is required' }, { status: 400 });
    }

    const result = await InventoryService.reviseProjectReservation({
      projectId: id,
      materials: body.materials,
      actorId: body.actorId || 'usr-admin-01',
      actorName: body.actorName || 'Burhan Malu',
      reason: body.reason || 'Reservation revised by administrator',
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
