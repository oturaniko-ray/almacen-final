'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// Carga dinámica del mapa para evitar errores de servidor
const MapaInteractivo = dynamic(() => import('./MapaInteractivo'), { 
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-[#050a14] flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[10px] font-black uppercase text-blue-500 italic">Sincronizando Satélite...</p>
    </div>
  )
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

  // Conversión: MS a MIN y viceversa
  const msAMinutos = (ms: string) => Math.floor(parseInt(ms || '0') / 60000);
  const minutosAMs = (min: string) => (parseInt(min || '0') * 60000).toString();

  const guardarCambios = async () => {
    setGuardando(true);
    try {
      const promesas = Object.entries(config).map(([clave, valor]) => 
        supabase.from('sistema_config').update({ valor }).eq('clave', clave)
      );
      await Promise.all(promesas);
      setConfigOriginal({ ...config });
      alert("NÚCLEO ACTUALIZADO: CAMBIOS APLICADOS CORRECTAMENTE");
    } catch (err) {
      alert("ERROR CRÍTICO: NO SE PUDO SINCRONIZAR CON LA NUBE");
    } finally {
      setGuardando(false);
    }
  };

  const cancelarModificaciones = () => {
    if (confirm("¿DESEA ANULAR LAS MODIFICACIONES ACTUALES Y RESTAURAR LOS VALORES DE FÁBRICA?")) {
      setConfig({ ...configOriginal });
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050a14] flex items-center justify-center">
      <div className="text-center">
        <div className="text-red-600 text-5xl mb-4 animate-pulse">⚙️</div>
        <p className="font-black italic text-red-600 tracking-tighter uppercase">Iniciando Acceso Root...</p>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* CABECERA MAESTRA */}
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-4">
            <div className="h-14 w-1 bg-red-600 shadow-[0_0_20px_red]"></div>
            <div>
              <h1 className="text-3xl font-black italic uppercase tracking-tighter">CONFIGURACIÓN <span className="text-red-600">MAESTRA</span></h1>
              <p className="text-[9px] font-bold text-slate-500 tracking-[0.4em] uppercase italic">Operador: {user?.nombre}</p>
            </div>
          </div>
          <button onClick={() => router.back()} className="bg-slate-800 hover:bg-red-600 px-6 py-3 rounded-xl font-black text-[10px] uppercase border border-white/5 transition-all group">
             <span className="group-hover:hidden">✖ SALIR</span>
             <span className="hidden group-hover:block">DESCARTAR TODO Y VOLVER</span>
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* BARRA LATERAL DE CONTROL */}
          <div className="md:col-span-3 space-y-3">
            {[
              { id: 'geolocalizacion', label: '📡 Geocerca GPS', color: 'blue' },
              { id: 'seguridad', label: '🛡️ Tiempos de Seguridad', color: 'emerald' },
              { id: 'interfaz', label: '🖥️ Interfaz Sistema', color: 'purple' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTabActual(tab.id)}
                className={`w-full text-left p-6 rounded-[30px] border transition-all ${
                  tabActual === tab.id 
                  ? 'bg-white/5 border-white/20 text-white shadow-xl shadow-black/40' 
                  : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{tab.label}</span>
              </button>
            ))}

            <div className="pt-8 space-y-4">
              <button 
                onClick={guardarCambios} 
                disabled={guardando} 
                className="w-full bg-red-600 hover:bg-red-500 p-6 rounded-[30px] font-black text-[11px] uppercase italic shadow-2xl shadow-red-900/40 transition-all active:scale-95"
              >
                {guardando ? 'Sincronizando...' : 'APLICAR CAMBIOS'}
              </button>
              <button 
                onClick={cancelarModificaciones} 
                className="w-full bg-slate-800/40 hover:bg-slate-800 p-5 rounded-[25px] font-black text-[11px] uppercase text-slate-400 border border-white/5 transition-all"
              >
                Anular Modificaciones
              </button>
            </div>
          </div>

          {/* PANEL DE DATOS */}
          <div className="md:col-span-9 bg-[#0f172a] rounded-[50px] border border-white/5 p-12 shadow-2xl relative min-h-[650px]">
            
            {/* 1. SECCIÓN GPS */}
            {tabActual === 'geolocalizacion' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                <div className="flex justify-between items-end">
                  <h2 className="text-xs font-black text-blue-500 uppercase italic tracking-widest">Ajuste Fino de Perímetro</h2>
                  <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
                    Modo: Interacción Directa en Mapa
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-3">Latitud Técnica</label>
                    <input type="text" value={config.gps_latitud || ''} readOnly className="w-full bg-[#050a14] border border-white/5 p-5 rounded-2xl font-mono text-xs text-blue-400 outline-none shadow-inner" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-3">Longitud Técnica</label>
                    <input type="text" value={config.gps_longitud || ''} readOnly className="w-full bg-[#050a14] border border-white/5 p-5 rounded-2xl font-mono text-xs text-blue-400 outline-none shadow-inner" />
                  </div>
                </div>

                <div className="h-[400px] rounded-[40px] overflow-hidden border border-white/10 shadow-2xl relative z-0">
                  <MapaInteractivo 
                    lat={parseFloat(config.gps_latitud || '0')} 
                    lng={parseFloat(config.gps_longitud || '0')}
                    onLocationChange={(lat, lng) => {
                      actualizarCampo('gps_latitud', lat.toString());
                      actualizarCampo('gps_longitud', lng.toString());
                    }}
                  />
                  <div className="absolute bottom-6 left-6 z-[1000] bg-black/80 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-2xl">
                    <p className="text-[9px] font-black text-white uppercase italic">Sugerencia Operativa</p>
                    <p className="text-[8px] text-slate-400 mt-1 uppercase leading-relaxed">
                      Clic Izquierdo: Reubicar Marcador<br/>
                      Clic Derecho: Ver Coordenadas Raw
                    </p>
                  </div>
                </div>
                
                <div className="bg-blue-600/5 border border-blue-500/10 p-8 rounded-[35px]">
                  <label className="text-[10px] font-black text-blue-500 uppercase block mb-4 tracking-widest text-center">Radio de Geocerca: {config.gps_radio} metros</label>
                  <input 
                    type="range" min="10" max="500" step="5"
                    value={config.gps_radio || 80}
                    onChange={(e) => actualizarCampo('gps_radio', e.target.value)}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>
            )}

            {/* 2. SECCIÓN SEGURIDAD */}
            {tabActual === 'seguridad' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                <h2 className="text-xs font-black text-emerald-500 uppercase italic tracking-widest">Temporizadores de Seguridad</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-[#050a14] p-10 rounded-[40px] border border-white/5 shadow-xl">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-6 tracking-widest">Vida Útil del Código QR</p>
                    <div className="flex items-baseline gap-4">
                      <input 
                        type="number" 
                        value={msAMinutos(config.qr_expiracion)} 
                        onChange={(e) => actualizarCampo('qr_expiracion', minutosAMs(e.target.value))}
                        className="bg-transparent text-6xl font-black text-emerald-500 outline-none w-32 tracking-tighter"
                      />
                      <span className="text-xs font-black text-slate-400 uppercase italic">Minutos</span>
                    </div>
                    <p className="text-[8px] font-mono text-slate-600 mt-6 uppercase italic">Equivale a: {config.qr_expiracion} Milisegundos</p>
                  </div>

                  <div className="bg-[#050a14] p-10 rounded-[40px] border border-white/5 shadow-xl">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-6 tracking-widest">Auto-Cierre por Inactividad</p>
                    <div className="flex items-baseline gap-4">
                      <input 
                        type="number" 
                        value={msAMinutos(config.timer_inactividad)} 
                        onChange={(e) => actualizarCampo('timer_inactividad', minutosAMs(e.target.value))}
                        className="bg-transparent text-6xl font-black text-emerald-500 outline-none w-32 tracking-tighter"
                      />
                      <span className="text-xs font-black text-slate-400 uppercase italic">Minutos</span>
                    </div>
                    <p className="text-[8px] font-mono text-slate-600 mt-6 uppercase italic">Equivale a: {config.timer_inactividad} Milisegundos</p>
                  </div>
                </div>
              </div>
            )}

            {/* 3. SECCIÓN INTERFAZ */}
            {tabActual === 'interfaz' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                <h2 className="text-xs font-black text-purple-500 uppercase italic tracking-widest">Identidad del Sistema</h2>
                <div className="bg-[#050a14] p-12 rounded-[45px] border border-white/5">
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-6 tracking-widest">Rótulo Comercial (Header)</label>
                  <input 
                    type="text" 
                    value={config.empresa_nombre || ''} 
                    onChange={(e) => actualizarCampo('empresa_nombre', e.target.value)}
                    className="bg-transparent text-4xl font-black text-white w-full outline-none uppercase italic border-b border-white/10 pb-4 focus:border-purple-500 transition-all"
                  />
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </main>
  );
}