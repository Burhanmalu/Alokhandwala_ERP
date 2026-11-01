import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { HRService } from '@/lib/services/hr-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const employeeId = searchParams.get('employeeId');

    let records = dbStore.getAttendanceRecords();
    if (date) records = records.filter(r => r.workDate === date);
    if (employeeId) records = records.filter(r => r.employeeId === employeeId);

    return NextResponse.json({ success: true, count: records.length, data: records });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch attendance records';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const record = await HRService.logAttendance({
      employeeId: body.employeeId,
      workDate: body.workDate || new Date().toISOString().split('T')[0],
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      status: body.status || 'PRESENT',
      overtimeMinutes: Number(body.overtimeMinutes) || 0,
      regularised: body.regularised,
      regularisationReason: body.regularisationReason,
      notes: body.notes,
    });

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to log attendance';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
