import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/trending
 * Returns products ranked by trending score over the last 7 days.
 */
export async function GET() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const since = sevenDaysAgo.toISOString().slice(0, 10);

    const stats = await sql`
      SELECT product_id, views_count, carts_count, orders_count
      FROM product_daily_stats WHERE date >= ${since}`;

    if (!stats || stats.length === 0) return NextResponse.json([]);

    const aggregated: Record<string, { views: number; carts: number; orders: number }> = {};
    for (const r of stats as any[]) {
      if (!aggregated[r.product_id]) aggregated[r.product_id] = { views: 0, carts: 0, orders: 0 };
      aggregated[r.product_id].views  += r.views_count  ?? 0;
      aggregated[r.product_id].carts  += r.carts_count  ?? 0;
      aggregated[r.product_id].orders += r.orders_count ?? 0;
    }

    const productIds = Object.keys(aggregated);
    const products = await sql`
      SELECT id, title, image_url, stock, custom_label_0
      FROM products WHERE id = ANY(${productIds}::uuid[]) AND stock > 0`;

    const ranked = (products as any[])
      .map(p => {
        const agg = aggregated[p.id] ?? { views: 0, carts: 0, orders: 0 };
        const trending_score = agg.orders * 5 + agg.carts * 2 + agg.views * 0.5;
        return { product_id: p.id, title: p.title, image_url: p.image_url,
          stock: p.stock, custom_label_0: p.custom_label_0,
          views_7d: agg.views, carts_7d: agg.carts, orders_7d: agg.orders, trending_score };
      })
      .sort((a, b) => b.trending_score - a.trending_score);

    return NextResponse.json(ranked);
  } catch (err: any) {
    console.error('[Trending] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}