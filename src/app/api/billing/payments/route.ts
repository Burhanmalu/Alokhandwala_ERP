import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { BillingService } from '@/lib/services/billing-service';
import { paymentRecordSchema } from '@/lib/validations';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const invoiceId = searchParams.get('invoiceId');
    const customerId = searchParams.get('customerId');

    let payments = dbStore.getPayments();
    if (invoiceId) payments = payments.filter(p => p.invoiceId === invoiceId);
    if (customerId) payments = payments.filter(p => p.customerId === customerId);

    return NextResponse.json({ success: true, count: payments.length, data: payments });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = paymentRecordSchema.parse(body);

    const result = await BillingService.recordPayment({
      invoiceId: validated.invoiceId,
      amount: validated.amount,
      paymentDate: validated.paymentDate,
      paymentMethod: validated.paymentMethod,
      transactionReference: validated.transactionReference,
      bankName: validated.bankName,
      remarks: validated.remarks,
      actorId: body.actorId || 'system',
      actorName: body.actorName || 'Authorized User',
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
