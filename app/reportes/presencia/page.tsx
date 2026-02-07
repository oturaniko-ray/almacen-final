'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

// Cliente Supabase
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function MonitorPresenciaV11() {
  const [dataEmpleados, setDataEmpleados] = useState<any[]>([]);
  const [relojMaestro, setRelojMaestro] = useState(new Date());
  const [sesion, setSesion] = useState<any>(null);
  const router = useRouter();

  // 1. Reloj de alta prioridad para forzar re-renderizado cada segundo
  useEffect(() => {
    const t = setInterval(() => setRelojMaestro(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // 2. Carga de datos con limpieza de caché manual
  const fetchMonitor = useCallback(async () => {
    const s = localStorage.getItem('user_session');
    if (s) setSesion(JSON.parse(s));

    // Traemos datos frescos ignorando estados previos
    const { data: emps } = await supabase.from('empleados').select('*').eq('activo', true).order('nombre');
    const { data: jors } = await supabase.from('jornadas').select('*').order('created_at', { ascending: false });

    if (emps) {
      const mapping = emps.map(e => ({
        ...e,
        jornadaActual: jors?.find(j => j.empleado_id === e.id) || null
      }));
      setDataEmpleados(mapping);
    }
  }, []);

  useEffect(() => {
    fetchMonitor();
    const sub = supabase.channel('presencia_force_v11')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchMonitor())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchMonitor]);

  // 3. Lógica Matemática de Tiempo (Auditada según tu captura de BD)
  // Usamos Date.parse para asegurar compatibilidad con el string de Supabase
  const getTiempoReal = (ts: string | null) => {
    if (!ts) return "00:00:00";
    const inicioMs = Date.parse(ts);
    const ahoraMs = relojMaestro.getTime();
    const diff = Math.max(0, ahoraMs - inicioMs);

    const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // 4. Extracción de Hora sin desfase regional
  const getHoraLimpia = (ts: string | null) => {
    if (!ts) return "--:--:--";
    const d = new Date(ts);
    // Usamos getUTC para coincidir con el formato +00 de tu captura
    return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}:${d.getUTCSeconds().toString().padStart(2, '0')}`;
  };

  // Separación por estado físico
  const listaPresentes = dataEmpleados.filter(e => e.en_almacen === true);
  const listaAusentes = dataEmpleados.filter(e => e.en_almacen === false);

  return (
    <main className="min-h-screen bg-black flex flex-col font-sans text-white overflow-hidden">
      
      {/* HEADER SUPERIOR */}
      <div className="w-full bg-[#111] p-5 border-b border-white/10 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black italic uppercase leading-none text-white">
            MONITOR <span className="text-blue-600">TIEMPO REAL</span>
          </h1>
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">
            {sesion?.nombre} - {sesion?.rol} ({sesion?.nivel_acceso})
          </p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-black font-mono leading-none">{relojMaestro.toLocaleTimeString()}</p>
          <p className="text-[10px] text-blue-500 font-bold uppercase">{relojMaestro.toLocaleDateString()}</p>
        </div>
      </div>

      {/* CUERPO DEL MONITOR */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* COLUMNA PRESENTES */}
        <div className="w-1/2 p-6 overflow-y-auto border-r border-white/5">
          <h2 className="text-xs font-black uppercase text-emerald-500 mb-8 tracking-[0.3em] italic">● PRESENTES EN ALMACÉN ({listaPresentes.length})</h2>
          <div className="grid grid-cols-2 gap-x-10 gap-y-12">
            {listaPresentes.map(emp => (
              <div key={emp.id} className="flex flex-col border-l-2 border-emerald-500/20 pl-4">
                <p className="font-black uppercase italic text-sm leading-none">{emp.nombre}</p>
                <p className="text-[10px] text-white/30 mt-1 mb-2 font-mono">{emp.documento_id}</p>
                
                {/* RELOJ SIN RECUADROS - SOLO TEXTO */}
                <p className="text-4xl font-black font-mono text-emerald-500 leading-none tracking-tighter">
                  {getTiempoReal(emp.jornadaActual?.hora_entrada)}
                </p>
                <p className="text-[10px] font-bold text-emerald-500/40 uppercase mt-2">
                  ENTRADA: {getHoraLimpia(emp.jornadaActual?.hora_entrada)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* COLUMNA AUSENTES */}
        <div className="w-1/2 p-6 overflow-y-auto bg-[#050505]">
          <h2 className="text-xs font-black uppercase text-rose-600 mb-8 tracking-[0.3em] italic">○ FUERA DE TURNO ({listaAusentes.length})</h2>
          <div className="grid grid-cols-2 gap-x-10 gap-y-12">
            {listaAusentes.map(emp => (
              <div key={emp.id} className="flex flex-col border-l-2 border-white/5 pl-4 opacity-60">
                <p className="font-black uppercase italic text-sm leading-none">{emp.nombre}</p>
                <p className="text-[10px] text-white/30 mt-1 mb-2 font-mono">{emp.documento_id}</p>
                
                {/* RELOJ SIN RECUADROS - SOLO TEXTO */}
                <p className="text-4xl font-black font-mono text-blue-500 leading-none tracking-tighter">
                  {getTiempoReal(emp.jornadaActual?.hora_salida)}
                </p>
                <p className="text-[10px] font-bold text-white/20 uppercase mt-2">
                  SALIDA: {getHoraLimpia(emp.jornadaActual?.hora_salida)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BARRA INFERIOR - NAVEGACIÓN FORZADA */}
      <div className="p-4 bg-[#111] border-t border-white/10 flex justify-between items-center px-10">
        <p className="text-[9px] text-white/20 font-black tracking-widest uppercase">AUDITORÍA DE SISTEMA V11.0</p>
        
        <button 
          onClick={() => {
            console.log("Navegando a /reportes...");
            router.push('/reportes');
          }}
          className="bg-white/5 hover:bg-blue-600 text-white px-12 py-2 rounded-full text-[11px] font-black uppercase italic border border-white/10 transition-all active:scale-90"
          style={{ cursor: 'pointer', zIndex: 9999 }}
        >
          volver atrás
        </button>
      </div>
    </main>
  );
}