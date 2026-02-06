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

  // Reloj Maestro (Intervalo de 1 segundo)
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
    const channel = supabase.channel('presencia_v9')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  /**
   * ALGORITMO DE AUDITORÍA: CÁLCULO UTC REAL-TIME
   * Neutraliza el desfase de zona horaria del navegador
   */
  const calcularReloj = (timestamp: string | null) => {
    if (!timestamp) return "00:00:00";
    
    // Convertimos ambos a milisegundos UTC para una resta pura
    const inicio = new Date(timestamp).getTime(); 
    const fin = ahora.getTime(); 
    const diffMs = Math.max(0, fin - inicio);

    const h = Math.floor(diffMs / 3600000).toString().padStart(2, '0');
    const m = Math.floor((diffMs % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0');

    return `${h}:${m}:${s}`;
  };

  /**
   * LIMPIEZA DE HORA (Extracción HH:MM:SS)
   * Se fuerza formato 24h y se ignora el ajuste local
   */
  const extraerHora = (timestamp: string | null) => {
    if (!timestamp) return "--:--:--";
    const d = new Date(timestamp);
    // Extraemos los componentes manualmente para evitar que el navegador sume o reste horas por zona horaria
    return d.getUTCHours().toString().padStart(2, '0') + ":" + 
           d.getUTCMinutes().toString().padStart(2, '0') + ":" + 
           d.getUTCSeconds().toString().padStart(2, '0');
  };

  // Filtrado por lógica de negocio
  const presentes = empleados.filter(e => e.en_almacen && e.ultimaJornada?.estado === 'activo');
  const ausentes = empleados.filter(e => !e.en_almacen || e.ultimaJornada?.estado === 'finalizado');

  return (
    <main className="min-h-screen bg-black flex flex-col font-sans overflow-hidden text-white">
      
      {/* HEADER */}
      <div className="w-full bg-[#1a1a1a] p-4 border-b border-white/5 flex justify-between items-center">
        <h1 className="text-xl font-black italic uppercase">
          MONITOR <span className="text-blue-600">PRESTACIONES</span>
        </h1>
        <p className="text-3xl font-black font-mono">{ahora.toLocaleTimeString()}</p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* PANEL PRESENTES - DISEÑO SIN RECUADROS INTERNOS */}
        <div className="w-1/2 p-4 overflow-y-auto border-r border-white/10">
          <h2 className="text-[10px] font-black uppercase text-emerald-500 mb-6 italic tracking-widest">● PRESENTES ({presentes.length})</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-10">
            {presentes.map(e => (
              <div key={e.id} className="flex flex-col">
                <p className="font-black uppercase italic text-[11px] text-white truncate">{e.nombre}</p>
                <p className="text-[9px] text-white/30 mb-1">{e.documento_id}</p>
                
                {/* Reloj Real-Time */}
                <p className="text-3xl font-black font-mono text-emerald-500 leading-none">
                    {calcularReloj(e.ultimaJornada?.hora_entrada)}
                </p>
                {/* Hora de entrada limpia */}
                <p className="text-[9px] font-bold text-emerald-500/50 uppercase mt-1">
                    ENTRADA: {extraerHora(e.ultimaJornada?.hora_entrada)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* PANEL AUSENTES - DISEÑO SIN RECUADROS INTERNOS */}
        <div className="w-1/2 p-4 overflow-y-auto bg-[#020202]">
          <h2 className="text-[10px] font-black uppercase text-rose-600 mb-6 italic tracking-widest">○ AUSENTES ({ausentes.length})</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-10">
            {ausentes.map(e => (
              <div key={e.id} className="flex flex-col opacity-70">
                <p className="font-black uppercase italic text-[11px] text-white truncate">{e.nombre}</p>
                <p className="text-[9px] text-white/30 mb-1">{e.documento_id}</p>
                
                {/* Reloj Real-Time */}
                <p className="text-3xl font-black font-mono text-blue-500 leading-none">
                    {calcularReloj(e.ultimaJornada?.hora_salida)}
                </p>
                {/* Hora de salida limpia */}
                <p className="text-[9px] font-bold text-blue-500/50 uppercase mt-1">
                    SALIDA: {extraerHora(e.ultimaJornada?.hora_salida)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER - NAVEGACIÓN GARANTIZADA */}
      <div className="p-4 bg-[#1a1a1a] border-t border-white/5 flex justify-between items-center px-10">
        <p className="text-[9px] text-white/20 uppercase font-black tracking-widest">AUDITORÍA DE TIEMPO REAL</p>
        <button 
          onClick={() => router.push('/reportes')} 
          className="bg-white/5 hover:bg-white/10 text-white px-10 py-2 rounded-full text-[11px] font-black uppercase italic border border-white/10"
        >
          volver atrás
        </button>
      </div>
    </main>
  );
}