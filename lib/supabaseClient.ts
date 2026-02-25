import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan variables de entorno de Supabase');
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