import fs from 'fs';
import path from 'path';
import { 
  initialCompanySettings, 
  initialUsers, 
  initialWarehouses, 
  initialCategories, 
  initialMaterials 
} from '../src/lib/db/seed-data';

// Reset all materials so reservedQty = 0, siteAllocatedQty = 0, usableWarehouseQty = totalOwnedQty, availableToAllocate = totalOwnedQty
const cleanMaterials = initialMaterials.map((m) => ({
  ...m,
  usableWarehouseQty: m.totalOwnedQty,
  reservedQty: 0,
  siteAllocatedQty: 0,
  inTransitQty: 0,
  damagedQty: 0,
  missingQty: 0,
  underInspectionQty: 0,
  availableToAllocate: m.totalOwnedQty,
}));

const cleanDatabase = {
  companySettings: initialCompanySettings,
  users: initialUsers,
  warehouses: initialWarehouses,
  categories: initialCategories,
  materials: cleanMaterials,
  customers: [],
  sites: [],
  projects: [],
  invoices: [],
  payments: [],
  transactions: [],
  bufferRequests: [],
  rentalExtensions: [],
  shiftingRequests: [],
  removalRequests: [],
  notifications: [],
  auditLogs: [],
  activityEvents: [],
  quotations: [],
};

const dataDir = path.join(process.cwd(), '.data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dataFile = path.join(dataDir, 'alokhandwala-erp.json');
fs.writeFileSync(dataFile, JSON.stringify(cleanDatabase, null, 2), 'utf8');

console.log('Clean database successfully written to .data/alokhandwala-erp.json:');
console.log('  - Customers:', cleanDatabase.customers.length);
console.log('  - Sites:', cleanDatabase.sites.length);
console.log('  - Projects:', cleanDatabase.projects.length);
console.log('  - Quotations:', cleanDatabase.quotations.length);
console.log('  - Invoices:', cleanDatabase.invoices.length);
console.log('  - Payments:', cleanDatabase.payments.length);
console.log('  - Transactions:', cleanDatabase.transactions.length);
console.log('  - Notifications:', cleanDatabase.notifications.length);
console.log('  - Audit Logs:', cleanDatabase.auditLogs.length);
console.log('  - Materials:', cleanDatabase.materials.length, '(all reserved/allocated reset to 0)');
console.log('  - Warehouses:', cleanDatabase.warehouses.length);
console.log('  - Categories:', cleanDatabase.categories.length);
console.log('  - Users:', cleanDatabase.users.length);

