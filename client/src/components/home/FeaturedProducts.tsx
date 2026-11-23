'use client';

import Link from 'next/link';
import ProductCard from '@/components/shop/ProductCard';
import { useFeaturedProducts } from '@/hooks/useProducts';
import { useLanguage } from '@/context/LanguageContext';
import { getProductColors, isProductOutOfStock } from '@/lib/product-availability';
import styles from './FeaturedProducts.module.css';

export default function FeaturedProducts() {
  const { products, loading } = useFeaturedProducts(36);
  const { language } = useLanguage();
  const fr = language === 'fr';
  const available = products.filter(product => !isProductOutOfStock(product, getProductColors(product.color_options)));
  const categories = new Set<string | null>();
  const picks = available.filter(product => {
    if (categories.has(product.category_id)) return false;
    categories.add(product.category_id);
    return true;
  }).slice(0, 6);
  const selection = [...picks, ...available.filter(product => !picks.includes(product))].slice(0, 6);

  if (!loading && !selection.length) return null;
  return (
    <section className={styles.section} id="featured" aria-labelledby="featured-title">
      <div className={styles.inner}>
        <div className={styles.header}>
          <h2 className={styles.headline} id="featured-title">{fr ? 'À découvrir' : 'قطع تستحق تكتشفها'}</h2>
          <Link href="/shop" className={styles.viewAll}>{fr ? 'Voir toute la boutique' : 'شوف المتجر الكل'}</Link>
        </div>
        <div className={styles.grid} aria-busy={loading}>
          {loading ? Array.from({ length: 6 }, (_, index) => <div key={index} className={styles.placeholder} />)
            : selection.map(product => <ProductCard key={product.id} product={product} />)}
        </div>
      </div>
    </section>
  );
}
