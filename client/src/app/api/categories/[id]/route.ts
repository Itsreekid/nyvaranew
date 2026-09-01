import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { name } = await req.json();
    await sql`UPDATE categories SET name = ${name} WHERE id = ${id}::uuid`;
    return NextResponse.json({ success: true });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Set category_id to null for products in this category before deleting it
    await sql`UPDATE products SET category_id = NULL WHERE category_id = ${id}::uuid`;
    await sql`DELETE FROM categories WHERE id = ${id}::uuid`;
    return NextResponse.json({ success: true });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}