import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** POST ? insert one or many order items */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items = Array.isArray(body) ? body : [body];
    const inserted = [];
    for (const item of items) {
      const rows = await sql`
        INSERT INTO order_items
          (order_id, product_id, quantity, quantity_break_price,
           selected_color_name, selected_color_hex1, selected_color_hex2)
        VALUES
          (${item.order_id}, ${item.product_id}, ${item.quantity},
           ${item.quantity_break_price ?? null},
           ${item.selected_color_name ?? null}, ${item.selected_color_hex1 ?? null},
           ${item.selected_color_hex2 ?? null})
        RETURNING *`;
      inserted.push(rows[0]);
    }
    return NextResponse.json({ data: inserted }, { status: 201 });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

/** DELETE ? delete items by ids[] or a single id */
export async function DELETE(request: NextRequest) {
  try {
    const { ids } = await request.json();
    if (!ids?.length) return NextResponse.json({ success: true });
    await sql`DELETE FROM order_items WHERE id = ANY(${ids}::uuid[])`;
    return NextResponse.json({ success: true });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

/** PATCH ? update one order item */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, quantity, quantity_break_price, selected_color_name, selected_color_hex1, selected_color_hex2 } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await sql`
      UPDATE order_items SET
        quantity = ${quantity},
        quantity_break_price = ${quantity_break_price ?? null},
        selected_color_name = ${selected_color_name ?? null},
        selected_color_hex1 = ${selected_color_hex1 ?? null},
        selected_color_hex2 = ${selected_color_hex2 ?? null}
      WHERE id = ${id}::uuid`;
    return NextResponse.json({ success: true });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}