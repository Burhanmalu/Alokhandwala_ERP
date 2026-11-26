import { NextRequest, NextResponse } from 'next/server';
import { RentalService } from '@/lib/services/rental-service';
import { bufferRequestSchema } from '@/lib/validations';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const validated = bufferRequestSchema.parse({
      ...body,
      projectId: id,
    });

    const result = await RentalService.applyBufferPeriod({
      projectId: id,
      requestedBufferDays: validated.requestedBufferDays,
      bufferEndDate: validated.bufferEndDate,
      paymentStatus: validated.paymentStatus,
      totalAmount: validated.totalAmount,
      paymentReceived: validated.paymentReceived,
      balanceAmount: validated.balanceAmount,
      reason: validated.reason,
      additionalCharges: validated.additionalCharges,
      actorId: body.actorId || 'system',
      actorName: body.actorName || 'Authorized User',
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
