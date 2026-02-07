'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function PresenciaPage() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [ahora, setAhora] = useState(new Date());
  const [tabActiva, setTabActiva] = useState<'empleados' | 'supervisores' | 'administradores' | 'tecnicos'>('empleados');
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  // Reloj Maestro para reactividad cada segundo
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
    const channel = supabase.channel('presencia_v7')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  /**
   * CÁLCULO ARQUITECTÓNICO DE TIEMPO
   * Realiza la operación matemática sobre timestampsz
   */
  const calcularRelojRealTime = (timestamp: string | null) => {
    if (!timestamp) return "00:00:00";
    
    const inicio = new Date(timestamp).getTime();
    const fin = ahora.getTime();
    const diffMs = Math.max(0, fin - inicio);

    const horas = Math.floor(diffMs / 3600000);
    const minutos = Math.floor((diffMs % 3600000) / 60000);
    const segundos = Math.floor((diffMs % 60000) / 1000);

    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
  };

  /**
   * FORMATEADOR DE HORA (Extracción de HH:MM:SS de Timestampsz)
   */
  const extraerHora = (timestamp: string | null) => {
    if (!timestamp) return "--:--:--";
    return new Date(timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const filtrarPorTab = (lista: any[]) => {
    const mapping: Record<string, string[]> = {
      empleados: ['empleado', 'trabajador'],
      supervisores: ['supervisor', 'capataz'],
      administradores: ['admin', 'administrador'],
      tecnicos: ['técnico', 'tecnico', 'mantenimiento']
    };
    return lista.filter(e => mapping[tabActiva].includes(e.rol?.toLowerCase()));
  };

  const presentes = filtrarPorTab(empleados.filter(e => e.en_almacen && e.ultimaJornada?.estado === 'activo'));
  const ausentes = filtrarPorTab(empleados.filter(e => !e.en_almacen || e.ultimaJornada?.estado === 'finalizado'));

  return (
    <main className="min-h-screen bg-black flex flex-col font-sans overflow-hidden">
      
      {/* MEMBRETE */}
      <div className="w-full bg-[#1a1a1a] p-6 border-b border-white/5 flex justify-between items-center shadow-2xl">
        <div>
          <h1 className="text-2xl font-black italic uppercase text-white">
            MONITOR DE PRESENCIA <span className="text-blue-600">RT</span>
          </h1>
          {user && (
            <p className="text-[10px] uppercase font-bold text-white/40 tracking-widest">
              {user.nombre} - {user.rol} ({user.nivel_acceso})
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-4xl font-black font-mono text-white leading-none">{ahora.toLocaleTimeString()}</p>
          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Sincronizado con Servidor</p>
        </div>
      </div>

      {/* TABS DE FILTRADO */}
      <div className="flex gap-2 p-4 bg-black border-b border-white/5 overflow-x-auto">
        {(['empleados', 'supervisores', 'administradores', 'tecnicos'] as const).map(tab => (
          <button key={tab} onClick={() => setTabActiva(tab)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all ${tabActiva === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 text-white/30 hover:text-white'}`}>{tab}</button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* PANEL PRESENTES - LÓGICA: Ahora - hora_entrada */}
        <div className="w-1/2 p-6 overflow-y-auto border-r border-white/10">
          <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-emerald-500 italic mb-6">● EN ALMACÉN ({presentes.length})</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {presentes.map(e => (
              <div key={e.id} className="p-4 rounded-[25px] border border-emerald-500/30 bg-emerald-500/5">
                <p className="text-white font-black uppercase italic text-[10px] truncate">{e.nombre}</p>
                <div className="mt-3 bg-black/40 p-3 rounded-xl border border-white/5 text-center">
                  <p className="text-2xl font-black font-mono text-emerald-500 tracking-tighter">
                    {calcularRelojRealTime(e.ultimaJornada?.hora_entrada)}
                  </p>
                  <p className="text-[8px] text-white/40 uppercase font-black mt-1">Desde: {extraerHora(e.ultimaJornada?.hora_entrada)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PANEL AUSENTES - LÓGICA: Ahora - hora_salida */}
        <div className="w-1/2 p-6 overflow-y-auto bg-[#020202]">
          <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-rose-600 italic mb-6">○ FUERA DE TURNO ({ausentes.length})</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {ausentes.map(e => (
              <div key={e.id} className="p-4 rounded-[25px] border border-rose-500/30 bg-rose-500/5 opacity-80">
                <p className="text-white font-black uppercase italic text-[10px] truncate">{e.nombre}</p>
                <div className="mt-3 bg-black/40 p-3 rounded-xl border border-white/5 text-center">
                  <p className="text-2xl font-black font-mono text-blue-500 tracking-tighter">
                    {calcularRelojRealTime(e.ultimaJornada?.hora_salida)}
                  </p>
                  <p className="text-[8px] text-white/40 uppercase font-black mt-1">Salida: {extraerHora(e.ultimaJornada?.hora_salida)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER Y BOTÓN DE RETORNO CORREGIDO */}
      <div className="p-4 bg-[#1a1a1a] border-t border-white/5 flex justify-between items-center px-10">
        <p className="text-[9px] text-white/20 uppercase font-black tracking-widest italic">Análisis de Base de Datos en Tiempo Real v7.0</p>
        <button 
          onClick={() => router.push('/reportes')} 
          className="bg-white/5 hover:bg-white/10 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase italic transition-all border border-white/10"
        >
          ← VOLVER A REPORTES
        </button>
      </div>
    </main>
  );
}