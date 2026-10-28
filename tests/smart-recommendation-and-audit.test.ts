// Alokhandwala Scaffolding ERP - Smart Material Recommendation & Comprehensive Audit Test Suite

process.env.NODE_ENV = 'test';
process.env.IS_TEST = 'true';

import assert from 'assert';
import { dbStore } from '../src/lib/db/store';
import { ScaffoldingCalculatorService } from '../src/lib/services/scaffolding-calculator';
import { InventoryService } from '../src/lib/services/inventory-service';
import { ProjectService } from '../src/lib/services/project-service';

export async function runAuditTests() {
  console.log('\n===============================================================');
  console.log('SMART RECOMMENDATION & FULL REPOSITORY AUDIT TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;
  dbStore.resetToSeed();

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (e: any) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error('    Error:', e.message);
      failed++;
    }
  }

  // TEST 1: Generate 4 Smart Scaffolding Plans for 60x40x20 ft
  await test('1. Generates 4 valid scaffolding plans for 60x40x20 ft site dimensions', async () => {
    const res = await ScaffoldingCalculatorService.generatePlans({
      length: 60,
      width: 40,
      height: 20,
      unit: 'FEET',
      configurationType: 'PERIMETER_FACADE',
      facadeFaces: '4_SIDES_PERIMETER',
      deckLevels: 'TOP_DECK_ONLY',
      baySpacingPreference: 8,
      jaliPreference: 'MS',
    });

    assert(res.options.length === 4, 'Must return exactly 4 distinct plan options');
    
    const planIds = res.options.map(o => o.planId);
    assert(planIds.includes('PLAN_STANDARD'), 'Must include Standard Plan');
    assert(planIds.includes('PLAN_STOCK_OPTIMIZED'), 'Must include Stock-Optimized Plan');
    assert(planIds.includes('PLAN_ALTERNATIVE_HEAVY'), 'Must include Alternative Heavy-Duty Plan');
    assert(planIds.includes('PLAN_PROCUREMENT_HYBRID'), 'Must include Procurement Hybrid Plan');

    // Check components in Standard Plan
    const stdPlan = res.options.find(o => o.planId === 'PLAN_STANDARD')!;
    const itemCodes = stdPlan.materials.map(m => m.itemCode);

    assert(itemCodes.some(c => c.startsWith('V-')), 'Must include Vertical Standards');
    assert(itemCodes.some(c => c.startsWith('L-')), 'Must include Horizontal Ledgers & Transoms');
    assert(itemCodes.includes('JACK-BASE'), 'Must include Base Jacks');
    assert(itemCodes.includes('BASE-PLATE-STD'), 'Must include Base Plates');
    assert(itemCodes.includes('CPL-SWIVEL'), 'Must include Swivel Couplers for diagonal braces');
    assert(itemCodes.includes('CPL-FIXED'), 'Must include Fixed Couplers');
    assert(itemCodes.includes('JALI-8FT-MS'), 'Must include Walkway Jali Planks');
    assert(itemCodes.includes('TOE-BOARD-8FT'), 'Must include Safety Toe Boards');

    assert(stdPlan.totals.totalPieces > 0, 'Total pieces must be positive');
    assert(stdPlan.totals.totalWeightKg > 0, 'Total tare weight must be positive');
    assert(stdPlan.totals.totalMonthlyRental > 0, 'Monthly rental estimate must be positive');
  });

  // TEST 2: Metric dimension conversion and normalization
  await test('2. Accurately normalizes metric site dimensions (e.g. 18.3m x 12.2m x 6.1m)', async () => {
    const res = await ScaffoldingCalculatorService.generatePlans({
      length: 18.288,
      width: 12.192,
      height: 6.096,
      unit: 'METERS',
      configurationType: 'PERIMETER_FACADE',
      facadeFaces: '4_SIDES_PERIMETER',
    });

    assert.strictEqual(Math.round(res.normalizedDimensions.lengthFt), 60);
    assert.strictEqual(Math.round(res.normalizedDimensions.widthFt), 40);
    assert.strictEqual(Math.round(res.normalizedDimensions.heightFt), 20);
  });

  // TEST 3: Birdcage Slab Support 3D Grid Calculation
  await test('3. Calculates full 3D birdcage slab support volume matrix correctly', async () => {
    const res = await ScaffoldingCalculatorService.generatePlans({
      length: 40,
      width: 32,
      height: 15,
      unit: 'FEET',
      configurationType: 'BIRDCAGE_VOLUME',
    });

    const stdPlan = res.options.find(o => o.planId === 'PLAN_STANDARD')!;
    assert(stdPlan.configurationSummary.totalVerticalStandardsGrid > 20, 'Birdcage requires full grid standards');
    assert(stdPlan.materials.some(m => m.itemCode === 'JACK-BASE'));
  });

  // TEST 4: Partial Stock / Procurement Hybrid Plan caps reservations
  await test('4. Option 4 strictly caps proposed reservation to physical warehouse availability', async () => {
    // artifically drain one item
    await dbStore.transaction((state) => {
      const mat = state.materials.find(m => m.itemCode === 'L-8FT-2.5M')!;
      mat.usableWarehouseQty = 10;
      mat.reservedQty = 0;
      mat.availableToAllocate = 10;
    });

    const res = await ScaffoldingCalculatorService.generatePlans({
      length: 60,
      width: 40,
      height: 20,
      unit: 'FEET',
      configurationType: 'PERIMETER_FACADE',
    });

    const procPlan = res.options.find(o => o.planId === 'PLAN_PROCUREMENT_HYBRID')!;
    const item = procPlan.materials.find(m => m.itemCode === 'L-8FT-2.5M')!;

    assert(item.proposedReserveQty <= 10, 'Option 4 proposed reservation MUST NOT exceed available stock (10)');
    assert(item.shortageQty > 0, 'Shortage must be accurately recorded');
    assert(procPlan.totals.estimatedProcurementCost > 0, 'Procurement replacement cost must be estimated');

    // Restore drained item for subsequent conservation checks
    await dbStore.transaction((state) => {
      const mat = state.materials.find(m => m.itemCode === 'L-8FT-2.5M')!;
      mat.usableWarehouseQty = 4000;
      mat.availableToAllocate = 4000;
    });
  });

  // TEST 5: Atomic Reservation with Scaffolding Plan Attachment
  await test('5. Project confirmation stores scaffoldingPlan and reserves stock atomically', async () => {
    let projId = '';
    await dbStore.transaction((state) => {
      state.projects = state.projects.filter(p => p.id !== 'proj-audit-01');
      state.customers = state.customers.filter(c => c.id !== 'cust-audit');
      state.customers.push({
        id: 'cust-audit',
        customerCode: 'CUST-AUDIT',
        companyName: 'Audit Infra Ltd',
        referenceName: 'Audit Infra',
        contactPerson: 'Adnan',
        phone: '9820000000',
        billingAddress: 'Indore',
        city: 'Indore',
        state: 'Madhya Pradesh',
        status: 'ACTIVE',
        creditLimit: 1000000,
        outstandingBalance: 0,
        sitesCount: 1,
        projectsCount: 1,
        activeRentalsCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      state.projects.push({
        id: 'proj-audit-01',
        projectCode: 'AW-SCF-AUDIT01',
        customerId: 'cust-audit',
        customerName: 'Audit Infra Ltd',
        siteId: 'site-audit',
        siteName: 'Indore Hub',
        siteAddress: 'Indore MP',
        assignedSupervisorId: 'usr-sup-01',
        supervisorName: 'Mustafa Alokhandwala',
        status: 'NOT_INSTALLED',
        pricingModel: 'MONTHLY_RENTAL',
        monthlyRentalRate: 50000,
        agreedProjectPrice: 75000,
        depositAmount: 20000,
        transportCharges: 5000,
        installationLabourCharges: 10000,
        shiftingCharges: 0,
        dismantlingLabourCharges: 10000,
        gstPercentage: 18,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      projId = 'proj-audit-01';
    });

    const mat = dbStore.getMaterials()[0];
    const availBefore = mat.usableWarehouseQty - mat.reservedQty;

    const confirmRes = await InventoryService.reserveMaterialsForProject({
      projectId: projId,
      quotationNumber: 'QTN-AUDIT-001',
      quotationDate: '2026-03-01',
      agreedProjectPrice: 75000,
      monthlyRentalRate: 50000,
      plannedInstallationDate: '2026-03-05',
      durationMonths: 1,
      materials: [{ materialId: mat.id, requiredQuantity: 100, monthlyRentalRate: mat.rentalRatePerMonth }],
      scaffoldingPlan: { planId: 'PLAN_STANDARD', planName: 'Standard Plan' } as any,
      siteDimensions: { length: 60, width: 40, height: 20, unit: 'FEET', configurationType: 'PERIMETER_FACADE' },
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu',
    });

    assert.strictEqual(confirmRes.project.status, 'CONFIRMED_PROJECT');
    assert.strictEqual(confirmRes.project.scaffoldingPlan?.planId, 'PLAN_STANDARD');
    assert.strictEqual(confirmRes.project.siteDimensions?.length, 60);

    const matAfter = dbStore.getMaterials().find(m => m.id === mat.id)!;
    assert.strictEqual(matAfter.reservedQty, 100);
    assert.strictEqual(matAfter.availableToAllocate, availBefore - 100);
  });

  // TEST 6: Reservation Release Restores Available Stock
  await test('6. Release reservation restores reserved stock to warehouse available pool', async () => {
    const proj = dbStore.getProjects().find(p => p.id === 'proj-audit-01')!;
    const mat = dbStore.getMaterials().find(m => m.id === proj.materials![0].materialId)!;
    const availBefore = mat.availableToAllocate;

    const releaseRes = await InventoryService.releaseProjectReservation({
      projectId: proj.id,
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu',
      reason: 'Client postponement',
    });

    assert.strictEqual(releaseRes.project.status, 'NOT_INSTALLED');
    assert.strictEqual(releaseRes.transaction.movementType, 'RESERVATION_RELEASE');

    const matAfter = dbStore.getMaterials().find(m => m.id === mat.id)!;
    assert.strictEqual(matAfter.reservedQty, 0);
    assert.strictEqual(matAfter.availableToAllocate, availBefore + 100);
  });

  // TEST 7: Reservation Revision with Delta Validation
  await test('7. Revise reservation checks delta against available stock and commits atomically', async () => {
    // Re-reserve 50 units
    const proj = dbStore.getProjects().find(p => p.id === 'proj-audit-01')!;
    const mat = dbStore.getMaterials()[0];

    await InventoryService.reserveMaterialsForProject({
      projectId: proj.id,
      quotationNumber: 'QTN-AUDIT-002',
      quotationDate: '2026-03-01',
      agreedProjectPrice: 75000,
      monthlyRentalRate: 50000,
      plannedInstallationDate: '2026-03-05',
      durationMonths: 1,
      materials: [{ materialId: mat.id, requiredQuantity: 50, monthlyRentalRate: mat.rentalRatePerMonth }],
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu',
    });

    // Revise up to 80 units (+30 delta)
    const reviseRes = await InventoryService.reviseProjectReservation({
      projectId: proj.id,
      materials: [{ materialId: mat.id, requiredQuantity: 80, monthlyRentalRate: mat.rentalRatePerMonth }],
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu',
      reason: 'Increased height requirements',
    });

    const projAfter = dbStore.getProjects().find(p => p.id === proj.id)!;
    assert.strictEqual(projAfter.materials![0].reservedQuantity, 80);

    const matAfter = dbStore.getMaterials().find(m => m.id === mat.id)!;
    assert.strictEqual(matAfter.reservedQty, 80);
  });

  // TEST 8: Installation with Supervisor Comparison, Worker Roster & Actual Dimensions
  await test('8. Installation logs supervisor comparison, worker roster, and actual size verification', async () => {
    const proj = dbStore.getProjects().find(p => p.id === 'proj-audit-01')!;
    const mat = dbStore.getMaterials().find(m => m.id === proj.materials![0].materialId)!;

    const installRes = await InventoryService.submitInstallation({
      projectId: proj.id,
      actualInstallationDate: '2026-03-05T10:00:00Z',
      supervisorId: 'usr-sup-02', // Delegated to supervisor 2!
      executingSupervisorName: 'Shabbir Contractor',
      isSameSupervisor: false,
      supervisorDelegationRemarks: 'Assigned supervisor on emergency leave',
      workersList: [
        { name: 'Kailash Yadav', role: 'Lead Scaffolder' },
        { name: 'Rameshwar Lal', role: 'Rigger' },
      ],
      actualMeasurements: {
        length: 62, // +2ft variance
        width: 40,
        height: 20,
        unit: 'FEET',
        isCorrect: true,
        variancePercentage: 3.3,
        remarks: 'Minor length extension for balcony clearance',
      },
      clientSignOff: true,
      clientRepresentativeName: 'Mr. Arvind',
      materialsUsed: [
        {
          materialId: mat.id,
          installedQuantity: 75,
          unusedReturnedQty: 5,
        },
      ],
      actorId: 'usr-sup-02',
      actorName: 'Shabbir Contractor',
    });

    assert.ok(installRes.project.status === 'INSTALLED' || installRes.project.status === 'ACTIVE_RENTAL');
    assert.strictEqual(installRes.project.installationSupervisor?.isSameSupervisor, false);
    assert.strictEqual(installRes.project.installationSupervisor?.delegationRemarks, 'Assigned supervisor on emergency leave');
    assert.strictEqual(installRes.project.installationWorkers?.length, 2);
    assert.strictEqual(installRes.project.actualMeasurements?.length, 62);
    assert.strictEqual(installRes.project.actualMeasurements?.variancePercentage, 3.3);

    // Reserved quantity should be cleared (0), site allocated is 75
    const matAfter = dbStore.getMaterials().find(m => m.id === mat.id)!;
    assert.strictEqual(matAfter.reservedQty, 0);
    assert.strictEqual(matAfter.siteAllocatedQty, 75);
  });

  // TEST 9: Universal Inventory Conservation Equation Check
  await test('9. Total Owned Stock conservation formula holds across all items', async () => {
    for (const m of dbStore.getMaterials()) {
      const computedTotal = m.usableWarehouseQty + m.siteAllocatedQty + m.inTransitQty + m.damagedQty + m.missingQty;
      assert.strictEqual(
        computedTotal, 
        m.totalOwnedQty, 
        `Conservation equation failed for ${m.name}: ${computedTotal} != ${m.totalOwnedQty}`
      );
      assert.strictEqual(
        m.availableToAllocate,
        m.usableWarehouseQty - m.reservedQty,
        `Available stock mismatch for ${m.name}`
      );
    }
  });

  console.log('\n---------------------------------------------------------------');
  console.log(`Smart Recommendation & Audit Results: ${passed} Passed, ${failed} Failed`);
  console.log('---------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Run when executed directly
runAuditTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
