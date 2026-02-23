import { createClient } from '@supabase/supabase-js';

// Verificar si estamos en build (puedes usar una variable de entorno)
const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// En build, no lanzar error, solo mostrar advertencia
if (!supabaseUrl || !supabaseAnonKey) {
  if (isBuildTime) {
    console.warn('⚠️ Variables de Supabase no disponibles en build - usando cliente mock');
    // Exportar un cliente mock que no haga nada en build
    export const supabase = {} as any;
  } else {
    throw new Error('Faltan variables de entorno de Supabase');
  }
} else {
  export const supabase = createClient(supabaseUrl, supabaseAnonKey);
}