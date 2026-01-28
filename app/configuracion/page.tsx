'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const MapaInteractivo = dynamic(() => import('./MapaInteractivo'), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#050a14] flex items-center justify-center text-blue-500 font-black italic">ESTABLECIENDO ENLACE SATELITAL...</div>
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

  const guardarModulo = async (claves: string[]) => {
    setGuardando(true);
    try {
      const promesas = claves.map(clave => 
        supabase.from('sistema_config').update({ valor: config[clave] }).eq('clave', clave)
      );
      await Promise.all(promesas);
      
      const nuevoRespaldo = { ...configOriginal };
      claves.forEach(c => nuevoRespaldo[c] = config[c]);
      setConfigOriginal(nuevoRespaldo);
      alert("SISTEMA ACTUALIZADO CORRECTAMENTE");
    } catch (err) {
      alert("ERROR EN LA COMUNICACIÓN CON EL SERVIDOR");
    } finally {
      setGuardando(false);
    }
  };

  const cancelarModulo = (claves: string[]) => {
    const restaurado = { ...config };
    claves.forEach(c => restaurado[c] = configOriginal[c]);
    setConfig(restaurado);
  };

  const msAMinutos = (ms: any) => Math.floor(parseInt(ms || '0') / 60000);
  const minutosAMs = (min: any) => (parseInt(min || '0') * 60000).toString();

  if (loading) return (
    <div className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-1 bg-red-600 animate-pulse"></div>
      <p className="font-black text-red-600 italic uppercase text-xs tracking-widest">Accediendo al Núcleo...</p>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* CABECERA */}
        <header className="flex justify-between items-center mb-10 border-b border-white/5 pb-8">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1 bg-red-600"></div>
            <div>
              <h1 className="text-2xl font-black italic uppercase tracking-tighter">CONFIGURACIÓN <span className="text-red-600">MAESTRA</span></h1>
              <p className="text-[8px] font-bold text-slate-500 tracking-[0.4em] uppercase">Auth: {user?.nombre}</p>
            </div>
          </div>
          <button onClick={() => router.back()} className="text-[10px] font-black bg-slate-800 px-6 py-3 rounded-full hover:bg-red-600 transition-all border border-white/10 uppercase italic">Descartar y Salir</button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* NAVEGACIÓN */}
          <div className="md:col-span-3 space-y-2">
            {[
              { id: 'geolocalizacion', label: '📡 Geocerca GPS' },
              { id: 'seguridad', label: '🛡️ Tiempos de Red' },
              { id: 'interfaz', label: '🖥️ Interfaz' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTabActual(tab.id)}
                className={`w-full text-left p-6 rounded-[30px] border transition-all ${
                  tabActual === tab.id ? 'bg-white/5 border-white/10 text-white' : 'border-transparent text-slate-500 hover:text-white'
                }`}
              >
                <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* PANEL ACTIVO */}
          <div className="md:col-span-9 bg-[#0f172a] rounded-[45px] border border-white/5 p-10 shadow-2xl relative flex flex-col min-h-[650px]">
            
            <div className="flex-1">
              {/* SECCIÓN GPS */}
              {tabActual === 'geolocalizacion' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex justify-between items-center px-2">
                    <h2 className="text-xs font-black text-blue-500 uppercase italic">Referencia Geográfica</h2>
                    <span className="text-[8px] font-mono text-slate-600 tracking-tighter uppercase italic">Valores cargados desde tabla sistema_config</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#050a14] p-4 rounded-2xl border border-white/5">
                      <p className="text-[8px] text-slate-500 font-black mb-1">LATITUD ACTUAL</p>
                      <input type="text" value={config.gps_latitud || ''} readOnly className="w-full bg-transparent font-mono text-xs text-blue-400 outline-none" />
                    </div>
                    <div className="bg-[#050a14] p-4 rounded-2xl border border-white/5">
                      <p className="text-[8px] text-slate-500 font-black mb-1">LONGITUD ACTUAL</p>
                      <input type="text" value={config.gps_longitud || ''} readOnly className="w-full bg-transparent font-mono text-xs text-blue-400 outline-none" />
                    </div>
                  </div>

                  <div className="h-[380px] rounded-[35px] overflow-hidden border border-white/10 shadow-2xl z-0">
                    <MapaInteractivo 
                      lat={parseFloat(config.gps_latitud || '0')} 
                      lng={parseFloat(config.gps_longitud || '0')}
                      onLocationChange={(lat, lng) => {
                        actualizarCampo('gps_latitud', lat.toString());
                        actualizarCampo('gps_longitud', lng.toString());
                      }}
                    />
                  </div>

                  <div className="bg-blue-600/5 p-8 rounded-[35px] border border-blue-600/10">
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Radio de Tolerancia</label>
                      <span className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full">{config.gps_radio || 0} Metros</span>
                    </div>
                    <input 
                      type="range" min="10" max="500" 
                      value={config.gps_radio || 80} 
                      onChange={e => actualizarCampo('gps_radio', e.target.value)} 
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-blue-600 cursor-pointer" 
                    />
                  </div>
                </div>
              )}

              {/* SECCIÓN SEGURIDAD */}
              {tabActual === 'seguridad' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <h2 className="text-xs font-black text-emerald-500 uppercase italic">Configuración de Tiempos</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#050a14] p-10 rounded-[40px] border border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-6">Expiración QR</p>
                      <div className="flex items-end gap-3">
                        <input 
                          type="number" 
                          value={msAMinutos(config.qr_expiracion)} 
                          onChange={e => actualizarCampo('qr_expiracion', minutosAMs(e.target.value))} 
                          className="bg-transparent text-6xl font-black text-emerald-500 outline-none w-32 tracking-tighter" 
                        />
                        <span className="text-xs font-black text-slate-400 mb-2 italic">MIN</span>
                      </div>
                      <p className="text-[8px] font-mono text-slate-700 mt-6 uppercase tracking-tighter italic">Valor en tabla: {config.qr_expiracion} ms</p>
                    </div>
                    <div className="bg-[#050a14] p-10 rounded-[40px] border border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-6">Inactividad Global</p>
                      <div className="flex items-end gap-3">
                        <input 
                          type="number" 
                          value={msAMinutos(config.timer_inactividad)} 
                          onChange={e => actualizarCampo('timer_inactividad', minutosAMs(e.target.value))} 
                          className="bg-transparent text-6xl font-black text-emerald-500 outline-none w-32 tracking-tighter" 
                        />
                        <span className="text-xs font-black text-slate-400 mb-2 italic">MIN</span>
                      </div>
                      <p className="text-[8px] font-mono text-slate-700 mt-6 uppercase tracking-tighter italic">Valor en tabla: {config.timer_inactividad} ms</p>
                    </div>
                  </div>
                </div>
              )}

              {/* SECCIÓN INTERFAZ */}
              {tabActual === 'interfaz' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <h2 className="text-xs font-black text-purple-500 uppercase italic">Sistema e Imagen</h2>
                  <div className="bg-[#050a14] p-12 rounded-[45px] border border-white/5">
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-6">Nombre de la Compañía</label>
                    <input 
                      type="text" 
                      value={config.empresa_nombre || ''} 
                      onChange={e => actualizarCampo('empresa_nombre', e.target.value)} 
                      className="bg-transparent text-4xl font-black text-white w-full outline-none uppercase italic border-b border-white/10 pb-4 focus:border-purple-600 transition-all" 
                    />
                  </div>
                </div>
              )}
            </div>

            {/* BARRA DE ACCIONES LOCALES */}
            <div className="mt-10 pt-10 border-t border-white/5 flex gap-4">
               <button 
                 onClick={() => {
                   const claves = tabActual === 'geolocalizacion' ? ['gps_latitud', 'gps_longitud', 'gps_radio'] : 
                                 tabActual === 'seguridad' ? ['qr_expiracion', 'timer_inactividad'] : ['empresa_nombre'];
                   guardarModulo(claves);
                 }}
                 disabled={guardando}
                 className="flex-1 bg-white text-black hover:bg-slate-200 p-6 rounded-[25px] font-black text-[11px] uppercase italic transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95 disabled:opacity-50"
               >
                 {guardando ? 'SINCRONIZANDO...' : `GUARDAR CAMBIOS EN ${tabActual.toUpperCase()}`}
               </button>
               <button 
                 onClick={() => {
                    const claves = tabActual === 'geolocalizacion' ? ['gps_latitud', 'gps_longitud', 'gps_radio'] : 
                                  tabActual === 'seguridad' ? ['qr_expiracion', 'timer_inactividad'] : ['empresa_nombre'];
                    cancelarModulo(claves);
                 }}
                 className="px-10 bg-slate-800 text-slate-500 hover:text-white p-6 rounded-[25px] font-black text-[11px] uppercase transition-all border border-white/5 italic hover:bg-red-600/10 hover:border-red-600/20"
               >
                 ANULAR
               </button>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}