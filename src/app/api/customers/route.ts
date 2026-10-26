import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { customerSchema } from '@/lib/validations';
import { Customer } from '@/lib/schema';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase();
    let customers = dbStore.getCustomers();

    if (search) {
      customers = customers.filter(c => 
        c.customerCode.toLowerCase().includes(search) ||
        c.companyName.toLowerCase().includes(search) ||
        c.contactPerson.toLowerCase().includes(search) ||
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
        contactPerson: validated.contactPerson,
        phone: validated.phone,
        email: validated.email,
        billingAddress: validated.billingAddress,
        city: validated.city || 'Mumbai',
        state: validated.state || 'Maharashtra',
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
