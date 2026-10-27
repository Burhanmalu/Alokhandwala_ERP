import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/lib/services/inventory-service';
import { projectConfirmationSchema } from '@/lib/validations';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

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
      actorId: body.actorId || 'usr-admin-01',
      actorName: body.actorName || 'Burhan Malu',
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
