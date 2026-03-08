import { createServerSupabaseClient } from '@/lib/supabase/client';
import { generarTimesheetExcel, generarComparativaExcel, generarAusenciasExcel } from './generadores';
import type { ReporteProgramado } from './types';

export class ReporteScheduler {
  private supabase: any;

  constructor() {
    // Inicializar sin cliente, se creará bajo demanda
  }

  private async getClient() {
    if (!this.supabase) {
      this.supabase = await createServerSupabaseClient();
    }
    return this.supabase;
  }

  // Calcular próxima fecha de envío
  calcularProximaFecha(reporte: Partial<ReporteProgramado>): Date | null {
    const ahora = new Date();
    const [hora, minuto] = (reporte.hora_envio || '08:00').split(':').map(Number);
    
    let fecha = new Date();
    fecha.setHours(hora, minuto, 0, 0);
    
    if (fecha <= ahora) {
      // Si ya pasó hoy, programar para próximo período
      switch (reporte.frecuencia) {
        case 'diario':
          fecha.setDate(fecha.getDate() + 1);
          break;
        case 'semanal':
          fecha.setDate(fecha.getDate() + (7 - fecha.getDay() + (reporte.dia_semana || 1)));
          break;
        case 'mensual':
          fecha.setMonth(fecha.getMonth() + 1);
          fecha.setDate(reporte.dia_mes || 1);
          break;
        case 'trimestral':
          fecha.setMonth(fecha.getMonth() + 3);
          break;
      }
    }
    
    return fecha;
  }

  // Actualizar próximos envíos
  async actualizarProximosEnvios() {
    const supabase = await this.getClient();
    
    const { data: reportes, error } = await supabase
      .from('reportes_programados')
      .select('*')
      .eq('activo', true);
    
    if (error) throw error;
    
    for (const reporte of reportes) {
      const proximoEnvio = this.calcularProximaFecha(reporte);
      
      await supabase
        .from('reportes_programados')
        .update({ proximo_envio: proximoEnvio?.toISOString() })
        .eq('id', reporte.id);
    }
  }

  // Generar y enviar reportes pendientes
  async ejecutarEnviosPendientes() {
    const supabase = await this.getClient();
    const ahora = new Date();
    
    // Buscar reportes que deben ejecutarse ahora
    const { data: reportes, error } = await supabase
      .from('reportes_programados')
      .select('*')
      .eq('activo', true)
      .lte('proximo_envio', ahora.toISOString());
    
    if (error) throw error;
    
    for (const reporte of reportes) {
      try {
        // Generar reporte según tipo
        let archivoUrl = '';
        let tamañoBytes = 0;
        
        const filtros = {
          fecha_inicio: this.obtenerFechaInicio(reporte),
          fecha_fin: this.obtenerFechaFin(reporte),
          ...reporte.filtros
        };
        
        switch (reporte.tipo) {
          case 'timesheet':
            archivoUrl = await generarTimesheetExcel(filtros);
            break;
          case 'comparativa':
            archivoUrl = await generarComparativaExcel(filtros);
            break;
          case 'ausencias':
            archivoUrl = await generarAusenciasExcel(filtros);
            break;
        }
        
        // Registrar en historial
        await supabase
          .from('reportes_historial')
          .insert({
            reporte_programado_id: reporte.id,
            fecha_generacion: new Date().toISOString(),
            archivo_url: archivoUrl,
            tamaño_bytes: tamañoBytes,
            destinatarios: reporte.destinatarios
          });
        
        // Actualizar último envío y calcular próximo
        const proximoEnvio = this.calcularProximaFecha(reporte);
        await supabase
          .from('reportes_programados')
          .update({ 
            ultimo_envio: new Date().toISOString(),
            proximo_envio: proximoEnvio?.toISOString()
          })
          .eq('id', reporte.id);
        
      } catch (error) {
        console.error(`Error generando reporte ${reporte.id}:`, error);
        
        // Registrar error
        await supabase
          .from('reportes_historial')
          .insert({
            reporte_programado_id: reporte.id,
            fecha_generacion: new Date().toISOString(),
            archivo_url: '',
            enviado: false,
            destinatarios: reporte.destinatarios,
            error: error instanceof Error ? error.message : 'Error desconocido'
          });
      }
    }
  }

  private obtenerFechaInicio(reporte: any): string {
    const hoy = new Date();
    
    switch (reporte.frecuencia) {
      case 'diario':
        return hoy.toISOString().split('T')[0];
      case 'semanal':
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - hoy.getDay() + 1);
        return inicioSemana.toISOString().split('T')[0];
      case 'mensual':
        return new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
      case 'trimestral':
        const trimestre = Math.floor(hoy.getMonth() / 3) * 3;
        return new Date(hoy.getFullYear(), trimestre, 1).toISOString().split('T')[0];
      default:
        return hoy.toISOString().split('T')[0];
    }
  }

  private obtenerFechaFin(reporte: any): string {
    const hoy = new Date();
    
    switch (reporte.frecuencia) {
      case 'diario':
        return hoy.toISOString().split('T')[0];
      case 'semanal':
        const finSemana = new Date(hoy);
        finSemana.setDate(hoy.getDate() - hoy.getDay() + 7);
        return finSemana.toISOString().split('T')[0];
      case 'mensual':
        return new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];
      case 'trimestral':
        const trimestre = Math.floor(hoy.getMonth() / 3) * 3;
        return new Date(hoy.getFullYear(), trimestre + 3, 0).toISOString().split('T')[0];
      default:
        return hoy.toISOString().split('T')[0];
    }
  }
}

export const reporteScheduler = new ReporteScheduler();