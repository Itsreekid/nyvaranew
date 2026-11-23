'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { categoryIcons, readCategoryConfig } from '@/lib/category-icons';
import type { Category } from '@/types';
import styles from './HomeCategories.module.css';

export default function HomeCategories({ collections }: { collections: Category[] }) {
  const { language } = useLanguage();
  const fr = language === 'fr';
  if (!collections.length) return null;
  return (
    <section id="categories" className={styles.section} aria-labelledby="category-title" dir={fr ? 'ltr' : 'rtl'}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2 id="category-title">{fr ? 'Explorez nos univers' : 'اكتشف مجموعاتنا'}</h2>
          <Link href="/shop" className={styles.allLink}>
            {fr ? 'Toute la boutique' : 'شوف المتجر الكل'}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </header>
        <ul className={styles.grid}>
          {collections.map(category => {
            const Icon = categoryIcons[readCategoryConfig(category.homepage_config).icon].icon;
            return (
              <li key={category.id}>
                <Link href={{ pathname: '/shop', query: { category: category.id } }}>
                  <span className={styles.icon}><Icon size={26} strokeWidth={1.45} aria-hidden="true" /></span>
                  <span className={styles.name}>{category.name}</span>
                  <ArrowUpRight className={styles.arrow} size={17} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
