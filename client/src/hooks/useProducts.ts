'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Product, ProductFilters, SortOption } from '@/types';

const getActualPrice = (p: Product) => {
  const hasDiscount = p.discount != null && p.discount > 0;
  if (hasDiscount && p.price != null) return Math.round(p.price * (1 - p.discount! / 100));
  return p.final_price ?? p.price ?? 0;
};

// ?? useProducts ???????????????????????????????????????????????????????????
export function useProducts(filters?: ProductFilters, sort?: SortOption) {
  const [products, setProducts]     = useState<Product[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Derive stable primitive values for the dependency array
  const pageSize = (filters as any)?.pageSize ?? 20;
  const page     = (filters as any)?.page     ?? 0;

  const fetchProducts = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (filters?.category_id) params.set('category_id', filters.category_id);
      if (filters?.gender && filters.gender !== 'all') params.set('gender', filters.gender);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.min_price !== undefined) params.set('min_price', String(filters.min_price));
      if (filters?.max_price !== undefined) params.set('max_price', String(filters.max_price));
      if (sort) params.set('sort', sort);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      params.set('_t', String(Date.now())); // bust any CDN / browser cache

      const res  = await fetch(`/api/products?${params}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load products');

      setTotalCount(json.count ?? 0);
      setProducts(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
    } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters?.category_id, filters?.gender, filters?.min_price, filters?.max_price, filters?.search, sort, page, pageSize]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  return { products, loading, error, totalCount, refetch: fetchProducts };
}

// ?? useProduct (single) ???????????????????????????????????????????????????
export function useProduct(id: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/products/${id}`)
      .then(r => r.json())
      .then(({ data, error: err }) => {
        if (err) setError(err);
        else setProduct(data as Product);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [id]);

  return { product, loading, error };
}

// ?? useFeaturedProducts ???????????????????????????????????????????????????
export function useFeaturedProducts(limit = 6) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch(`/api/products?pageSize=${limit}&sort=newest`)
      .then(r => r.json())
      .then(({ data }) => { setProducts((data as Product[]) ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [limit]);

  return { products, loading };
}