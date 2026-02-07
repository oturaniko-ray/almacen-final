'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function GestionPersonal() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetchEmpleados();
    const channel = supabase.channel('realtime-personal')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'empleados' }, (payload) => {
        setEmpleados(prev => prev.map(emp => emp.id === payload.new.id ? { ...emp, en_almacen: payload.new.en_almacen } : emp));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchEmpleados = async () => {
    const { data } = await supabase.from('empleados').select('*').order('nombre', { ascending: true });
    if (data) setEmpleados(data);
  };

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center gap-6 mb-12">
          {/* VOLVER UNIFICADO AL PANEL DE ADMIN */}
          <button onClick={() => router.push('/admin')} className="p-4 bg-[#1e293b] rounded-2xl border border-white/5 font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all">← Panel Admin</button>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter">CONTROL DE <span className="text-blue-500">PRESENCIA</span></h2>
        </header>

        <div className="space-y-4">
          {empleados.map((emp) => (
            <div key={emp.id} className="bg-[#0f172a] p-8 rounded-[35px] border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className={`w-3 h-3 rounded-full ${emp.en_almacen ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : 'bg-red-500'}`}></div>
                <div>
                  <h4 className="text-lg font-black uppercase italic">{emp.nombre}</h4>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{emp.rol} • ID: {emp.documento_id}</p>
                </div>
              </div>
              <div className={`px-6 py-2 rounded-full font-black text-[10px] uppercase italic ${emp.en_almacen ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                {emp.en_almacen ? 'Dentro' : 'Fuera'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}