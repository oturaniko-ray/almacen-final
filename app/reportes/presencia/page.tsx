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

    // CONSULTA UNIFICADA: Empleados y sus Jornadas
    const { data: emps } = await supabase.from('empleados').select('*').eq('activo', true).order('nombre');
    const { data: jors } = await supabase.from('jornadas').select('*').order('created_at', { ascending: false });

    if (emps) {
      const vinculados = emps.map(e => {
        // Buscamos la jornada más reciente del empleado en la tabla jornadas
        const ultimaJor = jors?.find(j => j.empleado_id === e.id);
        return { ...e, ultimaJornada: ultimaJor || null };
      });
      setEmpleados(vinculados);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('presencia_v6')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const calcularHHMM = (fechaISO: string) => {
    if (!fechaISO) return "00:00";
    const diffMs = Math.max(0, ahora.getTime() - new Date(fechaISO).getTime());
    const h = Math.floor(diffMs / 3600000).toString().padStart(2, '0');
    const m = Math.floor((diffMs % 3600000) / 60000).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const getRolDisplay = (rol: string) => {
    const r = rol?.toLowerCase();
    return (r === 'admin' || r === 'administrador') ? 'ADMINISTRATIVO' : rol?.toUpperCase();
  };

  // FUNCIÓN DE EXPORTACIÓN CORREGIDA (COLUMNAS INDIVIDUALES)
  const exportarAsistencia = () => {
    const fechaStr = ahora.toLocaleDateString().replace(/\//g, '-');
    const horaStr = ahora.toLocaleTimeString().replace(/:/g, '-');
    
    // Encabezados con separador de columnas (;)
    const encabezados = ["Nombre", "Documento ID", "Hora Entrada", "Hora Salida", "Horas Trabajadas", "Estado"].join(";");
    
    const filas = empleados.map(e => [
      e.nombre,
      e.documento_id,
      e.ultimaJornada?.hora_entrada ? new Date(e.ultimaJornada.hora_entrada).toLocaleString() : '-',
      e.ultimaJornada?.hora_salida ? new Date(e.ultimaJornada.hora_salida).toLocaleString() : '-',
      e.ultimaJornada?.horas_trabajadas || '0',
      e.en_almacen ? 'PRESENTE' : 'AUSENTE'
    ].join(";"));

    const content = [
      `Reporte de Asistencia a las: ${ahora.toLocaleTimeString()}`,
      `Exportado por: ${user?.nombre} - ${getRolDisplay(user?.rol)}`,
      "",
      encabezados,
      ...filas
    ].join("\n");

    const blob = new Blob(["\ufeff" + content], { type: 'text/csv;charset=utf-8;' }); // \ufeff ayuda a Excel con caracteres especiales
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte de Asistencia ${fechaStr} ${horaStr}.csv`;
    link.click();
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

  const presentes = filtrarPorTab(empleados.filter(e => e.en_almacen));
  const ausentes = filtrarPorTab(empleados.filter(e => !e.en_almacen));

  return (
    <main className="min-h-screen bg-black flex flex-col font-sans overflow-hidden">
      
      {/* MEMBRETE */}
      <div className="w-full bg-[#1a1a1a] p-6 border-b border-white/5 relative shadow-2xl">
        <div className="absolute top-6 right-10 text-right">
          <p className="text-5xl font-black font-mono text-white leading-none mb-2">{ahora.toLocaleTimeString()}</p>
          <p className="text-[14px] font-bold text-white/60 uppercase tracking-[0.3em]">{ahora.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>

        <div className="text-left ml-4">
          <h1 className="text-2xl font-black italic uppercase leading-none mb-2 text-white">
            MONITOR DE PRESENCIA <span className="text-blue-600">TIEMPO REAL</span>
          </h1>
          {user && (
            <p className="text-[11px] uppercase tracking-widest font-medium text-white/60">
              {user.nombre} <span className="text-blue-500 font-black ml-2">[{getRolDisplay(user.rol)}]</span> ({user.nivel_acceso})
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center px-10 py-3 bg-black border-b border-white/5">
        <div className="flex gap-2">
          {(['empleados', 'supervisores', 'administradores', 'tecnicos'] as const).map(tab => (
            <button key={tab} onClick={() => setTabActiva(tab)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all ${tabActiva === tab ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-white/30 hover:text-white'}`}>{tab}</button>
          ))}
        </div>
        <button onClick={exportarAsistencia} className="bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/50 px-8 py-2 rounded-full text-[10px] font-black uppercase italic text-white transition-all">
          📊 EXPORTAR ASISTENCIA
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LADO PRESENTES */}
        <div className="w-1/2 p-6 overflow-y-auto border-r border-white/10">
          <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-emerald-500 italic mb-6">● PRESENTES ({presentes.length})</h2>
          <div className="grid grid-cols-4 gap-4">
            {presentes.map(e => {
              const hIn = e.ultimaJornada?.hora_entrada;
              return (
                <div key={e.id} className="p-4 rounded-[30px] border-2 bg-emerald-500/[0.03] border-emerald-500 shadow-[inset_0_0_20px_rgba(16,185,129,0.1)]">
                  <p className="text-white font-black uppercase italic text-[11px] truncate leading-none">{e.nombre}</p>
                  <p className="text-[11px] text-white/70 font-normal truncate mt-1 mb-4">{e.documento_id}</p>
                  <div className="bg-black/60 p-4 rounded-2xl border border-white/5 text-center">
                    <p className="text-3xl font-black font-mono tracking-tighter text-emerald-500">{calcularHHMM(hIn)}</p>
                    <p className="text-[10px] text-white/60 uppercase font-black mt-2">IN: {hIn ? new Date(hIn).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* LADO AUSENTES */}
        <div className="w-1/2 p-6 overflow-y-auto bg-[#020202]">
          <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-rose-600 italic mb-6">○ AUSENTES ({ausentes.length})</h2>
          <div className="grid grid-cols-4 gap-4">
            {ausentes.map(e => {
              const hOut = e.ultimaJornada?.hora_salida;
              return (
                <div key={e.id} className="p-4 rounded-[30px] border-2 bg-rose-500/[0.03] border-rose-500 shadow-[inset_0_0_20px_rgba(225,29,72,0.1)]">
                  <p className="text-white/80 font-black uppercase italic text-[11px] truncate leading-none">{e.nombre}</p>
                  <p className="text-[11px] text-white/70 font-normal truncate mt-1 mb-4">{e.documento_id}</p>
                  <div className="bg-black/60 p-4 rounded-2xl border border-white/5 text-center">
                    <p className="text-3xl font-black font-mono tracking-tighter text-blue-500">{calcularHHMM(hOut)}</p>
                    <p className="text-[10px] text-white/60 uppercase font-black mt-2">OUT: {hOut ? new Date(hOut).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-4 bg-[#1a1a1a] border-t border-white/5 flex justify-between items-center px-10">
        <p className="text-[9px] text-white/20 uppercase font-black tracking-widest">SISTEMA DE ASISTENCIA BIOMÉTRICA V6.0</p>
        <button onClick={() => router.push('/admin')} className="text-white/40 hover:text-white text-[10px] font-black uppercase italic transition-colors">← REGRESAR AL PANEL</button>
      </div>
    </main>
  );
}