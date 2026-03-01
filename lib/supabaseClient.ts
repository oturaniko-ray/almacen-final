import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Singleton global para no recrear en hot-reload de desarrollo
const globalForSupabase = global as typeof global & {
  supabaseClient?: ReturnType<typeof createClient<Database>>;
};

function createSafeClient(): ReturnType<typeof createClient<Database>> {
  // Si no hay credenciales (p.ej. durante el build sin .env),
  // devolver un Proxy que no llama a createClient y no lanza errores.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      '⚠️ PROCESO DE BUILD: Faltan variables de entorno de Supabase. ' +
      'Las operaciones de BD fallarán en tiempo de ejecución si no se configuran.'
    );
    // Proxy vacío — no llama a createClient, no lanza en el build
    return new Proxy({} as ReturnType<typeof createClient<Database>>, {
      get(_target, prop: string) {
        // Permitir que el proceso de build acceda a propiedades sin error
        return () => {
          console.error(`Supabase no configurado. Llamada a .${prop}() ignorada.`);
          return Promise.resolve({ data: null, error: { message: 'Supabase no configurado' } });
        };
      },
    });
  }

  // En producción / dev normal — crear cliente real
  if (globalForSupabase.supabaseClient) {
    return globalForSupabase.supabaseClient;
  }

  const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForSupabase.supabaseClient = client;
  }

  return client;
}

export const supabase = createSafeClient();