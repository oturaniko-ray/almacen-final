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

  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
    const channel = supabase.channel('presencia_v4')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const calcularHHMM = (fechaISO: string) => {
    if (!fechaISO) return "00:00";
    const inicio = new Date(fechaISO).getTime();
    const diffMs = Math.max(0, ahora.getTime() - inicio);
    const totalMinutos = Math.floor(diffMs / 60000);
    const h = Math.floor(totalMinutos / 60).toString().padStart(2, '0');
    const m = (totalMinutos % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const checkExceso = (fechaISO: string) => {
    if (!fechaISO) return false;
    return ((ahora.getTime() - new Date(fechaISO).getTime()) / 3600000) >= maxLabor;
  };

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
    <main className="min-h-screen bg-black flex flex-col font-sans overflow-hidden">
      
      {/* MEMBRETE CON RELOJ SUPERIOR IZQUIERDA */}
      <div className="w-full bg-[#1a1a1a] p-5 border-b border-white/5 shadow-2xl relative">
        {/* Reloj y Fecha Superior Izquierda */}
        <div className="absolute top-5 left-8 text-left hidden md:block">
          <p className="text-xl font-black font-mono text-blue-500 leading-none">{ahora.toLocaleTimeString()}</p>
          <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">{ahora.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-black italic uppercase leading-none mb-2">
            <span className="text-white">MONITOR DE PRESENCIA </span>
            <span className="text-blue-600">TIEMPO REAL</span>
          </h1>
          {user && (
            <p className="text-[11px] uppercase tracking-widest font-medium">
              <span className="text-white">{user.nombre}</span>
              <span className="text-blue-500 font-black ml-2">[{user.rol || 'USER'}]</span>
              <span className="text-blue-300 ml-1">({user.nivel_acceso})</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-center gap-2 p-3 bg-black border-b border-white/5">
        {(['empleados', 'supervisores', 'administradores', 'tecnicos'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setTabActiva(tab)}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all ${tabActiva === tab ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/30 hover:text-white'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* IZQUIERDA: PRESENTES */}
        <div className="w-1/2 p-6 overflow-y-auto border-r border-white/10 bg-black">
          <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-500 italic mb-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            PERSONAL EN ALMACÉN ({presentes.length})
          </h2>
          <div className="grid grid-cols-4 gap-4">
            {presentes.map(e => {
              const hEntrada = e.ultimaJornada?.hora_entrada;
              const excede = checkExceso(hEntrada);
              return (
                <div key={e.id} className={`p-4 rounded-[25px] border-2 transition-all ${excede ? 'bg-amber-500/5 border-amber-500 animate-yellow-pulse' : 'bg-emerald-500/5 border-emerald-500'}`}>
                  <p className="text-white font-black uppercase italic text-[11px] truncate leading-none mb-1">{e.nombre}</p>
                  <p className="text-[11px] text-white/40 font-normal truncate mb-3">{e.documento_id}</p>
                  <div className="bg-black/60 p-3 rounded-2xl border border-white/5 text-center">
                    <p className={`text-2xl font-black font-mono tracking-tighter leading-none ${excede ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {calcularHHMM(hEntrada)}
                    </p>
                    <p className="text-[8px] text-white/20 uppercase font-black mt-2">In: {hEntrada ? new Date(hEntrada).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* DERECHA: AUSENTES */}
        <div className="w-1/2 p-6 overflow-y-auto bg-[#030303]">
          <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-rose-600 italic mb-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-rose-600 rounded-full"></span>
            PERSONAL AUSENTE ({ausentes.length})
          </h2>
          <div className="grid grid-cols-4 gap-4">
            {ausentes.map(e => {
              const hSalida = e.ultimaJornada?.hora_salida;
              return (
                <div key={e.id} className="p-4 rounded-[25px] border-2 bg-rose-500/5 border-rose-500">
                  <p className="text-white font-black uppercase italic text-[11px] truncate leading-none mb-1">{e.nombre}</p>
                  <p className="text-[11px] text-white/40 font-normal truncate mb-3">{e.documento_id}</p>
                  <div className="bg-black/60 p-3 rounded-2xl border border-white/5 text-center">
                    <p className="text-2xl font-black font-mono tracking-tighter leading-none text-blue-400">
                      {calcularHHMM(hSalida)}
                    </p>
                    <p className="text-[8px] text-white/20 uppercase font-black mt-2">Out: {hSalida ? new Date(hSalida).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-4 bg-[#1a1a1a] border-t border-white/5 flex justify-between items-center">
        <p className="text-[9px] text-white/20 uppercase font-bold italic tracking-widest">Monitorización de Seguridad Activa</p>
        <button onClick={() => router.push('/admin')} className="bg-blue-600 px-8 py-2 rounded-full text-[10px] font-black uppercase italic text-white active:scale-95 transition-all shadow-xl">
          ← VOLVER ATRÁS
        </button>
      </div>

      <style jsx global>{`
        @keyframes yellow-pulse {
          0%, 100% { border-color: rgba(245, 158, 11, 0.3); transform: scale(1); }
          50% { border-color: rgba(245, 158, 11, 1); transform: scale(1.02); }
        }
        .animate-yellow-pulse { animation: yellow-pulse 2s infinite ease-in-out; }
      `}</style>
    </main>
  );
}