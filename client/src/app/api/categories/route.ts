import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM categories ORDER BY name ASC`;
    return NextResponse.json({ data: rows });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    const rows = await sql`INSERT INTO categories (name) VALUES (${name}) RETURNING *`;
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}