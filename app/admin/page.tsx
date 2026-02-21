'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/auth/context'; // ✅ Usar el contexto

export default function PanelAdminHub() {
  const user = useUser(); // ✅ Obtener usuario del contexto
  const router = useRouter();

  // ===== FUNCIÓN DE NAVEGACIÓN =====
  const volverAlSelector = () => {
    console.log('→ Saliendo del módulo admin al selector inicial');
    router.push('/selector');
  };

  // Si no hay usuario, el middleware ya debería redirigir
  // Pero por seguridad, verificamos
  if (!user) {
    return null;
  }

  const nivel = Number(user.nivel_acceso) || 0;
  const permisoReportes = user.permiso_reportes === true;

  const Memebrete = () => (
    <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-4 text-center shadow-2xl">
      <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
        <span className="text-white">GESTIÓN </span>
        <span className="text-blue-700">ADMINISTRATIVA</span>
      </h1>
      <p className="text-white font-bold text-[17px] uppercase tracking-widest mb-3">
        MENÚ PRINCIPAL
      </p>
      <div className="mt-2 pt-2 border-t border-white/10">
        <span className="text-sm text-white normal-case">{user.nombre}</span>
        <span className="text-sm text-white mx-2">•</span>
        <span className="text-sm text-blue-500 normal-case">{user.rol || 'Administrador'}</span>
        <span className="text-sm text-white ml-2">({user.nivel_acceso})</span>
        {user.provinciaNombre && (
          <>
            <span className="text-sm text-white mx-2">•</span>
            <span className="text-sm text-emerald-400">{user.provinciaNombre}</span>
          </>
        )}
      </div>
    </div>
  );

  const BotonOpcion = ({
    texto,
    descripcion,
    icono,
    onClick,
    color,
  }: {
    texto: string;
    descripcion: string;
    icono: string;
    onClick: () => void;
    color: string;
  }) => (
    <button
      onClick={onClick}
      className={`w-full ${color} p-4 rounded-xl border border-white/5 
        active:scale-95 transition-transform shadow-lg 
        flex flex-col items-center justify-center gap-2`}
    >
      <div className="w-14 h-14 rounded-full bg-black/30 border border-white/20 flex items-center justify-center">
        <span className="text-3xl">{icono}</span>
      </div>
      <span className="text-white font-bold uppercase text-[11px] tracking-wider">
        {texto}
      </span>
      <span className="text-white/60 text-[9px] uppercase font-bold tracking-widest leading-relaxed">
        {descripcion}
      </span>
    </button>
  );

  const Footer = () => (
    <div className="w-full max-w-sm mt-8 pt-4 border-t border-white/5 text-center">
      <p className="text-[9px] text-white/40 uppercase tracking-widest mb-4">
        @Copyright 2026
      </p>
      <div className="flex flex-col gap-2">
        <button
          onClick={volverAlSelector}
          className="text-blue-500 font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 mx-auto hover:text-blue-400 transition-colors"
        >
          <span className="text-lg">←</span> VOLVER AL SELECTOR
        </button>
        <button
          onClick={() => {
            localStorage.removeItem('user_session');
            router.push('/');
          }}
          className="text-slate-500 font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 mx-auto hover:text-white transition-colors"
        >
          <span className="text-lg">🏠</span> CERRAR SESIÓN
        </button>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm flex flex-col items-center">
        <Memebrete />

        <div className="w-full space-y-4">
          {nivel >= 4 && (
            <BotonOpcion
              texto="GESTOR DE EMPLEADOS"
              descripcion="Alta, baja y modificación de personal. Generación de PINs P"
              icono="👥"
              onClick={() => router.push('/admin/empleados')}
              color="bg-amber-600"
            />
          )}
          {(nivel >= 5 || (nivel === 4 && permisoReportes)) && (
            <BotonOpcion
              texto="AUDITORÍA"
              descripcion="Análisis de eficiencia y reportes de auditoría"
              icono="🔍"
              onClick={() => router.push('/admin/auditoria')}
              color="bg-blue-600"
            />
          )}
          {nivel >= 5 && (
            <BotonOpcion
              texto="FLOTA"
              descripcion="Gestión de perfiles de flota y control de accesos"
              icono="🚛"
              onClick={() => router.push('/admin/flota')}
              color="bg-emerald-600"
            />
          )}
        </div>

        <Footer />
      </div>
    </main>
  );
}