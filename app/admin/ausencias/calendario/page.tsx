'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { obtenerSolicitudesAction } from '@/lib/ausencias/actions';

export default function CalendarioAusenciasPage() {
  const router = useRouter();
  const [fechaActual, setFechaActual] = useState(new Date());
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar solicitudes del mes actual
  useEffect(() => {
    const cargarSolicitudes = async () => {
      setLoading(true);
      const inicioMes = format(startOfMonth(fechaActual), 'yyyy-MM-dd');
      const finMes = format(endOfMonth(fechaActual), 'yyyy-MM-dd');
      
      // ✅ CORREGIDO: obtenerSolicitudesAction solo acepta filtros por estado o empleado_id
      // Vamos a obtener todas y filtrar por fecha manualmente
      const result = await obtenerSolicitudesAction();
      
      if (result.success) {
        // Filtrar por fecha y solo aprobadas
        const aprobadas = (result.data || []).filter((s: any) => 
          s.estado === 'aprobada' &&
          s.fecha_inicio <= finMes && 
          s.fecha_fin >= inicioMes
        );
        setSolicitudes(aprobadas);
      }
      setLoading(false);
    };
    
    cargarSolicitudes();
  }, [fechaActual]);

  const diasDelMes = eachDayOfInterval({
    start: startOfMonth(fechaActual),
    end: endOfMonth(fechaActual)
  });

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const mesActual = fechaActual.getMonth();
  const añoActual = fechaActual.getFullYear();

  const cambiarMes = (incremento: number) => {
    setFechaActual(new Date(añoActual, mesActual + incremento, 1));
  };

  const irMesActual = () => {
    setFechaActual(new Date());
  };

  // Obtener solicitudes para un día específico
  const getSolicitudesPorDia = (fecha: Date) => {
    const fechaStr = format(fecha, 'yyyy-MM-dd');
    return solicitudes.filter((s: any) => 
      s.fecha_inicio <= fechaStr && s.fecha_fin >= fechaStr
    );
  };

  const getColorPorTipo = (tipo: string) => {
    switch(tipo) {
      case 'vacacion': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'enfermedad': return 'bg-green-100 text-green-700 border-green-200';
      case 'personal': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getTextoPorTipo = (tipo: string) => {
    switch(tipo) {
      case 'vacacion': return 'V';
      case 'enfermedad': return 'E';
      case 'personal': return 'P';
      default: return 'O';
    }
  };

  return (
    <div className="pt-20 p-6 w-full">
      {/* Botón VOLVER */}
      <div className="max-w-7xl mx-auto mb-4">
        <Link
          href="/admin/rrhh-operativo/planificacion"
          className="text-blue-500 font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-2 hover:text-blue-400 transition-colors"
        >
          <span className="text-lg">←</span> VOLVER A GESTIÓN Y PLANIFICACIÓN
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm max-w-7xl mx-auto">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-800">Calendario de Ausencias</h1>
          <div className="flex gap-2">
            <button
              onClick={() => cambiarMes(-1)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              ← Mes anterior
            </button>
            <button
              onClick={irMesActual}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              Hoy
            </button>
            <button
              onClick={() => cambiarMes(1)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              Mes siguiente →
            </button>
          </div>
        </div>

        <div className="p-4">
          <h2 className="text-lg font-medium text-gray-700 text-center mb-4">
            {meses[mesActual]} {añoActual}
          </h2>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Cargando calendario...</div>
          ) : (
            <>
              {/* Días de la semana */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dia) => (
                  <div key={dia} className="text-center text-xs font-medium text-gray-500 py-2">
                    {dia}
                  </div>
                ))}
              </div>

              {/* Calendario */}
              <div className="grid grid-cols-7 gap-1">
                {diasDelMes.map((dia, index) => {
                  const solicitudesDelDia = getSolicitudesPorDia(dia);
                  const esHoy = isToday(dia);
                  
                  return (
                    <div
                      key={index}
                      className={`min-h-[100px] border rounded-lg p-2 ${
                        esHoy ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="text-right text-sm text-gray-600 mb-1">
                        {format(dia, 'd')}
                      </div>
                      <div className="space-y-1">
                        {solicitudesDelDia.map((s: any, idx: number) => (
                          <div
                            key={idx}
                            className={`text-[10px] p-1 rounded border ${getColorPorTipo(s.tipo)} truncate`}
                            title={`${s.empleado_nombre} - ${s.motivo || ''}`}
                          >
                            <span className="font-bold mr-1">{getTextoPorTipo(s.tipo)}</span>
                            {s.empleado_nombre?.split(' ')[0]}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Leyenda */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-blue-100 border border-blue-200"></span>
              <span>Vacaciones</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-100 border border-green-200"></span>
              <span>Enfermedad</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-yellow-100 border border-yellow-200"></span>
              <span>Personal</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-gray-100 border border-gray-200"></span>
              <span>Otros</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}