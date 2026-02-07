'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function PresenciaPage() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [ahora, setAhora] = useState(new Date());
  const [user, setUser] = useState<any>(null);
  const [tabActiva, setTabActiva] = useState<'empleados' | 'supervisores' | 'administradores' | 'tecnicos'>('empleados');
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async () => {
    const session = localStorage.getItem('user_session');
    if (session) setUser(JSON.parse(session));

    const { data: emps } = await supabase.from('empleados').select('*').eq('activo', true).order('nombre');
    const { data: jors } = await supabase.from('jornadas').select('*').order('created_at', { ascending: false });

    if (emps) {
      setEmpleados(emps.map(e => ({
        ...e,
        ultimaJornada: jors?.find(j => j.empleado_id === e.id) || null
      })));
    }
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('presencia_vFinal').on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, fetchData).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const calcularHHMM = (fecha: string) => {
    if (!fecha) return "00:00";
    const diff = Math.max(0, ahora.getTime() - new Date(fecha).getTime());
    const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const getRolDisplay = (rol: string) => (rol?.toLowerCase() === 'admin' || rol?.toLowerCase() === 'administrador') ? 'ADMINISTRATIVO' : rol?.toUpperCase();

  const exportarCSV = () => {
    const fechaStr = ahora.toLocaleDateString().replace(/\//g, '-');
    const horaStr = ahora.toLocaleTimeString().replace(/:/g, '-');
    const headers = ["Nombre", "Documento ID", "Hora Entrada", "Hora Salida", "Estado"].join(";");
    const filas = empleados.map(e => [
      e.nombre, e.documento_id,
      e.ultimaJornada?.hora_entrada || '-',
      e.ultimaJornada?.hora_salida || '-',
      e.en_almacen ? 'PRESENTE' : 'AUSENTE'
    ].join(";"));
    
    const content = `Reporte de Asistencia a las: ${ahora.toLocaleTimeString()}\nExportado por: ${user?.nombre}\n\n${headers}\n${filas.join("\n")}`;
    const blob = new Blob(["\ufeff" + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte de Asistencia ${fechaStr} ${horaStr}.csv`;
    link.click();
  };

  const filtrar = (lista: any[]) => {
    const map: Record<string, string[]> = {
      empleados: ['empleado', 'trabajador'],
      supervisores: ['supervisor'],
      administradores: ['admin', 'administrador'],
      tecnicos: ['tecnico', 'mantenimiento']
    };
    return lista.filter(e => map[tabActiva].includes(e.rol?.toLowerCase()));
  };

  const presentes = filtrar(empleados.filter(e => e.en_almacen));
  const ausentes = filtrar(empleados.filter(e => !e.en_almacen));

  return (
    <main className="min-h-screen bg-black text-white font-sans flex flex-col overflow-hidden">
      <div className="bg-[#1a1a1a] p-6 border-b border-white/5 relative">
        <div className="absolute right-10 top-6 text-right">
          <p className="text-5xl font-black font-mono leading-none">{ahora.toLocaleTimeString()}</p>
          <p className="text-[12px] text-white/40 uppercase tracking-widest">{ahora.toLocaleDateString()}</p>
        </div>
        <h1 className="text-2xl font-black italic uppercase">Monitor <span className="text-blue-600">Presencia</span></h1>
        {user && <p className="text-[10px] text-white/50 uppercase">{user.nombre} | {getRolDisplay(user.rol)}</p>}
      </div>

      <div className="flex justify-between p-4 px-10 border-b border-white/5">
        <div className="flex gap-2">
          {['empleados', 'supervisores', 'administradores', 'tecnicos'].map(t => (
            <button key={t} onClick={() => setTabActiva(t as any)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase italic ${tabActiva === t ? 'bg-blue-600' : 'bg-white/5'}`}>{t}</button>
          ))}
        </div>
        <button onClick={exportarCSV} className="bg-emerald-600 px-6 py-2 rounded-full text-[10px] font-black italic">📊 EXPORTAR</button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/2 p-6 overflow-y-auto border-r border-white/5">
          <h2 className="text-emerald-500 font-black text-[10px] mb-4 uppercase tracking-widest italic">● Presentes ({presentes.length})</h2>
          <div className="grid grid-cols-4 gap-4">
            {presentes.map(e => (
              <div key={e.id} className="p-4 rounded-[25px] border-2 border-emerald-500 bg-emerald-500/[0.03] shadow-[inset_0_0_15px_rgba(16,185,129,0.1)]">
                <p className="text-[11px] font-black uppercase italic truncate">{e.nombre}</p>
                <p className="text-[11px] text-white/70">{e.documento_id}</p>
                <div className="bg-black/60 p-2 mt-2 rounded-xl text-center border border-white/5">
                  <p className="text-2xl font-black font-mono text-emerald-500">{calcularHHMM(e.ultimaJornada?.hora_entrada)}</p>
                  <p className="text-[8px] font-black uppercase text-white/30">IN: {e.ultimaJornada?.hora_entrada?.split('T')[1].slice(0,5)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="w-1/2 p-6 overflow-y-auto">
          <h2 className="text-rose-600 font-black text-[10px] mb-4 uppercase tracking-widest italic">○ Ausentes ({ausentes.length})</h2>
          <div className="grid grid-cols-4 gap-4">
            {ausentes.map(e => (
              <div key={e.id} className="p-4 rounded-[25px] border-2 border-rose-600 bg-rose-600/[0.03] shadow-[inset_0_0_15px_rgba(225,29,72,0.1)]">
                <p className="text-[11px] font-black uppercase italic truncate">{e.nombre}</p>
                <p className="text-[11px] text-white/70">{e.documento_id}</p>
                <div className="bg-black/60 p-2 mt-2 rounded-xl text-center border border-white/5">
                  <p className="text-2xl font-black font-mono text-blue-500">{calcularHHMM(e.ultimaJornada?.hora_salida)}</p>
                  <p className="text-[8px] font-black uppercase text-white/30">OUT: {e.ultimaJornada?.hora_salida?.split('T')[1].slice(0,5)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}