'use client';

import { useState, useEffect } from 'react';
import type { CreateOrderPayload, Category } from '@/types';

// ?? useCategories ?????????????????????????????????????????????????????????
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;

    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const res = await fetch('/api/categories', { cache: 'no-store', signal: controller.signal });
        const json = await res.json();
        if (!res.ok || !Array.isArray(json.data)) throw new Error(json.error || 'Invalid category response');
        if (controller.signal.aborted) return;
        setCategories(json.data);
        setLoaded(true);
      } catch (error) {
        if (!controller.signal.aborted) console.error('[useCategories]', error);
      } finally {
        pending = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) void refresh();
    }

    void refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      controller.abort();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  return { categories, loading, loaded };
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
      if (!res.ok) return { error: json.error as string || 'Erreur lors de la commande. Veuillez réessayer.', stockConflict: res.status === 409 };
      const order = json.data as { id: string; total_price?: number };

      // Trending: log order events for each item
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        payload.items.forEach(item => {
          navigator.sendBeacon('/api/tracking/stats', JSON.stringify({ product_id: item.product_id, event: 'order' }));
        });
      }

      setSuccess(true);
      return { order };
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Order failed. Please try again.');
      return { error: 'Erreur lors de la commande. Veuillez réessayer.', stockConflict: false };
    } finally { setLoading(false); }
  };

  return { createOrder, loading, error, success };
}