import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { phones } = await request.json();
    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // We only need phone and call_status to calculate the history
    const rows = await sql`
      SELECT phone, call_status
      FROM orders
      WHERE phone = ANY(${phones}::text[])
    `;

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('[POST /api/orders/phone-history] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
