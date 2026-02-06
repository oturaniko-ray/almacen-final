'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ReportesMenuPage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // Recuperamos la sesión para verificar que el usuario tenga acceso
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) {
      setUser(JSON.parse(sessionData));
    } else {
      // Si no hay sesión, protegemos la ruta enviando al login
      router.push('/login');
    }
  }, [router]);

  // Evitamos renderizar contenido vacío mientras se valida la sesión
  if (!user) return null;

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans">
      {/* MEMBRETE VISUAL */}
      <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-4 text-center">
        <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
          <span className="text-white">REPORTES Y </span>
          <span className="text-blue-700">ANÁLISIS</span>
        </h1>
        <div className="mt-2 pt-2 border-t border-white/10">
          <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">
            USUARIO: {user.nombre}
          </p>
        </div>
      </div>

      {/* SELECTOR DE MÓDULOS DE REPORTES */}
      <div className="w-full max-w-sm bg-[#111111] p-8 rounded-[35px] border border-white/5 shadow-2xl space-y-3">
        <button 
          onClick={() => router.push('/reportes/presencia')} 
          className="w-full bg-blue-600 p-4 rounded-xl text-white font-bold transition-all active:scale-95 shadow-lg flex items-center"
        >
          <span className="text-left italic uppercase text-[11px] flex items-center">
            <span className="text-[1.4em] mr-3">⏱️</span> MONITOR DE PRESENCIA
          </span>
        </button>

        <button 
          onClick={() => router.push('/reportes/accesos')} 
          className="w-full bg-slate-700 p-4 rounded-xl text-white font-bold transition-all active:scale-95 shadow-lg flex items-center"
        >
          <span className="text-left italic uppercase text-[11px] flex items-center">
            <span className="text-[1.4em] mr-3">📅</span> REPORTE DE ACCESOS
          </span>
        </button>

        {/* BOTÓN DE RETORNO CORREGIDO PARA EVITAR 404 */}
        <button 
          onClick={() => router.push('/login')} 
          className="w-full text-blue-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-6 italic text-center py-2 border-t border-white/5 hover:text-blue-400 transition-colors"
        >
          ← VOLVER AL MENÚ PRINCIPAL
        </button>
      </div>
    </main>
  );
}