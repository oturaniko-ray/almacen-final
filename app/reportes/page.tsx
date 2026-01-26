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
  const [refreshing, setRefreshing] = useState(false);
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
      router.replace('/');
      return;
    }
    setUser(currentUser);
    fetchReportes();
  }, [router]);

  const fetchReportes = async () => {
    setLoading(true);
    let query = supabase.from('jornadas').select('*').order('hora_entrada', { ascending: false });
    
    if (fechaInicio) query = query.gte('hora_entrada', fechaInicio);
    if (fechaFin) query = query.lte('hora_entrada', fechaFin);
    
    const { data, error } = await query;
    if (!error) setReportes(data || []);
    setLoading(false);
  };

  const guardarEdicion = async () => {
    if (!editandoRow) return;
    setGuardando(true);
    
    // Recalcular horas trabajadas antes de guardar si hay salida
    let horas = 0;
    if (editandoRow.hora_entrada && editandoRow.hora_salida) {
      const entrada = new Date(editandoRow.hora_entrada).getTime();
      const salida = new Date(editandoRow.hora_salida).getTime();
      horas = Math.max(0, (salida - entrada) / (1000 * 60 * 60));
    }

    const { error } = await supabase
      .from('jornadas')
      .update({ 
        hora_entrada: editandoRow.hora_entrada,
        hora_salida: editandoRow.hora_salida,
        horas_trabajadas: horas
      })
      .eq('id', editandoRow.id);

    if (!error) {
      setEditandoRow(null);
      fetchReportes();
    }
    setGuardando(false);
  };

  const calcularHorasRender = (entradaStr: string, salidaStr: string | null) => {
    if (!entradaStr || !salidaStr) return "0.00";
    const entrada = new Date(entradaStr).getTime();
    const salida = new Date(salidaStr).getTime();
    const diferenciaSms = salida - entrada;
    const horas = diferenciaSms / (1000 * 60 * 60);
    return Math.max(0, horas).toFixed(2);
  };

  const exportarExcel = () => {
    const dataExport = reportes.map(r => ({
      Empleado: r.nombre_empleado,
      Documento: r.documento_id,
      Entrada: new Date(r.hora_entrada).toLocaleString(),
      Salida: r.hora_salida ? new Date(r.hora_salida).toLocaleString() : 'ACTIVO',
      'Horas Totales': r.hora_salida ? calcularHorasRender(r.hora_entrada, r.hora_salida) : '0.00'
    }));
    const ws = XLSX.utils.json_to_sheet(dataExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte Jornadas");
    XLSX.writeFile(wb, `Reporte_RAY_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const reportesFiltrados = reportes.filter(r => 
    r.nombre_empleado.toLowerCase().includes(filtroNombre.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* CABECERA UNIFICADA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-1 bg-blue-500 rounded-full hidden md:block"></div>
            <div>
              <h1 className="text-4xl font-black italic uppercase tracking-tighter">
                REPORTES DE <span className="text-blue-500">JORNADA</span>
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">SESIÓN:</p>
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] italic">{user?.nombre || '---'}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <button onClick={exportarExcel} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-500 px-6 py-4 rounded-2xl font-black text-[10px] uppercase transition-all shadow-lg">📥 EXPORTAR</button>
            <button onClick={() => router.push('/admin')} className="flex-1 md:flex-none bg-slate-800 hover:bg-slate-700 px-6 py-4 rounded-2xl font-black text-[10px] uppercase transition-all">VOLVER</button>
          </div>
        </div>

        {/* FILTROS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 bg-[#0f172a] p-6 rounded-[30px] border border-white/5">
          <input type="text" placeholder="BUSCAR EMPLEADO..." className="bg-[#050a14] border border-white/10 rounded-xl px-4 py-3 text-[10px] font-black uppercase outline-none focus:border-blue-500" value={filtroNombre} onChange={e => setFiltroNombre(e.target.value)} />
          <input type="date" className="bg-[#050a14] border border-white/10 rounded-xl px-4 py-3 text-[10px] font-black uppercase outline-none focus:border-blue-500" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
          <input type="date" className="bg-[#050a14] border border-white/10 rounded-xl px-4 py-3 text-[10px] font-black uppercase outline-none focus:border-blue-500" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
          <button onClick={fetchReportes} className="bg-blue-600 hover:bg-blue-500 rounded-xl font-black text-[10px] uppercase">Aplicar Filtros</button>
        </div>

        {/* TABLA */}
        <div className="bg-[#0f172a] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 bg-white/[0.01]">
                  <th className="py-6 px-8">Empleado</th>
                  <th className="py-6 px-4">Entrada</th>
                  <th className="py-6 px-4">Salida</th>
                  <th className="py-6 px-4 text-center">Horas</th>
                  <th className="py-6 px-8 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {reportesFiltrados.map((r) => (
                  <tr key={r.id} className="group hover:bg-white/[0.01] transition-colors">
                    <td className="py-6 px-8">
                      <div className="font-bold text-sm group-hover:text-blue-500 transition-colors uppercase">{r.nombre_empleado}</div>
                      <div className="text-[9px] font-black text-slate-500">ID: {r.documento_id}</div>
                    </td>
                    <td className="py-6 px-4 text-xs font-mono text-slate-400">
                      {new Date(r.hora_entrada).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-6 px-4 text-xs font-mono text-slate-400">
                      {r.hora_salida ? (
                        new Date(r.hora_salida).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
                      ) : (
                        <span className="text-emerald-500 font-black animate-pulse italic text-[10px]">● EN ALMACÉN</span>
                      )}
                    </td>
                    <td className="py-6 px-4 text-center">
                      <span className="bg-blue-600/10 text-blue-400 px-4 py-1.5 rounded-full font-black text-xs border border-blue-400/20">
                        {calcularHorasRender(r.hora_entrada, r.hora_salida)} H
                      </span>
                    </td>
                    <td className="py-6 px-8 text-right">
                      {r.hora_salida ? (
                        <button onClick={() => setEditandoRow(r)} className="text-slate-500 hover:text-white transition-colors">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      ) : (
                        <div className="group/tip relative inline-block">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          <span className="absolute bottom-full right-0 mb-2 hidden group-hover/tip:block bg-red-600 text-[8px] font-black uppercase px-2 py-1 rounded whitespace-nowrap shadow-xl">Activo en Almacén</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL EDICIÓN */}
      {editandoRow && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="bg-[#0f172a] border border-white/10 p-10 rounded-[45px] w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
            <h2 className="text-2xl font-black italic text-white mb-8 uppercase">
              AJUSTAR <span className="text-blue-500">JORNADA</span>
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-2">Hora Entrada</label>
                <input type="datetime-local" value={editandoRow.hora_entrada.slice(0,16)} onChange={e => setEditandoRow({...editandoRow, hora_entrada: e.target.value})} className="w-full bg-[#050a14] border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-2">Hora Salida</label>
                <input type="datetime-local" value={editandoRow.hora_salida?.slice(0,16) || ''} onChange={e => setEditandoRow({...editandoRow, hora_salida: e.target.value})} className="w-full bg-[#050a14] border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-blue-500" />
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={guardarEdicion} disabled={guardando} className="flex-1 bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20">{guardando ? 'PROCESANDO...' : 'GUARDAR'}</button>
                <button onClick={() => setEditandoRow(null)} className="bg-slate-800 hover:bg-slate-700 px-8 py-4 rounded-2xl font-black text-xs uppercase transition-all">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}