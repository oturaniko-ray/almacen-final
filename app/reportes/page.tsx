'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function ReportesPage() {
  const [jornadas, setJornadas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const router = useRouter();

  useEffect(() => {
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

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(jornadasFiltradas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
    XLSX.writeFile(wb, "Reporte_Asistencia.xlsx");
  };

  const jornadasFiltradas = jornadas.filter(j => {
    const f = j.hora_entrada.split('T')[0];
    const matchNombre = j.nombre_empleado.toLowerCase().includes(busqueda.toLowerCase());
    const matchDesde = desde ? f >= desde : true;
    const matchHasta = hasta ? f <= hasta : true;
    return matchNombre && matchDesde && matchHasta;
  });

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
          <h1 className="text-2xl font-black uppercase italic text-blue-500">Auditoría <span className="text-white">General</span></h1>
          <div className="flex gap-3">
            <button onClick={exportarExcel} className="bg-emerald-600 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20">Excel</button>
            <button onClick={() => router.back()} className="bg-red-600/20 text-red-500 px-5 py-2 rounded-xl text-[10px] font-black uppercase">Cerrar</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-8 bg-[#0f172a] p-6 rounded-[35px] border border-white/5">
          <input type="text" placeholder="🔍 BUSCAR EMPLEADO..." className="flex-1 min-w-[200px] bg-black/20 border border-white/10 rounded-xl px-5 py-3 text-[11px] font-bold uppercase outline-none focus:border-blue-500" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <input type="date" className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold uppercase outline-none focus:border-blue-500 text-slate-400" value={desde} onChange={e => setDesde(e.target.value)} />
          <input type="date" className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold uppercase outline-none focus:border-blue-500 text-slate-400" value={hasta} onChange={e => setHasta(e.target.value)} />
        </div>

        <div className="overflow-hidden rounded-[40px] border border-white/5 bg-[#0f172a] shadow-2xl">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-black/40 text-[10px] font-black text-slate-500 uppercase italic">
                <th className="p-6">Empleado</th>
                <th className="p-6">Entrada</th>
                <th className="p-6">Salida</th>
                <th className="p-6 text-yellow-400">Total Horas</th>
                <th className="p-6">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {jornadasFiltradas.map((j) => (
                <tr key={j.id} className="hover:bg-white/[0.01]">
                  <td className="p-6 font-black uppercase italic text-sm">{j.nombre_empleado}</td>
                  <td className="p-6 text-sm font-bold font-mono text-emerald-500">{new Date(j.hora_entrada).toLocaleString('es-ES', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}</td>
                  <td className="p-6 text-sm font-bold font-mono text-red-400">{j.hora_salida ? new Date(j.hora_salida).toLocaleString('es-ES', {hour:'2-digit', minute:'2-digit'}) : '--:--'}</td>
                  <td className="p-6 text-lg font-black text-yellow-400 italic tracking-tighter">{j.estado === 'activo' ? 'EN CURSO' : j.horas_trabajadas}</td>
                  <td className="p-6">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase ${j.estado === 'activo' ? 'bg-emerald-500/20 text-emerald-500 animate-pulse border border-emerald-500/30' : 'bg-slate-500/20 text-slate-400'}`}>
                      {j.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="p-10 text-center text-[10px] font-black uppercase animate-pulse text-slate-500">Sincronizando...</div>}
        </div>
      </div>
    </main>
  );
}