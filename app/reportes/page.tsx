'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function ReportesPage() {
  const [jornadas, setJornadas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchJornadas();
    
    // Suscripción en tiempo real para captar entradas y salidas al instante
    const channel = supabase
      .channel('cambios_jornadas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => {
        fetchJornadas();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchJornadas = async () => {
    setLoading(true);
    try {
      // Ordenamos por hora_salida (nulos primero o según actualización) 
      // y hora_entrada para que lo más reciente esté arriba
      const { data, error } = await supabase
        .from('jornadas')
        .select('*')
        .order('hora_entrada', { ascending: false });
      
      if (error) throw error;
      setJornadas(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Función para formatear el campo de tiempo (HH:mm:ss) sin conversiones numéricas
  const formatearTiempo = (tiempo: any) => {
    if (!tiempo) return "---";
    // Si el campo ya viene como string de la DB (08:30:00), lo limpiamos si es necesario
    return typeof tiempo === 'string' ? tiempo.substring(0, 5) + "h" : tiempo;
  };

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
          <header>
            <h1 className="text-2xl font-black uppercase italic tracking-tighter">
              Reporte de <span className="text-blue-500">Asistencia Real</span>
            </h1>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1 italic">
              Actualización en tiempo real • Orden Cronológico
            </p>
          </header>
          <div className="flex gap-4">
            <button onClick={fetchJornadas} className="bg-slate-800 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-white/5">Actualizar</button>
            <button onClick={() => router.back()} className="bg-red-600/20 text-red-500 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-red-500/20">Cerrar</button>
          </div>
        </div>

        {loading && jornadas.length === 0 ? (
          <div className="text-center py-20 text-slate-500 font-black animate-pulse uppercase">Consultando Jornadas...</div>
        ) : (
          <div className="overflow-hidden rounded-[35px] border border-white/5 bg-[#0f172a] shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/20">
                  <th className="p-6 text-[10px] font-black text-slate-500 uppercase">Empleado</th>
                  <th className="p-6 text-[10px] font-black text-slate-500 uppercase">Entrada</th>
                  <th className="p-6 text-[10px] font-black text-slate-500 uppercase">Salida</th>
                  <th className="p-6 text-[10px] font-black text-blue-500 uppercase italic">Tiempo Total</th>
                  <th className="p-6 text-[10px] font-black text-slate-500 uppercase">Estado</th>
                  <th className="p-6 text-[10px] font-black text-slate-500 uppercase">Autorizado por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {jornadas.map((j) => (
                  <tr key={j.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-6 text-sm font-black text-white uppercase italic">{j.nombre_empleado}</td>
                    <td className="p-6 text-[11px] font-mono text-emerald-500">
                      {new Date(j.hora_entrada).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                    </td>
                    <td className="p-6 text-[11px] font-mono text-red-400">
                      {j.hora_salida ? new Date(j.hora_salida).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '--:--'}
                    </td>
                    <td className="p-6">
                      <span className="text-lg font-black text-blue-400 italic">
                        {formatearTiempo(j.horas_trabajadas)}
                      </span>
                    </td>
                    <td className="p-6">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${
                        j.estado === 'activo' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-500/20 text-slate-500'
                      }`}>
                        {j.estado}
                      </span>
                    </td>
                    <td className="p-6 text-[9px] text-slate-500 uppercase font-bold italic">
                      {j.editado_por || '---'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}