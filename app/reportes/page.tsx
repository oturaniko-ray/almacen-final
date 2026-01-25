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
  // MODIFICACIÓN: Estado para controlar qué fila se está editando manualmente
  const [editandoRow, setEditandoRow] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    const currentUser = JSON.parse(sessionData);
    if (!['admin', 'administrador', 'supervisor'].includes(currentUser.rol)) { router.replace('/'); return; }
    setUser(currentUser);
    consultarReportes();
  }, [router]);

  const consultarReportes = async () => {
    setLoading(true);
    let query = supabase.from('jornadas_completas').select('*').order('hora_entrada', { ascending: false });
    
    if (filtroNombre) query = query.ilike('nombre_empleado', `%${filtroNombre}%`);
    if (fechaInicio) query = query.gte('hora_entrada', `${fechaInicio} 00:00:00`);
    if (fechaFin) query = query.lte('hora_entrada', `${fechaFin} 23:59:59`);

    const { data, error } = await query;
    if (error) {
      console.error("Error cargando reportes:", error);
      setReportes([]);
    } else {
      setReportes(data || []);
    }
    setLoading(false);
  };

  // MODIFICACIÓN: Función para guardar cambios manuales en la base de datos
  const guardarEdicion = async () => {
    if (!editandoRow) return;
    
    const hEntrada = new Date(editandoRow.hora_entrada).getTime();
    const hSalida = new Date(editandoRow.hora_salida).getTime();
    const horasCalculadas = (hSalida - hEntrada) / (1000 * 60 * 60);

    const { error } = await supabase
      .from('jornadas_completas')
      .update({ 
        hora_salida: editandoRow.hora_salida,
        horas_trabajadas: horasCalculadas,
        notas: `Corregido por ${user.nombre}` 
      })
      .eq('id', editandoRow.id);

    if (!error) {
      setEditandoRow(null);
      consultarReportes();
    }
  };

  const exportarExcel = () => {
    if (reportes.length === 0) return;
    const ahora = new Date();
    const timestamp = ahora.toISOString().replace(/[:.-]/g, "").slice(0, 12);
    const rows = [
      ["REPORTE GENERADO POR:", `${user?.nombre} (${user?.rol})`],
      ["FECHA Y HORA DE EXPORTACIÓN:", ahora.toLocaleString()],
      [],
      ["FECHA", "EMPLEADO", "ENTRADA", "SALIDA", "TOTAL HORAS"]
    ];

    let fechaActual = "";
    reportes.forEach(r => {
      const f = new Date(r.hora_entrada).toLocaleDateString();
      if (f !== fechaActual) {
        fechaActual = f;
        rows.push([`--- DÍA: ${fechaActual} ---`]);
      }
      rows.push([f, r.nombre_empleado, new Date(r.hora_entrada).toLocaleTimeString(), r.hora_salida ? new Date(r.hora_salida).toLocaleTimeString() : 'En curso', r.horas_trabajadas?.toFixed(2) || "0.00"]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `operaciones${timestamp}.xlsx`);
  };

  let fechaCabeceraActual = "";

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">Reportes de <span className="text-blue-500">Operaciones</span></h1>
          <div className="flex gap-4">
            {/* MODIFICACIÓN: Botón de exportar restaurado en la parte superior */}
            <button onClick={exportarExcel} className="p-4 bg-emerald-600 rounded-2xl border border-white/5 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500">Exportar Excel</button>
            <button onClick={() => router.push('/admin')} className="p-4 bg-[#1e293b] rounded-2xl border border-white/5 font-black text-[10px] uppercase tracking-widest hover:bg-slate-700">← Volver</button>
          </div>
        </header>

        <div className="bg-[#0f172a] p-8 rounded-[45px] border border-white/5 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-4">Nombre Empleado</label>
              <input className="w-full bg-[#050a14] p-4 rounded-2xl border border-white/10 text-xs" value={filtroNombre} onChange={(e) => setFiltroNombre(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-4">Desde</label>
              <input type="date" className="w-full bg-[#050a14] p-4 rounded-2xl border border-white/10 text-xs text-white" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-4">Hasta</label>
              <input type="date" className="w-full bg-[#050a14] p-4 rounded-2xl border border-white/10 text-xs text-white" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </div>
            <button onClick={consultarReportes} className="bg-blue-600 p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500">Filtrar Listado</button>
          </div>
        </div>

        <div className="bg-[#0f172a] rounded-[45px] border border-white/5 overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/[0.02] text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="p-6">Empleado (Clic para Editar)</th>
                <th className="p-6">Entrada</th>
                <th className="p-6">Salida</th>
                <th className="p-6">Total Horas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {reportes.map((r, i) => {
                const fechaFila = new Date(r.hora_entrada).toLocaleDateString();
                const mostrarSeparador = fechaFila !== fechaCabeceraActual;
                if (mostrarSeparador) fechaCabeceraActual = fechaFila;

                return (
                  <React.Fragment key={i}>
                    {mostrarSeparador && (
                      <tr className="bg-blue-500/5">
                        <td colSpan={4} className="p-3 text-center text-[10px] font-black text-blue-400 uppercase tracking-[0.5em] border-y border-blue-500/10">--- {fechaFila} ---</td>
                      </tr>
                    )}
                    <tr className="hover:bg-white/[0.01] transition-colors group">
                      {/* MODIFICACIÓN: Al hacer clic en el nombre se activa la edición de esa fila */}
                      <td className="p-6 font-bold uppercase text-sm cursor-pointer hover:text-blue-500" onClick={() => setEditandoRow(r)}>{r.nombre_empleado}</td>
                      <td className="p-6 text-xs text-slate-400 font-mono">
                        {editandoRow?.id === r.id ? (
                          <input type="datetime-local" className="bg-[#050a14] border border-blue-500 p-1 rounded text-[10px]" value={editandoRow.hora_entrada.slice(0,16)} onChange={e => setEditandoRow({...editandoRow, hora_entrada: e.target.value})} />
                        ) : new Date(r.hora_entrada).toLocaleString()}
                      </td>
                      <td className="p-6 text-xs text-slate-400 font-mono">
                        {editandoRow?.id === r.id ? (
                          <div className="flex flex-col gap-2">
                            <input type="datetime-local" className="bg-[#050a14] border border-blue-500 p-1 rounded text-[10px]" value={editandoRow.hora_salida?.slice(0,16)} onChange={e => setEditandoRow({...editandoRow, hora_salida: e.target.value})} />
                            <div className="flex gap-2">
                              <button onClick={guardarEdicion} className="bg-emerald-600 px-2 py-1 rounded text-[8px] font-black uppercase">Guardar</button>
                              <button onClick={() => setEditandoRow(null)} className="bg-red-600 px-2 py-1 rounded text-[8px] font-black uppercase">Cancelar</button>
                            </div>
                          </div>
                        ) : r.hora_salida ? new Date(r.hora_salida).toLocaleString() : <span className="text-blue-500 italic">EN CURSO</span>}
                      </td>
                      <td className="p-6">
                        <span className="bg-blue-600/10 text-blue-400 px-4 py-1 rounded-full font-black text-xs">
                          {r.horas_trabajadas ? r.horas_trabajadas.toFixed(2) : '0.00'} H
                        </span>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}