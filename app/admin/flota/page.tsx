'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/auth/context';

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
  const user = useUser();
  const router = useRouter();

  // ----- MEMBRETE SUPERIOR -----
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
            {user.nivel_acceso && ( // ✅ Solo mostrar si existe
              <span className="text-sm text-white ml-2">
                ({user.nivel_acceso})
              </span>
            )}
            {user.provinciaNombre && (
              <>
                <span className="text-sm text-white mx-2">•</span>
                <span className="text-sm text-emerald-400">
                  {user.provinciaNombre}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // ----- BOTÓN DE OPCIÓN -----
  const BotonOpcion = ({
    texto,
    icono,
    onClick,
    color,
    descripcion,
  }: {
    texto: string;
    icono: string;
    onClick: () => void;
    color: string;
    descripcion: string;
  }) => (
    <button
      onClick={onClick}
      className={`w-full ${color} p-6 rounded-xl border border-white/5 
        active:scale-95 transition-transform shadow-lg 
        flex flex-col items-center justify-center gap-3`}
    >
      <div className="w-14 h-14 rounded-full bg-black/30 border border-white/20 flex items-center justify-center">
        <span className="text-3xl">{icono}</span>
      </div>
      <div className="space-y-1">
        <h3 className="text-white font-bold uppercase text-[13px] tracking-wider">
          {texto}
        </h3>
        <p className="text-white/60 text-[9px] uppercase font-bold tracking-widest leading-relaxed">
          {descripcion}
        </p>
      </div>
    </button>
  );

  // ----- FOOTER -----
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
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm flex flex-col items-center">
        <Memebrete />

        <div className="w-full space-y-4">
          {/* GESTIÓN DE PERFILES */}
          <BotonOpcion
            texto="Gestión de Perfiles"
            icono="⚙️"
            onClick={() => router.push('/admin/flota/perfiles')}
            color="bg-blue-600"
            descripcion="Alta de choferes, capacidad de rutas y generación de Smart Pins F"
          />

          {/* REPORTES DE ACCESOS */}
          <BotonOpcion
            texto="Reporte de Flotas"
            icono="📅"
            onClick={() => router.push('/admin/flota/accesos')}
            color="bg-slate-700"
            descripcion="Historial de entradas y salidas de flota"
          />

          {/* AUDITORÍA */}
          <BotonOpcion
            texto="Auditoría"
            icono="📊"
            onClick={() => router.push('/admin/flota/auditoria')}
            color="bg-emerald-600"
            descripcion="Análisis de cumplimiento: Capacidad Nominal vs Carga Real"
          />
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