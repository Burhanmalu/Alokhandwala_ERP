import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { ChallanService } from '@/lib/services/challan-service';
import {
  challanAddReturnSchema,
  challanRecordLossSchema,
  challanUpsertSchema,
} from '@/lib/validations';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const challan = dbStore
      .getChallans()
      .find(c => c.id === id || c.challanNumber === id);

    if (!challan) {
      return NextResponse.json({ success: false, error: 'Challan not found' }, { status: 404 });
    }

    const customer = dbStore.getCustomers().find(c => c.id === challan.customerId);
    const site = challan.siteId
      ? dbStore.getSites().find(s => s.id === challan.siteId)
      : undefined;

    return NextResponse.json({
      success: true,
      data: {
        ...challan,
        customer,
        site,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const actorId = body.actorId || 'usr-admin-01';
    const actorName = body.actorName || 'Ali/Abdeali(Admin)';

    if (body.action === 'ADD_RETURN') {
      const validated = challanAddReturnSchema.parse(body);
      const updated = await ChallanService.addReturnEntries(
        id,
        validated.entries,
        actorId,
        actorName
      );
      return NextResponse.json({ success: true, data: updated });
    }

    if (body.action === 'RECORD_LOSS') {
      const validated = challanRecordLossSchema.parse(body);
      const updated = await ChallanService.recordLostMaterials(
        id,
        validated.entries,
        Boolean(validated.approveLoss),
        actorId,
        actorName
      );
      return NextResponse.json({ success: true, data: updated });
    }

    if (body.action === 'CLOSE') {
      const updated = await ChallanService.closeChallan(
        id,
        actorId,
        actorName,
        Boolean(body.approveLoss)
      );
      return NextResponse.json({ success: true, data: updated });
    }

    // Default full update
    const validated = challanUpsertSchema.parse(body);
    const updated = await ChallanService.updateChallan(id, {
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
      images: validated.images,
      actorId,
      actorName,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update challan' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let actorId = 'usr-admin-01';
    let actorName = 'Ali/Abdeali(Admin)';
    try {
      const body = await req.json();
      if (body?.actorId) actorId = body.actorId;
      if (body?.actorName) actorName = body.actorName;
    } catch {
      // Optional DELETE body
    }

    const result = await ChallanService.deleteChallan(id, actorId, actorName);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.message === 'Challan not found.' ? 404 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

