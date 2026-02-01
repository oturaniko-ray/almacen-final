'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function PresenciaPage() {
  const [presentes, setPresentes] = useState<any[]>([]);

  useEffect(() => {
    fetchPresentes();
    const channel = supabase.channel('presencia_realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => fetchPresentes()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchPresentes = async () => {
    // Unificación: Filtramos solo los que tienen estado 'activo' en jornadas
    const { data } = await supabase.from('jornadas').select('*').is('hora_salida', null).eq('estado', 'activo');
    if (data) setPresentes(data);
  };

  return (
    <main className="min-h-screen bg-[#050a14] p-10 text-white font-sans">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-black uppercase italic text-emerald-500 mb-10 tracking-tighter">● Personal en Almacén</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {presentes.map((p) => (
            <div key={p.id} className="bg-[#0f172a] p-6 rounded-[30px] border border-emerald-500/20 flex justify-between items-center shadow-xl shadow-emerald-500/5">
              <div>
                <p className="text-lg font-black uppercase italic leading-none">{p.nombre_empleado}</p>
                <p className="text-[10px] text-emerald-500 font-bold uppercase mt-2 tracking-widest">Entrada: {new Date(p.hora_entrada).toLocaleTimeString()}</p>
              </div>
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></div>
            </div>
          ))}
          {presentes.length === 0 && (
            <p className="text-slate-600 font-black uppercase italic py-10">No hay personal detectado en el recinto.</p>
          )}
        </div>
      </div>
    </main>
  );
}