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
        // Buscamos la última jornada absoluta para este empleado
        const ultimaJornada = jors?.find(j => j.empleado_id === e.id) || null;
        return { ...e, ultimaJornada };
      });
      setEmpleados(vinculados);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('presencia_dual_grid')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // RELOJ DINÁMICO HH:MM
  const formatReloj = (fechaISO: string) => {
    if (!fechaISO) return "00:00";
    const inicio = new Date(fechaISO).getTime();
    const diff = ahora.getTime() - inicio;
    const totalMinutos = Math.floor(diff / 60000);
    const h = Math.floor(totalMinutos / 60).toString().padStart(2, '0');
    const m = (totalMinutos % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const checkExceso = (fechaISO: string) => {
    if (!fechaISO) return false;
    const horas = (ahora.getTime() - new Date(fechaISO).getTime()) / 3600000;
    return horas >= maxLabor;
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
      
      {/* MEMBRETE UNIFICADO */}
      <div className="w-full bg-[#1a1a1a] p-4 border-b border-white/5 text-center shadow-xl">
        <h1 className="text-xl font-black italic uppercase leading-none mb-2">
          <span className="text-white">MONITOR OPERATIVO </span>
          <span className="text-blue-600">PRESENCIA</span>
        </h1>
        {user && (
          <div className="flex justify-center items-center gap-6">
            <p className="text-[10px] uppercase font-bold tracking-widest">
              <span className="text-white">{user.nombre}</span> 
              <span className="text-blue-500 ml-1">({user.nivel_acceso})</span>
            </p>
            <p className="text-[10px] font-mono text-blue-400 font-black">{ahora.toLocaleTimeString()} | {ahora.toLocaleDateString()}</p>
          </div>
        )}
      </div>

      {/* SELECTOR DE TABS */}
      <div className="flex justify-center gap-2 p-3 bg-black">
        {(['empleados', 'supervisores', 'administradores', 'tecnicos'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setTabActiva(tab)}
            className={`px-5 py-1.5 rounded-full text-[9px] font-black uppercase italic transition-all ${tabActiva === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40' : 'bg-white/5 text-white/40 hover:text-white'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* CONTENEDOR DIVIDIDO 50/50 */}
      <div className="flex flex-1 overflow-hidden border-t border-white/5">
        
        {/* LADO IZQUIERDO: PRESENTES (VERDE) */}
        <div className="w-1/2 p-4 border-r border-white/10 overflow-y-auto bg-black">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-500 italic">● Presentes ({presentes.length})</h2>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {presentes.map(e => {
              const hEntrada = e.ultimaJornada?.hora_entrada;
              const excede = checkExceso(hEntrada);
              return (
                <div key={e.id} className={`p-3 rounded-2xl border-2 transition-all ${excede ? 'bg-amber-500/5 border-amber-500 animate-yellow-pulse' : 'bg-emerald-500/5 border-emerald-500/40'}`}>
                  <p className="text-white font-black uppercase italic text-[10px] truncate leading-tight">{e.nombre}</p>
                  <p className="text-[8px] text-white/30 font-bold mb-2">{e.documento_id}</p>
                  <div className="bg-black/60 py-2 rounded-xl text-center border border-white/5">
                    <p className={`text-lg font-black font-mono tracking-tighter ${excede ? 'text-amber-500' : 'text-emerald-400'}`}>
                      {formatReloj(hEntrada)}
                    </p>
                    <p className="text-[6px] text-white/20 uppercase font-black">En Almacén</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* LADO DERECHO: AUSENTES (ROJO/AZUL) */}
        <div className="w-1/2 p-4 overflow-y-auto bg-[#020202]">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-600 italic">○ Ausentes ({ausentes.length})</h2>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {ausentes.map(e => {
              const hSalida = e.ultimaJornada?.hora_salida;
              return (
                <div key={e.id} className="p-3 rounded-2xl border border-white/10 bg-white/[0.02]">
                  <p className="text-white/60 font-black uppercase italic text-[10px] truncate leading-tight">{e.nombre}</p>
                  <p className="text-[8px] text-white/20 font-bold mb-2">{e.documento_id}</p>
                  <div className="bg-black/60 py-2 rounded-xl text-center border border-white/5">
                    <p className="text-lg font-black font-mono tracking-tighter text-blue-500/60">
                      {formatReloj(hSalida)}
                    </p>
                    <p className="text-[6px] text-white/20 uppercase font-black">De Ausencia</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* BOTÓN VOLVER */}
      <button 
        onClick={() => router.push('/admin')} 
        className="fixed bottom-6 right-6 bg-blue-600/10 hover:bg-blue-600 p-3 px-6 rounded-full border border-blue-600/50 text-[9px] font-black uppercase italic text-white transition-all shadow-2xl backdrop-blur-md"
      >
        ← VOLVER ATRÁS
      </button>

      <style jsx global>{`
        @keyframes yellow-pulse {
          0%, 100% { border-color: rgba(245, 158, 11, 0.2); transform: scale(1); }
          50% { border-color: rgba(245, 158, 11, 1); transform: scale(1.02); }
        }
        .animate-yellow-pulse { animation: yellow-pulse 2s infinite ease-in-out; }
      `}</style>
    </main>
  );
}