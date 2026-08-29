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

  // Ensure color_options is always a parsed array, never a raw JSON string.
  // PostgreSQL drivers can return JSONB columns as a stringified value.
  if (typeof product.color_options === 'string') {
    try { product.color_options = JSON.parse(product.color_options); }
    catch { product.color_options = []; }
  }
  if (!Array.isArray(product.color_options)) {
    product.color_options = [];
  }

  const relatedRows = await sql`
    SELECT p.*, json_build_object('id', c.id, 'name', c.name) AS categories
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.category_id = ${product.category_id ?? '00000000-0000-0000-0000-000000000000'}::uuid
      AND p.id != ${id}::uuid
    ORDER BY p.created_at DESC LIMIT 4`;

  const gallery: { id: string; image_url: string }[] = galleryRows as any[];
  const related: Product[] = relatedRows as unknown as Product[];

  return <ProductDetail product={product as Product} gallery={gallery} related={related} />;
}