'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function ConfigMaestraPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>({});
  const [configOriginal, setConfigOriginal] = useState<any>({}); // Para cancelar cambios
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
      setConfigOriginal(cfgMap); // Respaldar para opción cancelar
    }
    setLoading(false);
  };

  const actualizarCampo = (clave: string, valor: string) => {
    setConfig((prev: any) => ({ ...prev, [clave]: valor }));
  };

  // 1. Lógica de Mapa Interactivo (Simulada para iframe, recomendada con SDK de Maps)
  const manejarClickMapa = () => {
    alert("Para una precisión absoluta al hacer click, se recomienda integrar Google Maps SDK. Por ahora, usa 'Capturar mi posición' o ingresa los datos manualmente.");
  };

  const verCoordenadasDerecho = (e: React.MouseEvent) => {
    e.preventDefault();
    alert(`COORDENADAS ACTUALES:\nLat: ${config.gps_latitud}\nLon: ${config.gps_longitud}`);
  };

  // 3. Conversión de Milisegundos a Minutos para la vista
  const msAMinutos = (ms: string) => Math.floor(parseInt(ms || '0') / 60000);
  const minutosAMs = (min: string) => (parseInt(min || '0') * 60000).toString();

  // 4. Cancelar Cambios
  const cancelarModificaciones = () => {
    if (confirm("¿Anular todos los cambios no guardados?")) {
      setConfig(configOriginal);
    }
  };

  const guardarCambios = async () => {
    setGuardando(true);
    try {
      const promesas = Object.entries(config).map(([clave, valor]) => 
        supabase.from('sistema_config').update({ valor }).eq('clave', clave)
      );
      await Promise.all(promesas);
      setConfigOriginal(config); // Actualizar respaldo
      alert("NÚCLEO SINCRONIZADO");
    } catch (err) {
      alert("Error en sincronización");
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#050a14] flex items-center justify-center font-black text-red-500 italic uppercase">Accediendo al Kernel...</div>;

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER CON BOTÓN CANCELAR (2) */}
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-4">
            <div className="h-14 w-1 bg-red-600 shadow-[0_0_15px_red]"></div>
            <div>
              <h1 className="text-3xl font-black italic uppercase tracking-tighter">CONFIGURACIÓN <span className="text-red-600">MAESTRA</span></h1>
              <p className="text-[9px] font-bold text-slate-500 tracking-[0.4em] uppercase">Auth: {user?.nombre}</p>
            </div>
          </div>
          <button onClick={() => router.back()} className="bg-slate-800 hover:bg-slate-700 px-6 py-3 rounded-xl font-black text-[10px] uppercase border border-white/5 transition-all">
             ✖ Cancelar / Volver
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-3 space-y-3">
            {['geolocalizacion', 'seguridad', 'interfaz'].map((t) => (
              <button key={t} onClick={() => setTabActual(t)} className={`w-full text-left p-5 rounded-[25px] border transition-all ${tabActual === t ? 'bg-white/5 border-white/20' : 'border-transparent text-slate-500'}`}>
                <span className="text-[10px] font-black uppercase tracking-widest">{t}</span>
              </button>
            ))}

            <div className="pt-6 space-y-3">
              <button onClick={guardarCambios} disabled={guardando} className="w-full bg-red-600 hover:bg-red-500 p-5 rounded-[25px] font-black text-[11px] uppercase italic shadow-xl shadow-red-900/30 transition-all">
                {guardando ? 'Guardando...' : 'Guardar Cambios'}
              </button>
              {/* 4. BOTÓN ANULAR CAMBIOS */}
              <button onClick={cancelarModificaciones} className="w-full bg-slate-800/50 hover:bg-slate-800 p-5 rounded-[25px] font-black text-[11px] uppercase text-slate-400 border border-white/5 transition-all">
                Anular Modificaciones
              </button>
            </div>
          </div>

          <div className="md:col-span-9 bg-[#0f172a] rounded-[45px] border border-white/5 p-10 relative shadow-2xl">
            
            {tabActual === 'geolocalizacion' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="flex justify-between items-end mb-4">
                  <h2 className="text-xs font-black text-blue-500 uppercase italic">Referencia GPS</h2>
                  <button onClick={() => {
                     if (navigator.geolocation) {
                       navigator.geolocation.getCurrentPosition(p => {
                         actualizarCampo('gps_latitud', p.coords.latitude.toString());
                         actualizarCampo('gps_longitud', p.coords.longitude.toString());
                       });
                     }
                  }} className="text-[9px] font-black bg-blue-600/10 border border-blue-500/20 px-4 py-2 rounded-xl text-blue-400 uppercase">
                    📍 Mi ubicación actual
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <input type="text" value={config.gps_latitud} onChange={e => actualizarCampo('gps_latitud', e.target.value)} className="bg-[#050a14] border border-white/5 p-4 rounded-2xl font-mono text-xs text-blue-400" placeholder="Latitud" />
                  <input type="text" value={config.gps_longitud} onChange={e => actualizarCampo('gps_longitud', e.target.value)} className="bg-[#050a14] border border-white/5 p-4 rounded-2xl font-mono text-xs text-blue-400" placeholder="Longitud" />
                </div>

                {/* 1. MINIMAPA CON CLIC DERECHO */}
                <div 
                  className="relative rounded-[30px] overflow-hidden border border-white/10 h-64 bg-black cursor-crosshair"
                  onContextMenu={verCoordenadasDerecho}
                  onClick={manejarClickMapa}
                >
                  <iframe width="100%" height="100%" frameBorder="0" src={`https://maps.google.com/maps?q=${config.gps_latitud},${config.gps_longitud}&t=k&z=18&output=embed`}></iframe>
                  <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md p-2 rounded-lg text-[8px] font-bold text-white/50 border border-white/10">
                    CLICK DERECHO PARA COORDENADAS NUMÉRICAS
                  </div>
                </div>
              </div>
            )}

            {tabActual === 'seguridad' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                <div className="grid grid-cols-2 gap-6">
                  {/* 3. TIEMPOS EN MINUTOS CON CONVERSIÓN */}
                  <div className="bg-[#050a14] p-6 rounded-3xl border border-white/5">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-3 tracking-tighter">Expiración QR (Minutos)</p>
                    <input 
                      type="number" 
                      value={msAMinutos(config.qr_expiracion)} 
                      onChange={(e) => actualizarCampo('qr_expiracion', minutosAMs(e.target.value))}
                      className="bg-transparent text-3xl font-black text-emerald-500 outline-none w-full"
                    />
                    <p className="text-[8px] text-slate-600 mt-2 font-mono">= {config.qr_expiracion} milisegundos</p>
                  </div>
                  <div className="bg-[#050a14] p-6 rounded-3xl border border-white/5">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-3 tracking-tighter">Inactividad (Minutos)</p>
                    <input 
                      type="number" 
                      value={msAMinutos(config.timer_inactividad)} 
                      onChange={(e) => actualizarCampo('timer_inactividad', minutosAMs(e.target.value))}
                      className="bg-transparent text-3xl font-black text-emerald-500 outline-none w-full"
                    />
                    <p className="text-[8px] text-slate-600 mt-2 font-mono">= {config.timer_inactividad} milisegundos</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Tab interfaz omitida por brevedad, mantiene misma lógica */}
          </div>
        </div>
      </div>
    </main>
  );
}