import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await sql`
      SELECT p.*, json_build_object('id', c.id, 'name', c.name) AS categories
      FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ${id} LIMIT 1
    `;
    if (!rows?.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: rows[0] });
  } catch (err) {
    console.error('[GET /api/products/:id] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

import { generateProductEmbedding } from '@/lib/embeddings';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const b = await req.json();

    const embedding = await generateProductEmbedding(b);
    const embeddingStr = embedding ? JSON.stringify(embedding) : null;

    const rows = await sql`
      UPDATE products SET
        title = ${b.title}, price = ${b.price}, final_price = ${b.final_price ?? null},
        cost_price = ${b.cost_price ?? null}, stock = ${b.stock ?? 0},
        discount = ${b.discount ?? null}, description = ${b.description ?? null},
        image_url = ${b.image_url ?? null}, gender = ${b.gender ?? 'unisex'},
        category_id = ${b.category_id ?? null}, badge = ${b.badge ?? null},
        features = ${b.features ?? null}, rating = ${b.rating ?? null},
        review_count = ${b.review_count ?? null},
        specs = ${b.specs ? JSON.stringify(b.specs) : null},
        color_options = ${b.color_options ? JSON.stringify(b.color_options) : null},
        quantity_breaks = ${b.quantity_breaks ? JSON.stringify(b.quantity_breaks) : null},
        is_active = ${b.is_active ?? true},
        allow_unlimited_stock = ${b.allow_unlimited_stock ?? false},
        embedding = COALESCE(${embeddingStr}, embedding)
      WHERE id = ${id} RETURNING *
    `;
    return NextResponse.json({ data: rows[0] });
  } catch (err) {
    console.error('[PATCH /api/products/:id] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await sql`DELETE FROM products WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/products/:id] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}