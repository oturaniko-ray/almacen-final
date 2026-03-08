import { createBrowserSupabaseClient } from '@/lib/supabase/client-browser';
import type { Jornada, TimesheetSemanal, FiltrosReporte, ComparativaTurno, ResumenComparativa } from './types';

class ReportesService {
  private supabase = createBrowserSupabaseClient();

  private calcularHorasEsperadas(inicio: string, fin: string): number {
    const [hInicio, mInicio] = inicio.split(':').map(Number);
    const [hFin, mFin] = fin.split(':').map(Number);
    return Number(((hFin + mFin/60) - (hInicio + mInicio/60)).toFixed(2));
  }

  async obtenerJornadas(filtros: FiltrosReporte) {
    try {
      let query = this.supabase
        .from('reporte_jornadas')
        .select('*')
        .gte('fecha', filtros.fecha_inicio)
        .lte('fecha', filtros.fecha_fin)
        .order('fecha', { ascending: true })
        .order('empleado_nombre', { ascending: true });

      if (filtros.empleado_id) {
        query = query.eq('empleado_id', filtros.empleado_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, data: data as Jornada[] };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  async generarComparativa(filtros: FiltrosReporte) {
    try {
      const supabase = this.supabase;
      
      // Obtener todas las asignaciones de turno del período
      const { data: asignaciones, error: errorAsignaciones } = await supabase
        .from('asignaciones_turno')
        .select(`
          id,
          empleado_id,
          fecha,
          estado,
          turno:turnos(
            id,
            nombre,
            hora_inicio,
            hora_fin
          )
        `)
        .gte('fecha', filtros.fecha_inicio)
        .lte('fecha', filtros.fecha_fin)
        .order('fecha', { ascending: true });

      if (errorAsignaciones) throw errorAsignaciones;

      // Obtener jornadas reales del mismo período
      const { data: jornadas, error: errorJornadas } = await supabase
        .from('jornadas')
        .select('empleado_id, fecha, horas_trabajadas, estado')
        .gte('fecha', filtros.fecha_inicio)
        .lte('fecha', filtros.fecha_fin);

      if (errorJornadas) throw errorJornadas;

      // Crear mapa de jornadas para búsqueda rápida
      const jornadasMap = new Map();
      jornadas?.forEach(j => {
        const key = `${j.empleado_id}-${j.fecha}`;
        jornadasMap.set(key, j);
      });

      // Obtener nombres de empleados
      const empleadosIds = [...new Set(asignaciones?.map(a => a.empleado_id) || [])];
      const { data: empleados } = await supabase
        .from('empleados')
        .select('id, nombre')
        .in('id', empleadosIds);

      const empleadosMap = new Map(empleados?.map(e => [e.id, e.nombre]));

      // Construir datos de comparativa
      const comparativa: ComparativaTurno[] = [];
      const resumen = {
        total_turnos: 0,
        turnos_cumplidos: 0,
        turnos_no_cumplidos: 0,
        empleados_con_ausencias: new Map()
      };

      asignaciones?.forEach(asig => {
        const key = `${asig.empleado_id}-${asig.fecha}`;
        const jornada = jornadasMap.get(key);
        const empleadoNombre = empleadosMap.get(asig.empleado_id) || 'Desconocido';

        const asistio = !!jornada && jornada.estado === 'presente';
        
        comparativa.push({
  empleado_id: asig.empleado_id,
  empleado_nombre: empleadoNombre,
  fecha: asig.fecha,
  turno_asignado: asig.turno ? (() => {
    // Si asig.turno es un array, tomar el primer elemento
    const turnoData = Array.isArray(asig.turno) ? asig.turno[0] : asig.turno;
    return turnoData ? {
      id: turnoData.id,
      nombre: turnoData.nombre,
      hora_inicio: turnoData.hora_inicio,
      hora_fin: turnoData.hora_fin
    } : null;
  })() : null,
  asistio: asistio,
  horas_trabajadas: jornada?.horas_trabajadas || 0,
  estado_asistencia: jornada?.estado || 'ausente',
  minutos_tarde: null
        });

        resumen.total_turnos++;
        
        if (asistio) {
          resumen.turnos_cumplidos++;
        } else {
          resumen.turnos_no_cumplidos++;
          
          const ausenciasActuales = resumen.empleados_con_ausencias.get(asig.empleado_id) || {
            empleado_id: asig.empleado_id,
            empleado_nombre: empleadoNombre,
            ausencias: 0
          };
          ausenciasActuales.ausencias++;
          resumen.empleados_con_ausencias.set(asig.empleado_id, ausenciasActuales);
        }
      });

      const resumenFinal: ResumenComparativa = {
        total_turnos: resumen.total_turnos,
        turnos_cumplidos: resumen.turnos_cumplidos,
        turnos_no_cumplidos: resumen.turnos_no_cumplidos,
        porcentaje_cumplimiento: resumen.total_turnos > 0 
          ? Number(((resumen.turnos_cumplidos / resumen.total_turnos) * 100).toFixed(1))
          : 0,
        empleados_con_ausencias: Array.from(resumen.empleados_con_ausencias.values())
          .sort((a, b) => b.ausencias - a.ausencias)
      };

      return { 
        success: true, 
        data: { 
          detalle: comparativa,
          resumen: resumenFinal 
        } 
      };

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }
// ============================================
// MÉTODOS PARA SHIFT TRADING (INTERCAMBIOS)
// ============================================

async obtenerIntercambiosDisponibles(fechaInicio?: string, fechaFin?: string) {
  try {
    let query = this.supabase
      .from('vista_intercambios_completa')
      .select('*')
      .eq('estado', 'disponible')
      .order('fecha_turno', { ascending: true });
    
    if (fechaInicio) {
      query = query.gte('fecha_turno', fechaInicio);
    }
    if (fechaFin) {
      query = query.lte('fecha_turno', fechaFin);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return { success: true, data };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

async obtenerSolicitudesPendientes() {
  try {
    const { data, error } = await this.supabase
      .from('vista_intercambios_completa')
      .select('*')
      .in('estado', ['disponible', 'solicitado'])  // ← AHORA INCLUYE DISPONIBLE
      .order('creado_en', { ascending: false });
    
    if (error) throw error;
    return { success: true, data };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

async obtenerMisTurnos(empleadoId: string, fechaInicio?: string, fechaFin?: string) {
  try {
    let query = this.supabase
      .from('asignaciones_turno')
      .select(`
        id,
        fecha,
        estado,
        turno:turnos(
          id,
          nombre,
          hora_inicio,
          hora_fin
        )
      `)
      .eq('empleado_id', empleadoId)
      .order('fecha', { ascending: true });
    
    if (fechaInicio) {
      query = query.gte('fecha', fechaInicio);
    }
    if (fechaFin) {
      query = query.lte('fecha', fechaFin);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // ✅ IMPORTANTE: Asegurar que data es un array
    return { success: true, data: data || [] };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido',
      data: []  // ✅ Siempre devolver array vacío en error
    };
  }
}
  async generarTimesheet(filtros: FiltrosReporte): Promise<{ success: boolean; data?: TimesheetSemanal[]; error?: string }> {
    const result = await this.obtenerJornadas(filtros);
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    const empleadosMap = new Map<string, TimesheetSemanal>();
    const jornadas = result.data;

    jornadas.forEach(j => {
      if (!empleadosMap.has(j.empleado_id)) {
        empleadosMap.set(j.empleado_id, {
          empleado_id: j.empleado_id,
          empleado_nombre: j.empleado_nombre,
          semana_inicio: filtros.fecha_inicio,
          semana_fin: filtros.fecha_fin,
          dias: {},
          total_horas: 0,
          horas_esperadas: 0,
          diferencia: 0,
          eficiencia: 0
        });
      }

      const empleado = empleadosMap.get(j.empleado_id)!;
      
      empleado.dias[j.fecha] = {
        fecha: j.fecha,
        dia_semana: new Date(j.fecha).getDay() || 7,
        hora_entrada: j.hora_entrada,
        hora_salida: j.hora_salida,
        horas_trabajadas: j.horas_trabajadas || 0,
        turno_asignado: j.turno_nombre,
        estado: j.estado_jornada
      };

      empleado.total_horas += j.horas_trabajadas || 0;

      if (j.turno_hora_inicio && j.turno_hora_fin) {
        empleado.horas_esperadas += this.calcularHorasEsperadas(
          j.turno_hora_inicio, 
          j.turno_hora_fin
        );
      }
    });

    empleadosMap.forEach(e => {
      e.diferencia = Number((e.total_horas - e.horas_esperadas).toFixed(2));
      e.eficiencia = e.horas_esperadas > 0 
        ? Number(((e.total_horas / e.horas_esperadas) * 100).toFixed(1))
        : 0;
    });

    const timesheets = Array.from(empleadosMap.values());
    return { success: true, data: timesheets };
  }
}

export const reportesService = new ReportesService();