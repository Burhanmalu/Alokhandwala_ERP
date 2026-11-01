import assert from 'node:assert';
import { calculateScaffoldingArea, extractProjectDimensions } from '../src/lib/formatters';

export function runGlobalElevationAreaFormulaTests() {
  console.log('\n===============================================================');
  console.log('GLOBAL SCAFFOLDING ELEVATION AREA FORMULA TEST SUITE');
  console.log('Condition 1 (Depth > 3): Width × (Depth / 3) × Height');
  console.log('Condition 2 (Depth < 3): Width × 1 × Height');
  console.log('Condition 3 (Depth = 3): Width × 1 × Height');
  console.log('===============================================================');

  // --- 1. USER SPECIFIED TEST CASES ---
  // Case 1: 10 × 15 × 20 ft => 1,000 sq. ft. (Depth > 3: 10 * (15/3) * 20 = 1000)
  const case1 = calculateScaffoldingArea(10, 15, 20, 'FEET');
  assert.strictEqual(case1, 1000, `Expected 1000 sq. ft. for 10x15x20, got ${case1}`);
  console.log('  ✓ PASS: Case 1: 10 (W) × 15 (D) × 20 (H) FEET = 1,000 sq. ft.');

  // Case 2: 10 × 2 × 20 ft => 200 sq. ft. (Depth < 3: 10 * 1 * 20 = 200)
  const case2 = calculateScaffoldingArea(10, 2, 20, 'FEET');
  assert.strictEqual(case2, 200, `Expected 200 sq. ft. for 10x2x20, got ${case2}`);
  console.log('  ✓ PASS: Case 2: 10 (W) × 2 (D) × 20 (H) FEET = 200 sq. ft.');

  // Case 3: 12 × 6 × 15 ft => 360 sq. ft. (Depth > 3: 12 * (6/3) * 15 = 360)
  const case3 = calculateScaffoldingArea(12, 6, 15, 'FEET');
  assert.strictEqual(case3, 360, `Expected 360 sq. ft. for 12x6x15, got ${case3}`);
  console.log('  ✓ PASS: Case 3: 12 (W) × 6 (D) × 15 (H) FEET = 360 sq. ft.');

  // Case 4: 10 × 3 × 20 ft => 200 sq. ft. (Depth = 3: 10 * 1 * 20 = 200)
  const case4 = calculateScaffoldingArea(10, 3, 20, 'FEET');
  assert.strictEqual(case4, 200, `Expected 200 sq. ft. for 10x3x20, got ${case4}`);
  console.log('  ✓ PASS: Case 4: 10 (W) × 3 (D) × 20 (H) FEET = 200 sq. ft.');

  // Case 5: 8 × 12 × 10 ft => 320 sq. ft. (Depth > 3: 8 * (12/3) * 10 = 320)
  const case5 = calculateScaffoldingArea(8, 12, 10, 'FEET');
  assert.strictEqual(case5, 320, `Expected 320 sq. ft. for 8x12x10, got ${case5}`);
  console.log('  ✓ PASS: Case 5: 8 (W) × 12 (D) × 10 (H) FEET = 320 sq. ft.');

  // --- 2. BOUNDARY CONDITIONS AROUND DEPTH = 3.0 ---
  const boundaryAt3 = calculateScaffoldingArea(10, 3.0, 10, 'FEET');
  assert.strictEqual(boundaryAt3, 100, `Depth = 3.0 must yield Width * 1 * Height = 100, got ${boundaryAt3}`);
  console.log('  ✓ PASS: Boundary: Depth = 3.0 ft uses multiplier 1 (got 100 sq. ft.)');

  const boundaryBelow3 = calculateScaffoldingArea(10, 2.99, 10, 'FEET');
  assert.strictEqual(boundaryBelow3, 100, `Depth = 2.99 must yield Width * 1 * Height = 100, got ${boundaryBelow3}`);
  console.log('  ✓ PASS: Boundary: Depth = 2.99 ft (< 3) uses multiplier 1 (got 100 sq. ft.)');

  const boundaryAbove3 = calculateScaffoldingArea(10, 3.3, 10, 'FEET');
  // 10 * (3.3 / 3) * 10 = 10 * 1.1 * 10 = 110
  assert.strictEqual(boundaryAbove3, 110, `Depth = 3.3 must yield 10 * (3.3/3) * 10 = 110, got ${boundaryAbove3}`);
  console.log('  ✓ PASS: Boundary: Depth = 3.3 ft (> 3) uses Depth / 3 multiplier (got 110 sq. ft.)');

  // --- 3. METRIC UNIT NORMALIZATION (METERS -> FEET) ---
  // 10 ft = 3.048m, 15 ft = 4.572m, 20 ft = 6.096m
  // In meters: 3.048 × 4.572 × 6.096 METERS
  const metricArea = calculateScaffoldingArea(3.048, 4.572, 6.096, 'METERS');
  assert.strictEqual(Math.round(metricArea), 1000, `Expected approx 1000 sq. ft. from metric dimensions, got ${metricArea}`);
  console.log('  ✓ PASS: Metric conversion: 3.048m × 4.572m × 6.096m normalizes to 1,000 sq. ft.');

  // --- 4. EXTRACT PROJECT DIMENSIONS (SINGLE SOURCE OF TRUTH) ---
  // Stale database record with wrong stored area: 500 or 200
  const staleRecord = {
    measurements: {
      width: 10,
      depth: 15,
      height: 20,
      unit: 'FEET',
      elevationAreaSqFt: 500, // Stale old value!
      totalAreaSqFt: 200,      // Stale old value!
    },
  };
  const extracted = extractProjectDimensions(staleRecord);
  assert.strictEqual(extracted.width, 10, 'Width must be 10');
  assert.strictEqual(extracted.depth, 15, 'Depth must be 15');
  assert.strictEqual(extracted.height, 20, 'Height must be 20');
  assert.strictEqual(extracted.elevationAreaSqFt, 1000, `Global formula must override stale database area (expected 1000, got ${extracted.elevationAreaSqFt})`);
  assert.strictEqual(extracted.formattedDimensions, '10 (W) × 15 (D) × 20 (H) FEET');
  assert.strictEqual(extracted.formattedArea, '1,000 sq. ft.');
  console.log('  ✓ PASS: extractProjectDimensions overrides stale database area with formula: 1,000 sq. ft.');
  console.log('  ✓ PASS: Formatted dimensions string: "10 (W) × 15 (D) × 20 (H) FEET"');

  // Edge case: flat project with width=0, height=0 falls back to legacy area
  const legacyRecordWithoutDims = {
    elevationAreaSqFt: 450,
  };
  const extractedLegacy = extractProjectDimensions(legacyRecordWithoutDims);
  assert.strictEqual(extractedLegacy.elevationAreaSqFt, 450, 'Legacy record without dimensions retains legacy area');
  assert.strictEqual(extractedLegacy.formattedDimensions, 'Dimensions Pending');
  console.log('  ✓ PASS: Record without dimensions safely falls back to stored area');

  console.log('---------------------------------------------------------------');
  console.log('Global Scaffolding Elevation Area Formula: All Tests Passed 100%');
  console.log('---------------------------------------------------------------');
}

if (require.main === module) {
  runGlobalElevationAreaFormulaTests();
}

