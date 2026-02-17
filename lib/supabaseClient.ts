// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// Verificar que las variables de entorno existen
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan variables de entorno de Supabase');
}

// Crear una sola instancia del cliente
export const supabase = createClient(supabaseUrl, supabaseAnonKey);