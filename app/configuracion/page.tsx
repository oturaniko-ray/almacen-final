'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function ConfigTecnicaPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>({});
  const [tabActual, setTabActual] = useState('geolocalizacion');
  const [tipoMapa, setTipoMapa] = useState('k'); // k=satelite, m=relieve
  const [guardando, setGuardando] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    const currentUser = JSON.parse(sessionData);
    
    if (currentUser.rol?.toLowerCase() !== 'tecnico') {
      router.replace('/');
      return;
    }
    setUser(currentUser);
    fetchConfig();
  }, [router]);

  const fetchConfig = async () => {
    const { data, error } = await supabase.from('sistema_config').select('*');
    if (!error && data) {
      const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
      setConfig(cfgMap);
    }
    setLoading(false);
  };

  const actualizarCampo = (clave: string, valor: string) => {
    setConfig((prev: any) => ({ ...prev, [clave]: valor }));
  };

  const capturarUbicacion = () => {
    if (!navigator.geolocation) return alert("Geolocalización no soportada");
    
    navigator.geolocation.getCurrentPosition((pos) => {
      actualizarCampo('gps_latitud', pos.coords.latitude.toString());
      actualizarCampo('gps_longitud', pos.coords.longitude.toString());
    }, (err) => alert("Error: " + err.message), { enableHighAccuracy: true });
  };

  const guardarCambios = async () => {
    setGuardando(true);
    try {
      const promesas = Object.entries(config).map(([clave, valor]) => 
        supabase.from('sistema_config').update({ valor }).eq('clave', clave)
      );
      await Promise.all(promesas);
      alert("NÚCLEO ACTUALIZADO CORRECTAMENTE");
    } catch (err) {
      alert("Error al sincronizar");
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#050a14] flex items-center justify-center font-black text-red-500 animate-pulse">ACCEDIENDO AL KERNEL...</div>;

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER TÉCNICO */}
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-4">
            <div className="h-14 w-1 bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.6)]"></div>
            <div>
              <h1 className="text-3xl font-black italic uppercase tracking-tighter">CONFIGURACIÓN <span className="text-red-600">MAESTRA</span></h1>
              <p className="text-[9px] font-bold text-slate-500 tracking-[0.4em] uppercase">Auth: {user?.nombre} | Root Access</p>
            </div>
          </div>
          <button onClick={() => router.push('/')} className="bg-slate-800 px-6 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-slate-700 transition-all border border-white/5">Cerrar Sesión</button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* TABS LATERALES */}
          <div className="md:col-span-3 space-y-2">
            {[
              { id: 'geolocalizacion', label: '📡 Geocerca GPS', color: 'blue' },
              { id: 'seguridad', label: '🛡️ Seguridad QR', color: 'red' },
              { id: 'interfaz', label: '🖥️ Sistema e Interfaz', color: 'emerald' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTabActual(tab.id)}
                className={`w-full text-left p-5 rounded-[25px] transition-all border ${
                  tabActual === tab.id ? 'bg-white/5 border-white/10' : 'border-transparent text-slate-500 hover:text-white'
                }`}
              >
                <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
              </button>
            ))}

            <button 
              onClick={guardarCambios}
              disabled={guardando}
              className="w-full mt-6 bg-red-600 hover:bg-red-500 p-6 rounded-[30px] font-black text-[11px] uppercase italic shadow-2xl shadow-red-900/40 transition-all disabled:opacity-50"
            >
              {guardando ? 'SINCRONIZANDO...' : 'APLICAR CAMBIOS'}
            </button>
          </div>

          {/* CONTENIDO */}
          <div className="md:col-span-9 bg-[#0f172a] rounded-[45px] border border-white/5 p-10 relative overflow-hidden">
            
            {/* SECCIÓN GEOLOCALIZACIÓN */}
            {tabActual === 'geolocalizacion' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="flex justify-between items-end">
                  <h2 className="text-xs font-black text-blue-500 uppercase tracking-widest italic">Parámetros de Ubicación</h2>
                  <button onClick={capturarUbicacion} className="bg-blue-600/10 border border-blue-500/20 px-4 py-2 rounded-xl text-[9px] font-black text-blue-400 uppercase hover:bg-blue-600 hover:text-white transition-all">
                    📍 Obtener mi posición actual
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Latitud (gps_latitud)</label>
                    <input 
                      type="text" value={config.gps_latitud || ''} 
                      onChange={(e) => actualizarCampo('gps_latitud', e.target.value)}
                      className="w-full bg-[#050a14] border border-white/5 rounded-2xl p-4 font-mono text-xs font-bold text-blue-400 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-2">Longitud (gps_longitud)</label>
                    <input 
                      type="text" value={config.gps_longitud || ''} 
                      onChange={(e) => actualizarCampo('gps_longitud', e.target.value)}
                      className="w-full bg-[#050a14] border border-white/5 rounded-2xl p-4 font-mono text-xs font-bold text-blue-400 outline-none"
                    />
                  </div>
                </div>

                <div className="bg-blue-500/5 border border-blue-500/10 p-6 rounded-3xl">
                  <div className="flex justify-between mb-4">
                    <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Radio de Tolerancia: {config.gps_radio}m</label>
                  </div>
                  <input 
                    type="range" min="10" max="500" value={config.gps_radio || 80}
                    onChange={(e) => actualizarCampo('gps_radio', e.target.value)}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* MINI MAPA */}
                <div className="relative rounded-[30px] overflow-hidden border border-white/10 h-64 bg-black">
                  <div className="absolute top-3 right-3 z-10 flex gap-2">
                    <button onClick={() => setTipoMapa('m')} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase ${tipoMapa === 'm' ? 'bg-blue-600' : 'bg-slate-800'}`}>Relieve</button>
                    <button onClick={() => setTipoMapa('k')} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase ${tipoMapa === 'k' ? 'bg-blue-600' : 'bg-slate-800'}`}>Satélite</button>
                  </div>
                  <iframe 
                    width="100%" height="100%" frameBorder="0"
                    src={`https://maps.google.com/maps?q=${config.gps_latitud},${config.gps_longitud}&t=${tipoMapa}&z=18&ie=UTF8&iwloc=&output=embed`}
                  ></iframe>
                </div>
              </div>
            )}

            {/* SECCIÓN SEGURIDAD */}
            {tabActual === 'seguridad' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-red-500 uppercase tracking-widest block">Tiempos de Caducidad (MS)</label>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-[#050a14] p-5 rounded-3xl border border-white/5">
                      <p className="text-[8px] font-black text-slate-500 uppercase mb-2">Expiración QR (qr_expiracion)</p>
                      <input 
                        type="number" value={config.qr_expiracion || ''} 
                        onChange={(e) => actualizarCampo('qr_expiracion', e.target.value)}
                        className="bg-transparent text-xl font-black text-white w-full outline-none"
                      />
                    </div>
                    <div className="bg-[#050a14] p-5 rounded-3xl border border-white/5">
                      <p className="text-[8px] font-black text-slate-500 uppercase mb-2">Inactividad (timer_inactividad)</p>
                      <input 
                        type="number" value={config.timer_inactividad || ''} 
                        onChange={(e) => actualizarCampo('timer_inactividad', e.target.value)}
                        className="bg-transparent text-xl font-black text-white w-full outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECCIÓN INTERFAZ */}
            {tabActual === 'interfaz' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block">Identidad Visual</label>
                  <div className="bg-[#050a14] p-6 rounded-3xl border border-white/5">
                    <p className="text-[8px] font-black text-slate-500 uppercase mb-3">Nombre de la Empresa (empresa_nombre)</p>
                    <input 
                      type="text" value={config.empresa_nombre || ''} 
                      onChange={(e) => actualizarCampo('empresa_nombre', e.target.value)}
                      className="bg-transparent text-2xl font-black text-white w-full outline-none uppercase italic italic tracking-tighter"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}