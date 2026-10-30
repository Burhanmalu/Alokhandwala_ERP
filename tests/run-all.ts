process.env.NODE_ENV = 'test';
process.env.IS_TEST = 'true';

import './critical-business-rules.test';
import './smart-recommendation-and-audit.test';
import './pdf-generation.test';
import { runSearchableSelectionAndImagesTests } from './searchable-selection-and-images.test';

async function main() {
  await runSearchableSelectionAndImagesTests();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
