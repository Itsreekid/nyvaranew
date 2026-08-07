'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ShoppingCart, Package,
  LogOut, Tag, Menu, X, Users, Megaphone, TrendingUp,
} from 'lucide-react';
import { logoutAction } from '@/app/admin/actions';
import { useOrderNotification } from '@/hooks/useOrderNotification';
import OrderToast from '@/components/admin/OrderToast';
import ErrorToast from '@/components/admin/ErrorToast';
import SuccessToast from '@/components/admin/SuccessToast';
import type { Order } from '@/types';

interface Props {
  role: string;
  children: React.ReactNode;
}

export default function AdminShell({ role, children }: Props) {
  const pathname = usePathname();
  const [newOrder, setNewOrder] = useState<Order | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdmin = role === 'admin';

  useOrderNotification({ onNewOrder: (order) => setNewOrder(order) });

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const NavLink = ({ href, icon: Icon, children, exact = false }: any) => {
    const isActive = exact ? pathname === href : pathname.startsWith(href);
    return (
      <Link 
        href={href} 
        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium ${isActive ? 'bg-nyvara-gold text-white shadow-md' : 'text-gray-300 hover:bg-white/10 hover:text-white'}`}
      >
        <Icon size={20} />
        <span>{children}</span>
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden font-sans">
      <OrderToast order={newOrder} onClose={() => setNewOrder(null)} />
      <ErrorToast />
      <SuccessToast />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-nyvara-charcoal text-white transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col shadow-2xl ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between h-20 px-6 bg-black/50 border-b border-white/10">
          <div className="text-2xl font-bold tracking-[0.2em] text-nyvara-gold">NYVARA</div>
          <button className="md:hidden text-gray-400 hover:text-white p-2" onClick={() => setSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20">
          {isAdmin && <NavLink href="/admin" icon={LayoutDashboard} exact>Tableau de bord</NavLink>}
          <NavLink href="/admin/orders" icon={ShoppingCart}>Commandes</NavLink>
          {isAdmin && <NavLink href="/admin/products" icon={Package}>Produits</NavLink>}
          {isAdmin && <NavLink href="/admin/categories" icon={Tag}>Catégories</NavLink>}
          {isAdmin && <NavLink href="/admin/employees" icon={Users}>Employés</NavLink>}
          {isAdmin && <NavLink href="/admin/catalog-ad" icon={Megaphone}>Catalog Ad</NavLink>}
          {isAdmin && <NavLink href="/admin/trending" icon={TrendingUp}>Tendances</NavLink>}
        </nav>

        <div className="p-4 border-t border-white/10 bg-black/20">
          <form action={logoutAction}>
            <button type="submit" className="flex items-center justify-center gap-3 w-full px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors font-medium">
              <LogOut size={20} />
              <span>Déconnexion</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Toggle menu"
            >
              <Menu size={24} />
            </button>
            <div className="text-xl font-semibold text-gray-800 tracking-tight hidden sm:block">
              {isAdmin ? "Espace d'administration" : 'Espace employé'}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-sm font-semibold text-gray-900">{isAdmin ? 'Admin' : 'Employé'}</span>
              <span className="text-xs text-gray-500">NYVARA Team</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-nyvara-gold flex items-center justify-center text-white font-bold shadow-md">
              {isAdmin ? 'A' : 'E'}
            </div>
          </div>
        </header>

        {/* Scrollable Main Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50/50">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
