'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function PresenciaPage() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [ahora, setAhora] = useState(new Date());
  const [maxLabor, setMaxLabor] = useState<number>(8);
  const [tabActiva, setTabActiva] = useState<'empleados' | 'supervisores' | 'administradores' | 'tecnicos'>('empleados');
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  // EFECTO RELOJ GLOBAL
  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // CARGA DE DATOS Y SESIÓN
  const fetchData = useCallback(async () => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setUser(JSON.parse(sessionData));

    const { data: config } = await supabase.from('sistema_config').select('valor').eq('clave', 'maximo_labor').maybeSingle();
    if (config) setMaxLabor(parseFloat(config.valor) || 8);

    const { data: emps } = await supabase.from('empleados').select('*').eq('activo', true).order('nombre');
    const { data: jors } = await supabase.from('jornadas').select('*').order('created_at', { ascending: false });

    if (emps) {
      const vinculados = emps.map(e => {
        const ultimaJornada = jors?.find(j => j.empleado_id === e.id) || null;
        return { ...e, ultimaJornada };
      });
      setEmpleados(vinculados);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('presencia_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // LÓGICA DE CÁLCULO DE HORAS
  const calcularTranscurrido = (fechaISO: string) => {
    if (!fechaISO) return "00:00:00";
    const inicio = new Date(fechaISO).getTime();
    const diff = ahora.getTime() - inicio;
    const totalSegundos = Math.floor(diff / 1000);
    const h = Math.floor(totalSegundos / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSegundos % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSegundos % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const getHorasDecimal = (fechaISO: string) => {
    const inicio = new Date(fechaISO).getTime();
    return (ahora.getTime() - inicio) / 3600000;
  };

  // FILTRADO POR TABS
  const filtrarPorTab = (lista: any[]) => {
    const mapping: Record<string, string[]> = {
      empleados: ['empleado', 'trabajador'],
      supervisores: ['supervisor', 'capataz'],
      administradores: ['admin', 'Administrador'],
      tecnicos: ['técnico', 'tecnico', 'mantenimiento']
    };
    return lista.filter(e => mapping[tabActiva].includes(e.rol?.toLowerCase()));
  };

  const presentes = filtrarPorTab(empleados.filter(e => e.en_almacen));
  const ausentes = filtrarPorTab(empleados.filter(e => !e.en_almacen));

  return (
    <main className="min-h-screen bg-black flex flex-col items-center p-4 font-sans overflow-x-hidden">
      
      {/* MEMBRETE UNIFICADO (BLANCO Y AZUL) */}
      <div className="w-full max-w-7xl bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-6 text-center shadow-2xl">
        <h1 className="text-2xl font-black italic uppercase leading-none">
          <span className="text-white">MONITOR DE PRESENCIA </span>
          <span className="text-blue-600">TIEMPO REAL</span>
        </h1>
        {user && (
          <div className="pt-3 mt-3 border-t border-white/10 flex justify-center items-center gap-4">
            <p className="text-[11px] uppercase font-bold tracking-wider">
              <span className="text-white">{user.nombre}</span> 
              <span className="text-blue-500 ml-1">({user.nivel_acceso})</span>
            </p>
            <div className="h-4 w-[1px] bg-white/10"></div>
            <p className="text-[11px] font-mono text-blue-400 font-bold uppercase">{ahora.toLocaleTimeString()} - {ahora.toLocaleDateString()}</p>
          </div>
        )}
      </div>

      {/* SELECTOR DE PESTAÑAS */}
      <div className="flex gap-2 mb-8 bg-[#111] p-1.5 rounded-2xl border border-white/5">
        {(['empleados', 'supervisores', 'administradores', 'tecnicos'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setTabActiva(tab)}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all ${tabActiva === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="w-full max-w-7xl space-y-12">
        
        {/* LADO PRESENTES (ESTADO ACTIVO) */}
        <section>
          <div className="flex items-center gap-3 mb-6 border-b border-emerald-500/20 pb-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></div>
            <h2 className="text-xs font-black uppercase tracking-widest text-emerald-500 italic">Personal en Almacén ({presentes.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {presentes.map(e => {
              const hPresencia = e.ultimaJornada?.hora_entrada || '';
              const decimal = getHorasDecimal(hPresencia);
              const excede = decimal >= maxLabor;
              return (
                <div key={e.id} className={`bg-[#111] p-5 rounded-[30px] border-2 transition-all ${excede ? 'border-amber-500 animate-yellow-pulse' : 'border-emerald-500/30'}`}>
                  <p className="text-white font-black uppercase italic text-sm truncate leading-tight">{e.nombre}</p>
                  <p className="text-[9px] text-white/30 font-bold mb-3">{e.documento_id}</p>
                  <div className="bg-black/50 p-3 rounded-2xl border border-white/5 text-center">
                    <p className="text-[7px] text-white/40 uppercase font-black mb-1">Tiempo Estancia</p>
                    <p className={`text-xl font-black font-mono tracking-tighter ${excede ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {calcularTranscurrido(hPresencia)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* LADO AUSENTES (ESTADO FINALIZADO) */}
        <section>
          <div className="flex items-center gap-3 mb-6 border-b border-rose-500/20 pb-2">
            <div className="w-2 h-2 bg-rose-600 rounded-full shadow-[0_0_10px_#dc2626]"></div>
            <h2 className="text-xs font-black uppercase tracking-widest text-rose-500 italic">Personal Ausente ({ausentes.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {ausentes.map(e => {
              const hSalida = e.ultimaJornada?.hora_salida || '';
              return (
                <div key={e.id} className="bg-[#111]/40 p-5 rounded-[30px] border border-white/5 opacity-60">
                  <p className="text-white/80 font-black uppercase italic text-sm truncate leading-tight">{e.nombre}</p>
                  <p className="text-[9px] text-white/20 font-bold mb-3">{e.documento_id}</p>
                  <div className="bg-black/30 p-3 rounded-2xl text-center">
                    <p className="text-[7px] text-white/20 uppercase font-black mb-1">Tiempo de Ausencia</p>
                    <p className="text-lg font-black font-mono tracking-tighter text-blue-400/70">
                      {calcularTranscurrido(hSalida)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>

      <button onClick={() => router.push('/admin')} className="fixed bottom-8 right-8 bg-[#1a1a1a] p-4 rounded-full border border-white/10 text-[9px] font-black uppercase italic text-white/40 hover:text-white transition-all">
        ← VOLVER ATRÁS
      </button>

      <style jsx global>{`
        @keyframes yellow-pulse {
          0%, 100% { border-color: rgba(245, 158, 11, 0.1); box-shadow: 0 0 5px rgba(245,158,11,0); }
          50% { border-color: rgba(245, 158, 11, 1); box-shadow: 0 0 15px rgba(245,158,11,0.2); }
        }
        .animate-yellow-pulse { animation: yellow-pulse 2s infinite ease-in-out; }
      `}</style>
    </main>
  );
}