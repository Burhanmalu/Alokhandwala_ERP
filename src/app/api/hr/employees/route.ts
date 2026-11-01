import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { HRService } from '@/lib/services/hr-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId');
    const status = searchParams.get('status');

    let employees = dbStore.getEmployees();
    if (departmentId) employees = employees.filter(e => e.departmentId === departmentId);
    if (status) employees = employees.filter(e => e.status === status);

    return NextResponse.json({ success: true, count: employees.length, data: employees });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch employees';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const emp = await HRService.saveEmployee(body);
    return NextResponse.json({ success: true, data: emp }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create employee';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const emp = await HRService.saveEmployee(body);
    return NextResponse.json({ success: true, data: emp });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update employee';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
