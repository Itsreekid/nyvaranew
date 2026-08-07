import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** GET /api/orders/[orderId] ? fetch a single order */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const rows = await sql`
      SELECT id, customer_name, cosmos_status, cosmos_barcode
      FROM orders WHERE id = ${orderId} LIMIT 1
    `;
    if (!rows?.length) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    return NextResponse.json({ data: rows[0] });
  } catch (err) { return NextResponse.json({ error: (err as any).message }, { status: 500 }); }
}