import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    let sites = dbStore.getSites();

    if (customerId) {
      sites = sites.filter(s => s.customerId === customerId);
    }

    return NextResponse.json({
      success: true,
      count: sites.length,
      data: sites,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

