import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const transactions = dbStore.getTransactions();
    
    // Look up by id, transactionNumber, or compact ID match
    const transaction = transactions.find(t => 
      t.id === id || 
      t.transactionNumber === id ||
      t.transactionNumber.toLowerCase() === id.toLowerCase() ||
      t.transactionNumber.endsWith(id)
    );

    if (!transaction) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
    }

    const project = transaction.projectId 
      ? dbStore.getProjects().find(p => p.id === transaction.projectId) 
      : undefined;

    return NextResponse.json({
      success: true,
      data: {
        transaction,
        project,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch transaction';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
