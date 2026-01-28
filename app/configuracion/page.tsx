'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const MapaInteractivo = dynamic(() => import('./MapaInteractivo'), { ssr: false });

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
    setLoading(true);
    const { data, error } = await supabase.from('sistema_config').select('*');
    if (error) {
      console.error("Error cargando config:", error);
    } else if (data) {
      const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
      // Aseguramos que los valores existan para evitar errores de undefined en inputs
      const defaults = {
        gps_latitud: '0',
        gps_longitud: '0',
        gps_radio: '80',
        qr_expiracion: '60000',
        timer_inactividad: '120000',
        empresa_nombre: 'SISTEMA'
      };
      const finalConfig = { ...defaults, ...cfgMap };
      setConfig(finalConfig);
      setConfigOriginal({ ...finalConfig });
    }
    setLoading(false);
  };

  const actualizarCampo = (clave: string, valor: string) => {
    setConfig((prev: any) => ({ ...prev, [clave]: valor }));
  };

  const guardarModulo = async (claves: string[]) => {
    setGuardando(true);
    try {
      // Ejecutamos los updates uno por uno para asegurar escritura
      for (const clave of claves) {
        const { error } = await supabase
          .from('sistema_config')
          .update({ valor: String(config[clave]) })
          .eq('clave', clave);
        
        if (error) throw error;
      }
      
      // Actualizar respaldo local
      const nuevoRespaldo = { ...configOriginal };
      claves.forEach(c => nuevoRespaldo[c] = config[c]);
      setConfigOriginal(nuevoRespaldo);
      
      alert("✅ BASE DE DATOS ACTUALIZADA");
    } catch (err: any) {
      alert("❌ ERROR AL ESCRIBIR: " + err.message);
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

  if (loading) return <div className="min-h-screen bg-[#050a14] flex items-center justify-center text-red-600 font-black italic animate-pulse uppercase tracking-widest">Sincronizando Kernel...</div>;

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-4">
            <div className="h-12 w-1 bg-red-600 shadow-[0_0_15px_red]"></div>
            <h1 className="text-2xl font-black italic uppercase italic">Configuración <span className="text-red-600">Maestra</span></h1>
          </div>
          <button onClick={() => router.back()} className="bg-slate-800 px-6 py-3 rounded-2xl font-black text-[10px] uppercase border border-white/5 hover:bg-red-600 transition-all">Cancelar y Salir</button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* SIDEBAR */}
          <div className="md:col-span-3 space-y-2">
            {[
              { id: 'geolocalizacion', label: '📡 Geocerca GPS' },
              { id: 'seguridad', label: '🛡️ Tiempos de Red' },
              { id: 'interfaz', label: '🖥️ Interfaz' }
            ].map((tab) => (
              <button key={tab.id} onClick={() => setTabActual(tab.id)} className={`w-full text-left p-6 rounded-[25px] border transition-all ${tabActual === tab.id ? 'bg-white/5 border-white/20' : 'border-transparent text-slate-500'}`}>
                <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* CONTENT */}
          <div className="md:col-span-9 bg-[#0f172a] rounded-[45px] border border-white/5 p-10 shadow-2xl min-h-[600px] flex flex-col">
            <div className="flex-1">
              {tabActual === 'geolocalizacion' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#050a14] p-4 rounded-2xl border border-white/5">
                      <p className="text-[8px] text-slate-500 font-black mb-1">LATITUD EN TABLA</p>
                      <input type="text" value={config.gps_latitud} readOnly className="w-full bg-transparent font-mono text-xs text-blue-400 outline-none" />
                    </div>
                    <div className="bg-[#050a14] p-4 rounded-2xl border border-white/5">
                      <p className="text-[8px] text-slate-500 font-black mb-1">LONGITUD EN TABLA</p>
                      <input type="text" value={config.gps_longitud} readOnly className="w-full bg-transparent font-mono text-xs text-blue-400 outline-none" />
                    </div>
                  </div>
                  <div className="h-[350px] rounded-[35px] overflow-hidden border border-white/10 relative">
                    <MapaInteractivo 
                      lat={parseFloat(config.gps_latitud)} 
                      lng={parseFloat(config.gps_longitud)}
                      onLocationChange={(lat, lng) => {
                        actualizarCampo('gps_latitud', lat.toString());
                        actualizarCampo('gps_longitud', lng.toString());
                      }}
                    />
                  </div>
                  <div className="bg-[#050a14] p-6 rounded-3xl border border-white/5">
                    <label className="text-[9px] font-black text-blue-500 uppercase block mb-3">Radio de Geocerca: {config.gps_radio}m</label>
                    <input type="range" min="10" max="500" value={config.gps_radio} onChange={e => actualizarCampo('gps_radio', e.target.value)} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-blue-600" />
                  </div>
                </div>
              )}

              {tabActual === 'seguridad' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#050a14] p-10 rounded-[40px] border border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-4">Expiración QR (Minutos)</p>
                      <input type="number" value={msAMinutos(config.qr_expiracion)} onChange={e => actualizarCampo('qr_expiracion', minutosAMs(e.target.value))} className="bg-transparent text-5xl font-black text-emerald-500 outline-none w-full" />
                      <p className="text-[8px] text-slate-600 mt-4 font-mono">Valor real: {config.qr_expiracion} ms</p>
                    </div>
                    <div className="bg-[#050a14] p-10 rounded-[40px] border border-white/5">
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-4">Inactividad (Minutos)</p>
                      <input type="number" value={msAMinutos(config.timer_inactividad)} onChange={e => actualizarCampo('timer_inactividad', minutosAMs(e.target.value))} className="bg-transparent text-5xl font-black text-emerald-500 outline-none w-full" />
                      <p className="text-[8px] text-slate-600 mt-4 font-mono">Valor real: {config.timer_inactividad} ms</p>
                    </div>
                  </div>
                </div>
              )}

              {tabActual === 'interfaz' && (
                <div className="animate-in fade-in duration-300">
                  <div className="bg-[#050a14] p-10 rounded-[40px] border border-white/5">
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-4">Nombre de la Empresa</label>
                    <input type="text" value={config.empresa_nombre} onChange={e => actualizarCampo('empresa_nombre', e.target.value)} className="bg-transparent text-4xl font-black text-white w-full outline-none uppercase italic" />
                  </div>
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
                className="flex-1 bg-white text-black p-5 rounded-[22px] font-black text-[11px] uppercase italic hover:bg-blue-500 hover:text-white transition-all disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : `Aplicar Cambios en ${tabActual}`}
              </button>
              <button 
                onClick={() => {
                  const map: any = { geolocalizacion: ['gps_latitud', 'gps_longitud', 'gps_radio'], seguridad: ['qr_expiracion', 'timer_inactividad'], interfaz: ['empresa_nombre'] };
                  cancelarModulo(map[tabActual]);
                }}
                className="px-8 bg-slate-800 text-slate-400 p-5 rounded-[22px] font-black text-[11px] uppercase border border-white/5 hover:bg-slate-700 transition-all"
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