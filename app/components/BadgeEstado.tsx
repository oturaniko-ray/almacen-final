'use client';
import React from 'react';

interface BadgeEstadoProps {
  activo: boolean;
  textoActivo?: string;
  textoInactivo?: string;
  className?: string;
}

export default function BadgeEstado({
  activo,
  textoActivo = 'ACTIVO',
  textoInactivo = 'INACTIVO',
  className = ''
}: BadgeEstadoProps) {
  return (
    <span className={`text-[9px] font-black px-2 py-1 rounded-full border ${
      activo
        ? 'text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10'
        : 'text-rose-500 border-rose-500/30 hover:bg-rose-500/10'
    } ${className}`}>
      {activo ? textoActivo : textoInactivo}
    </span>
  );
}