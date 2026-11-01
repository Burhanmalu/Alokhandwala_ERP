import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { AccountingService } from '@/lib/services/accounting-service';

export async function GET() {
  try {
    const bills = dbStore.getVendorBills();
    return NextResponse.json({ success: true, count: bills.length, data: bills });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch vendor bills';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const bill = await AccountingService.createVendorBill({
      vendorInvoiceNumber: body.vendorInvoiceNumber,
      supplierId: body.supplierId || 'vnd-001',
      billDate: body.billDate || new Date().toISOString().split('T')[0],
      dueDate: body.dueDate || new Date().toISOString().split('T')[0],
      purchaseOrderId: body.purchaseOrderId,
      lines: body.lines,
      notes: body.notes,
      actorId: body.actorId,
      actorName: body.actorName,
    });

    return NextResponse.json({ success: true, data: bill }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create vendor bill';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
