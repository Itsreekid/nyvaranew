'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { FACE_SHAPES, FRAME_SIZES, STYLE_VIBES } from '@/components/layout/FindYourFit';
import { parseMorphologyQuiz, type MorphologyQuiz } from '@/lib/morphology-quiz';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import FilterSidebar from '@/components/shop/FilterSidebar';
import ProductSkeleton from '@/components/shop/ProductSkeleton';
import SortBar       from '@/components/shop/SortBar';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useOrders';
import { useLanguage } from '@/context/LanguageContext';
import { getTranslation } from '@/locales/dictionary';
import type { ProductFilters, SortOption } from '@/types';
import styles from './shop.module.css';

const ProductGrid = dynamic(() => import('@/components/shop/ProductGrid'), {
  loading: () => (
    <div className={styles.gridSkeleton}>
      {[1, 2, 3, 4, 5, 6].map(i => <ProductSkeleton key={i} />)}
    </div>
  ),
  ssr: true,
});

function ShopContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { categories } = useCategories();
  const { language } = useLanguage();
  const t = (path: string) => getTranslation(language, path);

  const toSlug = (str: string) => str.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]+/g, '');

  const initialGender = (searchParams.get('gender') as ProductFilters['gender']) ?? 'all';
  const initialSearch = searchParams.get('search') ?? undefined;
  const initialMinPrice = searchParams.has('min_price') ? Number(searchParams.get('min_price')) : undefined;
  const initialMaxPrice = searchParams.has('max_price') ? Number(searchParams.get('max_price')) : undefined;
  const urlCategorySlug = searchParams.get('category');
  const initialSort = (searchParams.get('sort') as SortOption) ?? 'newest';
  const initialFrameShape = searchParams.get('frame_shape') ?? undefined;

  const [filters, setFilters] = useState<ProductFilters & { page?: number; pageSize?: number }>({
    gender: initialGender,
    search: initialSearch,
    min_price: initialMinPrice,
    max_price: initialMaxPrice,
    frame_shape: initialFrameShape,
    page: 0,
    pageSize: 20,
  });
  const [sort, setSort] = useState<SortOption>(initialSort);

  useEffect(() => {
    if (urlCategorySlug && categories.length > 0 && !filters.category_id) {
      const matched = categories.find(c => (c.name && toSlug(c.name) === urlCategorySlug) || c.id === urlCategorySlug);
      if (matched) {
        setFilters(f => ({ ...f, category_id: matched.id, page: 0 }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, urlCategorySlug]);

  const { products, loading, error, totalCount } = useProducts(filters, sort, true);

  const updateFilters = (newFilters: ProductFilters & { page?: number; pageSize?: number }) => {
    setFilters(newFilters);
    const params = new URLSearchParams(searchParams.toString());
    
    if (newFilters.gender && newFilters.gender !== 'all') params.set('gender', newFilters.gender);
    else params.delete('gender');
    
    if (newFilters.search) params.set('search', newFilters.search);
    else params.delete('search');

    if (newFilters.min_price !== undefined) params.set('min_price', String(newFilters.min_price));
    else params.delete('min_price');
    
    if (newFilters.max_price !== undefined) params.set('max_price', String(newFilters.max_price));
    else params.delete('max_price');

    if (newFilters.category_id) {
       const matched = categories.find(c => c.id === newFilters.category_id);
       if (matched && matched.name) {
         params.set('category', toSlug(matched.name));
       } else {
         params.set('category', newFilters.category_id);
       }
    } else {
       params.delete('category');
    }

    if (newFilters.frame_shape) params.set('frame_shape', newFilters.frame_shape);
    else params.delete('frame_shape');

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const updateSort = (newSort: SortOption) => {
    setSort(newSort);
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', newSort);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleReset = useCallback(() => {
    updateFilters({ gender: 'all', page: 0, pageSize: 20 });
    updateSort('newest');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, pathname, categories, router]);

  const totalPages = Math.ceil((totalCount || 0) / (filters.pageSize || 20));

  const handlePageChange = (newPage: number) => {
    updateFilters({ ...filters, page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <p className={styles.eyebrow}>{t('shop.subtitle')}</p>
          <h1 className={styles.pageTitle}>{t('shop.title')}</h1>
          <p className={styles.pageSubtitle}>
            {t('shop.desc')}
          </p>
        </div>
      </div>

      {/* Content area */}
      <div className={styles.content}>
        {/* Mobile filter trigger rendered inside FilterSidebar */}
        <div className={styles.mobileFilterRow}>
          <FilterSidebar
            filters={filters}
            onChange={(newFilters) => updateFilters({ ...newFilters, page: 0, pageSize: 20 })}
            onReset={handleReset}
          />
        </div>

        <div className={styles.body}>
          {/* Desktop sidebar */}
          <aside className={styles.sidebar}>
            <FilterSidebar
              filters={filters}
              onChange={(newFilters) => updateFilters({ ...newFilters, page: 0, pageSize: 20 })}
              onReset={handleReset}
            />
          </aside>

          {/* Products */}
          <div className={styles.main}>
            <SortBar
              total={totalCount || products.length}
              sort={sort}
              onSortChange={updateSort}
            />
            <ProductGrid products={products} loading={loading} error={error} />
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button 
                  onClick={() => handlePageChange(Math.max(0, (filters.page || 0) - 1))}
                  disabled={(filters.page || 0) === 0}
                  className={styles.paginationBtn}
                >
                  ← {t('shop.prev')}
                </button>
                
                <div className={styles.paginationInfo}>
                  Page {(filters.page || 0) + 1} / {totalPages}
                </div>
                
                <button 
                  onClick={() => handlePageChange((filters.page || 0) + 1)}
                  disabled={(filters.page || 0) >= totalPages - 1}
                  className={styles.paginationBtn}
                >
                  {t('shop.next')} →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuizActions({ token }: { token?: string }) {
  const { language } = useLanguage();
  const openQuiz = (quiz?: string) => window.dispatchEvent(new CustomEvent('openQuizModal', { detail: { quiz } }));
  return (
    <nav className={styles.quizActions} aria-label={language === 'fr' ? 'Actions du quiz' : 'خيارات الاختبار'}>
      {token && <button type="button" className={styles.paginationBtn} onClick={() => openQuiz(token)}>
        {language === 'fr' ? 'Modifier mes réponses' : 'بدّل إجاباتك'}
      </button>}
      <button type="button" className={styles.paginationBtn} onClick={() => openQuiz()}>
        {language === 'fr' ? 'Recommencer le quiz' : 'عاود الاختبار'}
      </button>
      <Link className={styles.paginationBtn} href="/shop">
        {language === 'fr' ? 'Voir toute la boutique' : 'شوف المتجر الكل'}
      </Link>
    </nav>
  );
}

function QuizResults({ token, quiz }: { token: string; quiz: MorphologyQuiz }) {
  const { language } = useLanguage();
  const fr = language === 'fr';
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const { products, alternatives, strongCount, totalCount, loading, error } = useProducts(
    { page, pageSize }, undefined, true, token,
  );
  const totalPages = Math.ceil(totalCount / pageSize);
  const face = FACE_SHAPES.find(item => item.id === quiz.face)?.label[language];
  const style = STYLE_VIBES.find(item => item.id === quiz.style)?.label[language];
  const size = FRAME_SIZES.find(item => item.id === quiz.size)?.label[language];

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <h1 className={styles.pageTitle}>{fr ? 'Vos montures recommandées' : 'الإطارات اللي تناسبك'}</h1>
          <dl className={styles.quizPreferences}>
            <div><dt>{fr ? 'Forme du visage' : 'شكل الوجه'}</dt><dd>{face}</dd></div>
            <div><dt>{fr ? 'Style' : 'الستايل'}</dt><dd>{style}</dd></div>
            <div><dt>{fr ? 'Taille souhaitée' : 'الحجم المطلوب'}</dt><dd>{size}</dd></div>
          </dl>
          <QuizActions token={token} />
        </div>
      </header>
      <div className={styles.content}>
        {loading || error ? <ProductGrid products={[]} loading={loading} error={error} /> : (
          <>
            {strongCount === 0 && (
              <p className={styles.quizNotice} role="status">
                {totalCount === 0
                  ? (fr ? 'Aucune monture disponible ne correspond à vos réponses. Vous pouvez modifier vos réponses ou parcourir la boutique.' : 'ما فماش إطار متوفر يناسب إجاباتك. تنجم تبدّل إجاباتك أو تشوف المتجر.')
                  : (fr ? 'Aucune monture disponible ne correspond à tous vos critères. Voici des alternatives qui répondent à une partie de vos préférences.' : 'ما فماش إطار يطابق الشروط الكل. هاذم بدائل تناسب بعض اختياراتك.')}
              </p>
            )}
            {products.length > 0 && (
              <section className={styles.quizSection}>
                <h2>{fr ? 'Vos meilleures correspondances' : 'أحسن الاختيارات ليك'}</h2>
                <ProductGrid products={products} />
              </section>
            )}
            {alternatives.length > 0 && (
              <section className={styles.quizSection}>
                <h2>{fr ? 'Autres montures à découvrir' : 'إطارات أخرى تنجم تعجبك'}</h2>
                <ProductGrid products={alternatives} />
              </section>
            )}
            {totalPages > 1 && (
              <nav className={styles.pagination} aria-label="Pagination">
                <button type="button" className={styles.paginationBtn} disabled={page === 0} onClick={() => setPage(page - 1)}>
                  ← {getTranslation(language, 'shop.prev')}
                </button>
                <span className={styles.paginationInfo}>Page {page + 1} / {totalPages}</span>
                <button type="button" className={styles.paginationBtn} disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>
                  {getTranslation(language, 'shop.next')} →
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ShopView() {
  const params = useSearchParams();
  const { language } = useLanguage();
  const tokens = params.getAll('quiz');
  if (!tokens.length) return <ShopContent />;
  const quiz = tokens.length === 1 ? parseMorphologyQuiz(tokens[0]) : null;
  if (quiz) return <QuizResults key={tokens[0]} token={tokens[0]} quiz={quiz} />;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <h1 className={styles.pageTitle}>{language === 'fr' ? 'Vos montures recommandées' : 'الإطارات اللي تناسبك'}</h1>
          <p className={styles.pageSubtitle} role="alert">
            {language === 'fr' ? 'Les réponses du quiz sont manquantes ou invalides. Recommencez le quiz pour voir vos recommandations.' : 'إجابات الاختبار ناقصة أو غالطة. عاود الاختبار باش تشوف الاختيارات.'}
          </p>
          <QuizActions />
        </div>
      </header>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh' }} />}>
      <ShopView />
    </Suspense>
  );
}
