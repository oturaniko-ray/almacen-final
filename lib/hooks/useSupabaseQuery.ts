// lib/hooks/useSupabaseQuery.ts
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient'; // ✅ CORREGIDO: @/lib no @lib
import { useNotificacion } from './useNotificacion'; // Asegúrate que el nombre del archivo sea correcto

interface QueryOptions<T = any> {
  table: string;
  select?: string;
  order?: { column: string; ascending?: boolean };
  filter?: { column: string; value: any }[];
  single?: boolean;
}

export function useSupabaseQuery<T = any>() {
  const [data, setData] = useState<T[] | T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { mostrarNotificacion } = useNotificacion();

  const fetchData = useCallback(async (options: QueryOptions<T>) => {
    setLoading(true);
    setError(null);

    try {
      let query = (supabase as any)
        .from(options.table)
        .select(options.select || '*');

      // Aplicar filtros
      if (options.filter) {
        options.filter.forEach(f => {
          query = query.eq(f.column, f.value);
        });
      }

      // Aplicar orden
      if (options.order) {
        query = query.order(options.order.column, { 
          ascending: options.order.ascending ?? true 
        });
      }

      // Ejecutar query
      const { data: result, error: queryError } = options.single
        ? await query.single()
        : await query;

      if (queryError) throw queryError;

      setData(result);
      return result;
    } catch (err: any) {
      setError(err.message);
      mostrarNotificacion(`Error: ${err.message}`, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [mostrarNotificacion]);

  const insertData = useCallback(async (table: string, records: any[]) => {
    setLoading(true);
    try {
      const { data: result, error } = await (supabase as any)
        .from(table)
        .insert(records)
        .select();

      if (error) throw error;
      mostrarNotificacion('Registro creado correctamente', 'exito');
      return result;
    } catch (err: any) {
      mostrarNotificacion(`Error: ${err.message}`, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [mostrarNotificacion]);

  const updateData = useCallback(async (table: string, id: string, updates: any) => {
    setLoading(true);
    try {
      const { data: result, error } = await (supabase as any)
        .from(table)
        .update(updates)
        .eq('id', id)
        .select();

      if (error) throw error;
      mostrarNotificacion('Registro actualizado correctamente', 'exito');
      return result;
    } catch (err: any) {
      mostrarNotificacion(`Error: ${err.message}`, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [mostrarNotificacion]);

  return {
    data,
    loading,
    error,
    fetchData,
    insertData,
    updateData
  };
}