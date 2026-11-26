// Neon PostgreSQL Client Pool
import { Pool } from 'pg';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_eNTR0IBqp1Lj@ep-fancy-term-b5iun1yv-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

let pool: Pool | null = null;
let tableEnsured = false;

export function isPostgresEnabled(): boolean {
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.IS_TEST);
  return !isTest && Boolean(connectionString);
}

export function getDbPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 5,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 10000,
      query_timeout: 15000,
      statement_timeout: 15000,
      allowExitOnIdle: true,
    });

    pool.on('error', (err) => {
      console.error('[PostgresPool] Unexpected error on idle client:', err?.message || 'Unknown error');
    });
  }
  return pool;
}

export async function ensureErpStateTable(): Promise<void> {
  if (tableEnsured) return;
  const p = getDbPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS erp_state_sync (
      key TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  tableEnsured = true;
}

export async function queryNeonDb<T = any>(text: string, params?: any[]): Promise<T[]> {
  const p = getDbPool();
  const res = await p.query(text, params);
  return res.rows;
}
