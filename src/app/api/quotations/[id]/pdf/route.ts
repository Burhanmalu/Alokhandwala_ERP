import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { buildQuotationPdfDoc, ProjectWithRelations } from '@/lib/pdf/project-pdf';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const quotation = dbStore.getQuotationById(id) || dbStore.getQuotationByProjectId(id);

    if (!quotation) {
      return NextResponse.json({ success: false, error: 'Quotation record not found' }, { status: 404 });
    }

    const project = dbStore.getProjects().find(p => p.id === quotation.projectId);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Associated project not found' }, { status: 404 });
    }

    const customer = dbStore.getCustomers().find(c => c.id === project.customerId);
    const site = dbStore.getSites().find(s => s.id === project.siteId);

    const fullProject: ProjectWithRelations = {
      ...project,
      customer,
      site,
    };

    const doc = await buildQuotationPdfDoc(fullProject, quotation);
    const pdfArrayBuffer = doc.output('arraybuffer');

    const filename = `${quotation.quotationNumber || project.projectCode}-Quotation.pdf`;

    return new NextResponse(Buffer.from(pdfArrayBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

