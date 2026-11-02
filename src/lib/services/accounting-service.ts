// ALOKHANDWALA - Core Double-Entry General Ledger & Accounts Service
// Strictly enforces balanced journal entries (Sum Debits == Sum Credits),
// immutable posted journals, sub-ledger reconciliation, cost centers, and financial statements.

import { dbStore, DatabaseState } from '../db/store';
import { 
  ChartOfAccount, 
  JournalEntry, 
  JournalLine, 
  VendorBill, 
  CostCenter
} from '../schema';

type JournalLineInput = {
  accountId: string;
  costCenterId?: string;
  debit: number;
  credit: number;
  memo?: string;
};

type JournalData = {
  postingDate: string;
  accountingDate?: string;
  periodId?: string;
  kind: JournalEntry['kind'];
  referenceNumber?: string;
  narration: string;
  lines: JournalLineInput[];
  status?: 'DRAFT' | 'POSTED';
  actorId?: string;
  actorName?: string;
};

export class AccountingService {
  /**
   * Post a balanced journal entry directly into a state object already held
   * inside an active transaction. Call this from within other services that
   * own the transaction to avoid nested-lock deadlock.
   * STRICT INTEGRITY: Sum of Debits MUST equal Sum of Credits.
   */
  public static postJournalToState(state: DatabaseState, data: JournalData): JournalEntry {
    const coaList = state.chartOfAccounts || [];

    if (!data.lines || data.lines.length < 2) {
      throw new Error('A balanced journal entry requires at least two lines (one debit and one credit).');
    }

    let totalDebit = 0;
    let totalCredit = 0;
    const preparedLines: JournalLine[] = [];

    for (let i = 0; i < data.lines.length; i++) {
      const item = data.lines[i];
      const account = coaList.find(a => a.id === item.accountId);
      if (!account) {
        throw new Error(`Account ID ${item.accountId} does not exist in Chart of Accounts.`);
      }
      const debit = Math.round((Number(item.debit) || 0) * 100) / 100;
      const credit = Math.round((Number(item.credit) || 0) * 100) / 100;
      if (debit < 0 || credit < 0) throw new Error('Debit and credit amounts cannot be negative.');
      if (debit === 0 && credit === 0) throw new Error('Journal line must have a non-zero debit or credit amount.');
      totalDebit += debit;
      totalCredit += credit;
      preparedLines.push({
        id: `jl-${Date.now()}-${i}`,
        accountId: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        costCenterId: item.costCenterId,
        debit,
        credit,
        memo: item.memo || '',
        reconciled: false,
      });
    }

    totalDebit = Math.round(totalDebit * 100) / 100;
    totalCredit = Math.round(totalCredit * 100) / 100;

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(
        `Double-entry balance check failed: Total Debits (₹${totalDebit.toFixed(2)}) must equal Total Credits (₹${totalCredit.toFixed(2)}). Variance: ₹${Math.abs(totalDebit - totalCredit).toFixed(2)}.`
      );
    }

    const year = new Date(data.postingDate).getFullYear();
    const count = (state.journalEntries || []).length + 1;
    const entryNumber = `JRN-${year}-${count.toString().padStart(5, '0')}`;
    const status = data.status || 'POSTED';

    const entry: JournalEntry = {
      id: `jrn-${Date.now()}`,
      entryNumber,
      postingDate: data.postingDate,
      accountingDate: data.accountingDate || data.postingDate,
      periodId: data.periodId,
      kind: data.kind,
      referenceNumber: data.referenceNumber,
      narration: data.narration,
      totalDebit,
      totalCredit,
      status,
      lines: preparedLines,
      createdBy: data.actorId || 'usr-admin-01',
      creatorName: data.actorName || 'Finance Manager',
      createdAt: new Date().toISOString(),
      postedAt: status === 'POSTED' ? new Date().toISOString() : undefined,
    };

    if (!state.journalEntries) state.journalEntries = [];
    state.journalEntries.unshift(entry);

    if (status === 'POSTED') {
      AccountingService.applyJournalToAccountBalances(
        { chartOfAccounts: state.chartOfAccounts, costCenters: state.costCenters },
        entry
      );
    }

    state.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      actorId: data.actorId || 'usr-admin-01',
      actorEmail: data.actorName || 'finance@alokhandwala.com',
      action: 'POST_JOURNAL_ENTRY',
      entityTable: 'journal_entries',
      entityId: entry.id,
      newState: entry,
      createdAt: new Date().toISOString(),
    });

    return entry;
  }

  /**
   * Public API: creates a journal entry within its own transaction.
   * Use postJournalToState() when already inside a transaction.
   */
  public static async createJournalEntry(data: JournalData): Promise<JournalEntry> {
    return await dbStore.transaction(async (state) => {
      return AccountingService.postJournalToState(state, data);
    });
  }

  /**
   * Reverse a posted journal entry by creating an opposite balanced journal entry.
   * Ensures immutability: posted journals are never deleted.
   */
  public static async reverseJournalEntry(
    entryId: string,
    reason: string,
    actorId: string,
    actorName: string
  ): Promise<JournalEntry> {
    return await dbStore.transaction(async (state) => {
      const original = (state.journalEntries || []).find(j => j.id === entryId);
      if (!original) throw new Error('Journal entry not found.');
      if (original.status !== 'POSTED') throw new Error('Only posted journal entries can be reversed.');

      original.status = 'REVERSED';

      // Rollback balances from original
      for (const line of original.lines) {
        const acc = state.chartOfAccounts.find(a => a.id === line.accountId);
        if (acc) {
          if (acc.accountType === 'ASSET' || acc.accountType === 'EXPENSE') {
            acc.currentBalance -= (line.debit - line.credit);
          } else {
            acc.currentBalance -= (line.credit - line.debit);
          }
        }
      }

      const reversedLines: JournalLineInput[] = original.lines.map(l => ({
        accountId: l.accountId,
        costCenterId: l.costCenterId,
        debit: l.credit,
        credit: l.debit,
        memo: `Reversal: ${reason}`,
      }));

      // Use postJournalToState to avoid nested transaction
      const reversingEntry = AccountingService.postJournalToState(state, {
        postingDate: new Date().toISOString().split('T')[0],
        kind: 'ADJUSTMENT',
        referenceNumber: original.entryNumber,
        narration: `Reversal of ${original.entryNumber}: ${reason}`,
        lines: reversedLines,
        actorId,
        actorName,
      });

      reversingEntry.reversedEntryId = original.id;
      return reversingEntry;
    });
  }

  /** Helper: apply a posted journal entry's debits/credits to CoA balances and cost center spend. */
  private static applyJournalToAccountBalances(
    state: { chartOfAccounts: ChartOfAccount[]; costCenters: CostCenter[] },
    entry: JournalEntry
  ) {
    for (const line of entry.lines) {
      const acc = (state.chartOfAccounts || []).find(a => a.id === line.accountId);
      if (acc) {
        if (acc.accountType === 'ASSET' || acc.accountType === 'EXPENSE') {
          acc.currentBalance = Math.round((acc.currentBalance + (line.debit - line.credit)) * 100) / 100;
        } else {
          acc.currentBalance = Math.round((acc.currentBalance + (line.credit - line.debit)) * 100) / 100;
        }
        acc.updatedAt = new Date().toISOString();
      }
      if (line.costCenterId && line.debit > 0) {
        const cc = (state.costCenters || []).find(c => c.id === line.costCenterId);
        if (cc) {
          cc.spent = Math.round((cc.spent + line.debit) * 100) / 100;
        }
      }
    }
  }

  /**
   * Create Vendor Bill (Accounts Payable) with auto-balancing journal posting.
   */
  public static async createVendorBill(data: {
    vendorInvoiceNumber: string;
    supplierId: string;
    billDate: string;
    dueDate: string;
    purchaseOrderId?: string;
    lines: {
      description: string;
      hsnSacCode?: string;
      quantity: number;
      unitPrice: number;
      taxRate: number;
      accountId: string;
      costCenterId?: string;
    }[];
    notes?: string;
    actorId?: string;
    actorName?: string;
  }): Promise<VendorBill> {
    return await dbStore.transaction(async (state) => {
      const supplier = { id: data.supplierId, companyName: 'Vendor / Contractor' };

      let subtotal = 0;
      let taxAmount = 0;

      const preparedLines = data.lines.map((l, idx) => {
        const amt = Math.round(l.quantity * l.unitPrice * 100) / 100;
        const tax = Math.round(amt * (l.taxRate / 100) * 100) / 100;
        subtotal += amt;
        taxAmount += tax;
        return {
          id: `vbl-${Date.now()}-${idx}`,
          description: l.description,
          hsnSacCode: l.hsnSacCode || '9987',
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          amount: amt,
          taxRate: l.taxRate,
          taxAmount: tax,
          totalAmount: amt + tax,
          accountId: l.accountId,
          costCenterId: l.costCenterId,
        };
      });

      const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
      const year = new Date(data.billDate).getFullYear();
      const count = (state.vendorBills || []).length + 1;
      const billNumber = `BILL-${year}-${count.toString().padStart(4, '0')}`;

      const apAccount = state.chartOfAccounts.find(a => a.accountCode === '2010')
        || state.chartOfAccounts.find(a => a.accountType === 'LIABILITY');
      const inputGstAccount = state.chartOfAccounts.find(a => a.accountCode === '1050')
        || state.chartOfAccounts.find(a => a.accountType === 'ASSET');

      if (!apAccount) throw new Error('Accounts Payable control account (2010) not found in Chart of Accounts.');

      const journalLines: JournalLineInput[] = [];

      for (const pl of preparedLines) {
        journalLines.push({ accountId: pl.accountId, costCenterId: pl.costCenterId, debit: pl.amount, credit: 0, memo: pl.description });
      }
      if (taxAmount > 0 && inputGstAccount) {
        journalLines.push({ accountId: inputGstAccount.id, debit: taxAmount, credit: 0, memo: `Input GST for Bill ${billNumber}` });
      }
      journalLines.push({ accountId: apAccount.id, debit: 0, credit: totalAmount, memo: `Payable to ${supplier.companyName} Inv #${data.vendorInvoiceNumber}` });

      // Use postJournalToState — already inside a transaction
      const journal = AccountingService.postJournalToState(state, {
        postingDate: data.billDate,
        kind: 'AP_AUTO',
        referenceNumber: billNumber,
        narration: `Vendor Bill ${billNumber} from ${supplier.companyName} (Ref #${data.vendorInvoiceNumber})`,
        lines: journalLines,
        actorId: data.actorId,
        actorName: data.actorName,
      });

      const vendorBill: VendorBill = {
        id: `bill-${Date.now()}`,
        billNumber,
        vendorInvoiceNumber: data.vendorInvoiceNumber,
        supplierId: data.supplierId,
        supplierName: supplier.companyName,
        purchaseOrderId: data.purchaseOrderId,
        billDate: data.billDate,
        dueDate: data.dueDate,
        subtotal: Math.round(subtotal * 100) / 100,
        taxAmount: Math.round(taxAmount * 100) / 100,
        totalAmount,
        paidAmount: 0,
        outstandingAmount: totalAmount,
        status: 'POSTED',
        journalEntryId: journal.id,
        lines: preparedLines,
        notes: data.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!state.vendorBills) state.vendorBills = [];
      state.vendorBills.unshift(vendorBill);

      return vendorBill;
    });
  }

  /**
   * Record AP Vendor Payment (Disbursement)
   */
  public static async recordVendorPayment(data: {
    billId: string;
    paymentDate: string;
    amount: number;
    paymentMethod: 'NEFT' | 'RTGS' | 'CHEQUE' | 'UPI' | 'CASH';
    bankAccountId?: string;
    referenceNumber: string;
    notes?: string;
    actorId?: string;
    actorName?: string;
  }): Promise<{ bill: VendorBill; journal: JournalEntry }> {
    return await dbStore.transaction(async (state) => {
      const bill = (state.vendorBills || []).find(b => b.id === data.billId);
      if (!bill) throw new Error('Vendor bill not found.');

      if (data.amount <= 0) throw new Error('Payment amount must be greater than zero.');
      if (data.amount > bill.outstandingAmount + 0.01) {
        throw new Error(`Payment amount (₹${data.amount}) exceeds outstanding amount (₹${bill.outstandingAmount}).`);
      }

      const apAccount = state.chartOfAccounts.find(a => a.accountCode === '2010');
      const bankAccount = (data.bankAccountId ? state.chartOfAccounts.find(a => a.id === data.bankAccountId) : null)
        || state.chartOfAccounts.find(a => a.accountCode === '1020')
        || state.chartOfAccounts.find(a => a.classification === 'BANK_CASH');

      if (!apAccount || !bankAccount) {
        throw new Error('AP control account or Bank/Cash account not found.');
      }

      // postJournalToState — no nested transaction
      const journal = AccountingService.postJournalToState(state, {
        postingDate: data.paymentDate,
        kind: 'AP_AUTO',
        referenceNumber: data.referenceNumber,
        narration: `Vendor payment for ${bill.billNumber} (${bill.supplierName}) via ${data.paymentMethod}`,
        lines: [
          { accountId: apAccount.id, debit: data.amount, credit: 0, memo: `Settlement for ${bill.billNumber}` },
          { accountId: bankAccount.id, debit: 0, credit: data.amount, memo: `Disbursement Ref #${data.referenceNumber}` },
        ],
        actorId: data.actorId,
        actorName: data.actorName,
      });

      bill.paidAmount = Math.round((bill.paidAmount + data.amount) * 100) / 100;
      bill.outstandingAmount = Math.round((bill.totalAmount - bill.paidAmount) * 100) / 100;
      bill.status = bill.outstandingAmount <= 0.01 ? 'PAID' : 'PARTIALLY_PAID';
      bill.updatedAt = new Date().toISOString();

      return { bill, journal };
    });
  }

  /**
   * Generate Financial Reports:
   * 1. Trial Balance (Debit == Credit)
   * 2. Profit & Loss (Revenue - Expense = Net Profit)
   * 3. Balance Sheet (Assets = Liabilities + Equity)
   */
  public static getFinancialStatements() {
    const coa = dbStore.getChartOfAccounts();
    const journals = dbStore.getJournalEntries().filter(j => j.status === 'POSTED');

    const balances: Record<string, { debit: number; credit: number; balance: number }> = {};
    for (const acc of coa) {
      balances[acc.id] = { debit: 0, credit: 0, balance: 0 };
    }

    for (const entry of journals) {
      for (const line of entry.lines) {
        if (!balances[line.accountId]) {
          balances[line.accountId] = { debit: 0, credit: 0, balance: 0 };
        }
        balances[line.accountId].debit += line.debit;
        balances[line.accountId].credit += line.credit;
      }
    }

    for (const acc of coa) {
      const b = balances[acc.id];
      if (acc.accountType === 'ASSET' || acc.accountType === 'EXPENSE') {
        b.balance = Math.round((b.debit - b.credit) * 100) / 100;
      } else {
        b.balance = Math.round((b.credit - b.debit) * 100) / 100;
      }
    }

    // 1. TRIAL BALANCE
    const trialBalanceRows = coa.map(acc => {
      const b = balances[acc.id] || { debit: 0, credit: 0, balance: 0 };
      let tbDebit = 0;
      let tbCredit = 0;
      if (acc.accountType === 'ASSET' || acc.accountType === 'EXPENSE') {
        if (b.balance >= 0) tbDebit = b.balance;
        else tbCredit = Math.abs(b.balance);
      } else {
        if (b.balance >= 0) tbCredit = b.balance;
        else tbDebit = Math.abs(b.balance);
      }
      return {
        id: acc.id,
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        accountType: acc.accountType,
        debitTotal: b.debit,
        creditTotal: b.credit,
        netDebit: Math.round(tbDebit * 100) / 100,
        netCredit: Math.round(tbCredit * 100) / 100,
      };
    });

    const totalTBDebit = Math.round(trialBalanceRows.reduce((sum, r) => sum + r.netDebit, 0) * 100) / 100;
    const totalTBCredit = Math.round(trialBalanceRows.reduce((sum, r) => sum + r.netCredit, 0) * 100) / 100;

    // 2. P&L
    const revenueAccounts = coa.filter(a => a.accountType === 'REVENUE').map(a => ({ ...a, amount: balances[a.id]?.balance || 0 }));
    const expenseAccounts = coa.filter(a => a.accountType === 'EXPENSE').map(a => ({ ...a, amount: balances[a.id]?.balance || 0 }));
    const totalRevenue = Math.round(revenueAccounts.reduce((sum, a) => sum + a.amount, 0) * 100) / 100;
    const totalExpenses = Math.round(expenseAccounts.reduce((sum, a) => sum + a.amount, 0) * 100) / 100;
    const netProfit = Math.round((totalRevenue - totalExpenses) * 100) / 100;

    // 3. BALANCE SHEET
    const assetAccounts = coa.filter(a => a.accountType === 'ASSET').map(a => ({ ...a, amount: balances[a.id]?.balance || 0 }));
    const liabilityAccounts = coa.filter(a => a.accountType === 'LIABILITY').map(a => ({ ...a, amount: balances[a.id]?.balance || 0 }));
    const equityAccounts = coa.filter(a => a.accountType === 'EQUITY').map(a => ({ ...a, amount: balances[a.id]?.balance || 0 }));
    const totalAssets = Math.round(assetAccounts.reduce((sum, a) => sum + a.amount, 0) * 100) / 100;
    const totalLiabilities = Math.round(liabilityAccounts.reduce((sum, a) => sum + a.amount, 0) * 100) / 100;
    const baseEquity = Math.round(equityAccounts.reduce((sum, a) => sum + a.amount, 0) * 100) / 100;
    const totalEquity = Math.round((baseEquity + netProfit) * 100) / 100;
    const totalLiabilitiesAndEquity = Math.round((totalLiabilities + totalEquity) * 100) / 100;

    // 4. AP AGING
    const vendorBills = dbStore.getVendorBills().filter(b => b.status !== 'PAID' && b.status !== 'CANCELLED');
    const now = Date.now();
    const apAging = { days0_30: 0, days31_60: 0, days61_90: 0, days90Plus: 0, totalOutstanding: 0 };
    for (const b of vendorBills) {
      const diffDays = Math.floor((now - new Date(b.billDate).getTime()) / 86400000);
      apAging.totalOutstanding += b.outstandingAmount;
      if (diffDays <= 30) apAging.days0_30 += b.outstandingAmount;
      else if (diffDays <= 60) apAging.days31_60 += b.outstandingAmount;
      else if (diffDays <= 90) apAging.days61_90 += b.outstandingAmount;
      else apAging.days90Plus += b.outstandingAmount;
    }

    // 5. AR AGING
    const invoices = dbStore.getInvoices().filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED');
    const arAging = { days0_30: 0, days31_60: 0, days61_90: 0, days90Plus: 0, totalOutstanding: 0 };
    for (const inv of invoices) {
      const diffDays = Math.floor((now - new Date(inv.invoiceDate).getTime()) / 86400000);
      arAging.totalOutstanding += inv.outstandingAmount;
      if (diffDays <= 30) arAging.days0_30 += inv.outstandingAmount;
      else if (diffDays <= 60) arAging.days31_60 += inv.outstandingAmount;
      else if (diffDays <= 90) arAging.days61_90 += inv.outstandingAmount;
      else arAging.days90Plus += inv.outstandingAmount;
    }

    return {
      trialBalance: { rows: trialBalanceRows, totalDebit: totalTBDebit, totalCredit: totalTBCredit, isBalanced: Math.abs(totalTBDebit - totalTBCredit) <= 0.05 },
      profitAndLoss: { revenueAccounts, expenseAccounts, totalRevenue, totalExpenses, netProfit },
      balanceSheet: { assetAccounts, liabilityAccounts, equityAccounts, totalAssets, totalLiabilities, totalEquity, totalLiabilitiesAndEquity, isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) <= 0.05 },
      apAging,
      arAging,
    };
  }
}
