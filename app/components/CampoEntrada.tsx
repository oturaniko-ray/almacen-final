'use client';

import { forwardRef } from 'react';

interface CampoEntradaProps {
  tipo?: 'text' | 'password' | 'email' | 'number' | 'date';
  placeholder?: string;
  valor: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
  disabled?: boolean;
  textoCentrado?: boolean;
  mayusculas?: boolean;
  className?: string;
}

const CampoEntrada = forwardRef<HTMLInputElement, CampoEntradaProps>(
  function CampoEntrada({
    tipo = 'text',
    placeholder = '',
    valor,
    onChange,
    onEnter,
    autoFocus = false,
    disabled = false,
    textoCentrado = true,
    mayusculas = false,
    className = ''
  }, ref) {
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && onEnter) {
        onEnter();
      }
    };

    const estilosBase = `w-full bg-white/5 border border-white/10 p-4 rounded-xl 
      text-[11px] font-bold text-white outline-none transition-colors
      disabled:opacity-50 disabled:cursor-not-allowed
      ${textoCentrado ? 'text-center' : ''} 
      ${mayusculas ? 'uppercase' : ''}
      ${tipo === 'password' ? 'tracking-[0.4em]' : ''}
      focus:border-blue-500/50 hover:border-white/20
      ${className}`;

    return (
      <input
        ref={ref}
        type={tipo}
        placeholder={placeholder}
        value={valor}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        disabled={disabled}
        className={estilosBase}
      />
    );
  }
);

export default CampoEntrada;