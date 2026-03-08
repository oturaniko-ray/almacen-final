'use server';

import { createServerSupabaseClient } from '@/lib/supabase/client';
import { SolicitudAusenciaSchema, AprobacionSchema, calcularDiasEntreFechas } from './validators';

export async function crearSolicitudAction(data: unknown) {
  try {
    const validatedData = SolicitudAusenciaSchema.parse(data);
    const dias = calcularDiasEntreFechas(validatedData.fecha_inicio, validatedData.fecha_fin);
    
    const supabase = await createServerSupabaseClient();
    
    const { data: solicitud, error } = await supabase
      .from('solicitudes_ausencia')
      .insert({
        ...validatedData,
        dias_solicitados: dias,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw new Error(`Error al crear solicitud: ${error.message}`);
    return { success: true, data: solicitud };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

export async function obtenerSolicitudesAction(filtros?: { estado?: string; empleado_id?: string }) {
  const supabase = await createServerSupabaseClient();
  
  let query = supabase
    .from('vista_solicitudes_completa')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (filtros?.estado) {
    query = query.eq('estado', filtros.estado);
  }
  
  if (filtros?.empleado_id) {
    query = query.eq('empleado_id', filtros.empleado_id);
  }
  
  const { data, error } = await query;
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true, data: data || [] };
}

export async function obtenerSaldoEmpleadoAction(empleadoId: string) {
  const supabase = await createServerSupabaseClient();
  const anio = new Date().getFullYear();
  
  const { data, error } = await supabase
    .from('saldo_ausencias')
    .select('*')
    .eq('empleado_id', empleadoId)
    .eq('anio', anio);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  const conDisponibles = (data || []).map(item => ({
    ...item,
    dias_disponibles: item.dias_totales - item.dias_usados
  }));
  
  return { success: true, data: conDisponibles };
}

export async function aprobarSolicitudAction(data: unknown, supervisorId: string) {
  try {
    const validatedData = AprobacionSchema.parse(data);
    
    const supabase = await createServerSupabaseClient();
    
    const { data: solicitud, error } = await supabase
      .from('solicitudes_ausencia')
      .update({
        estado: validatedData.estado,
        aprobado_por: supervisorId,
        comentario_supervisor: validatedData.comentario || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', validatedData.solicitud_id)
      .select()
      .single();
    
    if (error) throw error;
    
    if (validatedData.estado === 'aprobada') {
      await actualizarSaldoEmpleado(solicitud.empleado_id, solicitud.tipo, solicitud.dias_solicitados);
    }
    
    return { success: true, data: solicitud };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

async function actualizarSaldoEmpleado(empleadoId: string, tipo: string, dias: number) {
  const supabase = await createServerSupabaseClient();
  const anio = new Date().getFullYear();
  
  const { data: saldoExistente } = await supabase
    .from('saldo_ausencias')
    .select('*')
    .eq('empleado_id', empleadoId)
    .eq('tipo', tipo)
    .eq('anio', anio)
    .maybeSingle();
  
  if (saldoExistente) {
    await supabase
      .from('saldo_ausencias')
      .update({
        dias_usados: saldoExistente.dias_usados + dias,
        updated_at: new Date().toISOString()
      })
      .eq('empleado_id', empleadoId)
      .eq('tipo', tipo)
      .eq('anio', anio);
  } else {
    const diasTotales = tipo === 'vacacion' ? 15 : 6;
    await supabase
      .from('saldo_ausencias')
      .insert({
        empleado_id: empleadoId,
        tipo,
        anio,
        dias_totales: diasTotales,
        dias_usados: dias,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
  }
}