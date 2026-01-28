'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const MapaInteractivo = dynamic(() => import('./MapaInteractivo'), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#050a14] flex items-center justify-center text-blue-500 font-black text-xs italic">CALIBRANDO DESDE BASE DE DATOS...</div>
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
    // Permitir acceso a técnicos y admins
    if (currentUser.rol?.toLowerCase() !== 'tecnico' && currentUser.rol?.toLowerCase() !== 'admin') { 
      router.replace('/'); 
      return; 
    }
    setUser(currentUser);
    fetchConfig();
  }, [router]);

  const fetchConfig = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('sistema_config').select('clave, valor');
    if (data) {
      // Mapeo dinámico de todas las claves presentes en la captura
      const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
      setConfig(cfgMap);
      setConfigOriginal(cfgMap);
    }
    setLoading(false);
  };

  const actualizarCampo = (clave: string, valor: string) => {
    setConfig((prev: any) => ({ ...prev, [clave]: valor }));
  };

  const guardarModulo = async (claves: string[]) => {
    setGuardando(true);
    try {
      for (const clave of claves) {
        const { error } = await supabase
          .from('sistema_config')
          .update({ valor: String(config[clave]) })
          .eq('clave', clave);
        if (error) throw error;
      }
      
      const nuevoRespaldo = { ...configOriginal };
      claves.forEach(c => nuevoRespaldo[c] = config[c]);
      setConfigOriginal(nuevoRespaldo);
      alert("✅ REGISTROS ACTUALIZADOS EN SISTEMA_CONFIG");
    } catch (err: any) {
      alert("❌ ERROR AL ACTUALIZAR: " + err.message);
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

  if (loading) return <div className="min-h-screen bg-[#050a14] flex items-center justify-center font-black text-red-600 italic uppercase">Sincronizando...</div>;

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
          <h1 className="text-2xl font-black italic uppercase italic tracking-tighter">CONFIGURACIÓN <span className="text-red-600">MAESTRA</span></h1>
          <button onClick={() => router.back()} className="bg-slate-800 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-white/5 italic">Cerrar</button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* SIDEBAR */}
          <div className="md:col-span-3 space-y-2">
            {[
              { id: 'geolocalizacion', label: '📡 Geocerca GPS' },
              { id: 'seguridad', label: '🛡️ Tiempos de Red' },
              { id: 'interfaz', label: '🖥️ Interfaz' }
            ].map((tab) => (
              <button key={tab.id} onClick={() => setTabActual(tab.id)} className={`w-full text-left p-6 rounded-[25px] border transition-all ${tabActual === tab.id ? 'bg-white/5 border-white/20' : 'border-transparent text-slate-500 hover:text-white'}`}>
                <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* PANEL CONTENIDO */}
          <div className="md:col-span-9 bg-[#0f172a] rounded-[45px] border border-white/5 p-10 shadow-2xl flex flex-col min-h-[600px]">
            <div className="flex-1">
              {tabActual === 'geolocalizacion' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#050a14] p-4 rounded-2xl border border-white/5">
                      <p className="text-[8px] text-slate-500 font-black mb-1 uppercase">Latitud (gps_latitud)</p>
                      <p className="font-mono text-xs text-blue-400">{config.gps_latitud}</p>
                    </div>
                    <div className="bg-[#050a14] p-4 rounded-2xl border border-white/5">
                      <p className="text-[8px] text-slate-500 font-black mb-1 uppercase">Longitud (gps_longitud)</p>
                      <p className="font-mono text-xs text-blue-400">{config.gps_longitud}</p>
                    </div>
                  </div>

                  <div className="h-[350px] rounded-[35px] overflow-hidden border border-white/10 relative">
                    <MapaInteractivo 
                      lat={parseFloat(config.gps_latitud || '0')} 
                      lng={parseFloat(config.gps_longitud || '0')}
                      onLocationChange={(lat, lng) => {
                        actualizarCampo('gps_latitud', lat.toString());
                        actualizarCampo('gps_longitud', lng.toString());
                      }}
                    />
                  </div>

                  <div className="bg-[#050a14] p-6 rounded-3xl border border-white/5">
                    <label className="text-[9px] font-black text-blue-500 uppercase block mb-3 tracking-widest">Radio (gps_radio): {config.gps_radio}m</label>
                    <input type="range" min="10" max="500" value={config.gps_radio || 80} onChange={e => actualizarCampo('gps_radio', e.target.value)} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-blue-600" />
                  </div>
                </div>
              )}

              {tabActual === 'seguridad' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                  <div className="bg-[#050a14] p-8 rounded-[35px] border border-white/5">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-4 tracking-widest">Expiración QR (qr_expiracion)</p>
                    <div className="flex items-end gap-2">
                      <input type="number" value={msAMinutos(config.qr_expiracion)} onChange={e => actualizarCampo('qr_expiracion', minutosAMs(e.target.value))} className="bg-transparent text-5xl font-black text-emerald-500 outline-none w-32 tracking-tighter" />
                      <span className="text-xs font-black text-slate-400 mb-2 italic">MIN</span>
                    </div>
                    <p className="text-[8px] text-slate-600 mt-2 italic font-mono uppercase tracking-tighter">Actual: {config.qr_expiracion}ms</p>
                  </div>
                  <div className="bg-[#050a14] p-8 rounded-[35px] border border-white/5">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-4 tracking-widest">Inactividad (timer_inactividad)</p>
                    <div className="flex items-end gap-2">
                      <input type="number" value={msAMinutos(config.timer_inactividad)} onChange={e => actualizarCampo('timer_inactividad', minutosAMs(e.target.value))} className="bg-transparent text-5xl font-black text-emerald-500 outline-none w-32 tracking-tighter" />
                      <span className="text-xs font-black text-slate-400 mb-2 italic">MIN</span>
                    </div>
                    <p className="text-[8px] text-slate-600 mt-2 italic font-mono uppercase tracking-tighter">Actual: {config.timer_inactividad}ms</p>
                  </div>
                </div>
              )}

              {tabActual === 'interfaz' && (
                <div className="bg-[#050a14] p-10 rounded-[40px] border border-white/5 animate-in fade-in">
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-4 tracking-widest">Nombre del Sistema (empresa_nombre)</label>
                  <input type="text" value={config.empresa_nombre || ''} onChange={e => actualizarCampo('empresa_nombre', e.target.value)} className="bg-transparent text-4xl font-black text-white w-full outline-none uppercase italic border-b border-white/10 pb-4" />
                </div>
              )}
            </div>

            {/* ACTION BAR */}
            <div className="mt-8 pt-8 border-t border-white/5 flex gap-4">
              <button 
                onClick={() => {
                  const map: any = { geolocalizacion: ['gps_latitud', 'gps_longitud', 'gps_radio'], seguridad: ['qr_expiracion', 'timer_inactividad'], interfaz: ['empresa_nombre'] };
                  guardarModulo(map[tabActual]);
                }}
                disabled={guardando}
                className="flex-1 bg-white text-black p-5 rounded-[22px] font-black text-[11px] uppercase italic transition-all hover:bg-blue-600 hover:text-white disabled:opacity-50"
              >
                {guardando ? 'Sincronizando Base de Datos...' : `Actualizar registros de ${tabActual}`}
              </button>
              <button 
                onClick={() => {
                  const map: any = { geolocalizacion: ['gps_latitud', 'gps_longitud', 'gps_radio'], seguridad: ['qr_expiracion', 'timer_inactividad'], interfaz: ['empresa_nombre'] };
                  cancelarModulo(map[tabActual]);
                }}
                className="px-8 bg-slate-800 text-slate-400 p-5 rounded-[22px] font-black text-[11px] uppercase border border-white/5 hover:text-white transition-all"
              >
                Revertir cambios
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}