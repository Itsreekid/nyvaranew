import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const deviceId = request.nextUrl.searchParams.get('deviceId');
    if (!deviceId) return NextResponse.json({ error: 'Device ID required' }, { status: 400 });
    const rows = await sql`SELECT product_id FROM wishlist_items WHERE device_id = ${deviceId}`;
    return NextResponse.json({ device_id: deviceId, product_ids: rows.map((w: any) => w.product_id), count: rows.length });
  } catch (error: any) {
    console.error('Wishlist GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch wishlist' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { device_id, product_id, action } = body;
    if (!device_id || !product_id) {
      return NextResponse.json({ error: 'Device ID and Product ID required' }, { status: 400 });
    }
    if (action === 'add') {
      await sql`
        INSERT INTO wishlist_items (device_id, product_id, created_at)
        VALUES (${device_id}, ${product_id}, ${new Date().toISOString()})
        ON CONFLICT (device_id, product_id) DO NOTHING`;
      return NextResponse.json({ success: true, action: 'added' });
    }
    if (action === 'remove') {
      await sql`DELETE FROM wishlist_items WHERE device_id = ${device_id} AND product_id = ${product_id}`;
      return NextResponse.json({ success: true, action: 'removed' });
    }
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Wishlist POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update wishlist' }, { status: 500 });
  }
}