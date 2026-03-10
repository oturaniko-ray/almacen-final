// lib/hooks/useSupabase.ts
import { supabase } from '@/lib/supabaseClient';
import { useNotificacion } from './useNotificacion';
import type { Empleado, TelegramUsuario } from '@/lib/types/entities';

export function useSupabase() {
  const { mostrarNotificacion } = useNotificacion();

  const empleados = {
    listar: async () => {
      const { data, error } = await supabase
        .from('empleados')
        .select('*')
        .order('nombre', { ascending: true });
      
      if (error) {
        mostrarNotificacion(`Error: ${error.message}`, 'error');
        return [];
      }
      return data as Empleado[];
    },

    insertar: async (empleado: Omit<Empleado, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('empleados')
        .insert([empleado])
        .select()
        .single();
      
      if (error) {
        mostrarNotificacion(`Error: ${error.message}`, 'error');
        return null;
      }
      return data as Empleado;
    },

    actualizar: async (id: string, updates: Partial<Empleado>) => {
      const { data, error } = await supabase
        .from('empleados')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        mostrarNotificacion(`Error: ${error.message}`, 'error');
        return null;
      }
      return data as Empleado;
    },

    toggleActivo: async (id: string, activo: boolean) => {
      const { error } = await supabase
        .from('empleados')
        .update({ activo: !activo })
        .eq('id', id);
      
      if (error) {
        mostrarNotificacion(`Error: ${error.message}`, 'error');
        return false;
      }
      return true;
    },

    generarPin: async (sucursalCodigo: string) => {
      const { data, error } = await supabase
        .rpc('generar_pin_empleado', { p_sucursal_codigo: sucursalCodigo });
      
      if (error) {
        mostrarNotificacion(`Error al generar PIN: ${error.message}`, 'error');
        return null;
      }
      return data;
    }
  };

  const telegram = {
    obtenerChatId: async (empleadoId: string) => {
      const { data, error } = await supabase
        .from('telegram_usuarios')
        .select('chat_id')
        .eq('empleado_id', empleadoId)
        .eq('activo', true)
        .maybeSingle();
      
      if (error) {
        console.error('Error obteniendo chat_id:', error);
        return null;
      }
      return data as { chat_id: string } | null;
    }
  };

  return { empleados, telegram };
}