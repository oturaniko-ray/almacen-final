'use client';
import React from 'react';

interface BotonIconoProps {
  icono: string;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

export default function BotonIcono({
  icono,
  onClick,
  color = 'bg-blue-600',
  disabled = false,
  type = 'button'
}: BotonIconoProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 ${color} rounded-xl border border-white/5 active:scale-95 transition-transform shadow-lg flex items-center justify-center disabled:opacity-50 text-white text-base`}
    >
      {icono}
    </button>
  );
}