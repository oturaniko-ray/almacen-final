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
    const channel = supabase.channel('presencia_realtime_fixed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchData())
      .subscribe();
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    const { data: emps } = await supabase.from('empleados').select('*').eq('activo', true).order('nombre');
    const { data: jors } = await supabase.from('jornadas').select('*').order('hora_entrada', { ascending: false });

    if (emps) {
      const vinculados = emps.map(e => {
        // Buscamos la jornada más reciente del empleado para tener su último movimiento
        const ultimaJornada = jors?.find(j => j.empleado_id === e.id);
        return { ...e, ultimaJornada };
      });
      setEmpleados(vinculados);
    }
  };

  const calcularTiempo = (fechaISO: string | null) => {
    if (!fechaISO) return "00:00:00";
    const inicio = new Date(fechaISO).getTime();
    const diff = ahora.getTime() - inicio;
    if (diff < 0) return "00:00:00";
    
    const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const presentes = empleados.filter(e => e.en_almacen);
  const ausentes = empleados.filter(e => !e.en_almacen);

  return (
    <main className="min-h-screen bg-[#050a14] p-6 text-white font-sans">
      <div className="max-w-[100%] mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
          <h2 className="text-2xl font-black uppercase italic text-blue-500">Monitor de <span className="text-white">Presencia</span></h2>
          <button onClick={() => router.back()} className="bg-[#1e293b] hover:bg-slate-700 px-8 py-2 rounded-xl text-[10px] font-black uppercase border border-white/10 transition-all">Volver</button>
        </div>

        {/* CONTENEDOR PRINCIPAL: 2 COLUMNAS (PRESENTES IZQ / AUSENTES DER) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
          
          {/* LADO IZQUIERDO: PRESENTES */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 ml-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-500">Presentes ({presentes.length})</h3>
            </div>
            {/* GRID DE 4 COLUMNAS PARA PRESENTES */}
            <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-3">
              {presentes.map(e => (
                <div key={e.id} className="bg-[#0f172a] p-4 rounded-[25px] border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                  <p className="font-black uppercase italic text-[11px] truncate mb-1">{e.nombre}</p>
                  <p className="text-[9px] text-emerald-500/50 font-bold mb-2 uppercase">Entrada: {e.ultimaJornada ? new Date(e.ultimaJornada.hora_entrada).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</p>
                  <div className="bg-black/40 rounded-xl py-2 text-center border border-emerald-500/10">
                    <span className="text-lg font-black text-emerald-500 font-mono italic">
                      {calcularTiempo(e.ultimaJornada?.hora_entrada)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* LADO DERECHO: AUSENTES */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 ml-2">
              <div className="w-2 h-2 bg-red-600 rounded-full shadow-[0_0_8px_red]"></div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-red-500">Ausentes ({ausentes.length})</h3>
            </div>
            {/* GRID DE 4 COLUMNAS PARA AUSENTES */}
            <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-3 opacity-80">
              {ausentes.map(e => (
                <div key={e.id} className="bg-[#0f172a] p-4 rounded-[25px] border border-red-500/10">
                  <p className="font-black uppercase italic text-[11px] truncate mb-1 text-slate-400">{e.nombre}</p>
                  <p className="text-[9px] text-red-500/50 font-bold mb-2 uppercase">Salida: {e.ultimaJornada?.hora_salida ? new Date(e.ultimaJornada.hora_salida).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Sin registro'}</p>
                  <div className="bg-black/40 rounded-xl py-2 text-center border border-red-500/5">
                    <span className="text-lg font-black text-red-600 font-mono italic">
                      {calcularTiempo(e.ultimaJornada?.hora_salida || e.ultimaJornada?.hora_entrada)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}