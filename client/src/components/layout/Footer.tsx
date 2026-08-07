'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Phone } from 'lucide-react';
import styles from './Footer.module.css';

// Minimal SVGs for Socials
function FacebookIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function InstagramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function TikTokIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

export default function Footer() {
  const pathname = usePathname();

  if (pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.logoWrapper}>
            <Image 
              src="/logo.png" 
              alt="NYVARA" 
              width={140} 
              height={45} 
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          <p className={styles.tagline}>
            La façon dont vous voyez le jour.
          </p>
          
          <a href="tel:+21658095226" aria-label="Appeler le support" className={styles.phoneLink} suppressHydrationWarning>
            <Phone size={16} />
            <span>+216 58 095 226</span>
          </a>

          <div className={styles.socials}>
            <a href="https://www.instagram.com/nyvara_tn/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={styles.socialLink} suppressHydrationWarning>
              <InstagramIcon size={18} />
            </a>
            <a href="https://www.facebook.com/Nyvara1/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className={styles.socialLink} suppressHydrationWarning>
              <FacebookIcon size={18} />
            </a>
            <a href="https://www.tiktok.com/@nyvara.store" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className={styles.socialLink} suppressHydrationWarning>
              <TikTokIcon size={18} />
            </a>
          </div>
        </div>
      </div>

      <div className={styles.bottom} suppressHydrationWarning>
        <p suppressHydrationWarning>&copy; {new Date().getFullYear()} Nyvara. Tous droits réservés.</p>
      </div>
    </footer>
  );
}
