import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { Customer } from '@/lib/schema';
import { computeCustomerStatsFromProjects } from '@/lib/formatters';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbStore.ensureSynced();
    const { id } = await params;
    const customer = dbStore.getCustomers().find(c => c.id === id);
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }
    const stats = computeCustomerStatsFromProjects(customer.id, dbStore.getProjects());
    return NextResponse.json({ success: true, data: { ...customer, ...stats } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let actorId = 'usr-admin-01';
    let actorName = 'Admin';

    try {
      const body = await req.json();
      if (body.actorId) actorId = body.actorId;
      if (body.actorName) actorName = body.actorName;
    } catch {
      // Body may be empty
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
