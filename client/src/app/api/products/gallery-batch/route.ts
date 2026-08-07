import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json();
    if (!ids?.length) return NextResponse.json({ data: [] });
    const rows = await sql`
      SELECT product_id, image_url FROM product_images
      WHERE product_id = ANY(${ids}::uuid[])
      ORDER BY sort_order ASC`;
    return NextResponse.json({ data: rows });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}