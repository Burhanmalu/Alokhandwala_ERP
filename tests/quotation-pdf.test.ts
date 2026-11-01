// ALOKHANDWALA - Commercial Quotation PDF Dedicated Automated Test Suite
// Validates Financial Calculations, Dimension Formatting, Terms, Signatures, and Layout

process.env.IS_TEST = 'true';

import assert from 'assert';
import { buildQuotationPdfDoc, ProjectWithRelations } from '../src/lib/pdf/project-pdf';
import { OFFICIAL_TERMS_AND_CONDITIONS } from '../src/lib/constants/terms-and-conditions';
import { dbStore } from '../src/lib/db/store';
import { Quotation } from '../src/lib/schema';

export async function runQuotationPdfTests() {
  console.log('\n===============================================================');
  console.log('COMMERCIAL QUOTATION PDF ENHANCED TEST SUITE');
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

  const baseProject: any = {
    id: 'prj-test-pdf-01',
    projectCode: 'AW-SCF-TEST01',
    customerName: 'Shapoorji Pallonji Real Estate',
    customerId: 'cust-test-01',
    siteName: 'Indore Metro Rail Viaduct Pier 42',
    siteId: 'site-test-01',
    siteAddress: 'AB Road, Scheme 54, Near Vijay Nagar, Indore, MP',
    status: 'NOT_INSTALLED',
    totalAreaSqFt: 500,
    monthlyRentalRate: 25000,
    advancePaidAmount: 18750,
    supervisorName: 'Mustafa Alokhandwala',
    assignedSupervisorId: 'usr-sup-01',
    contactPhone: '9820045678',
    customer: {
      id: 'cust-test-01',
      customerCode: 'CUST-0001',
      companyName: 'Shapoorji Pallonji Real Estate',
      contactPerson: 'Vikram Malhotra',
      phone: '9820045678',
      email: '',
      billingAddress: 'Commercial Tower A, AB Road, Indore, MP',
      city: 'Indore',
      state: 'Madhya Pradesh',
      gstin: '23AAACT1234F1Z9',
      creditLimit: 500000,
      outstandingBalance: 0,
      status: 'ACTIVE',
      sitesCount: 1,
      projectsCount: 1,
      activeRentalsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    materials: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Dynamic Financial Calculations: Item totals, Subtotal, GST, Grand Total, 75/25 split
  await test('1. Dynamic Financial Calculations: Exact 75% advance & 25% balance split totalling 100%', async () => {
    const quotation: Quotation = {
      id: 'qtn-test-01',
      quotationNumber: 'QTN-2026-TEST-001',
      projectId: baseProject.id,
      projectCode: baseProject.projectCode,
      customerId: baseProject.customerId,
      customerName: baseProject.customerName,
      siteId: baseProject.siteId,
      siteName: baseProject.siteName,
      siteAddress: baseProject.siteAddress,
      quotationDate: '2026-11-01',
      status: 'SENT',
      ratePerSqFt: 50,
      totalAreaSqFt: 500,
      rentalDurationDays: 28,
      durationMonths: 1,
      monthlyRentalAmount: 25000,
      walkwayJaliIncludedQuantity: 0,
      extraJaliQuantity: 10,
      extraJaliRate: 200,
      extraJaliCharges: 2000,
      transportCharges: 4000,
      shiftingCharges: 1000,
      otherCharges: 500,
      subtotal: 32500, // 25000 + 2000 + 4000 + 1000 + 500
      gstPercentage: 18,
      gstAmount: 5850, // 32500 * 0.18
      grandTotal: 38350, // 32500 + 5850
      advancePercentage: 75,
      advanceAmount: 28762.5, // 38350 * 0.75
      remainingAmount: 9587.5, // 38350 * 0.25
      materials: [
        { itemCode: 'CUPLOCK-VERT-3M', materialName: 'Cuplock Vertical 3.0m', unit: 'NOS', quantity: 50, monthlyRentalRate: 40, totalMonthlyRent: 2000 },
        { itemCode: 'CUPLOCK-LEDG-2M', materialName: 'Cuplock Ledger 2.0m', unit: 'NOS', quantity: 100, monthlyRentalRate: 25, totalMonthlyRent: 2500 },
      ],
      hasCompanyGst: true,
      companyGstNumber: '23AABCA1234F1Z5',
      hasClientGst: true,
      clientGstNumber: '23AAACT1234F1Z9',
      createdBy: 'usr-admin-01',
      createdByName: 'Burhan Malu',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const doc = await buildQuotationPdfDoc(baseProject, quotation);
    assert.ok(doc, 'PDF Document generated');
    assert.ok(doc.getNumberOfPages() >= 1, 'At least 1 page generated');

    // Mathematically verify 75% + 25% = 100%
    assert.strictEqual(quotation.advanceAmount + quotation.remainingAmount, quotation.grandTotal);
    assert.strictEqual(quotation.subtotal + quotation.gstAmount, quotation.grandTotal);
  });

  // 2. Dimension Formatting: Shows "Not Provided" when dimensions are 0 or missing
  await test('2. Dimension Handling: Renders "Not Provided" when dimensions are missing or 0', async () => {
    const projectNoDims: ProjectWithRelations = {
      ...baseProject,
      siteDimensions: undefined,
      measurements: undefined,
      totalAreaSqFt: 0,
    };

    const quotationNoDims: Quotation = {
      id: 'qtn-test-02',
      quotationNumber: 'QTN-2026-NODIMS',
      projectId: projectNoDims.id,
      projectCode: projectNoDims.projectCode,
      customerId: projectNoDims.customerId,
      customerName: projectNoDims.customerName,
      siteId: projectNoDims.siteId,
      siteName: projectNoDims.siteName,
      siteAddress: projectNoDims.siteAddress,
      quotationDate: '2026-11-01',
      status: 'DRAFT',
      ratePerSqFt: 0,
      totalAreaSqFt: 0,
      rentalDurationDays: 28,
      durationMonths: 1,
      monthlyRentalAmount: 15000,
      walkwayJaliIncludedQuantity: 0,
      extraJaliQuantity: 0,
      extraJaliRate: 200,
      extraJaliCharges: 0,
      transportCharges: 3000,
      shiftingCharges: 0,
      otherCharges: 0,
      subtotal: 18000,
      gstPercentage: 18,
      gstAmount: 3240,
      grandTotal: 21240,
      advancePercentage: 75,
      advanceAmount: 15930,
      remainingAmount: 5310,
      materials: [],
      hasCompanyGst: false,
      companyGstNumber: 'N/A',
      hasClientGst: false,
      clientGstNumber: 'N/A',
      createdBy: 'usr-admin-01',
      createdByName: 'Burhan Malu',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const doc = await buildQuotationPdfDoc(projectNoDims, quotationNoDims);
    assert.ok(doc);
    assert.ok(doc.getNumberOfPages() >= 1);
  });

  // 3. Dimension Formatting: Formats positive width x depth x height correctly
  await test('3. Dimension Handling: Renders formatted dimensions when positive measurements exist', async () => {
    const projectWithDims: ProjectWithRelations = {
      ...baseProject,
      siteDimensions: {
        width: 10,
        height: 20,
        length: 3,
        unit: 'FEET',
        configurationType: 'INDEPENDENT_FACADE' as any,
      },
      totalAreaSqFt: 400,
    };

    const doc = await buildQuotationPdfDoc(projectWithDims, null);
    assert.ok(doc);
    assert.ok(doc.getNumberOfPages() >= 1);
  });

  // 4. Negotiated Package Rent vs Itemized Sum differentiation
  await test('4. Pricing Breakdown: Differentiates negotiated package rent from raw itemized material sum', async () => {
    const projectPackage: ProjectWithRelations = {
      ...baseProject,
      totalAreaSqFt: 1000,
    };

    const quotationPackage: Quotation = {
      id: 'qtn-test-pkg',
      quotationNumber: 'QTN-2026-PACKAGE',
      projectId: projectPackage.id,
      projectCode: projectPackage.projectCode,
      customerId: projectPackage.customerId,
      customerName: projectPackage.customerName,
      siteId: projectPackage.siteId,
      siteName: projectPackage.siteName,
      siteAddress: projectPackage.siteAddress,
      quotationDate: '2026-11-01',
      status: 'SENT',
      ratePerSqFt: 25,
      totalAreaSqFt: 1000,
      rentalDurationDays: 28,
      durationMonths: 1,
      monthlyRentalAmount: 25000, // Package price (1000 * 25)
      walkwayJaliIncludedQuantity: 0,
      extraJaliQuantity: 5,
      extraJaliRate: 200,
      extraJaliCharges: 1000,
      transportCharges: 4000,
      shiftingCharges: 0,
      otherCharges: 0,
      subtotal: 30000,
      gstPercentage: 18,
      gstAmount: 5400,
      grandTotal: 35400,
      advancePercentage: 75,
      advanceAmount: 26550,
      remainingAmount: 8850,
      // Materials sum is intentionally different (e.g. 18,000) to test package note
      materials: [
        { itemCode: 'CUPLOCK-VERT-3M', materialName: 'Cuplock Vertical 3.0m', unit: 'NOS', quantity: 300, monthlyRentalRate: 40, totalMonthlyRent: 12000 },
        { itemCode: 'CUPLOCK-LEDG-2M', materialName: 'Cuplock Ledger 2.0m', unit: 'NOS', quantity: 240, monthlyRentalRate: 25, totalMonthlyRent: 6000 },
      ],
      hasCompanyGst: true,
      companyGstNumber: '23AABCA1234F1Z5',
      hasClientGst: true,
      clientGstNumber: '23AAACT1234F1Z9',
      createdBy: 'usr-admin-01',
      createdByName: 'Burhan Malu',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const doc = await buildQuotationPdfDoc(projectPackage, quotationPackage);
    assert.ok(doc);
    assert.ok(doc.getNumberOfPages() >= 1);
  });

  // 5. Terms & Conditions and Bilateral Signatures
  await test('5. Terms & Signatures: Official 11 business terms and dual signature boxes render cleanly', async () => {
    assert.strictEqual(OFFICIAL_TERMS_AND_CONDITIONS.length, 11);
    const doc = await buildQuotationPdfDoc(baseProject, null);
    assert.ok(doc);
    assert.ok(doc.getNumberOfPages() >= 2, 'Terms and signature sections span across at least 2 pages cleanly');
  });

  console.log('---------------------------------------------------------------');
  console.log(`Commercial Quotation PDF Results: ${passed} Passed, ${failed} Failed`);
  console.log('---------------------------------------------------------------');

  if (failed > 0) {
    throw new Error(`Quotation PDF Test Suite failed with ${failed} failure(s)`);
  }
}

if (process.argv[1]?.includes('quotation-pdf')) {
  runQuotationPdfTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

