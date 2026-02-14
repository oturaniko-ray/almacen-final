'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Función para formatear rol
const formatearRol = (rol: string): string => {
  if (!rol) return 'USUARIO';
  const rolLower = rol.toLowerCase();
  switch (rolLower) {
    case 'admin':
    case 'administrador':
      return 'ADMINISTRADOR';
    case 'supervisor':
      return 'SUPERVISOR';
    case 'tecnico':
      return 'TÉCNICO';
    case 'empleado':
      return 'EMPLEADO';
    default:
      return rol.toUpperCase();
  }
};

export default function SelectorPage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) {
      router.replace('/');
      return;
    }
    setUser(JSON.parse(sessionData));
  }, [router]);

  const logout = () => {
    localStorage.clear();
    router.push('/');
  };

  const obtenerBotonesDisponibles = () => {
    const nivel = Number(user?.nivel_acceso || 0);
    const tienePermisoReportes = user?.permiso_reportes === true;

    const todosLosBotones = [
      {
        label: 'ACCESO EMPLEADO',
        icono: '🫆',
        ruta: '/empleado',
        minNivel: 1,
        color: 'bg-emerald-600',
      },
      {
        label: 'PANEL SUPERVISOR',
        icono: '🕖',
        ruta: '/supervisor',
        minNivel: 3,
        color: 'bg-blue-600',
      },
      {
        label: 'REPORTES Y ANÁLISIS',
        icono: '📊',
        ruta: '/reportes',
        minNivel: 3,
        color: 'bg-slate-700',
        requiereReportes: true,
      },
      {
        label: 'GESTIÓN ADMINISTRATIVA',
        icono: '👥',
        ruta: '/admin',
        minNivel: 4,
        color: 'bg-amber-600',
      },
      {
        label: 'CONFIGURACIÓN MAESTRA',
        icono: '👨‍🔧',
        ruta: '/configuracion',
        minNivel: 8,
        color: 'bg-rose-900',
      },
    ];

    return todosLosBotones.filter((btn) => {
      if (nivel < btn.minNivel) return false;
      if (btn.requiereReportes && !tienePermisoReportes) return false;
      if (nivel === 3) return btn.ruta === '/empleado' || btn.ruta === '/supervisor';
      if (nivel === 4) {
        if (btn.ruta === '/reportes') return tienePermisoReportes;
        return btn.ruta === '/empleado' || btn.ruta === '/supervisor' || btn.ruta === '/admin';
      }
      if (nivel === 5) return btn.ruta !== '/configuracion';
      if (nivel >= 6 && nivel <= 7) return btn.ruta !== '/configuracion';
      return true;
    });
  };

  if (!user) return null;

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* MEMBRETE */}
        <div className="w-full bg-[#1a1a1a] p-4 rounded-[25px] border border-white/5 mb-3 text-center shadow-2xl">
          <h1 className="text-lg font-black italic uppercase tracking-tighter leading-none mb-2">
            <span className="text-white">GESTOR DE </span>
            <span className="text-blue-700">ACCESO</span>
          </h1>
          <p className="text-white font-bold text-[15px] uppercase tracking-widest mb-2">
            MENÚ PRINCIPAL
          </p>
          <div className="mt-2 pt-2 border-t border-white/10">
            <span className="text-xs text-white normal-case">{user.nombre}</span>
            <span className="text-xs text-white mx-2">•</span>
            <span className="text-xs text-blue-500 normal-case">
              {formatearRol(user.rol)}
            </span>
            <span className="text-xs text-white ml-2">({user.nivel_acceso})</span>
          </div>
        </div>

        {/* BOTONES DE OPCIÓN */}
        <div className="w-full flex flex-col gap-2">
          {obtenerBotonesDisponibles().map((btn) => (
            <button
              key={btn.ruta}
              onClick={() => router.push(btn.ruta)}
              className={`w-full ${btn.color} p-2 rounded-xl border border-white/5 active:scale-95 transition-transform shadow-lg flex flex-col items-center justify-center gap-1`}
            >
              <div className="w-10 h-10 rounded-full bg-black/30 border border-white/20 flex items-center justify-center">
                <span className="text-xl">{btn.icono}</span>
              </div>
              <span className="text-white font-bold uppercase text-[10px] tracking-wider">
                {btn.label}
              </span>
            </button>
          ))}
        </div>

        {/* BOTÓN CERRAR SESIÓN */}
        <div className="w-full max-w-sm mt-6 pt-3 text-center">
          <p className="text-[9px] text-white/40 uppercase tracking-widest mb-3">
            @Copyright 2026
          </p>
          <button
            onClick={logout}
            className="text-emerald-500 font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 mx-auto active:scale-95 transition-transform"
          >
            <span className="text-lg">🏠</span> CERRAR SESIÓN
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes flash-fast {
          0%, 100% { opacity: 1; }
          10%, 30%, 50% { opacity: 0; }
          20%, 40%, 60% { opacity: 1; }
        }
        .animate-flash-fast {
          animation: flash-fast 2s ease-in-out;
        }
      `}</style>
    </main>
  );
}