'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Sparkles } from 'lucide-react';
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
  const configuredTitle = settings?.hero_title?.trim();
  const title = configuredTitle && configuredTitle !== 'Voir le monde autrement.'
    ? configuredTitle : fr ? 'Voir le monde autrement.' : 'شوف الدنيا بطريقة أخرى.';
  const accent = fr ? 'autrement.' : 'بطريقة أخرى.';
  const splitTitle = title.endsWith(accent) && title !== accent;
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
      <div className={styles.bgBase} aria-hidden="true" />
      <div className={styles.bgGlow1} aria-hidden="true" />
      <div className={styles.bgGlow2} aria-hidden="true" />
      <div className={styles.bgGrid} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={styles.textCol}>
          <p className={styles.badge}>
            <Sparkles size={12} aria-hidden="true" />
            {badge && badge !== 'NOUVELLE COLLECTION 2026' ? badge : fr ? 'Nyvara · Boutique' : 'نيفارا · بوتيك'}
          </p>
          <h1 id="home-title" className={styles.headline}>
            {splitTitle
              ? <><span className={styles.headlineTop}>{title.slice(0, -accent.length).trimEnd()}</span>{' '}<span className={styles.headlineAccent}>{accent}</span></>
              : <span className={styles.headlineTop}>{title}</span>}
          </h1>
          <p className={styles.subline}>
            {description && !description.startsWith('Des lunettes de luxe taillées pour les visionnaires.')
              ? description
              : fr ? 'Lunettes, montres et accessoires pour affirmer votre style.' : 'نظارات وساعات وإكسسوارات تعبّر على ستايلك.'}
          </p>
          {stats.length > 0 && <dl className={styles.stats}>
            {stats.map(stat => <div key={stat.slot} className={styles.statItem}>
              <dt className={styles.statLabel}>{stat.label}</dt><dd className={styles.statNum}>{stat.value}</dd>
            </div>)}
          </dl>}
          <div className={styles.actions}>
            <Link href="/shop" className={styles.primaryCta}>
              {settings?.hero_cta1_label && settings.hero_cta1_label !== 'DÉCOUVRIR'
                ? settings.hero_cta1_label : fr ? 'Découvrir la collection' : 'اكتشف المجموعة'}
            </Link>
            {hasCategories && <Link href="#categories" className={styles.secondaryCta}>
              {secondaryLabel && secondaryLabel !== 'EXPLORER LA COLLECTION' ? secondaryLabel : fr ? 'Explorer les catégories' : 'تصفّح الأقسام'}
            </Link>}
          </div>
        </div>
        <div className={styles.visual}>
          <div className={styles.imageWrap}>
            <div className={styles.ringOuter} aria-hidden="true" />
            <div className={styles.ringInner} aria-hidden="true" />
            <div className={styles.cornerTL} aria-hidden="true" />
            <div className={styles.cornerBR} aria-hidden="true" />
            <Image src={settings?.hero_image_url || '/hero-model.png'} alt={fr ? 'Campagne de la boutique Nyvara' : 'مجموعة نيفارا'}
              fill priority sizes="(max-width: 900px) 420px, 55vw" className={styles.modelImg} />
            <div className={styles.imgOverlay} aria-hidden="true" />
            {imageBadge && imageBadge !== 'COLLECTION EXCLUSIVE 2026' && <span className={styles.floatTag}>
              <span className={styles.floatTagDot} aria-hidden="true" />{imageBadge}
            </span>}
          </div>
        </div>
      </div>
    </section>
  );
}
