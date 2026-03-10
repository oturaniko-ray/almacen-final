'use client';

import { cn } from '@/lib/utils';  // ← CORREGIDO: @/lib no @lib

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export function Button({ 
  variant = 'primary',
  size = 'md',
  icon,
  children,
  onClick,
  disabled = false,
  fullWidth = false,
  className = ''
}: ButtonProps) {
  const variants = {
    primary: 'bg-gradient-to-r from-[#FF8A8A] to-[#A8D5FF] text-[#1F2937] hover:shadow-glow-coral',
    secondary: 'bg-white/30 backdrop-blur-sm border border-white/60 text-[#374151] hover:bg-white/40',
    outline: 'border-2 border-[#A8D5C5] text-[#374151] hover:bg-[#A8D5C5]/10',
    ghost: 'text-[#374151] hover:bg-white/20',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
    >
      <span className="flex items-center justify-center gap-2">
        {icon && <span className="w-4 h-4">{icon}</span>}
        {children}
      </span>
    </button>
  );
}