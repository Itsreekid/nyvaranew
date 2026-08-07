import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await sql`SELECT id, image_url, sort_order FROM product_images WHERE product_id = ${id} ORDER BY sort_order ASC`;
    return NextResponse.json({ data: rows });
  } catch (err) { return NextResponse.json({ error: (err as any).message }, { status: 500 }); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { image_url, sort_order } = await req.json();
    const rows = await sql`
      INSERT INTO product_images (product_id, image_url, sort_order)
      VALUES (${id}, ${image_url}, ${sort_order ?? 0}) RETURNING *`;
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err) { return NextResponse.json({ error: (err as any).message }, { status: 500 }); }
}