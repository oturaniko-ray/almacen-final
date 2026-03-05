'use client';

// ============================================
// Cliente de Supabase para CLIENT COMPONENTS
// ============================================
// Este archivo se usa en componentes con 'use client'

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}