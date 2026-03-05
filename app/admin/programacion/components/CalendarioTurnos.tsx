'use client';

import { useState } from 'react';
import { format, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import type { VistaAsignacionCompleta } from '@/lib/turnos/types';

interface CalendarioTurnosProps {
  fechaBase: Date;
  empleados: Array<{ id: string; nombre: string }>;
  asignaciones: VistaAsignacionCompleta[];
  onAsignarClick: (empleadoId: string, fecha: string) => void;
}

export function CalendarioTurnos({ 
  fechaBase, 
  empleados, 
  asignaciones,
  onAsignarClick 
}: CalendarioTurnosProps) {
  
  // Calcular los días de la semana (lunes a domingo)
  const inicioSemana = startOfWeek(fechaBase, { weekStartsOn: 1 });
  const finSemana = endOfWeek(fechaBase, { weekStartsOn: 1 });
  
  const dias = eachDayOfInterval({ start: inicioSemana, end: finSemana });
  
  // Función para encontrar la asignación de un empleado en un día específico
  const getAsignacion = (empleadoId: string, fecha: Date) => {
    return asignaciones.find(a => 
      a.empleado_id === empleadoId && 
      isSameDay(new Date(a.fecha), fecha)
    );
  };

  // Colores según estado
  const getEstadoColor = (estado: string) => {
    switch(estado) {
      case 'confirmado': return 'bg-green-100 border-green-300';
      case 'ausente': return 'bg-red-100 border-red-300';
      case 'swap': return 'bg-yellow-100 border-yellow-300';
      default: return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-200">
        {/* Cabecera con los días */}
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
              Empleado
            </th>
            {dias.map((dia) => (
              <th key={dia.toISOString()} className="px-4 py-3 text-center min-w-[120px]">
                <div className="font-medium text-gray-900">
                  {format(dia, 'EEEE', { locale: es })}
                </div>
                <div className="text-sm text-gray-500">
                  {format(dia, 'dd/MM')}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        
        {/* Cuerpo: una fila por empleado */}
        <tbody className="divide-y divide-gray-200">
          {empleados.map((empleado) => (
            <tr key={empleado.id} className="hover:bg-gray-50">
              {/* Nombre del empleado */}
              <td className="px-4 py-3 font-medium">
                {empleado.nombre}
              </td>
              
              {/* Celdas para cada día */}
              {dias.map((dia) => {
                const asignacion = getAsignacion(empleado.id, dia);
                const fechaStr = format(dia, 'yyyy-MM-dd');
                
                return (
                  <td key={`${empleado.id}-${dia.toISOString()}`} className="px-2 py-2">
                    {asignacion ? (
                      // Si tiene turno asignado, mostrarlo
                      <div className={`p-2 rounded border ${getEstadoColor(asignacion.estado)}`}>
                        <div className="font-medium text-sm">
                          {asignacion.turno_nombre}
                        </div>
                        <div className="text-xs text-gray-600">
                          {asignacion.hora_inicio.slice(0,5)} - {asignacion.hora_fin.slice(0,5)}
                        </div>
                        <div className="text-xs mt-1">
                          {asignacion.estado === 'confirmado' && '✅ Confirmado'}
                          {asignacion.estado === 'ausente' && '❌ Ausente'}
                          {asignacion.estado === 'swap' && '🔄 Intercambio'}
                          {asignacion.estado === 'asignado' && '⏳ Pendiente'}
                        </div>
                      </div>
                    ) : (
                      // Si no tiene turno, botón para asignar
                      <button
                        onClick={() => onAsignarClick(empleado.id, fechaStr)}
                        className="w-full h-full min-h-[80px] border-2 border-dashed border-gray-200 rounded hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center justify-center text-gray-400 hover:text-blue-600"
                      >
                        + Asignar
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}