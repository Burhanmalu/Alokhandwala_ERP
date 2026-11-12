import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { dbStore } from '../src/lib/db/store';
import { ChallanService } from '../src/lib/services/challan-service';

export async function runChallanManagementTests() {
  console.log('\n===============================================================');
  console.log('CHALLAN MANAGEMENT MODULE TEST SUITE');
  console.log('===============================================================');

  // 1. Sidebar contains Challan link under Core Modules
  const sidebarSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/components/layout/Sidebar.tsx'),
    'utf8'
  );
  assert.ok(sidebarSrc.includes('href="/challans"'), 'Sidebar contains /challans route');
  assert.ok(sidebarSrc.includes('<span>Challan</span>'), 'Sidebar displays Challan link');
  console.log('  ✓ PASS: 1. Challan link verified in Sidebar Core Modules');

  // Seed a customer, site, and check warehouse inventory
  let testCustomerId = '';
  let testSiteId = '';
  let matAId = '';
  let matBId = '';

  await dbStore.transaction(async (state) => {
    const cust = state.customers[0] || {
      id: 'cust-chl-test',
      customerCode: 'CUST-9901',
      companyName: 'Challan Test Builders',
      contactPerson: 'Challan Test Builders',
      phone: '+919999900001',
      billingAddress: 'Indore MP',
      status: 'ACTIVE' as const,
      creditLimit: 500000,
      outstandingBalance: 0,
      sitesCount: 1,
      projectsCount: 0,
      activeRentalsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (!state.customers.find(c => c.id === cust.id)) {
      state.customers.push(cust);
    }
    testCustomerId = cust.id;

    let site = state.sites.find(s => s.customerId === cust.id);
    if (!site) {
      site = {
        id: 'site-chl-test',
        siteCode: 'SITE-9901',
        customerId: cust.id,
        customerName: cust.companyName,
        siteName: 'Challan Tower Site',
        siteAddress: 'Vijay Nagar, Indore',
        city: 'Indore',
        state: 'Madhya Pradesh',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };
      state.sites.push(site);
    }
    testSiteId = site.id;

    // Ensure enough usable stock on first two materials
    const matA = state.materials[0];
    const matB = state.materials[1];
    assert.ok(matA && matB, 'Seed materials exist');
    if (matA.usableWarehouseQty - matA.reservedQty < 200) {
      matA.usableWarehouseQty += 200;
      matA.totalOwnedQty += 200;
      matA.availableToAllocate = matA.usableWarehouseQty - matA.reservedQty;
    }
    if (matB.usableWarehouseQty - matB.reservedQty < 200) {
      matB.usableWarehouseQty += 200;
      matB.totalOwnedQty += 200;
      matB.availableToAllocate = matB.usableWarehouseQty - matB.reservedQty;
    }
    matAId = matA.id;
    matBId = matB.id;
  });

  const beforeA = dbStore.getMaterials().find(m => m.id === matAId)!;
  const beforeB = dbStore.getMaterials().find(m => m.id === matBId)!;
  const initUsableA = beforeA.usableWarehouseQty;
  const initSiteA = beforeA.siteAllocatedQty;
  const initMissingA = beforeA.missingQty;
  const initUsableB = beforeB.usableWarehouseQty;

  // 2. Create Challan with Output 100 A + 50 B, Initial Return 60 A + 50 B -> Pending 40 A (UNCLOSED)
  const reqId = `req-chl-test-${Date.now()}`;
  const created = await ChallanService.createChallan({
    customerId: testCustomerId,
    siteId: testSiteId,
    size: '20 (W) × 6 (D) × 30 (H) FEET',
    outputEntries: [
      { date: '2026-11-01', materialId: matAId, quantity: 100 },
      { date: '2026-11-01', materialId: matBId, quantity: 50 },
    ],
    inputEntries: [
      { date: '2026-11-05', materialId: matAId, quantity: 60 },
      { date: '2026-11-05', materialId: matBId, quantity: 50 },
    ],
    clientRequestId: reqId,
    actorId: 'usr-admin-01',
    actorName: 'Burhan Malu (Admin)',
  });

  assert.match(created.challanNumber, /^CHL-\d{4}-\d{6}$/);
  assert.strictEqual(created.totalOutputQuantity, 150);
  assert.strictEqual(created.totalReturnedQuantity, 110);
  assert.strictEqual(created.pendingQuantity, 40);
  assert.strictEqual(created.remainingAtSiteQuantity, 40);
  assert.strictEqual(created.status, 'UNCLOSED');

  // Verify duplicate clientRequestId returns same challan without double-deduction
  const dupAttempt = await ChallanService.createChallan({
    customerId: testCustomerId,
    siteId: testSiteId,
    size: '20 (W) × 6 (D) × 30 (H) FEET',
    outputEntries: [{ date: '2026-11-01', materialId: matAId, quantity: 100 }],
    clientRequestId: reqId,
    actorId: 'usr-admin-01',
    actorName: 'Burhan Malu (Admin)',
  });
  assert.strictEqual(dupAttempt.id, created.id);

  // Verify warehouse inventory net outflow: A issued 100 - returned 60 = 40 deducted; B issued 50 - returned 50 = 0
  const afterCreateA = dbStore.getMaterials().find(m => m.id === matAId)!;
  const afterCreateB = dbStore.getMaterials().find(m => m.id === matBId)!;
  assert.strictEqual(afterCreateA.usableWarehouseQty, initUsableA - 40);
  assert.strictEqual(afterCreateA.siteAllocatedQty, initSiteA + 40);
  assert.strictEqual(afterCreateB.usableWarehouseQty, initUsableB);
  console.log('  ✓ PASS: 2. Challan created, auto-numbered, idempotent, and warehouse inventory updated accurately');

  // 3. Guard: cannot return more than issued OR unissued material; cannot close while pending > 0
  let excessRejected = false;
  try {
    await ChallanService.addReturnEntries(
      created.id,
      [{ date: '2026-11-08', materialId: matAId, quantity: 45 }],
      'usr-admin-01',
      'Burhan Malu (Admin)'
    );
  } catch (err: any) {
    excessRejected = /exceed issued quantity/i.test(err.message);
  }
  assert.strictEqual(excessRejected, true, 'Return exceeding issued quantity rejected');

  let prematureCloseRejected = false;
  try {
    await ChallanService.closeChallan(created.id, 'usr-admin-01', 'Burhan Malu (Admin)');
  } catch (err: any) {
    prematureCloseRejected = /pending reconciliation/i.test(err.message);
  }
  assert.strictEqual(prematureCloseRejected, true, 'Unreconciled challan cannot be closed');
  console.log('  ✓ PASS: 3. Validation blocks excess returns and premature closure');

  // 4. Edit Challan without changing quantities -> zero duplicate inventory delta
  const editedNoQtyChange = await ChallanService.updateChallan(created.id, {
    customerId: testCustomerId,
    siteId: testSiteId,
    size: '20 (W) × 6 (D) × 30 (H) FEET',
    outputEntries: created.outputEntries,
    inputEntries: created.inputEntries,
    notes: 'Updated site remarks only',
    actorId: 'usr-admin-01',
    actorName: 'Burhan Malu (Admin)',
  });
  const afterNoopEditA = dbStore.getMaterials().find(m => m.id === matAId)!;
  assert.strictEqual(afterNoopEditA.usableWarehouseQty, initUsableA - 40, 'No duplicate deduction on edit');
  assert.strictEqual(editedNoQtyChange.notes, 'Updated site remarks only');
  console.log('  ✓ PASS: 4. Editing challan preserves exact warehouse stock without duplicate deltas');

  // 5. Return 30 A + Mark 10 A Lost/Missing & Approve -> Remaining at site = 0, Lost NOT added to usable stock, Status CLOSED
  await ChallanService.addReturnEntries(
    created.id,
    [{ date: '2026-11-10', materialId: matAId, quantity: 30 }],
    'usr-admin-01',
    'Burhan Malu (Admin)'
  );
  const afterSecondReturnA = dbStore.getMaterials().find(m => m.id === matAId)!;
  assert.strictEqual(afterSecondReturnA.usableWarehouseQty, initUsableA - 10);

  const afterLoss = await ChallanService.recordLostMaterials(
    created.id,
    [{ date: '2026-11-11', materialId: matAId, quantity: 10, reason: '10 pipes lost during dismantling' }],
    true,
    'usr-admin-01',
    'Burhan Malu (Admin)'
  );
  assert.strictEqual(afterLoss.remainingAtSiteQuantity, 0);
  assert.strictEqual(afterLoss.totalLostQuantity, 10);
  assert.strictEqual(afterLoss.hasLostMaterials, true);
  assert.strictEqual(afterLoss.status, 'CLOSED');

  const finalMatA = dbStore.getMaterials().find(m => m.id === matAId)!;
  assert.strictEqual(finalMatA.usableWarehouseQty, initUsableA - 10, 'Lost items must NOT enter usable warehouse stock');
  assert.strictEqual(finalMatA.siteAllocatedQty, initSiteA, 'Site allocation cleared cleanly');
  assert.strictEqual(finalMatA.missingQty, initMissingA + 10, 'Missing ledger incremented by lost quantity');

  // Conservation equation verification across all materials
  for (const m of dbStore.getMaterials()) {
    const sum = m.usableWarehouseQty + m.siteAllocatedQty + m.inTransitQty + m.damagedQty + m.missingQty;
    assert.strictEqual(sum, m.totalOwnedQty, `Stock conservation preserved for ${m.name}`);
  }
  console.log('  ✓ PASS: 5. Incremental returns, lost/missing separation, closure & stock conservation verified');

  // 6. Clean up via deleteChallan
  const del = await ChallanService.deleteChallan(created.id, 'usr-admin-01', 'Burhan Malu (Admin)');
  assert.strictEqual(del.challanNumber, created.challanNumber);
  assert.strictEqual(dbStore.getChallans().find(c => c.id === created.id), undefined);
  const restoredA = dbStore.getMaterials().find(m => m.id === matAId)!;
  assert.strictEqual(restoredA.usableWarehouseQty, initUsableA);
  assert.strictEqual(restoredA.missingQty, initMissingA);
  console.log('  ✓ PASS: 6. Delete challan removes record and restores inventory cleanly');

  console.log('---------------------------------------------------------------');
  console.log('Challan Management Module: All Tests Passed 100%');
  console.log('---------------------------------------------------------------');
}

if (require.main === module) {
  runChallanManagementTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

