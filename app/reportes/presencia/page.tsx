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
  const [maxLabor, setMaxLabor] = useState<number>(0); 
  const router = useRouter();

  const fetchData = useCallback(async () => {
    // AJUSTE SENIOR: Conversión explícita de valor de texto a numérico (ms)
    const { data: config } = await supabase.from('sistema_config').select('valor').eq('clave', 'maximo_labor').single();
    if (config) {
        // Almacenamos el valor convertido a número (milisegundos)
        setMaxLabor(parseFloat(config.valor) || 0);
    }

    const { data: emps } = await supabase.from('empleados').select('*').eq('activo', true).order('nombre');
    const { data: jors } = await supabase.from('jornadas').select('*').order('hora_entrada', { ascending: false });

    if (emps) {
      const vinculados = emps.map(e => {
        const ultimaJornada = jors?.find(j => j.empleado_id === e.id);
        return { ...e, ultimaJornada, nivel: Number(e.nivel_acceso || 0) };
      });
      setEmpleados(vinculados);
    }
  }, []);

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setUser(JSON.parse(sessionData));
    fetchData();
    const interval = setInterval(() => setAhora(new Date()), 1000);
    const channel = supabase.channel('presencia_v8')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchData())
      .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [fetchData]);

  const calcularTiempoRaw = (fechaISO: string | null) => {
    if (!fechaISO) return 0;
    return ahora.getTime() - new Date(fechaISO).getTime();
  };

  const formatearTiempo = (ms: number) => {
    const totalSegundos = Math.floor(ms / 1000);
    const h = Math.floor(totalSegundos / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSegundos % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSegundos % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const formatearFechaHoraUnico = (fechaISO: string | null) => {
    if (!fechaISO) return '--/-- --:--:--';
    const d = new Date(fechaISO);
    const fecha = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    const hora = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return `${fecha} ${hora}`;
  };

  const exportarExcel = () => {
    const data = empleados.map(e => ({
      Nombre: e.nombre,
      Documento: e.documento_id,
      Nivel: e.nivel_acceso,
      Estado: e.en_almacen ? 'PRESENTE' : 'AUSENTE'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presencia");
    XLSX.writeFile(wb, "Monitor_Presencia.xlsx");
  };

  const filtrarYOrdenar = (esPresente: boolean) => {
    return empleados
      .filter(e => {
        const n = e.nivel;
        const matchesTab = tabActiva === 'empleado' ? (n === 1 || n === 2) :
                         tabActiva === 'supervisor' ? (n === 3) :
                         tabActiva === 'administrador' ? (n >= 4 && n <= 7) :
                         tabActiva === 'técnico' ? (n >= 8 && n <= 10) : false;
        return matchesTab && e.en_almacen === esPresente;
      })
      .sort((a, b) => {
        const timeA = new Date(esPresente ? a.ultimaJornada?.hora_entrada : a.ultimaJornada?.hora_salida).getTime() || 0;
        const timeB = new Date(esPresente ? b.ultimaJornada?.hora_entrada : b.ultimaJornada?.hora_salida).getTime() || 0;
        return timeB - timeA;
      });
  };

  const presentes = filtrarYOrdenar(true);
  const ausentes = filtrarYOrdenar(false);

  return (
    <main className="min-h-screen bg-[#050a14] p-4 text-white font-sans">
      <div className="max-w-[100%] mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-xl font-black uppercase italic text-white">MONITOR DE <span className="text-blue-500">PRESENCIA</span></h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{user?.nombre} <span className="text-blue-500">[{user?.rol}]</span> ({user?.nivel_acceso})</p>
          </div>
          
          <div className="text-center">
            <p className="text-3xl font-black font-mono leading-none text-white">{ahora.toLocaleTimeString([], { hour12: false })}</p>
            <p className="text-[8px] font-black uppercase text-blue-500 tracking-[0.2em] mt-1">
              {ahora.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>

          <div className="flex gap-2">
            <button onClick={exportarExcel} className="bg-emerald-600/20 text-emerald-500 border border-emerald-500/20 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-600/30">📊 EXPORTAR</button>
            <button onClick={() => router.push('/reportes')} className="bg-slate-800 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase border border-white/10 hover:bg-slate-700">REGRESAR</button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-1 mb-10 justify-center">
          {['empleado', 'supervisor', 'administrador', 'técnico'].map(p => (
            <button key={p} onClick={() => setTabActiva(p)} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${tabActiva === p ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-slate-500 hover:text-white'}`}>{p}s</button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* COLUMNA PRESENTES */}
          <div className="flex-1">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 mb-6 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></span>
              PRESENTES ({presentes.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {presentes.map(e => {
                const ms = calcularTiempoRaw(e.ultimaJornada?.hora_entrada);
                // AUDITORÍA DE TIEMPO: ms transcurridos vs tope configurado (ambos en ms)
                const esExcedido = maxLabor > 0 && ms > maxLabor;
                
                return (
                  <div key={e.id} className={`p-4 rounded-[20px] border-2 transition-all duration-300 shadow-lg flex flex-col items-center ${esExcedido ? 'border-lime-400 bg-lime-400/10 shadow-[0_0_15px_rgba(163,230,53,0.3)]' : 'border-emerald-500 bg-[#0f172a]'}`}>
                    <p className="text-white text-[12px] font-black uppercase truncate w-full text-center leading-none mb-1">{e.nombre}</p>
                    <p className="text-[10px] text-slate-400 font-mono mb-2 uppercase">{e.documento_id}</p>
                    
                    <div className="mb-3">
                      <p className={`text-[11px] font-black font-mono tracking-tighter ${esExcedido ? 'text-lime-300' : 'text-white'}`}>
                        {formatearFechaHoraUnico(e.ultimaJornada?.hora_entrada)}
                      </p>
                    </div>

                    <div className={`w-full py-2 rounded-xl border text-center ${esExcedido ? 'bg-lime-400/20 border-lime-400/40' : 'bg-black/40 border-white/5'}`}>
                      <p className={`text-lg font-black font-mono italic leading-none ${esExcedido ? 'text-lime-400 animate-pulse' : 'text-blue-500'}`}>
                        {formatearTiempo(ms)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* COLUMNA AUSENTES */}
          <div className="flex-1">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 mb-6 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-rose-600 rounded-full shadow-[0_0_8px_#e11d48]"></span>
              AUSENTES ({ausentes.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {ausentes.map(e => (
                <div key={e.id} className="bg-[#0f172a] p-4 rounded-[20px] border border-rose-500/30 flex flex-col items-center">
                  <p className="text-white text-[12px] font-black uppercase truncate w-full text-center leading-none mb-1">{e.nombre}</p>
                  <p className="text-[10px] text-slate-500 font-mono mb-2 uppercase">{e.documento_id}</p>
                  
                  <div className="mb-3">
                    <p className="text-[11px] font-black font-mono text-white tracking-tighter">
                      {formatearFechaHoraUnico(e.ultimaJornada?.hora_salida)}
                    </p>
                  </div>

                  <div className="bg-black/20 w-full py-2 rounded-xl border border-white/5 text-center">
                    <p className="text-lg font-black font-mono text-rose-400 italic leading-none">
                      {formatearTiempo(calcularTiempoRaw(e.ultimaJornada?.hora_salida))}
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