import { NextRequest, NextResponse } from 'next/server';
import { QuotationService } from '@/lib/services/quotation-service';
import { QuotationStatus } from '@/lib/schema';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!body.status) {
      return NextResponse.json({ success: false, error: 'Target status is required' }, { status: 400 });
    }

    const validStatuses: QuotationStatus[] = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ success: false, error: `Invalid status ${body.status}` }, { status: 400 });
    }

    const result = await QuotationService.updateStatus({
      quotationId: id,
      status: body.status,
      reason: body.reason,
      actorId: body.actorId || 'usr-admin-01',
      actorName: body.actorName || 'Burhan Malu',
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: `Quotation status updated to ${body.status}`,
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

