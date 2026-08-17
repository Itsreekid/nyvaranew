const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.split('DATABASE_URL=')[1].split('\n')[0].replace(/\"/g, '').trim();

import('@neondatabase/serverless').then(async ({ neon }) => {
  const sql = neon(url);
  try {
    const res = await sql('SELECT * FROM products LIMIT $1 OFFSET $2', [2, 2]);
    console.log('Got', res.length, 'rows');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
});
