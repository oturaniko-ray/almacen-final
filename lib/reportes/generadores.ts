import { createServerSupabaseClient } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export async function generarTimesheetExcel(filtros: any): Promise<string> {
  const supabase = await createServerSupabaseClient();
  
  // Obtener datos
  const { data } = await supabase
    .from('vista_jornadas_completa')
    .select('*')
    .gte('fecha', filtros.fecha_inicio)
    .lte('fecha', filtros.fecha_fin)
    .order('fecha', { ascending: true });
  
  // Crear Excel
  const wb = XLSX.utils.book_new();
  
  const datosFormateados = (data || []).map(j => ({
    Fecha: format(new Date(j.fecha), 'dd/MM/yyyy'),
    Empleado: j.empleado_nombre,
    'Hora Entrada': j.hora_entrada ? format(new Date(j.hora_entrada), 'HH:mm:ss') : '',
    'Hora Salida': j.hora_salida ? format(new Date(j.hora_salida), 'HH:mm:ss') : '',
    'Horas Trabajadas': j.horas_trabajadas,
    Estado: j.estado_jornada
  }));
  
  const ws = XLSX.utils.json_to_sheet(datosFormateados);
  XLSX.utils.book_append_sheet(wb, ws, 'Timesheet');
  
  // Guardar temporalmente (en producción, subir a storage)
  const fileName = `timesheet_${filtros.fecha_inicio}_${filtros.fecha_fin}.xlsx`;
  XLSX.writeFile(wb, fileName);
  
  // En producción, subir a Supabase Storage y devolver URL
  return fileName;
}

export async function generarTimesheetPDF(filtros: any): Promise<string> {
  const supabase = await createServerSupabaseClient();
  
  const { data } = await supabase
    .from('vista_jornadas_completa')
    .select('*')
    .gte('fecha', filtros.fecha_inicio)
    .lte('fecha', filtros.fecha_fin)
    .order('fecha', { ascending: true });
  
  const doc = new jsPDF();
  
  // Título
  doc.setFontSize(16);
  doc.text('Timesheet Semanal', 14, 22);
  
  doc.setFontSize(10);
  doc.text(`Período: ${filtros.fecha_inicio} al ${filtros.fecha_fin}`, 14, 30);
  
  // Tabla
  const tableData = (data || []).map(j => [
    format(new Date(j.fecha), 'dd/MM/yyyy'),
    j.empleado_nombre,
    j.hora_entrada ? format(new Date(j.hora_entrada), 'HH:mm') : '',
    j.hora_salida ? format(new Date(j.hora_salida), 'HH:mm') : '',
    j.horas_trabajadas?.toString() || '',
    j.estado_jornada
  ]);
  
  autoTable(doc, {
    head: [['Fecha', 'Empleado', 'Entrada', 'Salida', 'Horas', 'Estado']],
    body: tableData,
    startY: 40,
  });
  
  const fileName = `timesheet_${filtros.fecha_inicio}_${filtros.fecha_fin}.pdf`;
  doc.save(fileName);
  
  return fileName;
}

export async function generarComparativaExcel(filtros: any): Promise<string> {
  // Similar a timesheet pero con datos de comparativa
  return 'comparativa.xlsx';
}

export async function generarAusenciasExcel(filtros: any): Promise<string> {
  // Reporte de ausencias
  return 'ausencias.xlsx';
}