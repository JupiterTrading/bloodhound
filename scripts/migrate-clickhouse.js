const https = require('https');
const fs = require('fs');

const CH_URL = process.env.CLICKHOUSE_HOST || 'http://localhost:8123/';
const AUTH = Buffer.from(
  `${process.env.CLICKHOUSE_USER || 'default'}:${process.env.CLICKHOUSE_PASSWORD || ''}`
).toString('base64');

function runQuery(sql) {
  return new Promise((resolve) => {
    const url = new URL(CH_URL);
    url.searchParams.set('database', 'bloodhound');
    const body = Buffer.from(sql);
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + AUTH,
          'Content-Type': 'text/plain',
          'Content-Length': body.length,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (d) => (data += d));
        res.on('end', () => resolve({ code: res.statusCode, body: data.trim() }));
      }
    );
    req.on('error', (e) => resolve({ code: 0, body: e.message }));
    req.write(body);
    req.end();
  });
}

async function main() {
  const sql = fs.readFileSync(
    require('path').join(__dirname, '../packages/db/schema/002_clickhouse.sql'),
    'utf8'
  );

  // Strip single-line comments BEFORE splitting on semicolons
  // (comments can contain semicolons which would break the split)
  const stripped = sql.replace(/--[^\n]*/g, '');

  const stmts = stripped
    .split(';')
    .map((s) => s.trim())
    .filter((s) => {
      if (!s) return false;
      if (/^CREATE DATABASE/i.test(s)) return false;
      if (/^USE /i.test(s)) return false;
      return true;
    });

  console.log(`Running ${stmts.length} statements against ClickHouse...\n`);

  for (const stmt of stmts) {
    const { code, body } = await runQuery(stmt);
    const label = stmt.slice(0, 70).replace(/\s+/g, ' ');
    if (code === 200) {
      console.log('✓  ' + label);
    } else {
      console.log('✗  [' + code + '] ' + label);
      if (body) console.log('   ' + body.slice(0, 300));
    }
  }

  console.log('\nDone.');
}

main().catch(console.error);
