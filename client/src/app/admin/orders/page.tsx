'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { ShoppingBag, Archive, ArchiveRestore, CheckSquare, Eye, Truck, X } from 'lucide-react';
import Button from '@/components/ui/Button';
const OrderDetailsDrawer = dynamic(() => import('@/components/admin/OrderDetailsDrawer'), { ssr: false });
import StatusDropdown from '@/components/admin/StatusDropdown';
import type { Order, ColorOption } from '@/types';
import { showAdminError } from '@/lib/admin-error';
import { showAdminSuccess } from '@/lib/admin-success';
import adminStyles from '../admin.module.css';
import styles from './orders.module.css';

const AUTO_SYNC_INTERVAL = 2 * 60 * 1000;

const DELIVERY_STATUS: Record<string, { label: string; cls: string }> = {
  pending:              { label: 'En attente',    cls: 'pending'    },
  'to-be-picked':       { label: 'À ramasser',    cls: 'picking'    },
  'in-depot':           { label: 'Au dépôt',      cls: 'depot'      },
  'in-delivery':        { label: 'En livraison',  cls: 'delivering' },
  'to-be-verified':     { label: 'À vérifier',    cls: 'verify'     },
  'return-stock':       { label: 'Retour dépôt',  cls: 'returned'   },
  delivered:            { label: 'Livré ✓',       cls: 'delivered'  },
  'final-return':       { label: 'Retour final',  cls: 'returned'   },
  'received-return':    { label: 'Retour reçu',   cls: 'returned'   },
  'in-transfer':        { label: 'Inter-dépôt',   cls: 'transit'    },
  'return-in-transfer': { label: 'Inter-retour',  cls: 'returned'   },
};

export interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  quantity_break_price: number | null;
  selected_color_name: string | null;
  selected_color_hex1: string | null;
  selected_color_hex2: string | null;
  products: { id: string; title: string; price: number | null; discount: number | null; image_url: string | null; color_options: ColorOption[] | null; quantity_breaks: any[] | null } | null;
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
  archived: boolean;
  call_status: string;
  customer_order_count?: number;
  customer_has_delivered?: boolean;
  customer_has_returned?: boolean;
}

export default function AdminOrdersPage() {
  const [orders, setOrders]       = useState<OrderWithItems[]>([]);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [lastSync, setLastSync]   = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(AUTO_SYNC_INTERVAL / 1000);
  const ordersRef                 = useRef<OrderWithItems[]>([]);

  // Tabs: active vs archived
  const [viewArchived, setViewArchived] = useState(false);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Items modal
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);

  // Sync selected order with latest data from table
  useEffect(() => {
    if (selectedOrder) {
      const updated = orders.find(o => o.id === selectedOrder.id);
      if (updated && updated !== selectedOrder) {
        setSelectedOrder(updated);
      }
    }
  }, [orders, selectedOrder]);

  // Pagination
  const [page, setPage]             = useState(0);
  const [pageSize, setPageSize]     = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Reset page to 0 when search query changes
  useEffect(() => {
    setPage(0);
  }, [searchQuery]);

  // ── Confirm & dispatch ─────────────────────────────────────────────────────
  const confirmOrderAndDispatch = async (order: OrderWithItems) => {
    if (!confirm("Confirmer cette commande et l'envoyer à Cosmos ?")) return;
    setSyncing(true);
    try {
      const quantity = (order.order_items ?? []).reduce((s, i) => s + (i.quantity || 1), 0);
      const cosmosRes = await fetch('/api/cosmos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: order.customer_name, phone: order.phone,
          city: order.city, address: order.address, total_price: order.total_price, quantity, order_id: order.id,
          items: (order.order_items ?? []).map(i => ({
            quantity: i.quantity,
            name: i.products?.title || 'Unknown Product',
          })),
        }),
      });
      if (cosmosRes.ok) {
        const { data: delivery } = await cosmosRes.json();
        await fetch('/api/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: order.id,
            cosmos_barcode: delivery.barcode,
            cosmos_label_url: delivery.labelUrl,
            cosmos_label_pdf_url: delivery.labelPdfUrl,
            cosmos_status: delivery.status || 'to-be-picked',
            call_status: 'confirmed',
          }),
        });
        await fetchOrders();
        showAdminSuccess('Commande confirmée et envoyée à Cosmos !');
      } else { showAdminError('Erreur Cosmos: ' + await cosmosRes.text()); }
    } catch (err: any) { showAdminError('Erreur: ' + err.message); }
    setSyncing(false);
  };

  // ── Update call status ────────────────────────────────────────────────────
  const updateCallStatus = async (orderId: string, newStatus: string) => {
    await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId, call_status: newStatus }),
    });
    setOrders(prev =>
      prev.map(o => o.id === orderId ? { ...o, call_status: newStatus } : o)
    );
    showAdminSuccess('Statut mis à jour avec succès');
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    const from = page * pageSize;
    const to   = from + pageSize - 1;

    const _params = new URLSearchParams({
      page: String(page), pageSize: String(pageSize), archived: String(viewArchived),
    });
    if (searchQuery.trim()) _params.set('search', searchQuery.trim());
    const _fetchRes = await fetch('/api/orders?' + _params);
    const _fetchJson = await _fetchRes.json();
    const data = _fetchJson.data;
    const count = _fetchJson.count;

    if (data && data.length > 0) {
      const normalizePhone = (p: string | null | undefined) => {
        if (!p) return '';
        let num = p.replace(/[^\d+]/g, '');
        if (num.startsWith('+216')) return num.slice(4);
        if (num.startsWith('00216')) return num.slice(5);
        return num;
      };

      const phonesToQuery = new Set<string>();
      data.forEach((o: Partial<Order>) => {
        if (o.phone) {
          const norm = normalizePhone(o.phone);
          if (norm) {
            phonesToQuery.add(norm);
            phonesToQuery.add(`+216${norm}`);
            phonesToQuery.add(`00216${norm}`);
          }
        }
      });
      const phones = Array.from(phonesToQuery);

      if (phones.length > 0) {
        const _phoneRes = await fetch('/api/orders/phone-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phones })
        });
        const _phoneJson = await _phoneRes.json();
        const allPhoneOrders = _phoneJson.data;
        
        const phoneData: Record<string, { count: number; hasDelivered: boolean; hasReturned: boolean }> = {};
        if (allPhoneOrders) {
          for (const row of allPhoneOrders as { phone?: string | null; call_status?: string | null }[]) {
            if (row.phone) {
              const norm = normalizePhone(row.phone);
              if (!norm) continue;
              if (!phoneData[norm]) {
                phoneData[norm] = { count: 0, hasDelivered: false, hasReturned: false };
              }
              phoneData[norm].count += 1;
              const status = row.call_status;
              if (status === 'delivered') phoneData[norm].hasDelivered = true;
              if (status === 'returned') phoneData[norm].hasReturned = true;
            }
          }
        }
        
        const enrichedData = data.map((order: Order) => {
          const norm = normalizePhone(order.phone);
          return {
            ...order,
            customer_order_count: norm ? (phoneData[norm]?.count || 1) : 1,
            customer_has_delivered: norm ? (phoneData[norm]?.hasDelivered || false) : false,
            customer_has_returned: norm ? (phoneData[norm]?.hasReturned || false) : false,
          };
        });
        
        setOrders(enrichedData as OrderWithItems[]);
        ordersRef.current = enrichedData as OrderWithItems[];
      } else {
        setOrders(data as OrderWithItems[]);
        ordersRef.current = data as OrderWithItems[];
      }
    } else {
      setOrders([]);
      ordersRef.current = [];
    }
    if (count !== null) setTotalCount(count);
    setSelected(new Set());
    setLoading(false);
  }, [viewArchived, page, pageSize, searchQuery]);

  // ── Sync active shipments (manual button + on-mount) ──────────────────────
  const syncDeliveryStatus = useCallback(async (silent = false) => {
    if (!silent) setSyncing(true);
    try {
      const res = await fetch('/api/cosmos/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ok) {
        await fetchOrders();
        setLastSync(new Date());
      } else {
        if (!silent) console.warn('[Sync]', data.error || 'Unknown error');
      }
    } catch (err: any) {
      if (!silent) showAdminError('Erreur: ' + err.message);
    }
    if (!silent) setSyncing(false);
  }, [fetchOrders]);

  // Trigger fetchOrders when its dependencies change
  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  const hasSyncedOnMount = useRef(false);
  useEffect(() => {
    if (!loading && !hasSyncedOnMount.current) {
      hasSyncedOnMount.current = true;
      syncDeliveryStatus(true);
    }
  }, [loading, syncDeliveryStatus]);


  // ── Selection helpers ──────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === orders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(orders.map(o => o.id)));
    }
  };

  // ── Archive / Unarchive ────────────────────────────────────────────────────
  const archiveSelected = async () => {
    const ids   = Array.from(selected);
    const label = viewArchived ? 'désarchiver' : 'archiver';
    if (!confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} ${ids.length} commande(s) ?`)) return;
    await fetch('/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, archived: !viewArchived }),
    });
    await fetchOrders();
    showAdminSuccess(viewArchived ? 'Commandes désarchivées' : 'Commandes archivées');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <div className={adminStyles.contentArea}>Chargement...</div>;
  const allSelected = orders.length > 0 && selected.size === orders.length;
  const someSelected = selected.size > 0;

  const items      = selectedOrder?.order_items ?? [];
  const itemsTotal = items.reduce((s, i) => {
    const p = i.products;
    const unitPrice = i.quantity_break_price ?? (p?.discount != null && p.discount > 0
      ? (p.price ?? 0) * (1 - p.discount / 100)
      : (p?.price ?? 0));
    return s + unitPrice * i.quantity;
  }, 0);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Commandes</h1>
          {lastSync && (
            <span className="text-sm text-gray-500">
              Sync: {lastSync.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              <span className="mx-2 hidden sm:inline">·</span>
              <span className="hidden sm:inline">prochaine dans <strong>{countdown}s</strong></span>
            </span>
          )}
        </div>
        {!viewArchived && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="secondary" onClick={() => syncDeliveryStatus(false)} disabled={syncing} className="w-full sm:w-auto justify-center">
              {syncing ? '⟳ Sync...' : '⟳ Actualiser'}
            </Button>
            <Button variant="primary" onClick={() => setIsCreateDrawerOpen(true)} className="w-full sm:w-auto justify-center">
              + Ajouter
            </Button>
          </div>
        )}
      </div>

      {/* Search Input Filter */}
      <div className="relative">
        <input
          type="text"
          placeholder="Rechercher par nom de client ou téléphone..."
          className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-nyvara-gold focus:border-nyvara-gold block px-4 py-3 pr-10 shadow-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── Tabs & Bulk Actions ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto">
          <button
            className={`flex-1 sm:flex-none px-6 py-2 text-sm font-medium rounded-md transition-colors ${!viewArchived ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => { setPage(0); setViewArchived(false); setLoading(true); }}
          >
            Actives
          </button>
          <button
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 text-sm font-medium rounded-md transition-colors ${viewArchived ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => { setPage(0); setViewArchived(true); setLoading(true); }}
          >
            <Archive size={14} /> Archives
          </button>
        </div>

        {someSelected && (
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end bg-nyvara-gold/10 px-4 py-2 rounded-lg border border-nyvara-gold/20">
            <span className="flex items-center gap-2 text-sm font-medium text-nyvara-gold">
              <CheckSquare size={16} />
              {selected.size} {selected.size > 1 ? 'sélectionnées' : 'sélectionnée'}
            </span>
            <div className="flex gap-2">
              <button 
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-nyvara-charcoal hover:bg-black rounded-md transition-colors" 
                onClick={archiveSelected}
              >
                {viewArchived ? <><ArchiveRestore size={14} /> Désarchiver</> : <><Archive size={14} /> Archiver</>}
              </button>
              <button className="text-xs font-medium text-gray-500 hover:text-gray-700 underline" onClick={() => setSelected(new Set())}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Data Display (Table / Cards) ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-nyvara-gold bg-gray-100 border-gray-300 rounded focus:ring-nyvara-gold focus:ring-2 cursor-pointer"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    title="Tout sélectionner"
                  />
                </th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Produits</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Type Client</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map(order => {
                const delivery  = DELIVERY_STATUS[order.cosmos_status ?? ''];
                const itemCount = order.order_items?.length ?? 0;
                const isChecked = selected.has(order.id);

                return (
                  <tr key={order.id} className={`hover:bg-gray-50/80 transition-colors group ${isChecked ? 'bg-nyvara-gold/5' : ''}`}>
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-nyvara-gold bg-gray-100 border-gray-300 rounded focus:ring-nyvara-gold focus:ring-2 cursor-pointer"
                        checked={isChecked}
                        onChange={() => toggleSelect(order.id)}
                      />
                    </td>
                    <td className="px-4 py-2 text-gray-500 font-mono">#{order.id.slice(0, 8)}</td>
                    <td className="px-4 py-2 font-medium text-gray-900">{order.customer_name}</td>
                    <td className="px-4 py-2 text-gray-600">{order.phone}</td>
                    <td className="px-4 py-2">
                      <StatusDropdown value={order.call_status ?? 'pending'} onChange={newStatus => updateCallStatus(order.id, newStatus)} />
                    </td>
                    <td className="px-4 py-2">
                      <button className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-nyvara-gold bg-nyvara-gold/10 hover:bg-nyvara-gold/20 rounded-md transition-colors" onClick={() => { setSelectedOrder(order); setIsDrawerOpen(true); }}>
                        <ShoppingBag size={14} /> {itemCount} article{itemCount !== 1 ? 's' : ''}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-gray-900">{Number(order.total_price || 0).toFixed(3)} TND</td>
                    <td className="px-4 py-2">
                      {(() => {
                        const count = order.customer_order_count || 1;
                        if (order.customer_has_returned) return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-200">Client non sérieux</span>;
                        if (order.customer_has_delivered) return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200">Client fidèle</span>;
                        if (count > 1) return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">Client régulier</span>;
                        return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">Nouveau client</span>;
                      })()}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className={`p-1.5 rounded-md transition-colors ${order.cosmos_barcode ? 'text-green-500 bg-green-50 cursor-default' : 'text-blue-500 hover:text-blue-600 hover:bg-blue-50'}`}
                          onClick={order.cosmos_barcode ? undefined : () => confirmOrderAndDispatch(order)}
                          title={order.cosmos_barcode ? "Déjà envoyé à Cosmos" : "Envoyer à Cosmos"}
                          disabled={!!order.cosmos_barcode}
                        >
                          <Truck size={16} />
                        </button>
                        <button className="p-1.5 text-nyvara-gold hover:bg-nyvara-gold/10 rounded-md transition-colors" onClick={() => { setSelectedOrder(order); setIsDrawerOpen(true); }} title="Voir les détails">
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">{viewArchived ? 'Aucune commande archivée.' : 'Aucune commande pour le moment.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Stacked Cards (hidden on desktop) */}
        <div className="md:hidden divide-y divide-gray-100">
          {/* Mobile Select All */}
          {orders.length > 0 && (
            <div className="p-4 bg-gray-50 flex items-center justify-between border-b border-gray-200">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-nyvara-gold bg-gray-100 border-gray-300 rounded focus:ring-nyvara-gold focus:ring-2 cursor-pointer"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                />
                Tout sélectionner
              </label>
            </div>
          )}
          {orders.map(order => {
            const isChecked = selected.has(order.id);
            const itemCount = order.order_items?.length ?? 0;
            return (
              <div key={order.id} className={`p-4 space-y-4 ${isChecked ? 'bg-nyvara-gold/5' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 w-4 h-4 text-nyvara-gold bg-gray-100 border-gray-300 rounded focus:ring-nyvara-gold focus:ring-2 cursor-pointer"
                      checked={isChecked}
                      onChange={() => toggleSelect(order.id)}
                    />
                    <div>
                      <h3 className="font-bold text-gray-900">{order.customer_name}</h3>
                      <p className="text-sm text-gray-500 font-mono">#{order.id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-600 mt-1">{order.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-gray-900 text-lg block">{Number(order.total_price || 0).toFixed(3)} TND</span>
                    {(() => {
                        const count = order.customer_order_count || 1;
                        if (order.customer_has_returned) return <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">Non sérieux</span>;
                        if (order.customer_has_delivered) return <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">Fidèle</span>;
                        if (count > 1) return <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">Régulier</span>;
                        return <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Nouveau</span>;
                    })()}
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="w-40">
                    <StatusDropdown value={order.call_status ?? 'pending'} onChange={newStatus => updateCallStatus(order.id, newStatus)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className={`p-2 rounded-md transition-colors ${order.cosmos_barcode ? 'text-green-500 bg-green-50' : 'text-gray-500 bg-gray-100 hover:text-blue-600 hover:bg-blue-50'}`}
                      onClick={order.cosmos_barcode ? undefined : () => confirmOrderAndDispatch(order)}
                      disabled={!!order.cosmos_barcode}
                    >
                      <Truck size={16} />
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-nyvara-charcoal hover:bg-black rounded-md transition-colors" onClick={() => { setSelectedOrder(order); setIsDrawerOpen(true); }}>
                      <Eye size={14} /> Détails ({itemCount})
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {orders.length === 0 && (
            <div className="p-8 text-center text-gray-500">{viewArchived ? 'Aucune commande archivée.' : 'Aucune commande pour le moment.'}</div>
          )}
        </div>

        {/* Pagination footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between sm:px-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 hidden sm:block">Lignes par page :</span>
            <select
              className="text-sm border-gray-300 rounded-md py-1 pl-2 pr-8 focus:ring-nyvara-gold focus:border-nyvara-gold"
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700">
              Page <span className="font-medium">{page + 1}</span>
            </span>
            <div className="flex gap-1">
              <button
                className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-transparent"
                onClick={() => setPage(p => p - 1)}
                disabled={page === 0}
              >
                &larr;
              </button>
              <button
                className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-transparent"
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * pageSize >= totalCount}
              >
                &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Order Details Drawer ── */}
      <OrderDetailsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        order={selectedOrder}
        onOrderUpdated={fetchOrders}
        onStatusChange={(id, s) => {
          updateCallStatus(id, s);
          setSelectedOrder(prev => prev ? { ...prev, call_status: s } : null);
        }}
      />
      
      <OrderDetailsDrawer
        isOpen={isCreateDrawerOpen}
        onClose={() => setIsCreateDrawerOpen(false)}
        order={{
          id: 'new',
          created_at: new Date().toISOString(),
          customer_name: '',
          phone: '',
          city: '',
          address: '',
          customer_email: '',
          private_note: '',
          country: 'Tunisie',
          call_status: 'pending',
          cosmos_status: 'pending',
          total_price: 0,
          order_items: []
        } as unknown as OrderWithItems}
        mode="create"
        onOrderUpdated={() => {
          setIsCreateDrawerOpen(false);
          fetchOrders();
        }}
      />
    </div>
  );
}
