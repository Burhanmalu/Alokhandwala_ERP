import fs from 'fs';
import path from 'path';
import { initialCategories, initialMaterials } from '../src/lib/db/seed-data';

const DATA_FILE = path.join(process.cwd(), '.data', 'alokhandwala-erp.json');

if (fs.existsSync(DATA_FILE)) {
  const current = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  current.categories = initialCategories;
  current.materials = initialMaterials;
  fs.writeFileSync(DATA_FILE, JSON.stringify(current, null, 2), 'utf-8');
  console.log('Successfully updated .data/alokhandwala-erp.json with the 18 stock materials!');
} else {
  console.log('No local data file found, initialMaterials will be used on startup.');
}
