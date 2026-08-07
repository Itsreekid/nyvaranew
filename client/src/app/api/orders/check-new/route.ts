import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const since = request.nextUrl.searchParams.get('since');
    if (!since) {
      const rows = await sql`SELECT id FROM orders ORDER BY created_at DESC LIMIT 1`;
      return NextResponse.json({ newOrders: [], latestId: rows[0]?.id ?? null });
    }
    const newOrders = await sql`
      SELECT id, customer_name, customer_email, phone, city, postal_code,
             country, total_price, created_at, cosmos_status, address
      FROM orders WHERE created_at > ${since}::timestamptz
      ORDER BY created_at ASC`;
    return NextResponse.json({ newOrders });
  } catch (err) { return NextResponse.json({ error: (err as any).message }, { status: 500 }); }
}