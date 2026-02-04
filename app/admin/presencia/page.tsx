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
    const { data: jors } = await supabase.from('jornadas').select('*').order('created_at', { ascending: false });

    if (emps) {
      const vinculados = emps.map(e => {
        const ultimaJornada = jors?.find(j => j.empleado_id === e.id) || null;
        return { ...e, ultimaJornada };
      });
      setEmpleados(vinculados);
    }
  };

  const formatDiff = (fechaBase: string) => {
    const diffMs = ahora.getTime() - new Date(fechaBase).getTime();
    const totalSeg = Math.floor(diffMs / 1000);
    const h = Math.floor(totalSeg / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeg % 3600) / 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const presentes = empleados.filter(e => e.en_almacen);
  const ausentes = empleados.filter(e => !e.en_almacen);

  return (
    <main className="min-h-screen bg-[#050a14] p-4 md:p-10 text-white font-sans overflow-hidden">
      <div className="max-w-[1800px] mx-auto">
        
        <div className="flex justify-between items-end mb-12 px-4">
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter text-blue-500">Monitor de Presencia</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em] mt-2">Sincronización en tiempo real activa</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black font-mono tracking-tighter">{ahora.toLocaleTimeString()}</p>
            <p className="text-[10px] font-black text-blue-400 uppercase italic">{ahora.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-10">
          
          <div className="space-y-6">
            <div className="flex items-center gap-3 ml-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
              <h3 className="text-[12px] font-black uppercase tracking-[0.3em] text-emerald-500">En Almacén ({presentes.length})</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
              {presentes.map(e => (
                <div key={e.id} className="bg-[#0f172a] p-5 rounded-[35px] border border-emerald-500/20 shadow-xl group">
                  <p className="font-black uppercase italic text-lg tracking-tighter leading-tight mb-1 text-white">{e.nombre}</p>
                  <p className="text-[9px] text-slate-500 font-bold mb-4 uppercase tracking-widest">{e.rol}</p>
                  <div className="flex justify-between items-center bg-black/40 rounded-2xl p-3 border border-white/5">
                    <div>
                      <p className="text-[8px] font-black text-slate-500 uppercase">Ingreso</p>
                      <p className="text-xs font-black text-emerald-500 font-mono">
                        {e.ultimaJornada?.hora_entrada ? new Date(e.ultimaJornada.hora_entrada).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black text-slate-500 uppercase">Tiempo Presencia</p>
                      <p className="text-xs font-black text-blue-400 font-mono italic">
                        {e.ultimaJornada?.hora_entrada ? formatDiff(e.ultimaJornada.hora_entrada) : '00:00'}h
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-3 ml-2">
              <div className="w-2 h-2 bg-red-600 rounded-full"></div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-red-500">Ausentes ({ausentes.length})</h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-3 opacity-80">
              {ausentes.map(e => (
                <div key={e.id} className="bg-[#0f172a] p-4 rounded-[25px] border border-red-500/10">
                  <p className="font-black uppercase italic text-[11px] truncate mb-1 text-slate-400">{e.nombre}</p>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[8px] text-red-500/50 font-bold uppercase">
                      Salida: {e.ultimaJornada?.hora_salida ? new Date(e.ultimaJornada.hora_salida).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                    </p>
                    <p className="text-[8px] text-blue-500 font-bold uppercase italic">
                      {e.ultimaJornada?.hora_salida ? `Hace ${formatDiff(e.ultimaJornada.hora_salida)}h` : ''}
                    </p>
                  </div>
                  <div className="bg-black/40 rounded-xl py-2 text-center border border-white/5">
                    <p className="text-[8px] font-black text-slate-600 uppercase italic">Fuera de Servicio</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        <button onClick={() => router.push('/admin')} className="fixed bottom-10 right-10 bg-white/5 hover:bg-white/10 p-4 rounded-full border border-white/10 backdrop-blur-md">
          <span className="text-[10px] font-black uppercase tracking-widest px-4">← Volver</span>
        </button>

      </div>
    </main>
  );
}