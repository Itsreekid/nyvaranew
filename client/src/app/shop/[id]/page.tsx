import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ProductDetail from './ProductDetail';
import type { Product } from '@/types';
import { sql } from '@/lib/db';

export const revalidate = 0;

interface Props { params: Promise<{ id: string }>; }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const rows = await sql`SELECT title, description FROM products WHERE id = ${id} LIMIT 1`;
  const data = rows[0] as any;
  return {
    title: data?.title ? `${data.title} — NYVARA` : 'Produit — NYVARA',
    description: data?.description ?? 'Découvrez notre collection de lunettes de luxe.',
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;

  const [productRows, galleryRows] = await Promise.all([
    sql`
      SELECT p.*, json_build_object('id', c.id, 'name', c.name) AS categories
      FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ${id} LIMIT 1`,
    sql`SELECT id, image_url, sort_order FROM product_images WHERE product_id = ${id} ORDER BY sort_order ASC`,
  ]);

  const product = productRows[0] as any;
  if (!product) notFound();

  // Ensure JSONB columns are parsed properly, since PostgreSQL drivers can return them as strings.
  const parseJsonbArray = (val: any) => {
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return []; }
    }
    return Array.isArray(val) ? val : [];
  };

  const parseJsonbObject = (val: any) => {
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return {}; }
    }
    return typeof val === 'object' && !Array.isArray(val) && val !== null ? val : {};
  };

  product.color_options = parseJsonbArray(product.color_options);
  product.quantity_breaks = parseJsonbArray(product.quantity_breaks);
  product.ideal_faces = parseJsonbArray(product.ideal_faces);
  product.specs = parseJsonbObject(product.specs);

  let relatedRows: any[] = [];
  
  const allProducts = await sql`
    SELECT p.*, json_build_object('id', c.id, 'name', c.name) AS categories
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.id != ${id}::uuid
      AND p.is_active = true
  `;

  if (allProducts.length > 0) {
    // 100% FREE Heuristic Scoring (No Paid Embeddings Required!)
    const scoredProducts = allProducts.map(p => {
      let score = 0;
      
      // Match 1: Same category (+3)
      if (p.category_id === product.category_id) score += 3;
      
      // Match 2: Same Frame Shape (+4) - highest weight for visual similarity
      if (product.frame_shape && p.frame_shape === product.frame_shape) score += 4;
      
      // Match 3: Same Style / Vibe (+3)
      if (product.style_vibe && p.style_vibe === product.style_vibe) score += 3;
      
      // Match 4: Same Gender (+1)
      if (product.gender && p.gender === product.gender) score += 1;

      // Match 5: Same Optical Fit (+1)
      if (product.optical_fit && p.optical_fit === product.optical_fit) score += 1;

      // Match 6: Color Matching (+2) - check if any color names overlap
      try {
        const productColors = product.color_options || [];
        const pColors = typeof p.color_options === 'string' ? JSON.parse(p.color_options) : (p.color_options || []);
        
        const productcolorNames = productColors.map((c: any) => c?.name?.toLowerCase()).filter(Boolean);
        const pColorNames = pColors.map((c: any) => c?.name?.toLowerCase()).filter(Boolean);
        
        const hasMatchingColor = productcolorNames.some((cName: string) => pColorNames.includes(cName));
        if (hasMatchingColor) score += 2;
      } catch(e) {}

      return { product: p, score };
    });

    // Sort by highest score first
    scoredProducts.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // tie-breaker: newest first
      return new Date(b.product.created_at).getTime() - new Date(a.product.created_at).getTime();
    });
    
    relatedRows = scoredProducts.slice(0, 4).map(s => s.product);
  }

  const gallery: { id: string; image_url: string }[] = galleryRows as any[];
  const related: Product[] = relatedRows as unknown as Product[];

  return <ProductDetail product={product as Product} gallery={gallery} related={related} />;
}