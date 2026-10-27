import { NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { CompanySettings } from '@/lib/schema';

export async function GET() {
  try {
    const settings = dbStore.getCompanySettings();
    return NextResponse.json({ success: true, data: settings });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body: Partial<CompanySettings> = await req.json();

    const updated = await dbStore.transaction((state) => {
      state.companySettings = {
        ...state.companySettings,
        ...body,
      };
      return state.companySettings;
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update settings' },
      { status: 500 }
    );
  }
}
