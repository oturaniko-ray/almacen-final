'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// Importación dinámica del nuevo componente
const MapaInteractivo = dynamic(() => import('./MapaInteractivo'), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-900 animate-pulse flex items-center justify-center text-[10px] font-black uppercase italic text-slate-500">Iniciando Sensores...</div>
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function ConfigMaestraPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>({});
  const [configOriginal, setConfigOriginal] = useState<any>({});
  const [tabActual, setTabActual] = useState('geolocalizacion');
  const [guardando, setGuardando] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    const currentUser = JSON.parse(sessionData);
    if (currentUser.rol?.toLowerCase() !== 'tecnico') { router.replace('/'); return; }
    setUser(currentUser);
    fetchConfig();
  }, [router]);

  const fetchConfig = async () => {
    const { data, error } = await supabase.from('sistema_config').select('*');
    if (!error && data) {
      const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
      setConfig(cfgMap);
      setConfigOriginal({ ...cfgMap });
    }
    setLoading(false);
  };

  const actualizarCampo = (clave: string, valor: string) => {
    setConfig((prev: any) => ({ ...prev, [clave]: valor }));
  };

  const guardarCambios = async () => {
    setGuardando(true);
    try {
      const promesas = Object.entries(config).map(([clave, valor]) => 
        supabase.from('sistema_config').update({ valor }).eq('clave', clave)
      );
      await Promise.all(promesas);
      setConfigOriginal({ ...config });
      alert("NÚCLEO SINCRONIZADO CON ÉXITO");
    } catch (err) {
      alert("Error en la sincronización");
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#050a14] flex items-center justify-center font-black text-red-500 italic">CARGANDO KERNEL...</div>;

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-4">
            <div className="h-14 w-1 bg-red-600 shadow-[0_0_15px_red]"></div>
            <div>
              <h1 className="text-3xl font-black italic uppercase tracking-tighter">CONFIGURACIÓN <span className="text-red-600">MAESTRA</span></h1>
              <p className="text-[9px] font-bold text-slate-500 tracking-[0.4em] uppercase italic">Root: {user?.nombre}</p>
            </div>
          </div>
          <button onClick={() => router.back()} className="bg-slate-800 hover:bg-slate-700 px-6 py-3 rounded-xl font-black text-[10px] uppercase border border-white/5 transition-all">✖ Salir</button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-3 space-y-3">
            {['geolocalizacion', 'seguridad', 'interfaz'].map((t) => (
              <button key={t} onClick={() => setTabActual(t)} className={`w-full text-left p-5 rounded-[25px] border transition-all ${tabActual === t ? 'bg-white/5 border-white/20 text-white' : 'border-transparent text-slate-500'}`}>
                <span className="text-[10px] font-black uppercase tracking-widest">{t}</span>
              </button>
            ))}
            <div className="pt-10 space-y-3">
              <button onClick={guardarCambios} disabled={guardando} className="w-full bg-red-600 hover:bg-red-500 p-5 rounded-[25px] font-black text-[11px] uppercase italic transition-all">
                {guardando ? 'Sincronizando...' : 'Guardar Cambios'}
              </button>
              <button onClick={() => setConfig({...configOriginal})} className="w-full bg-slate-800/50 p-5 rounded-[25px] font-black text-[11px] uppercase text-slate-400 border border-white/5">Cancelar Cambios</button>
            </div>
          </div>

          <div className="md:col-span-9 bg-[#0f172a] rounded-[45px] border border-white/5 p-10 shadow-2xl overflow-hidden min-h-[600px]">
            {tabActual === 'geolocalizacion' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" value={config.gps_latitud} readOnly className="bg-[#050a14] border border-white/5 p-4 rounded-2xl font-mono text-xs text-blue-400" />
                  <input type="text" value={config.gps_longitud} readOnly className="bg-[#050a14] border border-white/5 p-4 rounded-2xl font-mono text-xs text-blue-400" />
                </div>

                <div className="h-[400px] rounded-[35px] overflow-hidden border border-white/10 relative z-0">
                  <MapaInteractivo 
                    lat={parseFloat(config.gps_latitud || '0')} 
                    lng={parseFloat(config.gps_longitud || '0')}
                    onLocationChange={(lat, lng) => {
                      actualizarCampo('gps_latitud', lat.toString());
                      actualizarCampo('gps_longitud', lng.toString());
                    }}
                  />
                </div>
              </div>
            )}
            {/* Resto de secciones (seguridad, interfaz) aquí... */}
          </div>
        </div>
      </div>
    </main>
  );
}