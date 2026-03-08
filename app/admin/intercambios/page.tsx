'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { reportesService } from '@/lib/reportes/service';
import { aprobarIntercambioAction } from '@/lib/turnos/actions';
import { AprobarIntercambioModal } from './components/AprobarIntercambioModal';

export default function IntercambiosPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = useState<any>(null);
  const [notificacion, setNotificacion] = useState<{ mensaje: string; tipo: 'exito' | 'error' } | null>(null);

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) {
      router.replace('/');
      return;
    }
    const currentUser = JSON.parse(sessionData);
    if (Number(currentUser.nivel_acceso) < 5) {
      router.replace('/admin');
      return;
    }
    setUser(currentUser);
    cargarSolicitudes();
  }, []);

  const mostrarNotificacion = (mensaje: string, tipo: 'exito' | 'error') => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => setNotificacion(null), 3000);
  };

  const cargarSolicitudes = async () => {
    setLoading(true);
    const result = await reportesService.obtenerSolicitudesPendientes();
    if (result.success) {
      // ✅ FILTRAR SOLO ACTIVOS
      const activos = (result.data || []).filter(
        (s: any) => s.estado === 'disponible' || s.estado === 'solicitado'
      );
      setSolicitudes(activos);
    }
    setLoading(false);
  };

  const handleAprobar = (solicitud: any) => {
    setSelectedSolicitud(solicitud);
    setModalOpen(true);
  };

  const handleAprobacionCompleta = async (accion: 'aprobar' | 'rechazar') => {
    if (!selectedSolicitud || !user) return;
    
    const result = await aprobarIntercambioAction(selectedSolicitud.id, user.id, accion);
    
    if (result.success) {
      mostrarNotificacion(
        accion === 'aprobar' ? '✅ Intercambio aprobado correctamente' : '❌ Intercambio rechazado',
        'exito'
      );
      
      // ✅ FORZAR RECARGA
      await cargarSolicitudes();
      
      setModalOpen(false);
      setSelectedSolicitud(null);
    } else {
      mostrarNotificacion(`Error: ${result.error}`, 'error');
    }
  };

  const getEstadoBadge = (estado: string) => {
    switch(estado) {
      case 'disponible':
        return <span className="bg-blue-600/20 text-blue-400 px-2 py-1 rounded text-xs font-bold">DISPONIBLE</span>;
      case 'solicitado':
        return <span className="bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded text-xs font-bold">PENDIENTE</span>;
      default:
        return <span className="bg-gray-600/20 text-gray-400 px-2 py-1 rounded text-xs font-bold">{estado.toUpperCase()}</span>;
    }
  };

  return (
    <main className="min-h-screen bg-black p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">INTERCAMBIOS DE TURNOS</h1>
            <p className="text-white/40 text-sm">Solicitudes pendientes de aprobación</p>
          </div>
          <Link
            href="/admin/rrhh-operativo/gestion-horarios"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold"
          >
            VOLVER
          </Link>
        </div>

        {/* Notificación */}
        {notificacion && (
          <div className={`mb-4 p-4 rounded-xl ${
            notificacion.tipo === 'exito' ? 'bg-green-600/20 border border-green-600/30' : 'bg-red-600/20 border border-red-600/30'
          }`}>
            <p className={`text-sm font-bold ${notificacion.tipo === 'exito' ? 'text-green-400' : 'text-red-400'}`}>
              {notificacion.mensaje}
            </p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-white/40">Cargando...</div>
        ) : solicitudes.length === 0 ? (
          <div className="bg-[#1a1a1a] rounded-xl border border-white/10 p-12 text-center">
            <p className="text-white/40">No hay solicitudes de intercambio pendientes</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {solicitudes.map((sol) => (
              <div key={sol.id} className="bg-[#1a1a1a] rounded-xl border border-white/10 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getEstadoBadge(sol.estado)}
                    <p className="text-white font-bold">
                      {format(new Date(sol.fecha_turno), 'EEEE d MMMM', { locale: es })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAprobar(sol)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold"
                  >
                    REVISAR
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-white/40">Turno:</p>
                    <p className="text-blue-400 font-bold">{sol.turno_nombre}</p>
                    <p className="text-white/60">{sol.hora_inicio.slice(0,5)} - {sol.hora_fin.slice(0,5)}</p>
                  </div>
                  <div>
                    <p className="text-white/40">Intercambio:</p>
                    <p className="text-white">
                      <span className="text-amber-400">{sol.empleado_origen_nombre}</span>
                      <span className="text-white/40 mx-1">→</span>
                      <span className="text-green-400">{sol.empleado_destino_nombre || 'Pendiente'}</span>
                    </p>
                    {sol.motivo && (
                      <p className="text-white/40 text-xs mt-1">Motivo: {sol.motivo}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AprobarIntercambioModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedSolicitud(null);
        }}
        solicitud={selectedSolicitud}
        onAprobar={() => handleAprobacionCompleta('aprobar')}
        onRechazar={() => handleAprobacionCompleta('rechazar')}
      />
    </main>
  );
}