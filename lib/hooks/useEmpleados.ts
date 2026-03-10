import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Empleado, EmpleadoInsert, EmpleadoUpdate } from '@/lib/types/empleados';

export function useEmpleados() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(false);

  const listar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('empleados')
      .select('*')
      .order('nombre', { ascending: true });
    
    if (error) {
      console.error('Error al listar empleados:', error);
      setLoading(false);
      return [];
    }
    setEmpleados(data || []);
    setLoading(false);
    return data as Empleado[];
  }, []);

  const insertar = useCallback(async (empleado: EmpleadoInsert) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('empleados')
      .insert([empleado])
      .select()
      .single();
    
    if (error) {
      console.error('Error al insertar empleado:', error);
      setLoading(false);
      return null;
    }
    setLoading(false);
    return data as Empleado;
  }, []);

  const actualizar = useCallback(async (id: string, updates: EmpleadoUpdate) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('empleados')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error al actualizar empleado:', error);
      setLoading(false);
      return null;
    }
    setLoading(false);
    return data as Empleado;
  }, []);

  const toggleActivo = useCallback(async (id: string, activoActual: boolean) => {
    setLoading(true);
    const { error } = await supabase
      .from('empleados')
      .update({ activo: !activoActual })
      .eq('id', id);
    
    if (error) {
      console.error('Error al cambiar estado:', error);
      setLoading(false);
      return false;
    }
    setLoading(false);
    return true;
  }, []);

  const generarPin = useCallback(async (sucursalCodigo: string) => {
    const { data, error } = await supabase
      .rpc('generar_pin_empleado', { p_sucursal_codigo: sucursalCodigo });
    
    if (error) {
      console.error('Error al generar PIN:', error);
      return null;
    }
    return data;
  }, []);

  return {
    empleados,
    loading,
    listar,
    insertar,
    actualizar,
    toggleActivo,
    generarPin
  };
}