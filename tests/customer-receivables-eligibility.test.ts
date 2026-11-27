import assert from 'assert';
import {
  computeCustomerStatsFromProjects,
  isReceivableEligibleProjectStatus,
  getProjectOutstandingBalance,
} from '../src/lib/formatters';

function runCustomerReceivablesEligibilityTests() {
  console.log('\n===============================================================');
  console.log('CUSTOMER TOTAL RECEIVABLES ELIGIBILITY TEST SUITE');
  console.log('===============================================================');

  const custId = 'cust-receivable-test';

  // 1-7: Status eligibility checks
  assert.strictEqual(isReceivableEligibleProjectStatus('QUOTATION_DRAFT'), false, 'Pending Approval (QUOTATION_DRAFT) excluded');
  assert.strictEqual(isReceivableEligibleProjectStatus('QUOTATION_SENT'), false, 'Pending Approval (QUOTATION_SENT) excluded');
  assert.strictEqual(isReceivableEligibleProjectStatus('QUOTATION_ACCEPTED'), false, 'Quotation Accepted excluded');
  assert.strictEqual(isReceivableEligibleProjectStatus('NOT_INSTALLED'), false, 'Not Installed excluded');
  assert.strictEqual(isReceivableEligibleProjectStatus('CLOSED'), false, 'Closed excluded');
  assert.strictEqual(isReceivableEligibleProjectStatus('CANCELLED'), false, 'Cancelled excluded');

  assert.strictEqual(isReceivableEligibleProjectStatus('CONFIRMED_PROJECT'), true, 'Confirmed (Reserved) included');
  assert.strictEqual(isReceivableEligibleProjectStatus('SCHEDULED'), true, 'Scheduled for Installation included');
  assert.strictEqual(isReceivableEligibleProjectStatus('INSTALLED'), true, 'Installed included');
  assert.strictEqual(isReceivableEligibleProjectStatus('ACTIVE_RENTAL'), true, 'Active Rental included');
  assert.strictEqual(isReceivableEligibleProjectStatus('REMOVAL_PENDING'), true, 'Removal Pending included');
  console.log('  ✓ PASS: 1-7. Project status eligibility rules match specification');

  // 8-9: Fully paid & partially paid eligible projects
  assert.strictEqual(
    getProjectOutstandingBalance({ totalAmount: 50000, paymentReceived: 50000 }),
    0,
    'Fully paid eligible project has 0 receivable'
  );
  assert.strictEqual(
    getProjectOutstandingBalance({ totalAmount: 50000, paymentReceived: 18500 }),
    31500,
    'Partially paid eligible project includes only remaining balance'
  );
  assert.strictEqual(
    getProjectOutstandingBalance({ totalAmount: 10000, paymentReceived: 12000 }),
    0,
    'Overpaid project does not produce negative receivable'
  );
  console.log('  ✓ PASS: 8-9. Full, partial, and non-negative balance calculations verified');

  // 10: Customer with multiple projects (exact scenario from specification)
  const projects = [
    { id: 'pA', customerId: custId, siteId: 'sA', status: 'QUOTATION_DRAFT', totalAmount: 50000, paymentReceived: 10000 },
    { id: 'pB', customerId: custId, siteId: 'sB', status: 'QUOTATION_ACCEPTED', totalAmount: 30000, paymentReceived: 0 },
    { id: 'pC', customerId: custId, siteId: 'sC', status: 'CONFIRMED_PROJECT', totalAmount: 40000, paymentReceived: 10000 },
    { id: 'pD', customerId: custId, siteId: 'sD', status: 'ACTIVE_RENTAL', totalAmount: 60000, paymentReceived: 20000 },
    { id: 'pE', customerId: custId, siteId: 'sE', status: 'CLOSED', totalAmount: 20000, paymentReceived: 5000 },
    // Duplicate ID guard & other customer isolation
    { id: 'pD', customerId: custId, siteId: 'sD', status: 'ACTIVE_RENTAL', totalAmount: 60000, paymentReceived: 20000 },
    { id: 'pOther', customerId: 'cust-other', siteId: 'sO', status: 'ACTIVE_RENTAL', totalAmount: 99000, paymentReceived: 0 },
  ];

  const statsInitial = computeCustomerStatsFromProjects(custId, projects);
  assert.strictEqual(statsInitial.outstandingBalance, 70000, 'Expected ₹30,000 + ₹40,000 = ₹70,000');
  assert.strictEqual(statsInitial.projectsCount, 5, 'Duplicate project ID not counted twice');
  console.log('  ✓ PASS: 10. Multi-project customer Total Receivables = ₹70,000 (excluded A, B, E)');

  // 11: Dynamic status changes (Pending Approval -> Confirmed, Active -> Closed)
  projects[0].status = 'CONFIRMED_PROJECT'; // +40,000 => 110,000
  assert.strictEqual(computeCustomerStatsFromProjects(custId, projects).outstandingBalance, 110000);

  projects[3].status = 'CLOSED'; // -40,000 => 70,000
  assert.strictEqual(computeCustomerStatsFromProjects(custId, projects).outstandingBalance, 70000);

  projects[1].status = 'SCHEDULED'; // +30,000 => 100,000
  assert.strictEqual(computeCustomerStatsFromProjects(custId, projects).outstandingBalance, 100000);

  projects[1].status = 'REMOVAL_PENDING'; // still eligible => 100,000
  assert.strictEqual(computeCustomerStatsFromProjects(custId, projects).outstandingBalance, 100000);
  console.log('  ✓ PASS: 11. Status transitions dynamically update receivables');

  // 12: Payment received reduces receivables dynamically
  projects[2].paymentReceived = 25000; // C balance drops from 30,000 to 15,000 => 85,000
  assert.strictEqual(computeCustomerStatsFromProjects(custId, projects).outstandingBalance, 85000);
  console.log('  ✓ PASS: 12. Payment receipt decreases receivables dynamically');

  console.log('---------------------------------------------------------------');
  console.log('Customer Total Receivables Eligibility: All Tests Passed 100%');
  console.log('---------------------------------------------------------------\n');
}

runCustomerReceivablesEligibilityTests();

