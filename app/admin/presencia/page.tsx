'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function PresenciaPage() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [ahora, setAhora] = useState(new Date());
  const [maxLabor, setMaxLabor] = useState<number>(8); // Default 8 horas
  const [tabActiva, setTabActiva] = useState<'empleados' | 'supervisores' | 'administradores' | 'tecnicos'>('empleados');
  const router = useRouter();

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => setAhora(new Date()), 1000);
    const channel = supabase.channel('presencia_monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchData())
      .subscribe();
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    // 1. Cargar Configuración de Alerta
    const { data: config } = await supabase.from('sistema_config').select('valor').eq('clave', 'maximo_labor').maybeSingle();
    if (config) setMaxLabor(parseFloat(config.valor) || 8);

    // 2. Cargar Datos
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

  // CÁLCULO DE TIEMPO REAL
  const getDiffInHours = (fecha: string) => {
    const inicio = new Date(fecha).getTime();
    const actual = ahora.getTime();
    return (actual - inicio) / 3600000;
  };

  const formatDiff = (fechaBase: string) => {
    const diffMs = ahora.getTime() - new Date(fechaBase).getTime();
    const totalMin = Math.floor(diffMs / 60000);
    const h = Math.floor(totalMin / 60).toString().padStart(2, '0');
    const m = (totalMin % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  // FILTRADO POR ROLES Y TABS
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
    <main className="min-h-screen bg-[#050a14] p-4 md:p-10 text-white font-sans overflow-hidden">
      <div className="max-w-[1800px] mx-auto">
        
        {/* CABECERA DINÁMICA */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 px-4 gap-6">
          <div>
            <h1 className="text-5xl font-black uppercase italic tracking-tighter text-blue-600">Monitor de Presencia</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em] mt-2">Panel Operativo en Tiempo Real</p>
          </div>
          
          <div className="flex gap-2 bg-[#0f172a] p-1.5 rounded-2xl border border-white/5">
            {(['empleados', 'supervisores', 'administradores', 'tecnicos'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setTabActiva(tab)}
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all ${tabActiva === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-white'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="text-center md:text-right">
            <p className="text-5xl font-black font-mono tracking-tighter text-white">{ahora.toLocaleTimeString()}</p>
            <p className="text-[10px] font-black text-blue-400 uppercase italic">{ahora.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-10">
          
          {/* SECCIÓN PRESENTES (8 COLUMNAS) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center gap-3 ml-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></div>
              <h3 className="text-[14px] font-black uppercase tracking-[0.3em] text-emerald-500 italic">En Almacén ({presentes.length})</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {presentes.map(e => {
                const horasLaboradas = e.ultimaJornada?.hora_entrada ? getDiffInHours(e.ultimaJornada.hora_entrada) : 0;
                const excede = horasLaboradas >= maxLabor;

                return (
                  <div key={e.id} className={`bg-[#0f172a] p-6 rounded-[40px] border-2 transition-all duration-500 ${excede ? 'border-amber-500 animate-yellow-pulse shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-emerald-500/20 shadow-xl'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className={`font-black uppercase italic text-xl tracking-tighter leading-tight ${excede ? 'text-amber-500' : 'text-white'}`}>{e.nombre}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{e.rol}</p>
                      </div>
                      {excede && <span className="bg-amber-500 text-black text-[8px] font-black px-3 py-1 rounded-full animate-bounce">⚠️ EXCESO</span>}
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-black/40 rounded-[25px] p-4 border border-white/5">
                      <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase mb-1 text-center">Hora Ingreso</p>
                        <p className="text-sm font-black text-emerald-500 font-mono text-center">
                          {e.ultimaJornada?.hora_entrada ? new Date(e.ultimaJornada.hora_entrada).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                        </p>
                      </div>
                      <div className="border-l border-white/10">
                        <p className="text-[8px] font-black text-slate-500 uppercase mb-1 text-center">Transcurrido</p>
                        <p className={`text-sm font-black font-mono text-center ${excede ? 'text-amber-500' : 'text-blue-400'}`}>
                          {e.ultimaJornada?.hora_entrada ? formatDiff(e.ultimaJornada.hora_entrada) : '00:00'}h
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECCIÓN AUSENTES (4 COLUMNAS) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="flex items-center gap-3 ml-2">
              <div className="w-2 h-2 bg-red-600 rounded-full shadow-[0_0_10px_#dc2626]"></div>
              <h3 className="text-[13px] font-black uppercase tracking-[0.3em] text-red-500 italic">Fuera ({ausentes.length})</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-4 opacity-70">
              {ausentes.map(e => (
                <div key={e.id} className="bg-[#0f172a]/50 p-5 rounded-[30px] border border-red-500/10 flex items-center justify-between">
                  <div>
                    <p className="font-black uppercase italic text-[13px] tracking-tight text-slate-400">{e.nombre}</p>
                    <p className="text-[8px] text-red-500/50 font-bold uppercase">
                      Salida: {e.ultimaJornada?.hora_salida ? new Date(e.ultimaJornada.hora_salida).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] text-slate-600 font-black uppercase italic">Ausencia</p>
                    <p className="text-xs font-black text-blue-500/50 font-mono">
                      {e.ultimaJornada?.hora_salida ? formatDiff(e.ultimaJornada.hora_salida) : '00:00'}h
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        <button onClick={() => router.push('/admin')} className="fixed bottom-10 right-10 bg-white/5 hover:bg-white/10 p-5 rounded-full border border-white/10 backdrop-blur-md transition-all group active:scale-90">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] px-4 text-slate-400 group-hover:text-white">← Volver al Panel</span>
        </button>

      </div>

      <style jsx global>{`
        @keyframes yellow-pulse {
          0%, 100% { border-color: rgba(245, 158, 11, 0.2); }
          50% { border-color: rgba(245, 158, 11, 1); }
        }
        .animate-yellow-pulse {
          animation: yellow-pulse 2s infinite ease-in-out;
        }
      `}</style>
    </main>
  );
}