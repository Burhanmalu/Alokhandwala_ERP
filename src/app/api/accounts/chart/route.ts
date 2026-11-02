import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '@/lib/db/store';

export async function GET() {
  try {
    const chartOfAccounts = dbStore.getChartOfAccounts();
    return NextResponse.json({ success: true, count: chartOfAccounts.length, data: chartOfAccounts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch Chart of Accounts';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accountCode, accountName, accountType, classification, parentId, isControlAccount, description } = body;

    if (!accountCode || !accountName || !accountType) {
      return NextResponse.json({ success: false, error: 'Account code, name, and type are required' }, { status: 400 });
    }

    const newAccount = await dbStore.transaction(async (state) => {
      const existing = (state.chartOfAccounts || []).find(a => a.accountCode === accountCode);
      if (existing) throw new Error(`Account code ${accountCode} already exists.`);

      const account = {
        id: `coa-${Date.now()}`,
        accountCode,
        accountName,
        accountType,
        classification: classification || 'GENERAL',
        parentId: parentId || undefined,
        isControlAccount: Boolean(isControlAccount),
        currentBalance: 0,
        currency: 'INR',
        status: 'ACTIVE' as const,
        description: description || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!state.chartOfAccounts) state.chartOfAccounts = [];
      state.chartOfAccounts.push(account);
      return account;
    });

    return NextResponse.json({ success: true, data: newAccount }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create account';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
