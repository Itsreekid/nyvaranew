'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { getTranslation } from '@/locales/dictionary';
import { Heart, ShoppingBag, ArrowLeft, Star, Truck, RotateCcw, ShieldCheck, Minus, Plus, CheckCircle2, Sun, Eye, Zap } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import ProductCard from '@/components/shop/ProductCard';
import type { Product, ColorOption } from '@/types';
import Toast from '@/components/ui/Toast';
import styles from './product.module.css';
import { fbEvent } from '@/components/analytics/FacebookPixel';

const formatTND = (price: number | null) => {
  if (price === null) return '—';
  return `${price.toLocaleString('fr-TN', { minimumFractionDigits: 3 })} TND`;
};

const genderLabel: Record<string, string> = {
  homme: "Men's",
  femme: "Women's",
  unisex: 'Unisex',
  enfant: "Kids'",
};

interface GalleryImage { id: string; image_url: string; }
interface Props {
  product: Product;
  gallery: GalleryImage[];
  related: Product[];
}

const SLIDE_INTERVAL = 3500;

// Star rating display
function Stars({ rating }: { rating: number | null }) {
  const r = rating ?? 0;
  return (
    <div className={styles.stars}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={15}
          fill={r >= i ? '#e6a817' : r >= i - 0.5 ? 'url(#half)' : 'none'}
          color={r >= i - 0.5 ? '#e6a817' : '#ccc'}
        />
      ))}
    </div>
  );
}

export default function ProductDetail({ product, gallery, related }: Props) {
  const router = useRouter();
  const { language } = useLanguage();
  const t = (path: string) => getTranslation(language, path);
  const { addItem, isInCart }                             = useCart();
  const { addToWishlist, removeFromWishlist, isWishlisted } = useWishlist();

  const inCart     = isInCart(product.id);
  const wishlisted = isWishlisted(product.id);

  // ── Meta Pixel: ViewContent (once per product page load) ─────────────
  const viewContentFired = useRef(false);
  useEffect(() => {
    if (viewContentFired.current) return;
    viewContentFired.current = true;

    fbEvent.viewContent({
      content_ids:      [String(product.id)],
      content_name:     product.title ?? '',
      value:            Number(product.final_price ?? product.price ?? 0),
      content_type:     'product',
      content_category: product.categories?.name ?? undefined,
    });

    // ── Trending: log page view ─────────────────────────────────────────
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/tracking/stats',
        JSON.stringify({ product_id: product.id, event: 'view' })
      );
    }
  }, [product.id, product.title, product.final_price, product.price, product.categories?.name]);

  const hasDiscount     = product.discount != null && product.discount > 0;
  const discountedPrice = hasDiscount && product.price != null
    ? Math.round(product.price * (1 - product.discount! / 100))
    : null;

  const isOutOfStock = product.is_active === false || ((product.stock ?? 0) <= 0 && product.allow_unlimited_stock !== true);
  const inStockBool = !isOutOfStock;

  // Parse features (newline-separated)
  const featuresList = product.features
    ? product.features.split('\n').map(f => f.trim()).filter(Boolean)
    : [];

  // Parse specs
  const specEntries = product.specs ? Object.entries(product.specs) : [];

  // Colors — support multiple selections for bundles
  const [selectedColors, setSelectedColors] = useState<(ColorOption | null)[]>([]);
  const [qty, setQty] = useState(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hasShake, setHasShake] = useState(false);

  // Initialize/resize selectedColors when qty changes
  useEffect(() => {
    setSelectedColors(prev => {
      const next = [...prev];
      if (next.length > qty) return next.slice(0, qty);
      while (next.length < qty) next.push(null);
      return next;
    });
  }, [qty]);

  // For the gallery, we'll track the last selected color to know which image to show
  const [lastSelectedColor, setLastSelectedColor] = useState<ColorOption | null>(null);

  const parseColorOptions = (options: any): ColorOption[] => {
    if (!options) return [];
    if (typeof options === 'string') {
      try {
        return JSON.parse(options);
      } catch (e) {
        return [];
      }
    }
    return Array.isArray(options) ? options : [];
  };

  const safeColorOptions = parseColorOptions(product.color_options);

  // Build one flat list: primary → all color images → extra gallery
  const allImages: string[] = [
    ...(product.image_url ? [product.image_url] : []),
    ...safeColorOptions.flatMap(co => [
      ...(co.image_url ? [co.image_url] : []),
      ...(co.image_url2 ? [co.image_url2] : []),
    ]),
    ...gallery.map(g => g.image_url),
  ];

  // Map color id → index of its first image in allImages (for jumping on swatch click)
  const colorImageIndex: Record<string, number> = {};
  let imgIdx = product.image_url ? 1 : 0;
  for (const co of safeColorOptions) {
    if (co.image_url) { colorImageIndex[co.id] = imgIdx; imgIdx++; }
    if (co.image_url2) imgIdx++;
  }

  const [activeIdx, setActiveIdx] = useState(0);
  const [isPaused,  setIsPaused]  = useState(false);
  const [autoPlayStopped, setAutoPlayStopped] = useState(false);
  const [isZoomed,  setIsZoomed]  = useState(false);
  const imageWrapRef = useRef<HTMLDivElement>(null);
  const activeImage  = allImages[activeIdx] ?? null;

  // Auto-slideshow
  useEffect(() => {
    if (allImages.length <= 1 || isPaused || autoPlayStopped) return;
    const id = setInterval(() => {
      setActiveIdx(prev => (prev + 1) % allImages.length);
    }, SLIDE_INTERVAL);
    return () => clearInterval(id);
  }, [allImages.length, isPaused, autoPlayStopped]);

  // Cursor-point zoom
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = imageWrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--zoom-x', `${((e.clientX - rect.left) / rect.width)  * 100}%`);
    el.style.setProperty('--zoom-y', `${((e.clientY - rect.top)  / rect.height) * 100}%`);
  }, []);

  const handleMouseEnter = () => { setIsZoomed(true);  setIsPaused(true);  };
  const handleMouseLeave = () => {
    setIsZoomed(false); setIsPaused(false);
    imageWrapRef.current?.style.setProperty('--zoom-x', '50%');
    imageWrapRef.current?.style.setProperty('--zoom-y', '50%');
  };

  const handleThumbClick = (idx: number) => {
    setActiveIdx(idx);
    setAutoPlayStopped(true);

    const clickedSrc = allImages[idx];
    if (clickedSrc && safeColorOptions.length > 0) {
      const matchedColor = safeColorOptions.find(
        co => co.image_url === clickedSrc || co.image_url2 === clickedSrc
      );
      if (matchedColor && selectedColors[0]?.id !== matchedColor.id) {
        if (qty === 1) {
          setSelectedColors([matchedColor]);
          setLastSelectedColor(matchedColor);
        }
      }
    }
  };

  const validateColors = (): boolean => {
    if (safeColorOptions.length > 0) {
      const hasMissingColor = selectedColors.some(c => c === null);
      if (hasMissingColor || selectedColors.length === 0) {
        setToastMessage('{t('product.chooseColor')} une couleur pour continuer');
        setHasShake(true);
        setTimeout(() => setHasShake(false), 500);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return false;
      }
    }
    return true;
  };

  const handleAddToCart = () => {
    if (!validateColors()) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    selectedColors.forEach(color => {
      addItem(product, color ?? undefined);
    });
    fbEvent.addToCart({
      content_ids:  [String(product.id)],
      content_name: product.title ?? '',
      value:        Number((discountedPrice ?? product.final_price ?? product.price ?? 0) * qty),
      content_type: 'product',
    });
    // ── Trending: log add-to-cart ─────────────────────────────────────
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/tracking/stats',
        JSON.stringify({ product_id: product.id, event: 'cart' })
      );
    }
    setQty(1);
  };

  // Direct checkout: add to cart then jump straight to checkout form
  const handleBuyNow = () => {
    if (!validateColors()) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    selectedColors.forEach(color => {
      addItem(product, color ?? undefined);
    });
    fbEvent.addToCart({
      content_ids:  [String(product.id)],
      content_name: product.title ?? '',
      value:        (discountedPrice ?? product.final_price ?? product.price ?? 0) * qty,
      content_type: 'product',
    });
    // ── Trending: log add-to-cart (Buy Now also counts as a cart event) ──
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/tracking/stats',
        JSON.stringify({ product_id: product.id, event: 'cart' })
      );
    }
    router.push('/cart?checkout=true');
  };

  const handleWishlist = () => {
    if (wishlisted) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
      fbEvent.addToWishlist({
        content_ids:  [String(product.id)],
        content_name: product.title ?? '',
        value:        Number(discountedPrice ?? product.final_price ?? product.price ?? 0),
      });
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* ── Back ── */}
        <Link href="/shop" className={styles.back}>
          <ArrowLeft size={14} /> {t('common.backToShop')}
        </Link>

        {toastMessage && (
          <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999 }}>
            <Toast message={toastMessage} type="error" onClose={() => setToastMessage(null)} />
          </div>
        )}

        {/* ══════════ MOBILE HEADER ══════════ */}
        <div className={styles.mobileHeader}>
          {product.badge && (
            <div className={styles.heroBadge}>{product.badge}</div>
          )}
          <div className={styles.metaRow}>
            {product.categories?.name && <span className={styles.category}>{product.categories.name}</span>}
            {product.gender && <span className={styles.genderPill}>{genderLabel[product.gender]}</span>}
          </div>
          <h1 className={styles.title}>{product.title ?? 'Sunglasses'}</h1>
          {product.rating != null && (
            <div className={styles.ratingRow}>
              <Stars rating={product.rating} />
              <span className={styles.ratingNum}>{Number(product.rating || 0).toFixed(1)}</span>
              {product.review_count != null && (
                <span className={styles.reviewCount}>({product.review_count.toLocaleString('fr-FR')} {t('product.reviews')})</span>
              )}
            </div>
          )}
        </div>

        {/* ══════════ HERO ══════════ */}
        <div className={styles.hero}>

          {/* LEFT — Gallery */}
          <div className={styles.imageSticky}>
            <div
              ref={imageWrapRef}
              className={`${styles.imageWrap} ${isZoomed ? styles.imageZoomed : ''}`}
              onMouseMove={handleMouseMove}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              style={{ '--zoom-x': '50%', '--zoom-y': '50%' } as React.CSSProperties}
            >
              {hasDiscount && (
                <div className={styles.discountBadge}>-{product.discount}%</div>
              )}
              {activeImage ? (
                <Image
                  key={activeImage}
                  src={activeImage}
                  alt={product.title ?? 'Sunglasses'}
                  fill
                  className={styles.image}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                  fetchPriority="high"
                />
              ) : (
                <div className={styles.placeholder}>NYVARA</div>
              )}
            </div>

            {/* Dots */}
            {allImages.length > 1 && (
              <div className={styles.dots}>
                {allImages.map((_, idx) => (
                  <button
                    key={idx}
                    className={`${styles.dot} ${idx === activeIdx ? styles.dotActive : ''}`}
                    onClick={() => handleThumbClick(idx)}
                    aria-label={`Photo ${idx + 1}`}
                  />
                ))}
              </div>
            )}

            {/* Thumbnails */}
            {allImages.length > 1 && (
              <div className={styles.thumbnails}>
                {allImages.map((src, idx) => (
                  <button
                    key={src + idx}
                    className={`${styles.thumb} ${idx === activeIdx ? styles.thumbActive : ''}`}
                    onClick={() => handleThumbClick(idx)}
                    aria-label={`Photo ${idx + 1}`}
                  >
                    <Image src={src} alt={`Vue ${idx + 1}`} fill className={styles.thumbImg} sizes="80px" loading="lazy" />
                  </button>
                ))}
              </div>
            )}

            {/* Color Selector — Mobile Only */}
            {qty === 1 && safeColorOptions.length > 0 && (
              <div className={`${styles.colorSelector} ${styles.mobileColorSelector}`}>
                <p className={styles.colorLabel} style={{ textAlign: 'center', marginBottom: '12px', fontSize: '15px' }}>{t('product.color')} <strong>{selectedColors[0]?.name || '{t('product.chooseColor')}'}</strong></p>
                <div className={`${styles.colorList} ${hasShake ? styles.shake : ''}`} style={{ justifyContent: 'center', position: 'relative' }}>
                  {hasShake && (
                    <div className={styles.colorTooltip}>
                      {t('product.chooseColor')} une couleur pour continuer
                    </div>
                  )}
                  {safeColorOptions.map(co => (
                    <button
                      key={co.id}
                      disabled={co.isAvailable === false}
                      className={`${styles.colorCircle} ${selectedColors[0]?.id === co.id ? styles.colorCircleActive : ''} ${co.isAvailable === false ? styles.colorDisabled : ''}`}
                      onClick={() => {
                        if (selectedColors[0]?.id === co.id) return;
                        const newColors = [co];
                        setSelectedColors(newColors);
                        setLastSelectedColor(co);
                        setActiveIdx(colorImageIndex[co.id] ?? 0);
                        setAutoPlayStopped(true);
                      }}
                      style={co.hex2 ? { background: `linear-gradient(135deg, ${co.hex1} 50%, ${co.hex2} 50%)`, width: '36px', height: '36px' } : { background: co.hex1, width: '36px', height: '36px' }}
                      title={co.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — Buy box */}
          <div className={styles.buyBox}>
            <div className={styles.desktopHeader}>
              {/* Badge + meta */}
              {product.badge && (
                <div className={styles.heroBadge}>{product.badge}</div>
              )}
              <div className={styles.metaRow}>
                {product.categories?.name && <span className={styles.category}>{product.categories.name}</span>}
                {product.gender && <span className={styles.genderPill}>{genderLabel[product.gender]}</span>}
              </div>

              {/* Title */}
              <h1 className={styles.title}>{product.title ?? 'Sunglasses'}</h1>

              {/* Rating */}
              {product.rating != null && (
                <div className={styles.ratingRow}>
                  <Stars rating={product.rating} />
                  <span className={styles.ratingNum}>{Number(product.rating || 0).toFixed(1)}</span>
                  {product.review_count != null && (
                    <span className={styles.reviewCount}>({product.review_count.toLocaleString('fr-FR')} {t('product.reviews')})</span>
                  )}
                </div>
              )}

              <hr className={styles.divider} />
            </div>

            {/* Price */}
            <div className={styles.priceBlock}>
              {hasDiscount ? (
                <div className={styles.priceRow}>
                  <span className={styles.price}>{formatTND(discountedPrice)}</span>
                  <span className={styles.originalPrice}>{formatTND(product.price)}</span>
                  <span className={styles.saveBadge}>{t('product.save')} {product.discount}%</span>
                </div>
              ) : (
                <span className={styles.priceNormal}>{formatTND(product.price)}</span>
              )}
            </div>

            <hr className={styles.divider} />

            {/* Stock */}
            <div className={inStockBool ? styles.inStock : styles.outOfStock}>
              {inStockBool ? <><CheckCircle2 size={16} /> {t('product.inStock')}</> : (product.is_active === false ? t('product.unavailable') : t('product.outOfStock'))}
            </div>

            {/* Feature bullets */}
            {featuresList.length > 0 && (
              <ul className={styles.featuresList}>
                {featuresList.map((f, i) => (
                  <li key={i} className={styles.featureItem}>
                    <CheckCircle2 size={15} className={styles.featureIcon} />
                    {f}
                  </li>
                ))}
              </ul>
            )}

            <hr className={styles.divider} />

            {/* Quantity Breaks (Offres de quantité) */}
            {product.quantity_breaks && product.quantity_breaks.length > 0 && inStockBool && (
              <div className={styles.qbreaksContainer}>
                <p className={styles.qbreaksTitle}>{t('product.specialOffers')}</p>
                <div className={styles.qbreaksList}>
                  {/* Option 1: Standard */}
                  <div 
                    className={`${styles.qbreakItem} ${qty === 1 ? styles.qbreakActive : ''}`}
                    onClick={() => setQty(1)}
                  >
                    <div className={styles.qbreakRadio}>
                      <div className={styles.qbreakRadioInner} />
                    </div>
                    <div className={styles.qbreakInfo}>
                      <span className={styles.qbreakQty}>1 {t('product.unit')}</span>
                      <span className={styles.qbreakPrice}>{formatTND(discountedPrice || product.price)}</span>
                    </div>
                    <span className={styles.qbreakLabel}>{t('product.standardPrice')}</span>
                  </div>

                  {/* Options: Breaks */}
                  {product.quantity_breaks.map((qb, idx) => (
                    <div 
                      key={idx}
                      className={`${styles.qbreakItem} ${qty === qb.min_qty ? styles.qbreakActive : ''}`}
                      onClick={() => setQty(qb.min_qty)}
                    >
                      <div className={styles.qbreakRadio}>
                        <div className={styles.qbreakRadioInner} />
                      </div>
                      <div className={styles.qbreakInfo}>
                        <span className={styles.qbreakQty}>{qb.min_qty} {t('product.units')}</span>
                        <span className={styles.qbreakTotal}>{formatTND(qb.total_price)}</span>
                        
                        {/* Multi-color selection INSIDE the card when active */}
                        {qty === qb.min_qty && safeColorOptions.length > 0 && (
                          <div className={styles.qbreakColors}>
                            {Array.from({ length: qb.min_qty }).map((_, uIdx) => (
                              <div key={uIdx} className={styles.qbreakColorRow}>
                                <span className={styles.qbreakColorLabel}>{t('product.pair')} {uIdx + 1} :</span>
                                <div className={styles.colorListSmall}>
                                  {safeColorOptions.map(co => (
                                    <button
                                      key={co.id}
                                      type="button"
                                      disabled={co.isAvailable === false}
                                      className={`${styles.colorCircleSmall} ${selectedColors[uIdx]?.id === co.id ? styles.colorCircleSmallActive : ''} ${co.isAvailable === false ? styles.colorDisabled : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (selectedColors[uIdx]?.id === co.id) return;
                                        const newColors = [...selectedColors];
                                        newColors[uIdx] = co;
                                        setSelectedColors(newColors);
                                        setLastSelectedColor(co);
                                        setActiveIdx(colorImageIndex[co.id] ?? 0);
                                        setAutoPlayStopped(true);
                                      }}
                                      style={co.hex2 ? { background: `linear-gradient(135deg, ${co.hex1} 50%, ${co.hex2} 50%)` } : { background: co.hex1 }}
                                      title={co.name}
                                    />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {qb.label && <span className={styles.qbreakPromoBadge}>{qb.label}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selection des couleurs après l'offre — Desktop Only */}
            {qty === 1 && safeColorOptions.length > 0 && (
              <div className={`${styles.colorSelector} ${styles.desktopColorSelector}`}>
                <p className={styles.colorLabel}>{t('product.color')} <strong>{selectedColors[0]?.name || '{t('product.chooseColor')}'}</strong></p>
                <div className={`${styles.colorList} ${hasShake ? styles.shake : ''}`} style={{ position: 'relative' }}>
                  {hasShake && (
                    <div className={styles.colorTooltip}>
                      {t('product.chooseColor')} une couleur pour continuer
                    </div>
                  )}
                  {safeColorOptions.map(co => (
                    <button
                      key={co.id}
                      disabled={co.isAvailable === false}
                      className={`${styles.colorCircle} ${selectedColors[0]?.id === co.id ? styles.colorCircleActive : ''} ${co.isAvailable === false ? styles.colorDisabled : ''}`}
                      onClick={() => {
                        if (selectedColors[0]?.id === co.id) return;
                        const newColors = [co];
                        setSelectedColors(newColors);
                        setLastSelectedColor(co);
                        setActiveIdx(colorImageIndex[co.id] ?? 0);
                        setAutoPlayStopped(true);
                      }}
                      style={co.hex2 ? { background: `linear-gradient(135deg, ${co.hex1} 50%, ${co.hex2} 50%)` } : { background: co.hex1 }}
                      title={co.name}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Quantity Selector (Show only if no breaks) */}
            {inStockBool && (!product.quantity_breaks || product.quantity_breaks.length === 0) && (
              <div className={styles.qtyRow}>
                <span className={styles.qtyLabel}>{t('product.qty')}</span>
                <div className={styles.qtyControl}>
                  <button className={styles.qtyBtn} onClick={() => setQty(q => Math.max(1, q - 1))}>
                    <Minus size={14} />
                  </button>
                  <span className={styles.qtyValue}>{qty}</span>
                  <button className={styles.qtyBtn} onClick={() => setQty(q => Math.min(product.stock ?? 99, q + 1))}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}

            <div className={styles.actions}>
              {/* Primary CTA — jump straight to checkout */}
              <button
                className={styles.buyNowBtn}
                onClick={handleBuyNow}
                disabled={!inStockBool}
              >
                {selectedColors[0] && (
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%',
                    background: selectedColors[0].hex2 ? `linear-gradient(135deg, ${selectedColors[0].hex1} 50%, ${selectedColors[0].hex2} 50%)` : selectedColors[0].hex1,
                    border: '2px solid rgba(255,255,255,0.4)',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.1)'
                  }} />
                )}
                <ShoppingBag size={18} />
                {t('product.buyNow')}
              </button>

              {/* Secondary — add to cart only */}
              <button
                className={`${styles.addBtn} ${inCart ? styles.addBtnIn : ''}`}
                onClick={handleAddToCart}
                disabled={!inStockBool}
              >
                {inCart ? 'Ajouté au panier ✓' : '{t('product.addToCart')}'}
              </button>

              <button
                className={`${styles.wishBtn} ${wishlisted ? styles.wishBtnActive : ''}`}
                onClick={handleWishlist}
              >
                <Heart size={16} fill={wishlisted ? 'currentColor' : 'none'} />
                {wishlisted ? 'Retiré des favoris' : 'Ajouter aux favoris'}
              </button>
            </div>

            {/* Trust badges */}
            <div className={styles.trustRow}>
              <div className={styles.trustItem}>
                <Truck size={16} className={styles.trustIcon} />
                <div>
                  <p className={styles.trustTitle}>{t('product.freeDelivery')}</p>
                  <p className={styles.trustSub}>{t('product.allTunisia')}</p>
                </div>
              </div>
              <div className={styles.trustItem}>
                <RotateCcw size={16} className={styles.trustIcon} />
                <div>
                  <p className={styles.trustTitle}>{t('product.returns')}</p>
                  <p className={styles.trustSub}>{t('product.satisfaction')}</p>
                </div>
              </div>
              <div className={styles.trustItem}>
                <ShieldCheck size={16} className={styles.trustIcon} />
                <div>
                  <p className={styles.trustTitle}>{t('product.securePayment')}</p>
                  <p className={styles.trustSub}>{t('product.homeDelivery')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════ PRODUCT HIGHLIGHTS STRIP ══════════ */}
        <div className={styles.highlightStrip}>
          <div className={styles.highlightItem}>
            <div className={styles.highlightIcon}><Sun size={22} /></div>
            <p className={styles.highlightLabel}>{t('product.uv400')}</p>
          </div>
          <div className={styles.highlightItem}>
            <div className={styles.highlightIcon}><Eye size={22} /></div>
            <p className={styles.highlightLabel}>{t('product.polarized')}</p>
          </div>
          <div className={styles.highlightItem}>
            <div className={styles.highlightIcon}><Zap size={22} /></div>
            <p className={styles.highlightLabel}>{t('product.antiGlare')}</p>
          </div>
          <div className={styles.highlightItem}>
            <div className={styles.highlightIcon}><ShieldCheck size={22} /></div>
            <p className={styles.highlightLabel}>{t('product.antiScratch')}</p>
          </div>
          <div className={styles.highlightItem}>
            <div className={styles.highlightIcon}><Truck size={22} /></div>
            <p className={styles.highlightLabel}>{t('product.freeDelivery')}</p>
          </div>
        </div>

        {/* ══════════ DESCRIPTION + SPECS ══════════ */}
        {(product.description || specEntries.length > 0) && (
          <div className={styles.detailsSection}>
            {product.description && (
              <div className={styles.descCard}>
                <h2 className={styles.sectionTitle}>{t('product.descriptionTitle')}</h2>
                <p className={styles.descText}>{product.description}</p>
              </div>
            )}
            {specEntries.length > 0 && (
              <div className={styles.specsCard}>
                <h2 className={styles.sectionTitle}>{t('product.specsTitle')}</h2>
                <table className={styles.specsTable}>
                  <tbody>
                    {specEntries.map(([key, val]) => (
                      <tr key={key} className={styles.specRow}>
                        <td className={styles.specKey}>{key}</td>
                        <td className={styles.specVal}>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══════════ RELATED PRODUCTS ══════════ */}
        {related.length > 0 && (
          <div className={styles.relatedSection}>
            <h2 className={styles.sectionTitle}>{t('product.relatedTitle')}</h2>
            <div className={styles.relatedGrid}>
              {related.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}

        {/* ══════════ MOBILE STICKY BOTTOM CTA ══════════ */}
        {/* Hidden on desktop (CSS), replaces actions on mobile */}
        <div className={styles.mobileCta}>
          <div className={styles.mobilePriceBlock}>
            <span className={styles.mobilePriceLabel}>Prix</span>
            {hasDiscount ? (
              <>
                <span className={styles.mobilePriceVal}>{formatTND(discountedPrice)}</span>
                <span className={styles.mobileOrigPrice}>{formatTND(product.price)}</span>
              </>
            ) : (
              <span className={styles.mobilePriceValNormal}>{formatTND(product.price)}</span>
            )}
          </div>
          <button
            className={styles.mobileBuyBtn}
            onClick={handleBuyNow}
            disabled={!inStockBool}
          >
            {selectedColors[0] && (
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                background: selectedColors[0].hex2 ? `linear-gradient(135deg, ${selectedColors[0].hex1} 50%, ${selectedColors[0].hex2} 50%)` : selectedColors[0].hex1,
                border: '1px solid rgba(255,255,255,0.4)',
                marginRight: '2px'
              }} />
            )}
            <ShoppingBag size={16} />
            {inStockBool ? '{t('product.buyNow')}' : 'Rupture de stock'}
          </button>
        </div>

      </div>
    </div>
  );
}
