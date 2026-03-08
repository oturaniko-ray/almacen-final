export interface Jornada {
  jornada_id: string;
  empleado_id: string;
  empleado_nombre: string;
  empleado_email: string;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  horas_trabajadas: number;
  estado_jornada: 'presente' | 'ausente' | 'justificado';
  
  turno_id: string | null;
  turno_nombre: string | null;
  turno_hora_inicio: string | null;
  turno_hora_fin: string | null;
  estado_asignacion: string | null;
}

export interface TimesheetSemanal {
  empleado_id: string;
  empleado_nombre: string;
  semana_inicio: string;
  semana_fin: string;
  dias: {
    [fecha: string]: {
      fecha: string;
      dia_semana: number;
      hora_entrada: string | null;
      hora_salida: string | null;
      horas_trabajadas: number;
      turno_asignado: string | null;
      estado: string;
    }
  };
  total_horas: number;
  horas_esperadas: number;
  diferencia: number;
  eficiencia: number;
}

export interface FiltrosReporte {
  fecha_inicio: string;
  fecha_fin: string;
  empleado_id?: string;
}

// ✅ NUEVOS TIPOS PARA COMPARATIVA
export interface ComparativaTurno {
  empleado_id: string;
  empleado_nombre: string;
  fecha: string;
  turno_asignado: {
    id: string;
    nombre: string;
    hora_inicio: string;
    hora_fin: string;
  } | null;
  asistio: boolean;
  horas_trabajadas: number;
  estado_asistencia: 'presente' | 'ausente' | 'justificado';
  minutos_tarde: number | null;
}

export interface ResumenComparativa {
  total_turnos: number;
  turnos_cumplidos: number;
  turnos_no_cumplidos: number;
  porcentaje_cumplimiento: number;
  empleados_con_ausencias: Array<{
    empleado_id: string;
    empleado_nombre: string;
    ausencias: number;
  }>;
}
// Tipos existentes...

export type FrecuenciaReporte = 'diario' | 'semanal' | 'mensual' | 'trimestral';

export interface ReporteProgramado {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: 'timesheet' | 'comparativa' | 'ausencias' | 'personalizado';
  frecuencia: FrecuenciaReporte;
  dia_semana?: number; // 1-7 para semanal (1=Lunes)
  dia_mes?: number; // 1-31 para mensual
  hora_envio: string; // HH:MM
  destinatarios: string[]; // emails
  formato: 'excel' | 'pdf' | 'ambos';
  activo: boolean;
  ultimo_envio: string | null;
  proximo_envio: string | null;
  filtros: {
    sucursal_codigo?: string;
    empleado_id?: string;
  };
  creado_por: string;
  created_at: string;
  updated_at: string;
}

export interface ReporteGenerado {
  id: string;
  reporte_programado_id: string;
  fecha_generacion: string;
  archivo_url: string;
  tamaño_bytes: number;
  enviado: boolean;
  destinatarios: string[];
}