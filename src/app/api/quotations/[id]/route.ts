import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const quotation = dbStore.getQuotationById(id) || dbStore.getQuotationByProjectId(id);

    if (!quotation) {
      return NextResponse.json({ success: false, error: 'Quotation not found' }, { status: 404 });
    }

    const project = dbStore.getProjects().find(p => p.id === quotation.projectId);

    return NextResponse.json({
      success: true,
      data: {
        quotation,
        project,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

