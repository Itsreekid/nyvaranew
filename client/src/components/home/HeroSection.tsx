'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowDown, Sparkles } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { getTranslation } from '@/locales/dictionary';
import styles from './HeroSection.module.css';

export default function HeroSection({ settings }: { settings?: any }) {
  const { language } = useLanguage();
  const t = (path: string) => getTranslation(language, path);

  const titleSplit = (settings?.hero_title || '').split('autrement.');
  const hasSplit = titleSplit.length > 1 || (settings?.hero_title || '').includes('autrement.');
  
  return (
    <section className={styles.hero} aria-label="Hero">

      <div className={styles.bgBase} aria-hidden="true" />
      <div className={styles.bgGlow1} aria-hidden="true" />
      <div className={styles.bgGlow2} aria-hidden="true" />
      <div className={styles.bgGrid}  aria-hidden="true" />

      <div className={styles.inner}>

        <div className={styles.textCol}>

          <div className={styles.badge}>
            <Sparkles size={11} />
            <span>{settings?.hero_badge || t('hero.badge')}</span>
          </div>

          <h1 className={styles.headline}>
            {hasSplit ? (
               <>
                 <span className={styles.headlineTop}>{settings?.hero_title.replace('autrement.', '').trim()} </span>
                 <span className={styles.headlineAccent}>autrement.</span>
               </>
            ) : (
               <span className={styles.headlineTop}>{settings?.hero_title || t('hero.title1')}</span>
            )}
          </h1>

          <p className={styles.subline} style={{ whiteSpace: 'pre-line' }}>
            {settings?.hero_subtitle || (t('hero.sub1') + '\n' + t('hero.sub2'))}
          </p>

          <div className={styles.stats}>
            <div className={styles.statItem}>
              <span className={styles.statNum}>{settings?.hero_stat1_value || '200+'}</span>
              <span className={styles.statLabel}>{settings?.hero_stat1_label || t('hero.stat1')}</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={styles.statNum}>{settings?.hero_stat2_value || '100%'}</span>
              <span className={styles.statLabel}>{settings?.hero_stat2_label || t('hero.stat2')}</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={styles.statNum}>{settings?.hero_stat3_value || '48h'}</span>
              <span className={styles.statLabel}>{settings?.hero_stat3_label || t('hero.stat3')}</span>
            </div>
          </div>

          <div className={styles.actions}>
            <Link href="/shop" className={styles.primaryCta}>
              <span>{settings?.hero_cta1_label || t('hero.primaryCta')}</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <Link href="/shop" className={styles.secondaryCta}>
              {settings?.hero_cta2_label || t('hero.secondaryCta')}
            </Link>
          </div>
        </div>

        <div className={styles.visual} aria-hidden="false">
          <div className={styles.imageWrap}>

            <div className={styles.ringOuter} aria-hidden="true" />
            <div className={styles.ringInner} aria-hidden="true" />

            <div className={styles.cornerTL} aria-hidden="true" />
            <div className={styles.cornerBR} aria-hidden="true" />

            <Image
              src={settings?.hero_image_url || "/hero-model.png"}
              alt="Modèle portant des lunettes de soleil Nyvara"
              fill
              priority
              fetchPriority="high"
              sizes="(max-width: 900px) 100vw, 55vw"
              className={styles.modelImg}
            />

            <div className={styles.imgOverlay} aria-hidden="true" />

            <div className={styles.floatTag}>
              <span className={styles.floatTagDot} />
              <span>{settings?.hero_image_badge || t('hero.tag')}</span>
            </div>

            <div className={styles.yearMark} aria-hidden="true">2026</div>
          </div>
        </div>
      </div>
    </section>
  );
}
