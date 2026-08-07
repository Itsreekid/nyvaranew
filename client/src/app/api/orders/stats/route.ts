import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await sql`
      SELECT o.id, o.created_at, o.total_price, o.cosmos_status, o.customer_name,
        COALESCE(
          json_agg(
            json_build_object(
              'quantity', oi.quantity,
              'products', json_build_object('cost_price', p.cost_price)
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) AS order_items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 1000
    `;
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
