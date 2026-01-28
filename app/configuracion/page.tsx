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
        const transformado = data.reduce((acc: any, curr: any) => ({
          ...acc,
          [curr.clave]: curr.valor
        }), {});
        setConfig(transformado);
        setConfigOriginal(transformado);
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
    } finally {
      setLoading(false);
    }
  };

  const guardarModulo = async (claves: string[]) => {
    setGuardando(true);
    try {
      // Actualización paralela para asegurar persistencia
      const promesas = claves.map(clave => 
        supabase
          .from('sistema_config')
          .update({ valor: String(config[clave]) })
          .eq('clave', clave)
      );
      await Promise.all(promesas);

      const nuevoRespaldo = { ...configOriginal };
      claves.forEach(c => nuevoRespaldo[c] = config[c]);
      setConfigOriginal(nuevoRespaldo);
      alert("✅ SISTEMA SINCRONIZADO");
    } catch (error) {
      alert("❌ FALLO EN LA COMUNICACIÓN");
    } finally {
      setGuardando(false);
    }
  };

  const cancelarModulo = (claves: string[]) => {
    const restaurado = { ...config };
    claves.forEach(c => restaurado[c] = configOriginal[c]);
    setConfig(restaurado);
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-white font-black italic animate-bounce">CARGANDO SISTEMA CORE...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans selection:bg-blue-500">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER TÉCNICO ORIGINAL */}
        <header className="mb-12 flex justify-between items-end border-b border-white/10 pb-6">
          <div>
            <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-none">
              Config <span className="text-blue-600 text-6xl">.</span>
            </h1>
            <p className="text-slate-500 font-bold text-xs mt-2 uppercase tracking-[0.2em]">Panel de Control Maestro v1.0</p>
          </div>
          <button 
            onClick={() => router.back()}
            className="text-[10px] font-black uppercase border border-white/20 px-4 py-2 rounded-full hover:bg-white hover:text-black transition-all"
          >
            ← Volver
          </button>
        </header>

        <div className="grid grid-cols-12 gap-8">
          
          {/* NAVEGACIÓN LATERAL ORIGINAL */}
          <nav className="col-span-3 flex flex-col gap-2">
            {['geolocalizacion', 'seguridad', 'interfaz'].map((tab) => (
              <button
                key={tab}
                onClick={() => setTabActual(tab)}
                className={`p-4 rounded-[20px] text-left transition-all flex items-center gap-3 ${
                  tabActual === tab 
                  ? 'bg-blue-600 text-white shadow-[0_10px_30px_rgba(37,99,235,0.3)] scale-105' 
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${tabActual === tab ? 'bg-white animate-pulse' : 'bg-slate-600'}`}></div>
                <span className="font-black uppercase text-[11px] italic">{tab}</span>
              </button>
            ))}
          </nav>

          {/* ÁREA DE TRABAJO ORIGINAL */}
          <main className="col-span-9 bg-slate-900/50 rounded-[40px] border border-white/5 p-8 backdrop-blur-xl">
            
            <div className="min-h-[400px]">
              {tabActual === 'geolocalizacion' && (
                <div className="space-y-8 animate-in fade-in">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-3 italic">Coordenadas de Operación</label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-black/40 p-4 rounded-3xl border border-white/5">
                            <span className="text-[9px] text-blue-500 font-black block mb-1">LATITUD</span>
                            <input 
                              type="number" 
                              value={config.gps_latitud || ''} 
                              onChange={(e) => setConfig({...config, gps_latitud: e.target.value})}
                              className="bg-transparent text-xl font-black w-full outline-none"
                            />
                          </div>
                          <div className="bg-black/40 p-4 rounded-3xl border border-white/5">
                            <span className="text-[9px] text-blue-500 font-black block mb-1">LONGITUD</span>
                            <input 
                              type="number" 
                              value={config.gps_longitud || ''} 
                              onChange={(e) => setConfig({...config, gps_longitud: e.target.value})}
                              className="bg-transparent text-xl font-black w-full outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-3 italic">Radio de Acción (Metros)</label>
                        <div className="bg-black/40 p-6 rounded-3xl border border-white/5">
                          <input 
                            type="range" 
                            min="10" 
                            max="500" 
                            value={config.gps_radio || 50}
                            onChange={(e) => setConfig({...config, gps_radio: e.target.value})}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                          <div className="flex justify-between mt-4">
                            <span className="text-2xl font-black italic">{config.gps_radio}m</span>
                            <span className="text-[9px] font-bold text-slate-600 uppercase self-center">Precisión Militar</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="h-[350px] rounded-[30px] overflow-hidden border-4 border-white/5 shadow-2xl relative">
                      <MapaInteractivo 
                        lat={config.gps_latitud} 
                        lng={config.gps_longitud} 
                        onLocationChange={(lat: number, lng: number) => {
                          setConfig({...config, gps_latitud: lat.toFixed(6), gps_longitud: lng.toFixed(6)});
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {tabActual === 'seguridad' && (
                <div className="grid grid-cols-2 gap-6 animate-in fade-in">
                  <div className="bg-white/5 p-8 rounded-[35px] border border-white/5">
                    <span className="text-[10px] font-black text-blue-500 uppercase italic">Control de Acceso</span>
                    <h3 className="text-2xl font-black mt-2 mb-6 italic">EXPIRACIÓN QR</h3>
                    <div className="flex items-center gap-6">
                      <input 
                        type="number" 
                        value={config.qr_expiracion || ''}
                        onChange={(e) => setConfig({...config, qr_expiracion: e.target.value})}
                        className="bg-black/60 p-5 rounded-2xl text-3xl font-black w-32 border border-white/10 outline-none"
                      />
                      <span className="text-slate-500 font-bold uppercase text-xs italic">Valor en<br/>milisegundos</span>
                    </div>
                  </div>

                  <div className="bg-white/5 p-8 rounded-[35px] border border-white/5">
                    <span className="text-[10px] font-black text-red-500 uppercase italic">Gestión de Sesión</span>
                    <h3 className="text-2xl font-black mt-2 mb-6 italic">TIMEOUT IDLE</h3>
                    <div className="flex items-center gap-6">
                      <input 
                        type="number" 
                        value={config.timer_inactividad || ''}
                        onChange={(e) => setConfig({...config, timer_inactividad: e.target.value})}
                        className="bg-black/60 p-5 rounded-2xl text-3xl font-black w-32 border border-white/10 outline-none"
                      />
                      <span className="text-slate-500 font-bold uppercase text-xs italic">Valor en<br/>milisegundos</span>
                    </div>
                  </div>
                </div>
              )}

              {tabActual === 'interfaz' && (
                <div className="max-w-xl animate-in fade-in">
                  <div className="bg-white/5 p-8 rounded-[35px] border border-white/5">
                    <label className="text-[10px] font-black text-blue-500 uppercase italic block mb-4">Branding Corporativo</label>
                    <input 
                      type="text" 
                      value={config.empresa_nombre || ''}
                      onChange={(e) => setConfig({...config, empresa_nombre: e.target.value})}
                      className="bg-black/40 p-6 rounded-2xl text-2xl font-black w-full border border-white/10 outline-none focus:border-white transition-all italic uppercase"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* BOTONES ORIGINALES */}
            <div className="mt-8 pt-8 border-t border-white/5 flex gap-4">
              <button 
                onClick={() => {
                  const m: any = { 
                    geolocalizacion: ['gps_latitud', 'gps_longitud', 'gps_radio'], 
                    seguridad: ['qr_expiracion', 'timer_inactividad'], 
                    interfaz: ['empresa_nombre'] 
                  };
                  guardarModulo(m[tabActual]);
                }}
                disabled={guardando}
                className="flex-1 bg-white text-black p-5 rounded-[22px] font-black text-[11px] uppercase italic transition-all hover:bg-blue-600 hover:text-white disabled:opacity-50"
              >
                {guardando ? 'SINCRONIZANDO...' : `APLICAR CAMBIOS EN ${tabActual.toUpperCase()}`}
              </button>
              <button 
                onClick={() => {
                  const m: any = { 
                    geolocalizacion: ['gps_latitud', 'gps_longitud', 'gps_radio'], 
                    seguridad: ['qr_expiracion', 'timer_inactividad'], 
                    interfaz: ['empresa_nombre'] 
                  };
                  cancelarModulo(m[tabActual]);
                }}
                className="px-8 bg-slate-800 text-slate-400 p-5 rounded-[22px] font-black text-[11px] uppercase border border-white/5 hover:text-white transition-all"
              >
                Reset
              </button>
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}