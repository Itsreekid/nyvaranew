import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/orders
 * Query params: page, pageSize, archived (bool), search, includeItems (bool), limit
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const page = parseInt(sp.get('page') || '0');
    const requestedPageSize = parseInt(sp.get('pageSize') || sp.get('limit') || '10');
    const pageSize = Math.min(requestedPageSize, 100);
    const offset = page * pageSize;
    const archived = sp.get('archived') === 'true';
    const search = sp.get('search') || '';

    // Build search condition
    let countRows, rows, total;
    if (search.trim()) {
      const q = `%${search.trim()}%`;
      countRows = await sql`
        SELECT COUNT(*) AS total FROM orders
        WHERE archived = ${archived}
        AND (customer_name ILIKE ${q} OR phone ILIKE ${q})`;
      total = parseInt(countRows[0]?.total || '0');

      rows = await sql`
        SELECT o.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity,
                'quantity_break_price', oi.quantity_break_price,
                'selected_color_name', oi.selected_color_name,
                'selected_color_hex1', oi.selected_color_hex1,
                'selected_color_hex2', oi.selected_color_hex2,
                'products', json_build_object('id', p.id, 'title', p.title, 'price', p.price,
                  'discount', p.discount, 'image_url', p.image_url,
                  'color_options', p.color_options, 'quantity_breaks', p.quantity_breaks)
              ) ORDER BY oi.id
            ) FILTER (WHERE oi.id IS NOT NULL),
            '[]'
          ) AS order_items
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE o.archived = ${archived}
        AND (o.customer_name ILIKE ${q} OR o.phone ILIKE ${q})
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}`;
    } else {
      countRows = await sql`SELECT COUNT(*) AS total FROM orders WHERE archived = ${archived}`;
      total = parseInt(countRows[0]?.total || '0');

      rows = await sql`
        SELECT o.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity,
                'quantity_break_price', oi.quantity_break_price,
                'selected_color_name', oi.selected_color_name,
                'selected_color_hex1', oi.selected_color_hex1,
                'selected_color_hex2', oi.selected_color_hex2,
                'products', json_build_object('id', p.id, 'title', p.title, 'price', p.price,
                  'discount', p.discount, 'image_url', p.image_url,
                  'color_options', p.color_options, 'quantity_breaks', p.quantity_breaks)
              ) ORDER BY oi.id
            ) FILTER (WHERE oi.id IS NOT NULL),
            '[]'
          ) AS order_items
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE o.archived = ${archived}
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}`;
    }

    return NextResponse.json({ data: rows, count: total });
  } catch (err) {
    console.error('[GET /api/orders] Error:', (err as any).message);
    return NextResponse.json({ error: (err as any).message }, { status: 500 });
  }
}

/**
 * POST /api/orders ? create a new order
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { customer_name, customer_email, phone, city, postal_code, country, address, items, is_admin_create, total_price: providedTotal } = payload;

    if (!items?.length && !is_admin_create) return NextResponse.json({ error: 'No items provided' }, { status: 400 });

    let final_total_price = providedTotal || 0;
    const itemPrices: any[] = [];

    if (items?.length > 0) {
      // 1. Validate + fetch product prices from DB (server-authoritative)
      const productIds = [...new Set<string>(items.map((i: any) => i.product_id))];
      const products = await sql`
        SELECT id, price, discount, quantity_breaks, stock, allow_unlimited_stock
        FROM products WHERE id = ANY(${productIds}::uuid[])`;

      // Map total quantity per product (for quantity breaks)
      const productTotals: Record<string, number> = {};
      items.forEach((i: any) => { productTotals[i.product_id] = (productTotals[i.product_id] || 0) + i.quantity; });

      // Calculate per-item unit price
      items.forEach((i: any) => {
        const p = (products as any[]).find((pr: any) => pr.id === i.product_id);
        if (!p) { itemPrices.push({ id: i.product_id, price: 0 }); return; }
        const totalQty = productTotals[i.product_id];
        const breaks = (p.quantity_breaks || []) as any[];
        const applicableBreak = [...breaks]
          .sort((a: any, b: any) => b.min_qty - a.min_qty)
          .find((qb: any) => totalQty >= qb.min_qty);
        if (applicableBreak) {
          itemPrices.push({ id: i.product_id, price: applicableBreak.total_price / totalQty });
          return;
        }
        const hasDiscount = p.discount != null && p.discount > 0;
        const finalPrice = hasDiscount ? Math.round((p.price ?? 0) * (1 - (p.discount || 0) / 100)) : (p.price ?? 0);
        itemPrices.push({ id: i.product_id, price: finalPrice });
      });

      final_total_price = items.reduce((sum: number, item: any, idx: number) => sum + itemPrices[idx].price * item.quantity, 0);
    }

    // 2. Insert order
    const orderRows = await sql`
      INSERT INTO orders (customer_name, customer_email, phone, city, postal_code, country, address, total_price)
      VALUES (${customer_name}, ${customer_email ?? null}, ${phone}, ${city}, ${postal_code ?? null}, ${country ?? 'Tunisie'}, ${address ?? null}, ${final_total_price})
      RETURNING *`;
    const order = orderRows[0] as any;

    // 3. Insert order items
    if (items?.length > 0) {
      for (let idx = 0; idx < items.length; idx++) {
        const i = items[idx];
        await sql`
          INSERT INTO order_items (order_id, product_id, quantity, selected_color_name, selected_color_hex1, selected_color_hex2, quantity_break_price)
          VALUES (${order.id}, ${i.product_id}, ${i.quantity},
                  ${i.selected_color?.name ?? null}, ${i.selected_color?.hex1 ?? null}, ${i.selected_color?.hex2 ?? null},
                  ${itemPrices[idx].price})`;
      }
    }

    return NextResponse.json({ data: order }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/orders] Error:', (err as any).message);
    return NextResponse.json({ error: (err as any).message }, { status: 500 });
  }
}

/**
 * PATCH /api/orders — update one or multiple orders
 * Body: { id, ...fieldsToUpdate } or { ids: string[], archived: bool }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id, ids, archived, call_status,
      cosmos_barcode, cosmos_label_url, cosmos_label_pdf_url, cosmos_status,
      total_price,
      customer_name, customer_email, phone, city, address, postal_code, country,
      private_note,
    } = body;

    // Bulk archive/unarchive
    if (ids && archived !== undefined) {
      await sql`UPDATE orders SET archived = ${archived} WHERE id = ANY(${ids}::uuid[])`;
      return NextResponse.json({ success: true });
    }

    // Single order update
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const updates: string[] = [];
    const params: any[] = [];
    let pi = 1;

    const addField = (col: string, val: any) => {
      updates.push(`${col} = $${pi++}`);
      params.push(val);
    };

    if (call_status          !== undefined) addField('call_status',          call_status);
    if (archived             !== undefined) addField('archived',             archived);
    if (cosmos_barcode       !== undefined) addField('cosmos_barcode',       cosmos_barcode);
    if (cosmos_label_url     !== undefined) addField('cosmos_label_url',     cosmos_label_url);
    if (cosmos_label_pdf_url !== undefined) addField('cosmos_label_pdf_url', cosmos_label_pdf_url);
    if (cosmos_status        !== undefined) addField('cosmos_status',        cosmos_status);
    if (total_price          !== undefined) addField('total_price',          total_price);
    if (customer_name        !== undefined) addField('customer_name',        customer_name);
    if (customer_email       !== undefined) addField('customer_email',       customer_email);
    if (phone                !== undefined) addField('phone',                phone);
    if (city                 !== undefined) addField('city',                 city);
    if (address              !== undefined) addField('address',              address);
    if (postal_code          !== undefined) addField('postal_code',          postal_code);
    if (country              !== undefined) addField('country',              country);
    if (private_note         !== undefined) addField('private_note',         private_note);

    if (!updates.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    params.push(id);
    await sql(`UPDATE orders SET ${updates.join(', ')} WHERE id = $${pi}`, params);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as any).message }, { status: 500 });
  }
}