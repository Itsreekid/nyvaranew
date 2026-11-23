import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { readCategoryConfig } from '@/lib/category-icons';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM categories ORDER BY name ASC, id`;
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const role = request.cookies.get('nyvara_admin_session')?.value;
  if (role !== 'admin' && role !== 'employee') {
    return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ids: unknown = body?.ids;
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 10000
    || !ids.every(id => typeof id === 'string' && uuid.test(id))
    || new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: 'Ordre des catégories invalide.' }, { status: 400 });
  }

  try {
    const replaced = await sql.begin(async transaction => {
      // Keep the category list stable until every position is saved.
      await transaction`LOCK TABLE categories IN SHARE ROW EXCLUSIVE MODE`;
      const existing = await transaction<{ id: string }[]>`SELECT id FROM categories`;
      const knownIds = new Set(existing.map(category => category.id));
      if (knownIds.size !== ids.length || !ids.every(id => knownIds.has(id))) return false;

      await transaction`
        UPDATE categories AS category
        SET homepage_config = COALESCE(category.homepage_config, '{}'::jsonb)
          || jsonb_build_object('order', ordered.position - 1)
        FROM unnest(${ids}::uuid[]) WITH ORDINALITY AS ordered(id, position)
        WHERE category.id = ordered.id
      `;
      return true;
    });
    if (!replaced) {
      return NextResponse.json({ error: 'La liste a changé. Actualisez la page et réessayez.' }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const error = err.code === '42703' ? 'Appliquez la migration des catégories pour enregistrer les réglages d’accueil.' : 'Impossible d’enregistrer l’ordre.';
    return NextResponse.json({ error }, { status: 500 });
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