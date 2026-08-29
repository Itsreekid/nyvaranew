'use client';

import { useEffect, useState } from 'react';
import type { Category } from '@/types';
import { showAdminError } from '@/lib/admin-error';
import adminStyles from '../admin.module.css';
import styles from './categories.module.css';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(true);
  const [newName, setNewName]       = useState('');
  const [adding, setAdding]         = useState(false);
  const [editId, setEditId]         = useState<string | null>(null);
  const [editName, setEditName]     = useState('');

  const fetchCategories = async () => {
    console.log('[categories] 🔄 fetching /api/categories...');
    try {
      const res = await fetch('/api/categories');
      console.log('[categories] 📡 status:', res.status, res.statusText);

      const json = await res.json();
      console.log('[categories] 📦 raw response:', json);

      if (!res.ok) throw new Error(json.error || `Erreur HTTP ${res.status}`);

      console.log('[categories] ✅ data received, count:', Array.isArray(json.data) ? json.data.length : 'NOT an array', json.data);
      setCategories(Array.isArray(json.data) ? json.data : []);
    } catch (err: any) {
      console.error('[categories] ❌ error:', err.message, err);
      showAdminError(err.message || 'Impossible de charger les catégories.');
    } finally {
      setLoading(false);
      console.log('[categories] 🏁 done loading');
    }
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    const res = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim() }) });
    const json = await res.json();
    setAdding(false);
    if (res.ok) { setNewName(''); fetchCategories(); }
    else showAdminError(json.error);
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    const res = await fetch(`/api/categories/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editName.trim() }) });
    const json = await res.json();
    if (res.ok) { setEditId(null); setEditName(''); fetchCategories(); }
    else showAdminError(json.error);
  };

  const handleDelete = async (id: string, name: string | null) => {
    if (!confirm(`Supprimer la catégorie "${name}" ? Les produits liés ne seront pas supprimés.`)) return;
    await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    fetchCategories();
  };

  if (loading) return <div className={adminStyles.contentArea}>Chargement...</div>;

  return (
    <div>
      <div className={adminStyles.pageHeader}>
        <h1 className={adminStyles.pageTitle}>Catégories</h1>
      </div>

      {/* Add category form */}
      <div className={styles.addCard}>
        <h2 className={styles.cardTitle}>Ajouter une catégorie</h2>
        <form onSubmit={handleAdd} className={styles.addForm}>
          <input
            type="text"
            className={styles.input}
            placeholder="Nom de la catégorie..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            required
          />
          <button type="submit" className={styles.addBtn} disabled={adding}>
            {adding ? 'Ajout...' : '+ Ajouter'}
          </button>
        </form>
      </div>

      {/* Category list */}
      <div className={styles.listCard}>
        <h2 className={styles.cardTitle}>{categories.length} Catégorie{categories.length !== 1 ? 's' : ''}</h2>
        <div className={styles.list}>
          {categories.length === 0 && (
            <div className={styles.empty}>Aucune catégorie pour le moment.</div>
          )}
          {categories.map(cat => (
            <div key={cat.id} className={styles.catRow}>
              {editId === cat.id ? (
                <div className={styles.editRow}>
                  <input
                    className={styles.input}
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(cat.id); if (e.key === 'Escape') setEditId(null); }}
                    autoFocus
                  />
                  <button className={styles.saveBtn} onClick={() => handleRename(cat.id)}>✓ Enregistrer</button>
                  <button className={styles.cancelBtn} onClick={() => setEditId(null)}>✕</button>
                </div>
              ) : (
                <>
                  <span className={styles.catName}>{cat.name}</span>
                  <div className={styles.catActions}>
                    <button className={styles.editBtn} onClick={() => { setEditId(cat.id); setEditName(cat.name ?? ''); }}>
                      ✏️ Renommer
                    </button>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(cat.id, cat.name)}>
                      🗑
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
