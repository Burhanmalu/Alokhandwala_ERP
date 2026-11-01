import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { HRService } from '@/lib/services/hr-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');

    let leaves = dbStore.getLeaveRequests();
    if (employeeId) leaves = leaves.filter(l => l.employeeId === employeeId);
    if (status) leaves = leaves.filter(l => l.status === status);

    return NextResponse.json({ success: true, count: leaves.length, data: leaves });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch leave requests';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const leave = await HRService.submitLeaveRequest({
      employeeId: body.employeeId,
      leaveType: body.leaveType || 'CASUAL',
      startDate: body.startDate,
      endDate: body.endDate,
      totalDays: Number(body.totalDays) || 1,
      reason: body.reason,
    });

    return NextResponse.json({ success: true, data: leave }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to submit leave request';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { leaveId, status, actorId, actorName, rejectionReason } = body;

    const updated = await HRService.updateLeaveStatus(
      leaveId,
      status,
      actorId || 'usr-admin-01',
      actorName || 'HR Manager',
      rejectionReason
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update leave request status';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
