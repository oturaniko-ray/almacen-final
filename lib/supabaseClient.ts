import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Verificar si las variables existen (solo en runtime)
if (!supabaseUrl) {
  throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL en variables de entorno');
}

if (!supabaseAnonKey) {
  throw new Error('Falta NEXT_PUBLIC_SUPABASE_ANON_KEY en variables de entorno');
}

// Crear el cliente de Supabase (solo una vez)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);