(process.env as any).NODE_ENV = 'test';
process.env.IS_TEST = 'true';

import { runCriticalTests } from './critical-business-rules.test';
import { runAuditTests } from './smart-recommendation-and-audit.test';
import { runPdfTests } from './pdf-generation.test';
import { runSearchableSelectionAndImagesTests } from './searchable-selection-and-images.test';

async function main() {
  await runCriticalTests();
  await runAuditTests();
  await runPdfTests();
  await runSearchableSelectionAndImagesTests();
  console.log('\n===============================================================');
  console.log('ALL TEST SUITES EXECUTED AND PASSED 100%');
  console.log('===============================================================\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
