'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function PresenciaPage() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetchEmpleados();
    const channel = supabase.channel('realtime-presencia')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'empleados' }, fetchEmpleados)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchEmpleados = async () => {
    const { data } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (data) setEmpleados(data);
  };

  const presentes = empleados.filter(e => e.en_almacen);
  const ausentes = empleados.filter(e => !e.en_almacen);
  const total = empleados.length || 1;
  const porcP = (presentes.length / total) * 100;

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">ESTADO DE <span className="text-blue-500">PRESENCIA</span></h2>
          <button onClick={() => router.push('/admin')} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-black uppercase transition-all">← Volver</button>
        </header>

        {/* ANALÍTICAS FIJAS */}
        <section className="bg-[#0f172a] p-10 rounded-[45px] border border-white/5 mb-10 flex flex-col md:flex-row items-center gap-12 shadow-2xl">
          <div className="relative w-40 h-40 rounded-full flex items-center justify-center border-8 border-[#050a14]" 
               style={{ background: `conic-gradient(#10b981 ${porcP}%, #ef4444 0)` }}>
            <div className="absolute w-28 h-28 bg-[#0f172a] rounded-full flex flex-col items-center justify-center shadow-inner">
              <span className="text-2xl font-black italic">{Math.round(porcP)}%</span>
              <span className="text-[8px] font-black uppercase text-slate-500 tracking-tighter">EFECTIVIDAD</span>
            </div>
          </div>

          <div className="flex-1 space-y-4 text-center md:text-left">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Cantidad de empleados presentes:</p>
              <div className="flex items-center gap-4 justify-center md:justify-start">
                <span className="text-5xl font-black text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]">{presentes.length}</span>
                <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-[10px] font-black italic uppercase border border-emerald-500/20">OPERATIVOS</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Cantidad de empleados ausentes:</p>
              <div className="flex items-center gap-4 justify-center md:justify-start">
                <span className="text-5xl font-black text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]">{ausentes.length}</span>
                <span className="bg-red-500/10 text-red-500 px-3 py-1 rounded-full text-[10px] font-black italic uppercase border border-red-500/20">FUERA DE ÁREA</span>
              </div>
            </div>
          </div>
        </section>

        {/* DOS COLUMNAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-500 ml-6 italic">En Almacén</h3>
            <div className="space-y-3">
              {presentes.map(emp => (
                <div key={emp.id} className="bg-emerald-500/[0.03] p-6 rounded-[35px] border border-emerald-500/10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]"></div>
                    <span className="font-bold uppercase text-sm">{emp.nombre}</span>
                  </div>
                  <span className="text-[8px] font-black text-emerald-500/50 uppercase">{emp.rol}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-red-500 ml-6 italic">Ausentes</h3>
            <div className="space-y-3">
              {ausentes.map(emp => (
                <div key={emp.id} className="bg-red-500/[0.03] p-6 rounded-[35px] border border-red-500/10 flex items-center justify-between opacity-60">
                  <div className="flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full bg-red-950 border border-red-500/50"></div>
                    <span className="font-bold uppercase text-sm text-slate-400">{emp.nombre}</span>
                  </div>
                  <span className="text-[8px] font-black text-red-500/50 uppercase">{emp.rol}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}