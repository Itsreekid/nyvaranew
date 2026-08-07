import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

/**
 * POST /api/tracking/stats
 * Body: { product_id: string, event: 'view' | 'cart' | 'order' }
 * Delegates to PL/pgSQL function increment_product_stat.
 */
export async function POST(req: NextRequest) {
  let body: { product_id?: string; event?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const { product_id, event } = body;
  if (!product_id || typeof product_id !== 'string') {
    return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
  }
  const VALID_EVENTS = ['view', 'cart', 'order'] as const;
  if (!event || !VALID_EVENTS.includes(event as any)) {
    return NextResponse.json({ error: `event must be one of: ${VALID_EVENTS.join(', ')}` }, { status: 400 });
  }

  try {
    await sql`SELECT increment_product_stat(${product_id}::uuid, ${event})`;
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error('[Tracking Stats] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}