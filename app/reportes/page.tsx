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
  const [editandoRow, setEditandoRow] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    const currentUser = JSON.parse(sessionData);
    if (!['admin', 'administrador', 'supervisor'].includes(currentUser.rol)) { 
      router.replace('/'); 
      return; 
    }
    setUser(currentUser);
    cargarDatos();
  }, [router]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      let query = supabase.from('jornadas').select('*');
      if (filtroNombre) query = query.ilike('nombre_empleado', `%${filtroNombre}%`);
      if (fechaInicio) query = query.gte('hora_entrada', fechaInicio);
      if (fechaFin) query = query.lte('hora_entrada', fechaFin);
      const { data, error } = await query.order('hora_entrada', { ascending: false });
      if (error) throw error;
      setReportes(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const guardarCambios = async () => {
    if (!editandoRow) return;
    const h1 = new Date(editandoRow.hora_entrada);
    const h2 = new Date(editandoRow.hora_salida);
    const diff = (h2.getTime() - h1.getTime()) / 3600000;

    const { error } = await supabase.from('jornadas').update({
      hora_entrada: h1.toISOString(),
      hora_salida: h2.toISOString(),
      horas_trabajadas: diff,
      editado_por: user.nombre,
      estado: 'finalizado'
    }).eq('id', editandoRow.id);

    if (!error) {
      setEditandoRow(null);
      cargarDatos();
    } else {
      alert("Error: " + error.message);
    }
  };

  const exportarExcel = () => {
    const ahora = new Date();
    const headers = [
      ["REPORTE DE PERSONAL - RAY"],
      ["ADMIN:", user?.nombre],
      ["FECHA:", ahora.toLocaleString()],
      [],
      ["Empleado", "Entrada", "Salida", "Horas", "Auditado Por"]
    ];
    const filas = reportes.map(r => [
      r.nombre_empleado,
      new Date(r.hora_entrada).toLocaleString(),
      r.hora_salida ? new Date(r.hora_salida).toLocaleString() : 'ACTIVO',
      (r.horas_trabajadas || 0).toFixed(2),
      r.editado_por || 'Sistema'
    ]);
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...filas]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jornadas");
    XLSX.writeFile(wb, `Reporte_RAY.xlsx`);
  };

  let fechaActual = "";

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-4 md:p-12">
      {editandoRow && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-[#0f172a] p-10 rounded-[40px] border border-white/10 max-w-md w-full">
            <h2 className="text-xl font-black uppercase text-blue-500 italic mb-6">Ajuste Manual</h2>
            <div className="space-y-4">
              <input type="datetime-local" className="w-full bg-black border border-white/5 p-4 rounded-2xl" value={editandoRow.hora_entrada.slice(0, 16)} onChange={e => setEditandoRow({...editandoRow, hora_entrada: e.target.value})} />
              <input type="datetime-local" className="w-full bg-black border border-white/5 p-4 rounded-2xl" value={editandoRow.hora_salida?.slice(0, 16) || ''} onChange={e => setEditandoRow({...editandoRow, hora_salida: e.target.value})} />
            </div>
            <div className="flex gap-4 mt-8">
              <button onClick={guardarCambios} className="flex-1 bg-blue-600 p-4 rounded-2xl font-black uppercase text-xs">Guardar</button>
              <button onClick={() => setEditandoRow(null)} className="flex-1 bg-slate-800 p-4 rounded-2xl font-black uppercase text-xs">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter">REPORTES <span className="text-blue-500">RAY</span></h1>
          <div className="flex gap-3">
            <button onClick={exportarExcel} className="bg-emerald-600 px-6 py-3 rounded-2xl font-black text-xs uppercase">Excel</button>
            <button onClick={() => router.push('/admin')} className="bg-slate-800 px-6 py-3 rounded-2xl font-black text-xs uppercase">Volver</button>
          </div>
        </header>

        <div className="bg-[#0f172a] p-6 rounded-[35px] border border-white/5 mb-8 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]"><input type="text" placeholder="Empleado..." className="w-full bg-black border border-white/5 p-4 rounded-2xl" value={filtroNombre} onChange={e => setFiltroNombre(e.target.value)} /></div>
          <input type="datetime-local" className="bg-black border border-white/5 p-4 rounded-2xl" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
          <input type="datetime-local" className="bg-black border border-white/5 p-4 rounded-2xl" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
          <button onClick={cargarDatos} className="bg-blue-600 px-8 py-4 rounded-2xl font-black text-xs uppercase h-[58px]">Filtrar</button>
        </div>

        <div className="bg-[#0f172a] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-white/5 text-slate-500 text-[10px] font-black uppercase tracking-widest">
              <tr>
                <th className="p-8">Empleado</th>
                <th className="p-8">Entrada</th>
                <th className="p-8">Salida</th>
                <th className="p-8">Horas</th>
                <th className="p-8 text-center">Ajuste</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {reportes.map((r, i) => {
                const f = new Date(r.hora_entrada).toLocaleDateString();
                const s = f !== fechaActual;
                if (s) fechaActual = f;
                return (
                  <React.Fragment key={i}>
                    {s && <tr><td colSpan={5} className="p-4 text-center text-[10px] font-black text-blue-500 uppercase tracking-[0.5em] bg-blue-500/5">-- {f} --</td></tr>}
                    <tr className="hover:bg-white/[0.01]">
                      <td className="p-8 font-bold uppercase">{r.nombre_empleado}</td>
                      <td className="p-8 text-xs text-slate-400 font-mono">{new Date(r.hora_entrada).toLocaleString()}</td>
                      <td className="p-8 text-xs text-slate-400 font-mono">{r.hora_salida ? new Date(r.hora_salida).toLocaleString() : <span className="text-blue-500 italic">ACTIVO</span>}</td>
                      <td className="p-8"><span className="bg-blue-600/10 text-blue-400 px-4 py-1 rounded-full font-black text-xs">{(r.horas_trabajadas || 0).toFixed(2)} H</span></td>
                      <td className="p-8 text-center"><button onClick={() => setEditandoRow(r)} className="text-xl">✏️</button></td>
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