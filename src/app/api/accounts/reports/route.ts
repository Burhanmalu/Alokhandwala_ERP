import { NextResponse } from 'next/server';
import { AccountingService } from '@/lib/services/accounting-service';

export async function GET() {
  try {
    const reports = AccountingService.getFinancialStatements();
    return NextResponse.json({ success: true, data: reports });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate financial reports';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
