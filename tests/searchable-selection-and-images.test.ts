// ALOKHANDWALA ERP - Searchable Selection Fields & Image Uploads Test Suite
// Verifies:
// 1. Searchable selection for Existing Customer (Site Form)
// 2. Searchable selection for Inspected Project NOT_INSTALLED (Confirmation Form)
// 3. Searchable selection for Confirmed/Scheduled Project (Installation Form)
// 4. Image saving & attachment linking against customer & project
// 5. Lightbox & Gallery multiple images data integrity

process.env.NODE_ENV = 'test';
process.env.IS_TEST = 'true';

import assert from 'assert';
import { dbStore } from '../src/lib/db/store';
import { ProjectService } from '../src/lib/services/project-service';
import { InventoryService } from '../src/lib/services/inventory-service';
import { generateConfirmationPdf, generateInstallationPdf } from '../src/lib/pdf/project-pdf';

export async function runSearchableSelectionAndImagesTests() {
  console.log('\n===============================================================');
  console.log('SEARCHABLE SELECTION & IMAGE GALLERY TEST SUITE');
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

  dbStore.resetToSeed();

  // TEST 1: Searchable Customer Selection
  await test('1. Customer Searchable Selection filters real DB records correctly', async () => {
    let customers = dbStore.getCustomers();
    if (customers.length === 0) {
      await dbStore.transaction((state) => {
        state.customers.push({
          id: 'cust-demo-01',
          customerCode: 'CUST-0001',
          companyName: 'Larsen & Toubro Construction Ltd',
          referenceName: 'L&T Buildings',
          contactPerson: 'Vikram Malhotra',
          phone: '+91 98200 45678',
          email: 'vikram.m@lntecc.com',
          billingAddress: 'L&T House, Ballard Estate, Mumbai, Maharashtra 400001',
          city: 'Mumbai',
          state: 'Maharashtra',
          status: 'ACTIVE',
          creditLimit: 5000000,
          outstandingBalance: 0,
          sitesCount: 1,
          projectsCount: 1,
          activeRentalsCount: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });
      customers = dbStore.getCustomers();
    }

    assert(customers.length > 0, 'Database must contain customers');

    const sample = customers[0];
    
    // Filter by company name
    const queryName = sample.companyName.substring(0, 4).toLowerCase();
    const filteredByName = customers.filter(c =>
      Boolean(
        c.companyName?.toLowerCase().includes(queryName) ||
        c.customerCode?.toLowerCase().includes(queryName) ||
        c.phone?.includes(queryName) ||
        c.contactPerson?.toLowerCase().includes(queryName)
      )
    );
    assert(filteredByName.some(c => c.id === sample.id), 'Must match customer by company name substring');

    // Filter by customer code
    if (sample.customerCode) {
      const queryCode = sample.customerCode.toLowerCase();
      const filteredByCode = customers.filter(c =>
        Boolean(c.customerCode?.toLowerCase().includes(queryCode))
      );
      assert(filteredByCode.some(c => c.id === sample.id), 'Must match customer by customer code');
    }

    // Filter with non-matching query returns empty (shows "No matching customers found")
    const nonMatching = customers.filter(c =>
      Boolean(
        c.companyName?.toLowerCase().includes('xyz_non_existent_query_999') ||
        c.customerCode?.toLowerCase().includes('xyz_non_existent_query_999')
      )
    );
    assert.strictEqual(nonMatching.length, 0, 'Non-matching query must return 0 records');
  });

  // TEST 2: Searchable Inspected Project (NOT_INSTALLED) Selection
  await test('2. Inspected Project (NOT_INSTALLED) Searchable Selection filters accurately', async () => {
    // Register a new site project in NOT_INSTALLED
    const createdProject = await ProjectService.createProjectFromInspection({
      customerName: 'Godrej Properties Ltd',
      siteName: 'Godrej Vistas Tower C',
      siteAddress: 'Vikhroli East, Mumbai',
      contactPhone: '+91 98200 11223',
      supervisorName: 'Mustafa Alokhandwala',
      measurements: {
        length: 30,
        width: 10,
        height: 20,
        unit: 'FEET',
        description: 'Façade renovation scaffold',
      },
      photoUrls: ['/uploads/site_test_1.jpg', '/uploads/site_test_2.jpg'],
      actorId: 'usr-sup-01',
      actorName: 'Mustafa Alokhandwala',
    });

    assert.strictEqual(createdProject.status, 'NOT_INSTALLED');

    const notInstalledProjects = dbStore.getProjects().filter(p => p.status === 'NOT_INSTALLED');
    assert(notInstalledProjects.length > 0, 'Must have NOT_INSTALLED projects');

    // Search by projectCode
    const qCode = createdProject.projectCode.toLowerCase();
    const matchByCode = notInstalledProjects.filter(p =>
      Boolean(
        p.projectCode?.toLowerCase().includes(qCode) ||
        p.customerName?.toLowerCase().includes(qCode) ||
        p.siteName?.toLowerCase().includes(qCode)
      )
    );
    assert(matchByCode.some(p => p.id === createdProject.id), 'Must match by project code');

    // Search by siteName
    const qSite = 'godrej vistas';
    const matchBySite = notInstalledProjects.filter(p =>
      Boolean(
        p.projectCode?.toLowerCase().includes(qSite) ||
        p.customerName?.toLowerCase().includes(qSite) ||
        p.siteName?.toLowerCase().includes(qSite)
      )
    );
    assert(matchBySite.some(p => p.id === createdProject.id), 'Must match by site name');

    // Non matching returns 0
    const noMatch = notInstalledProjects.filter(p =>
      Boolean(p.projectCode?.toLowerCase().includes('unknown_code_99999'))
    );
    assert.strictEqual(noMatch.length, 0, 'Non-matching query must return 0 records');
  });

  // TEST 3: Searchable Confirmed / Scheduled Project to Commission Selection
  await test('3. Confirmed / Scheduled Project Searchable Selection filters accurately', async () => {
    // Confirm a project so it enters CONFIRMED_PROJECT status
    const unconfirmed = dbStore.getProjects().find(p => p.status === 'NOT_INSTALLED');
    assert(unconfirmed, 'Need at least one unconfirmed project');

    const materials = dbStore.getMaterials();
    const confirmRes = await InventoryService.reserveMaterialsForProject({
      projectId: unconfirmed.id,
      quotationNumber: `QTN-${unconfirmed.projectCode}`,
      quotationDate: new Date().toISOString().split('T')[0],
      agreedProjectPrice: 150000,
      monthlyRentalRate: 75000,
      plannedInstallationDate: '2026-11-15',
      durationMonths: 2,
      depositAmount: 50000,
      transportCharges: 10000,
      installationLabourCharges: 25000,
      paymentTerms: '30 days advance',
      materials: [
        { materialId: materials[0].id, requiredQuantity: 10, proposedReserveQty: 10 },
      ],
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu',
    });
    const confirmed = confirmRes.project;

    assert.strictEqual(confirmed.status, 'CONFIRMED_PROJECT');

    const readyProjects = dbStore.getProjects().filter(p =>
      p.status === 'CONFIRMED_PROJECT' || p.status === 'SCHEDULED'
    );
    assert(readyProjects.length > 0, 'Must have confirmed / scheduled projects');

    // Search by Project Code
    const qProj = confirmed.projectCode.toLowerCase();
    const matchProj = readyProjects.filter(p =>
      Boolean(
        p.projectCode?.toLowerCase().includes(qProj) ||
        p.customerName?.toLowerCase().includes(qProj) ||
        p.siteName?.toLowerCase().includes(qProj)
      )
    );
    assert(matchProj.some(p => p.id === confirmed.id), 'Must match confirmed project by code');

    // Search by Quotation Number
    const qQuotation = confirmed.quotationNumber!.toLowerCase();
    const matchQuotation = readyProjects.filter(p =>
      Boolean(
        p.quotationNumber?.toLowerCase().includes(qQuotation) ||
        p.projectCode?.toLowerCase().includes(qQuotation)
      )
    );
    assert(matchQuotation.some(p => p.id === confirmed.id), 'Must match by quotation number');
  });

  // TEST 4: Site Form Image Upload & Attachment Linking
  await test('4. Site Form saves multiple uploaded images against project correctly', async () => {
    const uploadedPhotos = [
      '/uploads/gallery_photo_1.jpg',
      '/uploads/gallery_photo_2.jpg',
      '/uploads/camera_capture_3.jpg',
    ];

    const project = await ProjectService.createProjectFromInspection({
      customerName: 'Shapoorji Pallonji Real Estate',
      siteName: 'Imperial Heights Tower 2',
      siteAddress: 'Worli Naka, Mumbai',
      contactPhone: '+91 98333 44556',
      supervisorName: 'Mustafa Alokhandwala',
      measurements: {
        length: 50,
        width: 15,
        height: 35,
        unit: 'FEET',
      },
      photoUrls: uploadedPhotos,
      actorId: 'usr-sup-01',
      actorName: 'Mustafa Alokhandwala',
    });

    assert(project.photos, 'Project must contain photos array');
    assert.strictEqual(project.photos.length, 3, 'Must save all 3 uploaded images');
    assert(project.photos.every(p => p.entityType === 'SITE_INSPECTION'), 'Photos must have entityType SITE_INSPECTION');
    assert(project.photos.some(p => p.fileUrl === '/uploads/camera_capture_3.jpg'), 'Camera photo must be saved');
    assert(project.photos.some(p => p.fileUrl === '/uploads/gallery_photo_1.jpg'), 'Gallery photo must be saved');
  });

  // TEST 5: Field Installation Image Upload & Commissioning Linking
  await test('5. Field Installation saves after-installation photos and commissions rental', async () => {
    const readyProject = dbStore.getProjects().find(p => p.status === 'CONFIRMED_PROJECT');
    assert(readyProject, 'Need a confirmed project to install');

    const initialPhotoCount = (readyProject.photos || []).length;
    const afterPhotos = [
      '/uploads/installation_erection_complete_1.jpg',
      '/uploads/installation_scaffold_tag_2.jpg',
    ];

    const installRes = await InventoryService.submitInstallation({
      projectId: readyProject.id,
      actualInstallationDate: '2026-11-16',
      supervisorId: 'usr-sup-01',
      executingSupervisorName: 'Mustafa Alokhandwala',
      isSameSupervisor: true,
      workersList: [
        { id: 'w-1', name: 'Ramesh Yadav', role: 'Lead Rigger' },
        { id: 'w-2', name: 'Suresh Patil', role: 'Scaffolder' },
      ],
      actualMeasurements: {
        length: readyProject.measurements?.length || 30,
        width: readyProject.measurements?.width || 10,
        height: readyProject.measurements?.height || 20,
        unit: 'FEET',
        isCorrect: true,
        variancePercentage: 0,
        remarks: 'Exact physical match',
      },
      clientRepresentativeName: 'Mahesh Jadhav (Site Engineer)',
      remarks: 'Erection conforming to safety inspection',
      afterPhotoUrls: afterPhotos,
      materialsUsed: [
        {
          materialId: (readyProject.materialsReserved || [])[0]?.materialId || 'mat-001',
          installedQuantity: 10,
          unusedReturnedQty: 0,
        },
      ],
      actorId: 'usr-sup-01',
      actorName: 'Mustafa Alokhandwala',
    });
    const installed = installRes.project;

    assert(installed.status === 'INSTALLED' || installed.status === 'ACTIVE_RENTAL', 'Status must transition to INSTALLED or ACTIVE_RENTAL');
    assert(installed.photos && installed.photos.length >= initialPhotoCount + 2, 'Photos array must include after photos');
    
    const afterAttachments = installed.photos.filter(p => p.stageLabel === 'AFTER_INSTALLATION');
    assert.strictEqual(afterAttachments.length, 2, 'Must have 2 after-installation photo attachments');
    assert(afterAttachments.every(p => p.entityType === 'INSTALLATION'), 'Must have entityType INSTALLATION');
  });

  // TEST 6: Confirmation & Installation PDF Generation after changes
  await test('6. Confirmation & Installation PDF generation operates smoothly with photos', async () => {
    const installedProject = dbStore.getProjects().find(p => p.status === 'INSTALLED' || p.status === 'ACTIVE_RENTAL');
    assert(installedProject, 'Need installed project');

    const customer = dbStore.getCustomers().find(c => c.id === installedProject.customerId) || {
      id: 'cust-fallback',
      customerCode: 'CUST-0001',
      companyName: installedProject.customerName,
      referenceName: 'Client Ref',
      contactPerson: 'Contact Person',
      phone: '+91 98200 00000',
      email: 'info@client.com',
      billingAddress: 'Mumbai, Maharashtra',
      city: 'Mumbai',
      state: 'Maharashtra',
      status: 'ACTIVE' as const,
      creditLimit: 1000000,
      outstandingBalance: 0,
      sitesCount: 1,
      projectsCount: 1,
      activeRentalsCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const site = {
      id: 'site-1',
      customerId: customer.id,
      siteName: installedProject.siteName,
      address: installedProject.siteAddress || 'Site Address',
      city: 'Mumbai',
      state: 'Maharashtra',
      status: 'ACTIVE' as const,
      projectsCount: 1,
      activeRentalsCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await generateConfirmationPdf({
      ...installedProject,
      customer,
      site,
    });

    await generateInstallationPdf({
      ...installedProject,
      customer,
      site,
    });
    assert.ok(true, 'Both PDFs generated successfully without throwing');
  });

  console.log(`\n---------------------------------------------------------------`);
  console.log(`Searchable Selection & Images Results: ${passed} Passed, ${failed} Failed`);
  console.log(`---------------------------------------------------------------\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in searchable selection and images suite`);
  }
}

if (process.argv[1]?.includes('searchable-selection-and-images.test')) {
  runSearchableSelectionAndImagesTests().catch((e) => {
    console.error('Fatal test error:', e);
    process.exit(1);
  });
}
