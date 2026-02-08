'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const MapaInteractivo = dynamic(() => import('./MapaInteractivo'), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#050a14] flex items-center justify-center text-blue-500 font-black italic uppercase tracking-widest animate-pulse">Sincronizando Mapa...</div>
});

export default function ConfigMaestraPage() {
  const [config, setConfig] = useState<any>(null); 
  const [configOriginal, setConfigOriginal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tabActual, setTabActual] = useState('geolocalizacion');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'success' | 'error' | null }>({ texto: '', tipo: null });
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
        
        const finalData = {
          almacen_lat: cfgMap.almacen_lat || cfgMap.gps_latitud || "0",
          almacen_lon: cfgMap.almacen_lon || cfgMap.gps_longitud || "0",
          radio_maximo: cfgMap.radio_maximo || cfgMap.gps_radio || "100",
          timer_token: cfgMap.timer_token || cfgMap.qr_expiracion || "60000",
          timer_inactividad: cfgMap.timer_inactividad || "300000",
          empresa_nombre: cfgMap.empresa_nombre || "SISTEMA",
          maximo_labor: cfgMap.maximo_labor || "28800000" 
        };

        setConfig(finalData);
        setConfigOriginal({...finalData});
      }
    } catch (err) {
      console.error("Error Core:", err);
      showNotification("ERROR DE SINCRONIZACIÓN", 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (texto: string, tipo: 'success' | 'error') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: '', tipo: null }), 3000);
  };

  // --- LOGICA DE CONVERSIÓN TEXTO <-> NUMÉRICO ---
  const msAHoras = (msValue: string) => {
    const num = parseFloat(msValue || '0');
    return (num / 3600000).toString();
  };

  const horasAMs = (hrsValue: string) => {
    const num = parseFloat(hrsValue || '0');
    return Math.floor(num * 3600000).toString(); 
  };

  const guardarModulo = async (claves: string[]) => {
    setGuardando(true);
    try {
      const updates = claves.map(clave => ({
        clave,
        valor: config[clave]?.toString() || "",
        updated_at: new Date().toISOString()
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('sistema_config')
          .upsert(update, { onConflict: 'clave' });
        if (error) throw error;
      }

      setConfigOriginal({...config});
      showNotification(`MÓDULO ${tabActual.toUpperCase()} ACTUALIZADO`, 'success');
    } catch (err) {
      showNotification("ERROR AL ESCRIBIR EN TABLA", 'error');
    } finally {
      setGuardando(false);
    }
  };

  if (loading || !config) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center text-blue-500 font-black italic tracking-widest animate-pulse">
      CONFIGURACIÓN INTELIGENTE...
    </div>
  );

  return (
    <main className="min-h-screen bg-[#020617] p-4 md:p-8 text-slate-300 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* MEMBRETE ESTANDARIZADO */}
        <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter">
              CONFIGURACIÓN <span className="text-blue-500">MAESTRA</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Gestión de Parámetros Globales del Sistema</p>
          </div>
          <div className="flex gap-3">
             {mensaje.tipo && (
                <span className={`text-[10px] font-black px-4 py-2 rounded-lg border animate-fade-in ${
                    mensaje.tipo === 'success' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}>
                    {mensaje.texto}
                </span>
             )}
             <button onClick={() => router.push('/reportes')} className="bg-slate-800 hover:bg-slate-700 px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all">Regresar</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* NAVEGACIÓN LATERAL */}
          <div className="md:col-span-3 space-y-2">
            {[
              { id: 'geolocalizacion', label: '📡 GEOCERCA GPS' },
              { id: 'seguridad', label: '🛡️ TIEMPOS RED' },
              { id: 'laboral', label: '⏱️ TIEMPO MÁXIMO\nLABORABLE' },
              { id: 'interfaz', label: '🖥️ INTERFAZ' }
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setTabActual(tab.id)}
                className={`w-full text-left p-6 rounded-[25px] border transition-all duration-300 ${
                  tabActual === tab.id 
                  ? 'bg-white/5 border-white/20 shadow-lg text-white' 
                  : 'border-transparent text-slate-500 hover:text-white'
                }`}
              >
                <span className="text-[10px] font-black uppercase tracking-widest leading-relaxed whitespace-pre-line">
                  {tab.label}
                </span>
              </button>
            ))}
          </div>

          {/* ÁREA DE TRABAJO */}
          <div className="md:col-span-9 bg-[#0f172a] rounded-[45px] border border-white/5 p-8 md:p-12 shadow-2xl flex flex-col min-h-[600px]">
            
            <div className="flex-1">
              {/* GEOLOCALIZACION */}
              {tabActual === 'geolocalizacion' && (
                <div className="h-full flex flex-col animate-in fade-in">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-[#020617] p-6 rounded-[30px] border border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">Radio de Tolerancia (m)</p>
                      <input type="number" value={config.radio_maximo} onChange={e => setConfig({...config, radio_maximo: e.target.value})} className="bg-transparent text-3xl font-black text-white w-full outline-none" />
                    </div>
                    <div className="bg-[#020617] p-6 rounded-[30px] border border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">Ubicación Actual</p>
                      <p className="text-[11px] font-mono text-blue-500 font-bold">{parseFloat(config.almacen_lat).toFixed(5)}, {parseFloat(config.almacen_lon).toFixed(5)}</p>
                    </div>
                  </div>
                  <div className="flex-1 rounded-[35px] overflow-hidden border border-white/10 min-h-[350px]">
                    <MapaInteractivo 
                      lat={config.almacen_lat} 
                      lng={config.almacen_lon} 
                      onLocationChange={(lat: number, lng: number) => setConfig({...config, almacen_lat: lat.toString(), almacen_lon: lng.toString()})}
                    />
                  </div>
                </div>
              )}

              {/* SEGURIDAD */}
              {tabActual === 'seguridad' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4">
                  <div className="bg-[#020617] p-8 rounded-[40px] border border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase block mb-4 tracking-widest">Expiración Token QR (ms)</p>
                    <input type="number" value={config.timer_token} onChange={e => setConfig({...config, timer_token: e.target.value})} className="bg-transparent text-5xl font-black text-white w-full outline-none font-mono" />
                  </div>
                  <div className="bg-[#020617] p-8 rounded-[40px] border border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase block mb-4 tracking-widest">Timeout Inactividad (ms)</p>
                    <input type="number" value={config.timer_inactividad} onChange={e => setConfig({...config, timer_inactividad: e.target.value})} className="bg-transparent text-5xl font-black text-white w-full outline-none font-mono" />
                  </div>
                </div>
              )}

              {/* LABORAL */}
              {tabActual === 'laboral' && (
                <div className="animate-in fade-in space-y-8">
                  <div className="bg-[#020617] p-12 rounded-[45px] border border-white/5 text-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase mb-8 tracking-[0.4em]">Tope Máximo de Jornada Diaria</p>
                    <div className="flex items-center justify-center gap-6">
                        <input 
                            type="number" 
                            step="0.1"
                            value={msAHoras(config.maximo_labor)} 
                            onChange={e => setConfig({...config, maximo_labor: horasAMs(e.target.value)})} 
                            className="bg-transparent text-8xl font-black text-blue-500 outline-none w-56 text-center italic" 
                        />
                        <span className="text-3xl font-black text-slate-800 uppercase italic">HRS</span>
                    </div>
                  </div>
                  <div className="bg-blue-500/5 p-8 rounded-[30px] border border-blue-500/10">
                    <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed text-center">
                      Este parámetro fuerza el cierre de sesión laboral al cumplirse el tiempo estipulado, eliminando el riesgo de horas extraordinarias no autorizadas.
                    </p>
                  </div>
                </div>
              )}

              {/* INTERFAZ */}
              {tabActual === 'interfaz' && (
                <div className="bg-[#020617] p-10 rounded-[40px] border border-white/5 animate-in fade-in">
                  <p className="text-[10px] font-black text-slate-500 uppercase block mb-4 tracking-widest">Identidad del Sistema</p>
                  <input 
                    type="text" 
                    value={config.empresa_nombre || ''} 
                    onChange={e => setConfig({...config, empresa_nombre: e.target.value})} 
                    className="bg-transparent text-4xl font-black text-white w-full outline-none uppercase italic border-b border-white/10 pb-4 focus:border-blue-500 transition-colors" 
                  />
                </div>
              )}
            </div>

            {/* ACCIÓN */}
            <div className="mt-8 pt-8 border-t border-white/5">
              <button 
                onClick={() => {
                  const m: any = { 
                    geolocalizacion: ['almacen_lat', 'almacen_lon', 'radio_maximo'], 
                    seguridad: ['timer_token', 'timer_inactividad'], 
                    laboral: ['maximo_labor'],
                    interfaz: ['empresa_nombre'] 
                  };
                  guardarModulo(m[tabActual]);
                }}
                disabled={guardando}
                className="w-full bg-white text-black p-6 rounded-[25px] font-black text-[12px] uppercase italic transition-all hover:bg-blue-600 hover:text-white disabled:opacity-50 shadow-xl"
              >
                {guardando ? 'ACTUALIZANDO REGISTRO...' : `APLICAR CAMBIOS EN ${tabActual.toUpperCase()}`}
              </button>
            </div>

          </div>
        </div>
      </div>

      <style jsx global>{`
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </main>
  );
}