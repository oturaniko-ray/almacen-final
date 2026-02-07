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
    // Cruce de datos: empleados y jornadas mediante empleado_id
    const { data: emps } = await supabase.from('empleados').select('*').eq('activo', true).order('nombre');
    const { data: jors } = await supabase.from('jornadas').select('*').order('hora_entrada', { ascending: false });

    if (emps) {
      const vinculados = emps.map(e => {
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
    const channel = supabase.channel('presencia_v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchData())
      .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(channel); };
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

  const roles = ['empleado', 'supervisor', 'administrador', 'técnico'];
  const empleadosFiltrados = empleados.filter(e => e.rol?.toLowerCase() === tabActiva.toLowerCase());
  const presentes = empleadosFiltrados.filter(e => e.en_almacen);
  const ausentes = empleadosFiltrados.filter(e => !e.en_almacen);

  return (
    <main className="min-h-screen bg-[#050a14] p-4 text-white font-sans">
      <div className="max-w-[100%] mx-auto">
        
        {/* MEMBRETE */}
        <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-xl font-black uppercase italic">MONITOR DE <span className="text-blue-500">PRESENCIA</span></h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              {user?.nombre} <span className="text-blue-500">[{user?.rol}]</span> ({user?.nivel_acceso})
            </p>
          </div>

          <div className="text-center">
            <p className="text-3xl font-black font-mono leading-none tracking-tighter text-white">
              {ahora.toLocaleTimeString([], { hour12: false })}
            </p>
            <p className="text-[8px] font-black uppercase text-blue-500 tracking-[0.2em] mt-1">
              {ahora.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>

          <div className="flex gap-2">
            <button onClick={exportarExcel} className="bg-emerald-600/20 text-emerald-500 border border-emerald-500/20 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all hover:bg-emerald-600/30">📊 EXPORTAR</button>
            <button onClick={() => router.push('/reportes')} className="bg-slate-800 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase border border-white/10 transition-all hover:bg-slate-700">REGRESAR</button>
          </div>
        </div>

        {/* PESTAÑAS DE ROL */}
        <div className="flex gap-1 mb-8 justify-center">
          {roles.map(rol => (
            <button 
              key={rol} 
              onClick={() => setTabActiva(rol)} 
              className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                tabActiva === rol ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 text-slate-500 hover:text-white'
              }`}
            >
              {rol}s
            </button>
          ))}
        </div>

        {/* DISTRIBUCIÓN 50/50 SIN RECUADROS ENVOLVENTES */}
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* LADO IZQUIERDO: PRESENTES */}
          <div className="flex-1">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 mb-6 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></span>
              PRESENTES ({presentes.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {presentes.map(e => (
                <div key={e.id} className="bg-[#0f172a] p-3 rounded-[20px] border-2 border-emerald-600 shadow-lg flex flex-col items-center">
                  <p className="text-white text-[11px] font-bold uppercase truncate w-full text-center leading-none">{e.nombre}</p>
                  <p className="text-[9px] text-white mt-1 uppercase font-medium">{e.documento_id}</p>
                  
                  <div className="my-2 text-center">
                    <p className="text-[13px] font-black font-mono text-emerald-400 leading-none">
                      {e.ultimaJornada?.hora_entrada ? new Date(e.ultimaJornada.hora_entrada).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'}) : '--:--:--'}
                    </p>
                  </div>

                  <div className="bg-black/40 w-full py-2 rounded-xl border border-white/5 text-center">
                    <p className="text-lg font-black font-mono text-blue-500 italic leading-none">
                      {calcularTiempo(e.ultimaJornada?.hora_entrada)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* LADO DERECHO: AUSENTES */}
          <div className="flex-1">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 mb-6 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-rose-600 rounded-full shadow-[0_0_8px_#e11d48]"></span>
              AUSENTES ({ausentes.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {ausentes.map(e => (
                <div key={e.id} className="bg-[#0f172a]/60 p-3 rounded-[20px] border-2 border-red-700 shadow-md flex flex-col items-center opacity-85">
                  <p className="text-white text-[11px] font-bold uppercase truncate w-full text-center leading-none">{e.nombre}</p>
                  <p className="text-[9px] text-white mt-1 uppercase font-medium">{e.documento_id}</p>
                  
                  <div className="my-2 text-center">
                    <p className="text-[13px] font-black font-mono text-red-500 leading-none">
                      {e.ultimaJornada?.hora_salida ? new Date(e.ultimaJornada.hora_salida).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'}) : '--:--:--'}
                    </p>
                  </div>

                  <div className="bg-black/20 w-full py-2 rounded-xl border border-white/5 text-center">
                    <p className="text-lg font-black font-mono text-rose-400 italic leading-none">
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