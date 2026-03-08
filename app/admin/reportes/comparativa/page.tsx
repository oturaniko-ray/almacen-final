'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiltroFechas } from '../components/FiltroFechas';
import { ResumenCumplimiento } from '../components/ResumenCumplimiento';
import { reportesService } from '@/lib/reportes/service';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ComparativaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ detalle: any[]; resumen: any } | null>(null);
  const [periodo, setPeriodo] = useState({ inicio: '', fin: '' });

  const handleFiltrar = async (fechaInicio: string, fechaFin: string) => {
    setLoading(true);
    setPeriodo({ inicio: fechaInicio, fin: fechaFin });
    
    const result = await reportesService.generarComparativa({
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin
    });
    
    if (result.success && result.data) {
      setData(result.data);
    } else {
      alert('Error: ' + (result.error || 'No se pudo generar el reporte'));
    }
    
    setLoading(false);
  };

  const getEstadoColor = (estado: string) => {
    switch(estado) {
      case 'presente': return 'text-green-700 bg-green-50';
      case 'ausente': return 'text-red-700 bg-red-50';
      case 'justificado': return 'text-yellow-700 bg-yellow-50';
      default: return 'text-gray-700 bg-gray-50';
    }
  };

  const getEstadoTexto = (estado: string) => {
    switch(estado) {
      case 'presente': return 'Asistió';
      case 'ausente': return 'Ausente';
      case 'justificado': return 'Justificado';
      default: return estado;
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

      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-gray-800">Turnos Planificados vs Reales</h1>
        <p className="text-sm text-gray-500">Comparativa de asistencia por turno</p>
      </div>

      <FiltroFechas onFiltrar={handleFiltrar} />

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          Generando reporte...
        </div>
      ) : data ? (
        <>
          <ResumenCumplimiento resumen={data.resumen} />

          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-medium text-gray-700">
                Detalle de Turnos: {periodo.inicio} al {periodo.fin}
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="p-3 text-left font-medium text-gray-600">Fecha</th>
                    <th className="p-3 text-left font-medium text-gray-600">Empleado</th>
                    <th className="p-3 text-left font-medium text-gray-600">Turno Asignado</th>
                    <th className="p-3 text-left font-medium text-gray-600">Horario</th>
                    <th className="p-3 text-left font-medium text-gray-600">Asistencia</th>
                    <th className="p-3 text-left font-medium text-gray-600">Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.detalle.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3">
                        {format(new Date(item.fecha), 'dd/MM/yyyy', { locale: es })}
                      </td>
                      <td className="p-3 font-medium">{item.empleado_nombre}</td>
                      <td className="p-3">
                        {item.turno_asignado ? (
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                            {item.turno_asignado.nombre}
                          </span>
                        ) : (
                          <span className="text-gray-400">Sin turno</span>
                        )}
                      </td>
                      <td className="p-3">
                        {item.turno_asignado ? (
                          `${item.turno_asignado.hora_inicio.slice(0,5)} - ${item.turno_asignado.hora_fin.slice(0,5)}`
                        ) : '-'}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs ${getEstadoColor(item.estado_asistencia)}`}>
                          {getEstadoTexto(item.estado_asistencia)}
                        </span>
                      </td>
                      <td className="p-3">
                        {item.horas_trabajadas > 0 ? `${item.horas_trabajadas}h` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          Selecciona un período para generar la comparativa
        </div>
      )}
    </div>
  );
}