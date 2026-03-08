'use client';

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
  
  const inicioSemana = startOfWeek(fechaBase, { weekStartsOn: 1 });
  const finSemana = endOfWeek(fechaBase, { weekStartsOn: 1 });
  const dias = eachDayOfInterval({ start: inicioSemana, end: finSemana });

  const getAsignacion = (empleadoId: string, fecha: Date) => {
    return asignaciones.find(a => 
      a.empleado_id === empleadoId && 
      isSameDay(new Date(a.fecha), fecha)
    );
  };

  const getEstadoColor = (estado: string) => {
    switch(estado) {
      case 'confirmado': return 'bg-green-100 border-green-300';
      case 'ausente': return 'bg-red-100 border-red-300';
      case 'swap': return 'bg-yellow-100 border-yellow-300';
      default: return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="relative w-full">
      {/* Cabecera fija con recuadro azul pastel */}
      <div className="sticky top-0 z-20 bg-white border-2 border-blue-200 rounded-t-lg shadow-sm overflow-hidden">
        <div className="flex">
          {/* Columna empleado */}
          <div className="sticky left-0 z-30 w-32 bg-blue-50 py-2 px-2 font-semibold text-gray-700 border-r-2 border-blue-200 text-sm">
            EMPLEADO
          </div>
          
          {/* Días de la semana - AJUSTADO a w-44 */}
          <div className="flex-1 overflow-x-auto">
            <div className="flex min-w-max">
              {dias.map((dia) => (
                <div 
                  key={dia.toISOString()} 
                  className="w-44 py-2 px-2 text-center bg-blue-50 border-r-2 border-blue-200"
                >
                  <div className="font-semibold text-gray-800 text-sm">
                    {format(dia, 'EEEE', { locale: es })}
                  </div>
                  <div className="text-xs text-gray-600">
                    {format(dia, 'dd/MM')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cuerpo con scroll */}
      <div className="overflow-auto max-h-[calc(100vh-300px)] border-2 border-t-0 border-blue-200 rounded-b-lg">
        {empleados.map((empleado) => (
          <div key={empleado.id} className="flex border-b border-gray-200 hover:bg-gray-50">
            {/* Columna fija de empleado */}
            <div className="sticky left-0 z-10 w-32 bg-white py-3 px-2 font-medium text-gray-700 border-r-2 border-gray-200 text-sm truncate" title={empleado.nombre}>
              {empleado.nombre}
            </div>
            
            {/* Celdas de días - AJUSTADO a w-44 */}
            <div className="flex-1 overflow-x-auto">
              <div className="flex min-w-max">
                {dias.map((dia) => {
                  const asignacion = getAsignacion(empleado.id, dia);
                  const fechaStr = format(dia, 'yyyy-MM-dd');
                  
                  return (
                    <div key={`${empleado.id}-${dia.toISOString()}`} className="w-44 p-2">
                      {asignacion ? (
                        <div className={`p-2 rounded border ${getEstadoColor(asignacion.estado)}`}>
                          <div className="font-medium text-sm">
                            {asignacion.turno_nombre}
                          </div>
                          <div className="text-xs text-gray-600">
                            {asignacion.hora_inicio.slice(0,5)} - {asignacion.hora_fin.slice(0,5)}
                          </div>
                          <div className="text-xs mt-1 text-gray-500">
                            {asignacion.estado === 'confirmado' && 'Confirmado'}
                            {asignacion.estado === 'ausente' && 'Ausente'}
                            {asignacion.estado === 'swap' && 'Intercambio'}
                            {asignacion.estado === 'asignado' && 'Pendiente'}
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => onAsignarClick(empleado.id, fechaStr)}
                          className="w-full h-18 border-2 border-dashed border-gray-300 rounded hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center justify-center text-gray-500 hover:text-blue-600 text-sm"
                        >
                          + Asignar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}