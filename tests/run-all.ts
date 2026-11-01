import fs from 'fs';
import path from 'path';

(process.env as any).NODE_ENV = 'test';
process.env.IS_TEST = 'true';

import { runCriticalTests } from './critical-business-rules.test';
import { runAuditTests } from './smart-recommendation-and-audit.test';
import { runPdfTests } from './pdf-generation.test';
import { runSearchableSelectionAndImagesTests } from './searchable-selection-and-images.test';
import { runWorkerSupervisorReportTests } from './worker-supervisor-report.test';
import { runSiteFormMapTests } from './site-form-map.test';
import { runGstHandlingTests } from './gst-handling.test';
import { runQuotationPdfTests } from './quotation-pdf.test';
import { runWorkflowAuditTests } from './workflow-audit.test';
import { runDashboardAndReceivablesTests } from './dashboard-and-receivables.test';
import { runProjectCancellationAndFiltersTests } from './project-cancellation-and-filters.test';
import { runLeafletOpenStreetMapTests } from './leaflet-openstreetmap.test';
import { runSiteLocationDetectionTests } from './site-location-detection.test';
import { runQuotationApprovalWorkflowTests } from './quotation-approval-workflow.test';
import { runScaffoldingDimensionsTests } from './scaffolding-dimensions-consistency.test';
import { runQuotationPricingSyncTests } from './quotation-pricing-sync.test';
import { runGlobalElevationAreaFormulaTests } from './global-elevation-area-formula.test';

async function main() {
  // Clean up isolated test database before test execution to ensure fresh baseline
  try {
    const testDataFile = path.join(process.cwd(), '.data', 'alokhandwala-erp-test.json');
    if (fs.existsSync(testDataFile)) {
      fs.unlinkSync(testDataFile);
    }
  } catch {}

  await runCriticalTests();
  await runAuditTests();
  await runPdfTests();
  await runSearchableSelectionAndImagesTests();
  await runWorkerSupervisorReportTests();
  await runSiteFormMapTests();
  await runGstHandlingTests();
  await runQuotationPdfTests();
  await runWorkflowAuditTests();
  await runDashboardAndReceivablesTests();
  await runProjectCancellationAndFiltersTests();
  await runLeafletOpenStreetMapTests();
  await runSiteLocationDetectionTests();
  await runQuotationApprovalWorkflowTests();
  await runScaffoldingDimensionsTests();
  await runQuotationPricingSyncTests();
  await runGlobalElevationAreaFormulaTests();

  // Clean up isolated test database after test execution
  try {
    const testDataFile = path.join(process.cwd(), '.data', 'alokhandwala-erp-test.json');
    if (fs.existsSync(testDataFile)) {
      fs.unlinkSync(testDataFile);
    }
  } catch {}

  console.log('\n===============================================================');
  console.log('ALL TEST SUITES EXECUTED AND PASSED 100%');
  console.log('===============================================================\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
