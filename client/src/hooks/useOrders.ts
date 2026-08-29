'use client';

import { useState, useEffect } from 'react';
import type { CreateOrderPayload, Category } from '@/types';

// ?? useCategories ?????????????????????????????????????????????????????????
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const run = async () => {
      console.log('[useCategories] 🔄 fetching /api/categories...');
      try {
        const res = await fetch('/api/categories');
        console.log('[useCategories] 📡 status:', res.status, res.statusText);
        const json = await res.json();
        console.log('[useCategories] 📦 raw response:', json);
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        const arr = Array.isArray(json.data) ? json.data : [];
        console.log('[useCategories] ✅ count:', arr.length, arr);
        setCategories(arr);
      } catch (err: any) {
        console.error('[useCategories] ❌ error:', err.message, err);
      } finally {
        setLoading(false);
        console.log('[useCategories] 🏁 done');
      }
    };
    run();
  }, []);

  return { categories, loading };
}

// ?? useCreateOrder ????????????????????????????????????????????????????????
export function useCreateOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const createOrder = async (payload: CreateOrderPayload) => {
    setLoading(true); setError(null); setSuccess(false);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Order failed');
      const order = json.data as { id: string };

      // Trending: log order events for each item
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        payload.items.forEach(item => {
          navigator.sendBeacon('/api/tracking/stats', JSON.stringify({ product_id: item.product_id, event: 'order' }));
        });
      }

      setSuccess(true);
      return order;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Order failed. Please try again.');
      return null;
    } finally { setLoading(false); }
  };

  return { createOrder, loading, error, success };
}