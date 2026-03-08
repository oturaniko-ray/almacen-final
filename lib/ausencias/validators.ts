import { z } from 'zod';
import { TIPOS_AUSENCIA } from './types';

export const SolicitudAusenciaSchema = z.object({
  empleado_id: z.string().uuid('ID de empleado inválido'),
  tipo: z.enum(['vacacion', 'enfermedad', 'personal', 'maternidad', 'otro']),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  motivo: z.string().max(500).optional().nullable(),
}).refine((data) => {
  const inicio = new Date(data.fecha_inicio);
  const fin = new Date(data.fecha_fin);
  return fin >= inicio;
}, {
  message: 'La fecha de fin debe ser posterior o igual a la fecha de inicio',
  path: ['fecha_fin']
});

export const AprobacionSchema = z.object({
  solicitud_id: z.string().uuid(),
  estado: z.enum(['aprobada', 'rechazada']),
  comentario: z.string().max(500).optional().nullable(),
});

export function calcularDiasEntreFechas(fechaInicio: string, fechaFin: string): number {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  const diffTime = Math.abs(fin.getTime() - inicio.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}