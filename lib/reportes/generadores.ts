import { createServerSupabaseClient } from '@/lib/supabase/client';
import * as XLSX from '@e965/xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export async function generarTimesheetExcel(filtros: { fecha_inicio: string; fecha_fin: string }) {
  console.log(`📊 Generando timesheet del ${filtros.fecha_inicio} al ${filtros.fecha_fin}`);
  
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('vista_jornadas_completa')
    .select('*')
    .gte('fecha', filtros.fecha_inicio)
    .lte('fecha', filtros.fecha_fin)
    .order('fecha', { ascending: true });

  if (error) throw new Error(`Error obteniendo datos: ${error.message}`);

  const wb = XLSX.utils.book_new();
  
  const datos = (data || []).map(j => ({
    Fecha: format(new Date(j.fecha), 'dd/MM/yyyy', { locale: es }),
    Empleado: j.empleado_nombre,
    'Hora Entrada': j.hora_entrada ? format(new Date(j.hora_entrada), 'HH:mm:ss') : '',
    'Hora Salida': j.hora_salida ? format(new Date(j.hora_salida), 'HH:mm:ss') : '',
    'Horas Trabajadas': j.horas_trabajadas || 0,
    Estado: j.estado_jornada === 'presente' ? 'PRESENTE' : 
            j.estado_jornada === 'ausente' ? 'AUSENTE' : 'JUSTIFICADO'
  }));

  const ws = XLSX.utils.json_to_sheet(datos);
  
  const columnas = [
    { wch: 12 }, // Fecha
    { wch: 25 }, // Empleado
    { wch: 12 }, // Entrada
    { wch: 12 }, // Salida
    { wch: 10 }, // Horas
    { wch: 12 }, // Estado
  ];
  ws['!cols'] = columnas;

  XLSX.utils.book_append_sheet(wb, ws, 'Timesheet');

  // ✅ CORREGIDO: Usar write con type 'buffer' y tipado correcto
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return buffer;
}

export async function generarComparativaExcel(filtros: { fecha_inicio: string; fecha_fin: string }) {
  console.log(`📊 Generando comparativa del ${filtros.fecha_inicio} al ${filtros.fecha_fin}`);
  
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('vista_asignaciones_completa')
    .select('*')
    .gte('fecha', filtros.fecha_inicio)
    .lte('fecha', filtros.fecha_fin)
    .order('fecha', { ascending: true });

  if (error) throw new Error(`Error obteniendo datos: ${error.message}`);

  const wb = XLSX.utils.book_new();
  
  const datos = (data || []).map(a => ({
    Fecha: format(new Date(a.fecha), 'dd/MM/yyyy', { locale: es }),
    Empleado: a.empleado_nombre,
    'Turno Asignado': a.turno_nombre || 'Sin turno',
    'Hora Inicio': a.hora_inicio?.slice(0,5) || '',
    'Hora Fin': a.hora_fin?.slice(0,5) || '',
    'Estado Asignación': a.estado === 'asignado' ? 'PENDIENTE' :
                         a.estado === 'confirmado' ? 'CONFIRMADO' :
                         a.estado === 'ausente' ? 'AUSENTE' : 'INTERCAMBIO'
  }));

  const ws = XLSX.utils.json_to_sheet(datos);
  
  const columnas = [
    { wch: 12 }, // Fecha
    { wch: 25 }, // Empleado
    { wch: 15 }, // Turno
    { wch: 10 }, // Inicio
    { wch: 10 }, // Fin
    { wch: 15 }, // Estado
  ];
  ws['!cols'] = columnas;

  XLSX.utils.book_append_sheet(wb, ws, 'Comparativa');
  
  // ✅ CORREGIDO: Usar write con type 'buffer' y tipado correcto
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return buffer;
}

export async function generarAusenciasExcel(filtros: { fecha_inicio: string; fecha_fin: string }) {
  console.log(`📊 Generando reporte de ausencias del ${filtros.fecha_inicio} al ${filtros.fecha_fin}`);
  
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('vista_solicitudes_completa')
    .select('*')
    .gte('fecha_inicio', filtros.fecha_inicio)
    .lte('fecha_fin', filtros.fecha_fin)
    .order('fecha_inicio', { ascending: true });

  if (error) throw new Error(`Error obteniendo datos: ${error.message}`);

  const wb = XLSX.utils.book_new();
  
  const datos = (data || []).map(s => ({
    Empleado: s.empleado_nombre,
    Tipo: s.tipo === 'vacacion' ? 'VACACIONES' :
          s.tipo === 'enfermedad' ? 'ENFERMEDAD' :
          s.tipo === 'personal' ? 'ASUNTOS PERSONALES' : s.tipo.toUpperCase(),
    'Fecha Inicio': new Date(s.fecha_inicio).toLocaleDateString('es-ES'),
    'Fecha Fin': new Date(s.fecha_fin).toLocaleDateString('es-ES'),
    Días: s.dias_solicitados,
    Estado: s.estado === 'aprobada' ? 'APROBADA' :
            s.estado === 'rechazada' ? 'RECHAZADA' : 'PENDIENTE',
    Motivo: s.motivo || '-'
  }));

  const ws = XLSX.utils.json_to_sheet(datos);
  
  const columnas = [
    { wch: 25 }, // Empleado
    { wch: 20 }, // Tipo
    { wch: 12 }, // Fecha Inicio
    { wch: 12 }, // Fecha Fin
    { wch: 8 },  // Días
    { wch: 12 }, // Estado
    { wch: 30 }, // Motivo
  ];
  ws['!cols'] = columnas;

  XLSX.utils.book_append_sheet(wb, ws, 'Ausencias');
  
  // ✅ CORREGIDO: Usar write con type 'buffer' y tipado correcto
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return buffer;
}