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

  const colores = {
    exito: 'bg-emerald-500 border-emerald-400',
    error: 'bg-rose-500 border-rose-400',
    advertencia: 'bg-amber-500 border-amber-400',
    info: 'bg-blue-500 border-blue-400',
  };
  const iconos = {
    exito: '✅',
    error: '❌',
    advertencia: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-xl
        font-bold text-sm shadow-2xl animate-flash-fast max-w-[90%] text-center
        border-2 ${colores[tipo]} text-white flex items-center gap-3`}
    >
      <span className="text-lg">{iconos[tipo]}</span>
      <span>{mensaje}</span>
    </div>
  );
}