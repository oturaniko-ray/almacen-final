'use client';
import React, { useState, useEffect } from 'react';
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
    setUser(currentUser);
    cargarDatos();
  }, []);

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
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const guardarCambios = async () => {
    if (!editandoRow) return;
    const h1 = new Date(editandoRow.hora_entrada);
    const h2 = new Date(editandoRow.hora_salida);
    const diff = (h2.getTime() - h1.getTime()) / (1000 * 60 * 60);

    const { error } = await supabase.from('jornadas').update({
      hora_entrada: h1.toISOString(),
      hora_salida: h2.toISOString(),
      horas_trabajadas: diff,
      editado_por: user.nombre
    }).eq('id', editandoRow.id);

    if (!error) {
      setEditandoRow(null);
      cargarDatos();
    } else alert(error.message);
  };

  const exportar = () => {
    const ahora = new Date();
    const wb = XLSX.utils.book_new();
    const headers = [
      ["REPORTE DE OPERACIONES - RAY"],
      ["ADMINISTRADOR:", user?.nombre, "FECHA:", ahora.toLocaleString()],
      [],
      ["Empleado", "Entrada", "Salida", "Horas", "Auditado Por"]
    ];
    const rows = reportes.map(r => [
      r.nombre_empleado, 
      new Date(r.hora_entrada).toLocaleString(), 
      r.hora_salida ? new Date(r.hora_salida).toLocaleString() : 'ACTIVO', 
      (r.horas_trabajadas || 0).toFixed(2),
      r.editado_por || 'Original'
    ]);
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, "Jornadas");
    XLSX.writeFile(wb, `Reporte_RAY_${ahora.getTime()}.xlsx`);
  };

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-4 md:p-8 font-sans">
      {/* MODAL DE EDICIÓN */}
      {editandoRow && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-blue-500/30 p-8 rounded-[40px] max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-black uppercase text-blue-500 italic mb-6">Ajuste de Jornada</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Entrada</label>
                <input type="datetime-local" className="w-full bg-[#050a14] border border-white/5 p-4 rounded-2xl text-white" 
                  value={editandoRow.hora_entrada.slice(0, 16)} 
                  onChange={e => setEditandoRow({...editandoRow, hora_entrada: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Salida</label>
                <input type="datetime-local" className="w-full bg-[#050a14] border border-white/5 p-4 rounded-2xl text-white" 
                  value={editandoRow.hora_salida?.slice(0, 16) || ''} 
                  onChange={e => setEditandoRow({...editandoRow, hora_salida: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button onClick={guardarCambios} className="flex-1 bg-blue-600 p-4 rounded-2xl font-black uppercase text-xs tracking-widest">Confirmar</button>
              <button onClick={() => setEditandoRow(null)} className="bg-slate-800 p-4 rounded-2xl font-black uppercase text-xs tracking-widest">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start mb-10 gap-4">
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter">REPORTES <span className="text-blue-500">RAY</span></h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">
              ADMIN: <span className="text-blue-400">{user?.nombre}</span> | ROL: <span className="text-blue-400">{user?.rol}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={exportar} className="bg-emerald-600 hover:bg-emerald-500 px-8 py-4 rounded-2xl font-black text-xs uppercase transition-all shadow-lg shadow-emerald-900/20">📥 Exportar XLSX</button>
            <button onClick={() => router.push('/admin')} className="bg-slate-800 px-8 py-4 rounded-2xl font-black text-xs uppercase">Volver</button>
          </div>
        </header>

        {/* FILTROS DINÁMICOS */}
        <div className="bg-[#0f172a] p-6 rounded-[35px] border border-white/5 mb-8 flex flex-wrap gap-4 items-end shadow-xl">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] font-black uppercase ml-2 text-slate-500">Filtrar por Empleado</label>
            <input type="text" value={filtroNombre} onChange={e => setFiltroNombre(e.target.value)} className="w-full bg-[#050a14] border border-white/5 p-4 rounded-2xl text-sm" placeholder="Buscar coincidencias..." />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-black uppercase ml-2 text-slate-500">Desde</label>
            <input type="datetime-local" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="bg-[#050a14] border border-white/5 p-4 rounded-2xl text-sm text-white" />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-black uppercase ml-2 text-slate-500">Hasta</label>
            <input type="datetime-local" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="bg-[#050a14] border border-white/5 p-4 rounded-2xl text-sm text-white" />
          </div>
          <button onClick={cargarDatos} className="bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-2xl font-black text-xs uppercase h-[58px] transition-all">Actualizar</button>
        </div>

        <div className="bg-[#0f172a] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/[0.02] text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5">
                <th className="p-6">Empleado</th>
                <th className="p-6">Entrada</th>
                <th className="p-6">Salida</th>
                <th className="p-6">Horas</th>
                <th className="p-6 text-center">Editar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {reportes.map((r, i) => (
                <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                  <td className="p-6 font-bold uppercase text-sm">{r.nombre_empleado}</td>
                  <td className="p-6 text-xs text-slate-400 font-mono">{new Date(r.hora_entrada).toLocaleString()}</td>
                  <td className="p-6 text-xs text-slate-400 font-mono">{r.hora_salida ? new Date(r.hora_salida).toLocaleString() : <span className=\"text-blue-500 italic\">ACTIVO</span>}</td>
                  <td className=\"p-6\">
                    <span className=\"bg-blue-600/10 text-blue-400 px-4 py-1 rounded-full font-black text-xs\">
                      {(r.horas_trabajadas || 0).toFixed(2)} H
                    </span>
                  </td>
                  <td className=\"p-6 text-center\">
                    <button onClick={() => setEditandoRow(r)} className=\"p-2 hover:bg-blue-500/20 rounded-xl text-blue-500 transition-all text-xl\">✏️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
