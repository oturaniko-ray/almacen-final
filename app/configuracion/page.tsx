'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const MapaInteractivo = dynamic(() => import('./MapaInteractivo'), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-900 animate-pulse flex items-center justify-center text-blue-500 font-black italic">CONECTANDO CON SATÉLITE...</div>
});

export default function ConfigMaestraPage() {
  const [config, setConfig] = useState<any>({});
  const [configOriginal, setConfigOriginal] = useState<any>({});
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
        // Reducimos el array a un objeto llave:valor (todo viene como texto)
        const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        
        // Aseguramos que existan valores por defecto si la tabla está vacía
        const finalData = {
          gps_latitud: cfgMap.gps_latitud || "0",
          gps_longitud: cfgMap.gps_longitud || "0",
          gps_radio: cfgMap.gps_radio || "80",
          qr_expiracion: cfgMap.qr_expiracion || "60000",
          timer_inactividad: cfgMap.timer_inactividad || "120000",
          empresa_nombre: cfgMap.empresa_nombre || "SISTEMA"
        };

        setConfig(finalData);
        setConfigOriginal({...finalData});
      }
    } catch (err) {
      console.error("Error al leer sistema_config:", err);
    } finally {
      setLoading(false);
    }
  };

  // Rutinas de Conversión
  const msAMinutos = (ms: string) => Math.floor(parseInt(ms || '0') / 60000);
  const minutosAMs = (min: string) => (parseInt(min || '0') * 60000).toString();

  const guardarModulo = async (claves: string[]) => {
    setGuardando(true);
    try {
      for (const clave of claves) {
        // Rutina de actualización: enviamos SIEMPRE como string
        const { error } = await supabase
          .from('sistema_config')
          .update({ valor: String(config[clave]) }) 
          .eq('clave', clave);
        
        if (error) throw error;
      }
      
      // Actualizamos el respaldo local
      const nuevoRespaldo = { ...configOriginal };
      claves.forEach(c => nuevoRespaldo[c] = config[c]);
      setConfigOriginal(nuevoRespaldo);
      alert("✅ BASE DE DATOS ACTUALIZADA CON ÉXITO");
    } catch (err: any) {
      alert("❌ ERROR AL GUARDAR: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const cancelarModulo = (claves: string[]) => {
    const restaurado = { ...config };
    claves.forEach(c => restaurado[c] = configOriginal[c]);
    setConfig(restaurado);
  };

  if (loading) return <div className="min-h-screen bg-[#050a14] flex items-center justify-center font-black text-red-500 italic uppercase">Cargando Parámetros...</div>;

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
          <h1 className="text-2xl font-black italic uppercase italic tracking-tighter">CONFIGURACIÓN <span className="text-red-600">MAESTRA</span></h1>
          <button onClick={() => router.back()} className="bg-slate-800 px-6 py-2 rounded-xl text-[10px] font-black uppercase border border-white/5">Cerrar</button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* MENÚ DE SECCIONES */}
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

          {/* ÁREA DE TRABAJO */}
          <div className="md:col-span-9 bg-[#0f172a] rounded-[45px] border border-white/5 p-10 shadow-2xl flex flex-col min-h-[600px]">
            
            <div className="flex-1">
              {/* MODULO 1: GPS */}
              {tabActual === 'geolocalizacion' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#050a14] p-4 rounded-2xl border border-white/5">
                      <p className="text-[8px] text-slate-500 font-black mb-1">LATITUD (DB TEXTO)</p>
                      <p className="font-mono text-xs text-blue-400">{config.gps_latitud}</p>
                    </div>
                    <div className="bg-[#050a14] p-4 rounded-2xl border border-white/5">
                      <p className="text-[8px] text-slate-500 font-black mb-1">LONGITUD (DB TEXTO)</p>
                      <p className="font-mono text-xs text-blue-400">{config.gps_longitud}</p>
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
                    <label className="text-[9px] font-black text-blue-500 uppercase block mb-3">Radio de Geocerca: {config.gps_radio}m</label>
                    <input type="range" min="10" max="500" value={config.gps_radio} onChange={e => setConfig({...config, gps_radio: e.target.value})} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-blue-600" />
                  </div>
                </div>
              )}

              {/* MODULO 2: SEGURIDAD */}
              {tabActual === 'seguridad' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                  <div className="bg-[#050a14] p-8 rounded-[35px] border border-white/5">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-4 tracking-widest">Expiración QR (Minutos)</p>
                    <div className="flex items-end gap-2">
                      <input type="number" value={msAMinutos(config.qr_expiracion)} onChange={e => setConfig({...config, qr_expiracion: minutosAMs(e.target.value)})} className="bg-transparent text-5xl font-black text-emerald-500 outline-none w-32 tracking-tighter" />
                      <span className="text-xs font-black text-slate-400 mb-2 italic uppercase">Min</span>
                    </div>
                    <p className="text-[8px] text-slate-700 font-mono mt-4">Valor en texto: {config.qr_expiracion}ms</p>
                  </div>
                  <div className="bg-[#050a14] p-8 rounded-[35px] border border-white/5">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-4 tracking-widest">Inactividad (Minutos)</p>
                    <div className="flex items-end gap-2">
                      <input type="number" value={msAMinutos(config.timer_inactividad)} onChange={e => setConfig({...config, timer_inactividad: minutosAMs(e.target.value)})} className="bg-transparent text-5xl font-black text-emerald-500 outline-none w-32 tracking-tighter" />
                      <span className="text-xs font-black text-slate-400 mb-2 italic uppercase">Min</span>
                    </div>
                    <p className="text-[8px] text-slate-700 font-mono mt-4">Valor en texto: {config.timer_inactividad}ms</p>
                  </div>
                </div>
              )}

              {/* MODULO 3: INTERFAZ */}
              {tabActual === 'interfaz' && (
                <div className="bg-[#050a14] p-10 rounded-[40px] border border-white/5 animate-in fade-in">
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-4 tracking-widest">Nombre del Sistema</label>
                  <input type="text" value={config.empresa_nombre || ''} onChange={e => setConfig({...config, empresa_nombre: e.target.value})} className="bg-transparent text-4xl font-black text-white w-full outline-none uppercase italic border-b border-white/10 pb-4" />
                </div>
              )}
            </div>

            {/* BARRA DE ACCIONES LOCALES */}
            <div className="mt-8 pt-8 border-t border-white/5 flex gap-4">
              <button 
                onClick={() => {
                  const m: any = { geolocalizacion: ['gps_latitud', 'gps_longitud', 'gps_radio'], seguridad: ['qr_expiracion', 'timer_inactividad'], interfaz: ['empresa_nombre'] };
                  guardarModulo(m[tabActual]);
                }}
                disabled={guardando}
                className="flex-1 bg-white text-black p-5 rounded-[22px] font-black text-[11px] uppercase italic transition-all hover:bg-blue-600 hover:text-white disabled:opacity-50"
              >
                {guardando ? 'GUARDANDO EN DB...' : `APLICAR CAMBIOS EN ${tabActual.toUpperCase()}`}
              </button>
              <button 
                onClick={() => {
                  const m: any = { geolocalizacion: ['gps_latitud', 'gps_longitud', 'gps_radio'], seguridad: ['qr_expiracion', 'timer_inactividad'], interfaz: ['empresa_nombre'] };
                  cancelarModulo(m[tabActual]);
                }}
                className="px-8 bg-slate-800 text-slate-400 p-5 rounded-[22px] font-black text-[11px] uppercase border border-white/5 hover:text-white transition-all"
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