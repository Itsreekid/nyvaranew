import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { readCategoryConfig } from '@/lib/category-icons';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM categories ORDER BY name ASC`;
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, homepage_config } = await request.json();
    if (typeof name !== 'string' || !name.trim()) return NextResponse.json({ error: 'Nom de catégorie requis.' }, { status: 400 });
    const rows = homepage_config !== undefined
      ? await sql`INSERT INTO categories (name, homepage_config) VALUES (${name.trim()}, ${sql.json(readCategoryConfig(homepage_config))}) RETURNING *`
      : await sql`INSERT INTO categories (name) VALUES (${name.trim()}) RETURNING *`;
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    const error = err.code === '42703' ? 'Appliquez la migration des catégories pour enregistrer les réglages d’accueil.' : err.message;
    return NextResponse.json({ error }, { status: 500 });
  }
}