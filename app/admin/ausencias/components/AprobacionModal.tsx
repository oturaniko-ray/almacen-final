'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { aprobarSolicitudAction } from '@/lib/ausencias/actions';

interface AprobacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  solicitudId: string;
  empleadoNombre: string;
  tipo: string;
  dias: number;
  periodo: string;
}

export function AprobacionModal({ 
  isOpen, 
  onClose, 
  solicitudId, 
  empleadoNombre, 
  tipo, 
  dias, 
  periodo 
}: AprobacionModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [comentario, setComentario] = useState('');
  const [decision, setDecision] = useState<'aprobada' | 'rechazada'>('aprobada');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Obtener el ID del supervisor desde la sesión (en producción)
      // Por ahora usamos un ID fijo que sabemos que existe
      const supervisorId = '4e6b11ba-c1d3-4272-bb18-40860621219a'; // ID de Admin
      
      const result = await aprobarSolicitudAction({
        solicitud_id: solicitudId,
        estado: decision,
        comentario: comentario || null
      }, supervisorId);
      
      if (result.success) {
        router.refresh();
        onClose();
      } else {
        setError(result.error || 'Error al procesar la solicitud');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error(err);
    }
    
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
        
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          {decision === 'aprobada' ? 'Aprobar' : 'Rechazar'} Solicitud
        </h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}
        
        <div className="bg-gray-50 p-3 rounded mb-4 text-sm">
          <p><span className="font-medium">Empleado:</span> {empleadoNombre}</p>
          <p><span className="font-medium">Tipo:</span> {tipo}</p>
          <p><span className="font-medium">Período:</span> {periodo}</p>
          <p><span className="font-medium">Días:</span> {dias}</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Decisión
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="decision"
                value="aprobada"
                checked={decision === 'aprobada'}
                onChange={() => setDecision('aprobada')}
                className="mr-2"
              />
              <span className="text-sm">Aprobar</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="decision"
                value="rechazada"
                checked={decision === 'rechazada'}
                onChange={() => setDecision('rechazada')}
                className="mr-2"
              />
              <span className="text-sm">Rechazar</span>
            </label>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Comentario (opcional)
          </label>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder={decision === 'aprobada' 
              ? "Comentario adicional (ej: disfruta tus vacaciones)" 
              : "Motivo del rechazo"}
          />
        </div>
        
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`px-4 py-2 text-sm text-white rounded-md ${
              decision === 'aprobada' 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-red-600 hover:bg-red-700'
            } disabled:opacity-50`}
          >
            {loading ? 'Procesando...' : decision === 'aprobada' ? 'Aprobar' : 'Rechazar'}
          </button>
        </div>
      </div>
    </div>
  );
}