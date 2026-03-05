// ============================================
// SERVICIO DE TURNOS - VERSIÓN CORREGIDA
// ============================================

import { createClient } from '@/lib/supabase/client'; // Este es el de server components
import { TurnoCreateSchema, AsignacionCreateSchema, AsignacionFilterSchema } from './validators';
import type { Turno, AsignacionTurno, VistaAsignacionCompleta } from './types';

// ============================================
// FUNCIONES PARA TURNOS
// ============================================

export async function crearTurno(data: unknown) {
  console.log('🟢 [SERVICE] Creando nuevo turno');
  
  try {
    const validatedData = TurnoCreateSchema.parse(data);
    console.log('✅ Datos validados:', validatedData.nombre);
    
    // Usar el nuevo cliente
    const supabase = createClient();
    
    const { data: turno, error } = await supabase
      .from('turnos')
      .insert({
        ...validatedData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('🔴 Error en BD:', error);
      throw new Error(`Error al crear turno: ${error.message}`);
    }
    
    console.log('✅ Turno creado con ID:', turno.id);
    return { success: true, data: turno };
    
  } catch (error) {
    console.error('🔴 Error en crearTurno:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

export async function obtenerTurnos(sucursalCodigo?: string) {
  console.log('🟢 [SERVICE] Obteniendo turnos');
  
  const supabase = createClient();
  
  let query = supabase
    .from('turnos')
    .select('*')
    .eq('activo', true)
    .order('hora_inicio');
  
  if (sucursalCodigo) {
    query = query.eq('sucursal_codigo', sucursalCodigo);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('🔴 Error:', error);
    return { success: false, error: error.message };
  }
  
  return { success: true, data: data as Turno[] };
}

export async function actualizarTurno(id: string, data: unknown) {
  console.log('🟢 [SERVICE] Actualizando turno:', id);
  
  try {
    const validatedData = TurnoCreateSchema.partial().parse(data);
    
    const supabase = createClient();
    
    const { data: turno, error } = await supabase
      .from('turnos')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    return { success: true, data: turno };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

export async function eliminarTurno(id: string) {
  console.log('🟢 [SERVICE] Eliminando turno:', id);
  
  const supabase = createClient();
  
  const { error } = await supabase
    .from('turnos')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

// ============================================
// FUNCIONES PARA ASIGNACIONES
// ============================================

export async function asignarTurno(data: unknown) {
  console.log('🟢 [SERVICE] Asignando turno a empleado');
  
  try {
    const validatedData = AsignacionCreateSchema.parse(data);
    
    const supabase = createClient();
    
    // Verificar que el empleado no tenga ya un turno ese día
    const { data: existente } = await supabase
      .from('asignaciones_turno')
      .select('id')
      .eq('empleado_id', validatedData.empleado_id)
      .eq('fecha', validatedData.fecha)
      .maybeSingle();
    
    if (existente) {
      return { 
        success: false, 
        error: 'El empleado ya tiene un turno asignado para esta fecha'
      };
    }
    
    const { data: asignacion, error } = await supabase
      .from('asignaciones_turno')
      .insert({
        ...validatedData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('✅ Asignación creada:', asignacion.id);
    return { success: true, data: asignacion };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

export async function obtenerAsignaciones(filtros: unknown) {
  console.log('🟢 [SERVICE] Obteniendo asignaciones');
  
  try {
    const validatedFilters = AsignacionFilterSchema.parse(filtros || {});
    const supabase = createClient();
    
    let query = supabase
      .from('vista_asignaciones_completa')
      .select('*');
    
    if (validatedFilters.fecha_inicio) {
      query = query.gte('fecha', validatedFilters.fecha_inicio);
    }
    if (validatedFilters.fecha_fin) {
      query = query.lte('fecha', validatedFilters.fecha_fin);
    }
    if (validatedFilters.empleado_id) {
      query = query.eq('empleado_id', validatedFilters.empleado_id);
    }
    if (validatedFilters.turno_id) {
      query = query.eq('turno_id', validatedFilters.turno_id);
    }
    if (validatedFilters.estado) {
      query = query.eq('estado', validatedFilters.estado);
    }
    
    const { data, error } = await query.order('fecha', { ascending: true });
    
    if (error) throw error;
    
    return { success: true, data: data as VistaAsignacionCompleta[] };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

export async function actualizarEstadoAsignacion(
  asignacionId: string, 
  nuevoEstado: 'confirmado' | 'ausente' | 'swap'
) {
  console.log('🟢 [SERVICE] Actualizando estado asignación:', asignacionId);
  
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('asignaciones_turno')
    .update({ 
      estado: nuevoEstado,
      updated_at: new Date().toISOString()
    })
    .eq('id', asignacionId)
    .select()
    .single();
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true, data };
}

export async function obtenerTurnosEmpleado(
  empleadoId: string,
  fechaInicio: string,
  fechaFin: string
) {
  console.log('🟢 [SERVICE] Obteniendo turnos de empleado:', empleadoId);
  
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('vista_asignaciones_completa')
    .select('*')
    .eq('empleado_id', empleadoId)
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)
    .order('fecha');
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true, data };
}