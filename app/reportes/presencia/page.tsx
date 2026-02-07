'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function PresenciaPage() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [ahora, setAhora] = useState(new Date());
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async () => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setUser(JSON.parse(sessionData));

    const { data: emps } = await supabase.from('empleados').select('*').eq('activo', true).order('nombre');
    const { data: jors } = await supabase.from('jornadas').select('*').order('created_at', { ascending: false });

    if (emps) {
      const vinculados = emps.map(e => {
        const ultimaJor = jors?.find(j => j.empleado_id === e.id);
        return { ...e, ultimaJornada: ultimaJor || null };
      });
      setEmpleados(vinculados);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('presencia_v12')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // ALGORITMO CORREGIDO PARA TIMESTAMPTZ (HH:MM:SS)
  const calcularRelojReal = (timestamp: string | null) => {
    if (!timestamp) return "00:00:00";
    const inicio = new Date(timestamp).getTime();
    const diffMs = Math.max(0, ahora.getTime() - inicio);
    
    const h = Math.floor(diffMs / 3600000).toString().padStart(2, '0');
    const m = Math.floor((diffMs % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const extraerHoraUTC = (timestamp: string | null) => {
    if (!timestamp) return "--:--:--";
    const d = new Date(timestamp);
    return d.getUTCHours().toString().padStart(2, '0') + ":" + 
           d.getUTCMinutes().toString().padStart(2, '0') + ":" + 
           d.getUTCSeconds().toString().padStart(2, '0');
  };

  const presentes = empleados.filter(e => e.en_almacen === true);
  const ausentes = empleados.filter(e => e.en_almacen === false);

  return (
    <main className="min-h-screen bg-black flex flex-col font-sans text-white overflow-hidden">
      
      {/* HEADER COMPACTO */}
      <div className="w-full bg-[#111] p-5 border-b border-white/10 flex justify-between items-center">
        <h1 className="text-xl font-black italic uppercase">MONITOR <span className="text-blue-600">RT</span></h1>
        <p className="text-4xl font-black font-mono">{ahora.toLocaleTimeString()}</p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* PANEL PRESENTES - SIN RECUADROS INTERNOS */}
        <div className="w-1/2 p-6 overflow-y-auto border-r border-white/5">
          <h2 className="text-[10px] font-black uppercase text-emerald-500 mb-8 italic tracking-[0.3em]">● PRESENTES ({presentes.length})</h2>
          <div className="grid grid-cols-2 gap-10">
            {presentes.map(e => (
              <div key={e.id} className="flex flex-col">
                <p className="font-black uppercase italic text-sm">{e.nombre}</p>
                <p className="text-[10px] text-white/30 mb-2">{e.documento_id}</p>
                <p className="text-4xl font-black font-mono text-emerald-500 leading-none">
                  {calcularRelojReal(e.ultimaJornada?.hora_entrada)}
                </p>
                <p className="text-[9px] font-bold text-white/40 uppercase mt-2">
                  ENTRADA: {extraerHoraUTC(e.ultimaJornada?.hora_entrada)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* PANEL AUSENTES - SIN RECUADROS INTERNOS */}
        <div className="w-1/2 p-6 overflow-y-auto bg-[#050505]">
          <h2 className="text-[10px] font-black uppercase text-rose-600 mb-8 italic tracking-[0.3em]">○ AUSENTES ({ausentes.length})</h2>
          <div className="grid grid-cols-2 gap-10">
            {ausentes.map(e => (
              <div key={e.id} className="flex flex-col opacity-60">
                <p className="font-black uppercase italic text-sm">{e.nombre}</p>
                <p className="text-[10px] text-white/30 mb-2">{e.documento_id}</p>
                <p className="text-4xl font-black font-mono text-blue-500 leading-none">
                  {calcularRelojReal(e.ultimaJornada?.hora_salida)}
                </p>
                <p className="text-[9px] font-bold text-white/40 uppercase mt-2">
                  SALIDA: {extraerHoraUTC(e.ultimaJornada?.hora_salida)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER CON BOTÓN CORREGIDO */}
      <div className="p-4 bg-[#111] border-t border-white/10 flex justify-between items-center px-10">
        <p className="text-[9px] text-white/20 uppercase font-black">SISTEMA V12.0</p>
        <button 
          onClick={() => router.push('/reportes')} 
          className="bg-white/5 hover:bg-white/10 text-white px-10 py-2 rounded-full text-[10px] font-black uppercase italic border border-white/10 transition-all"
        >
          volver atrás
        </button>
      </div>
    </main>
  );
}