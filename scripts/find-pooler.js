const { Client } = require('pg');

const REGIONS = [
  'aws-0-us-east-1',
  'aws-0-us-east-2',
  'aws-0-us-west-1',
  'aws-0-us-west-2',
  'aws-0-eu-west-1',
  'aws-0-eu-west-2',
  'aws-0-eu-central-1',
  'aws-0-ap-southeast-1',
  'aws-0-ap-northeast-1',
  'aws-0-ap-south-1',
  'aws-0-sa-east-1',
];

async function tryRegion(region) {
  const client = new Client({
    host: `${region}.pooler.supabase.com`,
    port: 6543,
    database: 'postgres',
    user: 'postgres.ndstmcyrgljnyqxbwgct',
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return true;
  } catch (e) {
    return e.message;
  }
}

async function main() {
  for (const region of REGIONS) {
    process.stdout.write(`Testing ${region}... `);
    const result = await tryRegion(region);
    if (result === true) {
      console.log('CONNECTED!');
      console.log(`REGION=${region}`);
      process.exit(0);
    } else {
      console.log(`fail: ${result.slice(0, 60)}`);
    }
  }
  console.log('\nNo region connected.');
}

main();
