'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function PresenciaPage() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [ahora, setAhora] = useState(new Date());
  const router = useRouter();

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => setAhora(new Date()), 1000);
    const ch = supabase.channel('presencia_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchData())
      .subscribe();
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(ch);
    };
  }, []);

  const fetchData = async () => {
    // Obtenemos empleados y sus jornadas más recientes para calcular el tiempo
    const { data: emps } = await supabase.from('empleados').select('*').eq('activo', true).order('nombre');
    const { data: jors } = await supabase.from('jornadas').select('*').order('hora_entrada', { ascending: false });

    if (emps) {
      const vinculados = emps.map(e => {
        const ultimaJornada = jors?.find(j => j.empleado_id === e.id);
        return { ...e, ultimaJornada };
      });
      setEmpleados(vinculados);
    }
  };

  const calcularTiempo = (fechaISO: string) => {
    if (!fechaISO) return "00:00:00";
    const inicio = new Date(fechaISO).getTime();
    const diff = ahora.getTime() - inicio;
    const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const presentes = empleados.filter(e => e.en_almacen);
  const ausentes = empleados.filter(e => !e.en_almacen);

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
          <h2 className="text-2xl font-black uppercase italic text-blue-500 italic">Panel <span className="text-white">Presencia Real</span></h2>
          <button 
            onClick={() => router.back()} 
            className="bg-[#1e293b] hover:bg-slate-700 px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-white/10 transition-all shadow-xl"
          >
            Volver
          </button>
        </div>

        {/* SECCIÓN PRESENTES */}
        <section className="mb-16">
          <div className="flex items-center gap-4 mb-6 ml-2">
            <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></span>
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-emerald-500">Presentes ({presentes.length})</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {presentes.map(e => (
              <div key={e.id} className="bg-[#0f172a] p-6 rounded-[35px] border border-emerald-500/30 shadow-lg shadow-emerald-500/5 transition-all">
                <p className="font-black uppercase italic text-sm mb-1 truncate">{e.nombre}</p>
                <p className="text-[10px] text-emerald-500/60 font-bold uppercase mb-3">
                  Entrada: {e.ultimaJornada ? new Date(e.ultimaJornada.hora_entrada).toLocaleTimeString() : '--:--'}
                </p>
                <div className="bg-black/30 rounded-2xl py-3 text-center border border-emerald-500/10">
                  <span className="text-2xl font-black text-emerald-500 font-mono tracking-tighter">
                    {calcularTiempo(e.ultimaJornada?.hora_entrada)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECCIÓN AUSENTES */}
        <section>
          <div className="flex items-center gap-4 mb-6 ml-2">
            <span className="flex h-3 w-3 rounded-full bg-red-600"></span>
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-red-500">Ausentes ({ausentes.length})</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {ausentes.map(e => (
              <div key={e.id} className="bg-[#0f172a] p-6 rounded-[35px] border border-red-900/30 opacity-80 shadow-lg">
                <p className="font-black uppercase italic text-sm mb-1 truncate text-slate-300">{e.nombre}</p>
                <p className="text-[10px] text-red-500/60 font-bold uppercase mb-3">
                  Salida: {e.ultimaJornada?.hora_salida ? new Date(e.ultimaJornada.hora_salida).toLocaleTimeString() : 'N/A'}
                </p>
                <div className="bg-black/30 rounded-2xl py-3 text-center border border-red-500/5">
                  <span className="text-2xl font-black text-red-600 font-mono tracking-tighter">
                    {e.ultimaJornada?.hora_salida ? calcularTiempo(e.ultimaJornada.hora_salida) : "00:00:00"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}