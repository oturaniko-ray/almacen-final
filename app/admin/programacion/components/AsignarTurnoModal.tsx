'use client';

import { useState, useEffect } from 'react';
import { obtenerTurnos } from '@/lib/turnos/service';
import type { Turno } from '@/lib/turnos/types';

interface AsignarTurnoModalProps {
  isOpen: boolean;
  onClose: () => void;
  empleadoId: string;
  empleadoNombre: string;
  fecha: string;
  onAsignar: (turnoId: string) => Promise<void>;
}

export function AsignarTurnoModal({ 
  isOpen, 
  onClose, 
  empleadoId, 
  empleadoNombre, 
  fecha, 
  onAsignar 
}: AsignarTurnoModalProps) {
  
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTurno, setSelectedTurno] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Cargar turnos disponibles al abrir el modal
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      obtenerTurnos()
        .then(result => {
          if (result.success) {
            setTurnos(result.data || []);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedTurno) return;
    
    setSubmitting(true);
    await onAsignar(selectedTurno);
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        
        {/* Header */}
        <h2 className="text-xl font-bold mb-4">Asignar Turno</h2>
        
        {/* Info */}
        <div className="bg-blue-50 p-3 rounded mb-4">
          <p className="text-sm">
            <span className="font-medium">Empleado:</span> {empleadoNombre}
          </p>
          <p className="text-sm">
            <span className="font-medium">Fecha:</span> {new Date(fecha).toLocaleDateString('es-ES')}
          </p>
        </div>
        
        {/* Lista de turnos */}
        {loading ? (
          <div className="text-center py-4">Cargando turnos...</div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {turnos.map(turno => (
              <label 
                key={turno.id}
                className={`block p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                  selectedTurno === turno.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="turno"
                  value={turno.id}
                  checked={selectedTurno === turno.id}
                  onChange={(e) => setSelectedTurno(e.target.value)}
                  className="mr-2"
                />
                <span className="font-medium">{turno.nombre}</span>
                <span className="text-sm text-gray-600 ml-2">
                  ({turno.hora_inicio.slice(0,5)} - {turno.hora_fin.slice(0,5)})
                </span>
              </label>
            ))}
          </div>
        )}
        
        {/* Botones */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedTurno || submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
          >
            {submitting ? 'Asignando...' : 'Asignar Turno'}
          </button>
        </div>
      </div>
    </div>
  );
}