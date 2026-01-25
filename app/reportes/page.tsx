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
  }, [router]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      // Ahora consultamos la TABLA física
      let query = supabase.from('jornadas_consolidadas').select('*');
      if (filtroNombre) query = query.ilike('nombre_empleado', `%${filtroNombre}%`);
      if (fechaInicio) query = query.gte('hora_entrada', fechaInicio);
      if (fechaFin) query = query.lte('hora_entrada', fechaFin);

      const { data, error } = await query.order('hora_entrada', { ascending: false });
      if (error) throw error;
      setReportes(data || []);
    } catch (err) {
      console.error("Error cargando reportes:", err);
    } finally {
      setLoading(false);
    }
  };

  const guardarCambiosManuales = async () => {
    if (!editandoRow) return;
    
    const entrada = new Date(editandoRow.hora_entrada);
    const salida = new Date(editandoRow.hora_salida);
    const nuevasHoras = (salida.getTime() - entrada.getTime()) / (1000 * 60 * 60);

    const { error } = await supabase
      .from('jornadas_consolidadas') 
      .update({
        hora_entrada: entrada.toISOString(),
        hora_salida: salida.toISOString(),
        horas_trabajadas: nuevasHoras,
        editado_por: user.nombre // Guardamos quién hizo el cambio
      })
      .eq('id', editandoRow.id);

    if (!error) {
      setEditandoRow(null);
      alert("✅ Jornada actualizada y auditada correctamente.");
      cargarDatos();
    } else {
      alert("Error al guardar: " + error.message);
    }
  };

  const exportarExcel = () => {
    const ahora = new Date();
    const membrete = [
      ["SISTEMA DE CONTROL RAY - REPORTE CRÍTICO"],
      ["ADMINISTRADOR:", user?.nombre],
      ["FECHA EXPORTACIÓN:", ahora.toLocaleString()],
      [],
      ["EMPLEADO", "ENTRADA", "SALIDA", "HORAS", "MODIFICADO POR"]
    ];

    const filas = reportes.map(r => [
      r.nombre_empleado,
      new Date(r.hora_entrada).toLocaleString(),
      r.hora_salida ? new Date(r.hora_salida).toLocaleString() : 'ACTIVO',
      (r.horas_trabajadas || 0).toFixed(2),
      r.editado_por || 'ORIGINAL'
    ]);

    const ws = XLSX.utils.aoa_to_sheet([...membrete, ...filas]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `Reporte_Consolidado_${ahora.getTime()}.xlsx`);
  };

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-8">
      {/* Modal de edición con estilo profesional */}
      {editandoRow && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-blue-500/30 p-8 rounded-[30px] max-w-md w-full">
            <h2 className="text-xl font-black italic uppercase text-blue-500 mb-6">Corregir Jornada</h2>
            <div className="space-y-4">
              <input type="datetime-local" className="w-full bg-black border border-white/10 p-4 rounded-2xl"
                value={editandoRow.hora_entrada.slice(0, 16)} 
                onChange={e => setEditandoRow({...editandoRow, hora_entrada: e.target.value})} />
              <input type="datetime-local" className="w-full bg-black border border-white/10 p-4 rounded-2xl"
                value={editandoRow.hora_salida?.slice(0, 16) || ''} 
                onChange={e => setEditandoRow({...editandoRow, hora_salida: e.target.value})} />
            </div>
            <div className="flex gap-4 mt-8">
              <button onClick={guardarCambiosManuales} className="flex-1 bg-blue-600 py-4 rounded-2xl font-black uppercase text-xs">Guardar Cambios</button>
              <button onClick={() => setEditandoRow(null)} className="flex-1 bg-slate-800 py-4 rounded-2xl font-black uppercase text-xs">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter">Reportes <span className="text-blue-600">RAY</span></h1>
            <p className="text-[10px] font-black text-slate-500 uppercase mt-2 tracking-widest">Responsable: {user?.nombre}</p>
          </div>
          <button onClick={exportarExcel} className="bg-emerald-600 px-8 py-4 rounded-2xl font-black uppercase text-xs hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20">📥 Exportar XLSX</button>
        </div>

        {/* Filtros rápidos con datetime-local */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 bg-[#0f172a] p-6 rounded-[30px] border border-white/5">
          <input type="text" placeholder="Buscar empleado..." value={filtroNombre} onChange={e => setFiltroNombre(e.target.value)} className="bg-black border border-white/10 p-3 rounded-xl text-sm" />
          <input type="datetime-local" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="bg-black border border-white/10 p-3 rounded-xl text-sm" />
          <input type="datetime-local" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="bg-black border border-white/10 p-3 rounded-xl text-sm" />
          <button onClick={cargarDatos} className="bg-blue-600 rounded-xl font-black uppercase text-xs">Filtrar</button>
        </div>

        <div className="bg-[#0f172a] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-white/5 text-[10px] font-black uppercase text-slate-500">
              <tr>
                <th className="p-6">Empleado</th>
                <th className="p-6">Entrada</th>
                <th className="p-6">Salida</th>
                <th className="p-6">Total Horas</th>
                <th className="p-6 text-center">Ajuste</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {reportes.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.02] transition-all">
                  <td className="p-6 font-bold uppercase">{r.nombre_empleado}</td>
                  <td className="p-6 text-xs font-mono text-slate-400">{new Date(r.hora_entrada).toLocaleString()}</td>
                  <td className="p-6 text-xs font-mono text-slate-400">{r.hora_salida ? new Date(r.hora_salida).toLocaleString() : '---'}</td>
                  <td className="p-6"><span className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-lg font-black text-xs">{r.horas_trabajadas || '0.00'} H</span></td>
                  <td className="p-6 text-center"><button onClick={() => setEditandoRow(r)} className="text-xl grayscale hover:grayscale-0 transition-all">✏️</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}