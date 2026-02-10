'use client';

import { ReactNode } from 'react';

interface BotonAccesoProps {
  texto: string;
  icono?: string | ReactNode;
  tipo?: 'primario' | 'secundario' | 'peligro' | 'exito' | 'neutral';
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export default function BotonAcceso({ 
  texto, 
  icono, 
  tipo = 'primario', 
  onClick, 
  disabled = false, 
  loading = false,
  fullWidth = true,
  className = ''
}: BotonAccesoProps) {
  
  const colores = {
    primario: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
    secundario: 'bg-slate-700 hover:bg-slate-600 active:bg-slate-700',
    peligro: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800',
    exito: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800',
    neutral: 'bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/10'
  };

  const estilosBase = `p-4 rounded-xl text-white font-bold uppercase italic 
    text-[11px] tracking-[0.1em] active:scale-95 transition-all shadow-lg 
    flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed
    ${fullWidth ? 'w-full' : ''} ${colores[tipo]} ${className}`;

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={estilosBase}
    >
      {icono && <span className="text-[1.4em]">{icono}</span>}
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
          <span className="w-2 h-2 bg-white rounded-full animate-pulse delay-150"></span>
          <span className="w-2 h-2 bg-white rounded-full animate-pulse delay-300"></span>
        </span>
      ) : (
        texto
      )}
    </button>
  );
}