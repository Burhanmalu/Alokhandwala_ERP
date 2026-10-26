import fs from 'fs';
import path from 'path';
import { initialCategories, initialMaterials, initialCompanySettings, initialUsers, initialWarehouses } from '../src/lib/db/seed-data';
import { getDbPool } from '../src/lib/db/postgres';

async function cleanAll() {
  console.log('1. Cleaning local persistent state...');
  const cleanState = {
    companySettings: initialCompanySettings,
    users: initialUsers,
    warehouses: initialWarehouses,
    categories: initialCategories,
    materials: initialMaterials,
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
  };

  const DATA_DIR = path.join(process.cwd(), '.data');
  const DATA_FILE = path.join(DATA_DIR, 'alokhandwala-erp.json');
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(cleanState, null, 2), 'utf-8');
  console.log('✓ Local .data/alokhandwala-erp.json reset to 0 mock records.');

  console.log('2. Cleaning Neon PostgreSQL database...');
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM project_materials;');
    await client.query('DELETE FROM inventory_transactions;');
    await client.query('DELETE FROM projects;');
    await client.query('DELETE FROM sites;');
    await client.query('DELETE FROM customers;');
    
    // Update materials to 100% clean physical inventory
    for (const mat of initialMaterials) {
      await client.query(`
        UPDATE materials SET
          usable_warehouse_qty = $1,
          reserved_qty = 0,
          site_allocated_qty = 0,
          in_transit_qty = 0,
          damaged_qty = 0,
          missing_qty = 0,
          under_inspection_qty = 0,
          available_to_allocate = $1
        WHERE id = $2;
      `, [mat.totalOwnedQty, mat.id]);
    }

    // Mirror clean state
    await client.query(`
      INSERT INTO erp_state_sync (key, payload, updated_at)
      VALUES ('latest_state', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();
    `, [JSON.stringify(cleanState)]);

    await client.query('COMMIT');
    console.log('✓ Neon PostgreSQL database purged of all mock projects, customers, sites, and transactions!');
    console.log('✓ All 18 stock materials set to full clean warehouse availability.');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error cleaning Neon database:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanAll();
