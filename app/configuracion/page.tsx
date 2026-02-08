'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const MapaInteractivo = dynamic(() => import('./MapaInteractivo'), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#020617] flex items-center justify-center text-blue-500 font-black italic uppercase tracking-widest animate-pulse">Sincronizando Mapa...</div>
});

export default function ConfigMaestraPage() {
  const [config, setConfig] = useState<any>(null); 
  const [loading, setLoading] = useState(true);
  const [tabActual, setTabActual] = useState('geolocalizacion');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'success' | 'error' | null }>({ texto: '', tipo: null });
  const router = useRouter();

  // Generadores de rangos para selectores
  const rango100 = Array.from({ length: 100 }, (_, i) => i + 1);
  const rango24 = Array.from({ length: 24 }, (_, i) => i + 1);
  const rango60 = Array.from({ length: 60 }, (_, i) => i + 1);

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
        
        setConfig({
          almacen_lat: cfgMap.almacen_lat || cfgMap.gps_latitud || "0",
          almacen_lon: cfgMap.almacen_lon || cfgMap.gps_longitud || "0",
          radio_maximo: cfgMap.radio_maximo || "100",
          timer_token: cfgMap.timer_token || "60000",
          timer_inactividad: cfgMap.timer_inactividad || "300000",
          empresa_nombre: cfgMap.empresa_nombre || "SISTEMA",
          maximo_labor: cfgMap.maximo_labor || "28800000" 
        });
      }
    } catch (err) {
      showNotification("ERROR DE SINCRONIZACIÓN", 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (texto: string, tipo: 'success' | 'error') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: '', tipo: null }), 3000);
  };

  // --- LÓGICA DE CONVERSIÓN QUIRÚRGICA ---
  const msAMinutos = (ms: string) => Math.floor(parseInt(ms || '0') / 60000).toString();
  const minutosAMs = (min: string) => (parseInt(min || '0') * 60000).toString();
  
  const msAHoras = (ms: string) => Math.floor(parseInt(ms || '0') / 3600000).toString();
  const horasAMs = (hrs: string) => (parseInt(hrs || '0') * 3600000).toString();

  const guardarModulo = async (claves: string[]) => {
    setGuardando(true);
    try {
      const updates = claves.map(clave => ({
        clave,
        valor: config[clave]?.toString() || "",
        updated_at: new Date().toISOString()
      }));

      for (const update of updates) {
        const { error } = await supabase.from('sistema_config').upsert(update, { onConflict: 'clave' });
        if (error) throw error;
      }
      showNotification(`MÓDULO ${tabActual.toUpperCase()} ACTUALIZADO`, 'success');
    } catch (err) {
      showNotification("ERROR DE ESCRITURA", 'error');
    } finally {
      setGuardando(false);
    }
  };

  if (loading || !config) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center text-blue-500 font-black italic tracking-widest animate-pulse">
      CONFIGURACIÓN MAESTRA...
    </div>
  );

  return (
    <main className="min-h-screen bg-[#020617] p-4 md:p-8 text-slate-300 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* MEMBRETE */}
        <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter">
              CONFIGURACIÓN <span className="text-blue-500">MAESTRA</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Parámetros de Auditoría y Control de Red</p>
          </div>
          <div className="flex gap-3">
             {mensaje.tipo && (
                <span className={`text-[10px] font-black px-4 py-2 rounded-lg border animate-pulse ${
                    mensaje.tipo === 'success' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}>
                    {mensaje.texto}
                </span>
             )}
             <button onClick={() => router.push('/reportes')} className="bg-slate-800 hover:bg-slate-700 px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all">Regresar</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* NAVEGACIÓN */}
          <div className="md:col-span-3 space-y-2">
            {[
              { id: 'geolocalizacion', label: '📍 GEOCERCA GPS' },
              { id: 'seguridad', label: '🛡️ PARÁMETROS DE\nTIEMPO' },
              { id: 'laboral', label: '⏱️ TIEMPO MÁXIMO\nLABORABLE' },
              { id: 'interfaz', label: '🖥️ INTERFAZ' }
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setTabActual(tab.id)}
                className={`w-full text-left p-6 rounded-[25px] border transition-all duration-300 ${
                  tabActual === tab.id ? 'bg-white/5 border-white/20 shadow-lg text-white' : 'border-transparent text-slate-500 hover:text-white'
                }`}
              >
                <span className="text-[10px] font-black uppercase tracking-widest leading-relaxed whitespace-pre-line">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* PANEL CENTRAL */}
          <div className="md:col-span-9 bg-[#0f172a] rounded-[45px] border border-white/5 p-8 md:p-12 shadow-2xl flex flex-col min-h-[600px]">
            
            <div className="flex-1">
              {/* GEOCERCA */}
              {tabActual === 'geolocalizacion' && (
                <div className="h-full flex flex-col animate-in fade-in">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-[#020617] p-6 rounded-[30px] border border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-3 tracking-widest">Rango de Tolerancia (Metros)</p>
                      <select 
                        value={config.radio_maximo} 
                        onChange={e => setConfig({...config, radio_maximo: e.target.value})}
                        className="bg-transparent text-3xl font-black text-white w-full outline-none appearance-none cursor-pointer"
                      >
                        {rango100.map(v => <option key={v} value={v} className="bg-[#0f172a] text-lg font-sans">{v} m</option>)}
                      </select>
                    </div>
                    <div className="bg-[#020617] p-6 rounded-[30px] border border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-3 tracking-widest">Coordenadas Reales</p>
                      <div className="space-y-1">
                        <p className="text-[10px] font-mono text-blue-500 leading-none truncate">LAT: {config.almacen_lat}</p>
                        <p className="text-[10px] font-mono text-emerald-500 leading-none truncate">LON: {config.almacen_lon}</p>
                      </div>
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

              {/* TIEMPOS RED */}
              {tabActual === 'seguridad' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4">
                  <div className="bg-[#020617] p-8 rounded-[40px] border border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase block mb-4 tracking-widest">Expiración Token QR (Minutos)</p>
                    <select 
                      value={msAMinutos(config.timer_token)} 
                      onChange={e => setConfig({...config, timer_token: minutosAMs(e.target.value)})}
                      className="bg-transparent text-5xl font-black text-white w-full outline-none appearance-none cursor-pointer"
                    >
                      {rango60.map(v => <option key={v} value={v} className="bg-[#0f172a] text-lg font-sans">{v} MIN</option>)}
                    </select>
                  </div>
                  <div className="bg-[#020617] p-8 rounded-[40px] border border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase block mb-4 tracking-widest">Timeout Inactividad (Minutos)</p>
                    <select 
                      value={msAMinutos(config.timer_inactividad)} 
                      onChange={e => setConfig({...config, timer_inactividad: minutosAMs(e.target.value)})}
                      className="bg-transparent text-5xl font-black text-white w-full outline-none appearance-none cursor-pointer"
                    >
                      {rango60.map(v => <option key={v} value={v} className="bg-[#0f172a] text-lg font-sans">{v} MIN</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* LABORAL */}
              {tabActual === 'laboral' && (
                <div className="animate-in fade-in space-y-8">
                  <div className="bg-[#020617] p-12 rounded-[45px] border border-white/5 text-center">
                    <p className="text-[12px] font-black text-slate-500 uppercase mb-8 tracking-[0.4em]">Tope Máximo de Jornada LABORAL</p>
                    <div className="flex items-center justify-center gap-6">
                        <select 
                          value={msAHoras(config.maximo_labor)} 
                          onChange={e => setConfig({...config, maximo_labor: horasAMs(e.target.value)})}
                          className="bg-transparent text-8xl font-black text-blue-500 outline-none appearance-none cursor-pointer italic text-center"
                        >
                          {rango24.map(v => <option key={v} value={v} className="bg-[#0f172a] text-2xl font-sans">{v}</option>)}
                        </select>
                        <span className="text-3xl font-black text-slate-800 uppercase italic">HRS</span>
                    </div>
                  </div>
                  <div className="bg-blue-500/5 p-8 rounded-[30px] border border-blue-500/10 space-y-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed text-center italic">
                      "El tiempo seleccionado en esta opción solo servirá para dar alertas en los temporizadores del sistema y reportes que están llegando al tope de las horas laborables fijadas acá"
                    </p>
                    <div className="h-px bg-white/5 w-1/2 mx-auto"></div>
                    <p className="text-[9px] font-black text-blue-900/40 uppercase text-center tracking-[0.2em]">Nota de Protocolo de Auditoría</p>
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
                {guardando ? 'ACTUALIZANDO REGISTRO...' : `CONFIRMAR PARÁMETROS EN ${tabActual.toUpperCase()}`}
              </button>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}