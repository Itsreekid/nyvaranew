import { useCallback, useEffect, useRef, useState } from 'react';
import { getProductColors, getPurchasableColor, isProductOutOfStock, isSelectedColorUnavailable, unavailableColorMessage, validatePurchase } from '@/lib/product-availability';
import type { CartItem, ColorOption, Product } from '@/types';

export interface CartStockIssue {
  message: string;
  alternatives: ColorOption[];
  product?: Product;
}

export function cartLineKey(item: CartItem) {
  return JSON.stringify([item.product.id, item.selected_color?.id ?? null]);
}

export function useCartAvailability(items: CartItem[]) {
  const [issues, setIssues] = useState<Record<string, CartStockIssue>>({});
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => activeRequest.current?.abort(), [items]);

  const refresh = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setError(null);
    setChecking(true);
    try {
      const groups = new Map<string, CartItem[]>();
      for (const item of items) {
        const group = groups.get(item.product.id) ?? [];
        group.push(item);
        groups.set(item.product.id, group);
      }
      const next: Record<string, CartStockIssue> = {};
      await Promise.all([...groups].map(async ([id, group]) => {
        const response = await fetch(`/api/products/${encodeURIComponent(id)}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok && response.status !== 404) throw new Error('Availability check failed');
        const product: Product | undefined = response.ok ? (await response.json()).data : undefined;
        const colors = getProductColors(product?.color_options);
        const alternatives = product && !isProductOutOfStock(product, colors)
          ? colors.filter(color => getPurchasableColor(colors, color.id))
          : [];
        const stockIssue = product && validatePurchase(product, group.map(item => ({
          quantity: item.quantity,
          colorId: item.selected_color?.id,
        }))) === 'stock';

        for (const item of group) {
          const selectedColor = item.selected_color;
          const colorUnavailable = isSelectedColorUnavailable(colors, selectedColor?.id);
          if (colorUnavailable || !product || stockIssue) {
            next[cartLineKey(item)] = {
              message: colorUnavailable
                ? unavailableColorMessage(selectedColor?.name)
                : 'Stock insuffisant. Modifiez la quantité ou retirez cet article du panier.',
              alternatives: colorUnavailable ? alternatives : [],
              product,
            };
          }
        }
      }));
      if (controller.signal.aborted) return null;
      setIssues(next);
      return Object.keys(next).length === 0;
    } catch {
      if (controller.signal.aborted) return null;
      setError('Impossible de vérifier le stock. Veuillez réessayer.');
      return false;
    } finally {
      if (!controller.signal.aborted) setChecking(false);
    }
  }, [items]);

  return { issues, error, checking, refresh };
}
