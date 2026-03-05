'use client';

import { format, addWeeks, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

interface SemanaSelectorProps {
  fechaBase: Date;
  onChange: (fecha: Date) => void;
}

export function SemanaSelector({ fechaBase, onChange }: SemanaSelectorProps) {
  // Calcular inicio y fin de la semana
  const inicio = startOfWeek(fechaBase, { weekStartsOn: 1 }); // 1 = Lunes
  const fin = endOfWeek(fechaBase, { weekStartsOn: 1 });

  // Formatear para mostrar
  const textoPeriodo = `${format(inicio, 'dd/MM/yyyy', { locale: es })} - ${format(fin, 'dd/MM/yyyy', { locale: es })}`;

  return (
    <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow">
      <button
        onClick={() => onChange(subWeeks(fechaBase, 1))}
        className="p-2 hover:bg-gray-100 rounded-full"
        title="Semana anterior"
      >
        ← Anterior
      </button>
      
      <div className="flex-1 text-center">
        <p className="text-sm text-gray-500">Semana del</p>
        <p className="font-semibold text-lg">{textoPeriodo}</p>
      </div>
      
      <button
        onClick={() => onChange(addWeeks(fechaBase, 1))}
        className="p-2 hover:bg-gray-100 rounded-full"
        title="Semana siguiente"
      >
        Siguiente →
      </button>
    </div>
  );
}