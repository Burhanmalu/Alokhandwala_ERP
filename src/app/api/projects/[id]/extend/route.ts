import { NextRequest, NextResponse } from 'next/server';
import { RentalService } from '@/lib/services/rental-service';
import { extensionRequestSchema } from '@/lib/validations';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const validated = extensionRequestSchema.parse({
      ...body,
      projectId: id,
    });

    const result = await RentalService.extendRental({
      projectId: id,
      durationMonths: validated.durationMonths,
      extensionReason: validated.extensionReason,
      monthlyRentalRate: validated.monthlyRentalRate,
      actorId: body.actorId || 'system',
      actorName: body.actorName || 'Authorized User',
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
