// app/componentes/NotificacionSistema.tsx
'use client';
import React, { useEffect, useState } from 'react';

interface NotificacionSistemaProps {
  mensaje: string;
  tipo: 'exito' | 'error' | 'advertencia' | 'info' | null;
  visible: boolean;
  duracion?: number;
  onCerrar?: () => void;
}

export default function NotificacionSistema({
  mensaje,
  tipo,
  visible,
  duracion = 3000,
  onCerrar
}: NotificacionSistemaProps) {
  const [mostrar, setMostrar] = useState(visible);

  useEffect(() => {
    setMostrar(visible);
    if (visible && duracion > 0) {
      const timer = setTimeout(() => {
        setMostrar(false);
        onCerrar?.();
      }, duracion);
      return () => clearTimeout(timer);
    }
  }, [visible, duracion, onCerrar]);

  if (!mostrar || !tipo) return null;

  const estilos = {
    exito: { barra: 'bg-emerald-500', card: 'border-emerald-500/20', etiq: 'text-emerald-400' },
    error: { barra: 'bg-rose-500', card: 'border-rose-500/20', etiq: 'text-rose-400' },
    advertencia: { barra: 'bg-amber-500', card: 'border-amber-500/20', etiq: 'text-amber-400' },
    info: { barra: 'bg-blue-500', card: 'border-blue-500/20', etiq: 'text-blue-400' },
  };

  const etiquetas = {
    exito: 'CORRECTO', error: 'ERROR', advertencia: 'ATENCION', info: 'INFO',
  };

  const e = estilos[tipo];

  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex items-stretch
      min-w-[280px] max-w-[90vw] rounded-xl shadow-2xl overflow-hidden
      bg-[#0a0f1e] border animate-flash-fast ${e.card}`}>
      {/* Barra lateral de color */}
      <div className={`w-[3px] flex-shrink-0 ${e.barra}`} />
      {/* Contenido */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={`text-[9px] font-black tracking-[0.2em] uppercase flex-shrink-0 ${e.etiq}`}>
          {etiquetas[tipo]}
        </span>
        <div className="w-px h-4 bg-white/10 flex-shrink-0" />
        <span className="text-[11px] font-semibold text-white">{mensaje}</span>
      </div>
    </div>
  );
}