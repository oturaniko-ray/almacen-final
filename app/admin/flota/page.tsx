'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Función para formatear rol
const formatearRol = (rol: string): string => {
  if (!rol) return 'OPERADOR';
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

export default function SubmenuFlotaHub() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) {
      router.replace('/');
      return;
    }
    const currentUser = JSON.parse(sessionData);
    if (Number(currentUser.nivel_acceso) < 5) {
      router.replace('/admin');
      return;
    }
    setUser(currentUser);
  }, [router]);

  // ----- MEMBRETE SUPERIOR (sin subtítulo y sin línea) -----
  const Memebrete = () => {
    const titulo = "GESTOR DE FLOTA";
    const palabras = titulo.split(' ');
    const ultimaPalabra = palabras.pop();
    const primerasPalabras = palabras.join(' ');

    return (
      <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 text-center shadow-2xl mx-auto">
        <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
          <span className="text-white">{primerasPalabras} </span>
          <span className="text-blue-700">{ultimaPalabra}</span>
        </h1>
        {user && (
          <div className="mt-2">
            <span className="text-sm text-white normal-case">{user.nombre}</span>
            <span className="text-sm text-white mx-2">•</span>
            <span className="text-sm text-blue-500 normal-case">
              {formatearRol(user.rol)}
            </span>
            <span className="text-sm text-white ml-2">({user.nivel_acceso})</span>
          </div>
        )}
      </div>
    );
  };

  const BotonOpcion = ({
    texto,
    onClick,
    color,
    descripcion,
  }: {
    texto: string;
    onClick: () => void;
    color: string;
    descripcion: string;
  }) => (
    <button
      onClick={onClick}
      className={`w-full ${color} px-4 py-5 rounded-xl border border-white/5 
        active:scale-95 transition-transform shadow-lg 
        flex flex-col items-center justify-center gap-1 text-center`}
    >
      <span className="text-white font-black uppercase text-[13px] tracking-wider leading-tight">{texto}</span>
      <span className="text-white/60 text-[10px] uppercase font-bold tracking-widest leading-relaxed">{descripcion}</span>
    </button>
  );

  // ----- FOOTER (SIN LÍNEA SUPERIOR) -----
  const Footer = () => (
    <div className="w-full max-w-sm mt-8 pt-4 text-center mx-auto">
      <p className="text-[9px] text-white/40 uppercase tracking-widest mb-4">
        @Copyright 2026
      </p>
      <button
        onClick={() => router.push('/admin')}
        className="text-blue-500 font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 mx-auto active:scale-95 transition-transform"
      >
        <span className="text-lg">←</span> VOLVER AL SELECTOR
      </button>
    </div>
  );

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-start pt-10 px-4 pb-4 font-sans">
      <div className="w-full max-w-sm flex flex-col items-center">
        <Memebrete />

        <div className="w-full space-y-4">
          <BotonOpcion texto="GESTION DE PERFILES" onClick={() => router.push('/admin/flota/gestionflota')} color="bg-blue-600" descripcion="Alta de choferes, capacidad de rutas y generacion de Smart Pins" />

          <BotonOpcion texto="REPORTE DE FLOTAS" onClick={() => router.push('/admin/flota/reportes')} color="bg-slate-700" descripcion="Historial de entradas y salidas de flota" />

          <BotonOpcion texto="AUDITORIA" onClick={() => router.push('/admin/flota/auditoria')} color="bg-emerald-600" descripcion="Analisis de cumplimiento: Capacidad Nominal vs Carga Real" />
        </div>

        <Footer />
      </div>

      <style jsx global>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        @keyframes flash-fast { 0%, 100% { opacity: 1; } 10%, 30%, 50% { opacity: 0; } 20%, 40%, 60% { opacity: 1; } }
        .animate-flash-fast { animation: flash-fast 2s ease-in-out; }
      `}</style>
    </main>
  );
}