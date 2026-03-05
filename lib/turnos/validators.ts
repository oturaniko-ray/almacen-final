// ============================================
// VALIDADORES: Usando Zod para datos seguros
// ============================================

import { z } from 'zod';
import { DIAS_SEMANA } from './types';

// Zod es como un "guardián" que revisa los datos antes de que entren a la BD
// Si algo no cumple las reglas, lanza un error con un mensaje claro

// Validador para hora en formato HH:MM:SS
const HoraSchema = z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, {
  message: "La hora debe tener formato HH:MM:SS (ej: 08:00:00)"
});

// Validador para fecha en formato YYYY-MM-DD
const FechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: "La fecha debe tener formato YYYY-MM-DD (ej: 2024-03-10)"
});

// Schema para crear un turno
export const TurnoCreateSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres").max(100),
  descripcion: z.string().max(500).optional().nullable(),
  hora_inicio: HoraSchema,
  hora_fin: HoraSchema,
  sucursal_codigo: z.string().min(1, "La sucursal es requerida").max(10),
  dias_semana: z.array(z.number().min(1).max(7))
    .min(1, "Debe seleccionar al menos un día")
    .refine((dias) => {
      // Verificar que no hay días duplicados
      return new Set(dias).size === dias.length;
    }, "No puede haber días duplicados"),
  capacidad_min: z.number().int().min(0).default(1),
  capacidad_max: z.number().int().min(1).default(10),
}).refine((data) => {
  // Validar que hora_fin sea después de hora_inicio
  return data.hora_fin > data.hora_inicio;
}, {
  message: "La hora de fin debe ser posterior a la hora de inicio",
  path: ["hora_fin"] // El error aparecerá en el campo hora_fin
});

// Schema para crear una asignación
export const AsignacionCreateSchema = z.object({
  turno_id: z.string().uuid("ID de turno inválido"),
  empleado_id: z.string().uuid("ID de empleado inválido"),
  fecha: FechaSchema,
  estado: z.enum(['asignado', 'confirmado', 'ausente', 'swap'])
    .default('asignado'),
  notas: z.string().max(500).optional().nullable(),
});

// Schema para filtrar asignaciones (búsquedas)
export const AsignacionFilterSchema = z.object({
  fecha_inicio: FechaSchema.optional(),
  fecha_fin: FechaSchema.optional(),
  empleado_id: z.string().uuid().optional(),
  turno_id: z.string().uuid().optional(),
  estado: z.enum(['asignado', 'confirmado', 'ausente', 'swap']).optional(),
  sucursal_codigo: z.string().max(10).optional(),
});

// Función de ayuda para validar datos
export function validateTurnoData(data: unknown) {
  return TurnoCreateSchema.parse(data);
}

export function validateAsignacionData(data: unknown) {
  return AsignacionCreateSchema.parse(data);
}

// Versión segura que no lanza error, devuelve objeto con éxito/error
export function safeValidateTurno(data: unknown) {
  const result = TurnoCreateSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { 
      success: false, 
      error: result.error.format() 
    };
  }
}