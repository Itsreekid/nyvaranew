import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { headers } from "next/headers";
import { MORPHOLOGY_NOT_SPECIFIED, normalizeFrameShape, normalizeMorphology } from '@/lib/morphology';
import { parseMorphologyQuiz, rankMorphologyProducts } from '@/lib/morphology-quiz';
import type { Product } from '@/types';

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
    const quiz = parseMorphologyQuiz(searchParams.get("quiz"));
    const gender = searchParams.get("gender") ?? quiz?.gender;
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
      conditions.push(quiz ? `(p.gender = $${paramIdx++} OR p.gender = 'unisex')` : `p.gender = $${paramIdx++}`);
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
    const normalizedShape = normalizeFrameShape(frame_shape);
    if (frame_shape && !normalizedShape && !quiz) {
      conditions.push(`p.frame_shape = $${paramIdx++}`);
      params.push(frame_shape);
    }

    const filterInMemory = Boolean(quiz || normalizedShape);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Determine ORDER BY
    let orderBy = "p.created_at DESC";
    if (sort === "name_asc") orderBy = "p.title ASC";
    else if (sort === "price_asc" || sort === "price-asc") orderBy = "p.price ASC";
    else if (sort === "price_desc" || sort === "price-desc") orderBy = "p.price DESC";
    else if (sort === "tendance") orderBy = "p.review_count DESC NULLS LAST, p.rating DESC NULLS LAST";

    if (!quiz && searchParams.get("outOfStockLast") === "true") {
      // Match the whole-product availability shown on shop cards.
      orderBy = `(p.is_active IS FALSE
        OR (COALESCE(p.stock, 0) <= 0 AND p.allow_unlimited_stock IS NOT TRUE)
        OR (SELECT COALESCE(bool_and(color->'isAvailable' = 'false'::jsonb IS TRUE), false)
            FROM LATERAL (
              SELECT CASE
                WHEN jsonb_typeof(p.color_options::jsonb) = 'array' THEN p.color_options::jsonb
                WHEN jsonb_typeof(p.color_options::jsonb) = 'string'
                  AND left(ltrim(p.color_options::jsonb #>> '{}'), 1) = '['
                  AND right(rtrim(p.color_options::jsonb #>> '{}'), 1) = ']'
                  THEN (p.color_options::jsonb #>> '{}')::jsonb
                ELSE '[]'::jsonb
              END AS variants
            ) AS stored
            CROSS JOIN LATERAL jsonb_array_elements(stored.variants) AS colors(color)
            WHERE jsonb_typeof(color->'id') = 'string' AND color->>'id' <> '')
        ) ASC, ${orderBy}`;
    }

    const noLimit = searchParams.get("noLimit") === "true";

    // Count query
    const countRows = filterInMemory ? [] : await sql.unsafe(
      `SELECT COUNT(*) as total FROM products p ${whereClause}`,
      params
    );
    const total = parseInt(countRows[0]?.total || "0");

    // Data query
    let limitClause = "";
    let dataParams = [...params];

    if (!noLimit && !filterInMemory) {
      limitClause = `LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
      dataParams.push(pageSize, offset);
    }

    const rows = await sql.unsafe<Product[]>(
      `SELECT
        p.*,
        json_build_object('id', c.id, 'name', c.name) AS categories
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${whereClause}
       ORDER BY ${orderBy}, p.id ASC
       ${limitClause}`,
      dataParams
    );

    if (filterInMemory) {
      const filtered = normalizedShape ? rows.filter(row => normalizeFrameShape(row.frame_shape) === normalizedShape) : rows;
      const ranked = quiz ? rankMorphologyProducts(filtered, quiz) : filtered;
      return NextResponse.json({ data: noLimit ? ranked : ranked.slice(offset, offset + pageSize), count: ranked.length });
    }
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

    const morphology = normalizeMorphology({ frame_shape, style_vibe, optical_fit, ideal_faces });

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
         ${frame_shape === MORPHOLOGY_NOT_SPECIFIED ? frame_shape : morphology.frame_shape},
         ${style_vibe === MORPHOLOGY_NOT_SPECIFIED ? style_vibe : morphology.style_vibe},
         ${optical_fit === MORPHOLOGY_NOT_SPECIFIED ? optical_fit : morphology.optical_fit},
         ${morphology.ideal_faces.length || Array.isArray(ideal_faces) ? sql.array(morphology.ideal_faces, 25) : null},
         ${embeddingStr})
      RETURNING *
    `;
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    console.error("[API POST /products] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
