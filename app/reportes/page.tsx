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
  const [guardando, setGuardando] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    
    const currentUser = JSON.parse(sessionData);
    
    // --- LÓGICA DE ACCESO POR NIVEL ---
    const nivel = Number(currentUser.nivel_acceso);
    const tienePermisoReportes = currentUser.permiso_reportes === true;

    // Solo entran Nivel 4+ o Nivel 3 con el permiso específico
    if (!(nivel >= 4 || (nivel === 3 && tienePermisoReportes))) {
      router.replace('/');
      return;
    }

    setUser(currentUser);
    fetchReportes();

    const canalRealtime = supabase.channel('reportes-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchReportes())
      .subscribe();
    return () => { supabase.removeChannel(canalRealtime); };
  }, [router, fechaInicio, fechaFin]);

  const fetchReportes = async () => {
    setLoading(true);
    try {
      let query = supabase.from('jornadas').select(`
        *,
        empleados ( rol, nivel_acceso, documento_id )
      `).order('hora_entrada', { ascending: false });

      if (fechaInicio) query = query.gte('hora_entrada', `${fechaInicio}T00:00:00`);
      if (fechaFin) query = query.lte('hora_entrada', `${fechaFin}T23:59:59`);
      
      const { data, error } = await query;
      if (error) throw error;
      setReportes(data || []);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatearCredencial = (rol: string, nivel: any) => {
    return `${rol || 'EMPLEADO'}(${nivel || 0})`.toUpperCase();
  };

  const formatearTiempoHMS = (entradaStr: string, salidaStr: string | null) => {
    if (!entradaStr || !salidaStr) return "00:00:00";
    const diffMs = new Date(salidaStr).getTime() - new Date(entradaStr).getTime();
    if (diffMs <= 0) return "00:00:00";
    const totalSeg = Math.floor(diffMs / 1000);
    const h = Math.floor(totalSeg / 3600);
    const m = Math.floor((totalSeg % 3600) / 60);
    const s = totalSeg % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const exportarExcel = () => {
    const ahora = new Date();
    const fechaStr = ahora.toISOString().slice(0, 10).replace(/-/g, '');
    const horaStr = ahora.toTimeString().slice(0, 8).replace(/:/g, '');
    const nombreArchivo = `jornada_${fechaStr}_${horaStr}.xlsx`;

    const encabezadoInfo = [
      [`EXPORTADO POR: ${user?.nombre} (${formatearCredencial(user?.rol, user?.nivel_acceso)})`],
      [`FECHA Y HORA DE EXPORTACIÓN: ${ahora.toLocaleString()}`],
      ["REPORTE DE JORNADAS"],
      [] 
    ];

    const cuerpoData = reportes.map(r => ({
      Empleado: r.nombre_empleado,
      Documento: r.documento_id || r.empleados?.documento_id || 'N/R',
      Credencial: formatearCredencial(r.empleados?.rol, r.empleados?.nivel_acceso),
      Entrada: new Date(r.hora_entrada).toLocaleString(),
      Salida: r.hora_salida ? new Date(r.hora_salida).toLocaleString() : 'ACTIVO',
      'Tiempo Total': formatearTiempoHMS(r.hora_entrada, r.hora_salida)
    }));

    const ws = XLSX.utils.aoa_to_sheet(encabezadoInfo);
    XLSX.utils.sheet_add_json(ws, cuerpoData, { origin: "A5" });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jornadas");
    XLSX.writeFile(wb, nombreArchivo);
  };

  const guardarEdicion = async () => {
    if (!editandoRow) return;
    setGuardando(true);
    const inicio = new Date(editandoRow.hora_entrada).getTime();
    const fin = editandoRow.hora_salida ? new Date(editandoRow.hora_salida).getTime() : 0;
    const horasDecimal = fin > inicio ? (fin - inicio) / (1000 * 60 * 60) : 0;
    const { error } = await supabase.from('jornadas').update({ 
      hora_entrada: new Date(editandoRow.hora_entrada).toISOString(),
      hora_salida: editandoRow.hora_salida ? new Date(editandoRow.hora_salida).toISOString() : null,
      horas_trabajadas: horasDecimal
    }).eq('id', editandoRow.id);
    if (!error) setEditandoRow(null);
    setGuardando(false);
  };

  let fechaActualHeader = '';

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* CABECERA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-1 bg-blue-500 rounded-full"></div>
            <div>
              <h1 className="text-4xl font-black italic uppercase tracking-tighter">
                REPORTES DE <span className="text-blue-500">JORNADA</span>
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300 uppercase">{user?.nombre}</span>
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest italic bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                  {formatearCredencial(user?.rol, user?.nivel_acceso)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={exportarExcel} className="bg-emerald-600 px-6 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-emerald-900/20 transition-all hover:scale-105">📥 EXPORTAR</button>
            <button onClick={() => router.back()} className="bg-slate-800 px-6 py-4 rounded-2xl font-black text-[10px] uppercase transition-all hover:bg-slate-700">VOLVER</button>
          </div>
        </div>

        {/* FILTROS */}
        <div className="bg-[#0f172a] p-8 rounded-[40px] border border-white/5 shadow-2xl mb-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
            <div className="md:col-span-4 flex flex-col gap-2">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Filtrar por Nombre</label>
              <input 
                type="text" 
                placeholder="BUSCAR EMPLEADO..." 
                className="bg-[#050a14] border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold uppercase outline-none focus:border-blue-500 transition-all" 
                value={filtroNombre} 
                onChange={e => setFiltroNombre(e.target.value)} 
              />
            </div>
            
            <div className="md:col-span-6 grid grid-cols-2 gap-4 bg-[#050a14] p-2 rounded-3xl border border-white/5">
              <div className="flex flex-col gap-1 px-4 py-2">
                <label className="text-[8px] font-black text-blue-500 uppercase tracking-tighter">Desde</label>
                <input 
                  type="date" 
                  className="bg-transparent border-none text-xs font-bold text-white outline-none cursor-pointer"
                  value={fechaInicio} 
                  onChange={e => setFechaInicio(e.target.value)} 
                />
              </div>
              <div className="flex flex-col gap-1 px-4 py-2 border-l border-white/5">
                <label className="text-[8px] font-black text-blue-500 uppercase tracking-tighter">Hasta</label>
                <input 
                  type="date" 
                  className="bg-transparent border-none text-xs font-bold text-white outline-none cursor-pointer"
                  value={fechaFin} 
                  onChange={e => setFechaFin(e.target.value)} 
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <button onClick={fetchReportes} className="w-full bg-blue-600 h-16 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-blue-900/40 hover:bg-blue-500 transition-all">
                Actualizar
              </button>
            </div>
          </div>
        </div>

        {/* TABLA */}
        <div className="bg-[#0f172a] rounded-[45px] border border-white/5 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 bg-white/[0.01]">
                  <th className="py-7 px-10">Empleado</th>
                  <th className="py-7 px-4 text-center">Entrada</th>
                  <th className="py-7 px-4 text-center">Salida</th>
                  <th className="py-7 px-4 text-center">Jornada</th>
                  <th className="py-7 px-10 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {reportes
                  .filter(r => r.nombre_empleado.toLowerCase().includes(filtroNombre.toLowerCase()))
                  .map((r, index) => {
                    const fechaFila = new Date(r.hora_entrada).toLocaleDateString('es-ES', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    }).toUpperCase();
                    
                    const mostrarHeader = fechaFila !== fechaActualHeader;
                    if (mostrarHeader) fechaActualHeader = fechaFila;

                    return (
                      <React.Fragment key={r.id}>
                        {mostrarHeader && (
                          <tr className="bg-white/5">
                            <td colSpan={5} className="py-3 px-10">
                              <span className="text-[10px] font-black text-white tracking-[0.2em]">
                                📅 {fechaFila}
                              </span>
                            </td>
                          </tr>
                        )}
                        <tr className="group hover:bg-white/[0.01] transition-colors">
                          <td className="py-7 px-10">
                            <div className="font-bold text-sm uppercase text-white">{r.nombre_empleado}</div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[9px] font-black text-white uppercase tracking-widest">
                                {r.documento_id || r.empleados?.documento_id || 'SIN DOC'}
                              </span>
                              <span className="text-white/20 text-[9px]">—</span>
                              <span className="text-[9px] font-black text-blue-500 italic uppercase tracking-widest">
                                {formatearCredencial(r.empleados?.rol, r.empleados?.nivel_acceso)}
                              </span>
                            </div>
                          </td>
                          <td className="py-7 px-4 text-center text-xs font-mono text-slate-400">
                            {new Date(r.hora_entrada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-7 px-4 text-center text-xs font-mono text-slate-400">
                            {r.hora_salida ? new Date(r.hora_salida).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : <span className="text-emerald-500 font-black animate-pulse uppercase text-[10px] bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">● Activo</span>}
                          </td>
                          <td className="py-7 px-4 text-center">
                            <span className="bg-blue-600/10 text-blue-400 px-5 py-2.5 rounded-full font-mono font-black text-xs border border-blue-400/20">
                              {formatearTiempoHMS(r.hora_entrada, r.hora_salida)}
                            </span>
                          </td>
                          <td className="py-7 px-10 text-right">
                            {r.hora_salida && (
                              <button onClick={() => setEditandoRow(r)} className="text-slate-500 hover:text-white p-3 bg-white/5 rounded-2xl border border-white/5 hover:border-blue-500 transition-all">
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL EDICIÓN */}
      {editandoRow && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-[#0f172a] border border-white/10 p-10 rounded-[45px] w-full max-w-md animate-in zoom-in duration-200 shadow-2xl">
            <h2 className="text-xl font-black italic text-white mb-6 uppercase tracking-tighter">Ajustar <span className="text-blue-500">Tiempo</span></h2>
            <div className="space-y-4">
              <input type="datetime-local" value={editandoRow.hora_entrada.slice(0, 16)} onChange={e => setEditandoRow({...editandoRow, hora_entrada: e.target.value})} className="w-full bg-[#050a14] border border-white/10 rounded-2xl p-4 text-sm font-bold text-blue-400 outline-none" />
              <input type="datetime-local" value={editandoRow.hora_salida?.slice(0, 16) || ''} onChange={e => setEditandoRow({...editandoRow, hora_salida: e.target.value})} className="w-full bg-[#050a14] border border-white/10 rounded-2xl p-4 text-sm font-bold text-emerald-400 outline-none" />
              <div className="flex gap-4 mt-6">
                <button onClick={guardarEdicion} className="flex-1 bg-blue-600 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-blue-600/20">Guardar</button>
                <button onClick={() => setEditandoRow(null)} className="px-6 bg-slate-800 rounded-2xl font-black text-[10px] uppercase">Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}