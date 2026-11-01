import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { HRService } from '@/lib/services/hr-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const periodMonth = searchParams.get('periodMonth');
    const employeeId = searchParams.get('employeeId');

    let slips = dbStore.getPaySlips();
    if (periodMonth) slips = slips.filter(s => s.periodMonth === periodMonth);
    if (employeeId) slips = slips.filter(s => s.employeeId === employeeId);

    return NextResponse.json({ success: true, count: slips.length, data: slips });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch pay slips';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await HRService.runMonthlyPayroll({
      periodMonth: body.periodMonth,
      workingDaysInMonth: Number(body.workingDaysInMonth) || 26,
      departmentId: body.departmentId,
      actorId: body.actorId,
      actorName: body.actorName,
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process payroll';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
