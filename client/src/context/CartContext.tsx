'use client';

import { createContext, useContext, useReducer, useCallback, ReactNode, useEffect, useRef } from 'react';
import type { CartItem, CartState, Product, ColorOption } from '@/types';
import { getProductColors, getPurchasableColor, getQuantityBreaks, validatePurchase } from '@/lib/product-availability';

// ─── Actions ──────────────────────────────────────────────────────────────────

type CartAction =
  | { type: 'ADD_ITEMS'; product: Product; colorIds: (string | undefined)[] }
  | { type: 'REPLACE_COLOR'; product: Product; from?: string; to: string }
  | { type: 'REMOVE_ITEM'; productId: string; colorId?: string }
  | { type: 'UPDATE_QUANTITY'; productId: string; colorId?: string; quantity: number }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_CART'; state: CartState };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEMS': {
      const { product, colorIds } = action;
      const colors = getProductColors(product.color_options);
      const alreadyInCart = state.items.filter(item => item.product.id === product.id);
      const newSelections = colorIds.map(colorId => ({ colorId, quantity: 1 }));
      if (validatePurchase(product, newSelections)
        || (product.allow_unlimited_stock !== true
          && alreadyInCart.reduce((total, item) => total + item.quantity, colorIds.length) > (product.stock ?? 0))) {
        return state;
      }
      const items = [...state.items];
      for (const colorId of colorIds) {
        const index = items.findIndex(item => item.product.id === product.id && item.selected_color?.id === colorId);
        const color = getPurchasableColor(colors, colorId);
        const next = { product, selected_color: color, quantity: index === -1 ? 1 : items[index].quantity + 1 };
        if (index === -1) items.push(next);
        else items[index] = next;
      }
      return buildState(items);
    }
    case 'REPLACE_COLOR': {
      const { product, from, to } = action;
      const color = getPurchasableColor(getProductColors(product.color_options), to);
      const original = state.items.find(item => item.product.id === product.id && item.selected_color?.id === from);
      if (!color || !original || from === to) return state;
      const existing = state.items.find(item => item.product.id === product.id && item.selected_color?.id === to);
      const replacement = { product, selected_color: color, quantity: original.quantity + (existing?.quantity ?? 0) };
      const items = state.items.filter(item => item !== existing).map(item => item === original ? replacement : item);
      return buildState(items);
    }
    case 'REMOVE_ITEM': {
      const items = state.items.filter(i => !(i.product.id === action.productId && i.selected_color?.id === action.colorId));
      return buildState(items);
    }
    case 'UPDATE_QUANTITY': {
      const items =
        action.quantity <= 0
          ? state.items.filter(i => !(i.product.id === action.productId && i.selected_color?.id === action.colorId))
          : state.items.map(i =>
              i.product.id === action.productId && i.selected_color?.id === action.colorId
                ? { ...i, quantity: action.quantity }
                : i
            );
      return buildState(items);
    }
    case 'CLEAR_CART':
      return buildState([]);
    case 'SET_CART':
      // Always recalculate totals when loading from localStorage
      // to ensure any updated pricing logic applies to old carts.
      return buildState(action.state.items);
    default:
      return state;
  }
}

function buildState(items: CartItem[]): CartState {
  // 1. Calculate total quantity for each product (sum of all colors)
  const productTotals: Record<string, number> = {};
  items.forEach(item => {
    productTotals[item.product.id] = (productTotals[item.product.id] || 0) + item.quantity;
  });

  const total = items.reduce(
    (sum, i) => {
      let unitPrice: number;
      const totalQty = productTotals[i.product.id];

      // Check for quantity break based on total product quantity
      const breaks = getQuantityBreaks(i.product.quantity_breaks);
      const applicableBreak = [...breaks]
        .sort((a, b) => b.min_qty - a.min_qty)
        .find(qb => totalQty >= qb.min_qty);

      if (applicableBreak) {
        // unit price is the break's total price / total quantity of that product
        unitPrice = applicableBreak.total_price / totalQty;
      } else {
        const hasDiscount = i.product.discount != null && i.product.discount > 0;
        unitPrice = hasDiscount ? Math.round((i.product.price ?? 0) * (1 - i.product.discount! / 100)) : (i.product.price ?? 0);
      }

      return sum + unitPrice * i.quantity;
    },
    0
  );
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  return { items, total, itemCount };
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface CartContextValue extends CartState {
  addItems:       (product: Product, colors: (ColorOption | null)[]) => Promise<'stock' | 'color' | 'network' | null>;
  replaceColor:   (product: Product, from: string | undefined, to: string) => void;
  removeItem:     (productId: string, colorId?: string) => void;
  updateQuantity: (productId: string, colorId: string | undefined, quantity: number) => void;
  clearCart:      () => void;
  isInCart:       (productId: string, colorId?: string) => boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], total: 0, itemCount: 0 });
  const pendingProducts = useRef(new Set<string>());

  // ─── Persistence Logic ───────────────

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('nyvara_cart');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        dispatch({ type: 'SET_CART', state: parsed });
      } catch (e) {
        console.error('Failed to parse cart from localStorage', e);
      }
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    // Skip saving empty initial state before hydration if possible, 
    // but here we just save whenever it changes.
    localStorage.setItem('nyvara_cart', JSON.stringify(state));
  }, [state]);

  const addItems = useCallback<CartContextValue['addItems']>(async (product, colors) => {
    const colorIds = colors.map(color => color?.id);
    if (colorIds.length === 0) return 'stock';
    if (pendingProducts.current.has(product.id)) return 'network';
    pendingProducts.current.add(product.id);
    const selections = [
      ...state.items.filter(item => item.product.id === product.id)
        .map(item => ({ quantity: item.quantity, colorId: item.selected_color?.id })),
      ...colorIds.map(colorId => ({ quantity: 1, colorId })),
    ];
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selections),
      });
      const result = await response.json();
      if (response.status === 409) return result.issue === 'color' ? 'color' : 'stock';
      if (!response.ok || !result.data) return 'network';
      dispatch({ type: 'ADD_ITEMS', product: { ...product, ...result.data }, colorIds });
      return null;
    } catch {
      return 'network';
    } finally {
      pendingProducts.current.delete(product.id);
    }
  }, [state.items]);
  const replaceColor = useCallback<CartContextValue['replaceColor']>((product, from, to) => dispatch({ type: 'REPLACE_COLOR', product, from, to }), []);
  const removeItem     = useCallback((productId: string, colorId?: string) => dispatch({ type: 'REMOVE_ITEM', productId, colorId }), []);
  const updateQuantity = useCallback((productId: string, colorId: string | undefined, quantity: number) => dispatch({ type: 'UPDATE_QUANTITY', productId, colorId, quantity }), []);
  const clearCart      = useCallback(() => dispatch({ type: 'CLEAR_CART' }), []);
  const isInCart       = useCallback((productId: string, colorId?: string) => state.items.some(i => i.product.id === productId && i.selected_color?.id === colorId), [state.items]);

  return (
    <CartContext.Provider value={{ ...state, addItems, replaceColor, removeItem, updateQuantity, clearCart, isInCart }}>
      {children}
    </CartContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
