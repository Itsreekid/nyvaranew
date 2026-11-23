'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';
import styles from './HeroSection.module.css';

export interface HeroSettings {
  hero_title?: string | null;
  hero_subtitle?: string | null;
  hero_image_url?: string | null;
  hero_cta1_label?: string | null;
  hero_cta2_label?: string | null;
  hero_badge?: string | null;
  hero_image_badge?: string | null;
  hero_stat1_value?: string | null;
  hero_stat1_label?: string | null;
  hero_stat2_value?: string | null;
  hero_stat2_label?: string | null;
  hero_stat3_value?: string | null;
  hero_stat3_label?: string | null;
}

export default function HeroSection({ settings, hasCategories }: { settings?: HeroSettings; hasCategories: boolean }) {
  const { language } = useLanguage();
  const fr = language === 'fr';
  const title = settings?.hero_title?.trim();
  const description = settings?.hero_subtitle?.trim();
  const badge = settings?.hero_badge?.trim();
  const imageBadge = settings?.hero_image_badge?.trim();
  const secondaryLabel = settings?.hero_cta2_label?.trim();
  const stats = [1, 2, 3].map(index => {
    const slot = index as 1 | 2 | 3;
    const value = settings?.[`hero_stat${slot}_value`]?.trim();
    const label = settings?.[`hero_stat${slot}_label`]?.trim();
    const legacy = ['200+ MODÈLES', '100% ARTISANAL', '48H LIVRAISON'];
    return value && label && !legacy.includes((value + ' ' + label).toUpperCase()) ? { value, label, slot } : null;
  }).filter(stat => stat !== null);

  return (
    <section className={styles.hero} aria-labelledby="home-title">
      <div className={styles.inner}>
        <div className={styles.text}>
          <p className={styles.eyebrow}>{badge && badge !== 'NOUVELLE COLLECTION 2026' ? badge : fr ? 'Nyvara · Boutique' : 'نيفارا · بوتيك'}</p>
          <h1 id="home-title">{title && title !== 'Voir le monde autrement.' ? title : fr ? 'L’élégance à votre façon.' : 'الأناقة بطريقتك.'}</h1>
          <p className={styles.description}>
            {description && !description.startsWith('Des lunettes de luxe taillées pour les visionnaires.')
              ? description
              : fr ? 'Lunettes, montres et accessoires pour affirmer votre style.' : 'نظارات وساعات وإكسسوارات تعبّر على ستايلك.'}
          </p>
          <div className={styles.actions}>
            <Link href="/shop" className={styles.primary}>
              {settings?.hero_cta1_label && settings.hero_cta1_label !== 'DÉCOUVRIR'
                ? settings.hero_cta1_label : fr ? 'Découvrir la collection' : 'اكتشف المجموعة'}
            </Link>
            {hasCategories && <Link href="#categories" className={styles.secondary}>
              {secondaryLabel && secondaryLabel !== 'EXPLORER LA COLLECTION' ? secondaryLabel : fr ? 'Explorer les catégories' : 'تصفّح الأقسام'}
            </Link>}
          </div>
          {stats.length > 0 && <dl className={styles.stats}>
            {stats.map(stat => <div key={stat.slot}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}
          </dl>}
        </div>
        <div className={styles.photo}>
          <Image src={settings?.hero_image_url || '/hero-model.png'} alt={fr ? 'Campagne de la boutique Nyvara' : 'مجموعة نيفارا'}
            fill priority sizes="(max-width: 700px) 100vw, 52vw" />
          {imageBadge && imageBadge !== 'COLLECTION EXCLUSIVE 2026' && <span className={styles.imageBadge}>{imageBadge}</span>}
        </div>
      </div>
    </section>
  );
}
