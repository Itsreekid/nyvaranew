import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { validatePurchase } from '@/lib/product-availability';
import type { Product } from '@/types';
import { MORPHOLOGY_NOT_SPECIFIED, normalizeMorphology } from '@/lib/morphology';

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

// Verify cart additions against current stock and colors before the browser saves them.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const selections = await request.json();
    if (!Array.isArray(selections) || selections.length === 0
      || selections.some(selection => !selection || !Number.isSafeInteger(selection.quantity) || selection.quantity < 1)) {
      return NextResponse.json({ error: 'Invalid cart quantities' }, { status: 400 });
    }

    const rows = await sql<Pick<Product, 'stock' | 'is_active' | 'allow_unlimited_stock' | 'color_options'>[]>`
      SELECT stock, is_active, allow_unlimited_stock, color_options
      FROM products WHERE id = ${id} LIMIT 1`;
    const product = rows[0];
    const issue = product ? validatePurchase(product, selections) : 'stock';
    if (issue) return NextResponse.json({ issue }, { status: 409 });
    return NextResponse.json({ data: product });
  } catch (err) {
    console.error('[POST /api/products/:id] Cart validation failed:', err);
    return NextResponse.json({ error: 'Unable to verify availability' }, { status: 500 });
  }
}

import { generateProductEmbedding } from '@/lib/embeddings';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const b = await req.json();
    const morphology = normalizeMorphology(b);

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
        frame_shape = ${'frame_shape' in b ? (b.frame_shape === MORPHOLOGY_NOT_SPECIFIED ? b.frame_shape : morphology.frame_shape) : sql`frame_shape`},
        style_vibe = ${'style_vibe' in b ? (b.style_vibe === MORPHOLOGY_NOT_SPECIFIED ? b.style_vibe : morphology.style_vibe) : sql`style_vibe`},
        optical_fit = ${'optical_fit' in b ? (b.optical_fit === MORPHOLOGY_NOT_SPECIFIED ? b.optical_fit : morphology.optical_fit) : sql`optical_fit`},
        ideal_faces = ${'ideal_faces' in b ? (morphology.ideal_faces.length || Array.isArray(b.ideal_faces) ? sql.array(morphology.ideal_faces, 25) : null) : sql`ideal_faces`},
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