import { generarTimesheetExcel, generarComparativaExcel, generarAusenciasExcel } from './generadores';
import { enviarReportePorEmail } from '@/lib/email/reportes';
import { createServerSupabaseClient } from '@/lib/supabase/client';
import { format } from 'date-fns';

interface ReporteProgramado {
  id: string;
  tipo: 'timesheet' | 'comparativa' | 'ausencias';
  frecuencia: 'diario' | 'semanal' | 'mensual';
  destinatarios: string[];
  activo: boolean;
}

export async function ejecutarReportesProgramados() {
  const supabase = await createServerSupabaseClient();
  
  // Obtener reportes programados activos
  const { data: reportes } = await supabase
    .from('reportes_programados')
    .select('*')
    .eq('activo', true);

  if (!reportes) return;

  const fechaActual = new Date();
  const fechaInicio = format(fechaActual, 'yyyy-MM-dd');
  const fechaFin = format(fechaActual, 'yyyy-MM-dd');

  for (const reporte of reportes) {
    try {
      let buffer: Buffer;
      let filename: string;
      let subject: string;

      // ✅ CORREGIDO: Ahora manejamos buffers, no strings
      switch (reporte.tipo) {
        case 'timesheet':
          buffer = await generarTimesheetExcel({ fecha_inicio: fechaInicio, fecha_fin: fechaFin });
          filename = `timesheet_${fechaInicio}.xlsx`;
          subject = `Timesheet del ${fechaInicio}`;
          break;
        case 'comparativa':
          buffer = await generarComparativaExcel({ fecha_inicio: fechaInicio, fecha_fin: fechaFin });
          filename = `comparativa_${fechaInicio}.xlsx`;
          subject = `Comparativa del ${fechaInicio}`;
          break;
        case 'ausencias':
          buffer = await generarAusenciasExcel({ fecha_inicio: fechaInicio, fecha_fin: fechaFin });
          filename = `ausencias_${fechaInicio}.xlsx`;
          subject = `Reporte de ausencias del ${fechaInicio}`;
          break;
        default:
          continue;
      }

      // Enviar por email
      await enviarReportePorEmail(
        reporte.destinatarios,
        subject,
        `
          <h2>Reporte automático</h2>
          <p>Adjunto encontrarás el reporte generado automáticamente.</p>
          <p><small>Este es un correo automático del sistema de gestión.</small></p>
        `,
        [{
          filename,
          content: buffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }]
      );

      // Registrar ejecución exitosa
      await supabase.from('reportes_ejecuciones').insert({
        reporte_id: reporte.id,
        fecha_ejecucion: new Date().toISOString(),
        estado: 'exito'
      });

    } catch (error) {
      console.error(`Error ejecutando reporte ${reporte.id}:`, error);
      
      // Registrar error
      await supabase.from('reportes_ejecuciones').insert({
        reporte_id: reporte.id,
        fecha_ejecucion: new Date().toISOString(),
        estado: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }
}

// Función para programar ejecuciones (opcional)
export function iniciarProgramadorReportes() {
  // Ejecutar cada día a las 8:00 AM
  const ahora = new Date();
  const proximaEjecucion = new Date(
    ahora.getFullYear(),
    ahora.getMonth(),
    ahora.getDate(),
    8, 0, 0
  );
  
  if (proximaEjecucion < ahora) {
    proximaEjecucion.setDate(proximaEjecucion.getDate() + 1);
  }

  const tiempoHastaEjecucion = proximaEjecucion.getTime() - ahora.getTime();

  setTimeout(() => {
    ejecutarReportesProgramados();
    // Programar siguiente ejecución
    setInterval(ejecutarReportesProgramados, 24 * 60 * 60 * 1000);
  }, tiempoHastaEjecucion);
}