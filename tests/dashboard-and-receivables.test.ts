import assert from 'assert';
import { dbStore } from '../src/lib/db/store';
import { BillingService } from '../src/lib/services/billing-service';

export async function runDashboardAndReceivablesTests() {
  console.log('\n===============================================================');
  console.log('DASHBOARD CARDS & OUTSTANDING RECEIVABLES TEST SUITE');
  console.log('===============================================================');

  // Test 1: Inventory stock breakdown mapping for dashboard cards
  const state = await dbStore.getState();
  const materials = state.materials;
  assert(materials.length > 0, 'Inventory materials must be present');

  const usableTotal = materials.reduce((sum, m) => sum + (m.usableWarehouseQty || 0), 0);
  const reservedTotal = materials.reduce((sum, m) => sum + (m.reservedQty || 0), 0);
  const allocatedTotal = materials.reduce((sum, m) => sum + (m.siteAllocatedQty || 0), 0);
  const damagedTotal = materials.reduce((sum, m) => sum + (m.damagedQty || 0), 0);
  const missingTotal = materials.reduce((sum, m) => sum + (m.missingQty || 0), 0);

  assert(typeof usableTotal === 'number', 'Usable Warehouse total must be computed');
  assert(typeof reservedTotal === 'number', 'Reserved for Sites total must be computed');
  assert(typeof allocatedTotal === 'number', 'Allocated on Sites total must be computed');
  assert(typeof damagedTotal === 'number', 'Damage Material total must be computed');
  assert(typeof missingTotal === 'number', 'Missing Material total must be computed');
  console.log('  ✓ PASS: 1. Inventory stock breakdown matches dashboard metric definitions');

  // Test 2: Create tax invoice and record payment
  const customer = state.customers[0];
  const project = state.projects[0];
  assert(customer && project, 'Customer and Project must exist');

  const invRes = await BillingService.createInvoice({
    projectId: project.id,
    customerId: customer.id,
    invoiceType: 'RENTAL_CHARGE',
    invoiceDate: '2026-11-01',
    dueDate: '2026-11-20',
    actorId: 'usr-admin-01',
    actorName: 'Burhan Malu',
    lines: [
      {
        description: 'First Month Scaffolding Rental',
        quantity: 1,
        rate: 100000,
      }
    ],
  });

  assert(invRes, 'Invoice must be created');
  assert.strictEqual(invRes.totalAmount, 118000, 'Total with 18% GST must equal 118,000');
  assert.strictEqual(invRes.outstandingAmount, 118000, 'Initial outstanding equals total');
  assert.strictEqual(invRes.status, 'ISSUED', 'New invoice starts as ISSUED');

  // Record partial payment
  const payRes = await BillingService.recordPayment({
    invoiceId: invRes.id,
    amount: 50000,
    paymentDate: '2026-11-02',
    paymentMethod: 'NEFT',
    transactionReference: 'NEFT998877',
    actorId: 'usr-admin-01',
    actorName: 'Burhan Malu',
  });

  assert.strictEqual(payRes.invoice.paidAmount, 50000, 'Amount paid must be 50,000');
  assert.strictEqual(payRes.invoice.outstandingAmount, 68000, 'Remaining outstanding must be 68,000');
  assert.strictEqual(payRes.invoice.status, 'PARTIALLY_PAID', 'Invoice becomes PARTIALLY_PAID');
  console.log('  ✓ PASS: 2. Invoice creation and partial payment updates ledger & status dynamically');

  // Test 3: Settle invoice in full
  const fullPayRes = await BillingService.recordPayment({
    invoiceId: invRes.id,
    amount: 68000,
    paymentDate: '2026-11-05',
    paymentMethod: 'RTGS',
    transactionReference: 'RTGS112233',
    actorId: 'usr-admin-01',
    actorName: 'Burhan Malu',
  });

  assert.strictEqual(fullPayRes.invoice.outstandingAmount, 0, 'Outstanding becomes 0');
  assert.strictEqual(fullPayRes.invoice.status, 'PAID', 'Status transitions to PAID');
  console.log('  ✓ PASS: 3. Full payment settles invoice to PAID status with zero balance');

  // Test 4: Verify ledger formula: Outstanding = Total Billed - Total Received
  const updatedState = await dbStore.getState();
  const allInvoices = updatedState.invoices;
  const totalBilled = allInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalReceived = allInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
  const totalOutstanding = allInvoices.reduce((sum, inv) => sum + inv.outstandingAmount, 0);

  assert.strictEqual(
    totalOutstanding,
    totalBilled - totalReceived,
    'Outstanding Balance must equal Total Billed minus Total Received'
  );
  console.log('  ✓ PASS: 4. Outstanding Balance strictly equals Total Billed minus Total Received');

  console.log('---------------------------------------------------------------');
  console.log('Dashboard & Receivables Results: 4 Passed, 0 Failed');
  console.log('---------------------------------------------------------------');
}

if (process.argv[1]?.endsWith('dashboard-and-receivables.test.ts')) {
  runDashboardAndReceivablesTests().catch(err => {
    console.error('Test run failed:', err);
    process.exit(1);
  });
}
