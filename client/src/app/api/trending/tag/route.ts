import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

/**
 * POST /api/trending/tag
 * Body: { product_ids: string[], limit?: number }
 */
export async function POST(req: NextRequest) {
  let body: { product_ids?: string[]; limit?: number };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const { product_ids, limit } = body;
  const TRENDING_LIMIT = Number(limit) || 20;

  if (!Array.isArray(product_ids)) {
    return NextResponse.json({ error: 'product_ids array is required' }, { status: 400 });
  }

  let topIds = product_ids.slice(0, TRENDING_LIMIT);

  // Backfill with newest in-stock products if under limit
  if (topIds.length < TRENDING_LIMIT) {
    try {
      const newest = await sql`
        SELECT id FROM products WHERE stock > 0
        ORDER BY created_at DESC LIMIT ${TRENDING_LIMIT}`;
      for (const p of newest as any[]) {
        if (!topIds.includes(p.id)) topIds.push(p.id);
        if (topIds.length >= TRENDING_LIMIT) break;
      }
    } catch (e) { console.error('[Trending Tag] Backfill error:', e); }
  }

  if (topIds.length === 0) {
    return NextResponse.json({ error: 'No valid products found to tag' }, { status: 400 });
  }

  try {
    // Clear existing tags
    await sql`UPDATE products SET custom_label_0 = NULL WHERE custom_label_0 IS NOT NULL`;
    // Apply new tags
    await sql`UPDATE products SET custom_label_0 = 'trending' WHERE id = ANY(${topIds}::uuid[])`;
    return NextResponse.json({ ok: true, tagged: topIds.length, tagged_ids: topIds, limit: TRENDING_LIMIT });
  } catch (err: any) {
    console.error('[Trending Tag] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}