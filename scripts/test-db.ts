import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_c1BFe3JWzthl@ep-aged-smoke-b5wjcyii-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function testConnection() {
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query('SELECT NOW() as current_time, version();');
    console.log('Successfully connected to Neon PostgreSQL!');
    console.log('Current Database Time:', res.rows[0].current_time);
    console.log('PostgreSQL Version:', res.rows[0].version);
  } catch (err: any) {
    console.error('Neon Connection Error:', err.message);
  } finally {
    await pool.end();
  }
}

testConnection();
