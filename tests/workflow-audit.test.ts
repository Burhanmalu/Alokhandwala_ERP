import assert from 'node:assert';
import { dbStore } from '../src/lib/db/store';
import { ProjectService, VALID_STATUS_TRANSITIONS } from '../src/lib/services/project-service';
import { QuotationService } from '../src/lib/services/quotation-service';
import { InventoryService } from '../src/lib/services/inventory-service';
import { siteInspectionSchema, projectConfirmationSchema, installationSubmissionSchema } from '../src/lib/validations';

export async function runWorkflowAuditTests() {
  console.log('\n===============================================================');
  console.log('END-TO-END ERP WORKFLOW AUDIT TEST SUITE');
  console.log('Site Form -> Commercial Quotation -> Confirmation -> Inspection');
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
  let testProjectCode = '';
  let testQuotationId = '';
  let testQuotationNumber = '';

  // TEST 1: Stage 1 - Site Form Creation
  await test('1. Stage 1 (Site Form): Supervisor creates site inspection, generates unique Project ID & initial status', async () => {
    // Validate schema
    const siteInput = {
      customerName: 'Audit Test Contracting Ltd',
      siteName: 'Indore High-Rise Tower A',
      siteAddress: 'Plot 42, Vijay Nagar, Indore',
      latitude: 22.7533,
      longitude: 75.8937,
      locationType: 'ON_SITE' as const,
      hasClientGst: true,
      clientGstNumber: '23AAAAA0000A1Z5',
      measurements: {
        width: 15,
        depth: 3,
        height: 30,
        unit: 'FEET' as const,
        measurementType: 'FAÇADE_SCAFFOLD' as const,
        description: 'East façade scaffolding audit inspection',
      },
      siteRemarks: 'Clear crane access, hard ground level',
      photoUrls: ['https://storage.googleapis.com/test/site-before-1.jpg'],
      actorId: 'usr-sup-01',
      actorName: 'Mustafa Alokhandwala',
    };

    const validated = siteInspectionSchema.parse(siteInput);
    assert.strictEqual(validated.customerName, 'Audit Test Contracting Ltd');

    const project = await ProjectService.createProjectFromInspection({
      customerName: validated.customerName,
      siteName: validated.siteName || 'Indore High-Rise Tower A',
      siteAddress: validated.siteAddress || 'Plot 42, Vijay Nagar, Indore',
      latitude: validated.latitude,
      longitude: validated.longitude,
      locationType: validated.locationType,
      hasClientGst: siteInput.hasClientGst,
      clientGstNumber: siteInput.clientGstNumber,
      measurements: siteInput.measurements,
      siteRemarks: siteInput.siteRemarks,
      photoUrls: siteInput.photoUrls,
      actorId: siteInput.actorId,
      actorName: siteInput.actorName,
    });

    assert(project.id.startsWith('proj-'), 'Must generate a unique Project ID prefixed with proj-');
    assert(project.projectCode.startsWith('AW-SCF-'), 'Must generate sequential code prefixed with AW-SCF-');
    assert(project.status === 'NOT_INSTALLED' || project.status === 'SITE_CREATED', 'Initial status must be unconfirmed');
    assert.strictEqual(project.measurements?.elevationAreaSqFt, 450, 'Elevation area must calculate Width(15) * 1 * Height(30) = 450 sq ft');
    assert.strictEqual(project.clientGstNumber, '23AAAAA0000A1Z5', 'Client GST must be saved');

    testProjectId = project.id;
    testProjectCode = project.projectCode;
  });

  // TEST 2: Stage 2A - Commercial Quotation Save Draft
  await test('2. Stage 2A (Commercial Quotation): Admin saves quotation draft, links to same Project ID', async () => {
    const calc = QuotationService.calculatePricing({
      ratePerSqFt: 22,
      totalAreaSqFt: 450,
      durationMonths: 2,
      rentalDurationDays: 56,
      walkwayJaliIncludedQuantity: 4,
      extraJaliQuantity: 2,
      extraJaliRate: 200,
      transportCharges: 4000,
      shiftingCharges: 0,
      otherCharges: 0,
      gstPercentage: 18,
    });

    assert.strictEqual(calc.monthlyRentalAmount, 9900); // 450 * 22 (Monthly Rental)
    assert.strictEqual(calc.rentalTotalAmount, 19800); // 9900 * 2 (Rental Total for duration)
    assert.strictEqual(calc.extraJaliCharges, 400); // 2 * 200
    assert.strictEqual(calc.subtotal, 24200); // 19800 + 400 + 4000
    assert.strictEqual(calc.gstAmount, 4356); // 24200 * 0.18
    assert.strictEqual(calc.grandTotal, 28556); // 24200 + 4356
    assert.strictEqual(calc.advancePercentage, 75);
    assert.strictEqual(calc.advanceAmount, 21417); // 28556 * 0.75
    assert.strictEqual(calc.remainingAmount, 7139); // 28556 - 21417

    const { quotation, project } = await QuotationService.saveQuotation({
      projectId: testProjectId,
      status: 'DRAFT',
      ratePerSqFt: 22,
      totalAreaSqFt: 450,
      durationMonths: 2,
      rentalDurationDays: 56,
      walkwayJaliIncludedQuantity: 4,
      extraJaliQuantity: 2,
      transportCharges: 4000,
      shiftingCharges: 0,
      otherCharges: 0,
      gstPercentage: 18,
      materials: [
        { itemCode: 'V-10FT-3M', materialName: 'VERTICAL 10FT/3MTR (Standard Pipe)', unit: 'NOS', quantity: 20, monthlyRentalRate: 45, totalMonthlyRent: 900 },
        { itemCode: 'L-8FT-2.5M', materialName: 'LEDGER 8FT/2.5MTR (Horizontal Pipe)', unit: 'NOS', quantity: 30, monthlyRentalRate: 35, totalMonthlyRent: 1050 },
      ],
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu',
    });

    assert.strictEqual(quotation.projectId, testProjectId, 'Quotation must maintain exact same Project ID');
    assert.strictEqual(quotation.projectCode, testProjectCode, 'Quotation must maintain exact project code');
    assert.strictEqual(quotation.status, 'DRAFT', 'Quotation status must be DRAFT');
    assert.strictEqual(project.status, 'QUOTATION_DRAFT', 'Project status must update to QUOTATION_DRAFT');
    assert.strictEqual(project.quotationId, quotation.id, 'Project must reference quotation ID');

    testQuotationId = quotation.id;
    testQuotationNumber = quotation.quotationNumber;
  });

  // TEST 3: Stage 2B - Commercial Quotation Send to Client
  await test('3. Stage 2B (Commercial Quotation): Send to Client records sentAt and updates status to QUOTATION_SENT', async () => {
    const { quotation, project } = await QuotationService.saveQuotation({
      id: testQuotationId,
      projectId: testProjectId,
      status: 'SENT',
      ratePerSqFt: 22,
      totalAreaSqFt: 450,
      durationMonths: 2,
      rentalDurationDays: 56,
      walkwayJaliIncludedQuantity: 4,
      extraJaliQuantity: 2,
      transportCharges: 4000,
      shiftingCharges: 0,
      otherCharges: 0,
      gstPercentage: 18,
      materials: [
        { itemCode: 'V-10FT-3M', materialName: 'VERTICAL 10FT/3MTR (Standard Pipe)', unit: 'NOS', quantity: 20, monthlyRentalRate: 45, totalMonthlyRent: 900 },
        { itemCode: 'L-8FT-2.5M', materialName: 'LEDGER 8FT/2.5MTR (Horizontal Pipe)', unit: 'NOS', quantity: 30, monthlyRentalRate: 35, totalMonthlyRent: 1050 },
      ],
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu',
    });

    assert.strictEqual(quotation.status, 'SENT', 'Quotation status must be SENT');
    assert(quotation.sentAt, 'Quotation must record sentAt timestamp');
    assert.strictEqual(project.status, 'QUOTATION_SENT', 'Project status must update to QUOTATION_SENT');
    assert.strictEqual(project.id, testProjectId, 'Must retain same Project ID');
  });

  // TEST 4: Stage 3 Validation - Block Confirmation without Client Acceptance
  await test('4. Stage 3 (Enforce Acceptance): Rejects confirmation if client acceptance is not verified', async () => {
    const mat1 = dbStore.getMaterials().find(m => m.itemCode === 'V-10FT-3M')!;
    const mat2 = dbStore.getMaterials().find(m => m.itemCode === 'L-8FT-2.5M')!;

    let errorThrown = false;
    try {
      await InventoryService.reserveMaterialsForProject({
        projectId: testProjectId,
        quotationNumber: testQuotationNumber,
        quotationDate: new Date().toISOString().slice(0, 10),
        agreedProjectPrice: 28556,
        monthlyRentalRate: 19800,
        plannedInstallationDate: '2026-11-10',
        durationMonths: 2,
        materials: [
          { materialId: mat1.id, requiredQuantity: 10, monthlyRentalRate: 45 },
          { materialId: mat2.id, requiredQuantity: 15, monthlyRentalRate: 35 },
        ],
        clientAccepted: false, // NOT ACCEPTED
        clientAcceptanceVerified: false,
        actorId: 'usr-admin-01',
        actorName: 'Burhan Malu',
      });
    } catch (e: any) {
      errorThrown = true;
      assert(e.message.includes('Client quotation acceptance is required'), 'Expected client acceptance error');
    }
    assert(errorThrown, 'Must throw error when client acceptance is not provided for QUOTATION_SENT');
  });

  // TEST 5: Stage 3 Execution - Project Confirmation & Stock Reservation
  await test('5. Stage 3 (Project Confirmation): Client accepted -> reserves warehouse stock atomically, updates status to CONFIRMED_PROJECT', async () => {
    const mat1 = dbStore.getMaterials().find(m => m.itemCode === 'V-10FT-3M')!;
    const mat2 = dbStore.getMaterials().find(m => m.itemCode === 'L-8FT-2.5M')!;
    const initialReserved1 = mat1.reservedQty;
    const initialAvail1 = mat1.availableToAllocate;

    // Validate confirmation schema
    const confirmInput = {
      projectId: testProjectId,
      quotationNumber: testQuotationNumber,
      quotationDate: new Date().toISOString().slice(0, 10),
      agreedProjectPrice: 28556,
      pricingModel: 'MONTHLY_RENTAL' as const,
      monthlyRentalRate: 19800,
      plannedInstallationDate: '2026-11-10',
      durationMonths: 2,
      depositAmount: 0,
      transportCharges: 4000,
      materials: [
        { materialId: mat1.id, requiredQuantity: 10, monthlyRentalRate: 45 },
        { materialId: mat2.id, requiredQuantity: 15, monthlyRentalRate: 35 },
      ],
      clientAccepted: true,
      clientAcceptanceVerified: true,
    };
    const validated = projectConfirmationSchema.parse(confirmInput);
    assert.strictEqual(validated.quotationNumber, testQuotationNumber);

    const { project, transaction } = await InventoryService.reserveMaterialsForProject({
      ...confirmInput,
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu',
    });

    assert.strictEqual(project.id, testProjectId, 'Must retain exact same Project ID');
    assert.strictEqual(project.projectCode, testProjectCode, 'Must retain exact same project code');
    assert.strictEqual(project.status, 'CONFIRMED_PROJECT', 'Status must be CONFIRMED_PROJECT');
    assert.strictEqual(transaction.movementType, 'RESERVATION', 'Must record immutable RESERVATION transaction');
    assert.strictEqual(mat1.reservedQty, initialReserved1 + 10, 'Reserved stock must increment by 10');
    assert.strictEqual(mat1.availableToAllocate, initialAvail1 - 10, 'Available stock must decrement by 10');

    // Verify linked quotation auto-updated to ACCEPTED
    const qtn = dbStore.getQuotations().find(q => q.id === testQuotationId);
    assert(qtn, 'Linked quotation must exist');
    assert.strictEqual(qtn.status, 'ACCEPTED', 'Quotation status must be ACCEPTED upon confirmation');
  });

  // TEST 6: Prevent Duplicate Reservation on already confirmed project
  await test('6. Stage 3 Security: Prevents duplicate reservations on already confirmed project', async () => {
    const mat1 = dbStore.getMaterials().find(m => m.itemCode === 'V-10FT-3M')!;
    let duplicateRejected = false;
    try {
      await InventoryService.reserveMaterialsForProject({
        projectId: testProjectId,
        quotationNumber: testQuotationNumber,
        quotationDate: new Date().toISOString().slice(0, 10),
        agreedProjectPrice: 28556,
        monthlyRentalRate: 19800,
        plannedInstallationDate: '2026-11-10',
        durationMonths: 2,
        materials: [{ materialId: mat1.id, requiredQuantity: 5, monthlyRentalRate: 45 }],
        clientAccepted: true,
        actorId: 'usr-admin-01',
        actorName: 'Burhan Malu',
      });
    } catch (e: any) {
      duplicateRejected = true;
      assert(e.message.includes('already confirmed') || e.message.includes('Duplicate reservation'), 'Expected duplicate error');
    }
    assert(duplicateRejected, 'Must prevent duplicate reservation');
  });

  // TEST 7: Stage 4 Execution - Field Installation & Inspection
  await test('7. Stage 4 (Inspection & Installation): Records actual findings, dispatches stock, transitions to ACTIVE_RENTAL under same Project ID', async () => {
    const mat1 = dbStore.getMaterials().find(m => m.itemCode === 'V-10FT-3M')!;
    const initialWarehouseQty = mat1.usableWarehouseQty;
    const initialSiteAllocated = mat1.siteAllocatedQty;
    const initialReserved = mat1.reservedQty;

    const installInput = {
      projectId: testProjectId,
      actualInstallationDate: new Date().toISOString(),
      supervisorId: 'usr-sup-01',
      executingSupervisorName: 'Mustafa Alokhandwala',
      isSameSupervisor: true,
      workersList: [
        { name: 'Kalu Ram', role: 'Lead Rigger / Fitter' },
        { name: 'Ganesh Shinde', role: 'Scaffolder' },
      ],
      actualMeasurements: {
        length: 15,
        width: 3,
        height: 30,
        unit: 'FEET' as const,
        isCorrect: true,
        variancePercentage: 0,
        remarks: 'Installed per site inspection specifications',
      },
      clientRepresentativeName: 'Mr. Rajesh Sharma (Site Engineer)',
      clientSignOff: true,
      remarks: 'Scaffolding inspected and handed over with green tag',
      afterPhotoUrls: ['https://storage.googleapis.com/test/site-after-1.jpg'],
      materialsUsed: [
        { materialId: mat1.id, installedQuantity: 10, unusedReturnedQty: 0 },
      ],
    };

    const validated = installationSubmissionSchema.parse(installInput);
    assert.strictEqual(validated.projectId, testProjectId);

    const { project, transaction } = await InventoryService.submitInstallation({
      ...installInput,
      actorId: 'usr-sup-01',
      actorName: 'Mustafa Alokhandwala',
    });

    assert.strictEqual(project.id, testProjectId, 'Must retain exact same Project ID throughout Stage 4');
    assert.strictEqual(project.projectCode, testProjectCode, 'Must retain exact same project code');
    assert.strictEqual(project.status, 'ACTIVE_RENTAL', 'Project status must update to ACTIVE_RENTAL');
    assert.strictEqual(project.clientRepresentativeName, 'Mr. Rajesh Sharma (Site Engineer)');
    assert.strictEqual(project.clientSignOff, true);

    // Stock verification
    assert.strictEqual(mat1.usableWarehouseQty, initialWarehouseQty - 10, 'Warehouse physical stock decrements by installed qty');
    assert.strictEqual(mat1.siteAllocatedQty, initialSiteAllocated + 10, 'Site allocated stock increments by installed qty');
    assert.strictEqual(mat1.reservedQty, initialReserved - 10, 'Reserved stock released upon installation');
  });

  // TEST 8: State Machine & Continuity Audit Across All Stages
  await test('8. State Machine & Continuity Audit: Verify single Project ID integrity across all 4 stages without duplicates', async () => {
    const allProjectsWithId = dbStore.getProjects().filter(p => p.id === testProjectId);
    assert.strictEqual(allProjectsWithId.length, 1, 'Exactly ONE project record must exist for this Project ID (Zero Duplicates)');

    const project = allProjectsWithId[0];
    assert.strictEqual(project.projectCode, testProjectCode);
    assert.strictEqual(project.status, 'ACTIVE_RENTAL');
    assert(project.measurements, 'Measurements from Stage 1 must be preserved');
    assert.strictEqual(project.quotationNumber, testQuotationNumber, 'Quotation from Stage 2 must be preserved');
    assert(project.materials && project.materials.length > 0, 'Confirmation materials from Stage 3 must be preserved');
    assert(project.actualInstallationDate, 'Installation details from Stage 4 must be preserved');

    // Verify valid transitions mapping
    assert(VALID_STATUS_TRANSITIONS.SITE_CREATED.includes('CONFIRMED_PROJECT'));
    assert(VALID_STATUS_TRANSITIONS.NOT_INSTALLED.includes('CONFIRMED_PROJECT'));
    assert(VALID_STATUS_TRANSITIONS.QUOTATION_DRAFT.includes('CONFIRMED_PROJECT'));
    assert(VALID_STATUS_TRANSITIONS.QUOTATION_SENT.includes('CONFIRMED_PROJECT'));
    assert(VALID_STATUS_TRANSITIONS.QUOTATION_ACCEPTED.includes('CONFIRMED_PROJECT'));
    assert(VALID_STATUS_TRANSITIONS.CONFIRMED_PROJECT.includes('ACTIVE_RENTAL'));
  });

  console.log(`\n---------------------------------------------------------------`);
  console.log(`Workflow Audit Results: ${passed} Passed, ${failed} Failed`);
  console.log(`---------------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('workflow-audit.test.ts')) {
  runWorkflowAuditTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
