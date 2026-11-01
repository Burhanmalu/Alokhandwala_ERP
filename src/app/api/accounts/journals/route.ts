import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';
import { AccountingService } from '@/lib/services/accounting-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const kind = searchParams.get('kind');
    const status = searchParams.get('status');

    let entries = dbStore.getJournalEntries();
    if (kind) entries = entries.filter(e => e.kind === kind);
    if (status) entries = entries.filter(e => e.status === status);

    return NextResponse.json({ success: true, count: entries.length, data: entries });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch journal entries';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entry = await AccountingService.createJournalEntry({
      postingDate: body.postingDate || new Date().toISOString().split('T')[0],
      accountingDate: body.accountingDate,
      periodId: body.periodId,
      kind: body.kind || 'GENERAL',
      referenceNumber: body.referenceNumber,
      narration: body.narration,
      lines: body.lines,
      status: body.status || 'POSTED',
      actorId: body.actorId,
      actorName: body.actorName,
    });

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create journal entry';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
