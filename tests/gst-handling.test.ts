// ALOKHANDWALA - GST Number Checkbox & Handling Automated Test Suite
// Verifies Site Form Client GST, Commercial Quotation Company GST, and PDF Generation

process.env.IS_TEST = 'true';

import assert from 'assert';
import { isValidGSTIN, GSTIN_REGEX } from '../src/lib/validations';
import { ProjectService } from '../src/lib/services/project-service';
import { QuotationService } from '../src/lib/services/quotation-service';
import { buildQuotationPdfDoc } from '../src/lib/pdf/project-pdf';
import { dbStore } from '../src/lib/db/store';

export async function runGstHandlingTests() {
  console.log('\n===============================================================');
  console.log('GST NUMBER CHECKBOX & HANDLING TEST SUITE');
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

  // 1. Validation tests
  await test('1. GSTIN format validator accepts valid 15-character Indian GSTINs', () => {
    assert.strictEqual(isValidGSTIN('23AABCA1234F1Z5'), true);
    assert.strictEqual(isValidGSTIN('27AAACL1234F1Z9'), true);
    assert.strictEqual(isValidGSTIN('23AAACG1234F1Z1'), true);
  });

  await test('2. GSTIN format validator rejects invalid GSTINs and N/A', () => {
    assert.strictEqual(isValidGSTIN('N/A'), false);
    assert.strictEqual(isValidGSTIN(''), false);
    assert.strictEqual(isValidGSTIN(null), false);
    assert.strictEqual(isValidGSTIN(undefined), false);
    assert.strictEqual(isValidGSTIN('12345'), false); // Too short
    assert.strictEqual(isValidGSTIN('23AABCA1234F1Z599'), false); // Too long
    assert.strictEqual(isValidGSTIN('INVALID_GST_NUMBER'), false); // Non-GST string
    assert.strictEqual(GSTIN_REGEX.test('23aabca1234f1z5'), false); // Regex is strict uppercase
  });

  // 2. Site Form & Project Service - Checked Client GST
  let projectWithGstId = '';
  await test('3. Site Form / ProjectService creates project with checked Client GST', async () => {
    const project = await ProjectService.createProjectFromInspection({
      customerName: 'Indore Prime Towers Pvt Ltd',
      siteName: 'Indore Prime Site A',
      siteAddress: 'Scheme 78, Vijay Nagar, Indore, MP',
      contactPhone: '9820011223',
      hasClientGst: true,
      clientGstNumber: '23AAACI9876E1Z2',
      measurements: {
        width: 30,
        depth: 3,
        height: 25,
        unit: 'FEET',
        measurementType: 'FAÇADE_SCAFFOLD',
      },
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu',
    });

    assert.strictEqual(project.hasClientGst, true);
    assert.strictEqual(project.clientGstNumber, '23AAACI9876E1Z2');
    projectWithGstId = project.id;

    // Verify site also saved client GST
    const site = dbStore.getSites().find(s => s.id === project.siteId);
    assert.ok(site);
    assert.strictEqual(site.hasClientGst, true);
    assert.strictEqual(site.clientGstNumber, '23AAACI9876E1Z2');
  });

  // 3. Site Form & Project Service - Unchecked Client GST (Saves N/A)
  let projectWithoutGstId = '';
  await test('4. Site Form / ProjectService creates project with unchecked Client GST saving N/A', async () => {
    const project = await ProjectService.createProjectFromInspection({
      customerName: 'Shree Construction Indore',
      siteName: 'Palasia Commercial Hub',
      siteAddress: '56 Dukan Road, New Palasia, Indore, MP',
      contactPhone: '9820044556',
      hasClientGst: false,
      clientGstNumber: '',
      measurements: {
        width: 20,
        depth: 3,
        height: 15,
        unit: 'FEET',
        measurementType: 'FAÇADE_SCAFFOLD',
      },
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu',
    });

    assert.strictEqual(project.hasClientGst, false);
    assert.strictEqual(project.clientGstNumber, 'N/A');
    projectWithoutGstId = project.id;

    const site = dbStore.getSites().find(s => s.id === project.siteId);
    assert.ok(site);
    assert.strictEqual(site.hasClientGst, false);
    assert.strictEqual(site.clientGstNumber, 'N/A');
  });

  // 4. Commercial Quotation - Checked Company GST
  await test('5. QuotationService saves Company GST independently of Client GST', async () => {
    const result = await QuotationService.saveQuotation({
      projectId: projectWithoutGstId,
      status: 'DRAFT',
      ratePerSqFt: 25,
      totalAreaSqFt: 300,
      hasCompanyGst: true,
      companyGstNumber: '23AABCA1234F1Z5',
      hasClientGst: false,
      clientGstNumber: 'N/A',
      materials: [],
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu',
    });

    assert.strictEqual(result.quotation.hasCompanyGst, true);
    assert.strictEqual(result.quotation.companyGstNumber, '23AABCA1234F1Z5');
    assert.strictEqual(result.quotation.hasClientGst, false);
    assert.strictEqual(result.quotation.clientGstNumber, 'N/A');

    // Verify Project linking
    assert.strictEqual(result.project.hasCompanyGst, true);
    assert.strictEqual(result.project.companyGstNumber, '23AABCA1234F1Z5');
  });

  // 5. Commercial Quotation - Unchecked Company GST (Saves N/A)
  await test('6. QuotationService saves N/A when Company GST is unchecked', async () => {
    const result = await QuotationService.saveQuotation({
      projectId: projectWithGstId,
      status: 'DRAFT',
      ratePerSqFt: 28,
      totalAreaSqFt: 750,
      hasCompanyGst: false,
      companyGstNumber: '',
      hasClientGst: true,
      clientGstNumber: '23AAACI9876E1Z2',
      materials: [],
      actorId: 'usr-admin-01',
      actorName: 'Burhan Malu',
    });

    assert.strictEqual(result.quotation.hasCompanyGst, false);
    assert.strictEqual(result.quotation.companyGstNumber, 'N/A');
    assert.strictEqual(result.quotation.hasClientGst, true);
    assert.strictEqual(result.quotation.clientGstNumber, '23AAACI9876E1Z2');
  });

  // 6. PDF Generation - Handles both checked and unchecked states with N/A
  await test('7. Quotation PDF renders successfully with unchecked Company GST (N/A) and checked Client GST', async () => {
    const project = dbStore.getProjects().find(p => p.id === projectWithGstId);
    assert.ok(project);
    const quotation = dbStore.getQuotations().find(q => q.projectId === projectWithGstId);
    assert.ok(quotation);

    const doc = await buildQuotationPdfDoc(
      {
        ...project,
        customer: dbStore.getCustomers().find(c => c.id === project.customerId),
        site: dbStore.getSites().find(s => s.id === project.siteId),
      },
      quotation
    );

    assert.ok(doc);
    assert.ok(doc.getNumberOfPages() >= 1);
  });

  await test('8. Quotation PDF renders successfully with checked Company GST and unchecked Client GST (N/A)', async () => {
    const project = dbStore.getProjects().find(p => p.id === projectWithoutGstId);
    assert.ok(project);
    const quotation = dbStore.getQuotations().find(q => q.projectId === projectWithoutGstId);
    assert.ok(quotation);

    const doc = await buildQuotationPdfDoc(
      {
        ...project,
        customer: dbStore.getCustomers().find(c => c.id === project.customerId),
        site: dbStore.getSites().find(s => s.id === project.siteId),
      },
      quotation
    );

    assert.ok(doc);
    assert.ok(doc.getNumberOfPages() >= 1);
  });

  console.log('---------------------------------------------------------------');
  console.log(`GST Handling Results: ${passed} Passed, ${failed} Failed`);
  console.log('---------------------------------------------------------------');

  if (failed > 0) {
    throw new Error(`GST Handling Test Suite failed with ${failed} failure(s)`);
  }
}

if (process.argv[1]?.includes('gst-handling')) {
  runGstHandlingTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
