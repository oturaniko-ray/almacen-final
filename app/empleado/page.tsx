'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

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
  const [mensajeFlash, setMensajeFlash] = useState('');
  const [config, setConfig] = useState<any>({ 
    empresa_nombre: '', 
    almacen_lat: 0, 
    almacen_lon: 0, 
    radio_maximo: 50,
    timer_inactividad: 120000,
    time_token: 5000 
  });

  const router = useRouter();

  // 1. Carga de sesión y Configuración
  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    const userData = JSON.parse(sessionData);
    setUser(userData);

    const fetchConfig = async () => {
      const { data } = await supabase.from('sistema_config').select('clave, valor');
      if (data) {
        const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        setConfig({
          empresa_nombre: cfgMap.empresa_nombre || 'SISTEMA',
          almacen_lat: parseFloat(cfgMap.almacen_lat || cfgMap.gps_latitud),
          almacen_lon: parseFloat(cfgMap.almacen_lon || cfgMap.gps_longitud),
          radio_maximo: parseInt(cfgMap.radio_maximo) || 50,
          timer_inactividad: parseInt(cfgMap.timer_inactividad) || 120000,
          time_token: parseInt(cfgMap.time_token) || 5000
        });
      }
    };
    fetchConfig();
  }, [router]);

  // 2. Función de actualización de GPS (Manual y Automática)
  const actualizarGPS = useCallback(() => {
    setMensajeFlash("Actualizando GPS...");
    setTimeout(() => setMensajeFlash(''), 2000);

    navigator.geolocation.getCurrentPosition(
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
  }, [config]);

  // 3. Vigilancia GPS inicial y Timer de Inactividad
  useEffect(() => {
    if (config.almacen_lat === 0) return;
    actualizarGPS();

    // Timer de Inactividad
    const timeout = setTimeout(() => {
      handleLogout();
    }, config.timer_inactividad);

    return () => clearTimeout(timeout);
  }, [config, actualizarGPS]);

  // 4. Generación de Token según time_token
  useEffect(() => {
    if (ubicacionOk && user) {
      const generateToken = () => {
        const rawToken = `${user.documento_id}|${Date.now()}`;
        setToken(btoa(rawToken)); // Algoritmo Base64 preservado
      };
      generateToken();
      const interval = setInterval(generateToken, config.time_token);
      return () => clearInterval(interval);
    }
  }, [ubicacionOk, user, config.time_token]);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/');
  };

  const renderBicolorTitle = (text: string) => {
    const words = (text || 'SISTEMA').split(' ');
    const lastWord = words.pop();
    const firstPart = words.join(' ');
    return (
      <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
        <span className="text-white">{firstPart} </span>
        <span className="text-blue-700">{lastWord}</span>
      </h1>
    );
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* Ventana Flash de GPS */}
      {mensajeFlash && (
        <div className="fixed top-10 z-50 px-6 py-3 bg-blue-600 text-white rounded-full font-bold shadow-2xl animate-bounce text-xs uppercase">
          📡 {mensajeFlash}
        </div>
      )}

      {/* Membrete */}
      <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] shadow-2xl border border-white/5 mb-4 text-center">
        {renderBicolorTitle(config.empresa_nombre)}
        {/* Título Mi identificador QR: 20% más grande y Blanco */}
        <p className="text-white font-bold text-[12px] uppercase tracking-[0.2em] mb-3">
          Mi identificador QR
        </p>

        {user && (
          <div className="mt-2 pt-2 border-t border-white/5 flex flex-col items-center">
            <span className="text-sm font-normal text-white uppercase">{user.nombre}</span>
            <span className="text-[11px] font-normal text-white/50 uppercase">Documento: {user.documento_id}</span>
          </div>
        )}
      </div>
      
      {/* Contenedor QR */}
      <div className="w-full max-w-sm bg-[#111111] p-8 rounded-[35px] border border-white/5 shadow-2xl flex flex-col items-center">
        {!ubicacionOk ? (
          <div className="w-full py-10 bg-rose-500/10 rounded-[30px] border border-rose-500/20 text-center">
            <span className="text-4xl block mb-3">📍</span>
            <p className="text-rose-500 font-black text-xs uppercase">Acceso Denegado</p>
            <p className="text-white/40 text-[9px] mt-1">{errorGps || "Verificando distancia..."}</p>
            <button onClick={actualizarGPS} className="mt-4 text-[9px] text-blue-500 underline uppercase font-bold">Reintentar GPS</button>
          </div>
        ) : (
          <div className="flex flex-col items-center group cursor-pointer" onClick={actualizarGPS}>
            <div className="bg-white p-6 rounded-[40px] shadow-[0_0_50px_rgba(59,130,246,0.2)] mb-6 transition-transform active:scale-95">
              {token && <QRCodeSVG value={token} size={200} level="H" />}
            </div>
            <p className="text-emerald-500 font-black text-[10px] uppercase">✓ Token activo y validado</p>
            <p className="text-white/30 text-[8px] uppercase mt-1">Pulsa el QR para refrescar posición</p>
          </div>
        )}

        <button 
          onClick={handleLogout} 
          className="w-full text-emerald-500 font-bold uppercase text-[9px] tracking-[0.3em] mt-8 italic py-2 border-t border-white/5 hover:text-emerald-300 transition-colors"
        >
          ✕ Finalizar Sesión
        </button>
      </div>
    </main>
  );
}