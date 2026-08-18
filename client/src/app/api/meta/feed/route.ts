import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { buildMetaCatalogXmlItem } from '@/lib/meta-catalog';
import type { MetaCatalogProduct } from '@/lib/meta-catalog';

const SITE_URL = 'https://nyvara.net';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await sql`
      SELECT p.id, p.title, p.description, p.price, p.final_price, p.discount, p.stock, p.image_url,
             p.gender, p.badge, p.brand, p.google_product_category, p.custom_label_0, p.color_options,
             p.allow_unlimited_stock,
             json_build_object('id', c.id, 'name', c.name) AS categories
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE (p.stock > 0 OR p.allow_unlimited_stock = true)
        AND p.image_url IS NOT NULL
        AND COALESCE(p.final_price, p.price, 0) > 0
        AND p.is_active IS NOT FALSE
      ORDER BY p.created_at DESC`;

    const validProducts = products as any[];
    console.log(`[Meta Feed] Serving ${validProducts.length} in-stock products`);

    const items = validProducts.map(p => buildMetaCatalogXmlItem(p as unknown as MetaCatalogProduct)).join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Nyvara ? Catalogue Produits</title>
    <link>${SITE_URL}</link>
    <description>Meta Dynamic Ads Catalog ? Nyvara Sunglasses Tunisia</description>
${items}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err: any) {
    console.error('[Meta Feed] Error:', err.message);
    return new NextResponse(`DB error: ${err.message}`, { status: 500 });
  }
}