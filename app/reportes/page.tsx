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

    const canalRealtime = supabase
      .channel('cambios-jornadas-ray')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => {
        cargarDatos(true);
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(canalSesion); 
      supabase.removeChannel(canalRealtime);
    };
  }, [router]);

  const cargarDatos = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    try {
      let query = supabase.from('jornadas').select('*');
      if (fechaInicio) query = query.gte('hora_entrada', `${fechaInicio}T00:00:00`);
      if (fechaFin) query = query.lte('hora_entrada', `${fechaFin}T23:59:59`);
      if (filtroNombre) query = query.ilike('nombre_empleado', `%${filtroNombre}%`);
      
      const { data, error } = await query.order('hora_entrada', { ascending: false });
      if (error) throw error;
      setReportes(data || []);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const guardarAjuste = async () => {
    if (!editandoRow) return;
    setGuardando(true);
    try {
      const hEntrada = new Date(editandoRow.hora_entrada);
      const hSalida = editandoRow.hora_salida ? new Date(editandoRow.hora_salida) : null;
      let nuevasHoras = 0;
      if (hSalida) nuevasHoras = (hSalida.getTime() - hEntrada.getTime()) / (1000 * 60 * 60);

      const { error } = await supabase
        .from('jornadas')
        .update({
          hora_entrada: editandoRow.hora_entrada,
          hora_salida: editandoRow.hora_salida,
          horas_trabajadas: nuevasHoras > 0 ? nuevasHoras : 0,
          editado_por: `Editado por: ${user.nombre}`
        })
        .eq('id', editandoRow.id);

      if (error) throw error;
      setEditandoRow(null);
      await cargarDatos(true);
      alert("✅ Registro actualizado con éxito");
    } catch (err: any) {
      alert("❌ Error: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const exportarExcel = () => {
    const ahora = new Date();
    const infoExportacion = [
      ["REPORTE DE JORNADAS - RAY"],
      ["GENERADO POR:", `${user?.nombre} (${user?.rol?.toUpperCase()})`],
      ["FECHA:", ahora.toLocaleString()],
      [],
      ["Empleado", "Entrada", "Salida", "Horas Totales", "Estado"]
    ];
    const datosCuerpo = reportes.map(r => [
      r.nombre_empleado,
      new Date(r.hora_entrada).toLocaleString(),
      r.hora_salida ? new Date(r.hora_salida).toLocaleString() : 'PENDIENTE',
      r.horas_trabajadas ? r.horas_trabajadas.toFixed(2) : '0.00',
      r.hora_salida ? 'Finalizado' : 'En Almacén'
    ]);
    const ws = XLSX.utils.aoa_to_sheet([...infoExportacion, ...datosCuerpo]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jornadas");
    XLSX.writeFile(wb, `Reporte_Jornadas_${ahora.toISOString().split('T')[0]}.xlsx`);
  };

  const totalHorasFlota = reportes.reduce((acc, curr) => acc + (curr.horas_trabajadas || 0), 0);

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-4 md:p-8 font-sans">
      
      {/* MODAL DE EDICIÓN */}
      {editandoRow && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-white/10 p-8 rounded-[40px] w-full max-w-md shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-xl font-black italic uppercase mb-6 text-blue-500">Ajuste de Jornada</h2>
            <div className="space-y-4">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl mb-4">
                <p className="text-[10px] font-black uppercase text-blue-400">Nota de Seguridad</p>
                <p className="text-[9px] text-slate-300 italic">Solo puedes modificar registros de empleados que ya hayan marcado su salida.</p>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Empleado</label>
                <div className="p-3 bg-white/5 rounded-xl text-sm font-bold text-slate-300">{editandoRow.nombre_empleado}</div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Hora Entrada</label>
                <input 
                  type="datetime-local" 
                  value={editandoRow.hora_entrada ? editandoRow.hora_entrada.slice(0,16) : ''}
                  onChange={(e) => setEditandoRow({...editandoRow, hora_entrada: e.target.value})}
                  className="w-full bg-[#050a14] border border-white/5 p-3 rounded-xl outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Hora Salida</label>
                <input 
                  type="datetime-local" 
                  value={editandoRow.hora_salida ? editandoRow.hora_salida.slice(0,16) : ''}
                  onChange={(e) => setEditandoRow({...editandoRow, hora_salida: e.target.value})}
                  className="w-full bg-[#050a14] border border-white/5 p-3 rounded-xl outline-none focus:border-blue-500 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={guardarAjuste} disabled={guardando} className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-2xl font-black text-xs uppercase transition-all shadow-lg shadow-blue-600/20">
                {guardando ? 'Guardando...' : '💾 Confirmar'}
              </button>
              <button onClick={() => setEditandoRow(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 py-3 rounded-2xl font-black text-xs uppercase transition-all">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">
              SISTEMA DE <span className="text-blue-500">REPORTES</span>
            </h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Control de Flota y Operaciones</p>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => cargarDatos()} 
              disabled={refreshing}
              className="bg-white/5 hover:bg-white/10 p-3 rounded-2xl transition-all border border-white/5 group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-blue-500 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button onClick={exportarExcel} className="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all shadow-lg">📥 Excel</button>
            <button onClick={() => router.push('/admin')} className="bg-slate-800 hover:bg-slate-700 px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all">Panel</button>
          </div>
        </div>

        {/* INDICADORES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#0f172a] p-6 rounded-[30px] border border-white/5">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Horas Totales del Periodo</p>
            <p className="text-4xl font-black text-blue-500">{totalHorasFlota.toFixed(1)} <span className="text-sm text-slate-400 font-normal italic">Horas</span></p>
          </div>
          <div className="bg-[#0f172a] p-6 rounded-[30px] border border-white/5">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Personal en Almacén</p>
            <p className="text-4xl font-black text-emerald-500">{reportes.filter(r => !r.hora_salida).length}</p>
          </div>
        </div>

        {/* TABLA */}
        <div className="bg-[#0f172a] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  <th className="p-6">Empleado</th>
                  <th className="p-6">Entrada</th>
                  <th className="p-6">Salida</th>
                  <th className="p-6">Horas</th>
                  <th className="p-6 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td colSpan={5} className="p-20 text-center animate-pulse font-black text-slate-500 uppercase italic">Sincronizando registros...</td></tr>
                ) : reportes.map((r, i) => (
                  <tr key={i} className="hover:bg-white/[0.01] transition-colors group">
                    <td className="p-6 font-bold">{r.nombre_empleado}</td>
                    <td className="p-6 text-xs text-slate-400 font-mono">{new Date(r.hora_entrada).toLocaleString()}</td>
                    <td className="p-6 text-xs font-mono">
                      {r.hora_salida ? (
                        <span className="text-slate-400">{new Date(r.hora_salida).toLocaleString()}</span>
                      ) : (
                        <span className="text-emerald-500 font-black animate-pulse uppercase text-[9px]">● En Almacén</span>
                      )}
                    </td>
                    <td className="p-6">
                      <span className="bg-blue-600/10 text-blue-400 px-4 py-1 rounded-full font-black text-xs uppercase">
                        {r.horas_trabajadas ? r.horas_trabajadas.toFixed(2) : '---'}
                      </span>
                    </td>
                    <td className="p-6 text-center">
                      {/* 🔴 NUEVA RUTINA: Bloqueo de edición si no ha salido */}
                      {!r.hora_salida ? (
                        <div className="group/tooltip relative inline-block">
                          <button disabled className="text-slate-700 cursor-not-allowed opacity-30">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </button>
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-red-600 text-[8px] font-black uppercase text-white px-2 py-1 rounded whitespace-nowrap z-50">
                            No puede editar mientras esté dentro
                          </span>
                        </div>
                      ) : (
                        <button onClick={() => setEditandoRow(r)} className="text-slate-500 hover:text-blue-500 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
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