'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminPage() {
  const [view, setView] = useState<'menu' | 'empleados' | 'movimientos'>('menu');
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

  if (view === 'menu') {
    return (
      <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white">
        <h1 className="text-3xl font-black mb-12 text-blue-500 uppercase tracking-widest">Panel de Control</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          <button onClick={() => setView('empleados')} className="p-12 bg-[#0f172a] hover:bg-blue-600 rounded-[40px] border border-white/5 transition-all group">
            <span className="text-5xl block mb-4 group-hover:scale-110 transition-transform">👥</span>
            <span className="text-xl font-black uppercase tracking-tight">Gestión de Empleados</span>
          </button>
          <button onClick={() => setView('movimientos')} className="p-12 bg-[#0f172a] hover:bg-emerald-600 rounded-[40px] border border-white/5 transition-all group">
            <span className="text-5xl block mb-4 group-hover:scale-110 transition-transform">📑</span>
            <span className="text-xl font-black uppercase tracking-tight">Movimientos de Acceso</span>
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <button onClick={() => setView('menu')} className="text-slate-500 font-bold hover:text-white transition-colors">← VOLVER AL MENÚ</button>
          <h1 className="text-2xl font-black text-blue-500 uppercase tracking-widest">
            {view === 'empleados' ? 'Personal Registrado' : 'Historial de Movimientos'}
          </h1>
          <div className="flex gap-3">
            {view === 'empleados' && <button className="px-5 py-2 bg-blue-600 rounded-xl font-bold text-sm">+ NUEVO</button>}
            <button onClick={cargarDatos} className="px-5 py-2 bg-slate-800 rounded-xl font-bold text-sm flex items-center gap-2">
              {loading ? '...' : '🔄 ACTUALIZAR'}
            </button>
          </div>
        </div>

        <div className="bg-[#0f172a] rounded-[35px] border border-white/5 overflow-hidden shadow-2xl">
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#1e293b] z-20 shadow-xl">
                <tr className="text-[10px] uppercase tracking-widest text-slate-400">
                  {view === 'empleados' ? (
                    <>
                      <th className="p-6">Nombre</th><th className="p-6">Rol / Email</th><th className="p-6">Activo</th><th className="p-6">Ubicación</th>
                    </>
                  ) : (
                    <>
                      <th className="p-6">Nombre</th><th className="p-6">Movimiento</th><th className="p-6">Fecha y Hora</th><th className="p-6">Método / Autorizó</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {view === 'empleados' ? empleados.map(emp => (
                  <tr key={emp.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-6 font-bold flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${emp.en_almacen ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                      {emp.nombre}
                    </td>
                    <td className="p-6 text-sm text-slate-400">{emp.rol}<br/><span className="text-[10px]">{emp.email}</span></td>
                    <td className="p-6 font-black text-xs">{emp.activo ? '✅ SI' : '❌ NO'}</td>
                    <td className="p-6"><span className={`px-3 py-1 rounded-lg text-[10px] font-black ${emp.en_almacen ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>{emp.en_almacen ? 'ALMACÉN' : 'EXTERIOR'}</span></td>
                  </tr>
                )) : logs.map(log => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-6 font-bold">{log.nombre_empleado}</td>
                    <td className="p-6">
                      <span className={`px-4 py-1 rounded-full text-[10px] font-black ${log.tipo_movimiento === 'entrada' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                        {log.tipo_movimiento?.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-6 text-sm text-slate-400">{new Date(log.fecha_hora).toLocaleString()}</td>
                    <td className="p-6 text-[10px] text-slate-500 font-bold uppercase tracking-tighter">{log.detalles}</td>
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