// File: src/hooks/useProducts_WITH_PAGINATION.ts
import { useEffect, useState } from 'react';
import type { Product, ProductFilters } from '@/types';

const sortApiMap: Record<string, string> = {
  'newest':     'newest',
  'price-asc':  'price-asc',
  'price-desc': 'price-desc',
};

export function useProducts(
  filters: ProductFilters & { page?: number; pageSize?: number },
  sort: string
) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => { fetchProducts(); }, [JSON.stringify(filters), sort]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const pageSize = filters.pageSize || 20;
      const page     = filters.page || 0;
      const apiSort  = sortApiMap[sort] || 'newest';

      const params = new URLSearchParams({
        page: String(page), pageSize: String(pageSize), sort: apiSort,
      });
      if (filters.gender && filters.gender !== 'all') params.set('gender', filters.gender);
      if (filters.search) params.set('search', filters.search);

      const res  = await fetch(`/api/products?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setProducts(json.data || []);
      setTotalCount(json.count || 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading products');
      setProducts([]);
    } finally { setLoading(false); }
  };

  return { products, loading, error, totalCount };
}