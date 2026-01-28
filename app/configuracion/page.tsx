'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function ConfigSystemPage() {
  const [user, setUser] = useState<any>(null);
  const [configs, setConfigs] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    setUser(JSON.parse(sessionData));
    fetchConfig();
  }, [router]);

  const fetchConfig = async () => {
    setCargando(true);
    const { data } = await supabase.from('sistema_config').select('*').order('categoria', { ascending: true });
    if (data) setConfigs(data);
    setCargando(false);
  };

  const handleUpdate = async (id: string, nuevoValor: string) => {
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, valor: nuevoValor } : c));
  };

  const saveAll = async () => {
    setGuardando(true);
    for (const item of configs) {
      await supabase.from('sistema_config').update({ valor: item.valor }).eq('id', item.id);
    }
    setGuardando(false);
    alert("Configuración actualizada correctamente");
  };

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter">
              Ajustes del <span className="text-blue-500">Sistema</span>
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mt-2 italic">
              Control Maestro de Parámetros
            </p>
          </div>
          <button onClick={() => router.push('/admin')} className="p-4 bg-[#1e293b] rounded-2xl border border-white/5 font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all">
            ← Volver
          </button>
        </header>

        {cargando ? (
          <div className="flex justify-center p-20 animate-pulse text-blue-500 font-black">CARGANDO PARÁMETROS...</div>
        ) : (
          <div className="space-y-6">
            {/* AGRUPAR POR CATEGORÍA */}
            {['geolocalizacion', 'seguridad', 'interfaz'].map(cat => (
              <section key={cat} className="bg-[#0f172a] p-8 rounded-[35px] border border-white/5 shadow-2xl">
                <h3 className="text-blue-500 font-black uppercase italic mb-6 tracking-widest text-sm border-b border-white/5 pb-2">
                  {cat}
                </h3>
                <div className="grid gap-6">
                  {configs.filter(c => c.categoria === cat).map(item => (
                    <div key={item.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-[11px] font-black uppercase text-white mb-1 tracking-tighter">
                          {item.descripcion}
                        </p>
                        <code className="text-[9px] text-slate-500 font-bold bg-black/30 px-2 py-1 rounded">
                          {item.clave}
                        </code>
                      </div>
                      <input
                        type="text"
                        className="bg-[#050a14] border border-white/10 p-4 rounded-xl text-xs font-bold text-blue-400 w-full md:w-64 focus:border-blue-500 outline-none"
                        value={item.valor}
                        onChange={(e) => handleUpdate(item.id, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}

            <div className="pt-8">
              <button
                onClick={saveAll}
                disabled={guardando}
                className="w-full py-8 bg-blue-600 rounded-[35px] font-black text-xl uppercase italic shadow-2xl shadow-blue-900/40 hover:bg-blue-500 disabled:opacity-20 transition-all transform active:scale-95"
              >
                {guardando ? 'GUARDANDO CAMBIOS...' : 'Aplicar Configuración Maestra'}
              </button>
              <p className="text-center text-[9px] font-bold text-slate-500 mt-4 uppercase tracking-[0.2em]">
                Los cambios afectarán a todos los módulos en tiempo real
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}