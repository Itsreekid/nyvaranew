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
import { getColorPhoto, getImageColors, getProductColors, getProductGallery, getPurchasableColor, isColorImageSoldOut, isProductOutOfStock } from '@/lib/product-availability';
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
  initialColorId?: string;
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

export default function ProductDetail({ product, gallery, related, initialColorId }: Props) {
  const router = useRouter();
  const { language } = useLanguage();
  const t = (path: string) => getTranslation(language, path);
  const { addItems, isInCart }                             = useCart();
  const { addToWishlist, removeFromWishlist, isWishlisted } = useWishlist();

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

  const safeColorOptions = getProductColors(product.color_options);
  const initialColor = safeColorOptions.find(color => color.id === initialColorId);
  const inStockBool = !isProductOutOfStock(product, safeColorOptions);
  const hasQuantityBreaks = Boolean(product.quantity_breaks?.length);

  // Parse features (newline-separated)
  const featuresList = product.features
    ? product.features.split('\n').map(f => f.trim()).filter(Boolean)
    : [];

  // Parse specs
  const specEntries = product.specs ? Object.entries(product.specs) : [];

  // Colors — support multiple selections for bundles
  const [selectedColors, setSelectedColors] = useState<(ColorOption | null)[]>([initialColor ?? null]);
  const [qty, setQty] = useState(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hasShake, setHasShake] = useState(false);
  const [adding, setAdding] = useState(false);

  // Initialize/resize selectedColors when qty changes
  useEffect(() => {
    setSelectedColors(prev => {
      const next = [...prev];
      const slots = hasQuantityBreaks ? qty : 1;
      if (next.length > slots) return next.slice(0, slots);
      while (next.length < slots) next.push(null);
      return next;
    });
  }, [qty, hasQuantityBreaks]);

  const mainImage = product.image_url || null;
  const allImages = getProductGallery(mainImage, safeColorOptions, gallery.map(image => image.image_url));
  const imageIndexForColor = (color: ColorOption) =>
    Math.max(0, allImages.indexOf(getColorPhoto(color, mainImage) ?? ''));

  const [activeIdx, setActiveIdx] = useState(() => initialColor ? imageIndexForColor(initialColor) : 0);
  const [isPaused, setIsPaused] = useState(false);
  const [autoPlayStopped, setAutoPlayStopped] = useState(Boolean(initialColor));
  const [isZoomed, setIsZoomed] = useState(false);
  const imageWrapRef = useRef<HTMLDivElement>(null);
  const activeImage = allImages[activeIdx] ?? null;
  const imageColors = getImageColors(activeImage, mainImage, safeColorOptions);
  const imageSoldOut = isColorImageSoldOut(imageColors);
  const availableColor = inStockBool ? safeColorOptions.find(color => color.isAvailable !== false) : undefined;
  const currentColors = selectedColors.map(selection =>
    safeColorOptions.find(color => color.id === selection?.id) ?? null
  );
  const selectedSoldOut = selectedColors.some((selection, index) =>
    selection !== null && (currentColors[index] === null || currentColors[index]?.isAvailable === false)
  );
  const canPurchase = inStockBool && !selectedSoldOut;
  const selectedColorNames = [...new Set(currentColors.flatMap(color => color ? [color.name] : []))];
  const inCart = isInCart(product.id, currentColors[0]?.id);
  const selectedStatus = currentColors.flatMap(color => color
    ? [`${color.name} — ${t(inStockBool && color.isAvailable !== false ? 'product.inStock' : 'product.outOfStock')}`]
    : []
  ).join(' · ');

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
  };

  const selectColor = (color: ColorOption, index = 0) => {
    if (adding) return;
    setSelectedColors(previous => previous.map((selection, slot) => slot === index ? color : selection));
    handleThumbClick(imageIndexForColor(color));
  };

  const validateColors = (): boolean => {
    if (!canPurchase) return false;
    if (safeColorOptions.length > 0) {
      if (currentColors.length !== (hasQuantityBreaks ? qty : 1)
        || currentColors.some(color => !getPurchasableColor(safeColorOptions, color?.id))) {
        setToastMessage(t('product.chooseColorError'));
        setHasShake(true);
        setTimeout(() => setHasShake(false), 500);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return false;
      }
    }
    return true;
  };

  const addSelectedColors = async () => {
    if (adding || !validateColors()) return false;
    const colors = Array.from({ length: qty }, (_, index) => currentColors[hasQuantityBreaks ? index : 0] ?? null);
    setAdding(true);
    const issue = await addItems(product, colors);
    setAdding(false);
    if (issue) {
      setToastMessage(t(issue === 'network' ? 'product.checkStockError' : 'product.outOfStock'));
      router.refresh();
      return false;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  };

  const handleAddToCart = async () => {
    if (!await addSelectedColors()) return;
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
  const handleBuyNow = async () => {
    if (!await addSelectedColors()) return;
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
                <>
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
                  {imageSoldOut && (
                    <div className={styles.outOfStockOverlay}>
                      {t('product.outOfStock')}
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.placeholder}>NYVARA</div>
              )}
            </div>

            {imageSoldOut && (
              <div className={styles.imageStockMessage} aria-live="polite">
                <span>{imageColors.length === 1
                  ? `${t('product.photoColor')} ${imageColors[0].name} — ${t('product.unavailable')}`
                  : t('product.outOfStock')}</span>
                {availableColor && (
                  <button type="button" onClick={() => selectColor(availableColor,
                    Math.max(0, currentColors.findIndex(color => color?.isAvailable === false))
                  )}>{t('product.viewColor')} {availableColor.name}</button>
                )}
              </div>
            )}

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
                {allImages.map((src, idx) => {
                  const outOfStock = isColorImageSoldOut(getImageColors(src, mainImage, safeColorOptions));
                  return (
                    <button
                      key={src + idx}
                      className={`${styles.thumb} ${idx === activeIdx ? styles.thumbActive : ''}`}
                      onClick={() => handleThumbClick(idx)}
                      aria-label={`Photo ${idx + 1}${outOfStock ? ` — ${t('product.soldOutPhoto')}` : ''}`}
                      aria-pressed={idx === activeIdx}
                    >
                      <Image src={src} alt="" fill className={styles.thumbImg} sizes="80px" loading="lazy" />
                      {outOfStock && <span className={styles.thumbStockLabel}>{t('product.soldOutPhoto')}</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Color Selector — Mobile Only */}
            {(!hasQuantityBreaks || qty === 1) && safeColorOptions.length > 0 && (
              <div className={`${styles.colorSelector} ${styles.mobileColorSelector}`}>
                <p className={styles.colorLabel} style={{ textAlign: 'center', marginBottom: '12px', fontSize: '15px' }}>{t('product.color')} <strong>{selectedColors[0]?.name || t('product.chooseColor')}</strong></p>
                <div className={`${styles.colorList} ${hasShake ? styles.shake : ''}`} style={{ justifyContent: 'center', position: 'relative' }}>
                  {hasShake && (
                    <div className={styles.colorTooltip}>
                      {t('product.chooseColorError')}
                    </div>
                  )}
                  {safeColorOptions.map(co => (
                    <button
                      key={co.id}
                      aria-label={`${co.name} — ${t(co.isAvailable === false ? 'product.outOfStock' : 'product.inStock')}`}
                      className={`${styles.colorCircle} ${selectedColors[0]?.id === co.id ? styles.colorCircleActive : ''} ${co.isAvailable === false ? styles.colorDisabled : ''}`}
                      onClick={() => selectColor(co)}
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
            {(!inStockBool || safeColorOptions.length === 0) && (
              <div className={inStockBool ? styles.inStock : styles.outOfStock}>
                {inStockBool ? <><CheckCircle2 size={16} /> {t('product.inStock')}</> : t('product.outOfStock')}
              </div>
            )}

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
                      onClick={() => { if (!adding) setQty(qb.min_qty); }}
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
                                      aria-label={`${co.name} — ${t(co.isAvailable === false ? 'product.outOfStock' : 'product.inStock')}`}
                                      className={`${styles.colorCircleSmall} ${selectedColors[uIdx]?.id === co.id ? styles.colorCircleSmallActive : ''} ${co.isAvailable === false ? styles.colorDisabled : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        selectColor(co, uIdx);
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
            {(!hasQuantityBreaks || qty === 1) && safeColorOptions.length > 0 && (
              <div className={`${styles.colorSelector} ${styles.desktopColorSelector}`}>
                <p className={styles.colorLabel}>{t('product.color')} <strong>{selectedColors[0]?.name || t('product.chooseColor')}</strong></p>
                <div className={`${styles.colorList} ${hasShake ? styles.shake : ''}`} style={{ position: 'relative' }}>
                  {hasShake && (
                    <div className={styles.colorTooltip}>
                      {t('product.chooseColorError')}
                    </div>
                  )}
                  {safeColorOptions.map(co => (
                    <button
                      key={co.id}
                      aria-label={`${co.name} — ${t(co.isAvailable === false ? 'product.outOfStock' : 'product.inStock')}`}
                      className={`${styles.colorCircle} ${selectedColors[0]?.id === co.id ? styles.colorCircleActive : ''} ${co.isAvailable === false ? styles.colorDisabled : ''}`}
                      onClick={() => selectColor(co)}
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
                  <button className={styles.qtyBtn} disabled={adding} onClick={() => setQty(q => Math.max(1, q - 1))}>
                    <Minus size={14} />
                  </button>
                  <span className={styles.qtyValue}>{qty}</span>
                  <button className={styles.qtyBtn} disabled={adding} onClick={() => setQty(q => product.allow_unlimited_stock ? q + 1 : Math.min(product.stock ?? 1, q + 1))}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}

            <div className={styles.actions}>
              {selectedStatus && (
                <p className={canPurchase ? styles.inStock : styles.outOfStock} aria-live="polite">
                  {t('product.color')} {selectedStatus}
                </p>
              )}
              {/* Primary CTA — jump straight to checkout */}
              <button
                className={styles.buyNowBtn}
                onClick={handleBuyNow}
                disabled={!canPurchase || adding}
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
                disabled={!canPurchase || adding}
              >
                {inCart ? t('product.addedToCart') : t('product.addToCart')}
              </button>

              <button
                className={`${styles.wishBtn} ${wishlisted ? styles.wishBtnActive : ''}`}
                onClick={handleWishlist}
              >
                <Heart size={16} fill={wishlisted ? 'currentColor' : 'none'} />
                {wishlisted ? t('product.removeFromWishlist') : t('product.addToWishlist')}
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
            {selectedColorNames.length > 0 && <span className={styles.mobileColorName}>{selectedColorNames.join(' · ')}</span>}
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
            disabled={!canPurchase || adding}
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
            {canPurchase ? t('product.buyNow') : t('product.outOfStock')}
          </button>
        </div>

      </div>
    </div>
  );
}
