import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { readCategoryConfig } from '@/lib/category-icons';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { name, homepage_config } = await req.json();
    if (typeof name !== 'string' || !name.trim()) return NextResponse.json({ error: 'Nom de catégorie requis.' }, { status: 400 });
    if (homepage_config !== undefined) {
      await sql`UPDATE categories SET name = ${name.trim()}, homepage_config = ${sql.json(readCategoryConfig(homepage_config))} WHERE id = ${id}::uuid`;
    } else {
      await sql`UPDATE categories SET name = ${name.trim()} WHERE id = ${id}::uuid`;
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const error = err.code === '42703' ? 'Appliquez la migration des catégories pour enregistrer les réglages d’accueil.' : err.message;
    return NextResponse.json({ error }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Set category_id to null for products in this category before deleting it
    await sql`UPDATE products SET category_id = NULL WHERE category_id = ${id}::uuid`;
    await sql`DELETE FROM categories WHERE id = ${id}::uuid`;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const error = err.code === '42703' ? 'Appliquez la migration des catégories pour enregistrer les réglages d’accueil.' : err.message;
    return NextResponse.json({ error }, { status: 500 });
  }
}