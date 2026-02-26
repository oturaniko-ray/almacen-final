import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('⚠️ PROCESO DE BUILD: Faltan variables de entorno de Supabase. Usando placeholders para compilar.');
}

// Prevenir múltiples instancias en desarrollo
const globalForSupabase = global as typeof global & {
  supabaseClient?: ReturnType<typeof createClient<Database>>;
};

export const supabase =
  globalForSupabase.supabaseClient ??
  createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.supabaseClient = supabase;
}