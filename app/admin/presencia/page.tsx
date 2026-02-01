'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function PresenciaPage() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetchData();
    const ch = supabase.channel('presencia_real').on('postgres_changes', { event: '*', schema: 'public', table: 'empleados' }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchData = async () => {
    const { data } = await supabase.from('empleados').select('*').eq('activo', true).order('nombre');
    if (data) setEmpleados(data);
  };

  const presentes = empleados.filter(e => e.en_almacen);
  const ausentes = empleados.filter(e => !e.en_almacen);

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
          <h2 className="text-2xl font-black uppercase italic text-emerald-500 tracking-tighter">● Monitor de <span className="text-white">Presencia</span></h2>
          <button onClick={() => router.back()} className="bg-slate-800 hover:bg-slate-700 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-white/5 transition-all">Regresar</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* COLUMNA PRESENTES */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] ml-4 bg-emerald-500/5 py-2 px-4 rounded-full inline-block">PRESENTES ({presentes.length})</h3>
            <div className="grid gap-3">
              {presentes.map(e => (
                <div key={e.id} className="bg-[#0f172a] p-6 rounded-[30px] border border-emerald-500/20 flex justify-between items-center shadow-xl shadow-emerald-500/5">
                  <p className="font-black uppercase italic tracking-tight">{e.nombre}</p>
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></div>
                </div>
              ))}
            </div>
          </div>

          {/* COLUMNA AUSENTES */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4 bg-white/5 py-2 px-4 rounded-full inline-block">FUERA DEL RECINTO ({ausentes.length})</h3>
            <div className="grid gap-3 opacity-60">
              {ausentes.map(e => (
                <div key={e.id} className="bg-[#0f172a] p-6 rounded-[30px] border border-white/5 flex justify-between items-center">
                  <p className="font-black uppercase italic text-slate-400">{e.nombre}</p>
                  <div className="w-2 h-2 bg-slate-700 rounded-full"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}