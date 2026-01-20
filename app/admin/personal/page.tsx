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
    const channel = supabase
      .channel('realtime-personal')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'empleados' }, (payload) => {
        setEmpleados(prev => prev.map(emp => emp.id === payload.new.id ? { ...emp, en_almacen: payload.new.en_almacen } : emp));
      })
      .subscribe();
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
          <button onClick={() => router.push('/admin')} className="p-4 bg-[#1e293b] rounded-2xl border border-white/5 font-black text-[10px] uppercase tracking-widest">← Panel</button>
          <h2 className="text-3xl font-black uppercase italic">Control de <span className="text-blue-500">Asistencia</span></h2>
        </header>

        <div className="space-y-4">
          {empleados.map((emp) => (
            <div key={emp.id} className="bg-[#0f172a] p-8 rounded-[35px] border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className={`w-4 h-4 rounded-full ${emp.en_almacen ? 'bg-emerald-500 shadow-[0_0_20px_#10b981]' : 'bg-red-500 shadow-[0_0_20px_#ef4444]'}`}></div>
                <div>
                  <h4 className="text-lg font-black uppercase tracking-tight">{emp.nombre}</h4>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{emp.rol} • ID: {emp.documento_id}</p>
                </div>
              </div>
              <div className={`px-6 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest ${emp.en_almacen ? 'border-emerald-500/20 text-emerald-500' : 'border-red-500/20 text-red-500'}`}>
                {emp.en_almacen ? 'Presente' : 'Ausente'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}