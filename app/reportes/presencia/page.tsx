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

  // Reloj maestro para forzar el renderizado cada segundo
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
    const channel = supabase.channel('presencia_v8')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  /**
   * CÁLCULO DE RELOJES (HH:MM:SS)
   * Analiza el timestampz y resta el tiempo actual
   */
  const calcularReloj = (timestamp: string | null) => {
    if (!timestamp) return "00:00:00";
    
    const inicio = new Date(timestamp).getTime();
    const fin = ahora.getTime();
    const diffMs = Math.max(0, fin - inicio);

    const h = Math.floor(diffMs / 3600000).toString().padStart(2, '0');
    const m = Math.floor((diffMs % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0');

    return `${h}:${m}:${s}`;
  };

  /**
   * LIMPIEZA DE HORA_ENTRADA / HORA_SALIDA
   * Extrae HH:MM:SS del formato timestamptz
   */
  const extraerHora = (timestamp: string | null) => {
    if (!timestamp) return "--:--:--";
    return new Date(timestamp).toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
    });
  };

  const presentes = empleados.filter(e => e.en_almacen && e.ultimaJornada?.estado === 'activo');
  const ausentes = empleados.filter(e => !e.en_almacen || e.ultimaJornada?.estado === 'finalizado');

  return (
    <main className="min-h-screen bg-black flex flex-col font-sans overflow-hidden text-white">
      
      {/* HEADER COMPACTO */}
      <div className="w-full bg-[#1a1a1a] p-4 border-b border-white/5 flex justify-between items-center shadow-xl">
        <h1 className="text-xl font-black italic uppercase">
          MONITOR <span className="text-blue-600">RT</span>
        </h1>
        <div className="text-right">
          <p className="text-3xl font-black font-mono leading-none">{ahora.toLocaleTimeString()}</p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* PANEL PRESENTES */}
        <div className="w-1/2 p-4 overflow-y-auto border-r border-white/10">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 mb-4 italic">● PRESENTES ({presentes.length})</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {presentes.map(e => (
              <div key={e.id} className="p-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col">
                <p className="font-black uppercase italic text-[10px] truncate">{e.nombre}</p>
                <p className="text-[9px] text-white/40 mb-2">{e.documento_id}</p>
                
                <p className="text-2xl font-black font-mono text-emerald-500 tracking-tighter">
                    {calcularReloj(e.ultimaJornada?.hora_entrada)}
                </p>
                <p className="text-[9px] font-bold text-white/60 uppercase">
                    IN: {extraerHora(e.ultimaJornada?.hora_entrada)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* PANEL AUSENTES */}
        <div className="w-1/2 p-4 overflow-y-auto bg-[#020202]">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-600 mb-4 italic">○ AUSENTES ({ausentes.length})</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {ausentes.map(e => (
              <div key={e.id} className="p-3 rounded-2xl border border-white/5 bg-white/[0.02] flex flex-col opacity-70">
                <p className="font-black uppercase italic text-[10px] truncate">{e.nombre}</p>
                <p className="text-[9px] text-white/40 mb-2">{e.documento_id}</p>
                
                <p className="text-2xl font-black font-mono text-blue-500 tracking-tighter">
                    {calcularReloj(e.ultimaJornada?.hora_salida)}
                </p>
                <p className="text-[9px] font-bold text-white/60 uppercase">
                    OUT: {extraerHora(e.ultimaJornada?.hora_salida)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER Y BOTÓN CORREGIDO */}
      <div className="p-4 bg-[#1a1a1a] border-t border-white/5 flex justify-between items-center px-10">
        <p className="text-[9px] text-white/20 uppercase font-black tracking-widest">TIEMPO REAL BIOMÉTRICO</p>
        <button 
          onClick={() => router.push('/reportes')} 
          className="bg-white/5 hover:bg-white/10 text-white px-8 py-2 rounded-full text-[10px] font-black uppercase italic border border-white/10 transition-all"
        >
          volver atrás
        </button>
      </div>
    </main>
  );
}