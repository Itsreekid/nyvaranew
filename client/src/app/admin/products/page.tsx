'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import Image from 'next/image';
import { uploadImageToR2 } from '@/lib/r2-upload';
import type { Product, Category, ColorOption, QuantityBreak } from '@/types';
import Button from '@/components/ui/Button';
import Toggle from '@/components/ui/Toggle';
import dynamic from 'next/dynamic';
import { PlusCircle, Trash2, ImageIcon, Loader2, Edit2, Sparkles } from 'lucide-react';
const ImageUpload = dynamic(() => import('@/components/admin/ImageUpload'), { ssr: false });
const Modal = dynamic(() => import('@/components/ui/Modal'), { ssr: false });
import { deleteProductImageAction } from '../actions';
import { showAdminError } from '@/lib/admin-error';
import { showAdminSuccess } from '@/lib/admin-success';
import adminStyles from '../admin.module.css';
import styles from './products.module.css';

type GalleryPhase = 'idle' | 'compressing' | 'uploading';

type FormState = {
  title: string;
  price: string;
  cost_price: string;
  stock: string;
  discount: string;
  final_price: string;   // UI helper — auto-calculated, not saved
  description: string;
  image_url: string;
  gender: string;
  category_id: string;
  badge: string;
  features: string;
  rating: string;
  review_count: string;
  is_active: boolean;
  allow_unlimited_stock: boolean;
  frame_shape: string;
  style_vibe: string;
  optical_fit: string;
  ideal_faces: string[];
};

const emptyForm: FormState = {
  title: '', price: '', cost_price: '', stock: '0', discount: '', final_price: '',
  description: '', image_url: '', gender: 'unisex', category_id: '',
  badge: '', features: '', rating: '', review_count: '',
  is_active: true, allow_unlimited_stock: false,
  frame_shape: '', style_vibe: '', optical_fit: '', ideal_faces: [],
};

interface SpecRow { key: string; value: string; }

interface GalleryImage { id: string; image_url: string; sort_order: number; }

export default function AdminProductsPage() {
  // Safely parse JSONB fields that PostgreSQL drivers can return as strings
  const parseJsonArray = <T,>(val: unknown, fallback: T[] = []): T[] => {
    if (!val) return fallback;
    if (typeof val === 'string') {
      try { return JSON.parse(val) as T[]; } catch { return fallback; }
    }
    return Array.isArray(val) ? (val as T[]) : fallback;
  };

  const parseJsonObject = (val: unknown): Record<string, string> => {
    if (!val) return {};
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return {}; }
    }
    return typeof val === 'object' && !Array.isArray(val) ? (val as Record<string, string>) : {};
  };
  const [products, setProducts]     = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // AI Vision state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mainAiProgress, setMainAiProgress] = useState<number | null>(null);
  const [analyzingColorIndex, setAnalyzingColorIndex] = useState<number | null>(null);
  const [variantAiProgress, setVariantAiProgress] = useState<number | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
  const [aiError, setAiError] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 350);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setPage(0);
  };

  // Modal
  const [modalOpen, setModalOpen]         = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData]           = useState<FormState>(emptyForm);
  const [specRows, setSpecRows]           = useState<SpecRow[]>([]);

  // Gallery
  const [galleryImages, setGalleryImages]   = useState<GalleryImage[]>([]);
  const [galleryPhase, setGalleryPhase]     = useState<GalleryPhase>('idle');
  const [galleryError, setGalleryError]     = useState('');
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Colors
  const [colorOptions, setColorOptions] = useState<ColorOption[]>([]);
  // Quantity Breaks
  const [quantityBreaks, setQuantityBreaks] = useState<QuantityBreak[]>([]);

  const fetchAll = useCallback(() => {
    setLoading(true);
    const ts = Date.now();
    const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';
    Promise.all([
      fetch(`/api/products?sort=newest&page=${page}&pageSize=${pageSize}${searchParam}&_t=${ts}`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/categories?_t=${ts}`, { cache: 'no-store' }).then(r => r.json()),
    ]).then(([prodsJson, catsJson]) => {
      if (prodsJson.data) setProducts(prodsJson.data as Product[]);
      if (prodsJson.count !== undefined) setTotalCount(prodsJson.count);
      if (catsJson.data)  setCategories(catsJson.data as Category[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData(emptyForm);
    setGalleryImages([]);
    setSpecRows([]);
    setColorOptions([]);
    setQuantityBreaks([]);
    setAiSuggestions([]);
    setAiFilledFields(new Set());
    setAiError(null);
    setIsAnalyzing(false);
    setMainAiProgress(null);
    setVariantAiProgress(null);
    setModalOpen(true);
  };

  const openEditModal = async (p: Product) => {
    setEditingProduct(p);
    setFormData({
      title:        p.title        ?? '',
      price:        p.price        != null ? String(p.price)       : '',
      cost_price:   p.cost_price   != null ? String(p.cost_price)  : '',
      stock:        p.stock        != null ? String(p.stock)       : '0',
      discount:     p.discount     != null ? String(p.discount)    : '',
      final_price:  p.price != null && p.discount != null && p.discount > 0
        ? String(Math.round(p.price * (1 - p.discount / 100)))
        : '',
      description:  p.description  ?? '',
      image_url:    p.image_url    ?? '',
      gender:       p.gender       ?? 'unisex',
      category_id:  p.category_id  ?? '',
      badge:        p.badge        ?? '',
      features:     p.features     ?? '',
      rating:       p.rating       != null ? String(p.rating)      : '',
      review_count: p.review_count != null ? String(p.review_count): '',
      is_active:    p.is_active ?? true,
      allow_unlimited_stock: p.allow_unlimited_stock ?? false,
      frame_shape:  (p as any).frame_shape  ?? '',
      style_vibe:   (p as any).style_vibe   ?? '',
      optical_fit:  (p as any).optical_fit  ?? '',
      ideal_faces:  parseJsonArray<string>((p as any).ideal_faces),
    });
    // Specs rows
    const specs = parseJsonObject(p.specs);
    setSpecRows(Object.entries(specs).map(([key, value]) => ({ key, value })));
    // Load gallery images for this product
    const galleryRes = await fetch(`/api/products/${p.id}/images`);
    const galleryJson = await galleryRes.json();
    setGalleryImages((galleryJson.data as GalleryImage[]) ?? []);
    setColorOptions(parseJsonArray<ColorOption>(p.color_options));
    setQuantityBreaks(parseJsonArray<QuantityBreak>(p.quantity_breaks));
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const specsObj = Object.fromEntries(
      specRows.filter(r => r.key.trim()).map(r => [r.key.trim(), r.value.trim()])
    );

    // Calculate discount percentage from original price and final price
    const price = parseFloat(formData.price) || 0;
    const finalPriceRaw = formData.final_price ? parseFloat(formData.final_price) : 0;
    const finalPrice = finalPriceRaw > 0 ? Math.round(finalPriceRaw) : 0;
    let discountPercentage = null;
    
    if (price > 0 && finalPrice > 0 && finalPrice < price) {
      // Calculate discount and store as integer
      discountPercentage = Math.round(((price - finalPrice) / price) * 100);
    }

    const payload = {
      title:        formData.title,
      price:        price,
      final_price:  finalPrice > 0 ? finalPrice : null,
      cost_price:   formData.cost_price   ? parseFloat(formData.cost_price)   : null,
      stock:        parseInt(formData.stock, 10) || 0,
      discount:     discountPercentage,
      description:  formData.description,
      image_url:    formData.image_url,
      gender:       formData.gender,
      category_id:  formData.category_id || null,
      badge:        formData.badge        || null,
      features:     formData.features     || null,
      rating:       formData.rating       ? parseFloat(formData.rating)       : null,
      review_count: formData.review_count ? parseInt(formData.review_count)   : null,
      specs:        Object.keys(specsObj).length > 0 ? specsObj : null,
      color_options: colorOptions.length > 0 ? colorOptions : null,
      quantity_breaks: quantityBreaks.length > 0 ? quantityBreaks : null,
      is_active:    formData.is_active,
      allow_unlimited_stock: formData.allow_unlimited_stock,
      frame_shape:  formData.frame_shape  || null,
      style_vibe:   formData.style_vibe   || null,
      optical_fit:  formData.optical_fit  || null,
      ideal_faces:  formData.ideal_faces && formData.ideal_faces.length > 0 ? formData.ideal_faces : null,
    };

    const res = editingProduct
      ? await fetch(`/api/products/${editingProduct.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const resJson = await res.json();
    const error = res.ok ? null : { message: resJson.error || 'Unknown error' };

    setSubmitting(false);
    if (!error) {
      setModalOpen(false);
      setFormData(emptyForm);
      setEditingProduct(null);
      fetchAll();
      showAdminSuccess('Produit enregistré avec succès !');
    } else {
      showAdminError(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce produit ?')) return;
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      showAdminError(`Impossible de supprimer ce produit : ${data.error || 'Erreur inconnue'}\n\nAstuce : Si le produit est lié à des commandes, désactivez-le (Statut: Inactif) au lieu de le supprimer.`);
      return;
    }
    fetchAll();
    showAdminSuccess('Produit supprimé avec succès !');
  };

  // ── Gallery upload — direct R2 upload ─────────────────────────────────────
  const handleGalleryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingProduct) return;

    try {
      setGalleryError('');
      setGalleryPhase('uploading');
      const publicUrl = await uploadImageToR2(file, 'gallery');
      const nextOrder = galleryImages.length;
      const imgRes = await fetch(`/api/products/${editingProduct.id}/images`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_url: publicUrl, sort_order: nextOrder }) });
      const imgJson = await imgRes.json();
      const img = imgJson.data;
      const dbErr = imgRes.ok ? null : { message: imgJson.error };
      if (dbErr) throw dbErr;
      setGalleryImages(prev => [...prev, img as GalleryImage]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setGalleryError(message);
    } finally {
      setGalleryPhase('idle');
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleGalleryDelete = async (id: string) => {
    const imgToDelete = galleryImages.find(img => img.id === id);
    
    // Call server action to bypass RLS
    const res = await deleteProductImageAction(id);
    if (res.error) {
      showAdminError('Erreur lors de la suppression en base de données: ' + res.error);
      return;
    }

    setGalleryImages(prev => prev.filter(img => img.id !== id));

    if (imgToDelete?.image_url) {
      try {
        await fetch('/api/delete-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: imgToDelete.image_url }),
        });
      } catch (err) {
        console.error('Failed to delete image from R2:', err);
      }
    }
  };

  const margin = (p: Product) => {
    if (p.cost_price == null) return null;
    // Use final_price if available (price after discount), otherwise use original price
    const sellingPrice = p.final_price ?? p.price;
    if (sellingPrice == null) return null;
    return sellingPrice - p.cost_price;
  };

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFormData(prev => ({ ...prev, [field]: e.target.value }));


  // AI Frame Analysis
  const handleAIFrameAnalysis = (file: File) => {
    setIsAnalyzing(true);
    setMainAiProgress(0);
    setAiSuggestions([]);
    setAiFilledFields(new Set());
    setAiError(null);

    const progressInterval = setInterval(() => {
      setMainAiProgress(p => p !== null && p < 99 ? p + 3 : p);
    }, 500);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawBase64 = ev.target?.result as string;
      if (!rawBase64) {
        clearInterval(progressInterval);
        setIsAnalyzing(false);
        setMainAiProgress(null);
        return;
      }

      const img = new window.Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        let width = img.width, height = img.height;
        if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { setIsAnalyzing(false); return; }
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);

        try {
          const res = await fetch('/api/analyze-glasses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: compressedBase64 }),
          });
          const json = await res.json();
          if (!json.success || !json.data) {
            setAiError(json.error || 'Analyse IA echouee. Reessayez.');
            clearInterval(progressInterval);
            setIsAnalyzing(false);
            setMainAiProgress(null);
            return;
          }

          const d = json.data;
          const filled = new Set<string>();

          setFormData(prev => {
            const next = { ...prev };
            if (d.name_suggestions?.[0]) { next.title = d.name_suggestions[0]; filled.add('title'); }
            if (d.price_original != null) { next.price = String(d.price_original); filled.add('price'); }
            if (d.price_discounted != null) { next.final_price = String(d.price_discounted); filled.add('final_price'); }
            if (d.cost_price != null) { next.cost_price = String(d.cost_price); filled.add('cost_price'); }
            if (d.stock_initial != null) { next.stock = String(d.stock_initial); filled.add('stock'); }
            if (d.gender && ['unisex', 'homme', 'femme'].includes(d.gender)) { next.gender = d.gender; filled.add('gender'); }
            if (d.promo_badge) { next.badge = d.promo_badge; filled.add('badge'); }
            if (d.rating_score != null) { next.rating = String(d.rating_score); filled.add('rating'); }
            if (d.rating_count != null) { next.review_count = String(d.rating_count); filled.add('review_count'); }
            if (d.highlights_bullets) { next.features = d.highlights_bullets; filled.add('features'); }
            if (d.full_description) { next.description = d.full_description; filled.add('description'); }
            if (d.frame_shape) { next.frame_shape = d.frame_shape; filled.add('frame_shape'); }
            if (d.style_vibe) { next.style_vibe = d.style_vibe; filled.add('style_vibe'); }
            if (d.optical_fit) { next.optical_fit = d.optical_fit; filled.add('optical_fit'); }
            if (Array.isArray(d.ideal_faces)) { next.ideal_faces = d.ideal_faces; filled.add('ideal_faces'); }
            return next;
          });

          if (Array.isArray(d.name_suggestions)) setAiSuggestions(d.name_suggestions);

          if (Array.isArray(d.technical_specs) && d.technical_specs.length > 0) {
            const validRows = d.technical_specs.filter((r: any) => r?.key && r?.value).map((r: any) => ({ key: r.key, value: r.value }));
            if (validRows.length > 0) { setSpecRows(validRows); filled.add('specs'); }
          }

          if (d.color_analysis) {
            setColorOptions([{
              id: 'temp-ai-' + Date.now(),
              name: d.color_analysis.variant_name || 'Couleur 1',
              hex1: d.color_analysis.primary_hex || '#000000',
              hex2: d.color_analysis.secondary_hex || null,
              image_url: '',
              isAvailable: true,
            }]);
            filled.add('color_options');
          }

          // Auto-select category based on product_type
          if (d.product_type) {
            setCategories(prev => {
              const match = d.product_type === 'lunettes_vue'
                ? prev.find(c => c.name?.toLowerCase().includes('vue'))
                : prev.find(c => c.name?.toLowerCase().includes('solaire'));
              if (match) setFormData(f => ({ ...f, category_id: match.id }));
              return prev;
            });
          }

          setAiFilledFields(filled);
        } catch (err) {
          setAiError('Erreur reseau lors de l\'analyse IA.');
          console.warn('[AI Frame Analysis] Silent fail:', err);
        } finally {
          clearInterval(progressInterval);
          setMainAiProgress(100);
          setTimeout(() => { setIsAnalyzing(false); setMainAiProgress(null); }, 800);
        }
      };
      img.src = rawBase64;
    };
    reader.readAsDataURL(file);
  };

  // AI Color Variant Analysis
  const handleVariantImageAI = (file: File, variantIndex: number) => {
    setAnalyzingColorIndex(variantIndex);
    setVariantAiProgress(0);
    const progressInterval = setInterval(() => {
      setVariantAiProgress(p => p !== null && p < 99 ? p + 3 : p);
    }, 500);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawBase64 = ev.target?.result as string;
      if (!rawBase64) { clearInterval(progressInterval); setAnalyzingColorIndex(null); setVariantAiProgress(null); return; }
      const img = new window.Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        let width = img.width, height = img.height;
        if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { setAnalyzingColorIndex(null); return; }
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        try {
          const res = await fetch('/api/analyze-glasses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: compressedBase64 }) });
          const json = await res.json();
          if (!json.success || !json.data?.color_analysis) { clearInterval(progressInterval); setAnalyzingColorIndex(null); setVariantAiProgress(null); return; }
          const ca = json.data.color_analysis;
          setColorOptions(prev => {
            const updated = [...prev];
            if (updated[variantIndex]) {
              updated[variantIndex] = { ...updated[variantIndex], name: ca.variant_name || updated[variantIndex].name, hex1: ca.primary_hex || updated[variantIndex].hex1, hex2: ca.secondary_hex !== undefined ? ca.secondary_hex : updated[variantIndex].hex2 };
            }
            return updated;
          });
        } catch (err) { console.warn('[AI Color Analysis] Silent fail:', err); }
        finally { clearInterval(progressInterval); setVariantAiProgress(100); setTimeout(() => { setAnalyzingColorIndex(null); setVariantAiProgress(null); }, 800); }
      };
      img.src = rawBase64;
    };
    reader.readAsDataURL(file);
  };

  // AiBadge helper
  const AiBadge = ({ field }: { field: string }) =>
    aiFilledFields.has(field)
      ? <span title="Rempli automatiquement par l'IA" style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '10px', color: '#7c5cfc', fontWeight: 600, background: '#ede9fe', borderRadius: '4px', padding: '1px 6px', marginLeft: '6px', verticalAlign: 'middle' }}>
          <Sparkles size={10} /> IA
        </span>
      : null;
  if (loading && products.length === 0) return <div className={adminStyles.contentArea}>Chargement...</div>;

  return (
    <div className="space-y-6">
      {/* Mobile: title+button row, then search below. Desktop: single row */}
      <div className="flex flex-col gap-3">
        {/* Row 1: Title + Button */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Produits</h1>
          <Button variant="primary" onClick={openAddModal}>+ Ajouter un produit</Button>
        </div>

        {/* Row 2 on mobile (hidden on sm+), inline on sm+ */}
        <div className="relative sm:hidden">
          <Search
            size={16}
            style={{
              position: 'absolute', left: '10px', top: '50%',
              transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none',
            }}
          />
          <input
            id="admin-product-search-mobile"
            type="text"
            placeholder="Rechercher un produit…"
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            style={{
              paddingLeft: '34px',
              paddingRight: searchQuery ? '34px' : '12px',
              paddingTop: '8px',
              paddingBottom: '8px',
              fontSize: '14px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              outline: 'none',
              width: '100%',
              backgroundColor: '#fff',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-gold, #b8860b)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(184,134,11,0.12)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              style={{
                position: 'absolute', right: '8px', top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#6b7280', display: 'flex', alignItems: 'center',
              }}
              title="Effacer la recherche"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Desktop: title + search + button in one row */}
        <div className="hidden sm:flex items-center gap-3">
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={16}
              style={{
                position: 'absolute', left: '10px', top: '50%',
                transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none',
              }}
            />
            <input
              id="admin-product-search"
              type="text"
              placeholder="Rechercher un produit…"
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              style={{
                paddingLeft: '34px',
                paddingRight: searchQuery ? '34px' : '12px',
                paddingTop: '8px',
                paddingBottom: '8px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                outline: 'none',
                width: '100%',
                minWidth: '220px',
                backgroundColor: '#fff',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-gold, #b8860b)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(184,134,11,0.12)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                style={{
                  position: 'absolute', right: '8px', top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#6b7280', display: 'flex', alignItems: 'center',
                }}
                title="Effacer la recherche"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Desktop Table (hidden on mobile) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
              <tr>
                <th className="px-4 py-3">Image</th>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3 text-right">Prix vente</th>
                <th className="px-4 py-3 text-right">Prix achat</th>
                <th className="px-4 py-3 text-center">Remise</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map(p => {
                const m = margin(p);
                return (
                  <tr key={p.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-4 py-2">
                      <Image
                        src={p.image_url || '/placeholder.png'}
                        alt={p.title || 'Product'}
                        width={48}
                        height={48}
                        className="w-12 h-12 object-cover rounded-md border border-gray-200"
                        loading="lazy"
                      />
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-900">{p.title}</td>
                    <td className="px-4 py-2">
                      {p.stock != null && p.stock > 0
                        ? <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">{p.stock} en stock</span>
                        : <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">Rupture</span>}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">{Number(p.final_price ?? p.price ?? 0).toFixed(3)} TND</td>
                    <td className="px-4 py-2 text-right text-gray-500">
                      {p.cost_price != null
                        ? `${Number(p.cost_price).toFixed(3)} TND`
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {p.discount != null
                        ? <span className="inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-bold bg-nyvara-gold/10 text-nyvara-gold">-{Math.round(p.discount)}%</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <button className="p-1.5 text-nyvara-gold hover:bg-nyvara-gold/10 rounded-md transition-colors" onClick={() => openEditModal(p)} title="Éditer">
                          <Edit2 size={16} />
                        </button>
                        <button className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" onClick={() => handleDelete(p.id)} title="Supprimer">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  {debouncedSearch ? `Aucun produit trouvé pour « ${debouncedSearch} ».` : 'Aucun produit.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Stacked Cards (hidden on desktop) */}
        <div className="md:hidden divide-y divide-gray-100">
          {products.map(p => {
            const m = margin(p);
            return (
              <div key={p.id} className="p-4 space-y-4">
                <div className="flex gap-4">
                  <Image
                    src={p.image_url || '/placeholder.png'}
                    alt={p.title || 'Product'}
                    width={80}
                    height={80}
                    className="w-20 h-20 object-cover rounded-lg border border-gray-200 shrink-0"
                    unoptimized
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{p.title}</h3>
                    <p className="text-sm text-gray-500">{p.categories?.name ?? 'Sans catégorie'}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-medium text-gray-900">{Number(p.final_price ?? p.price ?? 0).toFixed(3)} TND</span>
                      {p.discount != null && (
                        <span className="text-xs font-bold bg-nyvara-gold/10 text-nyvara-gold px-1.5 py-0.5 rounded">-{Math.round(p.discount)}%</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <div className="flex gap-2">
                    {p.stock != null && p.stock > 0
                        ? <span className="px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700">{p.stock} en stock</span>
                        : <span className="px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700">Rupture</span>}
                  </div>
                  <div className="flex gap-2">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors" onClick={() => openEditModal(p)}>
                      <Edit2 size={14} /> Éditer
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {products.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              {debouncedSearch ? `Aucun produit trouvé pour « ${debouncedSearch} ».` : 'Aucun produit.'}
            </div>
          )}
        </div>

        {/* Pagination footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between sm:px-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 hidden sm:block">Lignes par page :</span>
            <select
              className="text-sm border-gray-300 rounded-md py-1 pl-2 pr-8 focus:ring-nyvara-gold focus:border-nyvara-gold"
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700">
              Page <span className="font-medium">{page + 1}</span>
            </span>
            <div className="flex gap-1">
              <button
                className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-transparent"
                onClick={() => setPage(p => p - 1)}
                disabled={page === 0}
              >
                &larr;
              </button>
              <button
                className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-transparent"
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * pageSize >= totalCount}
              >
                &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingProduct(null); }}
        title={editingProduct ? `Éditer — ${editingProduct.title}` : 'Ajouter un produit'}
      >
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label>Nom du produit <AiBadge field="title" /></label>
            <input required type="text" className={styles.input} value={formData.title} onChange={set('title')} />
            {aiSuggestions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {aiSuggestions.map((name, i) => (
                  <button key={i} type="button" onClick={() => setFormData(prev => ({ ...prev, title: name }))}
                    style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', border: formData.title === name ? '1.5px solid #7c5cfc' : '1.5px solid #e5e7eb', background: formData.title === name ? '#ede9fe' : '#f9fafb', color: formData.title === name ? '#5b21b6' : '#374151', fontWeight: formData.title === name ? 600 : 400, transition: 'all 0.15s' }}>
                    ✨ {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.priceRow}>
            <div className={styles.inputGroup}>
              <label>Prix original (TND)</label>
              <input required type="number" step="0.001" className={styles.input} value={formData.price} onChange={set('price')} placeholder="Ex: 89.900" />
            </div>
            <div className={styles.inputGroup}>
              <label>Prix après remise (TND)</label>
              <input
                type="number" step="0.001" className={styles.input}
                placeholder="Prix réduit"
                value={formData.final_price}
                onChange={set('final_price')}
                style={{ borderColor: formData.final_price ? 'var(--color-gold)' : undefined }}
              />
            </div>
          </div>

          <div className={styles.priceRow}>
            <div className={styles.inputGroup}>
              <label>Remise calculée (%)</label>
              <input type="number" step="0.01" className={styles.input} placeholder="Auto-calculée" value={formData.discount} disabled style={{ opacity: 0.7, cursor: 'not-allowed' }} />
            </div>
            <div className={styles.inputGroup}>
              <label>Prix d&apos;achat / coût (TND) 🔒</label>
              <input type="number" step="0.001" className={styles.input} placeholder="0.000" value={formData.cost_price} onChange={set('cost_price')} />
            </div>
          </div>

          <div className={styles.priceRow}>
            <div className={styles.inputGroup}>
              <label>Stock</label>
              <input type="number" step="1" className={styles.input} value={formData.stock} onChange={set('stock')} />
            </div>
            <div className={styles.inputGroup}>
              <label>Genre</label>
              <select className={styles.input} value={formData.gender} onChange={set('gender')}>
                <option value="unisex">Unisexe</option>
                <option value="homme">Homme</option>
                <option value="femme">Femme</option>
                <option value="enfant">Enfant</option>
              </select>
            </div>
            <div className={styles.inputGroup}>
              <label>Catégorie</label>
              <select className={styles.input} value={formData.category_id} onChange={set('category_id')}>
                <option value="">— Sans catégorie —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 mt-4 mb-4">
            <Toggle 
              label="Actif (visible sur le site)"
              checked={formData.is_active}
              onChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
            />
            <Toggle 
              label="Stock illimité (ignorer le compteur)"
              checked={formData.allow_unlimited_stock}
              onChange={(checked) => setFormData(prev => ({ ...prev, allow_unlimited_stock: checked }))}
            />
          </div>

          {/* Main image */}
          <div className={styles.inputGroup}>
            <label>Image principale</label>
            <ImageUpload
              value={formData.image_url}
              onChange={url => setFormData(prev => ({ ...prev, image_url: url }))}
              onUploading={status => setUploadingImage(status)}
              onFileSelected={handleAIFrameAnalysis}
            />
          </div>

          {/* AI Analyzing banner */}
          {isAnalyzing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '10px', background: 'linear-gradient(135deg, #ede9fe 0%, #faf5ff 100%)', border: '1px solid #c4b5fd', marginBottom: '4px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, background: 'rgba(124, 92, 252, 0.1)', width: ((mainAiProgress || 0) + '%'), transition: 'width 0.3s ease-out' }} />
              <Sparkles size={16} style={{ color: '#7c5cfc', flexShrink: 0, position: 'relative', zIndex: 1 }} />
              <span style={{ fontSize: '13px', color: '#5b21b6', fontWeight: 500, position: 'relative', zIndex: 1 }}>⚡ IA en cours d&apos;analyse de la monture…</span>
              <span style={{ color: '#7c5cfc', fontWeight: 700, marginLeft: 'auto', fontSize: '13px', position: 'relative', zIndex: 1 }}>{mainAiProgress}%</span>
            </div>
          )}

          {/* AI success banner */}
          {!isAnalyzing && aiFilledFields.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #86efac', fontSize: '12px', color: '#166534', marginBottom: '4px' }}>
              <Sparkles size={13} style={{ color: '#16a34a', flexShrink: 0 }} />
              <span><strong>Analyse IA terminee</strong> — champs remplis automatiquement. Verifiez et corrigez si necessaire.</span>
            </div>
          )}

          {/* AI error banner */}
          {aiError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fca5a5', fontSize: '12px', color: '#991b1b', marginBottom: '4px' }}>
              <span>⚠️ {aiError}</span>
              <button type="button" onClick={() => setAiError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontWeight: 700 }}>✕</button>
            </div>
          )}

          {/* Quiz IA — Style & Morphologie */}
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#334155', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} color="#7c5cfc" /> Style &amp; Morphologie (Quiz IA)
            </h4>
            <div className={styles.priceRow}>
              <div className={styles.inputGroup}>
                <label>Forme de monture <AiBadge field="frame_shape" /></label>
                <select className={styles.input} value={formData.frame_shape} onChange={set('frame_shape')}>
                  <option value="">— Selectionner —</option>
                  <option value="Rond Classique">Rond Classique</option>
                  <option value="Aviateur">Aviateur</option>
                  <option value="Oeil-de-chat">Oeil-de-chat</option>
                  <option value="Carree">Carree</option>
                  <option value="Rectangulaire">Rectangulaire</option>
                  <option value="Geometrique">Geometrique</option>
                </select>
              </div>
              <div className={styles.inputGroup}>
                <label>Style / Vibe <AiBadge field="style_vibe" /></label>
                <select className={styles.input} value={formData.style_vibe} onChange={set('style_vibe')}>
                  <option value="">— Selectionner —</option>
                  <option value="Retro">Retro</option>
                  <option value="Minimaliste">Minimaliste</option>
                  <option value="Audacieux">Audacieux</option>
                  <option value="Chic">Chic</option>
                  <option value="Sport">Sport</option>
                </select>
              </div>
              <div className={styles.inputGroup}>
                <label>Taille / Coupe <AiBadge field="optical_fit" /></label>
                <select className={styles.input} value={formData.optical_fit} onChange={set('optical_fit')}>
                  <option value="">— Selectionner —</option>
                  <option value="Petit / Etroit">Petit / Etroit</option>
                  <option value="Moyen / Standard">Moyen / Standard</option>
                  <option value="Large">Large</option>
                </select>
              </div>
            </div>
            <div className={styles.inputGroup} style={{ marginTop: '12px' }}>
              <label>Visages recommandes <AiBadge field="ideal_faces" /></label>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {['Rond', 'Oval', 'Carre', 'Coeur'].map(face => {
                  const isChecked = formData.ideal_faces.some(f => f.toLowerCase() === face.toLowerCase() || (face === 'Oval' && f.toLowerCase() === 'ovale') || (face === 'Coeur' && f.toLowerCase() === 'coeur'));
                  return (
                    <label key={face} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={isChecked} onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData(prev => {
                          let newFaces = prev.ideal_faces.filter(f => f.toLowerCase() !== face.toLowerCase() && !(face === 'Oval' && f.toLowerCase() === 'ovale') && !(face === 'Coeur' && f.toLowerCase() === 'coeur'));
                          if (checked) newFaces.push(face);
                          return { ...prev, ideal_faces: newFaces };
                        });
                      }} style={{ accentColor: '#7c5cfc', width: '16px', height: '16px' }} />
                      {face}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          

          {/* Badge */}
          <div className={styles.priceRow}>
            <div className={styles.inputGroup}>
              <label>Badge promo (ex: #1 Meilleure vente)</label>
              <input type="text" className={styles.input} placeholder="Ex: #1 Meilleure vente" value={formData.badge} onChange={set('badge')} />
            </div>
            <div className={styles.inputGroup}>
              <label>Note (1–5)</label>
              <input type="number" step="0.1" min="1" max="5" className={styles.input} placeholder="4.5" value={formData.rating} onChange={set('rating')} />
            </div>
            <div className={styles.inputGroup}>
              <label>Nombre d&apos;avis</label>
              <input type="number" step="1" className={styles.input} placeholder="2875" value={formData.review_count} onChange={set('review_count')} />
            </div>
          </div>

          {/* Features */}
          <div className={styles.inputGroup}>
            <label>Points forts (une ligne = un bullet) <AiBadge field="features" /></label>
            <textarea
              className={styles.input}
              rows={4}
              placeholder={`Protection UV400\nLentilles polarisées HD\nMonture légère TR90`}
              value={formData.features}
              onChange={set('features')}
            />
          </div>

          {/* Specs */}
          <div className={styles.inputGroup}>
            <label>Caractéristiques techniques</label>
            <div className={styles.specEditor}>
              {specRows.map((row, i) => (
                <div key={i} className={styles.specEditorRow}>
                  <input
                    className={styles.input}
                    placeholder="Ex: Matière"
                    value={row.key}
                    onChange={e => setSpecRows(prev => prev.map((r, idx) => idx === i ? { ...r, key: e.target.value } : r))}
                  />
                  <input
                    className={styles.input}
                    placeholder="Ex: TR90"
                    value={row.value}
                    onChange={e => setSpecRows(prev => prev.map((r, idx) => idx === i ? { ...r, value: e.target.value } : r))}
                  />
                  <button type="button" className={styles.specDelBtn} onClick={() => setSpecRows(prev => prev.filter((_, idx) => idx !== i))}>✕</button>
                </div>
              ))}
              <button
                type="button"
                className={styles.specAddBtn}
                onClick={() => setSpecRows(prev => [...prev, { key: '', value: '' }])}
              >
                + Ajouter une caractéristique
              </button>
            </div>
          </div>

          {/* Color Options */}
          <div className={styles.inputGroup}>
            <label>Variantes de couleurs (Optionnel)</label>
            <div className={styles.colorOptionsList}>
              {colorOptions.map((co, i) => (
                <div key={co.id} className={styles.colorOptionCard}>
                  <div className={styles.colorOptionImage}>
                    <p className={styles.pickerLabel} style={{ marginBottom: 4 }}>Image 1 <span style={{opacity:0.6}}>(vide = image principale)</span></p>
                    <ImageUpload
                      value={co.image_url}
                      onChange={url => setColorOptions(prev => prev.map((c, idx) => idx === i ? { ...c, image_url: url } : c))}
                      onUploading={status => setUploadingImage(status)}
                      onFileSelected={(file) => handleVariantImageAI(file, i)}
                      folder="colors"
                    />
                  </div>
                  <div className={styles.colorOptionImage}>
                    <p className={styles.pickerLabel} style={{ marginBottom: 4 }}>Image 2 (opt)</p>
                    <ImageUpload
                      value={co.image_url2 || ''}
                      onChange={url => setColorOptions(prev => prev.map((c, idx) => idx === i ? { ...c, image_url2: url || null } : c))}
                      onUploading={status => setUploadingImage(status)}
                      folder="colors"
                    />
                  </div>
                  <div className={styles.colorOptionDetails}>
                    {analyzingColorIndex === i && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#7c5cfc', fontSize: '0.85rem', fontWeight: 600, padding: '4px 0' }}>
                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analyse IA {variantAiProgress}%
                      </span>
                    )}
                    <input className={styles.input} placeholder="Nom (ex: Noir / Bleu)" value={co.name} onChange={e => setColorOptions(prev => prev.map((c, idx) => idx === i ? { ...c, name: e.target.value } : c))} />
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', marginBottom: '4px', fontSize: '0.9rem' }}>
                      <label className={styles.switch}>
                        <input
                          type="checkbox"
                          checked={co.isAvailable !== false}
                          onChange={(e) => setColorOptions(prev => prev.map((c, idx) => idx === i ? { ...c, isAvailable: e.target.checked } : c))}
                        />
                        <span className={`${styles.slider} ${styles.sliderStatus}`}></span>
                      </label>
                      <span style={{ color: co.isAvailable !== false ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 600 }}>
                        {co.isAvailable !== false ? 'Actif' : 'Inactif'}
                      </span>
                    </div>

                    <div className={styles.colorPickers}>
                      <div className={styles.pickerWrap}>
                        <label className={styles.pickerLabel}>Couleur 1</label>
                        <input type="color" value={co.hex1} onChange={e => setColorOptions(prev => prev.map((c, idx) => idx === i ? { ...c, hex1: e.target.value } : c))} title="Couleur Principale" className={styles.colorInput} />
                      </div>
                      <div className={styles.pickerWrap}>
                        <label className={styles.pickerLabel}>Couleur 2 (opt)</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <input type="color" value={co.hex2 || '#ffffff'} onChange={e => setColorOptions(prev => prev.map((c, idx) => idx === i ? { ...c, hex2: e.target.value } : c))} title="Couleur Secondaire (Optionnelle)" className={styles.colorInput} />
                          {co.hex2 && (
                            <button type="button" className={styles.specDelBtn} onClick={() => setColorOptions(prev => prev.map((c, idx) => idx === i ? { ...c, hex2: null } : c))} title="Retirer la 2ème couleur">✕</button>
                          )}
                        </div>
                      </div>
                    </div>
                    <button type="button" className={styles.specDelBtn} style={{ width: '100%' }} onClick={() => setColorOptions(prev => prev.filter((_, idx) => idx !== i))}>Supprimer cette variante</button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className={styles.specAddBtn}
                onClick={() => setColorOptions(prev => [...prev, { id: Math.random().toString(36).substring(2, 9), name: '', hex1: '#000000', hex2: null, image_url: '', image_url2: null }])}
              >
                + Ajouter une couleur
              </button>
            </div>
          </div>

          {/* Quantity Breaks */}
          <div className={styles.inputGroup}>
            <label>Offres de quantité (ex: 2 paires pour 110 TND)</label>
            <div className={styles.specEditor}>
              {quantityBreaks.map((qb, i) => (
                <div key={i} className={styles.specEditorRow} style={{ gap: '8px', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '10px', color: 'var(--color-grey)', display: 'block', marginBottom: '4px' }}>Qté min</label>
                    <input
                      type="number"
                      className={styles.input}
                      placeholder="Qté min"
                      value={qb.min_qty}
                      onChange={e => setQuantityBreaks(prev => prev.map((q, idx) => idx === i ? { ...q, min_qty: parseInt(e.target.value) || 0 } : q))}
                    />
                  </div>
                  <div style={{ flex: 1.2 }}>
                    <label style={{ fontSize: '10px', color: 'var(--color-grey)', display: 'block', marginBottom: '4px' }}>Prix TOTAL (TND)</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        step="0.001"
                        className={styles.input}
                        placeholder="Prix total"
                        value={qb.total_price}
                        onChange={e => setQuantityBreaks(prev => prev.map((q, idx) => idx === i ? { ...q, total_price: parseFloat(e.target.value) || 0 } : q))}
                      />
                      {parseFloat(formData.price) > 0 && qb.total_price > 0 && (
                        <div style={{ fontSize: '10px', color: 'var(--color-gold)', marginTop: '2px', fontWeight: 'bold' }}>
                          Soit -{Math.round(100 - (qb.total_price / (parseFloat(formData.price) * qb.min_qty)) * 100)}% du prix original
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '10px', color: 'var(--color-grey)', display: 'block', marginBottom: '4px' }}>Badge (opt)</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="ex: -10%"
                      value={qb.label || ''}
                      onChange={e => setQuantityBreaks(prev => prev.map((q, idx) => idx === i ? { ...q, label: e.target.value } : q))}
                    />
                  </div>
                  <button type="button" className={styles.specDelBtn} style={{ alignSelf: 'flex-end', marginBottom: '8px' }} onClick={() => setQuantityBreaks(prev => prev.filter((_, idx) => idx !== i))}>✕</button>
                </div>
              ))}
              <button
                type="button"
                className={styles.specAddBtn}
                onClick={() => setQuantityBreaks(prev => [...prev, { min_qty: 2, total_price: 0, label: '' }])}
              >
                + Ajouter un palier de quantité
              </button>
            </div>
          </div>

          {/* ── Gallery (edit mode only) ── */}
          {editingProduct && (
            <div className={styles.inputGroup}>
              <label>
                <ImageIcon size={14} style={{ display: 'inline', marginRight: 6 }} />
                Photos supplémentaires
              </label>

              <div className={styles.galleryGrid}>
                {galleryImages.map(img => (
                  <div key={img.id} className={styles.galleryThumb}>
                    <Image
                      src={img.image_url}
                      alt="Gallery image"
                      width={80}
                      height={80}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                    <button
                      type="button"
                      className={styles.galleryDelBtn}
                      onClick={() => handleGalleryDelete(img.id)}
                      title="Supprimer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                {/* Add button */}
                <button
                  type="button"
                  className={styles.galleryAddBtn}
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={galleryPhase !== 'idle'}
                  title="Ajouter une photo"
                >
                  {galleryPhase !== 'idle' ? (
                    <>
                      <Loader2 size={20} className={styles.gallerySpinner} />
                      <span style={{ fontSize: '11px' }}>
                        {galleryPhase === 'compressing' ? 'Compression...' : 'Envoi R2...'}
                      </span>
                    </>
                  ) : (
                    <><PlusCircle size={20} /><span>Ajouter</span></>
                  )}
                </button>

                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleGalleryFileChange}
                />
              </div>
              <p className={styles.galleryHint}>
                Ces photos s&apos;affichent dans la galerie de la page produit.
              </p>
              {galleryError && (
                <p role="alert" style={{ color: 'var(--color-error)', marginTop: '8px', fontSize: '12px' }}>
                  {galleryError}
                </p>
              )}
            </div>
          )}

          <div className={styles.inputGroup}>
            <label>Description <AiBadge field="description" /></label>
            <textarea className={styles.input} rows={3} value={formData.description} onChange={set('description')} />
          </div>

          <Button
            type="submit"
            variant="primary"
            style={{ width: '100%', marginTop: '8px' }}
            disabled={submitting || uploadingImage || galleryPhase !== 'idle'}
          >
            {submitting ? 'Enregistrement...'
              : uploadingImage ? 'Compression / Envoi...'
              : editingProduct ? '💾 Enregistrer les modifications'
              : 'Ajouter le produit'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
