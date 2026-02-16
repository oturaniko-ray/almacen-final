'use client';
import React, { ChangeEvent, forwardRef } from 'react';

interface CampoEntradaProps {
  tipo?: 'text' | 'password' | 'email' | 'number';
  placeholder?: string;
  valor: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
  disabled?: boolean;
  textoCentrado?: boolean;
  mayusculas?: boolean;
  className?: string;
  label?: string;
  required?: boolean;
}

const CampoEntrada = forwardRef<HTMLInputElement, CampoEntradaProps>(({
  tipo = 'text',
  placeholder = '',
  valor,
  onChange,
  onEnter,
  autoFocus = false,
  disabled = false,
  textoCentrado = true,
  mayusculas = false,
  className = '',
  label,
  required = false
}, ref) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    let newVal = e.target.value;
    if (mayusculas) {
      newVal = newVal.toUpperCase();
    }
    onChange({
      ...e,
      target: { ...e.target, value: newVal }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onEnter) onEnter();
  };

  return (
    <div className="flex flex-col gap-0.5">
      {label && (
        <label className="text-[9px] font-black text-slate-500 uppercase ml-1">
          {label}
        </label>
      )}
      <input
        ref={ref}
        type={tipo}
        placeholder={placeholder}
        value={valor}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        disabled={disabled}
        required={required}
        className={`w-full bg-white/5 border border-white/10 p-2 rounded-xl text-[11px] font-bold text-white outline-none transition-colors
          disabled:opacity-70 disabled:cursor-not-allowed
          ${textoCentrado ? 'text-center' : ''} 
          ${mayusculas ? 'uppercase' : ''}
          ${tipo === 'password' ? 'tracking-[0.3em]' : ''}
          focus:border-blue-500/50 hover:border-white/20
          ${disabled ? 'border-blue-500/30 text-amber-400' : ''}
          ${className}`}
      />
    </div>
  );
});

CampoEntrada.displayName = 'CampoEntrada';

export default CampoEntrada;