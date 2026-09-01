"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import type { OrderWithItems } from "../orders/page";
import { showAdminSuccess } from '@/lib/admin-success';
import { showAdminError } from '@/lib/admin-error';
import { ChevronDown, ChevronRight, X, ZoomIn } from 'lucide-react';

type GroupedProduct = {
  productId: string;
  productName: string;
  productImage: string;
  totalQuantity: number;
  items: {
    orderId: string;
    customerName: string;
    phone: string;
    quantity: number;
    colorName: string | null;
    colorHex1: string | null;
    colorImage: string | null;
    order: OrderWithItems;
  }[];
};

export default function StockPreparationPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/orders?status=confirmed&pageSize=100");
      if (response.ok) {
        const json = await response.json();
        const pendingOrders = (json.data || []).filter((o: OrderWithItems) => !o.cosmos_barcode);
        setOrders(pendingOrders);
      }
    } catch (error) {
      console.error("Failed to fetch preparation items:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const groupedProducts = useMemo(() => {
    const map = new Map<string, GroupedProduct>();
    
    orders.forEach(order => {
      order.order_items?.forEach(item => {
        if (!item.products) return;
        const pid = item.product_id;
        
        if (!map.has(pid)) {
          map.set(pid, {
            productId: pid,
            productName: item.products.title,
            productImage: item.products.image_url || '',
            totalQuantity: 0,
            items: []
          });
        }
        
        const group = map.get(pid)!;
        group.totalQuantity += (item.quantity || 1);
        
        // Find specific color image if available
        let colorImage = item.products.image_url;
        if (item.selected_color_name && item.products.color_options) {
          const colorOpt = item.products.color_options.find((c: any) => c.name === item.selected_color_name);
          if (colorOpt && colorOpt.image_url) {
            colorImage = colorOpt.image_url;
          }
        }
    
        group.items.push({
          orderId: order.id,
          customerName: order.customer_name,
          phone: order.phone,
          quantity: item.quantity || 1,
          colorName: item.selected_color_name,
          colorHex1: item.selected_color_hex1,
          colorImage: colorImage,
          order: order
        });
      });
    });
    
    return Array.from(map.values());
  }, [orders]);

  const toggleGroupExpand = (productId: string) => {
    const next = new Set(expandedGroups);
    if (next.has(productId)) {
      next.delete(productId);
    } else {
      next.add(productId);
    }
    setExpandedGroups(next);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectGroup = (group: GroupedProduct, checked: boolean) => {
    const next = new Set(selectedIds);
    group.items.forEach(item => {
      if (checked) next.add(item.orderId);
      else next.delete(item.orderId);
    });
    setSelectedIds(next);
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(orderId);
    else next.delete(orderId);
    setSelectedIds(next);
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

      const failedIds = data.failed ? data.failed.map((f: any) => f.id) : [];
      setOrders((prev) => prev.filter((o) => !selectedIds.has(o.id) || failedIds.includes(o.id)));
      setSelectedIds(new Set(failedIds));
      
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
    return <div className="p-8 text-gray-500 animate-pulse">Chargement des produits à préparer...</div>;
  }

  const isAllSelected = orders.length > 0 && selectedIds.size === orders.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < orders.length;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* --- Image Enlargement Modal --- */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" 
          onClick={() => setEnlargedImage(null)}
        >
          <button 
            className="absolute top-6 right-6 text-white hover:text-gray-300 p-2 bg-black/50 rounded-full" 
            onClick={() => setEnlargedImage(null)}
          >
            <X size={28} />
          </button>
          <div className="relative w-full max-w-3xl h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <Image
              src={enlargedImage}
              alt="Produit agrandi"
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>
        </div>
      )}

      {/* --- Header --- */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Préparation des Stocks</h1>
          <p className="text-sm text-gray-500 mt-1">
            Groupé par produit. Sélectionnez les commandes confirmées pour les expédier via Cosmos.
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

      {/* --- Main Table --- */}
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
              <th className="p-4 w-12"></th> {/* Expand icon */}
              <th className="p-4 font-semibold text-gray-600 text-sm">Produit Principal</th>
              <th className="p-4 font-semibold text-gray-600 text-sm">Commandes en attente</th>
              <th className="p-4 font-semibold text-gray-600 text-sm">Quantité à préparer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {groupedProducts.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-gray-500">
                  Aucun produit en attente de préparation.
                </td>
              </tr>
            ) : (
              groupedProducts.map((group) => {
                const isExpanded = expandedGroups.has(group.productId);
                
                // Group selection state
                const allGroupSelected = group.items.every(i => selectedIds.has(i.orderId));
                const someGroupSelected = group.items.some(i => selectedIds.has(i.orderId));
                const isGroupIndeterminate = someGroupSelected && !allGroupSelected;

                return (
                  <React.Fragment key={group.productId}>
                    {/* --- Product Group Row --- */}
                    <tr className={`hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-gray-50' : ''}`}>
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-nyvara-gold focus:ring-nyvara-gold w-4 h-4 cursor-pointer transition-colors"
                          checked={allGroupSelected}
                          ref={(input) => {
                            if (input) input.indeterminate = isGroupIndeterminate;
                          }}
                          onChange={(e) => handleSelectGroup(group, e.target.checked)}
                        />
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => toggleGroupExpand(group.productId)}
                          className="p-1 rounded-md hover:bg-gray-200 text-gray-500 transition-colors"
                        >
                          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-4">
                          <div 
                            className="relative w-14 h-14 rounded-md bg-gray-100 overflow-hidden border border-gray-200 cursor-pointer group/img"
                            onClick={() => {
                              if (group.productImage) setEnlargedImage(group.productImage);
                            }}
                          >
                            {group.productImage ? (
                              <>
                                <Image
                                  src={group.productImage}
                                  alt={group.productName}
                                  fill
                                  className="object-cover group-hover/img:scale-110 transition-transform duration-300"
                                  sizes="56px"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                  <ZoomIn className="text-white opacity-0 group-hover/img:opacity-100 drop-shadow-md" size={16} />
                                </div>
                              </>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">Img</div>
                            )}
                          </div>
                          <span className="text-sm font-bold text-gray-900">{group.productName}</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {group.items.length} client(s)
                      </td>
                      <td className="p-4 text-sm font-medium text-nyvara-gold">
                        {group.totalQuantity} article(s)
                      </td>
                    </tr>

                    {/* --- Expanded Orders Row --- */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="p-0 border-b border-gray-200">
                          <div className="bg-gray-50/50 p-4 pl-20 shadow-inner">
                            <table className="w-full text-left text-sm">
                              <thead>
                                <tr className="text-gray-500 border-b border-gray-200/60">
                                  <th className="pb-2 w-10 text-center">Sélection</th>
                                  <th className="pb-2">Couleur & Image</th>
                                  <th className="pb-2">Client</th>
                                  <th className="pb-2">ID Commande</th>
                                  <th className="pb-2 text-right pr-4">Quantité</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200/60">
                                {group.items.map((item, idx) => {
                                  const isChecked = selectedIds.has(item.orderId);
                                  return (
                                    <tr key={`${item.orderId}-${idx}`} className="hover:bg-white transition-colors">
                                      <td className="py-3 text-center">
                                        <input
                                          type="checkbox"
                                          className="rounded border-gray-300 text-nyvara-gold focus:ring-nyvara-gold w-4 h-4 cursor-pointer transition-colors"
                                          checked={isChecked}
                                          onChange={(e) => handleSelectOrder(item.orderId, e.target.checked)}
                                        />
                                      </td>
                                      <td className="py-3 flex items-center gap-3">
                                        <div 
                                          className="relative w-10 h-10 rounded border border-gray-200 bg-white overflow-hidden cursor-pointer group/img"
                                          onClick={() => {
                                            if (item.colorImage) setEnlargedImage(item.colorImage);
                                          }}
                                        >
                                          {item.colorImage ? (
                                            <>
                                              <Image 
                                                src={item.colorImage} 
                                                alt={item.colorName || 'Couleur'} 
                                                fill 
                                                className="object-cover group-hover/img:scale-110 transition-transform" 
                                              />
                                              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                                <ZoomIn className="text-white opacity-0 group-hover/img:opacity-100 drop-shadow-md" size={14} />
                                              </div>
                                            </>
                                          ) : (
                                            <div className="w-full h-full bg-gray-100" />
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {item.colorHex1 && (
                                            <div 
                                              className="w-3 h-3 rounded-full border border-gray-300 shadow-sm" 
                                              style={{ background: item.colorHex1 }} 
                                            />
                                          )}
                                          <span className="font-medium text-gray-800">{item.colorName || 'Standard'}</span>
                                        </div>
                                      </td>
                                      <td className="py-3">
                                        <div className="font-medium text-gray-900">{item.customerName}</div>
                                        <div className="text-xs text-gray-500">{item.phone}</div>
                                      </td>
                                      <td className="py-3 font-mono text-gray-500">#{item.orderId.slice(0, 8)}</td>
                                      <td className="py-3 text-right pr-4 font-bold text-gray-900">{item.quantity}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
