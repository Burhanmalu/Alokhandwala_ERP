import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { calculateCommercialPricing, PRICING_DEFAULTS } from '../src/lib/services/pricing-service';
import { QuotationService } from '../src/lib/services/quotation-service';
import { formatINR, extractProjectDimensions } from '../src/lib/formatters';

describe('Commercial Quotation & Approved Quotation Pricing Synchronization', () => {

  describe('1. Target Record QTN-000002 & Project AW-SCF-000002 Synchronization', () => {
    const dbPath = path.resolve(process.cwd(), '.data/alokhandwala-erp.json');
    assert.ok(fs.existsSync(dbPath), '.data/alokhandwala-erp.json must exist');
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    const qtn = db.quotations.find((q: any) => q.quotationNumber === 'QTN-000002');
    const proj = db.projects.find((p: any) => p.projectCode === 'AW-SCF-000002');

    it('QTN-000002 and AW-SCF-000002 must exist in database', () => {
      assert.ok(qtn, 'Quotation QTN-000002 exists');
      assert.ok(proj, 'Project AW-SCF-000002 exists');
      assert.strictEqual(qtn.projectId, proj.id);
    });

    it('Dimensions and elevation area must match single source of truth (1,000 sq. ft.)', () => {
      const projDims = extractProjectDimensions(proj);
      const qtnDims = extractProjectDimensions(qtn);

      assert.strictEqual(projDims.width, 10, 'Width is 10 ft');
      assert.strictEqual(projDims.depth, 15, 'Depth is 15 ft');
      assert.strictEqual(projDims.height, 20, 'Height is 20 ft');
      assert.strictEqual(projDims.elevationAreaSqFt, 1000, 'Project Elevation Area is 1,000 sq. ft.');
      assert.strictEqual(qtn.totalAreaSqFt, 1000, 'Quotation totalAreaSqFt is 1,000 sq. ft. (not 500)');
      assert.strictEqual(qtnDims.elevationAreaSqFt, 1000, 'Quotation dimensions elevationAreaSqFt is 1,000 sq. ft.');
    });

    it('Commercial Rental Calculation matches exact formula for 1,000 sq. ft. @ ₹22', () => {
      // Monthly Rental = 1,000 * 22 = ₹22,000
      assert.strictEqual(qtn.ratePerSqFt, 22);
      assert.strictEqual(qtn.monthlyRentalAmount, 22000, 'Monthly Rental is ₹22,000');
      assert.strictEqual(proj.monthlyRentalRate, 22000, 'Project monthlyRentalRate is synced to ₹22,000');
    });

    it('Walkway Jali charges: Total 21, Included 7, Extra 14 @ ₹200 = ₹2,800', () => {
      assert.strictEqual(qtn.extraJaliQuantity, 14, 'Extra Jali Qty is 14');
      assert.strictEqual(qtn.extraJaliRate, 200, 'Extra Jali Rate is ₹200');
      assert.strictEqual(qtn.extraJaliCharges, 2800, 'Extra Jali Charges is ₹2,800');
      assert.strictEqual(proj.extraJaliCharges, 2800, 'Project extraJaliCharges is ₹2,800');
    });

    it('Transportation charges are preserved and synced (₹4,500)', () => {
      assert.strictEqual(qtn.transportCharges, 4500, 'Quotation transportCharges is ₹4,500');
      assert.strictEqual(proj.transportCharges, 4500, 'Project transportCharges is ₹4,500');
    });

    it('Financial breakdown matches: Subtotal ₹29,300, GST ₹5,274, Grand Total ₹34,574', () => {
      // Subtotal = 22,000 + 2,800 + 4,500 = 29,300
      assert.strictEqual(qtn.subtotal, 29300, 'Subtotal is ₹29,300');
      // GST (18%) = 29,300 * 0.18 = 5,274
      assert.strictEqual(qtn.gstPercentage, 18, 'GST % is 18');
      assert.strictEqual(qtn.gstAmount, 5274, 'GST Amount is ₹5,274');
      // Grand Total = 29,300 + 5,274 = 34,574
      assert.strictEqual(qtn.grandTotal, 34574, 'Grand Total is ₹34,574');
      assert.strictEqual(proj.agreedProjectPrice, 34574, 'Project agreedProjectPrice is ₹34,574');
    });

    it('Payment Schedule: 75% Advance (₹25,930.50) and 25% Balance (₹8,643.50)', () => {
      assert.strictEqual(qtn.advancePercentage, 75);
      assert.strictEqual(qtn.advanceAmount, 25930.5, 'Advance is ₹25,930.50');
      assert.strictEqual(qtn.remainingAmount, 8643.5, 'Balance is ₹8,643.50');
      assert.strictEqual(
        Math.round((qtn.advanceAmount + qtn.remainingAmount) * 100) / 100,
        qtn.grandTotal,
        'Advance + Balance strictly equals Grand Total'
      );
    });
  });

  describe('2. Multi-Project Dynamic Pricing Engine', () => {
    it('Calculates 1-month commercial rental for 500 sq. ft. @ ₹20 with ₹3,000 transport', () => {
      const result = calculateCommercialPricing({
        totalAreaSqFt: 500,
        ratePerSqFt: 20,
        durationMonths: 1,
        transportCharges: 3000,
        extraJaliQuantity: 5,
        extraJaliRate: 200,
        gstPercentage: 18,
      });

      // Monthly Rent: 500 * 20 = 10,000
      assert.strictEqual(result.monthlyRentalAmount, 10000);
      assert.strictEqual(result.rentalTotalAmount, 10000);
      // Extra Jali: 5 * 200 = 1,000
      assert.strictEqual(result.extraJaliCharges, 1000);
      // Transport: 3,000
      assert.strictEqual(result.transportCharges, 3000);
      // Subtotal: 10,000 + 1,000 + 3,000 = 14,000
      assert.strictEqual(result.subtotal, 14000);
      // GST: 14,000 * 0.18 = 2,520
      assert.strictEqual(result.gstAmount, 2520);
      // Grand Total: 16,520
      assert.strictEqual(result.grandTotal, 16520);
      // Advance (75%): 12,390
      assert.strictEqual(result.advanceAmount, 12390);
      // Balance (25%): 4,130
      assert.strictEqual(result.balanceAmount, 4130);
      assert.strictEqual(result.advanceAmount + result.balanceAmount, result.grandTotal);
    });

    it('Calculates 3-month rental for 1,200 sq. ft. @ ₹22 with ₹5,000 transport', () => {
      const result = calculateCommercialPricing({
        totalAreaSqFt: 1200,
        ratePerSqFt: 22,
        durationMonths: 3,
        transportCharges: 5000,
        extraJaliQuantity: 10,
        extraJaliRate: 200,
        gstPercentage: 18,
      });

      // Monthly Rent: 1,200 * 22 = 26,400
      assert.strictEqual(result.monthlyRentalAmount, 26400);
      // 3 Months Rental Total: 26,400 * 3 = 79,200
      assert.strictEqual(result.rentalTotalAmount, 79200);
      // Extra Jali: 10 * 200 = 2,000
      assert.strictEqual(result.extraJaliCharges, 2000);
      // Subtotal: 79,200 + 2,000 + 5,000 = 86,200
      assert.strictEqual(result.subtotal, 86200);
      // GST: 86,200 * 0.18 = 15,516
      assert.strictEqual(result.gstAmount, 15516);
      // Grand Total: 86,200 + 15,516 = 101,716
      assert.strictEqual(result.grandTotal, 101716);
      // Advance: 76,287, Balance: 25,429
      assert.strictEqual(result.advanceAmount, 76287);
      assert.strictEqual(result.balanceAmount, 25429);
      assert.strictEqual(result.advanceAmount + result.balanceAmount, result.grandTotal);
    });

    it('Backend QuotationService.calculatePricing delegates to shared pricing engine', () => {
      const output = QuotationService.calculatePricing({
        totalAreaSqFt: 1000,
        ratePerSqFt: 22,
        durationMonths: 1,
        transportCharges: 4500,
        extraJaliQuantity: 14,
        extraJaliRate: 200,
        gstPercentage: 18,
      });

      assert.strictEqual(output.monthlyRentalAmount, 22000);
      assert.strictEqual(output.subtotal, 29300);
      assert.strictEqual(output.gstAmount, 5274);
      assert.strictEqual(output.grandTotal, 34574);
      assert.strictEqual(output.advanceAmount, 25930.5);
      assert.strictEqual(output.remainingAmount, 8643.5);
    });
  });

  describe('3. Currency Formatting & Double Rupee Prevention', () => {
    it('formatINR produces a single ₹ symbol and handles undefined/null cleanly', () => {
      const formatted22k = formatINR(22000, false);
      assert.ok(formatted22k.startsWith('₹'), 'Starts with ₹');
      assert.ok(!formatted22k.includes('₹₹'), 'Does not contain double rupee');
      assert.strictEqual((formatted22k.match(/₹/g) || []).length, 1, 'Contains exactly one ₹');

      const zero = formatINR(0, false);
      assert.ok(!zero.includes('₹₹'));
      assert.strictEqual((zero.match(/₹/g) || []).length, 1);

      const nil = formatINR(undefined, false);
      assert.ok(!nil.includes('₹₹'));
    });

    it('Source codebase TSX files do not contain template double rupees like ₹{formatINR', () => {
      function scanDir(dir: string): string[] {
        let results: string[] = [];
        const list = fs.readdirSync(dir);
        for (const file of list) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            if (!file.startsWith('.') && file !== 'node_modules') {
              results = results.concat(scanDir(filePath));
            }
          } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(filePath);
          }
        }
        return results;
      }

      const files = scanDir(path.resolve(process.cwd(), 'src/app'));
      const offenders: string[] = [];

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        if (/₹\s*\{\s*formatINR/.test(content)) {
          offenders.push(path.relative(process.cwd(), file));
        }
      }

      assert.strictEqual(offenders.length, 0, `Found double rupee patterns in: ${offenders.join(', ')}`);
    });
  });
});

export async function runQuotationPricingSyncTests() {
  console.log('\n===============================================================');
  console.log('COMMERCIAL QUOTATION & APPROVED PRICING SYNCHRONIZATION TEST');
  console.log('Testing QTN-000002, Financial Formulae & Double Rupee Prevention');
  console.log('===============================================================\n');

  function assertLocal(condition: boolean, message: string) {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      process.exit(1);
    }
    console.log(`  ✓ PASS: ${message}`);
  }

  const dbPath = path.resolve(process.cwd(), '.data/alokhandwala-erp.json');
  assertLocal(fs.existsSync(dbPath), '.data/alokhandwala-erp.json exists');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  const qtn = db.quotations.find((q: any) => q.quotationNumber === 'QTN-000002');
  const proj = db.projects.find((p: any) => p.projectCode === 'AW-SCF-000002');

  assertLocal(!!qtn && !!proj, 'QTN-000002 and AW-SCF-000002 exist');
  assertLocal(qtn.totalAreaSqFt === 1000, `QTN-000002 totalAreaSqFt is 1,000 sq. ft. (got ${qtn.totalAreaSqFt})`);
  assertLocal(qtn.monthlyRentalAmount === 22000, `QTN-000002 monthlyRentalAmount is ₹22,000 (got ${qtn.monthlyRentalAmount})`);
  assertLocal(proj.monthlyRentalRate === 22000, `AW-SCF-000002 monthlyRentalRate is ₹22,000 (got ${proj.monthlyRentalRate})`);
  assertLocal(qtn.extraJaliCharges === 2800, `QTN-000002 extraJaliCharges is ₹2,800 (got ${qtn.extraJaliCharges})`);
  assertLocal(qtn.transportCharges === 4500, `QTN-000002 transportCharges is ₹4,500 (got ${qtn.transportCharges})`);
  assertLocal(qtn.subtotal === 29300, `QTN-000002 subtotal is ₹29,300 (got ${qtn.subtotal})`);
  assertLocal(qtn.gstAmount === 5274, `QTN-000002 gstAmount is ₹5,274 (got ${qtn.gstAmount})`);
  assertLocal(qtn.grandTotal === 34574, `QTN-000002 grandTotal is ₹34,574 (got ${qtn.grandTotal})`);
  assertLocal(proj.agreedProjectPrice === 34574, `AW-SCF-000002 agreedProjectPrice is ₹34,574 (got ${proj.agreedProjectPrice})`);
  assertLocal(qtn.advanceAmount === 25930.5, `QTN-000002 advanceAmount is ₹25,930.50 (got ${qtn.advanceAmount})`);
  assertLocal(qtn.remainingAmount === 8643.5, `QTN-000002 remainingAmount is ₹8,643.50 (got ${qtn.remainingAmount})`);
  assertLocal(Math.round((qtn.advanceAmount + qtn.remainingAmount) * 100) / 100 === 34574, 'Advance + Remaining strictly equals 34,574');

  // Verify dynamic pricing calculation function
  const dyn = calculateCommercialPricing({
    totalAreaSqFt: 1000,
    ratePerSqFt: 22,
    durationMonths: 1,
    extraJaliQuantity: 14,
    extraJaliRate: 200,
    transportCharges: 4500,
  });
  assertLocal(dyn.monthlyRentalAmount === 22000, 'Dynamic monthlyRentalAmount is 22,000');
  assertLocal(dyn.subtotal === 29300, 'Dynamic subtotal is 29,300');
  assertLocal(dyn.grandTotal === 34574, 'Dynamic grandTotal is 34,574');

  // Verify formatINR
  const fmt = formatINR(22000, false);
  assertLocal(!fmt.includes('₹₹') && fmt.startsWith('₹'), `formatINR produces clean single rupee: "${fmt}"`);
}

