'use server';

import { createServerSupabaseClient } from '@/lib/supabase/client';
import { revalidatePath } from 'next/cache';
import type { BulkEditOperation, BulkEditResult } from './types';

export async function actualizarEmpleadosMasivo(
  operacion: BulkEditOperation
): Promise<BulkEditResult> {
  console.log('🔵 Iniciando actualización masiva:', operacion);

  const resultado: BulkEditResult = {
    exitosos: 0,
    fallidos: 0,
    errores: []
  };

  try {
    const supabase = await createServerSupabaseClient();

    // Validar que hay empleados seleccionados
    if (!operacion.empleadosIds || operacion.empleadosIds.length === 0) {
      throw new Error('No hay empleados seleccionados');
    }

    // Validar que hay cambios
    if (Object.keys(operacion.cambios).length === 0) {
      throw new Error('No hay cambios para aplicar');
    }

    // Preparar datos de actualización
    const updates = operacion.empleadosIds.map(empleadoId => ({
      id: empleadoId,
      ...operacion.cambios,
      updated_at: new Date().toISOString()
    }));

    // Ejecutar actualizaciones en paralelo (pero controladas)
    const resultados = await Promise.allSettled(
      updates.map(async (update) => {
        const { error } = await supabase
          .from('empleados')
          .update(update)
          .eq('id', update.id);

        if (error) throw error;
        return update.id;
      })
    );

    // Procesar resultados
    resultados.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        resultado.exitosos++;
      } else {
        resultado.fallidos++;
        resultado.errores.push({
          empleado_id: operacion.empleadosIds[index],
          error: result.reason?.message || 'Error desconocido'
        });
      }
    });

    console.log('🟢 Actualización masiva completada:', resultado);
    
    // Revalidar rutas para actualizar datos
    revalidatePath('/admin/empleados');
    revalidatePath('/admin/empleados/masiva');

    return resultado;

  } catch (error) {
    console.error('🔴 Error en actualización masiva:', error);
    throw error;
  }
}

export async function obtenerEmpleadosParaSeleccion(filtros?: {
  sucursal?: string;
  rol?: string;
  activo?: boolean;
}) {
  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from('empleados')
    .select('id, nombre, documento_id, email, nivel_acceso, rol, activo, sucursal_origen')
    .order('nombre');

  if (filtros?.sucursal) {
    query = query.eq('sucursal_origen', filtros.sucursal);
  }
  if (filtros?.rol) {
    query = query.eq('rol', filtros.rol);
  }
  if (filtros?.activo !== undefined) {
    query = query.eq('activo', filtros.activo);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}