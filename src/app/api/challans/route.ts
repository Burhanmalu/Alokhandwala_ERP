import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { ChallanService } from '@/lib/services/challan-service';
import { challanUpsertSchema } from '@/lib/validations';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase().trim();
    const customerId = searchParams.get('customerId');
    const siteId = searchParams.get('siteId');
    const status = searchParams.get('status');
    const date = searchParams.get('date');

    let challans = dbStore.getChallans();

    if (customerId && customerId !== 'ALL') {
      challans = challans.filter(c => c.customerId === customerId);
    }
    if (siteId && siteId !== 'ALL') {
      challans = challans.filter(c => c.siteId === siteId || c.siteName === siteId);
    }
    if (status && status !== 'ALL') {
      challans = challans.filter(c => c.status === status);
    }
    if (date) {
      challans = challans.filter(c => c.issueDate === date);
    }
    if (search) {
      challans = challans.filter(
        c =>
          c.challanNumber.toLowerCase().includes(search) ||
          c.customerName.toLowerCase().includes(search) ||
          c.siteName.toLowerCase().includes(search) ||
          (c.size && c.size.toLowerCase().includes(search))
      );
    }

    return NextResponse.json({
      success: true,
      count: challans.length,
      data: challans,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = challanUpsertSchema.parse(body);

    const created = await ChallanService.createChallan({
      customerId: validated.customerId,
      siteId: validated.siteId,
      siteName: validated.siteName,
      projectId: validated.projectId,
      size: validated.size,
      issueDate: validated.issueDate,
      outputEntries: validated.outputEntries,
      inputEntries: validated.inputEntries,
      lostEntries: validated.lostEntries,
      status: validated.status,
      lossApproved: validated.lossApproved,
      notes: validated.notes,
      clientRequestId: validated.clientRequestId,
      actorId: body.actorId || 'usr-admin-01',
      actorName: body.actorName || 'Burhan Malu (Admin)',
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create challan' },
      { status: 400 }
    );
  }
}

