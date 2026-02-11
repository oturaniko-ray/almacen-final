'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ReportesMenuPage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  // --------------------------------------------------------
  // 1. CARGAR SESIÓN Y VALIDAR ACCESO
  // --------------------------------------------------------
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
  // COMPONENTES VISUALES INTERNOS (ESTILO UNIFICADO)
  // ------------------------------------------------------------

  // ----- MEMBRETE SUPERIOR – EXACTAMENTE COMO LA CAPTURA -----
  const MemebreteSuperior = () => {
    const renderTituloBicolor = (texto: string) => {
      const palabras = texto.split(' ');
      const ultimaPalabra = palabras.pop();
      const primerasPalabras = palabras.join(' ');
      return (
        <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
          <span className="text-white">{primerasPalabras} </span>
          <span className="text-blue-700">{ultimaPalabra}</span>
        </h1>
      );
    };

    return (
      <div className="w-full max-w-4xl bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-6 text-center shadow-2xl mx-auto">
        {renderTituloBicolor('GESTOR DE ACCESO')}
        <p className="text-white font-bold text-[17px] uppercase tracking-widest mb-3">
          MENÚ PRINCIPAL
        </p>
        <div className="mt-2 pt-2 border-t border-white/10">
          <span className="text-sm font-normal text-white uppercase block">
            {user.nombre}  •  Reportes y Análisis  ({user.nivel_acceso || '0'})
          </span>
        </div>
      </div>
    );
  };

  // ----- BOTÓN DE OPCIÓN (CENTRADO) -----
  const BotonOpcion = ({
    texto,
    icono,
    onClick,
    color = 'bg-blue-600'
  }: {
    texto: string;
    icono: string;
    onClick: () => void;
    color?: string;
  }) => {
    return (
      <button
        onClick={onClick}
        className={`w-full ${color} p-8 rounded-[30px] border border-white/5 
          hover:scale-[1.02] transition-all shadow-2xl relative overflow-hidden active:scale-95
          flex flex-col items-center justify-center text-center group`}
      >
        <span className="text-4xl block mb-4 group-hover:scale-110 transition-transform">
          {icono}
        </span>
        <h3 className="text-lg font-black uppercase italic group-hover:text-white transition-colors">
          {texto}
        </h3>
      </button>
    );
  };

  // ------------------------------------------------------------
  // RENDERIZADO PRINCIPAL
  // ------------------------------------------------------------
  return (
    <main className="min-h-screen bg-black p-6 md:p-10 text-white font-sans">
      <div className="max-w-7xl mx-auto">

        {/* MEMBRETE SUPERIOR – EXACTAMENTE COMO LA CAPTURA */}
        <MemebreteSuperior />

        {/* GRID DE BOTONES – DOS OPCIONES CENTRADAS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-10 max-w-4xl mx-auto">
          
          {/* 1. MONITOR DE PRESENCIA */}
          <BotonOpcion
            texto="MONITOR DE PRESENCIA"
            icono="☝️"
            color="bg-blue-600"
            onClick={() => router.push('/reportes/presencia')}
          />

          {/* 2. REPORTE DE ACCESOS */}
          <BotonOpcion
            texto="REPORTE DE ACCESOS"
            icono="🏃‍♂️‍➡️"
            color="bg-slate-700"
            onClick={() => router.push('/reportes/accesos')}
          />

        </div>

        {/* BOTÓN VOLVER AL SELECTOR PRINCIPAL */}
        <div className="mt-16 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-blue-500 font-black uppercase text-[11px] tracking-widest hover:text-white transition-all underline underline-offset-8 decoration-slate-800"
          >
            ← VOLVER AL SELECTOR
          </button>
        </div>

      </div>

      {/* ESTILOS GLOBALES (mismos que en admin) */}
      <style jsx global>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        @keyframes flash-fast { 0%, 100% { opacity: 1; } 10%, 30%, 50% { opacity: 0; } 20%, 40%, 60% { opacity: 1; } }
        .animate-flash-fast { animation: flash-fast 2s ease-in-out; }
      `}</style>
    </main>
  );
}