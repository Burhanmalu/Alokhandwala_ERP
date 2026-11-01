import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';

export async function GET() {
  try {
    const departments = dbStore.getDepartments();
    const employees = dbStore.getEmployees();

    const deptsWithCounts = departments.map(d => ({
      ...d,
      employeeCount: employees.filter(e => e.departmentId === d.id && e.status === 'ACTIVE').length,
    }));

    return NextResponse.json({ success: true, count: deptsWithCounts.length, data: deptsWithCounts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch departments';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, code, description, costCenterId } = body;

    if (!name || !code) {
      return NextResponse.json({ success: false, error: 'Department name and code are required' }, { status: 400 });
    }

    const dept = await dbStore.transaction(async (state) => {
      const existing = (state.departments || []).find(d => d.code.toUpperCase() === code.toUpperCase());
      if (existing) throw new Error(`Department code ${code} already exists.`);

      const newDept = {
        id: `dept-${Date.now()}`,
        code: code.toUpperCase(),
        name,
        description: description || '',
        costCenterId,
        createdAt: new Date().toISOString(),
      };

      if (!state.departments) state.departments = [];
      state.departments.push(newDept);
      return newDept;
    });

    return NextResponse.json({ success: true, data: dept }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create department';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
