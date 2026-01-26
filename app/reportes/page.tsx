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
  
  const [editandoRow, setEditandoRow] = useState<any>(null);
  const [guardando, setGuardando] = useState(false);
  
  const sessionId = useRef(Math.random().toString(36).substring(7));
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    const currentUser = JSON.parse(sessionData);
    if (!['admin', 'administrador', 'supervisor'].includes(currentUser.rol)) {
      router.replace('/'); return;
    }
    setUser(currentUser);

    const canalSesion = supabase.channel('reportes-session-control');
    canalSesion
      .on('broadcast', { event: 'nueva-sesion' }, (payload) => {
        if (payload.payload.email === currentUser.email && payload.payload.id !== sessionId.current) {
          setSesionDuplicada(true);
          setTimeout(() => { localStorage.removeItem('user_session'); router.push('/'); }, 3000);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await canalSesion.send({ type: 'broadcast', event: 'nueva-sesion', payload: { id: sessionId.current, email: currentUser.email } });
        }
      });
    return () => { supabase.removeChannel(canalSesion); };
  }, [router]);

  const cargarDatos = async () => {
    setLoading(true);
    // 🔴 CAMBIO INICIO: Migración a tabla jornadas
    let query = supabase.from('jornadas').select('*').order('hora_entrada', { ascending: false });
    // 🔴 CAMBIO FIN

    if (filtroNombre) query = query.ilike('nombre_empleado', `%${filtroNombre}%`);
    if (fechaInicio) query = query.gte('hora_entrada', `${fechaInicio}T00:00:00`);
    if (fechaFin) query = query.lte('hora_entrada', `${fechaFin}T23:59:59`);

    const { data, error } = await query;
    if (!error) setReportes(data || []);
    setLoading(false);
  };

  useEffect(() => { if (user) cargarDatos(); }, [user]);

  // 🔴 CAMBIO INICIO: Rutina de Guardado/Edición en tabla jornadas
  const guardarEdicion = async () => {
    if (!editandoRow) return;
    setGuardando(true);
    try {
      const hEntrada = new Date(editandoRow.hora_entrada);
      const hSalida = editandoRow.hora_salida ? new Date(editandoRow.hora_salida) : null;
      let horas = 0;
      if (hSalida) horas = (hSalida.getTime() - hEntrada.getTime()) / 3600000;

      const { error } = await supabase
        .from('jornadas')
        .update({
          hora_entrada: editandoRow.hora_entrada,
          hora_salida: editandoRow.hora_salida,
          horas_trabajadas: horas,
          estado: hSalida ? 'finalizado' : 'activo',
          editado_por: `Modificado por: ${user.nombre}`
        })
        .eq('id', editandoRow.id);

      if (error) throw error;
      alert("Registro actualizado");
      setEditandoRow(null);
      cargarDatos();
    } catch (e: any) { alert(e.message); }
    setGuardando(false);
  };
  // 🔴 CAMBIO FIN

  const exportarExcel = () => {
    const dataExport = reportes.map(r => ({
      Empleado: r.nombre_empleado,
      Entrada: new Date(r.hora_entrada).toLocaleString(),
      Salida: r.hora_salida ? new Date(r.hora_salida).toLocaleString() : 'ACTIVO',
      Horas: r.horas_trabajadas?.toFixed(2) || '0.00',
      Estado: r.estado,
      Nota: r.editado_por || ''
    }));
    const ws = XLSX.utils.json_to_sheet(dataExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jornadas");
    XLSX.writeFile(wb, `Reporte_Jornadas_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (sesionDuplicada) {
    return (
      <main className="h-screen bg-black flex items-center justify-center text-white">
        <h2 className="text-2xl font-bold animate-pulse text-red-500">SESIÓN DUPLICADA</h2>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-black uppercase italic text-blue-500 tracking-tighter">Reporte de Jornadas</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Panel Administrativo</p>
          </div>
          <div className="flex gap-4">
            <button onClick={exportarExcel} className="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all shadow-lg shadow-emerald-900/20">Exportar Excel</button>
            <button onClick={() => router.push('/')} className="bg-slate-800 hover:bg-slate-700 px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all">Regresar</button>
          </div>
        </div>

        <div className="bg-[#0f172a] p-8 rounded-[40px] border border-white/5 shadow-2xl mb-8 flex flex-wrap gap-6 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-2">Nombre Empleado</label>
            <input type="text" value={filtroNombre} onChange={(e) => setFiltroNombre(e.target.value)} placeholder="Buscar..." className="w-full bg-[#050a14] border border-white/10 rounded-2xl px-5 py-3 text-sm focus:border-blue-500 transition-all outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-2">Desde</label>
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="bg-[#050a14] border border-white/10 rounded-2xl px-5 py-3 text-sm outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-2">Hasta</label>
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="bg-[#050a14] border border-white/10 rounded-2xl px-5 py-3 text-sm outline-none" />
          </div>
          <button onClick={cargarDatos} className="bg-blue-600 hover:bg-blue-500 px-10 py-3 rounded-2xl font-black text-xs uppercase transition-all shadow-lg shadow-blue-900/20">Filtrar</button>
        </div>

        <div className="bg-[#0f172a] rounded-[40px] border border-white/5 shadow-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/5">
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Empleado</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Entrada</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Salida</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Horas</th>
                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {reportes.map((r) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-6 font-bold text-sm text-blue-100">{r.nombre_empleado}</td>
                  <td className="p-6 text-xs text-slate-400 font-mono">{new Date(r.hora_entrada).toLocaleString()}</td>
                  <td className="p-6 text-xs text-slate-400 font-mono">{r.hora_salida ? new Date(r.hora_salida).toLocaleString() : <span className="text-emerald-500 italic font-bold">● ACTIVO</span>}</td>
                  <td className="p-6">
                    <span className="bg-blue-600/10 text-blue-400 px-4 py-1 rounded-full font-black text-xs">
                      {r.horas_trabajadas ? r.horas_trabajadas.toFixed(2) : '0.00'} H
                    </span>
                  </td>
                  <td className="p-6 text-center">
                    <button onClick={() => setEditandoRow({...r})} className="text-slate-500 hover:text-blue-500 transition-colors">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editandoRow && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-[#0f172a] border border-white/10 p-10 rounded-[45px] w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-black italic text-blue-500 mb-8 uppercase">Editar Registro</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Hora Entrada</label>
                <input type="datetime-local" value={editandoRow.hora_entrada.slice(0,16)} onChange={e => setEditandoRow({...editandoRow, hora_entrada: e.target.value})} className="w-full bg-[#050a14] border border-white/10 rounded-2xl px-5 py-3 text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Hora Salida</label>
                <input type="datetime-local" value={editandoRow.hora_salida?.slice(0,16) || ''} onChange={e => setEditandoRow({...editandoRow, hora_salida: e.target.value})} className="w-full bg-[#050a14] border border-white/10 rounded-2xl px-5 py-3 text-sm" />
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={guardarEdicion} disabled={guardando} className="flex-1 bg-blue-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest">{guardando ? 'G...' : 'Guardar'}</button>
                <button onClick={() => setEditandoRow(null)} className="flex-1 bg-slate-800 py-4 rounded-2xl font-black text-xs uppercase tracking-widest">Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}