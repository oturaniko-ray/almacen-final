'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { UserContext, UserContextType } from '@/lib/auth/context';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<UserContextType | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const loadUser = () => {
      const session = localStorage.getItem('user_session');
      
      if (!session) {
        router.replace('/');
        return;
      }

      try {
        const userData = JSON.parse(session);
        setUser(userData);
      } catch (error) {
        localStorage.removeItem('user_session');
        router.replace('/');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-blue-500 font-black animate-pulse">
          CARGANDO SISTEMA...
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // El useEffect redirigirá
  }

  // Determinar título según la ruta
  const getPageTitle = () => {
    if (pathname.includes('/admin/central')) return 'PANEL CENTRAL';
    if (pathname.includes('/admin/provincia')) return 'PANEL PROVINCIAL';
    if (pathname.includes('/admin/empleados')) return 'GESTIÓN DE EMPLEADOS';
    if (pathname.includes('/admin/flota')) return 'GESTIÓN DE FLOTA';
    return 'SISTEMA DE GESTIÓN';
  };

  return (
    <UserContext.Provider value={user}>
      <div className="min-h-screen bg-black text-white">
        {/* Barra superior con información del usuario */}
        <div className="bg-[#0f172a] border-b border-white/10 px-6 py-3 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4">
              <span className="text-lg font-black text-white">
                {getPageTitle()}
              </span>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400">|</span>
                <span className="text-blue-400 font-bold">
                  {user.rol === 'admin_central' ? '🏢 ADMIN CENTRAL' : '📍 ADMIN PROVINCIAL'}
                </span>
                {user.provinciaNombre && (
                  <span className="text-emerald-400">
                    {user.provinciaNombre}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-300">
                {user.nombre}
              </span>
              <button
                onClick={() => {
                  localStorage.removeItem('user_session');
                  router.push('/');
                }}
                className="text-xs bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 px-3 py-1.5 rounded-lg transition-colors"
              >
                CERRAR SESIÓN
              </button>
            </div>
          </div>
        </div>

        {/* Contenido principal */}
        <div className="max-w-7xl mx-auto p-6">
          {children}
        </div>
      </div>
    </UserContext.Provider>
  );
}