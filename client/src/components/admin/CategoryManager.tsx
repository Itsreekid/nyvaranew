'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import type { Category } from '@/types';
import { categoryIcons, defaultCategoryConfig, readCategoryConfig, type CategoryHomepageConfig, type CategoryIconId } from '@/lib/category-icons';
import { showAdminError } from '@/lib/admin-error';
import adminStyles from '@/app/admin/admin.module.css';
import styles from '@/app/admin/categories/categories.module.css';

const iconEntries = Object.entries(categoryIcons) as [CategoryIconId, (typeof categoryIcons)[CategoryIconId]][];
const searchKey = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function CategoryForm({ category, save, cancel }: {
  category?: Category;
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
    if (!name.trim() || saving) return;
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
      <label>Nom de la catégorie
        <input className={styles.input} value={name} onChange={event => setName(event.target.value)} required />
      </label>
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
        <label>Ordre d’affichage
          <input className={styles.input} type="number" min={0} max={9999} value={config.order}
            onChange={event => setConfig({ ...config, order: Number(event.target.value) })} />
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

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      setCategories(Array.isArray(json.data) ? json.data : []);
    } catch (error) {
      showAdminError(error instanceof Error ? error.message : 'Impossible de charger les catégories.');
    } finally { setLoading(false); }
  };
  useEffect(() => { void fetchCategories(); }, []);

  async function saveCategory(name: string, homepage_config?: CategoryHomepageConfig, id?: string) {
    try {
      const response = await fetch(id ? '/api/categories/' + id : '/api/categories', {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, homepage_config }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      if (id) setEditId(null);
      await fetchCategories();
      return true;
    } catch (error) {
      showAdminError(error instanceof Error ? error.message : 'Impossible d’enregistrer la catégorie.');
      return false;
    }
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
  return (
    <div>
      <div className={styles.addCard}>
        <h2 className={styles.cardTitle}>Ajouter une catégorie</h2>
        <CategoryForm save={saveCategory} />
      </div>
      <div className={styles.listCard}>
        <h2 className={styles.cardTitle}>{categories.length} catégorie{categories.length !== 1 ? 's' : ''}</h2>
        <div className={styles.list}>
          {!categories.length && <p className={styles.empty}>Aucune catégorie pour le moment.</p>}
          {categories.map(category => {
            const config = readCategoryConfig(category.homepage_config);
            const Icon = categoryIcons[config.icon].icon;
            return (
              <div key={category.id} className={styles.catRow}>
                {editId === category.id ? (
                  <CategoryForm category={category} save={(name, config) => saveCategory(name, config, category.id)} cancel={() => setEditId(null)} />
                ) : (
                  <>
                    <span className={styles.categoryIdentity}><Icon size={20} aria-hidden="true" /><span className={styles.catName}>{category.name}</span></span>
                    <div className={styles.catActions}>
                      <button type="button" className={styles.editBtn} onClick={() => setEditId(category.id)}>Modifier</button>
                      <button type="button" className={styles.deleteBtn} onClick={() => void removeCategory(category)}>Supprimer</button>
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
