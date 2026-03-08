import { createBrowserSupabaseClient } from '@/lib/supabase/client-browser';
import { TurnoCreateSchema, AsignacionCreateSchema, AsignacionFilterSchema } from './validators';
import type { Turno, AsignacionTurno, VistaAsignacionCompleta } from './types';

// ============================================
// FUNCIONES PARA TURNOS
// ============================================

export async function crearTurno(data: unknown) {
  console.log('[SERVICE] Creando nuevo turno');
  
  try {
    const validatedData = TurnoCreateSchema.parse(data);
    const supabase = createBrowserSupabaseClient();
    
    const { data: turno, error } = await supabase
      .from('turnos')
      .insert({
        ...validatedData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw new Error(`Error al crear turno: ${error.message}`);
    return { success: true, data: turno };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

export async function obtenerTurnos(sucursalCodigo?: string) {
  console.log('[SERVICE] Obteniendo turnos');
  
  try {
    const supabase = createBrowserSupabaseClient();
    
    let query = supabase
      .from('turnos')
      .select('*')
      .eq('activo', true)
      .order('hora_inicio');
    
    if (sucursalCodigo) {
      query = query.eq('sucursal_codigo', sucursalCodigo);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return { success: true, data: data as Turno[] };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

export async function actualizarTurno(id: string, data: unknown) {
  console.log('[SERVICE] Actualizando turno:', id);
  
  try {
    const validatedData = TurnoCreateSchema.partial().parse(data);
    const supabase = createBrowserSupabaseClient();
    
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
  console.log('[SERVICE] Eliminando turno:', id);
  
  const supabase = createBrowserSupabaseClient();
  
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
  console.log('[SERVICE] Asignando turno a empleado');
  
  try {
    const validatedData = AsignacionCreateSchema.parse(data);
    const supabase = createBrowserSupabaseClient();
    
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
    
    // Crear la asignación
    const { data: asignacion, error } = await supabase
      .from('asignaciones_turno')
      .insert({
        turno_id: validatedData.turno_id,
        empleado_id: validatedData.empleado_id,
        fecha: validatedData.fecha,
        estado: validatedData.estado || 'asignado',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Obtener los datos completos del turno
    const { data: turnoData, error: turnoError } = await supabase
      .from('turnos')
      .select('nombre, hora_inicio, hora_fin')
      .eq('id', validatedData.turno_id)
      .single();
    
    if (turnoError) {
      console.error('Error obteniendo datos del turno:', turnoError);
      return { success: true, data: asignacion };
    }
    
    // Construir objeto con la estructura completa
    const asignacionCompleta = {
      asignacion_id: asignacion.id,
      fecha: asignacion.fecha,
      estado: asignacion.estado,
      empleado_id: asignacion.empleado_id,
      empleado_nombre: '',
      empleado_email: '',
      turno_id: asignacion.turno_id,
      turno_nombre: turnoData.nombre,
      hora_inicio: turnoData.hora_inicio,
      hora_fin: turnoData.hora_fin,
      sucursal_codigo: 'ALM01'
    };
    
    return { success: true, data: asignacionCompleta };
    
  } catch (error) {
    console.error('Error en asignarTurno:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

export async function obtenerAsignaciones(filtros: unknown) {
  console.log('[SERVICE] Obteniendo asignaciones');
  
  try {
    const validatedFilters = AsignacionFilterSchema.parse(filtros || {});
    const supabase = createBrowserSupabaseClient();
    
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
  console.log('[SERVICE] Actualizando estado asignación:', asignacionId);
  
  const supabase = createBrowserSupabaseClient();
  
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
  console.log('[SERVICE] Obteniendo turnos de empleado:', empleadoId);
  
  const supabase = createBrowserSupabaseClient();
  
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