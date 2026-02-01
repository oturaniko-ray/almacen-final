'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function PresenciaPage() {
  const [presentes, setPresentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchPresentes();
    const channel = supabase.channel('presencia_monitor').on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchPresentes()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchPresentes = async () => {
    const { data } = await supabase.from('jornadas').select('*').is('hora_salida', null).eq('estado', 'activo');
    if (data) setPresentes(data);
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h2 className="text-3xl font-black uppercase italic text-emerald-500 tracking-tighter">● En Almacén <span className="text-white">Hoy</span></h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2">Monitoreo de Personal Activo</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => router.push('/reportes')} className="bg-[#0f172a] border border-white/5 px-6 py-3 rounded-2xl text-[10px] font-black uppercase hover:bg-blue-600 transition-all">Ver Reportes</button>
            <button onClick={() => router.back()} className="bg-red-600/10 text-red-500 border border-red-500/20 px-6 py-3 rounded-2xl text-[10px] font-black uppercase">Regresar</button>
          </div>
        </div>

        {/* GRILLA DE 2 COLUMNAS RESTAURADA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {presentes.map((p) => (
            <div key={p.id} className="bg-[#0f172a] p-8 rounded-[40px] border border-white/5 flex justify-between items-center group hover:border-emerald-500/30 transition-all shadow-2xl">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-[22px] flex items-center justify-center text-emerald-500 border border-emerald-500/20 font-black text-xl italic">
                  {p.nombre_empleado.charAt(0)}
                </div>
                <div>
                  <p className="text-xl font-black uppercase italic leading-none group-hover:text-emerald-400 transition-colors">{p.nombre_empleado}</p>
                  <p className="text-[11px] text-slate-500 font-bold uppercase mt-3 tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    Entrada: {new Date(p.hora_entrada).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'})}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-500 px-4 py-2 rounded-full uppercase italic">Activo</span>
              </div>
            </div>
          ))}

          {presentes.length === 0 && !loading && (
            <div className="col-span-full py-20 bg-[#0f172a] rounded-[40px] border border-dashed border-white/10 text-center">
              <p className="text-slate-600 font-black uppercase italic tracking-widest">No hay personal detectado en el recinto</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}