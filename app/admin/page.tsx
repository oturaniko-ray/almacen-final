'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminDashboard() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      const { data } = await supabase
        .from('registros_acceso')
        .select('*')
        .order('fecha_hora', { ascending: false });
      setLogs(data || []);
    };
    fetchLogs();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <h1 className="text-3xl font-bold text-blue-500 mb-8 border-b border-slate-800 pb-4">
        Control de Asistencia - Almacén
      </h1>

      <div className="overflow-x-auto bg-slate-900 rounded-2xl border border-slate-800">
        <table className="w-full text-left">
          <thead className="bg-slate-800 text-slate-400 uppercase text-xs">
            <tr>
              <th className="p-4">Empleado</th>
              <th className="p-4">Fecha/Hora</th>
              <th className="p-4">Tipo</th>
              <th className="p-4">Ubicación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="p-4 font-medium">{log.nombre_empleado || 'Desconocido'}</td>
                <td className="p-4 text-slate-400">
                  {new Date(log.fecha_hora).toLocaleString()}
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                    log.tipo_movimiento === 'entrada' ? 'bg-emerald-900/30 text-emerald-500' : 'bg-orange-900/30 text-orange-500'
                  }`}>
                    {log.tipo_movimiento.toUpperCase()}
                  </span>
                </td>
                <td className="p-4 text-xs font-mono text-slate-500">{log.coordenadas_validacion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}