'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminPage() {
  const [view, setView] = useState<'movimientos' | 'registro'>('movimientos');
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    const { data: emps } = await supabase.from('empleados').select('*').order('nombre');
    setEmpleados(emps || []);
    const { data: lg } = await supabase.from('registros_acceso').select('*').order('fecha_hora', { ascending: false });
    setLogs(lg || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-black text-blue-500 tracking-tighter">ADMINISTRACIÓN</h1>
          <div className="flex gap-2">
            {/* BOTÓN ACTUALIZAR AÑADIDO */}
            <button onClick={cargarDatos} className={`p-3 bg-slate-800 rounded-xl hover:bg-slate-700 transition-all ${loading ? 'animate-spin' : ''}`}>
              🔄
            </button>
            <button onClick={() => setView('movimientos')} className={`px-4 py-2 rounded-xl font-bold ${view === 'movimientos' ? 'bg-blue-600' : 'bg-slate-800'}`}>Movimientos</button>
            <button onClick={() => setView('registro')} className={`px-4 py-2 rounded-xl font-bold ${view === 'registro' ? 'bg-blue-600' : 'bg-slate-800'}`}>Personal</button>
          </div>
        </div>

        <div className="bg-[#0f172a] rounded-[30px] border border-white/5 overflow-hidden shadow-2xl">
          {/* Contenedor con Scroll y Altura para 6 filas aprox */}
          <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#1e293b] z-10 shadow-md">
                <tr className="text-[10px] uppercase tracking-widest text-slate-400">
                  <th className="p-5">Nombre / ID</th>
                  <th className="p-5">{view === 'movimientos' ? 'Tipo' : 'Email'}</th>
                  <th className="p-5">{view === 'movimientos' ? 'Fecha/Hora' : 'Rol'}</th>
                  <th className="p-5">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(view === 'movimientos' ? logs : empleados).map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-5 font-bold">{item.nombre || item.nombre_empleado}</td>
                    <td className="p-5">
                      {view === 'movimientos' ? (
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black ${item.tipo_movimiento === 'entrada' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                          {item.tipo_movimiento?.toUpperCase()}
                        </span>
                      ) : item.email}
                    </td>
                    <td className="p-5 text-slate-400 text-sm">
                      {view === 'movimientos' ? new Date(item.fecha_hora).toLocaleString() : item.rol}
                    </td>
                    <td className="p-5">
                       <button className="text-blue-500 text-xs font-bold hover:underline">Ver</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}