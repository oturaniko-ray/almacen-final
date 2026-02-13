'use client';
import { useEffect, useState } from 'react';
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

  const Memebrete = () => (
    <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-4 text-center shadow-2xl">
      <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
        <span className="text-white">GESTOR DE </span>
        <span className="text-blue-700">REPORTES</span>
      </h1>
      <p className="text-white font-bold text-[17px] uppercase tracking-widest mb-3">
        MENÚ PRINCIPAL
      </p>
      <div className="mt-2 pt-2 border-t border-white/10">
        <span className="text-sm text-white normal-case">{user.nombre}</span>
        <span className="text-sm text-white mx-2">•</span>
        <span className="text-sm text-blue-500 normal-case">{user.rol || 'Analista'}</span>
        <span className="text-sm text-white ml-2">({user.nivel_acceso || '0'})</span>
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
      <button
        onClick={() => router.push('/')}
        className="text-blue-500 font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 mx-auto"
      >
        <span className="text-lg">←</span> VOLVER AL SELECTOR
      </button>
    </div>
  );

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm flex flex-col items-center">
        <Memebrete />

        <div className="w-full space-y-4">
          <BotonOpcion
            texto="MONITOR DE PRESENCIA"
            descripcion="Visualización en tiempo real de empleados en almacén"
            icono="⏱️"
            onClick={() => router.push('/reportes/presencia')}
            color="bg-blue-600"
          />
          <BotonOpcion
            texto="REPORTE DE ACCESOS"
            descripcion="Historial de jornadas y accesos"
            icono="🏃‍♂️‍➡️"
            onClick={() => router.push('/reportes/accesos')}
            color="bg-slate-700"
          />
        </div>

        <Footer />
      </div>
    </main>
  );
}