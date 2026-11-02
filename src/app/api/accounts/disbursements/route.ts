import { NextRequest, NextResponse } from 'next/server';
import { AccountingService } from '@/lib/services/accounting-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await AccountingService.recordVendorPayment({
      billId: body.billId,
      paymentDate: body.paymentDate || new Date().toISOString().split('T')[0],
      amount: Number(body.amount),
      paymentMethod: body.paymentMethod || 'NEFT',
      bankAccountId: body.bankAccountId,
      referenceNumber: body.referenceNumber,
      notes: body.notes,
      actorId: body.actorId,
      actorName: body.actorName,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to record vendor payment';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
