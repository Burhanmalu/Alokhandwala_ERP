import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/lib/services/inventory-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const result = await InventoryService.releaseProjectReservation({
      projectId: id,
      actorId: body.actorId || 'usr-admin-01',
      actorName: body.actorName || 'Burhan Malu',
      reason: body.reason || 'Reservation released by administrator',
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
