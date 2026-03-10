'use client';

import { cn } from '@/lib/utils';  // ← CORREGIDO: @/lib no @lib

interface BadgeProps {
  variant?: 'coral' | 'menta' | 'azul' | 'lila' | 'warning' | 'success';
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
}

export function Badge({ 
  variant = 'coral', 
  children, 
  className = '',
  animate = false
}: BadgeProps) {
  const variants = {
    coral: 'bg-gradient-to-br from-[#FFB5A1]/90 to-[#FFC8B4]/85 border border-[#FFB5A1]/60 shadow-glow-coral',
    menta: 'bg-gradient-to-br from-[#A8D5C5]/90 to-[#C8F0E0]/85 border border-[#A8D5C5]/60 shadow-glow-menta',
    azul: 'bg-gradient-to-br from-[#8AB8FF]/90 to-[#B8E4F0]/85 border border-[#8AB8FF]/60 shadow-glow-azul',
    lila: 'bg-gradient-to-br from-[#E0D5FF]/90 to-[#C4B5FF]/85 border border-[#C4B5FF]/60',
    warning: 'bg-gradient-to-br from-[#FFE8C0]/90 to-[#FFDBA4]/85 border border-[#FFDBA4]/60',
    success: 'bg-gradient-to-br from-[#A8D5C5]/90 to-[#6FBAA0]/85 border border-[#6FBAA0]/60',
  };

  return (
    <div
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium inline-flex items-center gap-1',
        variants[variant],
        animate && 'animate-pulse',
        className
      )}
    >
      {children}
    </div>
  );
}