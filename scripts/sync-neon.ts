import fs from 'fs';
import path from 'path';
import { getDbPool } from '../src/lib/db/postgres';

async function syncCleanState() {
  try {
    const dataFile = path.join(process.cwd(), '.data', 'alokhandwala-erp.json');
    const content = fs.readFileSync(dataFile, 'utf8');
    const pool = getDbPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS erp_state_sync (
        key VARCHAR(50) PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await pool.query(`
      INSERT INTO erp_state_sync (key, payload, updated_at)
      VALUES ('latest_state', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();
    `, [content]);
    console.log('Clean database state successfully synced to Neon PostgreSQL erp_state_sync table.');
    await pool.end();
  } catch (err: any) {
    console.log('Neon sync note:', err.message);
  }
}

syncCleanState();

