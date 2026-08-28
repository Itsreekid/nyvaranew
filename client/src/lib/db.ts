/**
 * postgres.js database client (standard PostgreSQL — Coolify internal DB).
 * Server-side only — never import this in client components.
 */
import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  throw new Error('[db] DATABASE_URL environment variable is not set.');
}

// SSL: disabled by default for Coolify internal network (app and DB on same host).
// Set DB_SSL=true in environment variables only if your PostgreSQL requires SSL.
const sslConfig =
  process.env.NODE_ENV === 'production' && process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false;

// Singleton — created once per process, reused across all requests.
const client = postgres(process.env.DATABASE_URL, {
  ssl: sslConfig,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => {}, // suppress notice messages
});

// Probe the connection on startup so misconfiguration surfaces immediately
// in logs rather than silently failing on the first request.
client`SELECT 1`.then(() => {
  console.log('[db] PostgreSQL connection established.');
}).catch((err: Error) => {
  console.error('[db] PostgreSQL connection FAILED:', err.message);
  console.error('[db] Check DATABASE_URL and DB_SSL settings.');
});

// Export as `sql` — identical tagged-template API to the former Neon driver.
// All consumer files (routes, actions, etc.) remain unchanged.
export const sql = client;
