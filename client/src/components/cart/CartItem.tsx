'use client';

import Image from 'next/image';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import type { CartItem as CartItemType } from '@/types';
import type { CartStockIssue } from '@/hooks/useCartAvailability';
import styles from './CartItem.module.css';

interface CartItemProps {
  item: CartItemType;
  stockIssue?: CartStockIssue;
}

const formatTND = (amount: number) =>
  `${amount.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND`;

export default function CartItem({ item, stockIssue }: CartItemProps) {
  const { updateQuantity, removeItem, replaceColor } = useCart();
  const { product, quantity } = item;

  return (
    <div className={styles.item}>
      {/* Image */}
      <div className={styles.imageWrap}>
        {(item.selected_color?.image_url || product.image_url) ? (
          <Image
            src={item.selected_color?.image_url || product.image_url!}
            alt={product.title ?? 'Product'}
            fill
            className={styles.image}
            sizes="80px"
          />
        ) : (
          <div className={styles.imageFallback} aria-hidden="true" />
        )}
      </div>

      {/* Info */}
      <div className={styles.info}>
        <p className={styles.title}>{product.title ?? 'Sunglasses'}</p>
        {product.categories?.name && (
          <p className={styles.category}>{product.categories.name}</p>
        )}
        {product.gender && (
          <p className={styles.gender}>
            {product.gender.charAt(0).toUpperCase() + product.gender.slice(1)}
          </p>
        )}
        {item.selected_color && (
          <p className={styles.gender} style={{ color: 'var(--color-charcoal)' }}>
            Couleur : {item.selected_color.name}
          </p>
        )}
        {stockIssue && (
          <div className={styles.stockIssue} role="status">
            <strong>Rupture de stock</strong>
            <p>{stockIssue.message}</p>
            {stockIssue.alternatives.length > 0 && (
              <select
                aria-label={`Choisir un autre coloris pour ${product.title ?? 'cet article'}`}
                value=""
                onChange={event => {
                  if (stockIssue.product && event.target.value) {
                    replaceColor(stockIssue.product, item.selected_color?.id, event.target.value);
                  }
                }}
              >
                <option value="" disabled>Choisir un autre coloris</option>
                {stockIssue.alternatives.map(color => <option key={color.id} value={color.id}>{color.name}</option>)}
              </select>
            )}
          </div>
        )}
        <p className={styles.price}>
          {formatTND(
            (product.discount != null && product.discount > 0
              ? Math.round((product.price ?? 0) * (1 - product.discount / 100))
              : (product.price ?? 0)) * quantity
          )}
        </p>
      </div>

      {/* Quantity controls */}
      <div className={styles.controls}>
        <button
          className={styles.qtyBtn}
          onClick={() => updateQuantity(product.id, item.selected_color?.id, quantity - 1)}
          aria-label="Decrease quantity"
        >
          <Minus size={12} />
        </button>
        <span className={styles.qty}>{quantity}</span>
        <button
          className={styles.qtyBtn}
          onClick={() => updateQuantity(product.id, item.selected_color?.id, quantity + 1)}
          disabled={Boolean(stockIssue)}
          aria-label="Increase quantity"
        >
          <Plus size={12} />
        </button>
        <button
          className={styles.removeBtn}
          onClick={() => removeItem(product.id, item.selected_color?.id)}
          aria-label="Retirer l’article"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
