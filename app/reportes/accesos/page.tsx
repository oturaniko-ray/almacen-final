'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function ReporteAccesosPage() {
  const [jornadas, setJornadas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setUser(JSON.parse(sessionData));
    fetchJornadas();
    const ch = supabase.channel('jornadas_real').on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchJornadas()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchJornadas = async () => {
    setLoading(true);
    const { data } = await supabase.from('jornadas').select('*').order('hora_entrada', { ascending: false });
    if (data) setJornadas(data);
    setLoading(false);
  };

  const formatearTiempo = (horasDecimales: number | string | null) => {
    if (!horasDecimales) return "00:00:00";
    const totalSegundos = Math.floor(Number(horasDecimales) * 3600);
    const h = Math.floor(totalSegundos / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSegundos % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSegundos % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setDesde('');
    setHasta('');
  };

  const jornadasFiltradas = jornadas.filter(j => {
    const f = j.hora_entrada.split('T')[0];
    const matchNombre = j.nombre_empleado?.toLowerCase().includes(busqueda.toLowerCase());
    const matchDesde = desde ? f >= desde : true;
    const matchHasta = hasta ? f <= hasta : true;
    return matchNombre && matchDesde && matchHasta;
  });

  let fechaActual = "";

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex justify-between items-end mb-8 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-2xl font-black uppercase italic text-white tracking-tighter">
                REPORTE DE <span className="text-blue-500">ACCESOS</span>
            </h1>
            <div className="flex gap-4 mt-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest"> <span className="text-white">{user?.nombre || 'S/D'}</span></p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest"> <span className="text-blue-500">{user?.rol || 'S/D'} ({user?.nivel_acceso || '0'})</span></p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => {
                const ws = XLSX.utils.json_to_sheet(jornadasFiltradas);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
                XLSX.writeFile(wb, "Reporte_Asistencia.xlsx");
            }} className="bg-emerald-600 px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20">Exportar</button>
            <button onClick={() => router.push('/reportes')} className="bg-red-600/20 text-red-500 px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all active:scale-95">Regresar</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-8 bg-[#0f172a] p-6 rounded-[35px] border border-white/5 items-center shadow-xl">
          <input type="text" placeholder="🔍 BUSCAR EMPLEADO..." className="flex-1 min-w-[200px] bg-black/20 border border-white/10 rounded-xl px-5 py-3 text-[11px] font-bold uppercase outline-none focus:border-blue-500" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <input type="date" className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold uppercase outline-none focus:border-blue-500 text-slate-400" value={desde} onChange={e => setDesde(e.target.value)} />
          <input type="date" className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold uppercase outline-none focus:border-blue-500 text-slate-400" value={hasta} onChange={e => setHasta(e.target.value)} />
          <button onClick={limpiarFiltros} className="bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-xl text-[9px] font-black uppercase transition-colors">Limpiar</button>
        </div>

        <div className="overflow-hidden rounded-[40px] border border-white/5 bg-[#0f172a] shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/40 text-[10px] font-black text-slate-500 uppercase italic">
                <th className="p-6">Empleado</th>
                <th className="p-6">Entrada (Fecha y Hora)</th>
                <th className="p-6">Salida (Fecha y Hora)</th>
                <th className="p-6 text-blue-400">Total Horas (HH:MM:SS)</th>
                <th className="p-6 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {jornadasFiltradas.map((j) => {
                const fechaFila = new Date(j.hora_entrada).toLocaleDateString('es-ES');
                const mostrarSeparador = fechaFila !== fechaActual;
                fechaActual = fechaFila;

                return (
                  <React.Fragment key={j.id}>
                    {mostrarSeparador && (
                      <tr className="bg-white/5">
                        <td colSpan={5} className="px-6 py-2 text-[9px] font-black text-blue-400 uppercase tracking-[0.3em]">
                          📅 {fechaFila}
                        </td>
                      </tr>
                    )}
                    <tr className="hover:bg-white/[0.01] border-b border-white/5 transition-colors">
                      <td className="p-6">
                        {/* CORRECCIÓN: NOMBRE SIN BOLD/ITALIC Y DOCUMENTO DEBAJO */}
                        <p className="uppercase text-lg tracking-tighter text-white leading-none">{j.nombre_empleado}</p>
                        <p className="text-[10px] font-bold text-white/70 mt-1.5 uppercase tracking-widest">{j.documento_id}</p>
                      </td>
                      
                      <td className="p-6 text-[11px] font-bold font-mono text-emerald-500 leading-tight">
                        {new Date(j.hora_entrada).toLocaleDateString('es-ES')}<br/>
                        <span className="text-lg">{new Date(j.hora_entrada).toLocaleTimeString('es-ES')}</span>
                      </td>
                      
                      <td className="p-6 text-[11px] font-bold font-mono text-red-400 leading-tight">
                        {j.hora_salida ? (
                          <>
                            {new Date(j.hora_salida).toLocaleDateString('es-ES')}<br/>
                            <span className="text-lg">{new Date(j.hora_salida).toLocaleTimeString('es-ES')}</span>
                          </>
                        ) : '--/--/--'}
                      </td>

                      <td className="p-6 font-black text-blue-400 italic tracking-tighter">
                        <span className="text-[14px]">
                          {j.estado === 'activo' ? 'En progreso...' : formatearTiempo(j.horas_trabajadas)}
                        </span>
                      </td>

                      <td className="p-6 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase ${j.estado === 'activo' ? 'bg-emerald-500/20 text-emerald-500 animate-pulse border border-emerald-500/30' : 'bg-slate-500/20 text-slate-400'}`}>
                          {j.estado}
                        </span>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {loading && <div className="p-10 text-center text-[10px] font-black uppercase animate-pulse text-slate-500">Sincronizando...</div>}
        </div>
      </div>
    </main>
  );
}