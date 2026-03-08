'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  solicitud: any;
  onAprobar: () => Promise<void>;
  onRechazar: () => Promise<void>;
}

export function AprobarIntercambioModal({ isOpen, onClose, solicitud, onAprobar, onRechazar }: Props) {
  const [loading, setLoading] = useState(false);
  const [comentario, setComentario] = useState('');
  const [error, setError] = useState('');

  if (!isOpen || !solicitud) return null;

  const handleAprobar = async () => {
    setLoading(true);
    setError('');
    try {
      await onAprobar();
    } catch (err) {
      setError('Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  const handleRechazar = async () => {
    setLoading(true);
    setError('');
    try {
      await onRechazar();
    } catch (err) {
      setError('Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-white font-black text-xl mb-4">REVISAR INTERCAMBIO</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-600/20 border border-red-600/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
        
        <div className="bg-[#0f172a] p-4 rounded-xl mb-4 space-y-2">
          <p className="text-white font-bold">
            {format(new Date(solicitud.fecha_turno), 'EEEE d MMMM', { locale: es })}
          </p>
          <p className="text-blue-400 font-bold">{solicitud.turno_nombre}</p>
          <p className="text-white/60 text-sm">
            {solicitud.hora_inicio.slice(0,5)} - {solicitud.hora_fin.slice(0,5)}
          </p>
          <div className="border-t border-white/10 pt-2 mt-2">
            <p className="text-amber-400">Cede: {solicitud.empleado_origen_nombre}</p>
            <p className="text-green-400">Recibe: {solicitud.empleado_destino_nombre || 'Por asignar'}</p>
          </div>
          {solicitud.motivo && (
            <div className="border-t border-white/10 pt-2 mt-2">
              <p className="text-white/40 text-xs">MOTIVO:</p>
              <p className="text-white text-sm">{solicitud.motivo}</p>
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-white/60 text-xs mb-2">COMENTARIO (OPCIONAL)</label>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-3 text-white"
            rows={2}
            placeholder="Observaciones sobre la aprobación..."
            disabled={loading}
          />
        </div>

        {/* TRES BOTONES: CANCELAR, RECHAZAR, APROBAR */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 text-sm"
          >
            CANCELAR
          </button>
          <button
            onClick={handleRechazar}
            disabled={loading}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 text-sm"
          >
            {loading ? '...' : 'RECHAZAR'}
          </button>
          <button
            onClick={handleAprobar}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 text-sm"
          >
            {loading ? '...' : 'APROBAR'}
          </button>
        </div>
      </div>
    </div>
  );
}