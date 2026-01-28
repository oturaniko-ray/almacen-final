'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const MapaInteractivo = dynamic(() => import('./MapaInteractivo'), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#050a14] flex items-center justify-center text-blue-500 font-black italic">CONECTANDO...</div>
});

export default function ConfigMaestraPage() {
  const [config, setConfig] = useState<any>(null); 
  const [configOriginal, setConfigOriginal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tabActual, setTabActual] = useState('geolocalizacion');
  const [guardando, setGuardando] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('sistema_config').select('clave, valor');
      if (error) throw error;

      if (data) {
        const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        
        // Mapeo directo sin valores quemados para evitar falsos positivos
        const finalData = {
          gps_latitud: cfgMap.gps_latitud || "0",
          gps_longitud: cfgMap.gps_longitud || "0",
          gps_radio: cfgMap.gps_radio || "100",
          qr_expiracion: cfgMap.qr_expiracion || "60000",
          timer_inactividad: cfgMap.timer_inactividad || "300000",
          empresa_nombre: cfgMap.empresa_nombre || "SISTEMA"
        };

        setConfig(finalData);
        setConfigOriginal({...finalData});
      }
    } catch (err) {
      console.error("Error de carga:", err);
    } finally {
      setLoading(false);
    }
  };

  const msAMinutos = (ms: string) => Math.floor(parseInt(ms || '0') / 60000);
  const minutosAMs = (min: string) => (parseInt(min || '0') * 60000).toString();

  const guardarModulo = async (claves: string[]) => {
    if (!config) return;
    setGuardando(true);
    try {
      // Usamos Promise.all para asegurar que todas las promesas se cumplan
      await Promise.all(claves.map(async (clave) => {
        const { error } = await supabase
          .from('sistema_config')
          .update({ valor: String(config[clave]) }) 
          .eq('clave', clave);
        
        if (error) throw error;
      }));
      
      setConfigOriginal({...config});
      alert("✅ REGISTROS ACTUALIZADOS EN LA NUBE");
    } catch (err: any) {
      alert("❌ ERROR DE ESCRITURA: " + err.message);
      fetchConfig(); // Revertir a datos reales si falla
    } finally {
      setGuardando(false);
    }
  };

  if (loading || !config) return <div className="min-h-screen bg-[#050a14] flex items-center justify-center text-red-600 font-black italic uppercase">Sincronizando con la tabla...</div>;

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
          <h1 className="text-2xl font-black italic uppercase italic tracking-tighter">CONFIGURACIÓN <span className="text-red-600">MAESTRA</span></h1>
          <button onClick={() => router.back()} className="bg-slate-800 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-white/5">Cerrar</button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-3 space-y-2">
            {[
              { id: 'geolocalizacion', label: '📡 GEOCERCA GPS' },
              { id: 'seguridad', label: '🛡️ TIEMPOS RED' },
              { id: 'interfaz', label: '🖥️ INTERFAZ' }
            ].map((tab) => (
              <button key={tab.id} onClick={() => setTabActual(tab.id)} className={`w-full text-left p-6 rounded-[25px] border transition-all ${tabActual === tab.id ? 'bg-white/5 border-white/20 shadow-lg' : 'border-transparent text-slate-500 hover:text-white'}`}>
                <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="md:col-span-9 bg-[#0f172a] rounded-[45px] border border-white/5 p-10 shadow-2xl flex flex-col min-h-[600px]">
            <div className="flex-1">
              {tabActual === 'geolocalizacion' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#050a14] p-4 rounded-2xl border border-white/5">
                      <p className="text-[8px] text-slate-500 font-black mb-1 uppercase text-blue-500">Latitud DB</p>
                      <p className="font-mono text-xs text-white">{config.gps_latitud}</p>
                    </div>
                    <div className="bg-[#050a14] p-4 rounded-2xl border border-white/5">
                      <p className="text-[8px] text-slate-500 font-black mb-1 uppercase text-blue-500">Longitud DB</p>
                      <p className="font-mono text-xs text-white">{config.gps_longitud}</p>
                    </div>
                  </div>

                  <div className="h-[350px] rounded-[35px] overflow-hidden border border-white/10 relative">
                    <MapaInteractivo 
                      lat={config.gps_latitud} 
                      lng={config.gps_longitud}
                      onLocationChange={(lat: number, lng: number) => {
                        setConfig((prev: any) => ({ ...prev, gps_latitud: lat.toString(), gps_longitud: lng.toString() }));
                      }}
                    />
                  </div>

                  <div className="bg-[#050a14] p-6 rounded-3xl border border-white/5">
                    <label className="text-[9px] font-black text-blue-500 uppercase block mb-3">Radio: {config.gps_radio}m</label>
                    <input type="range" min="10" max="500" value={config.gps_radio} onChange={e => setConfig({...config, gps_radio: e.target.value})} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-blue-600" />
                  </div>
                </div>
              )}

              {tabActual === 'seguridad' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                  <div className="bg-[#050a14] p-8 rounded-[35px] border border-white/5">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-4 tracking-widest">Expiración QR (Minutos)</p>
                    <input type="number" value={msAMinutos(config.qr_expiracion)} onChange={e => setConfig({...config, qr_expiracion: minutosAMs(e.target.value)})} className="bg-transparent text-5xl font-black text-emerald-500 outline-none w-full" />
                  </div>
                  <div className="bg-[#050a14] p-8 rounded-[35px] border border-white/5">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-4 tracking-widest">Inactividad (Minutos)</p>
                    <input type="number" value={msAMinutos(config.timer_inactividad)} onChange={e => setConfig({...config, timer_inactividad: minutosAMs(e.target.value)})} className="bg-transparent text-5xl font-black text-emerald-500 outline-none w-full" />
                  </div>
                </div>
              )}

              {tabActual === 'interfaz' && (
                <div className="bg-[#050a14] p-10 rounded-[40px] border border-white/5 animate-in fade-in">
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-4 tracking-widest">Nombre del Sistema</label>
                  <input type="text" value={config.empresa_nombre || ''} onChange={e => setConfig({...config, empresa_nombre: e.target.value})} className="bg-transparent text-4xl font-black text-white w-full outline-none uppercase italic border-b border-white/10 pb-4" />
                </div>
              )}
            </div>

            <div className="mt-8 pt-8 border-t border-white/5 flex gap-4">
              <button 
                onClick={() => {
                  const m: any = { geolocalizacion: ['gps_latitud', 'gps_longitud', 'gps_radio'], seguridad: ['qr_expiracion', 'timer_inactividad'], interfaz: ['empresa_nombre'] };
                  guardarModulo(m[tabActual]);
                }}
                disabled={guardando}
                className="flex-1 bg-white text-black p-5 rounded-[22px] font-black text-[11px] uppercase italic transition-all hover:bg-blue-600 hover:text-white disabled:opacity-50 shadow-xl"
              >
                {guardando ? 'ESCRIBIENDO EN TABLA...' : `APLICAR CAMBIOS EN ${tabActual.toUpperCase()}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}