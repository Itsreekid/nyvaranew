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

  const allProducts = await sql`
    SELECT p.*, json_build_object('id', c.id, 'name', c.name) AS categories
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.id != ${id}::uuid
      AND p.embedding IS NOT NULL
      AND p.is_active = true
  `;

  let relatedRows = [];
  
  if (product.embedding && allProducts.length > 0) {
    const targetEmbedding = parseJsonbArray(product.embedding) as number[];
    
    // Calculate cosine similarity
    const cosineSimilarity = (a: number[], b: number[]) => {
      if (a.length !== b.length) return 0;
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      if (normA === 0 || normB === 0) return 0;
      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    };

    const scoredProducts = allProducts.map(p => {
      const emb = parseJsonbArray(p.embedding) as number[];
      const score = cosineSimilarity(targetEmbedding, emb);
      return { product: p, score };
    });

    scoredProducts.sort((a, b) => b.score - a.score);
    relatedRows = scoredProducts.slice(0, 4).map(s => s.product);
  } else {
    // Fallback if no embedding
    relatedRows = allProducts.slice(0, 4);
  }

  const gallery: { id: string; image_url: string }[] = galleryRows as any[];
  const related: Product[] = relatedRows as unknown as Product[];

  return <ProductDetail product={product as Product} gallery={gallery} related={related} />;
}