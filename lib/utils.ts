import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utilidad para combinar clases de Tailwind condicionalmente
 * Ejemplo: cn('px-4 py-2', isActive && 'bg-blue-500', 'text-white')
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}