/**
 * postgres.js database client (standard PostgreSQL — Coolify internal DB).
 * Server-side only — never import this in client components.
 */
import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set.');
}

// Singleton — created once per process, reused across requests.
// ssl: false because the app and DB share the same internal Coolify network.
const client = postgres(process.env.DATABASE_URL, {
  ssl: false,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Export the client as `sql` — identical tagged-template API to the Neon driver,
// so all 19+ consumer files require zero changes.
export const sql = client;
