import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(process.cwd(), '.env.local') });

import { sql } from './src/lib/db';

async function main() {
  try {
    const res = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'admin_users' AND column_name = 'permissions';
    `;
    
    if (res.length === 0) {
      console.log('Adding permissions column...');
      await sql`ALTER TABLE admin_users ADD COLUMN permissions JSONB DEFAULT '[]'::jsonb;`;
      console.log('Added permissions column.');
    } else {
      console.log('Column already exists.');
    }
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit();
}

main();
