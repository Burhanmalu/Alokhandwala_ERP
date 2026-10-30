import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { BillingService } from '@/lib/services/billing-service';
import { invoiceGenerationSchema } from '@/lib/validations';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');

    let invoices = dbStore.getInvoices();

    if (customerId) invoices = invoices.filter(i => i.customerId === customerId);
    if (projectId) invoices = invoices.filter(i => i.projectId === projectId);
    if (status) invoices = invoices.filter(i => i.status === status);

    return NextResponse.json({ success: true, count: invoices.length, data: invoices });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = invoiceGenerationSchema.parse(body);

    const invoice = await BillingService.createInvoice({
      customerId: validated.customerId,
      projectId: validated.projectId,
      invoiceType: validated.invoiceType,
      invoiceDate: validated.invoiceDate,
      dueDate: validated.dueDate,
      notes: validated.notes,
      lines: validated.lines,
      actorId: body.actorId || 'system',
      actorName: body.actorName || 'Authorized User',
    });

    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
