import { NextRequest, NextResponse } from 'next/server';
import { HRService } from '@/lib/services/hr-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await HRService.disbursePayroll({
      paySlipIds: body.paySlipIds || [],
      bankAccountId: body.bankAccountId,
      referenceNumber: body.referenceNumber || `DISB-${Date.now()}`,
      actorId: body.actorId,
      actorName: body.actorName,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to disburse payroll';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
