"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { OrderWithItems } from "../orders/page";
import { showAdminSuccess } from '@/lib/admin-success';
import { showAdminError } from '@/lib/admin-error';

export default function StockPreparationPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      // Fetching confirmed orders using the existing orders API route
      const response = await fetch("/api/orders?status=confirmed&pageSize=100");
      if (response.ok) {
        const json = await response.json();
        // Exclude orders that are already dispatched to Cosmos (have a barcode)
        const pendingOrders = (json.data || []).filter((o: OrderWithItems) => !o.cosmos_barcode);
        setOrders(pendingOrders);
      }
    } catch (error) {
      console.error("Failed to fetch preparation items:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDispatch = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Envoyer ${selectedIds.size} commande(s) à Cosmos ?`)) return;
    
    setIsSubmitting(true);

    try {
      const selectedOrders = orders.filter(o => selectedIds.has(o.id));
      
      const response = await fetch("/api/admin/cosmos-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: selectedOrders }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "L'envoi a échoué");
      }

      // If partial success, we only remove the ones that succeeded
      const failedIds = data.failed ? data.failed.map((f: any) => f.id) : [];
      setOrders((prev) => prev.filter((o) => !selectedIds.has(o.id) || failedIds.includes(o.id)));
      setSelectedIds(new Set(failedIds)); // Keep failed ones selected
      
      if (failedIds.length > 0) {
        showAdminError(`${failedIds.length} commande(s) n'ont pas pu être envoyées.`);
      } else {
        showAdminSuccess("Commandes envoyées à Cosmos avec succès !");
      }
    } catch (error: any) {
      console.error(error);
      showAdminError(error.message || "Une erreur est survenue lors de l'envoi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-gray-500 animate-pulse">Chargement des commandes confirmées...</div>;
  }

  const isAllSelected = orders.length > 0 && selectedIds.size === orders.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < orders.length;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Préparation des Stocks</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sélectionnez les commandes confirmées pour les expédier en lot via Cosmos.
          </p>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={fetchOrders}
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium shadow-sm hover:bg-gray-200 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            Actualiser
          </button>

          <button
            onClick={handleDispatch}
            disabled={selectedIds.size === 0 || isSubmitting}
            className="px-5 py-2.5 bg-nyvara-charcoal text-white rounded-lg font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              "Envoi en cours..."
            ) : (
              `Confirmer & Envoyer à Cosmos (${selectedIds.size})`
            )}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-4 w-12 text-center">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-nyvara-gold focus:ring-nyvara-gold w-4 h-4 cursor-pointer transition-colors"
                  checked={isAllSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isIndeterminate;
                  }}
                  onChange={handleSelectAll}
                />
              </th>
              <th className="p-4 font-semibold text-gray-600 text-sm">Produit</th>
              <th className="p-4 font-semibold text-gray-600 text-sm">Client & Info</th>
              <th className="p-4 font-semibold text-gray-600 text-sm">Quantité totale</th>
              <th className="p-4 font-semibold text-gray-600 text-sm">Commande ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-gray-500">
                  Aucune commande en attente de préparation.
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const isSelected = selectedIds.has(order.id);
                const firstItem = order.order_items?.[0];
                const totalQty = order.order_items?.reduce((acc, item) => acc + (item.quantity || 1), 0) || 0;
                const productNames = order.order_items?.map(i => i.products?.title).filter(Boolean).join(', ');

                return (
                  <tr
                    key={order.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      isSelected ? "bg-nyvara-gold/5" : ""
                    }`}
                  >
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-nyvara-gold focus:ring-nyvara-gold w-4 h-4 cursor-pointer transition-colors"
                        checked={isSelected}
                        onChange={(e) => handleSelectItem(order.id, e.target.checked)}
                      />
                    </td>
                    <td className="p-4">
                      <div className="relative w-12 h-12 rounded-md bg-gray-100 overflow-hidden border border-gray-200">
                        {firstItem?.products?.image_url ? (
                          <Image
                            src={firstItem.products.image_url}
                            alt={firstItem.products.title || "Product"}
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                            Img
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-bold text-gray-900">{order.customer_name}</div>
                      <div className="text-sm text-gray-600 truncate max-w-[250px]">{productNames}</div>
                    </td>
                    <td className="p-4 text-sm font-medium text-gray-700">
                      {totalQty} article(s)
                    </td>
                    <td className="p-4 text-sm text-gray-500 font-mono">
                      #{order.id.slice(0, 8)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
