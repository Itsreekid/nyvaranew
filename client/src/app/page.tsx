import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import HeroSection, { type HeroSettings } from '@/components/home/HeroSection';
import HomeCategories from '@/components/home/HomeCategories';
import { getHomepageSettings } from '@/lib/homepage-settings';
import { readCategoryConfig } from '@/lib/category-icons';
import { sql } from '@/lib/db';
import type { Category } from '@/types';

const FrameCarousel = dynamic(() => import('@/components/home/FrameCarousel'));
const FeaturedProducts = dynamic(() => import('@/components/home/FeaturedProducts'));

export const metadata: Metadata = {
  title: 'Nyvara — Lunettes, montres et accessoires en Tunisie',
  description: 'Explorez les collections Nyvara, une boutique tunisienne de lunettes, montres et accessoires.',
};

export const revalidate = 0;

async function getHomepageCategories() {
  // Read through the row JSON so deployments can show categories before the optional migration.
  const categories = await sql<(Category & { has_products: boolean })[]>`
    SELECT c.id, c.name, to_jsonb(c)->'homepage_config' AS homepage_config,
      EXISTS (SELECT 1 FROM products p WHERE p.category_id = c.id AND p.is_active IS NOT FALSE) AS has_products
    FROM categories c
    WHERE NULLIF(trim(c.name), '') IS NOT NULL
    ORDER BY c.name, c.id`;

  return categories
    .map(({ has_products, ...category }) => ({ category, hasProducts: has_products, config: readCategoryConfig(category.homepage_config) }))
    .filter(({ config, hasProducts }) => config.visible ?? hasProducts)
    .sort((a, b) => a.config.order - b.config.order)
    .map(({ category, config }) => ({ ...category, homepage_config: config }));
}

export default async function HomePage() {
  const [settings, collections] = await Promise.all([
    getHomepageSettings().catch(() => ({})),
    getHomepageCategories().catch(error => {
      console.error('[Homepage categories]', error);
      return [];
    }),
  ]);

  return (
    <>
      <HeroSection settings={settings as HeroSettings} hasCategories={collections.length > 0} />
      <HomeCategories collections={collections} />
      <FeaturedProducts />
      <FrameCarousel />
    </>
  );
}
