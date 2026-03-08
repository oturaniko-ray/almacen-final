'use client';
import { useRouter } from 'next/navigation';

// SVG: Persona (usuario individual)
const IconPersona = () => (
  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </svg>
);

// SVG: Camión / flota
const IconCamion = () => (
  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
  </svg>
);

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* MEMBRETE */}
        <div className="w-full bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-6 text-center shadow-2xl">
          <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
            <span className="text-white">GESTOR DE </span>
            <span className="text-blue-700">ACCESO</span>
          </h1>
          <p className="text-white font-bold text-[17px] uppercase tracking-widest">
            SELECCIONE TIPO DE ACCESO
          </p>
        </div>

        {/* BOTONES DE OPCIÓN */}
        <div className="w-full space-y-4">
          <button
            onClick={() => router.push('/personal/login')}
            className="w-full bg-blue-600 hover:bg-blue-500 p-4 rounded-xl border border-white/5 active:scale-95 transition-all shadow-lg flex flex-col items-center justify-center gap-2"
          >
            <div className="w-14 h-14 rounded-full bg-black/30 border border-white/20 flex items-center justify-center">
              <IconPersona />
            </div>
            <span className="text-white font-bold uppercase text-[13px] tracking-wider">
              ACCESO PERSONAL
            </span>
          </button>

          <button
            onClick={() => router.push('/flota/login')}
            className="w-full bg-emerald-600 hover:bg-emerald-500 p-4 rounded-xl border border-white/5 active:scale-95 transition-all shadow-lg flex flex-col items-center justify-center gap-2"
          >
            <div className="w-14 h-14 rounded-full bg-black/30 border border-white/20 flex items-center justify-center">
              <IconCamion />
            </div>
            <span className="text-white font-bold uppercase text-[13px] tracking-wider">
              ACCESO CONDUCTORES
            </span>
          </button>
        </div>

        {/* BOTÓN VOLVER */}
        <div className="w-full max-w-sm mt-2 text-center">
          <button
            onClick={() => router.push('/selector')}
            className="text-slate-500 font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 mx-auto active:scale-95 transition-transform hover:text-white"
          >
            <span className="text-lg">←</span> VOLVER AL INICIO
          </button>
        </div>

        {/* FOOTER */}
        <div className="w-full max-w-sm mt-8 pt-4 text-center">
          <p className="text-[9px] text-white/40 uppercase tracking-widest">
            @Copyright 2026
          </p>
        </div>
      </div>
    </main>
  );
}