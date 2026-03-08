'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiltroFechas } from '../components/FiltroFechas';
import { reportesService } from '@/lib/reportes/service';
import type { TimesheetSemanal } from '@/lib/reportes/types';

export default function TimesheetPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [timesheets, setTimesheets] = useState<TimesheetSemanal[]>([]);
  const [periodo, setPeriodo] = useState({ inicio: '', fin: '' });

  const handleFiltrar = async (fechaInicio: string, fechaFin: string) => {
    setLoading(true);
    setPeriodo({ inicio: fechaInicio, fin: fechaFin });
    
    const result = await reportesService.generarTimesheet({
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin
    });
    
    if (result.success) {
      const data = result.data as TimesheetSemanal[];
      setTimesheets(data);
    } else {
      alert('Error: ' + (result.error || 'No se pudo generar el reporte'));
    }
    
    setLoading(false);
  };

  const diasSemana = () => {
    if (!periodo.inicio) return [];
    
    const dias = [];
    const inicio = new Date(periodo.inicio);
    
    for (let i = 0; i < 7; i++) {
      const dia = new Date(inicio);
      dia.setDate(inicio.getDate() + i);
      dias.push({
        fecha: dia.toISOString().split('T')[0],
        nombre: dia.toLocaleDateString('es-ES', { weekday: 'short' }),
        numero: dia.getDate()
      });
    }
    return dias;
  };

  const dias = diasSemana();

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

      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-gray-800">Timesheet Semanal</h1>
        <p className="text-sm text-gray-500">Horas trabajadas por empleado</p>
      </div>

      <FiltroFechas onFiltrar={handleFiltrar} />

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          Generando reporte...
        </div>
      ) : timesheets.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-medium text-gray-700">
              Período: {periodo.inicio} al {periodo.fin}
            </h2>
            <div className="text-sm text-gray-500">
              {timesheets.length} empleados
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-3 text-left font-medium text-gray-600 sticky left-0 bg-gray-50">
                    Empleado
                  </th>
                  {dias.map((dia) => (
                    <th key={dia.fecha} className="p-3 text-center font-medium text-gray-600 min-w-[100px]">
                      <div>{dia.nombre}</div>
                      <div className="text-xs text-gray-400">{dia.numero}</div>
                    </th>
                  ))}
                  <th className="p-3 text-center font-medium text-gray-600 bg-blue-50">
                    Total
                  </th>
                  <th className="p-3 text-center font-medium text-gray-600 bg-blue-50">
                    Esperado
                  </th>
                  <th className="p-3 text-center font-medium text-gray-600 bg-blue-50">
                    Diferencia
                  </th>
                  <th className="p-3 text-center font-medium text-gray-600 bg-blue-50">
                    Eficiencia
                  </th>
                </tr>
              </thead>
              <tbody>
                {timesheets.map((ts) => (
                  <tr key={ts.empleado_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3 font-medium sticky left-0 bg-white">
                      {ts.empleado_nombre}
                    </td>
                    
                    {dias.map((dia) => {
                      const registro = ts.dias[dia.fecha];
                      return (
                        <td key={dia.fecha} className="p-3 text-center">
                          {registro ? (
                            <div>
                              <span className="font-medium">{registro.horas_trabajadas?.toFixed(1)}h</span>
                              {registro.turno_asignado && (
                                <div className="text-xs text-gray-400 truncate max-w-[90px]">
                                  {registro.turno_asignado}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      );
                    })}
                    
                    <td className="p-3 text-center font-medium bg-blue-50">
                      {ts.total_horas.toFixed(1)}h
                    </td>
                    <td className="p-3 text-center bg-blue-50">
                      {ts.horas_esperadas.toFixed(1)}h
                    </td>
                    <td className={`p-3 text-center font-medium bg-blue-50 ${
                      ts.diferencia >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {ts.diferencia > 0 ? '+' : ''}{ts.diferencia.toFixed(1)}h
                    </td>
                    <td className="p-3 text-center bg-blue-50">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        ts.eficiencia >= 90 ? 'bg-green-100 text-green-700' :
                        ts.eficiencia >= 75 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {ts.eficiencia}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          Selecciona un período para generar el timesheet
        </div>
      )}
    </div>
  );
}