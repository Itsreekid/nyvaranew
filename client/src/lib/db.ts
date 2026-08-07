/**
 * Neon serverless database client.
 * Server-side only ? never import this in client components.
 */
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set. Add it to .env.local');
}

export const sql = neon(process.env.DATABASE_URL!);
