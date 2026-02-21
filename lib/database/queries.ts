import { supabase } from '@/lib/supabaseClient';
import { UserContextType } from '@/lib/auth/context';

// =====================================================
// EMPLEADOS
// =====================================================
export const getEmpleados = async (user: UserContextType) => {
  let query = supabase.from('empleados').select('*');
  
  if (user.rol !== 'admin_central' && user.provinciaId) {
    query = query.eq('provincia_id', user.provinciaId);
  }
  
  const { data } = await query.order('nombre');
  return data || [];
};

export const getEmpleado = async (id: string, user: UserContextType) => {
  let query = supabase.from('empleados').select('*').eq('id', id);
  
  if (user.rol !== 'admin_central' && user.provinciaId) {
    query = query.eq('provincia_id', user.provinciaId);
  }
  
  const { data } = await query.single();
  return data;
};

export const createEmpleado = async (empleado: any, user: UserContextType) => {
  const dataToInsert = {
    ...empleado,
    provincia_id: user.rol === 'admin_central' ? empleado.provincia_id : user.provinciaId
  };
  
  // ✅ SOLUCIÓN: usar 'as never' para evitar el error de tipos
  const { data, error } = await supabase
    .from('empleados')
    .insert([dataToInsert as never])
    .select()
    .single();
    
  if (error) throw error;
  return data;
};

export const updateEmpleado = async (id: string, empleado: any, user: UserContextType) => {
  // Validar que el empleado pertenezca a la provincia del usuario
  const empleadoExistente = await getEmpleado(id, user);
  if (!empleadoExistente) {
    throw new Error('Empleado no encontrado o no pertenece a su provincia');
  }

  // ✅ SOLUCIÓN: usar 'as never' para evitar el error de tipos
  const { data, error } = await supabase
    .from('empleados')
    .update(empleado as never)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteEmpleado = async (id: string, user: UserContextType) => {
  const empleadoExistente = await getEmpleado(id, user);
  if (!empleadoExistente) {
    throw new Error('Empleado no encontrado o no pertenece a su provincia');
  }

  const { error } = await supabase
    .from('empleados')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
};

// =====================================================
// FLOTA PERFIL
// =====================================================
export const getFlotaPerfiles = async (user: UserContextType) => {
  let query = supabase.from('flota_perfil').select('*');
  
  if (user.rol !== 'admin_central' && user.provinciaId) {
    query = query.eq('provincia_id', user.provinciaId);
  }
  
  const { data } = await query.order('nombre_completo');
  return data || [];
};

export const createFlotaPerfil = async (perfil: any, user: UserContextType) => {
  const dataToInsert = {
    ...perfil,
    provincia_id: user.rol === 'admin_central' ? perfil.provincia_id : user.provinciaId
  };
  
  // ✅ SOLUCIÓN: usar 'as never' para evitar el error de tipos
  const { data, error } = await supabase
    .from('flota_perfil')
    .insert([dataToInsert as never])
    .select()
    .single();
    
  if (error) throw error;
  return data;
};

// =====================================================
// FLOTA CARGA
// =====================================================
export const getFlotaCarga = async (user: UserContextType) => {
  let query = supabase.from('flota_carga').select('*');
  
  if (user.rol !== 'admin_central' && user.provinciaId) {
    query = query.eq('provincia_id', user.provinciaId);
  }
  
  const { data } = await query.order('hora_llegada', { ascending: false });
  return data || [];
};

// =====================================================
// JORNADAS CONSOLIDADAS
// =====================================================
export const getJornadas = async (user: UserContextType, fecha?: Date) => {
  let query = supabase.from('jornadas_consolidadas').select(`
    *,
    empleados:empleado_id (nombre, documento_id)
  `);
  
  if (user.rol !== 'admin_central' && user.provinciaId) {
    query = query.eq('provincia_id', user.provinciaId);
  }
  
  if (fecha) {
    const startOfDay = new Date(fecha);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(fecha);
    endOfDay.setHours(23, 59, 59, 999);
    
    query = query
      .gte('creado_en', startOfDay.toISOString())
      .lte('creado_en', endOfDay.toISOString());
  }
  
  const { data } = await query.order('creado_en', { ascending: false });
  return data || [];
};

// =====================================================
// REPORTES AUDITORIA
// =====================================================
export const getReportesAuditoria = async (user: UserContextType, fecha?: Date) => {
  let query = supabase.from('reportes_auditoria').select(`
    *,
    empleados:empleado_id (nombre, documento_id)
  `);
  
  if (user.rol !== 'admin_central' && user.provinciaId) {
    query = query.eq('provincia_id', user.provinciaId);
  }
  
  if (fecha) {
    query = query.eq('fecha_proceso', fecha.toISOString().split('T')[0]);
  }
  
  const { data } = await query.order('created_at', { ascending: false });
  return data || [];
};