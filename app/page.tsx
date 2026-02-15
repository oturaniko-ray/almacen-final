'use client';
import { useRouter } from 'next/navigation';

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
            className="w-full bg-blue-600 p-4 rounded-xl border border-white/5 active:scale-95 transition-transform shadow-lg flex flex-col items-center justify-center gap-2"
          >
            <div className="w-14 h-14 rounded-full bg-black/30 border border-white/20 flex items-center justify-center">
              <span className="text-3xl">👤</span>
            </div>
            <span className="text-white font-bold uppercase text-[13px] tracking-wider">
              ACCESO PERSONAL
            </span>
          </button>

          <button
            onClick={() => router.push('/flota/login')}
            className="w-full bg-emerald-600 p-4 rounded-xl border border-white/5 active:scale-95 transition-transform shadow-lg flex flex-col items-center justify-center gap-2"
          >
            <div className="w-14 h-14 rounded-full bg-black/30 border border-white/20 flex items-center justify-center">
              <span className="text-3xl">🚛</span>
            </div>
            <span className="text-white font-bold uppercase text-[13px] tracking-wider">
              ACCESO CONDUCTORES
            </span>
          </button>
        </div>
{/* BOTÓN VOLVER ATRÁS (ir al selector inicial) */}
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