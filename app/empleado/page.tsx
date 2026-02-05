'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// Utilidad de cálculo de distancia (se mantiene lógica interna)
function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dPhi = (lat2 - lat1) * Math.PI / 180;
  const dLambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dLambda/2) * Math.sin(dLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function EmpleadoPage() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState('');
  const [ubicacionOk, setUbicacionOk] = useState(false);
  const [errorGps, setErrorGps] = useState('');
  const [distancia, setDistancia] = useState<number | null>(null);
  const [config, setConfig] = useState<any>({ 
    empresa_nombre: '', 
    almacen_lat: 0, 
    almacen_lon: 0, 
    radio_maximo: 50 
  });

  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    setUser(JSON.parse(sessionData));
    fetchConfig();
  }, [router]);

  const fetchConfig = async () => {
    const { data } = await supabase.from('sistema_config').select('clave, valor');
    if (data) {
      const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
      setConfig({
        empresa_nombre: cfgMap.empresa_nombre || 'SISTEMA',
        almacen_lat: parseFloat(cfgMap.almacen_lat || cfgMap.gps_latitud) || 0,
        almacen_lon: parseFloat(cfgMap.almacen_lon || cfgMap.gps_longitud) || 0,
        radio_maximo: parseInt(cfgMap.radio_maximo) || 50
      });
    }
  };

  useEffect(() => {
    if (config.almacen_lat === 0) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const d = calcularDistancia(pos.coords.latitude, pos.coords.longitude, config.almacen_lat, config.almacen_lon);
        setDistancia(Math.round(d));
        if (d <= config.radio_maximo) {
          setUbicacionOk(true);
          setErrorGps('');
        } else {
          setUbicacionOk(false);
          setErrorGps(`Fuera de rango (${Math.round(d)}m)`);
        }
      },
      (err) => setErrorGps("Error de señal GPS"),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [config]);

  useEffect(() => {
    if (ubicacionOk && user) {
      const generateToken = () => {
        const rawToken = `${user.documento_id}|${Date.now()}`;
        setToken(btoa(rawToken));
      };
      generateToken();
      const interval = setInterval(generateToken, 5000);
      return () => clearInterval(interval);
    }
  }, [ubicacionOk, user]);

  const handleLogout = () => {
    localStorage.clear(); // Limpieza total solicitada
    router.push('/');
  };

  const renderBicolorTitle = (text: string) => {
    const words = (text || 'SISTEMA').split(' ');
    if (words.length === 1) return <span className="text-blue-700">{words[0]}</span>;
    const lastWord = words.pop();
    const firstPart = words.join(' ');
    return (
      <>
        <span className="text-white">{firstPart} </span>
        <span className="text-blue-700">{lastWord}</span>
      </>
    );
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* Box de Membrete Estandarizado */}
      <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/5 mb-4">
        <header className="text-center">
          <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
            {renderBicolorTitle(config.empresa_nombre)}
          </h1>
          <p className="text-blue-700 font-bold text-[10px] uppercase tracking-widest mb-3">
            Mi identificador QR
          </p>

          {user && (
            <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
              <p className="text-sm font-normal text-white uppercase">{user.nombre}</p>
              <p className="text-[11px] font-normal text-white/60 uppercase">ID: {user.documento_id}</p>
            </div>
          )}
        </header>
      </div>
      
      {/* Contenedor Principal QR / GPS */}
      <div className="w-full max-w-sm bg-[#111111] p-8 rounded-[35px] border border-white/5 relative z-10 shadow-2xl flex flex-col items-center">
        
        {!ubicacionOk ? (
          /* Estado Warning (Fuera de Rango) */
          <div className="w-full py-10 bg-rose-500/10 rounded-[30px] border border-rose-500/20 text-center animate-pulse">
            <span className="text-4xl block mb-3">📍</span>
            <p className="text-rose-500 font-black text-xs uppercase mb-1">Acceso Restringido</p>
            <p className="text-white/60 text-[10px] uppercase">{errorGps || "Validando Ubicación..."}</p>
          </div>
        ) : (
          /* Estado Success (QR Activo) */
          <div className="flex flex-col items-center">
            <div className="bg-white p-6 rounded-[40px] shadow-[0_0_50px_rgba(59,130,246,0.15)] mb-6">
              {token && (
                <QRCodeSVG 
                  value={token} 
                  size={200} 
                  level="H" 
                  includeMargin={false}
                  imageSettings={{
                    src: "/favicon.ico",
                    x: undefined,
                    y: undefined,
                    height: 24,
                    width: 24,
                    excavate: true,
                  }}
                />
              )}
            </div>
            
            <div className="text-center space-y-1">
              <p className="text-emerald-500 font-black text-[10px] uppercase tracking-tighter">
                Estatus: Ubicación Validada ✅
              </p>
              <p className="text-white/40 font-bold text-[9px] uppercase tracking-[0.2em]">
                Distancia: {distancia}m del almacén
              </p>
            </div>
          </div>
        )}

        {/* Botón de Salida en Verde */}
        <button 
          onClick={handleLogout} 
          className="w-full text-emerald-500 font-bold uppercase text-[9px] tracking-[0.3em] mt-8 hover:text-emerald-400 transition-colors italic text-center py-2 border-t border-white/5"
        >
          ✕ Finalizar y Cerrar Sesión
        </button>
      </div>

      <style jsx global>{`
        @keyframes flash-fast {
          0%, 100% { opacity: 1; }
          10%, 30%, 50% { opacity: 0; }
          20%, 40%, 60% { opacity: 1; }
        }
        .animate-flash-fast {
          animation: flash-fast 2s ease-in-out;
        }
      `}</style>
    </main>
  );
}