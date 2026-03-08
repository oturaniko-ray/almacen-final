export type TipoAusencia = 'vacacion' | 'enfermedad' | 'personal' | 'maternidad' | 'otro';

export const TIPOS_AUSENCIA: Record<TipoAusencia, string> = {
  vacacion: 'Vacaciones',
  enfermedad: 'Enfermedad / Licencia médica',
  personal: 'Asuntos personales',
  maternidad: 'Maternidad / Paternidad',
  otro: 'Otro'
};

export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada';

export interface SolicitudAusencia {
  id: string;
  empleado_id: string;
  tipo: TipoAusencia;
  fecha_inicio: string;
  fecha_fin: string;
  dias_solicitados: number;
  motivo: string | null;
  estado: EstadoSolicitud;
  aprobado_por: string | null;
  comentario_supervisor: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaldoAusencias {
  empleado_id: string;
  tipo: TipoAusencia;
  anio: number;
  dias_totales: number;
  dias_usados: number;
  dias_disponibles: number;
}

export interface SolicitudWithEmpleado extends SolicitudAusencia {
  empleado_nombre: string;
  empleado_email: string;
}