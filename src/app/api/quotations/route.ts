import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { QuotationService } from '@/lib/services/quotation-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');

    let quotations = dbStore.getQuotations();

    if (projectId) {
      quotations = quotations.filter(q => q.projectId === projectId);
    }
    if (customerId) {
      quotations = quotations.filter(q => q.customerId === customerId);
    }
    if (status && status !== 'ALL') {
      quotations = quotations.filter(q => q.status === status);
    }

    return NextResponse.json({
      success: true,
      count: quotations.length,
      data: quotations,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.projectId) {
      return NextResponse.json({ success: false, error: 'Project ID is required' }, { status: 400 });
    }

    const result = await QuotationService.saveQuotation({
      id: body.id,
      projectId: body.projectId,
      status: body.status || 'DRAFT',
      quotationDate: body.quotationDate,
      ratePerSqFt: Number(body.ratePerSqFt) || 0,
      totalAreaSqFt: body.totalAreaSqFt ? Number(body.totalAreaSqFt) : undefined,
      durationMonths: body.durationMonths ? Number(body.durationMonths) : 1,
      rentalDurationDays: body.rentalDurationDays ? Number(body.rentalDurationDays) : 28,
      walkwayJaliIncludedQuantity: body.walkwayJaliIncludedQuantity ? Number(body.walkwayJaliIncludedQuantity) : 0,
      extraJaliQuantity: body.extraJaliQuantity ? Number(body.extraJaliQuantity) : 0,
      transportCharges: body.transportCharges ? Number(body.transportCharges) : 0,
      shiftingCharges: body.shiftingCharges ? Number(body.shiftingCharges) : 0,
      otherCharges: body.otherCharges ? Number(body.otherCharges) : 0,
      gstPercentage: body.gstPercentage !== undefined ? Number(body.gstPercentage) : 18,
      materials: body.materials || [],
      scaffoldingType: body.scaffoldingType,
      termsAndConditions: body.termsAndConditions,
      notes: body.notes,
      rejectionReason: body.rejectionReason,
      actorId: body.actorId || 'usr-admin-01',
      actorName: body.actorName || 'Burhan Malu',
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: `Quotation ${result.quotation.quotationNumber} saved in ${result.quotation.status} status.`,
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

