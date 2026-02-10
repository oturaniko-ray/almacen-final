'use client';

import { ReactNode } from 'react';

interface ContenedorPrincipalProps {
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export default function ContenedorPrincipal({ 
  children, 
  maxWidth = 'sm',
  padding = 'md',
  className = ''
}: ContenedorPrincipalProps) {
  
  const ancho = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full'
  };

  const espaciado = {
    sm: 'p-4',
    md: 'p-8',
    lg: 'p-10',
    xl: 'p-12'
  };

  const estilosBase = `w-full ${ancho[maxWidth]} bg-[#111111] ${espaciado[padding]} 
    rounded-[35px] border border-white/5 shadow-2xl ${className}`;

  return (
    <div className={estilosBase}>
      {children}
    </div>
  );
}