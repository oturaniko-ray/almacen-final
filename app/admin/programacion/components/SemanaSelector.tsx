'use client';

import { format, addWeeks, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

interface SemanaSelectorProps {
  fechaBase: Date;
  onChange: (fecha: Date) => void;
}

export function SemanaSelector({ fechaBase, onChange }: SemanaSelectorProps) {
  const inicio = startOfWeek(fechaBase, { weekStartsOn: 1 });
  const fin = endOfWeek(fechaBase, { weekStartsOn: 1 });
  const textoPeriodo = `${format(inicio, 'dd/MM/yyyy', { locale: es })} - ${format(fin, 'dd/MM/yyyy', { locale: es })}`;

  return (
    <div className="bg-white border-2 border-blue-200 rounded-lg p-4 shadow-sm mb-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => onChange(subWeeks(fechaBase, 1))}
          className="px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 rounded-md transition-colors border border-blue-200"
        >
          ← Anterior
        </button>
        
        <div className="text-center">
          <p className="text-xs text-blue-600 uppercase tracking-wider font-semibold">Semana</p>
          <p className="font-semibold text-blue-900">{textoPeriodo}</p>
        </div>
        
        <button
          onClick={() => onChange(addWeeks(fechaBase, 1))}
          className="px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 rounded-md transition-colors border border-blue-200"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}