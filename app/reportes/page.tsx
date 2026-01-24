'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function ReportesPage() {
  const [user, setUser] = useState<any>(null);
  const [reportes, setReportes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroNombre, setFiltroNombre] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [sesionDuplicada, setSesionDuplicada] = useState(false);
  
  const sessionId = useRef(Math.random().toString(36).substring(7));
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) {
      router.push('/');
      return;
    }
    const currentUser = JSON.parse(sessionData);
    if (!['admin', 'administrador', 'supervisor'].includes(currentUser.rol)) {
      router.push('/');
      return;
    }
    setUser(currentUser);

    // Control de sesión única
    const canalSesion = supabase.channel('reportes-session-control');
    canalSesion
      .on('broadcast', { event: 'nueva-sesion' }, (payload) => {
        if (payload.payload.userEmail === currentUser.email && payload.payload.sid !== sessionId.current) {
          setSesionDuplicada(true);
          localStorage.removeItem('user_session');
          setTimeout(() => router.push('/'), 3000);
        }
      })
      .subscribe();

    cargarDatos();
    return () => { supabase.removeChannel(canalSesion); };
  }, [router]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      let query = supabase.from('reporte_jornadas').select('*');
      
      if (fechaInicio) query = query.gte('hora_entrada', fechaInicio);
      if (fechaFin) query = query.lte('hora_entrada', fechaFin);
      if (filtroNombre) query = query.ilike('nombre_empleado', `%${filtroNombre}%`);

      const { data, error } = await query.order('hora_entrada', { ascending: false });
      if (error) throw error;
      setReportes(data || []);
    } catch (err) {
      console.error("Error cargando reportes:", err);
    } finally {
      setLoading(false);
    }
  };

  const exportarExcel = () => {
    const datosExcel = reportes.map(r => ({
      Empleado: r.nombre_empleado,
      Entrada: new Date(r.hora_entrada).toLocaleString(),
      Salida: r.hora_salida ? new Date(r.hora_salida).toLocaleString() : 'PENDIENTE',
      'Horas Totales': r.horas_trabajadas ? r.horas_trabajadas.toFixed(2) : '0'
    }));

    const ws = XLSX.utils.json_to_sheet(datosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jornadas");
    XLSX.writeFile(wb, `Reporte_RAY_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Cálculos rápidos para los widgets
  const totalHorasFlota = reportes.reduce((acc, curr) => acc + (curr.horas_trabajadas || 0), 0);
  // CORRECCIÓN: Se usa .length en lugar de .size para el array de IDs únicos
  const promedioPorEmpleado = reportes.length > 0 ? totalHorasFlota / [...new Set(reportes.map(r => r.empleado_id))].length : 0;

  if (sesionDuplicada) {
    return (
      <main className="h-screen bg-black flex items-center justify-center text-white">
        <div className="border-2 border-red-600 p-10 rounded-[40px] animate-pulse text-center">
          <h2 className="text-4xl font-black text-red-500 uppercase italic">Sesión Duplicada</h2>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter">
              REPORTES DE <span className="text-amber-500">OPERACIÓN</span>
            </h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Análisis de productividad RAY</p>
          </div>
          <div className="flex gap-3">
            <button onClick={exportarExcel} className="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all shadow-lg">
              📥 Exportar Excel
            </button>
            <button onClick={() => router.push('/')} className="bg-slate-800 hover:bg-slate-700 px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all">
              Volver
            </button>
          </div>
        </div>

        {/* Widgets de Resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#0f172a] p-6 rounded-[30px] border border-white/5">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Total Horas Flota</p>
            <p className="text-4xl font-black text-blue-500">{totalHorasFlota.toFixed(1)} <span className="text-sm text-slate-400">HRS</span></p>
          </div>
          <div className="bg-[#0f172a] p-6 rounded-[30px] border border-white/5">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Promedio por Persona</p>
            <p className="text-4xl font-black text-amber-500">{promedioPorEmpleado.toFixed(1)} <span className="text-sm text-slate-400">HRS</span></p>
          </div>
          <div className="bg-[#0f172a] p-6 rounded-[30px] border border-white/5">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Registros en Rango</p>
            <p className="text-4xl font-black text-emerald-500">{reportes.length}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-[#0f172a] p-6 rounded-[35px] border border-white/5 mb-8 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-black uppercase ml-2 text-slate-500">Buscar Empleado</label>
            <input type="text" value={filtroNombre} onChange={(e) => setFiltroNombre(e.target.value)} className="w-full bg-[#050a14] border border-white/5 p-3 rounded-xl outline-none focus:border-amber-500 transition-all text-sm" placeholder="Nombre..." />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase ml-2 text-slate-500">Desde</label>
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full bg-[#050a14] border border-white/5 p-3 rounded-xl outline-none focus:border-amber-500 transition-all text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase ml-2 text-slate-500">Hasta</label>
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-full bg-[#050a14] border border-white/5 p-3 rounded-xl outline-none focus:border-amber-500 transition-all text-sm" />
          </div>
          <button onClick={cargarDatos} className="bg-blue-600 hover:bg-blue-500 px-8 py-3 rounded-xl font-black text-xs uppercase h-[46px]">Filtrar</button>
        </div>

        {/* Tabla de Resultados */}
        <div className="bg-[#0f172a] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  <th className="p-6">Empleado</th>
                  <th className="p-6">Entrada</th>
                  <th className="p-6">Salida</th>
                  <th className="p-6">Horas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td colSpan={4} className="p-20 text-center animate-pulse font-black text-slate-500 uppercase tracking-widest">Cargando datos maestros...</td></tr>
                ) : reportes.length === 0 ? (
                  <tr><td colSpan={4} className="p-20 text-center font-black text-slate-600 uppercase tracking-widest">No hay jornadas registradas</td></tr>
                ) : (
                  reportes.map((r, i) => (
                    <tr key={i} className="hover:bg-white/[0.01] transition-colors group">
                      <td className="p-6 font-bold group-hover:text-amber-500 transition-colors">{r.nombre_empleado}</td>
                      <td className="p-6 text-xs text-slate-400 font-mono">{new Date(r.hora_entrada).toLocaleString()}</td>
                      <td className="p-6 text-xs text-slate-400 font-mono">{r.hora_salida ? new Date(r.hora_salida).toLocaleString() : <span className="text-blue-500 italic">EN CURSO</span>}</td>
                      <td className="p-6">
                        <span className="bg-blue-600/10 text-blue-400 px-4 py-1 rounded-full font-black text-xs">
                          {r.horas_trabajadas ? r.horas_trabajadas.toFixed(2) : '0.00'} H
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}