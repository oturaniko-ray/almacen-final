'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AprobacionModal } from '../components/AprobacionModal';
import { obtenerSolicitudesAction } from '@/lib/ausencias/actions';
import { useRealtime } from '@/lib/hooks/useRealtime';

const TIPOS_AUSENCIA: Record<string, string> = {
  vacacion: 'Vacaciones',
  enfermedad: 'Enfermedad',
  personal: 'Asuntos personales',
  maternidad: 'Maternidad/Paternidad',
  otro: 'Otro'
};

export default function SolicitudesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [solicitudesIniciales, setSolicitudesIniciales] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = useState<any>(null);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');

  // Cargar solicitudes iniciales
  useEffect(() => {
    const cargarSolicitudes = async () => {
      setLoading(true);
      const filtros = filtroEstado !== 'todos' ? { estado: filtroEstado } : undefined;
      const result = await obtenerSolicitudesAction(filtros);
      if (result.success) {
        setSolicitudesIniciales(result.data || []);
      }
      setLoading(false);
    };
    cargarSolicitudes();
  }, [filtroEstado]);

  // Suscribirse a cambios en tiempo real
  const solicitudes = useRealtime(solicitudesIniciales, {
    table: 'solicitudes_ausencia',
    filter: filtroEstado !== 'todos' ? `estado=eq.${filtroEstado}` : undefined
  });

  const getEstadoColor = (estado: string) => {
    switch(estado) {
      case 'aprobada': return 'bg-green-100 text-green-700';
      case 'rechazada': return 'bg-red-100 text-red-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  const getEstadoTexto = (estado: string) => {
    switch(estado) {
      case 'aprobada': return 'Aprobada';
      case 'rechazada': return 'Rechazada';
      default: return 'Pendiente';
    }
  };

  const handleAprobarClick = (solicitud: any) => {
    setSelectedSolicitud(solicitud);
    setModalOpen(true);
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
          <h1 className="text-xl font-semibold text-gray-800">Solicitudes de Ausencia</h1>
          <div className="flex gap-2">
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="aprobada">Aprobadas</option>
              <option value="rechazada">Rechazadas</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando solicitudes...</div>
        ) : solicitudes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No hay solicitudes de ausencia
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-3 text-left font-medium text-gray-600">Empleado</th>
                  <th className="p-3 text-left font-medium text-gray-600">Tipo</th>
                  <th className="p-3 text-left font-medium text-gray-600">Período</th>
                  <th className="p-3 text-left font-medium text-gray-600">Días</th>
                  <th className="p-3 text-left font-medium text-gray-600">Motivo</th>
                  <th className="p-3 text-left font-medium text-gray-600">Estado</th>
                  <th className="p-3 text-left font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.map((s: any) => (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3 font-medium">{s.empleado_nombre}</td>
                    <td className="p-3">{TIPOS_AUSENCIA[s.tipo] || s.tipo}</td>
                    <td className="p-3">
                      {format(new Date(s.fecha_inicio), 'dd/MM')} - {format(new Date(s.fecha_fin), 'dd/MM/yyyy')}
                    </td>
                    <td className="p-3">{s.dias_solicitados}</td>
                    <td className="p-3 max-w-xs truncate">{s.motivo || '-'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${getEstadoColor(s.estado)}`}>
                        {getEstadoTexto(s.estado)}
                      </span>
                    </td>
                    <td className="p-3">
                      {s.estado === 'pendiente' && (
                        <button
                          onClick={() => handleAprobarClick(s)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          Revisar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedSolicitud && (
        <AprobacionModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedSolicitud(null);
          }}
          solicitudId={selectedSolicitud.id}
          empleadoNombre={selectedSolicitud.empleado_nombre}
          tipo={TIPOS_AUSENCIA[selectedSolicitud.tipo] || selectedSolicitud.tipo}
          dias={selectedSolicitud.dias_solicitados}
          periodo={`${format(new Date(selectedSolicitud.fecha_inicio), 'dd/MM')} - ${format(new Date(selectedSolicitud.fecha_fin), 'dd/MM/yyyy')}`}
        />
      )}
    </div>
  );
}