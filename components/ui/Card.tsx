'use client';

import { cn } from '../../lib/utils';

interface CardProps {
  variant?: 'default' | 'menta' | 'crema' | 'lila' | 'blanco';
  hover?: boolean;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ 
  variant = 'default', 
  hover = true, 
  children, 
  className = '',
  onClick
}: CardProps) {
  const variants = {
    default: 'bg-white/65 backdrop-blur-xl border border-white/80',
    menta: 'bg-gradient-to-br from-[#A8D5C5]/40 to-[#A8D5C5]/20 border border-[#A8D5C5]/50',
    crema: 'bg-gradient-to-br from-[#FFF5DC]/50 to-[#FFF5DC]/30 border border-[#FFDCB4]/40',
    lila: 'bg-gradient-to-br from-[#E0D5FF]/40 to-[#C4B5FF]/20 border border-[#C4B5FF]/50',
    blanco: 'bg-white/70 border border-white/60',
  };

  return (
    <div
      className={cn(
        'rounded-lg p-4 shadow-sm transition-all',
        variants[variant],
        hover && 'hover:shadow-lg hover:-translate-y-0.5',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}