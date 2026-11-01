import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/lib/services/inventory-service';
import { projectConfirmationSchema } from '@/lib/validations';
import { dbStore } from '@/lib/db/store';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Backend validation: Verify project and quotation approval status
    const project = dbStore.getProjects().find(p => p.id === id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    if (project.status === 'QUOTATION_REJECTED') {
      return NextResponse.json({ 
        success: false, 
        error: 'Cannot confirm project: Quotation has been rejected. It must be revised and accepted before proceeding.' 
      }, { status: 400 });
    }

    // Only quotations with status Quotation Accepted can proceed to Project Confirmation & Plan
    const isQuotationWorkflow = project.status === 'QUOTATION_DRAFT' || 
      project.status === 'QUOTATION_SENT' || 
      project.status === 'QUOTATION_ACCEPTED' || 
      project.status === 'SITE_CREATED';

    if (isQuotationWorkflow && project.status !== 'QUOTATION_ACCEPTED' && !body.clientAccepted && !body.clientAcceptanceVerified) {
      return NextResponse.json({ 
        success: false, 
        error: 'Cannot confirm project: Only quotations with status "Quotation Accepted" can proceed to Project Confirmation & Plan. Current status: Pending Approval.' 
      }, { status: 400 });
    }

    const validated = projectConfirmationSchema.parse({
      ...body,
      projectId: id,
    });

    const result = await InventoryService.reserveMaterialsForProject({
      projectId: id,
      quotationNumber: validated.quotationNumber,
      quotationDate: validated.quotationDate,
      agreedProjectPrice: validated.agreedProjectPrice,
      monthlyRentalRate: validated.monthlyRentalRate,
      plannedInstallationDate: validated.plannedInstallationDate,
      durationMonths: validated.durationMonths,
      depositAmount: validated.depositAmount,
      transportCharges: validated.transportCharges,
      installationLabourCharges: validated.installationLabourCharges,
      paymentTerms: validated.paymentTerms,
      remarks: validated.remarks,
      materials: validated.materials,
      scaffoldingPlan: validated.scaffoldingPlan,
      siteDimensions: validated.siteDimensions,
      termsSnapshot: validated.termsSnapshot,
      ratePerSqFt: validated.ratePerSqFt,
      totalAreaSqFt: validated.totalAreaSqFt,
      extraJaliQuantity: validated.extraJaliQuantity,
      extraJaliCharges: validated.extraJaliCharges,
      twoWayTransportCharges: validated.twoWayTransportCharges,
      advancePercentage: validated.advancePercentage,
      advanceRequiredAmount: validated.advanceRequiredAmount,
      completionDueAmount: validated.completionDueAmount,
      clientAccepted: validated.clientAccepted || validated.clientAcceptanceVerified || body.clientAccepted || false,
      actorId: body.actorId || 'usr-admin-01',
      actorName: body.actorName || 'Burhan Malu',
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
