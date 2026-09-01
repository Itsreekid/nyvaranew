import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { matchCity } from "@/app/api/cosmos/orders/route";

const COSMOS_BASE = 'https://api.cosmos.tn/api/v1';
const COSMOS_TOKEN = process.env.COSMOS_API_TOKEN!;

export async function POST(req: NextRequest) {
  try {
    const { orders } = await req.json();

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json({ error: "Invalid or empty orders array provided." }, { status: 400 });
    }

    const results = [];
    
    // Process each order with Cosmos API
    for (const order of orders) {
      const quantity = order.order_items?.reduce((s: number, i: any) => s + (i.quantity || 1), 0) || 1;
      const formattedContent = order.order_items?.length > 0
        ? order.order_items.map((item: any) => `${item.quantity}x ${item.products?.title || 'Produit'}`).join(', ')
        : "Luxury Eyewear";

      const cosmosPayload = {
        name: order.customer_name,
        phone: order.phone,
        address: order.address,
        city: matchCity(order.city),
        totalAmount: Number(order.total_price),
        quantity: quantity,
        content: formattedContent.slice(0, 255),
        note: order.private_note ?? undefined,
        source: 'nyvara',
        externalBarcode: order.id,
        options: {
          allowToOpen: true,
          isFragile: true,
        },
      };

      const res = await fetch(`${COSMOS_BASE}/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${COSMOS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cosmosPayload),
      });

      if (res.ok) {
        const { data: delivery } = await res.json();
        
        // Update database with Cosmos details
        await sql`
          UPDATE orders 
          SET cosmos_barcode = ${delivery.barcode},
              cosmos_label_url = ${delivery.labelUrl},
              cosmos_label_pdf_url = ${delivery.labelPdfUrl},
              cosmos_status = ${delivery.status || 'to-be-picked'}
          WHERE id = ${order.id}
        `;
        
        results.push({ id: order.id, success: true });
      } else {
        const errorData = await res.text();
        console.error(`Failed to dispatch order ${order.id}:`, errorData);
        results.push({ id: order.id, success: false, error: errorData });
      }
    }

    const failed = results.filter(r => !r.success);
    if (failed.length === orders.length) {
      return NextResponse.json({ error: "Tous les envois ont échoué. Vérifiez vos configurations Cosmos.", details: failed }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully dispatched ${results.length - failed.length} items to Cosmos.`,
      failed
    });

  } catch (error: any) {
    console.error("Bulk Cosmos Dispatch Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
