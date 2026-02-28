const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const client = new Client({
    host: 'aws-0-us-west-2.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.ndstmcyrgljnyqxbwgct',
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL\n');

  const sql = fs.readFileSync(
    path.join(__dirname, '../packages/db/schema/001_initial.sql'),
    'utf8'
  );

  // Run the whole schema as one transaction
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✓  All tables, indexes, and RLS policies created successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗  Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Connection error:', err.message);
  process.exit(1);
});
