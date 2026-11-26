import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { customerSchema } from '@/lib/validations';
import { Customer } from '@/lib/schema';
import { computeCustomerStatsFromProjects, isEligibleActiveProjectStatus } from '@/lib/formatters';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await dbStore.ensureSynced();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase();
    const eligibleForChallan = searchParams.get('eligibleForChallan') === 'true';
    const allProjects = dbStore.getProjects();
    const eligibleCustomerIds = eligibleForChallan
      ? new Set(
          allProjects
            .filter((p) => p.status !== 'CANCELLED' && isEligibleActiveProjectStatus(p.status))
            .map((p) => p.customerId)
        )
      : null;

    let customers = dbStore.getCustomers()
      .filter((c) => !eligibleCustomerIds || eligibleCustomerIds.has(c.id))
      .map((c) => {
        const stats = computeCustomerStatsFromProjects(c.id, allProjects);
        return {
          ...c,
          ...stats,
        };
      });

    if (search) {
      customers = customers.filter(c => 
        c.customerCode.toLowerCase().includes(search) ||
        c.companyName.toLowerCase().includes(search) ||
        (c.contactPerson && c.contactPerson.toLowerCase().includes(search)) ||
        c.phone.includes(search)
      );
    }

    return NextResponse.json({ success: true, count: customers.length, data: customers });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = customerSchema.parse(body);

    const customer = await dbStore.transaction((state) => {
      const nextCode = `CUST-${(state.customers.length + 1).toString().padStart(4, '0')}`;
      const newCustomer: Customer = {
        id: `cust-${Date.now()}`,
        customerCode: nextCode,
        companyName: validated.companyName,
        referenceName: validated.referenceName,
        contactPerson: (validated.contactPerson && validated.contactPerson.trim()) || validated.companyName,
        phone: validated.phone,
        email: validated.email || '',
        billingAddress: validated.billingAddress,
        city: validated.city || 'Indore',
        state: validated.state || 'Madhya Pradesh',
        gstin: validated.gstin,
        status: 'ACTIVE',
        creditLimit: validated.creditLimit || 500000,
        outstandingBalance: 0,
        sitesCount: 0,
        projectsCount: 0,
        activeRentalsCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      state.customers.unshift(newCustomer);
      state.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        actorId: body.actorId || 'usr-admin-01',
        actorEmail: body.actorName || 'Burhan Malu',
        action: 'CREATE_CUSTOMER',
        entityTable: 'customers',
        entityId: newCustomer.id,
        newState: newCustomer,
        createdAt: new Date().toISOString(),
      });

      return newCustomer;
    });

    return NextResponse.json({ success: true, data: customer }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { searchParams } = new URL(req.url);
    const id = body.id || searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Customer ID is required' }, { status: 400 });
    }

    const updatedCustomer = await dbStore.transaction((state) => {
      const idx = state.customers.findIndex(c => c.id === id);
      if (idx === -1) {
        throw new Error(`Customer with ID ${id} not found`);
      }

      const existing = state.customers[idx];
      const updated: Customer = {
        ...existing,
        companyName: body.companyName !== undefined ? body.companyName.trim() : existing.companyName,
        referenceName: body.referenceName !== undefined ? (body.referenceName.trim() || undefined) : existing.referenceName,
        contactPerson: body.contactPerson !== undefined ? body.contactPerson.trim() : (body.companyName ? body.companyName.trim() : existing.contactPerson),
        phone: body.phone !== undefined ? body.phone.trim() : existing.phone,
        email: body.email !== undefined ? body.email.trim() : existing.email,
        billingAddress: body.billingAddress !== undefined ? body.billingAddress.trim() : existing.billingAddress,
        city: body.city !== undefined ? body.city.trim() : existing.city,
        state: body.state !== undefined ? body.state.trim() : existing.state,
        gstin: body.gstin !== undefined ? (body.gstin.trim() ? body.gstin.trim().toUpperCase() : 'N/A') : existing.gstin,
        status: body.status || existing.status || 'ACTIVE',
        creditLimit: body.creditLimit !== undefined ? Number(body.creditLimit) : existing.creditLimit,
        updatedAt: new Date().toISOString(),
      };

      state.customers[idx] = updated;

      state.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        actorId: body.actorId || 'usr-admin-01',
        actorEmail: body.actorName || 'Burhan Malu',
        action: 'UPDATE_CUSTOMER',
        entityTable: 'customers',
        entityId: updated.id,
        newState: updated,
        createdAt: new Date().toISOString(),
      });

      return updated;
    });

    return NextResponse.json({ success: true, data: updatedCustomer });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');
    let actorId = 'usr-admin-01';
    let actorName = 'Admin';

    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
        if (body.actorId) actorId = body.actorId;
        if (body.actorName) actorName = body.actorName;
      } catch {
        // empty body allowed if id in query
      }
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Customer ID is required' }, { status: 400 });
    }

    await dbStore.transaction((state) => {
      const idx = state.customers.findIndex(c => c.id === id);
      if (idx === -1) {
        throw new Error(`Customer with ID ${id} not found`);
      }
      const customer = state.customers[idx];
      state.customers.splice(idx, 1);

      state.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        actorId,
        actorEmail: actorName,
        action: 'DELETE_CUSTOMER',
        entityTable: 'customers',
        entityId: id,
        oldState: customer,
        createdAt: new Date().toISOString(),
      });
    });

    return NextResponse.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
