'use server';

import { createServerSupabaseClient } from '@/lib/supabase/client';
import { revalidatePath } from 'next/cache';

export async function ofrecerTurnoAction(data: {
  turno_original_id: string;
  empleado_origen_id: string;
  fecha_turno: string;
  motivo?: string;
}) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Verificar que el turno existe y pertenece al empleado
    const { data: asignacion, error: errorAsignacion } = await supabase
      .from('asignaciones_turno')
      .select('*')
      .eq('id', data.turno_original_id)
      .eq('empleado_id', data.empleado_origen_id)
      .single();
    
    if (errorAsignacion || !asignacion) {
      return { success: false, error: 'Turno no encontrado o no te pertenece' };
    }
    
    // Verificar que no tenga ya un intercambio activo
    const { data: intercambioExistente } = await supabase
      .from('intercambios_turno')
      .select('id')
      .eq('turno_original_id', data.turno_original_id)
      .in('estado', ['disponible', 'solicitado'])
      .maybeSingle();
    
    if (intercambioExistente) {
      return { success: false, error: 'Este turno ya está en proceso de intercambio' };
    }
    
    // Crear intercambio
    const { data: intercambio, error } = await supabase
      .from('intercambios_turno')
      .insert({
        turno_original_id: data.turno_original_id,
        empleado_origen_id: data.empleado_origen_id,
        fecha_turno: data.fecha_turno,
        estado: 'disponible',
        motivo: data.motivo || null
      })
      .select()
      .single();
    
    if (error) throw error;
    
    revalidatePath('/mis-turnos');
    revalidatePath('/admin/intercambios');
    
    return { success: true, data: intercambio };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

export async function solicitarTurnoAction(intercambioId: string, empleadoDestinoId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Verificar que el intercambio está disponible
    const { data: intercambio, error: errorIntercambio } = await supabase
      .from('intercambios_turno')
      .select('*')
      .eq('id', intercambioId)
      .eq('estado', 'disponible')
      .single();
    
    if (errorIntercambio || !intercambio) {
      return { success: false, error: 'Intercambio no disponible' };
    }
    
    // No puede tomar su propio turno
    if (intercambio.empleado_origen_id === empleadoDestinoId) {
      return { success: false, error: 'No puedes tomar tu propio turno' };
    }
    
    // Actualizar intercambio
    const { data, error } = await supabase
      .from('intercambios_turno')
      .update({
        empleado_destino_id: empleadoDestinoId,
        estado: 'solicitado'
      })
      .eq('id', intercambioId)
      .select()
      .single();
    
    if (error) throw error;
    
    revalidatePath('/mis-turnos');
    revalidatePath('/admin/intercambios');
    
    return { success: true, data };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

export async function aprobarIntercambioAction(
  intercambioId: string, 
  aprobadoPor: string,
  accion: 'aprobar' | 'rechazar'
) {
  try {
    // ✅ ESTOS SON LOS LOGS QUE DEBES VER EN LA CONSOLA
    console.log('========== INICIANDO APROBACIÓN ==========');
    console.log('📌 Datos recibidos:', { intercambioId, aprobadoPor, accion });
    
    const supabase = await createServerSupabaseClient();
    
    // Verificar intercambio
    console.log('🔍 Buscando intercambio con ID:', intercambioId);
    const { data: intercambio, error: errorIntercambio } = await supabase
      .from('intercambios_turno')
      .select('*')
      .eq('id', intercambioId)
      .in('estado', ['disponible', 'solicitado'])
      .single();
    
    if (errorIntercambio) {
      console.error('❌ Error al buscar intercambio:', errorIntercambio);
    }
    
    console.log('📦 Intercambio encontrado:', intercambio);
    
    if (errorIntercambio || !intercambio) {
      console.error('❌ Intercambio no encontrado');
      return { success: false, error: 'Solicitud no encontrada' };
    }
    
    if (accion === 'aprobar') {
      console.log('✅ PROCESANDO APROBACIÓN');
      console.log('👤 empleado_destino_id actual:', intercambio.empleado_destino_id);
      
      // Determinar quién recibe el turno
      const empleadoDestino = intercambio.empleado_destino_id || intercambio.empleado_origen_id;
      console.log('🎯 empleadoDestino seleccionado:', empleadoDestino);
      
      // Actualizar la asignación original
      console.log('🔄 Actualizando asignación:', intercambio.turno_original_id);
      const { error: errorUpdate } = await supabase
        .from('asignaciones_turno')
        .update({ empleado_id: empleadoDestino })
        .eq('id', intercambio.turno_original_id);
      
      if (errorUpdate) {
        console.error('❌ Error actualizando asignación:', errorUpdate);
        throw errorUpdate;
      }
      console.log('✅ Asignación actualizada correctamente');
      
      // Marcar intercambio como aprobado
      console.log('🔄 Actualizando intercambio a APROBADO');
      const { error: errorIntercambioUpdate } = await supabase
        .from('intercambios_turno')
        .update({ 
          estado: 'aprobado',
          })
        .eq('id', intercambioId);
      
      if (errorIntercambioUpdate) {
        console.error('❌ Error actualizando intercambio:', errorIntercambioUpdate);
        throw errorIntercambioUpdate;
      }
      
      console.log('✅ Intercambio aprobado correctamente');
      
    } else {
      console.log('❌ PROCESANDO RECHAZO');
      // Rechazar intercambio
      const { error } = await supabase
        .from('intercambios_turno')
        .update({ 
          estado: 'rechazado',
          aprobado_por: aprobadoPor
        })
        .eq('id', intercambioId);
      
      if (error) throw error;
      console.log('✅ Intercambio rechazado correctamente');
    }
    
    revalidatePath('/mis-turnos');
    revalidatePath('/admin/intercambios');
    
    console.log('========== PROCESO COMPLETADO ==========');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error en aprobarIntercambioAction:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

export async function cancelarIntercambioAction(intercambioId: string, empleadoId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { error } = await supabase
      .from('intercambios_turno')
      .update({ estado: 'cancelado' })
      .eq('id', intercambioId)
      .eq('empleado_origen_id', empleadoId)
      .in('estado', ['disponible', 'solicitado']);
    
    if (error) throw error;
    
    revalidatePath('/mis-turnos');
    
    return { success: true };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}