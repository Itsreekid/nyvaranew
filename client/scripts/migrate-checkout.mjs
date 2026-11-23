import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('[checkout migration] DATABASE_URL is required.');
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  max: 1,
  connect_timeout: 10,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

try {
  // Avoid taking a table write lock on every container restart.
  const [schema] = await sql`
    SELECT EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = to_regclass('order_items')
        AND attname = 'selected_color_id'
        AND attnum > 0
        AND NOT attisdropped
    ) AS ready`;

  if (!schema.ready) {
    const migration = await readFile(new URL('./001-order-item-color-id.sql', import.meta.url), 'utf8');
    await sql.begin(async transaction => {
      await transaction`SET LOCAL lock_timeout = '10s'`;
      await transaction.unsafe(migration);
    });
  }
  console.log('[checkout migration] order_items.selected_color_id is ready.');
} catch (error) {
  console.error('[checkout migration] Failed:', error.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
