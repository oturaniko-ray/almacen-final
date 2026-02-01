'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function ReportesPage() {
  const [user, setUser] = useState<any>(null);
  const [jornadas, setJornadas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [desde, setDesde] = useState(''); // Rápido acceso Desde
  const [hasta, setHasta] = useState(''); // Rápido acceso Hasta
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setUser(JSON.parse(sessionData));
    fetchJornadas();
    const channel = supabase.channel('realtime_jornadas').on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchJornadas()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchJornadas = async () => {
    setLoading(true);
    const { data } = await supabase.from('jornadas').select('*').order('hora_entrada', { ascending: false });
    if (data) setJornadas(data);
    setLoading(false);
  };

  const formatearReloj = (horasDec: number | null) => {
    if (!horasDec) return "00:00:00";
    const totalSeg = Math.floor(horasDec * 3600);
    const h = Math.floor(totalSeg / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeg % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeg % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const jornadasFiltradas = jornadas.filter(j => {
    const matchNombre = j.nombre_empleado.toLowerCase().includes(busqueda.toLowerCase());
    const fechaJ = j.hora_entrada.split('T')[0];
    const matchDesde = desde ? fechaJ >= desde : true;
    const matchHasta = hasta ? fechaJ <= hasta : true;
    return matchNombre && matchDesde && matchHasta;
  });

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
          <h1 className="text-2xl font-black uppercase italic text-blue-500">Reporte <span className="text-white tracking-tighter">Asistencia</span></h1>
          <button onClick={() => router.back()} className="bg-red-600/20 text-red-500 px-6 py-2 rounded-xl text-[10px] font-black uppercase">Cerrar</button>
        </div>

        {/* BÚSQUEDA RÁPIDA DESDE-HASTA */}
        <div className="flex flex-wrap gap-4 mb-8 bg-[#0f172a] p-6 rounded-[30px] border border-white/5">
          <input type="text" placeholder="🔍 NOMBRE EMPLEADO" className="flex-1 min-w-[200px] bg-black/20 border border-white/10 rounded-xl px-5 py-3 text-[11px] font-bold uppercase outline-none focus:border-blue-500" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-500 uppercase">Desde</span>
            <input type="date" className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold outline-none focus:border-blue-500" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-500 uppercase">Hasta</span>
            <input type="date" className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold outline-none focus:border-blue-500" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
        </div>

        <div className="overflow-hidden rounded-[40px] border border-white/5 bg-[#0f172a] shadow-2xl">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-black/40 text-[10px] font-black text-slate-500 uppercase italic">
                <th className="p-6">Empleado</th>
                <th className="p-6">Entrada</th>
                <th className="p-6">Salida</th>
                <th className="p-6 text-blue-500">Total Horas</th>
                <th className="p-6">Estado</th>
                <th className="p-6">Autorización</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {jornadasFiltradas.map((j) => (
                <tr key={j.id} className="hover:bg-white/[0.02]">
                  <td className="p-6 font-black uppercase italic text-sm">{j.nombre_empleado}</td>
                  {/* FECHAS MÁS GRANDES */}
                  <td className="p-6 text-sm font-bold font-mono text-emerald-500">{new Date(j.hora_entrada).toLocaleString('es-ES', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}</td>
                  <td className="p-6 text-sm font-bold font-mono text-red-400">{j.hora_salida ? new Date(j.hora_salida).toLocaleString('es-ES', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : '--:--'}</td>
                  {/* TOTAL EN AMARILLO Y MÁS PEQUEÑO */}
                  <td className="p-6">
                    <span className="text-lg font-black text-yellow-400 tracking-tighter italic">
                      {j.estado === 'activo' ? "EN CURSO" : formatearReloj(j.horas_trabajadas)}
                    </span>
                  </td>
                  {/* ESTADO PARPADEANTE SI ESTÁ ACTIVO */}
                  <td className="p-6">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase ${
                      j.estado === 'activo' ? 'bg-emerald-500/20 text-emerald-500 animate-pulse border border-emerald-500/30' : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {j.estado}
                    </span>
                  </td>
                  <td className="p-6 text-[9px] text-slate-500 uppercase italic font-bold">{j.editado_por || 'Registro Base'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}