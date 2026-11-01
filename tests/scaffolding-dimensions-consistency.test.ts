import { dbStore } from '../src/lib/db/store';
import { calculateScaffoldingArea, extractProjectDimensions } from '../src/lib/formatters';
import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ PASS: ${message}`);
}

export async function runScaffoldingDimensionsTests() {
  console.log('\n===============================================================');
  console.log('SCAFFOLDING DIMENSIONS DATA CONSISTENCY TEST SUITE');
  console.log('Testing AW-SCF-000002 & Dynamic Multi-Project Consistency');
  console.log('===============================================================\n');

  // Test 1: Verify AW-SCF-000002 baseline measurements in ERP production database
  const realDbPath = path.join(process.cwd(), '.data', 'alokhandwala-erp.json');
  assert(fs.existsSync(realDbPath), 'alokhandwala-erp.json database exists');
  
  const realDb = JSON.parse(fs.readFileSync(realDbPath, 'utf8'));
  const aw02 = (realDb.projects || []).find((p: any) => p.projectCode === 'AW-SCF-000002');
  assert(!!aw02, 'AW-SCF-000002 exists in production store');
  assert(!!aw02?.measurements, 'AW-SCF-000002 has measurements record');
  
  const m = aw02.measurements;
  assert(m.width === 10, `AW-SCF-000002 Width is 10 ft (got ${m.width})`);
  assert(m.depth === 15, `AW-SCF-000002 Depth is 15 ft (got ${m.depth})`);
  assert(m.height === 20, `AW-SCF-000002 Height is 20 ft (got ${m.height})`);

  // Test 2: Calculate Elevation Area for AW-SCF-000002 (Width 10, Depth 15, Height 20)
  // Rule: depth > 3 => adjustedDepth = 15 / 3 = 5 => area = 10 * 5 * 20 = 1000 sq. ft.
  const calcArea = calculateScaffoldingArea(10, 15, 20, 'FEET');
  assert(calcArea === 1000, `Area calculation for 10x15x20 FEET equals 1,000 sq. ft. (got ${calcArea})`);

  // Test 3: Test extractProjectDimensions on AW-SCF-000002
  const extracted02 = extractProjectDimensions(aw02);
  assert(extracted02.width === 10, `Extracted Width is 10 (got ${extracted02.width})`);
  assert(extracted02.depth === 15, `Extracted Depth is 15 (got ${extracted02.depth})`);
  assert(extracted02.height === 20, `Extracted Height is 20 (got ${extracted02.height})`);
  assert(extracted02.unit === 'FEET', `Extracted Unit is FEET (got ${extracted02.unit})`);
  assert(extracted02.elevationAreaSqFt === 1000, `Extracted Elevation Area is 1000 sq. ft. (got ${extracted02.elevationAreaSqFt})`);
  assert(
    extracted02.formattedDimensions === '10 (W) × 15 (D) × 20 (H) FEET',
    `Formatted Dimensions match standard "10 (W) × 15 (D) × 20 (H) FEET" (got "${extracted02.formattedDimensions}")`
  );
  assert(
    extracted02.formattedArea === '1,000 sq. ft.',
    `Formatted Area matches standard "1,000 sq. ft." (got "${extracted02.formattedArea}")`
  );

  // Test 4: Dynamic project with different dimensions (Width: 60, Depth: 9, Height: 30)
  // adjustedDepth = 9 / 3 = 3 => area = 60 * 3 * 30 = 5,400 sq. ft.
  const dynamicProj = {
    measurements: {
      width: 60,
      depth: 9,
      height: 30,
      unit: 'FEET',
    }
  };
  const extractedDyn = extractProjectDimensions(dynamicProj);
  assert(extractedDyn.width === 60, `Dynamic project Width is 60 (got ${extractedDyn.width})`);
  assert(extractedDyn.depth === 9, `Dynamic project Depth is 9 (got ${extractedDyn.depth})`);
  assert(extractedDyn.height === 30, `Dynamic project Height is 30 (got ${extractedDyn.height})`);
  assert(extractedDyn.elevationAreaSqFt === 5400, `Dynamic project Area is 5,400 sq. ft. (got ${extractedDyn.elevationAreaSqFt})`);
  assert(
    extractedDyn.formattedDimensions === '60 (W) × 9 (D) × 30 (H) FEET',
    `Dynamic formatted dimensions match "60 (W) × 9 (D) × 30 (H) FEET" (got "${extractedDyn.formattedDimensions}")`
  );
  assert(
    extractedDyn.formattedArea === '5,400 sq. ft.',
    `Dynamic formatted area matches "5,400 sq. ft." (got "${extractedDyn.formattedArea}")`
  );

  // Test 5: Standard shallow depth <= 3 ft (Width: 20, Depth: 3, Height: 15)
  // adjustedDepth = 1 => area = 20 * 1 * 15 = 300 sq. ft.
  const shallowProj = {
    measurements: {
      width: 20,
      depth: 3,
      height: 15,
      unit: 'FEET',
    }
  };
  const extractedShallow = extractProjectDimensions(shallowProj);
  assert(extractedShallow.elevationAreaSqFt === 300, `Shallow depth area is 300 sq. ft. (got ${extractedShallow.elevationAreaSqFt})`);

  // Test 6: Verify confirmation form pages use extractProjectDimensions
  const confirmPagePath = path.join(__dirname, '../src/app/(dashboard)/confirmation/page.tsx');
  const confirmPageContent = fs.readFileSync(confirmPagePath, 'utf8');
  assert(
    confirmPageContent.includes('extractProjectDimensions'),
    'confirmation/page.tsx imports and utilizes extractProjectDimensions'
  );
  assert(
    !confirmPageContent.includes('m.length * m.height') && !confirmPageContent.includes('(m?.length || 0) * (m?.height || 0)'),
    'confirmation/page.tsx has completely eliminated erroneous length * height multiplication'
  );

  // Test 7: Verify project confirmation subpage uses extractProjectDimensions
  const projConfirmPath = path.join(__dirname, '../src/app/(dashboard)/projects/[id]/confirm/page.tsx');
  const projConfirmContent = fs.readFileSync(projConfirmPath, 'utf8');
  assert(
    projConfirmContent.includes('extractProjectDimensions'),
    'projects/[id]/confirm/page.tsx imports and utilizes extractProjectDimensions'
  );

  // Test 8: Verify Commercial Quotation uses extractProjectDimensions
  const quotationPagePath = path.join(__dirname, '../src/app/(dashboard)/quotation/page.tsx');
  const quotationPageContent = fs.readFileSync(quotationPagePath, 'utf8');
  assert(
    quotationPageContent.includes('extractProjectDimensions'),
    'quotation/page.tsx imports and utilizes extractProjectDimensions'
  );

  // Test 9: Verify PDF Generator uses extractProjectDimensions
  const pdfGenPath = path.join(__dirname, '../src/lib/pdf/project-pdf.ts');
  const pdfGenContent = fs.readFileSync(pdfGenPath, 'utf8');
  assert(
    pdfGenContent.includes('extractProjectDimensions'),
    'project-pdf.ts imports and utilizes extractProjectDimensions'
  );

  // Test 10: Verify Installation pages use extractProjectDimensions
  const installPath = path.join(__dirname, '../src/app/(dashboard)/installation/page.tsx');
  const installContent = fs.readFileSync(installPath, 'utf8');
  assert(
    installContent.includes('extractProjectDimensions'),
    'installation/page.tsx imports and utilizes extractProjectDimensions'
  );

  console.log('---------------------------------------------------------------');
  console.log('Scaffolding Dimensions Consistency: 10 Passed, 0 Failed');
  console.log('---------------------------------------------------------------\n');
}

if (require.main === module) {
  runScaffoldingDimensionsTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}
