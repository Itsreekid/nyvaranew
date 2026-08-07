'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowDown, Sparkles } from 'lucide-react';
import styles from './HeroSection.module.css';

export default function HeroSection() {
  return (
    <section className={styles.hero} aria-label="Hero">

      {/* ── Ambient background layers ── */}
      <div className={styles.bgBase} aria-hidden="true" />
      <div className={styles.bgGlow1} aria-hidden="true" />
      <div className={styles.bgGlow2} aria-hidden="true" />
      <div className={styles.bgGrid}  aria-hidden="true" />

      {/* ── Main content ── */}
      <div className={styles.inner}>

        {/* Left — editorial text */}
        <div className={styles.textCol}>

          <div className={styles.badge}>
            <Sparkles size={11} />
            <span>Nouvelle Collection 2026</span>
          </div>

          <h1 className={styles.headline}>
            <span className={styles.headlineTop}>Voir le monde</span>
            <span className={styles.headlineAccent}>autrement.</span>
          </h1>

          <p className={styles.subline}>
            Des lunettes de luxe taillées pour les visionnaires.
            <br />
            Style. Précision. Fashion.
          </p>

          {/* Stats row */}
          <div className={styles.stats}>
            <div className={styles.statItem}>
              <span className={styles.statNum}>200+</span>
              <span className={styles.statLabel}>Modèles</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={styles.statNum}>100%</span>
              <span className={styles.statLabel}>Artisanal</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={styles.statNum}>48h</span>
              <span className={styles.statLabel}>Livraison</span>
            </div>
          </div>

          <div className={styles.actions}>
            <Link href="/shop" className={styles.primaryCta}>
              <span>Découvrir</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <Link href="/shop" className={styles.secondaryCta}>
              Explorer la Collection
            </Link>
          </div>
        </div>

        {/* Right — model image */}
        <div className={styles.visual} aria-hidden="false">
          <div className={styles.imageWrap}>

            {/* Floating accent ring */}
            <div className={styles.ringOuter} aria-hidden="true" />
            <div className={styles.ringInner} aria-hidden="true" />

            {/* Gold corner brackets */}
            <div className={styles.cornerTL} aria-hidden="true" />
            <div className={styles.cornerBR} aria-hidden="true" />

            {/* Model photo */}
            <Image
              src="/hero-model.png"
              alt="Modèle portant des lunettes de soleil Nyvara"
              fill
              priority
              fetchPriority="high"
              sizes="(max-width: 900px) 100vw, 55vw"
              className={styles.modelImg}
            />

            {/* Overlay gradient so image blends beautifully */}
            <div className={styles.imgOverlay} aria-hidden="true" />

            {/* Floating tag */}
            <div className={styles.floatTag}>
              <span className={styles.floatTagDot} />
              <span>Collection Exclusive 2026</span>
            </div>

            {/* Year watermark */}
            <div className={styles.yearMark} aria-hidden="true">2026</div>
          </div>
        </div>
      </div>
    </section>
  );
}
