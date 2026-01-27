'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function SupervisorPage() {
  const [user, setUser] = useState<any>(null);
  const [config, setConfig] = useState<any>({ 
    almacen_lat: 0, almacen_lon: 0, radio_maximo: 50, timer_token: '120000', timer_inactividad: '120000'
  });
  const [miUbicacion, setMiUbicacion] = useState({ lat: 0, lon: 0 });
  const [errorGps, setErrorGps] = useState('');
  const [recalibrando, setRecalibrando] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    const currentUser = JSON.parse(sessionData);
    if (!['admin', 'supervisor', 'tecnico'].includes(currentUser.rol.toLowerCase())) {
        router.push('/'); return;
    }
    setUser(currentUser);
    fetchConfig();

    const canalConfig = supabase.channel('config-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sistema_config' }, () => fetchConfig())
      .subscribe();

    return () => { supabase.removeChannel(canalConfig); };
  }, [router]);

  const fetchConfig = async () => {
    const { data } = await supabase.from('sistema_config').select('clave, valor');
    if (data) {
      const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
      setConfig({
        almacen_lat: parseFloat(cfgMap.almacen_lat) || 0,
        almacen_lon: parseFloat(cfgMap.almacen_lon) || 0,
        radio_maximo: parseInt(cfgMap.radio_maximo) || 50,
        timer_token: cfgMap.timer_token || '120000',
        timer_inactividad: cfgMap.timer_inactividad || '120000'
      });
    }
  };

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setMiUbicacion({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setErrorGps('');
      },
      (err) => setErrorGps("Error de precisión o señal GPS"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [recalibrando]);

  const actualizarConfig = async (clave: string, valor: string) => {
    await supabase.from('sistema_config').update({ valor }).eq('clave', clave);
    fetchConfig();
  };

  return (
    <main className="min-h-screen bg-[#050a14] p-8 text-white font-sans flex flex-col items-center">
      <div className="w-full max-w-2xl bg-[#0f172a] p-10 rounded-[45px] border border-white/5 shadow-2xl">
        
        <h1 className="text-3xl font-black uppercase italic text-white mb-8 tracking-tighter">
          Panel <span className="text-blue-500">Supervisor</span>
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* SECCIÓN GPS */}
          <div className="space-y-6">
            <div className="p-6 bg-white/5 rounded-[35px] border border-white/10">
              <h2 className="text-[10px] font-black uppercase text-blue-400 mb-4 tracking-[0.2em]">Mi Ubicación Actual</h2>
              {errorGps ? (
                <p className="text-red-500 text-xs font-bold animate-pulse">{errorGps}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-mono text-slate-300">LAT: {miUbicacion.lat}</p>
                  <p className="text-xs font-mono text-slate-300">LON: {miUbicacion.lon}</p>
                </div>
              )}
              <button 
                onClick={() => setRecalibrando(p => p + 1)}
                className="mt-6 w-full py-4 bg-blue-600 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-blue-900/40 hover:scale-105 transition-all"
              >
                🔄 Recalibrar GPS
              </button>
            </div>
          </div>

          {/* SECCIÓN CONFIGURACIÓN RÁPIDA */}
          <div className="space-y-6">
            <div className="p-6 bg-black/30 rounded-[35px] border border-white/5">
              <h2 className="text-[10px] font-black uppercase text-slate-500 mb-4 tracking-[0.2em]">Ajustes de Sistema</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-slate-600 uppercase mb-1 block">Radio Máximo (Metros)</label>
                  <input 
                    type="number" 
                    className="w-full bg-[#050a14] border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-blue-500"
                    value={config.radio_maximo}
                    onChange={(e) => actualizarConfig('radio_maximo', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-600 uppercase mb-1 block">Tiempo QR (ms)</label>
                  <input 
                    type="number" 
                    className="w-full bg-[#050a14] border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-blue-500"
                    value={config.timer_token}
                    onChange={(e) => actualizarConfig('timer_token', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={() => router.push('/admin')}
          className="w-full mt-10 py-5 text-[10px] font-black uppercase text-slate-500 border border-white/5 rounded-2xl hover:bg-white/5 hover:text-white transition-all"
        >
          ← Volver al Panel de Administración
        </button>
      </div>
    </main>
  );
}