// Alokhandwala Scaffolding ERP - Critical Business Rules Automated Verification Suite
// Tests all scenarios from Section 27 of the specifications

process.env.NODE_ENV = 'test';
process.env.IS_TEST = 'true';

import assert from 'assert';
import { dbStore } from '../src/lib/db/store';
import { ProjectService } from '../src/lib/services/project-service';
import { InventoryService } from '../src/lib/services/inventory-service';
import { RentalService } from '../src/lib/services/rental-service';
import { BillingService } from '../src/lib/services/billing-service';
import { addCalendarMonths, addDays, calculateGST } from '../src/lib/formatters';

async function runAllTests() {
  console.log('\n===============================================================');
  console.log('ALOKHANDWALA SCAFFOLDING ERP - CRITICAL TEST SUITE (Section 27)');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      // Fresh test state
      dbStore.resetToSeed();
      await dbStore.transaction((state) => {
        state.customers.push({
          id: 'cust-01',
          customerCode: 'CUST-0001',
          companyName: 'Godrej Properties Ltd.',
          referenceName: 'GPL Mumbai',
          contactPerson: 'Sanjay Deshmukh',
          phone: '+91 98201 11223',
          email: 'sanjay@godrejproperties.com',
          billingAddress: 'Godrej One, Vikhroli, Mumbai',
          city: 'Mumbai',
          state: 'Maharashtra',
          gstin: '27AAACG1234F1Z1',
          status: 'ACTIVE',
          creditLimit: 2500000,
          outstandingBalance: 0,
          sitesCount: 1,
          projectsCount: 1,
          activeRentalsCount: 0,
          createdAt: '2026-01-10T10:00:00Z',
          updatedAt: '2026-01-10T10:00:00Z',
        });
        state.sites.push({
          id: 'site-01',
          siteCode: 'SITE-0001',
          customerId: 'cust-01',
          customerName: 'Godrej Properties Ltd.',
          siteName: 'Godrej Sky Greens BKC Tower 1',
          siteAddress: 'Plot C-68, G Block, BKC, Bandra East, Mumbai',
          landmark: 'Near Asian Heart Institute',
          city: 'Mumbai',
          state: 'Maharashtra',
          contactPerson: 'Rahul Sharma',
          contactPhone: '+91 98201 99887',
          assignedSupervisorId: 'usr-sup-01',
          supervisorName: 'Mustafa Alokhandwala',
          status: 'ACTIVE',
          createdAt: '2026-01-10T10:00:00Z',
        });
        state.projects.push({
          id: 'proj-01',
          projectCode: 'AW-SCF-000001',
          customerId: 'cust-01',
          customerName: 'Godrej Properties Ltd.',
          siteId: 'site-01',
          siteName: 'Godrej Sky Greens BKC Tower 1',
          siteAddress: 'Plot C-68, G Block, BKC, Bandra East, Mumbai',
          assignedSupervisorId: 'usr-sup-01',
          supervisorName: 'Mustafa Alokhandwala',
          status: 'NOT_INSTALLED',
          pricingModel: 'MONTHLY_RENTAL',
          monthlyRentalRate: 98000,
          agreedProjectPrice: 145000,
          depositAmount: 50000,
          transportCharges: 15000,
          installationLabourCharges: 25000,
          shiftingCharges: 0,
          dismantlingLabourCharges: 20000,
          gstPercentage: 18,
          createdAt: '2026-01-11T10:00:00Z',
          updatedAt: '2026-01-11T10:00:00Z',
        });
        state.projects.push({
          id: 'proj-02',
          projectCode: 'AW-SCF-000002',
          customerId: 'cust-01',
          customerName: 'Godrej Properties Ltd.',
          siteId: 'site-01',
          siteName: 'Godrej Sky Greens BKC Tower 1',
          siteAddress: 'Plot C-68, G Block, BKC, Bandra East, Mumbai',
          assignedSupervisorId: 'usr-sup-01',
          supervisorName: 'Mustafa Alokhandwala',
          status: 'CONFIRMED_PROJECT',
          pricingModel: 'MONTHLY_RENTAL',
          monthlyRentalRate: 65000,
          agreedProjectPrice: 100000,
          depositAmount: 30000,
          transportCharges: 10000,
          installationLabourCharges: 15000,
          shiftingCharges: 0,
          dismantlingLabourCharges: 10000,
          gstPercentage: 18,
          materials: [
            { id: 'pm-01', projectId: 'proj-02', materialId: 'mat-01', materialName: 'VERTICAL 10FT/3MTR', itemCode: 'V-10FT-3M', unit: 'NOS', requiredQuantity: 100, reservedQuantity: 100, issuedQuantity: 0, installedQuantity: 0, returnedUsableQuantity: 0, returnedDamagedQuantity: 0, missingQuantity: 0, monthlyRentalRate: 65 }
          ],
          createdAt: '2026-01-12T10:00:00Z',
          updatedAt: '2026-01-12T10:00:00Z',
        });
        state.projects.push({
          id: 'proj-03',
          projectCode: 'AW-SCF-000003',
          customerId: 'cust-01',
          customerName: 'Godrej Properties Ltd.',
          siteId: 'site-01',
          siteName: 'Godrej Sky Greens BKC Tower 1',
          siteAddress: 'Plot C-68, G Block, BKC, Bandra East, Mumbai',
          assignedSupervisorId: 'usr-sup-01',
          supervisorName: 'Mustafa Alokhandwala',
          status: 'ACTIVE_RENTAL',
          pricingModel: 'MONTHLY_RENTAL',
          monthlyRentalRate: 75000,
          agreedProjectPrice: 120000,
          depositAmount: 30000,
          transportCharges: 10000,
          installationLabourCharges: 15000,
          shiftingCharges: 0,
          dismantlingLabourCharges: 10000,
          gstPercentage: 18,
          rentalStartDate: '2026-01-15',
          rentalEndDate: '2026-02-15',
          originalRentalEndDate: '2026-02-15',
          materials: [
            { id: 'pm-02', projectId: 'proj-03', materialId: 'mat-01', materialName: 'VERTICAL 10FT/3MTR', itemCode: 'V-10FT-3M', unit: 'NOS', requiredQuantity: 100, reservedQuantity: 100, installedQuantity: 100, issuedQuantity: 100, returnedUsableQuantity: 0, returnedDamagedQuantity: 0, missingQuantity: 0, monthlyRentalRate: 65 }
          ],
          createdAt: '2026-01-10T10:00:00Z',
          updatedAt: '2026-01-15T10:00:00Z',
        });

        // Set material balances for test fixture
        const m1 = state.materials.find(m => m.id === 'mat-01');
        if (m1) {
          m1.reservedQty = 100;
          m1.siteAllocatedQty = 100;
          m1.availableToAllocate = m1.usableWarehouseQty - m1.reservedQty;
        }
      });
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (e: any) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    Error: ${e.message}\n`);
      failed++;
    }
  }

  // Test 1: Project Creation from Inspection
  await test('1. Supervisor creates customer/site project -> appears in NOT_INSTALLED status', async () => {
    const customer = dbStore.getCustomers()[0];
    const project = await ProjectService.createProjectFromInspection({
      customerId: customer.id,
      siteName: 'Lodha Park Tower C',
      siteAddress: 'Worli, Mumbai',
      assignedSupervisorId: 'usr-sup-01',
      measurements: {
        length: 40,
        width: 15,
        height: 30,
        unit: 'METERS',
        measurementType: 'FAÇADE_SCAFFOLD',
      },
      actorId: 'usr-sup-01',
      actorName: 'Mustafa Alokhandwala',
    });

    assert.strictEqual(project.status, 'NOT_INSTALLED');
    assert.match(project.projectCode, /^AW-SCF-\d{6}$/);
    const inStore = dbStore.getProjects().find(p => p.id === project.id);
    assert.ok(inStore, 'Project must exist in data store');
  });

  // Test 2: Confirmation Reserves Stock Atomically
  await test('2. Confirmation reserves materials and decrements availableToAllocate', async () => {
    const project = dbStore.getProjects().find(p => p.status === 'NOT_INSTALLED')!;
    const mat = dbStore.getMaterials().find(m => m.id === 'mat-01')!;
    const initialReserved = mat.reservedQty;

    const reqQty = 50;
    const { project: confirmed } = await InventoryService.reserveMaterialsForProject({
      projectId: project.id,
      quotationNumber: 'QTN-TEST-001',
      quotationDate: '2026-02-01',
      agreedProjectPrice: 100000,
      monthlyRentalRate: 50000,
      plannedInstallationDate: '2026-02-10',
      materials: [{ materialId: mat.id, requiredQuantity: reqQty, monthlyRentalRate: 65 }],
      actorId: 'usr-pm-01',
      actorName: 'Taha Merchant',
    });

    assert.strictEqual(confirmed.status, 'CONFIRMED_PROJECT');
    assert.strictEqual(mat.reservedQty, initialReserved + reqQty);
    assert.strictEqual(mat.availableToAllocate, mat.usableWarehouseQty - mat.reservedQty);
  });

  // Test 3: Shortage Prevention
  await test('3. Insufficient stock prevents invalid reservation (Transaction Rollback)', async () => {
    const project = dbStore.getProjects().find(p => p.status === 'NOT_INSTALLED')!;
    const mat = dbStore.getMaterials().find(m => m.id === 'mat-10')!; // Low stock ladder unit
    const excessiveQty = mat.usableWarehouseQty + 1000;

    let threw = false;
    try {
      await InventoryService.reserveMaterialsForProject({
        projectId: project.id,
        quotationNumber: 'QTN-FAIL-001',
        quotationDate: '2026-02-01',
        agreedProjectPrice: 100000,
        monthlyRentalRate: 50000,
        plannedInstallationDate: '2026-02-10',
        materials: [{ materialId: mat.id, requiredQuantity: excessiveQty }],
        actorId: 'usr-pm-01',
        actorName: 'Taha Merchant',
      });
    } catch (e: any) {
      threw = true;
      assert.match(e.message, /Insufficient stock/);
    }
    assert.strictEqual(threw, true, 'Should throw shortage error');
    assert.strictEqual(project.status, 'NOT_INSTALLED', 'Project status must remain NOT_INSTALLED on rollback');
  });

  // Test 4: Concurrency Serialization
  await test('4. Concurrent reservations cannot oversubscribe stock (Mutex locking)', async () => {
    const mat = dbStore.getMaterials().find(m => m.id === 'mat-02')!;
    const available = mat.usableWarehouseQty - mat.reservedQty;
    const reqAmount = Math.floor(available * 0.7); // 70% of available

    // Create 2 not installed projects
    const p1 = await ProjectService.createProjectFromInspection({
      customerId: 'cust-01',
      siteName: 'Site Concurrent 1',
      siteAddress: 'BKC, Mumbai',
      assignedSupervisorId: 'usr-sup-01',
      measurements: { length: 10, width: 10, height: 10, unit: 'METERS', measurementType: 'FAÇADE_SCAFFOLD' },
      actorId: 'usr-sup-01',
      actorName: 'Mustafa Alokhandwala',
    });
    const p2 = await ProjectService.createProjectFromInspection({
      customerId: 'cust-01',
      siteName: 'Site Concurrent 2',
      siteAddress: 'Worli, Mumbai',
      assignedSupervisorId: 'usr-sup-01',
      measurements: { length: 10, width: 10, height: 10, unit: 'METERS', measurementType: 'FAÇADE_SCAFFOLD' },
      actorId: 'usr-sup-01',
      actorName: 'Mustafa Alokhandwala',
    });

    // Fire two reservations in parallel requesting 70% each (total 140% -> second must fail)
    const results = await Promise.allSettled([
      InventoryService.reserveMaterialsForProject({
        projectId: p1.id,
        quotationNumber: 'QTN-CONC-1',
        quotationDate: '2026-02-01',
        agreedProjectPrice: 50000,
        monthlyRentalRate: 25000,
        plannedInstallationDate: '2026-02-10',
        materials: [{ materialId: mat.id, requiredQuantity: reqAmount }],
        actorId: 'usr-pm-01',
        actorName: 'Taha Merchant',
      }),
      InventoryService.reserveMaterialsForProject({
        projectId: p2.id,
        quotationNumber: 'QTN-CONC-2',
        quotationDate: '2026-02-01',
        agreedProjectPrice: 50000,
        monthlyRentalRate: 25000,
        plannedInstallationDate: '2026-02-10',
        materials: [{ materialId: mat.id, requiredQuantity: reqAmount }],
        actorId: 'usr-pm-01',
        actorName: 'Taha Merchant',
      }),
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactly one reservation must succeed');
    assert.strictEqual(rejected.length, 1, 'Over-subscribing reservation must be rejected');
  });

  // Test 5: Installation & Dispatch Idempotency
  await test('5. Installation dispatches stock and reopening/resubmitting is idempotent', async () => {
    const project = dbStore.getProjects().find(p => p.status === 'CONFIRMED_PROJECT')!;
    const mat = dbStore.getMaterials().find(m => m.id === 'mat-01')!;
    const initialSiteAllocated = mat.siteAllocatedQty;

    const { project: installed } = await InventoryService.submitInstallation({
      projectId: project.id,
      actualInstallationDate: '2026-01-20T10:00:00Z',
      supervisorId: 'usr-sup-01',
      materialsUsed: [{ materialId: 'mat-01', installedQuantity: 100 }],
      actorId: 'usr-sup-01',
      actorName: 'Mustafa Alokhandwala',
    });

    assert.strictEqual(installed.status, 'ACTIVE_RENTAL');
    assert.strictEqual(mat.siteAllocatedQty, initialSiteAllocated + 100);

    // Resubmitting must be rejected / idempotent
    let secondThrew = false;
    try {
      await InventoryService.submitInstallation({
        projectId: project.id,
        actualInstallationDate: '2026-01-20T10:00:00Z',
        supervisorId: 'usr-sup-01',
        materialsUsed: [{ materialId: 'mat-01', installedQuantity: 100 }],
        actorId: 'usr-sup-01',
        actorName: 'Mustafa Alokhandwala',
      });
    } catch (e: any) {
      secondThrew = true;
      assert.match(e.message, /already installed/);
    }
    assert.strictEqual(secondThrew, true, 'Re-issuing already installed project must be rejected');
  });

  // Test 6: Buffer Time Arithmetic
  await test('6. A 2 or 3-day buffer extends removal deadline without adding monthly rent', async () => {
    const project = dbStore.getProjects().find(p => p.status === 'ACTIVE_RENTAL')!;
    const originalEnd = project.rentalEndDate!;

    const { project: buffered } = await RentalService.applyBufferPeriod({
      projectId: project.id,
      requestedBufferDays: 3,
      reason: 'Site clearance buffer',
      actorId: 'usr-pm-01',
      actorName: 'Taha Merchant',
    });

    assert.strictEqual(buffered.status, 'BUFFER_PERIOD');
    assert.strictEqual(buffered.rentalEndDate, originalEnd, 'Contractual end date must not be altered');
    const expectedBuffer = addDays(new Date(originalEnd), 3).toISOString().split('T')[0];
    assert.strictEqual(buffered.bufferEndDate, expectedBuffer);
  });

  // Test 7: Calendar Month Extension Arithmetic
  await test('7. Rental extension preserves original dates and uses calendar-month arithmetic', async () => {
    const project = dbStore.getProjects().find(p => p.status === 'ACTIVE_RENTAL')!;
    const originalEnd = project.rentalEndDate!;

    const { project: extended } = await RentalService.extendRental({
      projectId: project.id,
      durationMonths: 1,
      extensionReason: 'Monsoon delay',
      actorId: 'usr-pm-01',
      actorName: 'Taha Merchant',
    });

    assert.strictEqual(extended.status, 'EXTENDED');
    assert.strictEqual(extended.originalRentalEndDate, originalEnd, 'Must preserve original rental end date');
    const expectedEnd = addCalendarMonths(new Date(originalEnd), 1).toISOString().split('T')[0];
    assert.strictEqual(extended.rentalEndDate, expectedEnd);
  });

  // Test 8: Shifting Type A (Unchanged Qty)
  await test('8. Shifting Type A with unchanged quantities does NOT deduct warehouse stock', async () => {
    const project = dbStore.getProjects().find(p => p.status === 'ACTIVE_RENTAL')!;
    const mat = dbStore.getMaterials().find(m => m.id === 'mat-01')!;
    const usableBefore = mat.usableWarehouseQty;

    const { shiftingRequest } = await InventoryService.executeShifting({
      projectId: project.id,
      shiftingType: 'TYPE_A_UNCHANGED',
      destinationAreaDescription: 'East Wing Elevation',
      plannedShiftingDate: '2026-02-05',
      actorId: 'usr-sup-01',
      actorName: 'Mustafa Alokhandwala',
    });

    assert.strictEqual(shiftingRequest.shiftingType, 'TYPE_A_UNCHANGED');
    assert.strictEqual(mat.usableWarehouseQty, usableBefore, 'Warehouse stock must remain completely unchanged');
  });

  // Test 9: Dismantling Reconciliation - Usable vs Damaged vs Missing
  await test('9. Dismantling classifies condition: only usable items restore stock; damaged/missing trigger reconciliation', async () => {
    const project = dbStore.getProjects().find(p => p.status === 'ACTIVE_RENTAL')!;
    const mat = dbStore.getMaterials().find(m => m.id === 'mat-01')!;
    const usableBefore = mat.usableWarehouseQty;
    const damagedBefore = mat.damagedQty;
    const missingBefore = mat.missingQty;

    const { project: reconciled } = await InventoryService.reconcileDismantling({
      projectId: project.id,
      actualDismantlingDate: '2026-02-15',
      warehouseId: 'wh-01',
      supervisorId: 'usr-sup-01',
      materialReturns: [
        {
          materialId: mat.id,
          expectedSiteQty: 100,
          collectedQty: 95,
          usableReturnedQty: 90,
          damagedQty: 5,
          missingQty: 5,
        },
      ],
      actorId: 'usr-sup-01',
      actorName: 'Mustafa Alokhandwala',
    });

    // Usable stock increased ONLY by 90
    assert.strictEqual(mat.usableWarehouseQty, usableBefore + 90);
    // Damaged increased by 5
    assert.strictEqual(mat.damagedQty, damagedBefore + 5);
    // Missing increased by 5
    assert.strictEqual(mat.missingQty, missingBefore + 5);
    // Status must be RETURNED_RECONCILIATION because of missing/damaged
    assert.strictEqual(reconciled.status, 'RETURNED_RECONCILIATION');
  });

  // Test 10: GST Calculation Precision
  await test('10. Financial calculations use decimal-safe arithmetic for GST and balances', () => {
    const taxable = 150000;
    const intraState = calculateGST(taxable, 'Maharashtra', 'Maharashtra', 18);
    assert.strictEqual(intraState.cgstRate, 9);
    assert.strictEqual(intraState.sgstRate, 9);
    assert.strictEqual(intraState.cgstAmount, 13500);
    assert.strictEqual(intraState.sgstAmount, 13500);
    assert.strictEqual(intraState.totalAmount, 177000);

    const interState = calculateGST(taxable, 'Gujarat', 'Maharashtra', 18);
    assert.strictEqual(interState.igstRate, 18);
    assert.strictEqual(interState.igstAmount, 27000);
    assert.strictEqual(interState.totalAmount, 177000);
  });

  console.log('\n---------------------------------------------------------------');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('---------------------------------------------------------------\n');

  if (failed > 0) {
    throw new Error(`${failed} test(s) failed in critical test suite`);
  }
}

export { runAllTests as runCriticalTests };

if (process.argv[1]?.endsWith('critical-business-rules.test.ts')) {
  runAllTests().catch((e) => {
    console.error('Fatal test error:', e);
    process.exit(1);
  });
}
