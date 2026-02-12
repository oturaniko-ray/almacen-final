'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ReportesMenuPage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) {
      router.push('/');
      return;
    }
    setUser(JSON.parse(sessionData));
  }, [router]);

  if (!user) return null;

  // ------------------------------------------------------------
  // COMPONENTES VISUALES INTERNOS (EXACTOS A LA CAPTURA)
  // ------------------------------------------------------------
  const Memebrete = () => (
    <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-4 text-center shadow-2xl">
      <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
        <span className="text-white">GESTOR DE </span>
        <span className="text-blue-700">ACCESO</span>
      </h1>
      <p className="text-white font-bold text-[17px] uppercase tracking-widest mb-3">
        MENÚ PRINCIPAL
      </p>
      <div className="mt-2 pt-2 border-t border-white/10">
        <span className="text-sm font-normal text-white uppercase">
          {user.nombre} · Reportes y Análisis ({user.nivel_acceso || '0'})
        </span>
      </div>
    </div>
  );

  const BotonOpcion = ({
    texto,
    icono,
    onClick,
    className = ''
  }: {
    texto: string;
    icono: string;
    onClick: () => void;
    className?: string;
  }) => (
    <button
      onClick={onClick}
      className={`w-full bg-[#0f172a] p-4 rounded-xl border border-white/5 
        transition-all duration-200 active:scale-95 shadow-lg 
        flex items-center justify-start gap-4 group
        ${className}`}
    >
      <span className="text-2xl group-hover:scale-110 transition-transform">{icono}</span>
      <span className="text-white font-black uppercase italic text-[11px] tracking-widest group-hover:text-white">
        {texto}
      </span>
    </button>
  );

  const Footer = () => (
    <div className="w-full max-w-sm mt-8 pt-4 border-t border-white/5 text-center">
      <p className="text-[9px] text-white/40 uppercase tracking-widest mb-4">
        @Copyright RayPérez 2026
      </p>
      <button
        onClick={() => {
          localStorage.clear();
          router.push('/');
        }}
        className="text-emerald-500 font-black uppercase text-[10px] tracking-[0.2em] italic flex items-center justify-center gap-2 mx-auto hover:text-emerald-400 transition-colors"
      >
        <span className="text-lg">🏠</span> CERRAR SESIÓN
      </button>
    </div>
  );

  // ------------------------------------------------------------
  // RENDERIZADO
  // ------------------------------------------------------------
  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm flex flex-col items-center">
        <Memebrete />

        <div className="w-full space-y-3">
          <BotonOpcion
            texto="MONITOR DE PRESENCIA"
            icono="⏱️"
            onClick={() => router.push('/reportes/presencia')}
            className="hover:bg-blue-600"
          />
          <BotonOpcion
            texto="REPORTE DE ACCESOS"
            icono="📅"
            onClick={() => router.push('/reportes/accesos')}
            className="hover:bg-slate-700"
          />
        </div>

        <Footer />
      </div>
    </main>
  );
}