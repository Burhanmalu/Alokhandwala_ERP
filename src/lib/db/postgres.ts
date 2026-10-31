// Neon PostgreSQL Client Pool
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_eNTR0IBqp1Lj@ep-fancy-term-b5iun1yv-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });
  }
  return pool;
}

export async function queryNeonDb<T = any>(text: string, params?: any[]): Promise<T[]> {
  const p = getDbPool();
  const res = await p.query(text, params);
  return res.rows;
}
