'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const MapaInteractivo = dynamic(() => import('./MapaInteractivo'), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-900 animate-pulse flex items-center justify-center text-blue-500 font-black italic">CARGANDO SATÉLITE...</div>
});

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

  // Función de guardado por módulo
  const guardarModulo = async (claves: string[]) => {
    setGuardando(true);
    try {
      const promesas = claves.map(clave => 
        supabase.from('sistema_config').update({ valor: config[clave] }).eq('clave', clave)
      );
      await Promise.all(promesas);
      
      // Actualizamos solo el respaldo de las claves guardadas
      const nuevoRespaldo = { ...configOriginal };
      claves.forEach(c => nuevoRespaldo[c] = config[c]);
      setConfigOriginal(nuevoRespaldo);
      
      alert("MÓDULO ACTUALIZADO CORRECTAMENTE");
    } catch (err) {
      alert("ERROR AL GUARDAR");
    } finally {
      setGuardando(false);
    }
  };

  const cancelarModulo = (claves: string[]) => {
    const restaurado = { ...config };
    claves.forEach(c => restaurado[c] = configOriginal[c]);
    setConfig(restaurado);
  };

  const msAMinutos = (ms: string) => Math.floor(parseInt(ms || '0') / 60000);
  const minutosAMs = (min: string) => (parseInt(min || '0') * 60000).toString();

  if (loading) return <div className="min-h-screen bg-[#050a14] flex items-center justify-center font-black text-red-500 italic">INICIANDO KERNEL...</div>;

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-4">
            <div className="h-14 w-1 bg-red-600 shadow-[0_0_15px_red]"></div>
            <div>
              <h1 className="text-3xl font-black italic uppercase tracking-tighter">CONFIGURACIÓN <span className="text-red-600">MAESTRA</span></h1>
              <p className="text-[9px] font-bold text-slate-500 tracking-[0.4em] uppercase">Root: {user?.nombre}</p>
            </div>
          </div>
          <button onClick={() => router.back()} className="bg-slate-800 hover:bg-slate-700 px-6 py-3 rounded-xl font-black text-[10px] uppercase border border-white/5 transition-all">✖ SALIR</button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* MENÚ LATERAL */}
          <div className="md:col-span-3 space-y-2">
            {[
              { id: 'geolocalizacion', label: '📡 Geocerca GPS' },
              { id: 'seguridad', label: '🛡️ Tiempos de Seguridad' },
              { id: 'interfaz', label: '🖥️ Interfaz Sistema' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTabActual(tab.id)}
                className={`w-full text-left p-6 rounded-[25px] border transition-all ${
                  tabActual === tab.id ? 'bg-white/5 border-white/10 text-white' : 'border-transparent text-slate-500 hover:text-white'
                }`}
              >
                <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* PANEL DE CONTENIDO */}
          <div className="md:col-span-9 bg-[#0f172a] rounded-[45px] border border-white/5 p-10 shadow-2xl relative min-h-[650px] flex flex-col">
            
            <div className="flex-1">
              {/* 1. GEOLOCALIZACIÓN */}
              {tabActual === 'geolocalizacion' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <h2 className="text-xs font-black text-blue-500 uppercase italic tracking-widest">Ajuste de Geocerca</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" value={config.gps_latitud || ''} readOnly className="bg-[#050a14] border border-white/5 p-4 rounded-2xl font-mono text-xs text-blue-400" />
                    <input type="text" value={config.gps_longitud || ''} readOnly className="bg-[#050a14] border border-white/5 p-4 rounded-2xl font-mono text-xs text-blue-400" />
                  </div>
                  <div className="h-[350px] rounded-[35px] overflow-hidden border border-white/10 relative z-0">
                    <MapaInteractivo 
                      lat={parseFloat(config.gps_latitud || '0')} 
                      lng={parseFloat(config.gps_longitud || '0')}
                      onLocationChange={(lat, lng) => {
                        actualizarCampo('gps_latitud', lat.toString());
                        actualizarCampo('gps_longitud', lng.toString());
                      }}
                    />
                  </div>
                  <div className="bg-blue-500/5 p-6 rounded-3xl border border-blue-500/10">
                    <label className="text-[9px] font-black text-blue-500 uppercase block mb-3">Radio de Tolerancia: {config.gps_radio}m</label>
                    <input type="range" min="10" max="500" value={config.gps_radio || 80} onChange={e => actualizarCampo('gps_radio', e.target.value)} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-blue-600" />
                  </div>
                </div>
              )}

              {/* 2. SEGURIDAD */}
              {tabActual === 'seguridad' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                  <h2 className="text-xs font-black text-emerald-500 uppercase italic tracking-widest">Temporizadores de Red</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#050a14] p-8 rounded-[35px] border border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-4">Expiración QR (Minutos)</p>
                      <input type="number" value={msAMinutos(config.qr_expiracion)} onChange={e => actualizarCampo('qr_expiracion', minutosAMs(e.target.value))} className="bg-transparent text-5xl font-black text-emerald-500 outline-none w-full" />
                    </div>
                    <div className="bg-[#050a14] p-8 rounded-[35px] border border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-4">Inactividad (Minutos)</p>
                      <input type="number" value={msAMinutos(config.timer_inactividad)} onChange={e => actualizarCampo('timer_inactividad', minutosAMs(e.target.value))} className="bg-transparent text-5xl font-black text-emerald-500 outline-none w-full" />
                    </div>
                  </div>
                </div>
              )}

              {/* 3. INTERFAZ */}
              {tabActual === 'interfaz' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <h2 className="text-xs font-black text-purple-500 uppercase italic tracking-widest">Identidad Visual</h2>
                  <div className="bg-[#050a14] p-10 rounded-[40px] border border-white/5">
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-4">Nombre Comercial del Sistema</label>
                    <input type="text" value={config.empresa_nombre || ''} onChange={e => actualizarCampo('empresa_nombre', e.target.value)} className="bg-transparent text-4xl font-black text-white w-full outline-none uppercase italic" />
                  </div>
                </div>
              )}
            </div>

            {/* BARRA DE ACCIONES POR MÓDULO (ESTÉTICA AJUSTADA) */}
            <div className="mt-10 pt-8 border-t border-white/5 flex gap-4">
               <button 
                 onClick={() => {
                   const claves = tabActual === 'geolocalizacion' ? ['gps_latitud', 'gps_longitud', 'gps_radio'] : 
                                 tabActual === 'seguridad' ? ['qr_expiracion', 'timer_inactividad'] : ['empresa_nombre'];
                   guardarModulo(claves);
                 }}
                 disabled={guardando}
                 className="flex-1 bg-white text-black hover:bg-slate-200 p-5 rounded-[22px] font-black text-[11px] uppercase italic transition-all shadow-xl"
               >
                 {guardando ? 'Sincronizando...' : `Aplicar Cambios en ${tabActual}`}
               </button>
               <button 
                 onClick={() => {
                    const claves = tabActual === 'geolocalizacion' ? ['gps_latitud', 'gps_longitud', 'gps_radio'] : 
                                  tabActual === 'seguridad' ? ['qr_expiracion', 'timer_inactividad'] : ['empresa_nombre'];
                    cancelarModulo(claves);
                 }}
                 className="px-8 bg-slate-800 text-slate-400 hover:text-white p-5 rounded-[22px] font-black text-[11px] uppercase transition-all border border-white/5"
               >
                 Anular
               </button>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}