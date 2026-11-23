'use client';

import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { GripVertical, Search } from 'lucide-react';
import type { Category } from '@/types';
import { categoryIcons, defaultCategoryConfig, readCategoryConfig, type CategoryHomepageConfig, type CategoryIconId } from '@/lib/category-icons';
import { showAdminError } from '@/lib/admin-error';
import { showAdminSuccess } from '@/lib/admin-success';
import adminStyles from '@/app/admin/admin.module.css';
import styles from '@/app/admin/categories/categories.module.css';

const iconEntries = Object.entries(categoryIcons) as [CategoryIconId, (typeof categoryIcons)[CategoryIconId]][];
const searchKey = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function CategoryForm({ category, save, cancel, homepageOnly = false }: {
  category?: Category;
  homepageOnly?: boolean;
  save: (name: string, config?: CategoryHomepageConfig) => Promise<boolean>;
  cancel?: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [config, setConfig] = useState(() => readCategoryConfig(category?.homepage_config));
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const icons = iconEntries.filter(([id, item]) => searchKey(id + ' ' + item.label).includes(searchKey(query.trim())));
  const SelectedIcon = categoryIcons[config.icon].icon;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((!homepageOnly && !name.trim()) || saving) return;
    setSaving(true);
    const changed = JSON.stringify(config) !== JSON.stringify(readCategoryConfig(category?.homepage_config));
    try {
      if (await save(name.trim(), changed ? config : undefined) && !category) {
        setName('');
        setConfig(defaultCategoryConfig);
        setQuery('');
      }
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className={styles.categoryForm}>
      {!homepageOnly && <label>Nom de la catégorie
        <input className={styles.input} value={name} onChange={event => setName(event.target.value)} required />
      </label>}
      <div className={styles.homeOptions}>
        <label>Visibilité sur l’accueil
          <select className={styles.input} value={String(config.visible)} onChange={event => setConfig({ ...config,
            visible: event.target.value === 'null' ? null : event.target.value === 'true',
          })}>
            <option value="null">Automatique (avec produits)</option>
            <option value="true">Toujours afficher</option>
            <option value="false">Masquer sur l’accueil</option>
          </select>
        </label>
      </div>
      <details className={styles.iconPicker}>
        <summary><SelectedIcon size={18} aria-hidden="true" /> Icône · {categoryIcons[config.icon].label}</summary>
        <label className={styles.iconSearch}><Search size={16} aria-hidden="true" />
          <input type="search" className={styles.input} aria-label="Rechercher une icône" placeholder="Rechercher une icône"
            value={query} onChange={event => setQuery(event.target.value)} />
        </label>
        <div className={styles.iconGrid}>
          {icons.map(([id, { icon: Icon, label }]) => (
            <button type="button" key={id} aria-pressed={config.icon === id} onClick={() => setConfig({ ...config, icon: id })}>
              <Icon size={21} aria-hidden="true" />{label}
            </button>
          ))}
          {!icons.length && <p>Aucune icône trouvée.</p>}
        </div>
      </details>
      <div className={styles.catActions}>
        <button type="submit" className={styles.addBtn} disabled={saving}>{category ? 'Enregistrer' : 'Ajouter'}</button>
        {cancel && <button type="button" className={styles.cancelBtn} onClick={cancel}>Annuler</button>}
      </div>
    </form>
  );
}

export default function CategoryManager({ homepageOnly = false }: { homepageOnly?: boolean }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string>();
  const [savingOrder, setSavingOrder] = useState(false);
  const homepageSelect = useRef<HTMLSelectElement>(null);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      const rows: Category[] = Array.isArray(json.data) ? json.data : [];
      if (homepageOnly) {
        rows.sort((a, b) => readCategoryConfig(a.homepage_config).order - readCategoryConfig(b.homepage_config).order);
      }
      setCategories(rows);
    } catch (error) {
      showAdminError(error instanceof Error ? error.message : 'Impossible de charger les catégories.');
    } finally { setLoading(false); }
  };
  useEffect(() => { void fetchCategories(); }, []);

  async function saveCategory(name: string | undefined, homepage_config?: CategoryHomepageConfig, id?: string) {
    try {
      const response = await fetch(id ? '/api/categories/' + id : '/api/categories', {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, homepage_config }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      if (id && !homepageOnly) setEditId(null);
      await fetchCategories();
      if (homepageOnly) showAdminSuccess('Réglages de la catégorie enregistrés.');
      return true;
    } catch (error) {
      showAdminError(error instanceof Error ? error.message : 'Impossible d’enregistrer la catégorie.');
      return false;
    }
  }

  async function moveCategory(from: number, to: number) {
    if (savingOrder || to < 0 || to >= categories.length || from === to) return;

    const next = [...categories];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setCategories(next);
    setSavingOrder(true);
    try {
      const response = await fetch('/api/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: next.map(category => category.id) }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      showAdminSuccess('Ordre des catégories enregistré.');
    } catch (error) {
      setCategories(categories);
      showAdminError(error instanceof Error ? error.message : 'Impossible d’enregistrer l’ordre.');
    } finally {
      setSavingOrder(false);
    }
  }

  function categoryUnderPointer(event: PointerEvent<HTMLButtonElement>) {
    return document.elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-home-category]')?.dataset.homeCategory;
  }

  async function removeCategory(category: Category) {
    if (!confirm(`Supprimer la catégorie « ${category.name} » ? Les produits liés ne seront pas supprimés.`)) return;
    try {
      const response = await fetch('/api/categories/' + category.id, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json()).error);
      await fetchCategories();
    } catch (error) {
      showAdminError(error instanceof Error ? error.message : 'Erreur lors de la suppression.');
    }
  }

  if (loading) return <div className={adminStyles.contentArea}>Chargement…</div>;
  const selectedCategory = categories.find(category => category.id === editId);
  return (
    <div>
      <div className={styles.addCard}>
        {homepageOnly ? (
          <>
            <label className={styles.homeCategorySelect}>
              La catégorie
              <select ref={homepageSelect} className={styles.input} value={selectedCategory?.id ?? ''} onChange={event => setEditId(event.target.value || null)}>
                <option value="">Choisir une catégorie…</option>
                {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            {selectedCategory && <CategoryForm key={selectedCategory.id} category={selectedCategory} homepageOnly
              save={(_, config) => config ? saveCategory(undefined, config, selectedCategory.id) : Promise.resolve(true)} />}
          </>
        ) : (
          <>
            <h2 className={styles.cardTitle}>Ajouter une catégorie</h2>
            <CategoryForm save={saveCategory} />
          </>
        )}
      </div>
      <div className={styles.listCard}>
        <h2 className={styles.cardTitle}>{categories.length} catégorie{categories.length !== 1 ? 's' : ''}</h2>
        {homepageOnly && categories.length > 1 && (
          <p className={styles.reorderHint} id="homepage-category-order">
            Faites glisser les poignées ou utilisez les flèches ↑ et ↓. L’ordre est enregistré automatiquement.
          </p>
        )}
        <div className={styles.list} aria-busy={homepageOnly && savingOrder}>
          {!categories.length && <p className={styles.empty}>Aucune catégorie pour le moment.</p>}
          {categories.map((category, index) => {
            const config = readCategoryConfig(category.homepage_config);
            const Icon = categoryIcons[config.icon].icon;
            return (
              <div key={category.id} data-home-category={homepageOnly ? category.id : undefined}
                className={dropTarget === category.id ? `${styles.catRow} ${styles.dropTarget}` : styles.catRow}>
                {!homepageOnly && editId === category.id ? (
                  <CategoryForm category={category} save={(name, config) => saveCategory(name, config, category.id)} cancel={() => setEditId(null)} />
                ) : (
                  <>
                    <div className={styles.categoryIdentity}>
                      {homepageOnly && categories.length > 1 && (
                        <button type="button" className={styles.dragHandle} aria-label={`Déplacer ${category.name}`}
                          aria-describedby="homepage-category-order" aria-disabled={savingOrder}
                          onPointerDown={event => {
                            if (savingOrder || !event.isPrimary || event.button !== 0) return;
                            event.currentTarget.setPointerCapture(event.pointerId);
                          }}
                          onPointerMove={event => {
                            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                              const target = categoryUnderPointer(event);
                              setDropTarget(target === category.id ? undefined : target);
                            }
                          }}
                          onPointerUp={event => {
                            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                            const target = categoryUnderPointer(event);
                            void moveCategory(index, categories.findIndex(row => row.id === target));
                          }}
                          onLostPointerCapture={() => setDropTarget(undefined)}
                          onKeyDown={event => {
                            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                            event.preventDefault();
                            void moveCategory(index, index + (event.key === 'ArrowUp' ? -1 : 1));
                          }}>
                          <GripVertical size={19} aria-hidden="true" />
                        </button>
                      )}
                      <Icon size={20} aria-hidden="true" /><span className={styles.catName}>{category.name}</span>
                    </div>
                    <div className={styles.catActions}>
                      <button type="button" className={styles.editBtn} onClick={() => { setEditId(category.id); homepageSelect.current?.focus(); }}>Modifier</button>
                      {!homepageOnly && <button type="button" className={styles.deleteBtn} onClick={() => void removeCategory(category)}>Supprimer</button>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
