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

    // SUSCRIPCIÓN EN TIEMPO REAL
    const channel = supabase
      .channel('cambios-personal')
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
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-10">
          <button onClick={() => router.back()} className="text-[10px] font-black uppercase text-slate-500 tracking-widest hover:text-white transition-all">← Volver</button>
          <h2 className="text-2xl font-black uppercase italic tracking-tight">Gestión de <span className="text-blue-500">Personal</span></h2>
        </header>

        <div className="grid gap-4">
          {empleados.map((emp) => (
            <div key={emp.id} className="bg-[#0f172a] p-6 rounded-[30px] border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* LÓGICA DEL PUNTO VERDE/ROJO */}
                <div className={`w-3 h-3 rounded-full ${emp.en_almacen ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : 'bg-red-500 shadow-[0_0_15px_#ef4444]'}`}></div>
                <div>
                  <h4 className="font-black uppercase text-sm">{emp.nombre}</h4>
                  <p className="text-[9px] text-slate-500 font-bold uppercase">{emp.rol} • {emp.documento_id}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-[9px] font-black uppercase px-4 py-1 rounded-full border ${emp.en_almacen ? 'border-emerald-500/30 text-emerald-500' : 'border-red-500/30 text-red-500'}`}>
                  {emp.en_almacen ? 'EN ALMACÉN' : 'AUSENTE'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}