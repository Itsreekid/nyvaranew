'use client';

import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { categoryIcons, readCategoryConfig } from '@/lib/category-icons';
import type { Category } from '@/types';
import styles from './HomeCategories.module.css';

export default function HomeCategories({ collections }: { collections: Category[] }) {
  const { language } = useLanguage();
  const fr = language === 'fr';
  if (!collections.length) return null;
  return (
    <section id="categories" className={styles.section} aria-labelledby="category-title">
      <div className={styles.inner}>
        <h2 id="category-title">{fr ? 'Explorez nos univers' : 'اكتشف مجموعاتنا'}</h2>
        <p>{fr ? 'Découvrez nos collections et trouvez les pièces qui vous ressemblent.' : 'تصفّح مجموعاتنا واختار القطع اللي تشبهلك.'}</p>
        <ul className={styles.grid}>
          {collections.map(category => {
            const Icon = categoryIcons[readCategoryConfig(category.homepage_config).icon].icon;
            return (
              <li key={category.id}>
                <Link href={{ pathname: '/shop', query: { category: category.id } }}>
                  <span className={styles.icon}><Icon size={26} strokeWidth={1.45} aria-hidden="true" /></span>
                  <span>{category.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
