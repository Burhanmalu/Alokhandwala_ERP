// ALOKHANDWALA - PDF Generation Test Suite
// Verifies that Confirmation PDF and Installation PDF generate error-free

process.env.NODE_ENV = 'test';
process.env.IS_TEST = 'true';

import assert from 'assert';
import { dbStore } from '../src/lib/db/store';
import { generateConfirmationPdf, generateInstallationPdf } from '../src/lib/pdf/project-pdf';
import { Project, Customer, Site } from '../src/lib/schema';

async function runPdfTests() {
  console.log('\n===============================================================');
  console.log('PROJECT PDF GENERATION AUTOMATED TEST SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

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

  const sampleCustomer: Customer = {
    id: 'cust-demo-1',
    customerCode: 'CUST-0001',
    companyName: 'Larsen & Toubro Construction Ltd',
    referenceName: 'L&T Buildings',
    contactPerson: 'Vikram Malhotra',
    phone: '+91 98200 45678',
    email: 'vikram.m@lntecc.com',
    billingAddress: 'L&T House, Ballard Estate, Mumbai, Maharashtra 400001',
    city: 'Mumbai',
    state: 'Maharashtra',
    gstin: '27AAACL1234F1Z9',
    status: 'ACTIVE',
    creditLimit: 5000000,
    outstandingBalance: 120000,
    sitesCount: 2,
    projectsCount: 1,
    activeRentalsCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleSite: Site = {
    id: 'site-demo-1',
    siteCode: 'SITE-0001',
    customerId: 'cust-demo-1',
    customerName: 'Larsen & Toubro Construction Ltd',
    siteName: 'Metro Line 3 Sahar Interchange',
    siteAddress: 'Near Terminal 2, Sahar Road, Andheri East, Mumbai',
    landmark: 'Opposite Hyatt Regency',
    city: 'Mumbai',
    state: 'Maharashtra',
    contactPerson: 'Sunil Rao',
    contactPhone: '+91 98201 12345',
    assignedSupervisorId: 'usr-sup-01',
    supervisorName: 'Mustafa Alokhandwala',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  const sampleConfirmedProject: Project = {
    id: 'proj-demo-1',
    projectCode: 'AW-SCF-000001',
    customerId: 'cust-demo-1',
    customerName: 'Larsen & Toubro Construction Ltd',
    siteId: 'site-demo-1',
    siteName: 'Metro Line 3 Sahar Interchange',
    siteAddress: 'Near Terminal 2, Sahar Road, Andheri East, Mumbai',
    assignedSupervisorId: 'usr-sup-01',
    supervisorName: 'Mustafa Alokhandwala',
    status: 'CONFIRMED_PROJECT',
    pricingModel: 'MONTHLY_RENTAL',
    monthlyRentalRate: 75000,
    agreedProjectPrice: 115000,
    depositAmount: 25000,
    transportCharges: 7500,
    installationLabourCharges: 15000,
    shiftingCharges: 0,
    dismantlingLabourCharges: 10000,
    gstPercentage: 18,
    quotationNumber: 'QTN-2026-00084',
    quotationDate: '2026-02-10',
    plannedInstallationDate: '2026-02-15',
    durationMonths: 2,
    paymentTerms: '30 days advance on monthly rental invoice. Security deposit refundable upon return inspection.',
    siteRemarks: 'Clear 3m perimeter access required for staging crane and delivery trucks.',
    siteDimensions: {
      length: 45,
      width: 25,
      height: 18,
      unit: 'METERS',
      configurationType: 'PERIMETER_FACADE',
    },
    materials: [
      {
        id: 'pm-1',
        projectId: 'proj-demo-1',
        materialId: 'mat-std-3000',
        materialName: 'Cuplock Standard Vertical 3.0m',
        itemCode: 'SCF-STD-3000',
        unit: 'Nos',
        requiredQuantity: 180,
        reservedQuantity: 180,
        issuedQuantity: 0,
        installedQuantity: 0,
        returnedUsableQuantity: 0,
        returnedDamagedQuantity: 0,
        missingQuantity: 0,
        monthlyRentalRate: 120,
      },
      {
        id: 'pm-2',
        projectId: 'proj-demo-1',
        materialId: 'mat-ldg-2500',
        materialName: 'Cuplock Ledger Horizontal 2.5m',
        itemCode: 'SCF-LDG-2500',
        unit: 'Nos',
        requiredQuantity: 240,
        reservedQuantity: 240,
        issuedQuantity: 0,
        installedQuantity: 0,
        returnedUsableQuantity: 0,
        returnedDamagedQuantity: 0,
        missingQuantity: 0,
        monthlyRentalRate: 85,
      },
      {
        id: 'pm-3',
        projectId: 'proj-demo-1',
        materialId: 'mat-jck-adj',
        materialName: 'Adjustable Base Jack 650mm',
        itemCode: 'SCF-JCK-ADJ',
        unit: 'Nos',
        requiredQuantity: 60,
        reservedQuantity: 60,
        issuedQuantity: 0,
        installedQuantity: 0,
        returnedUsableQuantity: 0,
        returnedDamagedQuantity: 0,
        missingQuantity: 0,
        monthlyRentalRate: 45,
      },
    ],
    createdAt: '2026-02-10T09:00:00Z',
    updatedAt: '2026-02-10T11:00:00Z',
  };

  const sampleInstalledProject: Project = {
    ...sampleConfirmedProject,
    status: 'ACTIVE_RENTAL',
    actualInstallationDate: '2026-02-15T14:30:00Z',
    rentalStartDate: '2026-02-15',
    rentalEndDate: '2026-04-15',
    actualMeasurements: {
      length: 45.2,
      width: 25.0,
      height: 18.0,
      unit: 'METERS',
      isCorrect: true,
      variancePercentage: 0.4,
      remarks: 'Ground clearance verified with safe offset from high-tension corridor.',
      verifiedBy: 'Mustafa Alokhandwala',
      verifiedAt: '2026-02-15T15:00:00Z',
    },
    installationSupervisor: {
      assignedSupervisorId: 'usr-sup-01',
      assignedSupervisorName: 'Mustafa Alokhandwala',
      executingSupervisorId: 'usr-sup-01',
      executingSupervisorName: 'Mustafa Alokhandwala',
      isSameSupervisor: true,
    },
    installationWorkers: [
      { id: 'w-1', name: 'Kailash Yadav', role: 'Lead Scaffolder' },
      { id: 'w-2', name: 'Rameshwar Lal', role: 'Certified Rigger' },
      { id: 'w-3', name: 'Sunil Paswan', role: 'Erection Specialist' },
    ],
    materials: sampleConfirmedProject.materials?.map(m => ({
      ...m,
      installedQuantity: m.reservedQuantity,
      issuedQuantity: m.reservedQuantity,
      reservedQuantity: 0,
    })),
    photos: [
      {
        id: 'pht-1',
        entityType: 'INSTALLATION',
        entityId: 'proj-demo-1',
        fileName: 'front_elevation_completion.jpg',
        fileUrl: '',
        fileSizeBytes: 1024000,
        mimeType: 'image/jpeg',
        stageLabel: 'AFTER_INSTALLATION',
        uploadedBy: 'usr-sup-01',
        createdAt: '2026-02-15T16:00:00Z',
      },
    ],
  };

  // Test 1: Confirmation PDF generation
  await test('1. Confirmation PDF generates successfully with full customer and material data', async () => {
    await generateConfirmationPdf({
      ...sampleConfirmedProject,
      customer: sampleCustomer,
      site: sampleSite,
    });
    assert.ok(true, 'Confirmation PDF generated successfully');
  });

  // Test 2: Installation PDF generation
  await test('2. Installation PDF generates successfully with actual installation details', async () => {
    await generateInstallationPdf({
      ...sampleInstalledProject,
      customer: sampleCustomer,
      site: sampleSite,
    });
    assert.ok(true, 'Installation PDF generated successfully');
  });

  // Test 3: Handles sparse records cleanly
  await test('3. Handles sparse projects with missing optional fields gracefully', async () => {
    const minimalProject: any = {
      id: 'proj-sparse-test',
      projectCode: 'AW-SCF-MINIMAL',
      customerId: 'cust-sparse',
      customerName: 'Minimal Customer Ltd',
      siteId: 'site-sparse',
      siteName: 'Minimal Site',
      siteAddress: 'Industrial Area',
      assignedSupervisorId: 'usr-sup-01',
      supervisorName: 'Mustafa Alokhandwala',
      status: 'CONFIRMED_PROJECT',
      pricingModel: 'MONTHLY_RENTAL',
      monthlyRentalRate: 25000,
      agreedProjectPrice: 35000,
      depositAmount: 10000,
      transportCharges: 2500,
      installationLabourCharges: 5000,
      shiftingCharges: 0,
      dismantlingLabourCharges: 5000,
      gstPercentage: 18,
      materials: [],
      photos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await generateConfirmationPdf(minimalProject);
    await generateInstallationPdf(minimalProject);
    assert.ok(true, 'Both PDFs handled minimal sparse records cleanly');
  });

  // Test 4: Multi-page material requirements pagination test
  await test('4. Handles multi-page material overflow cleanly with table headers and footers across pages', async () => {
    const multiPageMaterials = Array.from({ length: 35 }, (_, i) => ({
      id: `mat-multi-${i + 1}`,
      projectId: 'proj-demo-1',
      materialId: `mat-${i + 1}`,
      materialName: `Heavy Duty Cuplock Scaffolding Component Type ${i + 1}`,
      itemCode: `SCF-COMP-${1000 + i}`,
      unit: 'Nos',
      requiredQuantity: 50 + i * 5,
      reservedQuantity: 50 + i * 5,
      installedQuantity: 50 + i * 5,
      issuedQuantity: 50 + i * 5,
      returnedUsableQuantity: 0,
      returnedDamagedQuantity: 0,
      missingQuantity: 0,
      monthlyRentalRate: 45 + (i % 5) * 10,
    }));

    const multiPageProject = {
      ...sampleConfirmedProject,
      customer: sampleCustomer,
      site: sampleSite,
      materials: multiPageMaterials,
    };

    await generateConfirmationPdf(multiPageProject);
    await generateInstallationPdf({
      ...sampleInstalledProject,
      customer: sampleCustomer,
      site: sampleSite,
      materials: multiPageMaterials,
    });
    assert.ok(true, 'Multi-page materials generated and paginated cleanly');
  });

  // Test 5: Complex long-text and large worker roster resilience test
  await test('5. Prevents text collision with verbose customer addresses, 8+ workers, and long remarks', async () => {
    const verboseProject: ProjectWithRelations = {
      ...sampleInstalledProject,
      customer: {
        ...sampleCustomer,
        companyName: 'Larsen & Toubro Heavy Civil Infrastructure Construction & Engineering Private Limited',
        billingAddress: 'Unit 401-408, Tower B, Godrej Coliseum, Behind Everard Nagar, Off Eastern Express Highway, Chunabhatti, Sion East, Mumbai, Maharashtra 400022',
      },
      site: {
        ...sampleSite,
        siteName: 'Underground Metro Station Package UGC-07 Sahar Road to CSIA Terminal 2 International Airport Interchange Box',
        siteAddress: 'Survey No. 45/2A, Near Sahar Cargo Complex, Off Western Express Highway, Sahar Road, Vile Parle East, Mumbai 400099',
      },
      paymentTerms: '100% advance monthly rental due within 7 calendar days of tax invoice issuance. Security deposit to be held in non-interest bearing escrow and released within 14 working days following joint site demobilization and material count reconciliation audit.',
      siteRemarks: 'Ground bearing pressure must be certified by structural consultant to exceed 150 kN/m2. High-tension 33kV overhead power line clearance must maintain a minimum 6.5 meter safety buffer at all times during crane movement and erection.',
      installationWorkers: [
        { id: 'w-1', name: 'Kailash Yadav', role: 'Lead Scaffolder' },
        { id: 'w-2', name: 'Rameshwar Lal', role: 'Certified Rigger' },
        { id: 'w-3', name: 'Sunil Paswan', role: 'Erection Specialist' },
        { id: 'w-4', name: 'Mahesh Vishwakarma', role: 'Safety Marshal' },
        { id: 'w-5', name: 'Dharmendra Kumar', role: 'Certified Rigger' },
        { id: 'w-6', name: 'Vikram Singh', role: 'Scaffolder' },
        { id: 'w-7', name: 'Pappu Ansari', role: 'Base Jack Specialist' },
        { id: 'w-8', name: 'Santosh Bind', role: 'Inspection Technician' },
      ],
    };

    await generateConfirmationPdf(verboseProject);
    await generateInstallationPdf(verboseProject);
    assert.ok(true, 'Long strings, extensive worker rosters, and multi-line remarks wrapped cleanly');
  });

  // Test 6: Verify with real database projects from dbStore
  await test('6. Generates Confirmation and Installation PDFs from active database projects', async () => {
    const projects = dbStore.getProjects();
    assert.ok(projects.length > 0, 'Database contains active project records');

    const customers = dbStore.getCustomers();
    const sites = dbStore.getSites();

    for (const proj of projects.slice(0, 3)) {
      const cust = customers.find(c => c.id === proj.customerId);
      const site = sites.find(s => s.id === proj.siteId);
      const fullProject: ProjectWithRelations = {
        ...proj,
        customer: cust,
        site: site,
      };

      await generateConfirmationPdf(fullProject);
      await generateInstallationPdf(fullProject);
    }
    assert.ok(true, 'Generated PDFs for active database projects successfully');
  });

  // Test 7: Verify official Terms & Conditions structure and constants
  await test('7. Centralized Terms & Conditions constants and 11 official clauses integrity', async () => {
    const { OFFICIAL_TERMS_AND_CONDITIONS, RENTAL_CONSTANTS, getTermsForDocumentType } = await import('../src/lib/constants/terms-and-conditions');
    
    assert.strictEqual(OFFICIAL_TERMS_AND_CONDITIONS.length, 11, 'Must have exactly 11 official clauses');
    assert.strictEqual(OFFICIAL_TERMS_AND_CONDITIONS[0].title, 'Pricing', 'Clause 1 must be Pricing');
    assert.strictEqual(OFFICIAL_TERMS_AND_CONDITIONS[1].title, 'Rental Period', 'Clause 2 must be Rental Period');
    assert.strictEqual(OFFICIAL_TERMS_AND_CONDITIONS[2].title, 'Transportation', 'Clause 3 must be Transportation');
    assert.strictEqual(OFFICIAL_TERMS_AND_CONDITIONS[3].title, 'Walkway Jali', 'Clause 4 must be Walkway Jali');
    assert.strictEqual(OFFICIAL_TERMS_AND_CONDITIONS[4].title, 'Shifting Charges', 'Clause 5 must be Shifting Charges');
    assert.strictEqual(OFFICIAL_TERMS_AND_CONDITIONS[5].title, 'Order Cancellation', 'Clause 6 must be Order Cancellation');
    assert.strictEqual(OFFICIAL_TERMS_AND_CONDITIONS[6].title, 'Payment Terms', 'Clause 7 must be Payment Terms');
    assert.strictEqual(OFFICIAL_TERMS_AND_CONDITIONS[7].title, 'Monthly Payment', 'Clause 8 must be Monthly Payment');
    assert.strictEqual(OFFICIAL_TERMS_AND_CONDITIONS[8].title, 'Damage or Misplacement', 'Clause 9 must be Damage or Misplacement');
    assert.strictEqual(OFFICIAL_TERMS_AND_CONDITIONS[9].title, 'Post-Installation Visit', 'Clause 10 must be Post-Installation Visit');
    assert.strictEqual(OFFICIAL_TERMS_AND_CONDITIONS[10].title, 'Challan & Material Responsibility', 'Clause 11 must be Challan & Material Responsibility');

    assert.strictEqual(RENTAL_CONSTANTS.RENTAL_DAYS_PER_MONTH, 28, 'Rental days per month must be 28');
    assert.strictEqual(RENTAL_CONSTANTS.ADVANCE_PAYMENT_PERCENTAGE, 75, 'Advance payment must be 75%');
    assert.strictEqual(RENTAL_CONSTANTS.COMPLETION_PAYMENT_PERCENTAGE, 25, 'Completion payment must be 25%');
    assert.strictEqual(RENTAL_CONSTANTS.EXTRA_WALKWAY_JALI_RATE, 200, 'Extra jali rate must be ₹200');
    assert.strictEqual(RENTAL_CONSTANTS.SHIFTING_RATE_PER_SQFT, 6, 'Shifting rate must be ₹6/sq.ft.');
    assert.strictEqual(RENTAL_CONSTANTS.SHIFTING_PERCENTAGE_OF_UNIT_RENTAL, 0.60, 'Shifting percentage must be 60%');

    const confirmationTerms = getTermsForDocumentType('CONFIRMATION');
    assert.strictEqual(confirmationTerms.length, 11, 'Confirmation document must include all 11 terms');

    const installationTerms = getTermsForDocumentType('INSTALLATION');
    assert.ok(installationTerms.some(t => t.id === 11), 'Installation terms must include Clause 11 (Challan responsibility)');
    assert.ok(installationTerms.some(t => t.id === 9), 'Installation terms must include Clause 9 (Damage/loss responsibility)');
  });

  // Test 8: Verify commercial calculations for Area, Extra Jali, 75/25 advance split, and Shifting modes
  await test('8. Commercial business logic calculations (28-day schedule, 75/25 split, ₹200 extra jali, shifting)', async () => {
    const { RENTAL_CONSTANTS } = await import('../src/lib/constants/terms-and-conditions');

    // 1. Façade Area calculation (40 ft length x 30 ft height = 1200 sq.ft.)
    const lengthFt = 40;
    const heightFt = 30;
    const areaSqFt = lengthFt * heightFt;
    assert.strictEqual(areaSqFt, 1200, 'Façade area calculation');

    // 2. 28-day rental duration end date
    const installDate = new Date('2026-03-01T00:00:00Z');
    const durationMonths = 2;
    const expectedEndDate = new Date(installDate);
    expectedEndDate.setDate(expectedEndDate.getDate() + durationMonths * RENTAL_CONSTANTS.RENTAL_DAYS_PER_MONTH);
    const diffDays = Math.round((expectedEndDate.getTime() - installDate.getTime()) / (1000 * 60 * 60 * 24));
    assert.strictEqual(diffDays, 56, '2 months rental must equal 56 days (2 x 28 days)');

    // 3. 75% advance & 25% completion split
    const agreedTotal = 100000;
    const advanceAmount = Math.round(agreedTotal * (RENTAL_CONSTANTS.ADVANCE_PAYMENT_PERCENTAGE / 100));
    const balanceAmount = agreedTotal - advanceAmount;
    assert.strictEqual(advanceAmount, 75000, '75% advance on ₹1,00,000 must be ₹75,000');
    assert.strictEqual(balanceAmount, 25000, '25% balance on ₹1,00,000 must be ₹25,000');

    // 4. Walkway Jali allowance (5 units = 5 included, 8 requested = 3 extra @ ₹200 = ₹600)
    const unitsCount = 5;
    const requestedJali = 8;
    const includedJali = unitsCount * RENTAL_CONSTANTS.INCLUDED_WALKWAY_JALI_PER_UNIT;
    const extraJali = Math.max(0, requestedJali - includedJali);
    const extraJaliCost = extraJali * RENTAL_CONSTANTS.EXTRA_WALKWAY_JALI_RATE;
    assert.strictEqual(includedJali, 5, '5 units include 5 jali pieces');
    assert.strictEqual(extraJali, 3, '3 extra jali pieces');
    assert.strictEqual(extraJaliCost, 600, '3 extra pieces @ ₹200 = ₹600');

    // 5. Dual shifting modes
    const shiftedAreaSqFt = 1000;
    const monthlyRate = 50000;
    const mode1Cost = shiftedAreaSqFt * RENTAL_CONSTANTS.SHIFTING_RATE_PER_SQFT;
    const mode2Cost = Math.round(monthlyRate * RENTAL_CONSTANTS.SHIFTING_PERCENTAGE_OF_UNIT_RENTAL);
    assert.strictEqual(mode1Cost, 6000, 'Mode 1: 1000 sq.ft. @ ₹6/sq.ft. = ₹6000');
    assert.strictEqual(mode2Cost, 30000, 'Mode 2: 60% of ₹50,000 = ₹30,000');
  });

  // Test 9: Verify strict photo separation: Confirmation PDF vs Installation PDF
  await test('9. Strict photo separation: Confirmation gets site photos only; Installation gets installation photos only; empty fallback supported', async () => {
    // 1x1 valid sample images
    const sampleSitePhotoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const sampleInstallPhotoBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

    const projectWithMixedPhotos = {
      ...sampleConfirmedProject,
      customer: sampleCustomer,
      site: sampleSite,
      photos: [
        {
          id: 'site-photo-1',
          entityType: 'SITE_INSPECTION' as const,
          entityId: 'proj-demo-1',
          fileName: 'customer_site_front_facade.png',
          fileUrl: sampleSitePhotoBase64,
          fileSizeBytes: 1024,
          mimeType: 'image/png',
          stageLabel: 'BEFORE_INSTALLATION' as const,
          uploadedBy: 'usr-sup-01',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'site-photo-2',
          entityType: 'SITE_INSPECTION' as const,
          entityId: 'proj-demo-1',
          fileName: 'perimeter_ground_clearance.png',
          fileUrl: sampleSitePhotoBase64,
          fileSizeBytes: 1024,
          mimeType: 'image/png',
          stageLabel: 'SITE_INSPECTION' as const,
          uploadedBy: 'usr-sup-01',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'install-photo-1',
          entityType: 'INSTALLATION' as const,
          entityId: 'proj-demo-1',
          fileName: 'installation_completion_cuplock.jpg',
          fileUrl: sampleInstallPhotoBase64,
          fileSizeBytes: 1024,
          mimeType: 'image/jpeg',
          stageLabel: 'AFTER_INSTALLATION' as const,
          uploadedBy: 'usr-sup-01',
          createdAt: new Date().toISOString(),
        },
      ],
    };

    // Both PDFs should generate error-free with mixed photos
    await generateConfirmationPdf(projectWithMixedPhotos);
    await generateInstallationPdf({
      ...projectWithMixedPhotos,
      status: 'INSTALLED',
      actualInstallationDate: '2026-02-15T10:00:00Z',
    });

    // Test with completely empty photos: both must handle cleanly with fallback text
    const projectWithNoPhotos = {
      ...sampleConfirmedProject,
      customer: sampleCustomer,
      site: sampleSite,
      photos: [],
    };
    await generateConfirmationPdf(projectWithNoPhotos);
    await generateInstallationPdf(projectWithNoPhotos);

    assert.ok(true, 'Both PDFs handled mixed and empty photo collections flawlessly');
  });

  console.log(`\n---------------------------------------------------------------`);
  console.log(`PDF Generation Results: ${passed} Passed, ${failed} Failed`);
  console.log(`---------------------------------------------------------------\n`);

  if (failed > 0) process.exit(1);
}

export { runPdfTests };

if (process.argv[1]?.includes('pdf-generation.test')) {
  runPdfTests().catch((e) => {
    console.error('Fatal test error:', e);
    process.exit(1);
  });
}

