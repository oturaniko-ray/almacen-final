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
  const [loading, setLoading] = useState(false);
  const [selectedTurno, setSelectedTurno] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cargarTurnos = async () => {
        setLoading(true);
        try {
          const result = await obtenerTurnos();
          if (result.success) {
            setTurnos(result.data || []);
          } else {
            console.error('Error cargando turnos:', result.error);
          }
        } catch (error) {
          console.error('Error inesperado:', error);
        } finally {
          setLoading(false);
        }
      };
      
      cargarTurnos();
    } else {
      // Resetear estado cuando se cierra
      setSelectedTurno('');
      setSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!selectedTurno) {
      alert('Debe seleccionar un turno');
      return;
    }
    
    setSubmitting(true);
    try {
      await onAsignar(selectedTurno);
    } catch (error) {
      console.error('Error en handleSubmit:', error);
      alert('Error al asignar turno');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
        
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Asignar Turno</h2>
        
        <div className="bg-blue-50 border border-blue-200 p-3 rounded mb-4">
          <p className="text-sm text-gray-700">
            <span className="font-medium">Empleado:</span> {empleadoNombre}
          </p>
          <p className="text-sm text-gray-700">
            <span className="font-medium">Fecha:</span> {new Date(fecha).toLocaleDateString('es-ES', { timeZone: 'UTC' })}
          </p>
        </div>
        
        {loading ? (
          <div className="text-center py-4 text-gray-500">Cargando turnos...</div>
        ) : turnos.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            No hay turnos disponibles. Crea turnos primero.
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
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
        
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded border border-gray-300 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedTurno || submitting || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
          >
            {submitting ? 'Asignando...' : 'Asignar Turno'}
          </button>
        </div>
      </div>
    </div>
  );
}