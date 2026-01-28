'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

// Importaciones dinámicas para Leaflet (evita errores de SSR en Next.js)
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const useMapEvents = dynamic(() => import('react-leaflet').then(mod => mod.useMapEvents), { ssr: false });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function ConfigMaestraPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>({});
  const [configOriginal, setConfigOriginal] = useState<any>({});
  const [tabActual, setTabActual] = useState('geolocalizacion');
  const [guardando, setGuardando] = useState(false);
  const router = useRouter();

  // Configuración de iconos de Leaflet (Solución a bug común en Next.js)
  useEffect(() => {
    const L = require('leaflet');
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    });
  }, []);

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

  // Conversión de tiempo
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
      alert("NÚCLEO SINCRONIZADO CON ÉXITO");
    } catch (err) {
      alert("Error en la sincronización");
    } finally {
      setGuardando(false);
    }
  };

  // Componente interno para manejar eventos del mapa
  function MapEvents() {
    useMapEvents({
      click(e) {
        actualizarCampo('gps_latitud', e.latlng.lat.toString());
        actualizarCampo('gps_longitud', e.latlng.lng.toString());
      },
      contextmenu(e) {
        alert(`COORDENADAS PRECISAS:\nLat: ${e.latlng.lat}\nLon: ${e.latlng.lng}`);
      }
    });
    return null;
  }

  if (loading) return <div className="min-h-screen bg-[#050a14] flex items-center justify-center font-black text-red-500 italic">CARGANDO KERNEL...</div>;

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-4">
            <div className="h-14 w-1 bg-red-600 shadow-[0_0_15px_red]"></div>
            <div>
              <h1 className="text-3xl font-black italic uppercase tracking-tighter">CONFIGURACIÓN <span className="text-red-600">MAESTRA</span></h1>
              <p className="text-[9px] font-bold text-slate-500 tracking-[0.4em] uppercase italic">Root: {user?.nombre}</p>
            </div>
          </div>
          <button onClick={() => router.back()} className="bg-slate-800 hover:bg-slate-700 px-6 py-3 rounded-xl font-black text-[10px] uppercase border border-white/5 transition-all">
             ✖ Salir sin guardar
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* MENÚ LATERAL */}
          <div className="md:col-span-3 space-y-3">
            {['geolocalizacion', 'seguridad', 'interfaz'].map((t) => (
              <button key={t} onClick={() => setTabActual(t)} className={`w-full text-left p-5 rounded-[25px] border transition-all ${tabActual === t ? 'bg-white/5 border-white/20 text-white' : 'border-transparent text-slate-500 hover:text-white'}`}>
                <span className="text-[10px] font-black uppercase tracking-widest">{t}</span>
              </button>
            ))}

            <div className="pt-10 space-y-3">
              <button onClick={guardarCambios} disabled={guardando} className="w-full bg-red-600 hover:bg-red-500 p-5 rounded-[25px] font-black text-[11px] uppercase italic shadow-xl shadow-red-900/30 transition-all">
                {guardando ? 'Guardando...' : 'Guardar Cambios'}
              </button>
              <button onClick={() => { if(confirm("¿Anular cambios?")) setConfig({...configOriginal}); }} className="w-full bg-slate-800/50 hover:bg-slate-800 p-5 rounded-[25px] font-black text-[11px] uppercase text-slate-400 border border-white/5 transition-all">
                Cancelar Cambios
              </button>
            </div>
          </div>

          {/* PANEL DE CONTENIDO */}
          <div className="md:col-span-9 bg-[#0f172a] rounded-[45px] border border-white/5 p-10 shadow-2xl overflow-hidden min-h-[600px]">
            
            {tabActual === 'geolocalizacion' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xs font-black text-blue-500 uppercase italic">Ajuste de Geocerca</h2>
                  <div className="text-[9px] font-bold text-slate-500">CLIC IZQ: POSICIONAR | CLIC DER: COORDENADAS</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 ml-2 uppercase">Latitud</label>
                    <input type="text" value={config.gps_latitud} onChange={e => actualizarCampo('gps_latitud', e.target.value)} className="w-full bg-[#050a14] border border-white/5 p-4 rounded-2xl font-mono text-xs text-blue-400 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 ml-2 uppercase">Longitud</label>
                    <input type="text" value={config.gps_longitud} onChange={e => actualizarCampo('gps_longitud', e.target.value)} className="w-full bg-[#050a14] border border-white/5 p-4 rounded-2xl font-mono text-xs text-blue-400 outline-none" />
                  </div>
                </div>

                {/* MAPA LEAFLET INTERACTIVO */}
                <div className="h-[400px] rounded-[35px] overflow-hidden border border-white/10 z-0">
                  <MapContainer 
                    center={[parseFloat(config.gps_latitud || '0'), parseFloat(config.gps_longitud || '0')]} 
                    zoom={17} 
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
                      subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                      attribution='&copy; Google Maps'
                    />
                    <Marker position={[parseFloat(config.gps_latitud || '0'), parseFloat(config.gps_longitud || '0')]} />
                    <MapEvents />
                  </MapContainer>
                </div>
              </div>
            )}

            {tabActual === 'seguridad' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-[#050a14] p-8 rounded-3xl border border-white/5">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-4 tracking-tighter">Expiración de Código QR</p>
                    <div className="flex items-end gap-3">
                      <input 
                        type="number" 
                        value={msAMinutos(config.qr_expiracion)} 
                        onChange={(e) => actualizarCampo('qr_expiracion', minutosAMs(e.target.value))}
                        className="bg-transparent text-5xl font-black text-emerald-500 outline-none w-32"
                      />
                      <span className="text-xs font-black text-slate-400 mb-2 italic">MINUTOS</span>
                    </div>
                  </div>
                  {/* Repetir para Inactividad */}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}