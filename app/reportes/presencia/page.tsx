'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function PresenciaPage() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [ahora, setAhora] = useState(new Date());
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // Recuperar sesión para el membrete
    const sessionData = localStorage.getItem('user_session');
    if (sessionData) setUser(JSON.parse(sessionData));

    fetchData();
    const interval = setInterval(() => setAhora(new Date()), 1000);
    
    const channel = supabase.channel('presencia_realtime_fixed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchData())
      .subscribe();
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    const { data: emps } = await supabase.from('empleados').select('*').eq('activo', true).order('nombre');
    const { data: jors } = await supabase.from('jornadas').select('*').order('hora_entrada', { ascending: false });

    if (emps) {
      const vinculados = emps.map(e => {
        const ultimaJornada = jors?.find(j => j.empleado_id === e.id);
        return { ...e, ultimaJornada };
      });
      setEmpleados(vinculados);
    }
  };

  const exportarAsistencia = () => {
    const dataExportar = empleados.map(e => ({
      Empleado: e.nombre,
      Documento: e.documento_id,
      Estado: e.en_almacen ? 'PRESENTE' : 'AUSENTE',
      Ultima_Entrada: e.ultimaJornada?.hora_entrada ? new Date(e.ultimaJornada.hora_entrada).toLocaleString() : 'N/A',
      Ultima_Salida: e.ultimaJornada?.hora_salida ? new Date(e.ultimaJornada.hora_salida).toLocaleString() : 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(dataExportar);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presencia_Actual");
    XLSX.writeFile(wb, `Presencia_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

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

  const presentes = empleados.filter(e => e.en_almacen);
  const ausentes = empleados.filter(e => !e.en_almacen);

  return (
    <main className="min-h-screen bg-[#050a14] p-6 text-white font-sans">
      <div className="max-w-[100%] mx-auto">
        
        {/* AJUSTE 1: MEMBRETE UNIFICADO */}
        <div className="flex justify-between items-start mb-4 border-b border-white/5 pb-6">
          <div>
            <h2 className="text-2xl font-black uppercase italic text-white">
              Monitor de <span className="text-blue-500">Presencia</span>
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {user?.nombre} <span className="text-blue-500">[{user?.rol || 'USUARIO'}]</span> ({user?.nivel_acceso || '0'})
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            {/* AJUSTE 2: RELOJ CENTRALIZADO EN EL HEADER */}
            <div className="text-right">
              <p className="text-4xl font-black font-mono leading-none text-white tracking-tighter">
                {ahora.toLocaleTimeString([], { hour12: false })}
              </p>
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">
                {ahora.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            
            <div className="flex gap-2">
              {/* AJUSTE 3: BOTÓN EXPORTAR */}
              <button 
                onClick={exportarAsistencia}
                className="bg-emerald-600/20 text-emerald-500 hover:bg-emerald-600/30 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-emerald-500/20 transition-all"
              >
                📊 Exportar Asistencia
              </button>

              {/* AJUSTE 4: VOLVER AL SUBMENÚ DE REPORTES */}
              <button 
                onClick={() => router.push('/reportes')} 
                className="bg-[#1e293b] hover:bg-slate-700 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-white/10 transition-all"
              >
                Regresar
              </button>
            </div>
          </div>
        </div>

        {/* CONTENEDOR DE GRIDS */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 mt-8">
          
          {/* PRESENTES */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 ml-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-500">Presentes ({presentes.length})</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-3">
              {presentes.map(e => (
                <div key={e.id} className="bg-[#0f172a] p-4 rounded-[25px] border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                  <p className="font-black uppercase italic text-[11px] truncate mb-1">{e.nombre}</p>
                  <p className="text-[9px] text-emerald-500/50 font-bold mb-2 uppercase">Entrada: {e.ultimaJornada ? new Date(e.ultimaJornada.hora_entrada).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</p>
                  <div className="bg-black/40 rounded-xl py-2 text-center border border-emerald-500/10">
                    <span className="text-lg font-black text-emerald-500 font-mono italic">
                      {calcularTiempo(e.ultimaJornada?.hora_entrada)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AUSENTES */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 ml-2">
              <div className="w-2 h-2 bg-red-600 rounded-full shadow-[0_0_8px_red]"></div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-red-500">Ausentes ({ausentes.length})</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-3 opacity-80">
              {ausentes.map(e => (
                <div key={e.id} className="bg-[#0f172a] p-4 rounded-[25px] border border-red-500/10">
                  <p className="font-black uppercase italic text-[11px] truncate mb-1 text-slate-400">{e.nombre}</p>
                  <p className="text-[9px] text-red-500/50 font-bold mb-2 uppercase">Salida: {e.ultimaJornada?.hora_salida ? new Date(e.ultimaJornada.hora_salida).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Sin registro'}</p>
                  <div className="bg-black/40 rounded-xl py-2 text-center border border-red-500/5">
                    <span className="text-lg font-black text-red-600 font-mono italic">
                      {calcularTiempo(e.ultimaJornada?.hora_salida || e.ultimaJornada?.hora_entrada)}
                    </span>
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