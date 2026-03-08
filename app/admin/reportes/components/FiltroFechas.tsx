'use client';

import { useState } from 'react';

interface FiltroFechasProps {
  onFiltrar: (fechaInicio: string, fechaFin: string) => void;
  fechaInicial?: string;
}

export function FiltroFechas({ onFiltrar, fechaInicial }: FiltroFechasProps) {
  const [fechaInicio, setFechaInicio] = useState(() => {
    if (fechaInicial) return fechaInicial;
    const hoy = new Date();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - hoy.getDay() + 1);
    return lunes.toISOString().split('T')[0];
  });
  
  const [fechaFin, setFechaFin] = useState(() => {
    if (fechaInicial) {
      const fin = new Date(fechaInicial);
      fin.setDate(fin.getDate() + 6);
      return fin.toISOString().split('T')[0];
    }
    const hoy = new Date();
    const domingo = new Date(hoy);
    domingo.setDate(hoy.getDate() - hoy.getDay() + 7);
    return domingo.toISOString().split('T')[0];
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFiltrar(fechaInicio, fechaFin);
  };

  const setSemanaActual = () => {
    const hoy = new Date();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - hoy.getDay() + 1);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    
    setFechaInicio(lunes.toISOString().split('T')[0]);
    setFechaFin(domingo.toISOString().split('T')[0]);
  };

  const setSemanaPasada = () => {
    const hoy = new Date();
    const lunesPasado = new Date(hoy);
    lunesPasado.setDate(hoy.getDate() - hoy.getDay() - 6);
    const domingoPasado = new Date(lunesPasado);
    domingoPasado.setDate(lunesPasado.getDate() + 6);
    
    setFechaInicio(lunesPasado.toISOString().split('T')[0]);
    setFechaFin(domingoPasado.toISOString().split('T')[0]);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Fecha Inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              required
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Fecha Fin</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              required
            />
          </div>
          <div className="flex gap-2 self-end">
            <button
              type="button"
              onClick={setSemanaActual}
              className="px-3 py-2 text-xs border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Semana Actual
            </button>
            <button
              type="button"
              onClick={setSemanaPasada}
              className="px-3 py-2 text-xs border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Semana Pasada
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              Filtrar
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}