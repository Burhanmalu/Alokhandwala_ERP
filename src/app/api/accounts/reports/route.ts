import { dbStore } from '@/lib/db/store';
import { NextResponse } from 'next/server';
import { AccountingService } from '@/lib/services/accounting-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await dbStore.ensureSynced();
    const reports = AccountingService.getFinancialStatements();
    return NextResponse.json({ success: true, data: reports });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate financial reports';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
