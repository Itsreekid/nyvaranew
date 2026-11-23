import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getProductColors, getPurchasableColor, getQuantityBreaks, isSelectedColorUnavailable, unavailableColorMessage, validatePurchase } from '@/lib/product-availability';
import type { CreateOrderPayload, Product } from '@/types';

type OrderProduct = Pick<Product, 'id' | 'title' | 'price' | 'discount' | 'quantity_breaks' | 'stock'
  | 'allow_unlimited_stock' | 'is_active' | 'color_options'>;

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
    const status = sp.get('status') || '';

    // Build search condition
    let countRows, rows, total;
    if (search.trim()) {
      const q = `%${search.trim()}%`;
      countRows = await sql`
        SELECT COUNT(*) AS total FROM orders
        WHERE archived = ${archived}
        AND (customer_name ILIKE ${q} OR phone ILIKE ${q})
        AND (
          ${status} = '' 
          OR (${status} = 'attempts' AND COALESCE(call_status, 'pending') LIKE 'attempt_%')
          OR (${status} != 'attempts' AND COALESCE(call_status, 'pending') = ${status})
        )`;
      total = parseInt(countRows[0]?.total || '0');

      rows = await sql`
        SELECT o.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity,
                'quantity_break_price', oi.quantity_break_price,
                'selected_color_id', oi.selected_color_id,
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
        AND (
          ${status} = '' 
          OR (${status} = 'attempts' AND COALESCE(o.call_status, 'pending') LIKE 'attempt_%')
          OR (${status} != 'attempts' AND COALESCE(o.call_status, 'pending') = ${status})
        )
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}`;
    } else {
      countRows = await sql`
        SELECT COUNT(*) AS total FROM orders 
        WHERE archived = ${archived}
        AND (
          ${status} = '' 
          OR (${status} = 'attempts' AND COALESCE(call_status, 'pending') LIKE 'attempt_%')
          OR (${status} != 'attempts' AND COALESCE(call_status, 'pending') = ${status})
        )`;
      total = parseInt(countRows[0]?.total || '0');

      rows = await sql`
        SELECT o.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity,
                'quantity_break_price', oi.quantity_break_price,
                'selected_color_id', oi.selected_color_id,
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
        AND (
          ${status} = '' 
          OR (${status} = 'attempts' AND COALESCE(o.call_status, 'pending') LIKE 'attempt_%')
          OR (${status} != 'attempts' AND COALESCE(o.call_status, 'pending') = ${status})
        )
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
    const payload: CreateOrderPayload & { is_admin_create?: boolean; total_price?: number } = await request.json();
    const { customer_name, customer_email, phone, city, postal_code, country, address, items, is_admin_create, total_price: providedTotal } = payload;

    if (!Array.isArray(items) || (!items.length && !is_admin_create)
      || items.some(item => !item || typeof item.product_id !== 'string'
        || !Number.isSafeInteger(item.quantity) || item.quantity < 1)) {
      return NextResponse.json({ error: 'Articles ou quantités invalides.' }, { status: 400 });
    }

    return await sql.begin(async transaction => {
      let final_total_price = providedTotal || 0;
      const itemPrices: { price: number }[] = [];
      const productsById = new Map<string, OrderProduct>();

      if (items?.length > 0) {
        // 1. Validate + fetch product prices from DB (server-authoritative)
        const productIds = [...new Set<string>(items.map(item => item.product_id))];
        const products = await transaction<OrderProduct[]>`
          SELECT id, title, price, discount, quantity_breaks, stock, allow_unlimited_stock, is_active, color_options
          FROM products WHERE id = ANY(${productIds}::uuid[]) ORDER BY id FOR UPDATE`;

        for (const product of products) productsById.set(product.id, product);
        const productTotals: Record<string, number> = {};
        for (const productId of productIds) {
          const product = productsById.get(productId);
          if (!product) {
            return NextResponse.json({ error: 'Un article du panier est indisponible.' }, { status: 409 });
          }
          const productItems = items.filter(item => item.product_id === productId);
          const colors = getProductColors(product.color_options);
          const unavailable = productItems.find(item => isSelectedColorUnavailable(colors, item.selected_color?.id));
          if (unavailable) {
            const name = colors.find(color => color.id === unavailable.selected_color?.id)?.name
              ?? unavailable.selected_color?.name;
            return NextResponse.json({ error: unavailableColorMessage(name) }, { status: 409 });
          }
          const selections = productItems.map(item => ({
            quantity: item.quantity,
            colorId: item.selected_color?.id,
          }));
          productTotals[productId] = selections.reduce((total, item) => total + item.quantity, 0);
          const issue = validatePurchase(product, selections);
          if (issue) {
            const message = 'Stock insuffisant. Modifiez la quantité ou retirez cet article du panier.';
            return NextResponse.json({ error: `${product.title ?? 'Article'} — ${message}` }, { status: 409 });
          }
        }

        // The locked stock is consumed in the same transaction as the order.
        for (const product of products) {
          if (product.allow_unlimited_stock !== true) {
            await transaction`UPDATE products SET stock = stock - ${productTotals[product.id]} WHERE id = ${product.id}`;
          }
        }

        // Calculate per-item unit price
        for (const i of items) {
          const p = productsById.get(i.product_id);
          if (!p) throw new Error('Order product missing after validation');
          const totalQty = productTotals[i.product_id];
          const breaks = getQuantityBreaks(p.quantity_breaks);
          const applicableBreak = [...breaks]
            .sort((a, b) => b.min_qty - a.min_qty)
            .find(qb => totalQty >= qb.min_qty);
          if (applicableBreak) {
            itemPrices.push({ price: applicableBreak.total_price / totalQty });
            continue;
          }
          const hasDiscount = p.discount != null && p.discount > 0;
          const finalPrice = hasDiscount ? Math.round((p.price ?? 0) * (1 - (p.discount || 0) / 100)) : (p.price ?? 0);
          itemPrices.push({ price: finalPrice });
        }

        final_total_price = items.reduce((sum, item, idx) => sum + itemPrices[idx].price * item.quantity, 0);
      }

      // 2. Insert order
      const orderRows = await transaction`
        INSERT INTO orders (customer_name, customer_email, phone, city, postal_code, country, address, total_price)
        VALUES (${customer_name}, ${customer_email ?? null}, ${phone}, ${city}, ${postal_code ?? null}, ${country ?? 'Tunisie'}, ${address ?? null}, ${final_total_price})
        RETURNING *`;
      const order = orderRows[0] as any;

      // 3. Insert order items
      if (items?.length > 0) {
        for (let idx = 0; idx < items.length; idx++) {
          const i = items[idx];
          const product = productsById.get(i.product_id);
          const color = getPurchasableColor(getProductColors(product?.color_options), i.selected_color?.id);
          await transaction`
            INSERT INTO order_items (order_id, product_id, quantity, selected_color_id, selected_color_name, selected_color_hex1, selected_color_hex2, quantity_break_price)
            VALUES (${order.id}, ${i.product_id}, ${i.quantity},
                    ${color?.id ?? null}, ${color?.name ?? null}, ${color?.hex1 ?? null}, ${color?.hex2 ?? null},
                    ${itemPrices[idx].price})`;
        }
      }

      return NextResponse.json({ data: order }, { status: 201 });
    });
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
    await sql.unsafe(`UPDATE orders SET ${updates.join(', ')} WHERE id = $${pi}`, params);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as any).message }, { status: 500 });
  }
}