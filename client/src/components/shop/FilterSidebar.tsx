'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, SlidersHorizontal, X } from 'lucide-react';
import { useCategories } from '@/hooks/useOrders';
import Button from '@/components/ui/Button';
import type { ProductFilters, Gender } from '@/types';
import styles from './FilterSidebar.module.css';

interface FilterSidebarProps {
  filters: ProductFilters;
  onChange: (filters: ProductFilters) => void;
  onReset: () => void;
}

const GENDERS: { value: Gender | 'all'; label: string }[] = [
  { value: 'all',    label: 'Tous' },
  { value: 'homme',  label: 'Hommes' },
  { value: 'femme',  label: 'Femmes' },
  { value: 'unisex', label: 'Unisexe' },
  { value: 'enfant', label: 'Enfants' },
];

const PRICE_RANGES = [
  { label: 'Moins de 100 TND',   min: 0,   max: 100  },
  { label: '100 – 250 TND',      min: 100, max: 250  },
  { label: '250 – 500 TND',      min: 250, max: 500  },
  { label: 'Plus de 500 TND',    min: 500, max: 9999 },
];

export default function FilterSidebar({ filters, onChange, onReset }: FilterSidebarProps) {
  const { categories, loading } = useCategories();
  const [openSections, setOpenSections] = useState({ gender: true, category: true, price: true });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggle = (section: keyof typeof openSections) =>
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));

  const hasActiveFilters =
    (filters.gender && filters.gender !== 'all') ||
    filters.category_id ||
    filters.min_price !== undefined ||
    filters.max_price !== undefined;

  const selectedPriceRange = PRICE_RANGES.find(
    r => r.min === filters.min_price && r.max === filters.max_price
  );

  const content = (
    <div className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <span className={styles.sidebarTitle}>Filtres</span>
        {hasActiveFilters && (
          <button className={styles.resetBtn} onClick={onReset}>
            <X size={12} /> Effacer tout
          </button>
        )}
      </div>

      {/* Gender */}
      <div className={styles.section}>
        <button className={styles.sectionToggle} onClick={() => toggle('gender')}>
          <span>Genre</span>
          {openSections.gender ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {openSections.gender && (
          <div className={styles.options}>
            {GENDERS.map(g => (
              <label key={g.value} className={styles.optionLabel}>
                <input
                  type="radio"
                  name="gender"
                  value={g.value}
                  checked={(filters.gender ?? 'all') === g.value}
                  onChange={() => onChange({ ...filters, gender: g.value })}
                  className={styles.radio}
                />
                <span className={styles.optionText}>{g.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Category */}
      <div className={styles.section}>
        <button className={styles.sectionToggle} onClick={() => toggle('category')}>
          <span>Catégorie</span>
          {openSections.category ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {openSections.category && (
          <div className={styles.options}>
            <label className={styles.optionLabel}>
              <input
                type="radio"
                name="category"
                value=""
                checked={!filters.category_id}
                onChange={() => onChange({ ...filters, category_id: undefined })}
                className={styles.radio}
              />
              <span className={styles.optionText}>Toutes les catégories</span>
            </label>
            {!loading && categories.map(cat => (
              <label key={cat.id} className={styles.optionLabel}>
                <input
                  type="radio"
                  name="category"
                  value={cat.id}
                  checked={filters.category_id === cat.id}
                  onChange={() => onChange({ ...filters, category_id: cat.id })}
                  className={styles.radio}
                />
                <span className={styles.optionText}>{cat.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Price */}
      <div className={styles.section}>
        <button className={styles.sectionToggle} onClick={() => toggle('price')}>
          <span>Fourchette de prix</span>
          {openSections.price ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {openSections.price && (
          <div className={styles.options}>
            <label className={styles.optionLabel}>
              <input
                type="radio"
                name="price"
                value=""
                checked={!selectedPriceRange}
                onChange={() => onChange({ ...filters, min_price: undefined, max_price: undefined })}
                className={styles.radio}
              />
              <span className={styles.optionText}>Tout prix</span>
            </label>
            {PRICE_RANGES.map(r => (
              <label key={r.label} className={styles.optionLabel}>
                <input
                  type="radio"
                  name="price"
                  checked={selectedPriceRange?.label === r.label}
                  onChange={() => onChange({ ...filters, min_price: r.min, max_price: r.max })}
                  className={styles.radio}
                />
                <span className={styles.optionText}>{r.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className={styles.desktopWrap}>{content}</div>

      {/* Mobile toggle */}
      <div className={styles.mobileWrap}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setMobileOpen(true)}
        >
          <SlidersHorizontal size={14} />
          Filtres {hasActiveFilters ? '•' : ''}
        </Button>

        {mobileOpen && (
          <div className={styles.mobileDrawer}>
            <div className={styles.mobileDrawerInner}>
              <div className={styles.mobileDrawerHeader}>
                <span>Filtres</span>
                <button onClick={() => setMobileOpen(false)} aria-label="Fermer les filtres">
                  <X size={20} />
                </button>
              </div>
              {content}
              <div className={styles.mobileApply}>
                <Button variant="primary" fullWidth onClick={() => setMobileOpen(false)}>
                  Appliquer les filtres
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
