'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function PresenciaPage() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [ahora, setAhora] = useState(new Date());
  const [user, setUser] = useState<any>(null);
  const [tabActiva, setTabActiva] = useState<string>('empleado');
  const router = useRouter();

  const fetchData = useCallback(async () => {
    // 1. Obtener empleados activos
    const { data: emps } = await supabase.from('empleados').select('*').eq('activo', true).order('nombre');
    // 2. Obtener jornadas recientes
    const { data: jors } = await supabase.from('jornadas').select('*').order('hora_entrada', { ascending: false });

    if (emps) {
      const vinculados = emps.map(e => {
        // Match de ID: Buscamos la jornada donde el empleado_id coincida con el id del empleado
        const ultimaJornada = jors?.find(j => j.empleado_id === e.id);
        return { ...e, ultimaJornada };
      });
      setEmpleados(vinculados);
    }
  }, []);

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setUser(JSON.parse(sessionData));

    fetchData();
    const interval = setInterval(() => setAhora(new Date()), 1000);
    
    const channel = supabase.channel('presencia_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchData())
      .subscribe();
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const calcularTiempo = (fechaISO: string | null) => {
    if (!fechaISO) return "00:00:00";
    const inicio = new Date(fechaISO).getTime();
    const diff = ahora.getTime() - inicio;
    if (diff < 0) return "00:00:00";
    const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const exportarExcel = () => {
    const data = empleados.map(e => ({
      Nombre: e.nombre,
      Documento: e.documento_id,
      Rol: e.rol,
      Estado: e.en_almacen ? 'PRESENTE' : 'AUSENTE',
      Registro: e.en_almacen ? e.ultimaJornada?.hora_entrada : e.ultimaJornada?.hora_salida
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presencia");
    XLSX.writeFile(wb, "Monitor_Presencia.xlsx");
  };

  // Filtrado por Pestañas de Rol
  const empleadosFiltrados = empleados.filter(e => e.rol?.toLowerCase() === tabActiva.toLowerCase());
  const presentes = empleadosFiltrados.filter(e => e.en_almacen);
  const ausentes = empleadosFiltrados.filter(e => !e.en_almacen);

  const roles = ['empleado', 'supervisor', 'administrador', 'técnico'];

  return (
    <main className="min-h-screen bg-[#050a14] p-6 text-white font-sans">
      <div className="max-w-[100%] mx-auto">
        
        {/* 1. MEMBRETE UNIFICADO */}
        <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
          <div>
            <h2 className="text-2xl font-black uppercase italic">
              MONITOR DE <span className="text-blue-500">PRESENCIA</span>
            </h2>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              {user?.nombre} <span className="text-blue-500">[{user?.rol}]</span> ({user?.nivel_acceso})
            </p>
          </div>

          {/* 2. RELOJ CENTRAL Y FECHA */}
          <div className="text-center">
            <p className="text-5xl font-black font-mono leading-none tracking-tighter">
              {ahora.toLocaleTimeString([], { hour12: false })}
            </p>
            <p className="text-[10px] font-black uppercase text-blue-500 tracking-[0.3em] mt-1">
              {ahora.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          <div className="flex gap-2">
            <button onClick={exportarExcel} className="bg-emerald-600/20 text-emerald-500 border border-emerald-500/20 px-6 py-2 rounded-xl text-[10px] font-black uppercase">📊 EXPORTAR</button>
            <button onClick={() => router.push('/reportes')} className="bg-slate-800 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-white/10">REGRESAR</button>
          </div>
        </div>

        {/* 5. PESTAÑAS POR CATEGORÍA */}
        <div className="flex gap-2 mb-10 justify-center">
          {roles.map(rol => (
            <button
              key={rol}
              onClick={() => setTabActiva(rol)}
              className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                tabActiva === rol 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 border border-blue-400' 
                : 'bg-white/5 text-slate-500 border border-white/5 hover:bg-white/10'
              }`}
            >
              {rol}s
            </button>
          ))}
        </div>

        {/* DISTRIBUCIÓN EN GRIDS */}
        <div className="space-y-12">
          
          {/* SECCIÓN PRESENTES */}
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-emerald-500 mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              PRESENTES EN ALMACÉN ({presentes.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {presentes.map(e => (
                <div key={e.id} className="bg-[#0f172a] p-6 rounded-[35px] border border-white/5 shadow-xl flex flex-col items-center text-center">
                  <p className="text-white text-lg font-medium uppercase tracking-tight leading-none">{e.nombre}</p>
                  <p className="text-[11px] text-white mt-2 font-bold uppercase tracking-widest opacity-80">{e.documento_id}</p>
                  
                  <div className="my-5 w-full border-t border-white/5 pt-5">
                    <p className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest mb-1">Hora Entrada</p>
                    <p className="text-xl font-bold font-mono text-emerald-500">
                      {e.ultimaJornada?.hora_entrada ? new Date(e.ultimaJornada.hora_entrada).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'}) : '--:--:--'}
                    </p>
                  </div>

                  <div className="bg-black/40 w-full py-3 rounded-2xl border border-white/5">
                    <p className="text-3xl font-black font-mono text-blue-500 italic">
                      {calcularTiempo(e.ultimaJornada?.hora_entrada)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECCIÓN AUSENTES */}
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-rose-500 mb-6 flex items-center gap-2 opacity-60">
              <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
              PERSONAL FUERA ({ausentes.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {ausentes.map(e => (
                <div key={e.id} className="bg-[#0f172a]/50 p-6 rounded-[35px] border border-white/5 opacity-70 flex flex-col items-center text-center">
                  <p className="text-white/80 text-lg font-medium uppercase tracking-tight leading-none">{e.nombre}</p>
                  <p className="text-[11px] text-white mt-2 font-bold uppercase tracking-widest">{e.documento_id}</p>
                  
                  <div className="my-5 w-full border-t border-white/5 pt-5">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Última Salida</p>
                    <p className="text-xl font-bold font-mono text-slate-400">
                      {e.ultimaJornada?.hora_salida ? new Date(e.ultimaJornada.hora_salida).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'}) : '--:--:--'}
                    </p>
                  </div>

                  <div className="bg-black/20 w-full py-3 rounded-2xl border border-white/5">
                    <p className="text-3xl font-black font-mono text-slate-600 italic">
                      {calcularTiempo(e.ultimaJornada?.hora_salida)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}