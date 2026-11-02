import { NextRequest, NextResponse } from 'next/server';
import { AccountingService } from '@/lib/services/accounting-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const reversal = await AccountingService.reverseJournalEntry(
      id,
      body.reason || 'User requested reversal',
      body.actorId || 'usr-admin-01',
      body.actorName || 'Finance Manager'
    );

    return NextResponse.json({ success: true, data: reversal });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reverse journal entry';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
