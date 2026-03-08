'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { reportesService } from '@/lib/reportes/service';
import { solicitarTurnoAction } from '@/lib/turnos/actions';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  empleadoId: string;
  empleadoNombre: string;
  onSolicitudExitosa: () => void;
}

export function TurnosDisponiblesModal({ 
  isOpen, 
  onClose, 
  empleadoId, 
  empleadoNombre,
  onSolicitudExitosa 
}: Props) {
  const [turnos, setTurnos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [solicitando, setSolicitando] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      cargarTurnos();
    }
  }, [isOpen]);

  const cargarTurnos = async () => {
    setLoading(true);
    setError('');
    console.log('🔍 Cargando turnos disponibles...');
    
    const result = await reportesService.obtenerIntercambiosDisponibles();
    console.log('📦 Resultado completo:', result);
    
    if (result.success) {
      console.log('📊 Datos crudos:', result.data);
      
      // ✅ CORREGIDO: Filtrar para NO mostrar los turnos del propio empleado
      const turnosOtros = (result.data || []).filter(
        (t: any) => t.empleado_origen_id !== empleadoId
      );
      
      console.log('✅ Turnos de otros empleados:', turnosOtros);
      setTurnos(turnosOtros);
    } else {
      console.error('❌ Error:', result.error);
      setError('Error al cargar turnos');
    }
    setLoading(false);
  };

  const handleSolicitar = async (intercambioId: string) => {
    setSolicitando(intercambioId);
    setError('');
    
    const result = await solicitarTurnoAction(intercambioId, empleadoId);
    
    if (result.success) {
      onSolicitudExitosa();
      onClose();
    } else {
      setError(result.error || 'Error al solicitar');
    }
    setSolicitando(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white font-black text-xl">TURNOS DISPONIBLES</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white">✕</button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-600/20 border border-red-600/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-white/40">Cargando...</div>
        ) : turnos.length === 0 ? (
          <div className="text-center py-8 text-white/40">
            No hay turnos disponibles para intercambiar
          </div>
        ) : (
          <div className="space-y-3">
            {turnos.map((turno) => (
              <div key={turno.id} className="bg-[#0f172a] p-4 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-blue-600/20 text-blue-400 px-2 py-1 rounded text-xs font-bold">
                    DISPONIBLE
                  </span>
                  <p className="text-white font-bold">
                    {format(new Date(turno.fecha_turno), 'EEEE d MMMM', { locale: es })}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <p className="text-white/40">Turno:</p>
                    <p className="text-blue-400 font-bold">{turno.turno_nombre}</p>
                    <p className="text-white/60">{turno.hora_inicio.slice(0,5)} - {turno.hora_fin.slice(0,5)}</p>
                  </div>
                  <div>
                    <p className="text-white/40">Ofrece:</p>
                    <p className="text-amber-400">{turno.empleado_origen_nombre}</p>
                    {turno.motivo && (
                      <p className="text-white/40 text-xs mt-1">Motivo: {turno.motivo}</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleSolicitar(turno.id)}
                  disabled={solicitando === turno.id}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg disabled:opacity-50"
                >
                  {solicitando === turno.id ? 'SOLICITANDO...' : 'SOLICITAR TURNO'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}