import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * GET /api/products
 * Query params: category_id, gender, search, sort, page, pageSize, limit
 */
export async function GET(request: NextRequest) {
  try {
    headers(); // FORCE DYNAMIC RENDERING
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const category_id = searchParams.get("category_id");
    const gender = searchParams.get("gender");
    const search = searchParams.get("search");
    const sort = searchParams.get("sort") || "newest";
    const page = parseInt(searchParams.get("page") || "0");
    const requestedPageSize = parseInt(searchParams.get("pageSize") || searchParams.get("limit") || "20");
    const pageSize = Math.min(requestedPageSize, 100);
    const offset = page * pageSize;
    const min_price = searchParams.get("min_price");
    const max_price = searchParams.get("max_price");

    // Build WHERE clauses dynamically
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (category_id) {
      conditions.push(`p.category_id = $${paramIdx++}`);
      params.push(category_id);
    }
    if (gender && gender !== "all") {
      conditions.push(`p.gender = $${paramIdx++}`);
      params.push(gender);
    }
    if (search) {
      conditions.push(`p.title ILIKE $${paramIdx++}`);
      params.push(`%${search}%`);
    }
    if (min_price) {
      conditions.push(`COALESCE(p.final_price, p.price) >= $${paramIdx++}`);
      params.push(min_price);
    }
    if (max_price) {
      conditions.push(`COALESCE(p.final_price, p.price) <= $${paramIdx++}`);
      params.push(max_price);
    }
    const frame_shape = searchParams.get("frame_shape");
    if (frame_shape) {
      conditions.push(`p.frame_shape = $${paramIdx++}`);
      params.push(frame_shape);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Determine ORDER BY
    let orderBy = "p.created_at DESC";
    if (sort === "name_asc") orderBy = "p.title ASC";
    else if (sort === "price_asc" || sort === "price-asc") orderBy = "p.price ASC";
    else if (sort === "price_desc" || sort === "price-desc") orderBy = "p.price DESC";
    else if (sort === "tendance") orderBy = "p.review_count DESC NULLS LAST, p.rating DESC NULLS LAST";

    const noLimit = searchParams.get("noLimit") === "true";

    // Count query
    const countRows = await sql.unsafe(
      `SELECT COUNT(*) as total FROM products p ${whereClause}`,
      params
    );
    const total = parseInt(countRows[0]?.total || "0");

    // Data query
    let limitClause = "";
    let dataParams = [...params];

    if (!noLimit) {
      limitClause = `LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
      dataParams.push(pageSize, offset);
    }

    const rows = await sql.unsafe(
      `SELECT
        p.*,
        json_build_object('id', c.id, 'name', c.name) AS categories
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${whereClause}
       ORDER BY ${orderBy}
       ${limitClause}`,
      dataParams
    );

    return NextResponse.json({ data: rows, count: total });
  } catch (err: any) {
    console.error("[API /products] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { generateProductEmbedding } from '@/lib/embeddings';

/**
 * POST /api/products — create a new product
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title, price, final_price, cost_price, stock, discount, description,
      image_url, gender, category_id, badge, features, rating, review_count,
      specs, color_options, quantity_breaks, is_active, allow_unlimited_stock,
      frame_shape, style_vibe, optical_fit, ideal_faces
    } = body;

    // Generate vector embedding
    const embedding = await generateProductEmbedding(body);
    const embeddingStr = embedding ? JSON.stringify(embedding) : null;

    const rows = await sql`
      INSERT INTO products
        (title, price, final_price, cost_price, stock, discount, description,
         image_url, gender, category_id, badge, features, rating, review_count,
         specs, color_options, quantity_breaks, is_active, allow_unlimited_stock,
         frame_shape, style_vibe, optical_fit, ideal_faces, embedding)
      VALUES
        (${title}, ${price}, ${final_price ?? null}, ${cost_price ?? null},
         ${stock ?? 0}, ${discount ?? null}, ${description ?? null},
         ${image_url ?? null}, ${gender ?? "unisex"}, ${category_id ?? null},
         ${badge ?? null}, ${features ?? null}, ${rating ?? null},
         ${review_count ?? null},
         ${specs ? JSON.stringify(specs) : null},
         ${color_options ? JSON.stringify(color_options) : null},
         ${quantity_breaks ? JSON.stringify(quantity_breaks) : null},
         ${is_active ?? true}, ${allow_unlimited_stock ?? false},
         ${frame_shape ?? null}, ${style_vibe ?? null}, ${optical_fit ?? null},
         ${ideal_faces ? ideal_faces : null},
         ${embeddingStr})
      RETURNING *
    `;
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    console.error("[API POST /products] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
