// ============================================
// TIPOS: Definen la forma de nuestros datos
// ============================================

// Los tipos son como "planos" que le dicen a TypeScript
// qué forma deben tener los datos

// Tipo para un turno (basado en nuestra tabla)
export type Turno = {
  id: string;
  nombre: string;
  descripcion: string | null;
  hora_inicio: string; // Formato: "08:00:00"
  hora_fin: string;    // Formato: "17:00:00"
  sucursal_codigo: string;
  dias_semana: number[]; // [1,2,3,4,5] = Lunes a Viernes
  capacidad_min: number;
  capacidad_max: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

// Tipo para crear un turno (sin los campos que se generan automáticamente)
export type TurnoCreateInput = {
  nombre: string;
  descripcion?: string | null;
  hora_inicio: string;
  hora_fin: string;
  sucursal_codigo: string;
  dias_semana: number[];
  capacidad_min?: number;
  capacidad_max?: number;
};

// Tipo para actualizar un turno (todos los campos opcionales)
export type TurnoUpdateInput = Partial<TurnoCreateInput>;

// Tipo para una asignación de turno
export type AsignacionTurno = {
  id: string;
  turno_id: string;
  empleado_id: string;
  fecha: string; // Formato: YYYY-MM-DD
  estado: 'asignado' | 'confirmado' | 'ausente' | 'swap';
  creado_por: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
};

// Tipo para crear una asignación
export type AsignacionCreateInput = {
  turno_id: string;
  empleado_id: string;
  fecha: string;
  estado?: 'asignado' | 'confirmado' | 'ausente' | 'swap';
  notas?: string | null;
};

// Tipo para la vista completa (con datos del empleado y turno)
export type VistaAsignacionCompleta = {
  asignacion_id: string;
  fecha: string;
  estado: string;
  empleado_id: string;
  empleado_nombre: string;
  empleado_email: string;
  turno_id: string;
  turno_nombre: string;
  hora_inicio: string;
  hora_fin: string;
  sucursal_codigo: string;
};

// Utilidad para los días de la semana (mejor que números mágicos)
export const DIAS_SEMANA = {
  LUNES: 1,
  MARTES: 2,
  MIERCOLES: 3,
  JUEVES: 4,
  VIERNES: 5,
  SABADO: 6,
  DOMINGO: 7
} as const;

export type DiaSemana = typeof DIAS_SEMANA[keyof typeof DIAS_SEMANA];