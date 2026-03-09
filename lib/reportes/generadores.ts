import { createServerSupabaseClient } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';
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

  // Crear libro de Excel
  const wb = XLSX.utils.book_new();
  
  // Datos formateados
  const datos = (data || []).map(j => ({
    Fecha: format(new Date(j.fecha), 'dd/MM/yyyy', { locale: es }),
    Empleado: j.empleado_nombre,
    'Hora Entrada': j.hora_entrada ? format(new Date(j.hora_entrada), 'HH:mm:ss') : '',
    'Hora Salida': j.hora_salida ? format(new Date(j.hora_salida), 'HH:mm:ss') : '',
    'Horas Trabajadas': j.horas_trabajadas || 0,
    Estado: j.estado_jornada === 'presente' ? 'PRESENTE' : 
            j.estado_jornada === 'ausente' ? 'AUSENTE' : 'JUSTIFICADO'
  }));

  // Crear hoja
  const ws = XLSX.utils.json_to_sheet(datos);
  
  // Ajustar ancho de columnas
  const columnas = [
    { wch: 12 }, // Fecha
    { wch: 25 }, // Empleado
    { wch: 12 }, // Entrada
    { wch: 12 }, // Salida
    { wch: 10 }, // Horas
    { wch: 12 }, // Estado
  ];
  ws['!cols'] = columnas;

  // Agregar al libro
  XLSX.utils.book_append_sheet(wb, ws, 'Timesheet');

  // Convertir a buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  console.log(`✅ Timesheet generado: ${buffer.length} bytes`);
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
    { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 15 }
  ];
  ws['!cols'] = columnas;

  XLSX.utils.book_append_sheet(wb, ws, 'Comparativa');
  
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}