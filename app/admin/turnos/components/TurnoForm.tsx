'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const DIAS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
];

interface TurnoFormProps {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  submitText: string;
  initialData?: any;
}

export function TurnoForm({ action, submitText, initialData }: TurnoFormProps) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const result = await action(formData);
    
    if (result && 'error' in result) {
      setError(result.error || 'Error al guardar');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre del Turno
        </label>
        <input
          type="text"
          name="nombre"
          defaultValue={initialData?.nombre}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          placeholder="Ej: Turno Mañana"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descripción (opcional)
        </label>
        <textarea
          name="descripcion"
          defaultValue={initialData?.descripcion}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          placeholder="Descripción del turno..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hora Inicio
          </label>
          <input
            type="time"
            name="hora_inicio"
            defaultValue={initialData?.hora_inicio?.slice(0,5) || '08:00'}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hora Fin
          </label>
          <input
            type="time"
            name="hora_fin"
            defaultValue={initialData?.hora_fin?.slice(0,5) || '17:00'}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Días de la Semana
        </label>
        <div className="flex flex-wrap gap-3">
          {DIAS.map(dia => (
            <label key={dia.value} className="flex items-center space-x-1">
              <input
                type="checkbox"
                name={`dia_${dia.value}`}
                defaultChecked={initialData?.dias_semana?.includes(dia.value) ?? [1,2,3,4,5].includes(dia.value)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">{dia.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Capacidad Mínima
          </label>
          <input
            type="number"
            name="capacidad_min"
            defaultValue={initialData?.capacidad_min || 1}
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Capacidad Máxima
          </label>
          <input
            type="number"
            name="capacidad_max"
            defaultValue={initialData?.capacidad_max || 5}
            min="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
        >
          {loading ? 'Guardando...' : submitText}
        </button>
      </div>
    </form>
  );
}