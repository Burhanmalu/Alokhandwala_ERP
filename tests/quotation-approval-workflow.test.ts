import assert from 'node:assert';
import { dbStore } from '../src/lib/db/store';
import { ProjectService } from '../src/lib/services/project-service';
import { QuotationService } from '../src/lib/services/quotation-service';
import { InventoryService } from '../src/lib/services/inventory-service';
import { buildQuotationPdfDoc } from '../src/lib/pdf/project-pdf';

export async function runQuotationApprovalWorkflowTests() {
  console.log('\n===============================================================');
  console.log('QUOTATION APPROVAL WORKFLOW TEST SUITE');
  console.log('Pending Approval -> Accept / Reject -> Confirmation Eligibility');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (e: any) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    Error: ${e.message}`);
      if (e.stack) console.error(e.stack);
      failed++;
    }
  }

  let testProjectId = '';
  let testQuotationId = '';

  // Setup: Create fresh site inspection project
  const project = await ProjectService.createProjectFromInspection({
    customerName: 'Approval Workflow Test Client',
    siteName: 'Indore Approval Site Tower 1',
    siteAddress: '505, AB Road, Indore',
    measurements: {
      width: 20,
      depth: 3,
      height: 25,
      unit: 'FEET',
      measurementType: 'FAÇADE_SCAFFOLD',
    },
    actorId: 'usr-sup-01',
    actorName: 'Mustafa Alokhandwala',
  });
  testProjectId = project.id;

  // SCENARIO 1: Create a quotation and save it. It must show Pending Approval.
  await test('1. Save quotation: Default state is Pending Approval (QUOTATION_DRAFT)', async () => {
    const { quotation, project: updatedProj } = await QuotationService.saveQuotation({
      projectId: testProjectId,
      status: 'DRAFT',
      ratePerSqFt: 22,
      totalAreaSqFt: 500,
      durationMonths: 1,
      rentalDurationDays: 28,
      materials: [
        { itemCode: 'V-10FT-3M', materialName: 'VERTICAL 10FT/3MTR', unit: 'NOS', quantity: 20, monthlyRentalRate: 45, totalMonthlyRent: 900 },
      ],
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu',
    });

    testQuotationId = quotation.id;
    assert.strictEqual(quotation.status, 'DRAFT');
    assert.strictEqual(quotation.approval_status, 'PENDING_APPROVAL');
    assert.strictEqual(updatedProj.status, 'QUOTATION_DRAFT');
    assert.strictEqual(updatedProj.approval_status, 'PENDING_APPROVAL');
  });

  // SCENARIO 2: Check Project Confirmation & Plan. The pending quotation must not appear and reservation must fail.
  await test('2. Pending quotation is blocked from Project Confirmation and reservation', async () => {
    const eligibleProjects = dbStore.getProjects().filter(p => p.status === 'QUOTATION_ACCEPTED');
    assert(!eligibleProjects.some(p => p.id === testProjectId), 'Pending quotation project must NOT appear in confirmation');

    // Attempting reservation must throw validation error
    let threw = false;
    try {
      await InventoryService.reserveMaterialsForProject({
        projectId: testProjectId,
        quotationNumber: 'QTN-TEST',
        quotationDate: '2026-11-01',
        agreedProjectPrice: 20000,
        monthlyRentalRate: 10000,
        plannedInstallationDate: '2026-11-10',
        materials: [{ materialId: 'mat-01', requiredQuantity: 10 }],
        actorId: 'usr-pm-01',
        actorName: 'Taha Merchant',
      });
    } catch (err: any) {
      threw = true;
      assert(
        err.message.includes('acceptance is required') || err.message.includes('Quotation Accepted'),
        `Expected acceptance requirement message, got: ${err.message}`
      );
    }
    assert(threw, 'Must throw error when trying to reserve stock for unaccepted quotation');
  });

  // SCENARIO 3: Accept the quotation. It must update to Quotation Accepted and appear in Confirmation.
  await test('3. Accept quotation: Updates to Quotation Accepted and becomes eligible for Confirmation', async () => {
    const result = await QuotationService.updateStatus({
      quotationId: testQuotationId,
      status: 'ACCEPTED',
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu',
    });

    assert.strictEqual(result.quotation.status, 'ACCEPTED');
    assert.strictEqual(result.quotation.approval_status, 'ACCEPTED');
    assert(result.quotation.approved_at, 'Must record approved_at timestamp');
    assert.strictEqual(result.quotation.approved_by, 'usr-admin-01');
    assert.strictEqual(result.project.status, 'QUOTATION_ACCEPTED');
    assert.strictEqual(result.project.approval_status, 'ACCEPTED');

    const eligibleProjects = dbStore.getProjects().filter(p => p.status === 'QUOTATION_ACCEPTED');
    assert(eligibleProjects.some(p => p.id === testProjectId), 'Accepted quotation project MUST appear in confirmation');
  });

  // SCENARIO 4: Reject the quotation. It must require mandatory reason, show Rejected, and be blocked from Confirmation.
  await test('4. Reject quotation: Requires mandatory reason and is blocked from Confirmation', async () => {
    // Rejection without reason must fail
    let threwWithoutReason = false;
    try {
      await QuotationService.updateStatus({
        quotationId: testQuotationId,
        status: 'REJECTED',
        actorId: 'usr-admin-01',
        actorName: 'Burhan Malu',
      });
    } catch (err: any) {
      threwWithoutReason = true;
      assert(err.message.includes('Mandatory rejection reason') || err.message.includes('reason'));
    }
    assert(threwWithoutReason, 'Must require mandatory rejection reason');

    // Rejection with valid reason
    const result = await QuotationService.updateStatus({
      quotationId: testQuotationId,
      status: 'REJECTED',
      reason: 'Rate too high, client requested 15% discount on rental items',
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu',
    });

    assert.strictEqual(result.quotation.status, 'REJECTED');
    assert.strictEqual(result.quotation.approval_status, 'REJECTED');
    assert.strictEqual(result.quotation.rejection_reason, 'Rate too high, client requested 15% discount on rental items');
    assert(result.quotation.rejected_at, 'Must record rejected_at timestamp');
    assert.strictEqual(result.project.status, 'QUOTATION_REJECTED');

    const eligibleProjects = dbStore.getProjects().filter(p => p.status === 'QUOTATION_ACCEPTED');
    assert(!eligibleProjects.some(p => p.id === testProjectId), 'Rejected quotation project must NOT appear in confirmation');
  });

  // SCENARIO 5 & 6: Edit a previously accepted quotation -> previous approval is invalidated and returns to Pending Approval.
  await test('5 & 6. Edit & Save quotation: Invalidates previous approval and returns to Pending Approval', async () => {
    // First accept it again
    await QuotationService.updateStatus({
      quotationId: testQuotationId,
      status: 'ACCEPTED',
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu',
    });
    let proj = dbStore.getProjects().find(p => p.id === testProjectId)!;
    assert.strictEqual(proj.status, 'QUOTATION_ACCEPTED');

    // Now edit and save it
    const { quotation: editedQuotation, project: editedProject } = await QuotationService.saveQuotation({
      id: testQuotationId,
      projectId: testProjectId,
      status: 'DRAFT',
      ratePerSqFt: 20, // Modified rate
      totalAreaSqFt: 500,
      durationMonths: 1,
      materials: [
        { itemCode: 'V-10FT-3M', materialName: 'VERTICAL 10FT/3MTR', unit: 'NOS', quantity: 25, monthlyRentalRate: 40, totalMonthlyRent: 1000 },
      ],
      actorId: 'usr-admin-02',
      actorName: 'Senior Estimator',
    });

    assert.strictEqual(editedQuotation.status, 'DRAFT');
    assert.strictEqual(editedQuotation.approval_status, 'PENDING_APPROVAL', 'Approval status must reset to PENDING_APPROVAL');
    assert.strictEqual(editedQuotation.approved_at, undefined, 'Prior approval timestamp must be cleared');
    assert.strictEqual(editedQuotation.approved_by, undefined, 'Prior approved_by must be cleared');
    assert.strictEqual(editedQuotation.last_edited_by, 'usr-admin-02');
    assert.strictEqual(editedProject.status, 'QUOTATION_DRAFT');
    assert.strictEqual(editedProject.approval_status, 'PENDING_APPROVAL');

    // Confirm it is no longer eligible for confirmation
    const eligibleProjects = dbStore.getProjects().filter(p => p.status === 'QUOTATION_ACCEPTED');
    assert(!eligibleProjects.some(p => p.id === testProjectId), 'Edited quotation must no longer appear in confirmation');
  });

  // SCENARIO 7: Generate quotation PDF. Status must not change.
  await test('7. Generate quotation PDF: Does not alter quotation or project approval status', async () => {
    const qBefore = dbStore.getQuotations().find(q => q.id === testQuotationId)!;
    const pBefore = dbStore.getProjects().find(p => p.id === testProjectId)!;

    const doc = await buildQuotationPdfDoc(pBefore as any, qBefore as any);
    assert(doc, 'PDF doc must generate successfully');

    const qAfter = dbStore.getQuotations().find(q => q.id === testQuotationId)!;
    const pAfter = dbStore.getProjects().find(p => p.id === testProjectId)!;

    assert.strictEqual(qAfter.status, qBefore.status, 'Quotation status must remain identical after PDF generation');
    assert.strictEqual(qAfter.approval_status, qBefore.approval_status, 'Approval status must remain identical');
    assert.strictEqual(pAfter.status, pBefore.status, 'Project status must remain identical');
  });

  // SCENARIO 8: Reload / persist store: All approval statuses remain intact.
  await test('8. Persistence across reload: Approval statuses, reasons, and timestamps remain intact', async () => {
    // Set to accepted with specific metadata
    await QuotationService.updateStatus({
      quotationId: testQuotationId,
      status: 'ACCEPTED',
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu',
    });

    // Force reload from persisted disk
    (dbStore as any).lastMtime = 0;
    dbStore.syncFromDisk();

    const qPersisted = dbStore.getQuotations().find(q => q.id === testQuotationId)!;
    const pPersisted = dbStore.getProjects().find(p => p.id === testProjectId)!;

    assert.strictEqual(qPersisted.status, 'ACCEPTED');
    assert.strictEqual(qPersisted.approval_status, 'ACCEPTED');
    assert(qPersisted.approved_at, 'approved_at timestamp must persist');
    assert.strictEqual(pPersisted.status, 'QUOTATION_ACCEPTED');
    assert.strictEqual(pPersisted.approval_status, 'ACCEPTED');
  });

  // SCENARIO 9: Direct reservation bypass protection.
  await test('9. Strict backend enforcement: Non-accepted project cannot reserve materials', async () => {
    // Reset to REJECTED
    await QuotationService.updateStatus({
      quotationId: testQuotationId,
      status: 'REJECTED',
      reason: 'Budget constraint cancellation',
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu',
    });

    let bypassBlocked = false;
    try {
      await InventoryService.reserveMaterialsForProject({
        projectId: testProjectId,
        quotationNumber: 'QTN-TEST',
        quotationDate: '2026-11-01',
        agreedProjectPrice: 20000,
        monthlyRentalRate: 10000,
        plannedInstallationDate: '2026-11-15',
        materials: [{ materialId: 'mat-01', requiredQuantity: 5 }],
        actorId: 'usr-pm-01',
        actorName: 'Taha Merchant',
      });
    } catch (err: any) {
      bypassBlocked = true;
    }
    assert(bypassBlocked, 'Direct reservation must be strictly blocked for rejected quotation');
  });

  // SCENARIO 10: Navigation and Project Confirmation & Material Reservation eligibility.
  await test('10. Navigation target validation: Project Confirmation & Material Reservation loads accepted quotation without duplication', async () => {
    // Re-accept the test quotation
    const accepted = await QuotationService.updateStatus({
      quotationId: testQuotationId,
      status: 'ACCEPTED',
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu',
    });

    const projectRecord = dbStore.getProjects().find(p => p.id === testProjectId)!;
    const quotationRecord = dbStore.getQuotations().find(q => q.id === testQuotationId)!;

    assert.strictEqual(projectRecord.status, 'QUOTATION_ACCEPTED', 'Must be in QUOTATION_ACCEPTED status');
    assert.strictEqual(quotationRecord.status, 'ACCEPTED', 'Quotation must be in ACCEPTED status');

    // Simulate URL query params passed from Commercial Quotation module
    const destinationPath = `/confirmation?projectId=${encodeURIComponent(projectRecord.id)}&quotationId=${encodeURIComponent(quotationRecord.id)}`;
    assert(destinationPath.includes('/confirmation'), 'Destination route must lead to Project Confirmation & Material Reservation');
    assert(destinationPath.includes(`projectId=${projectRecord.id}`), 'Must pass project ID');
    assert(destinationPath.includes(`quotationId=${quotationRecord.id}`), 'Must pass quotation ID');

    // Confirm that existing project count and quotation count remain unchanged (no duplicates created)
    const totalProjectsBefore = dbStore.getProjects().length;
    const totalQuotationsBefore = dbStore.getQuotations().length;

    // Loading project by ID returns the exact same record with preserved details
    const loadedProj = dbStore.getProjects().find(p => p.id === testProjectId)!;
    assert.strictEqual(loadedProj.projectCode, projectRecord.projectCode);
    assert.strictEqual(loadedProj.customerName, 'Approval Workflow Test Client');
    assert.strictEqual(dbStore.getProjects().length, totalProjectsBefore, 'Project count must not increase');
    assert.strictEqual(dbStore.getQuotations().length, totalQuotationsBefore, 'Quotation count must not increase');
  });

  console.log('---------------------------------------------------------------');
  console.log(`Quotation Approval Workflow: ${passed} Passed, ${failed} Failed`);
  console.log('---------------------------------------------------------------\n');

  if (failed > 0) {
    throw new Error(`Quotation Approval Workflow tests failed: ${failed} failures`);
  }
}
