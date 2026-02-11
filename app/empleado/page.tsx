'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
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
  const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dLambda/2) * Math.sin(dLambda/2);
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
    empresa_nombre: '', almacen_lat: 0, almacen_lon: 0, radio_maximo: 50, timer_inactividad: 120000, time_token: 5000 
  });
  const [tiempoRestante, setTiempoRestante] = useState<number>(0);
  
  const ultimaActividadRef = useRef<number>(Date.now());
  const router = useRouter();

  // --- ARQUITECTURA DE SEGURIDAD: CONTROL DE INACTIVIDAD ---
  useEffect(() => {
    const tiempoLimite = parseInt(config.timer_inactividad) || 120000;
    
    const reiniciarTemporizador = () => {
      ultimaActividadRef.current = Date.now();
      clearTimeout(window.inactividadEmpleadoTimeout);
      window.inactividadEmpleadoTimeout = setTimeout(() => {
        handleLogout();
      }, tiempoLimite);
    };

    const eventos = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    eventos.forEach(evento => document.addEventListener(evento, reiniciarTemporizador));
    
    reiniciarTemporizador();

    return () => {
      eventos.forEach(evento => document.removeEventListener(evento, reiniciarTemporizador));
      clearTimeout(window.inactividadEmpleadoTimeout);
    };
  }, [config.timer_inactividad]);

  // Contador regresivo de inactividad
  useEffect(() => {
    if (!ubicacionOk) return;

    const interval = setInterval(() => {
      const tiempoTranscurrido = Date.now() - ultimaActividadRef.current;
      const tiempoLimite = parseInt(config.timer_inactividad) || 120000;
      const restante = Math.max(0, tiempoLimite - tiempoTranscurrido);
      setTiempoRestante(Math.floor(restante / 1000)); // Convertir a segundos
    }, 1000);

    return () => clearInterval(interval);
  }, [ubicacionOk, config.timer_inactividad]);

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    setUser(JSON.parse(sessionData));

    const fetchConfig = async () => {
      const { data } = await supabase.from('sistema_config').select('clave, valor');
      if (data) {
        const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        setConfig({
          empresa_nombre: cfgMap.empresa_nombre || 'SISTEMA',
          almacen_lat: parseFloat(cfgMap.almacen_lat || cfgMap.gps_latitud) || 0,
          almacen_lon: parseFloat(cfgMap.almacen_lon || cfgMap.gps_longitud) || 0,
          radio_maximo: parseInt(cfgMap.radio_maximo) || 50,
          timer_inactividad: parseInt(cfgMap.timer_inactividad) || 120000,
          time_token: parseInt(cfgMap.time_token) || 5000
        });
      }
    };
    fetchConfig();
  }, [router]);

  const actualizarGPS = useCallback(() => {
    setMensajeFlash("Actualizando GPS");
    setTimeout(() => setMensajeFlash(''), 2000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const d = calcularDistancia(pos.coords.latitude, pos.coords.longitude, config.almacen_lat, config.almacen_lon);
        setDistancia(Math.round(d));
        if (d <= config.radio_maximo) { 
          setUbicacionOk(true); 
          setErrorGps(''); 
          ultimaActividadRef.current = Date.now(); // Reiniciar inactividad
        } 
        else { 
          setUbicacionOk(false); 
          setErrorGps(`Fuera de rango (${Math.round(d)}m)`); 
        }
      },
      (err) => { setErrorGps("Error de señal GPS"); setUbicacionOk(false); },
      { enableHighAccuracy: true }
    );
  }, [config]);

  useEffect(() => {
    if (config.almacen_lat === 0) return;
    actualizarGPS();
  }, [config, actualizarGPS]);

  useEffect(() => {
    if (ubicacionOk && user) {
      const generateToken = () => {
        const rawToken = `${user.documento_id}|${Date.now()}`;
        setToken(btoa(rawToken));
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

  const formatTiempoRestante = (segundos: number) => {
    const minutos = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${minutos}:${segs < 10 ? '0' : ''}${segs}`;
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      {mensajeFlash && (
        <div className="fixed top-10 z-50 px-8 py-3 bg-blue-600 text-white rounded-full font-bold shadow-2xl animate-pulse text-xs uppercase tracking-widest">
          📡 {mensajeFlash}
        </div>
      )}

      <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] shadow-2xl border border-white/5 mb-4 text-center">
        {renderBicolorTitle(config.empresa_nombre)}
        <p className="text-white font-bold text-[17px] uppercase tracking-[0.25em] mb-3">Mi identificador QR</p>
        {user && (
          <div className="mt-2 pt-2 border-t border-white/5">
            <div className="text-sm font-normal text-white uppercase">
              {user.nombre} - {user.documento_id}
            </div>
          </div>
        )}
      </div>
      
      <div className="w-full max-w-sm bg-[#111111] p-8 rounded-[35px] border border-white/5 shadow-2xl flex flex-col items-center">
        {!ubicacionOk ? (
          <div className="w-full py-10 bg-rose-500/10 rounded-[30px] border border-rose-500/20 text-center">
            <span className="text-4xl block mb-3">📍</span>
            <p className="text-rose-500 font-black text-xs uppercase mb-1">Acceso Denegado</p>
            <p className="text-white/40 text-[9px] uppercase italic">{errorGps || "Calculando posición..."}</p>
            <button onClick={actualizarGPS} className="mt-4 text-[10px] text-blue-500 underline uppercase font-bold tracking-widest">Reintentar GPS</button>
          </div>
        ) : (
          <div className="flex flex-col items-center w-full group" onClick={actualizarGPS}>
            <div className="text-center mb-4">
              <p className="text-[18px] font-bold uppercase tracking-[0.4em] text-white animate-pulse-very-slow">Opciones</p>
            </div>
            <div className="bg-white p-6 rounded-[40px] shadow-[0_0_60px_rgba(59,130,246,0.15)] mb-6 transition-transform active:scale-90 cursor-pointer">
              {token && <QRCodeSVG value={token} size={200} level="H" />}
            </div>
            <div className="text-center space-y-1">
              <p className="text-emerald-500 font-black text-[10px] uppercase tracking-wide">
                Tiempo restante: {formatTiempoRestante(tiempoRestante)}
              </p>
              <p className="text-white/20 text-[7px] uppercase mt-3 tracking-[0.2em]">Toca el QR para actualizar GPS</p>
            </div>
          </div>
        )}

        {/* Instrucciones */}
        <div className="w-full mt-8 pt-6 border-t border-white/10">
          <p className="text-white font-bold text-[12px] uppercase tracking-wider mb-3">INSTRUCCIONES PARA TODOS</p>
          <ul className="text-white/60 text-[10px] space-y-2 text-left pl-4">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Este sistema registra todos los accesos al almacén</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Muestre el código QR al lector para validar su acceso</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Toque el QR para forzar actualización de GPS si es necesario</span>
            </li>
          </ul>
        </div>

        <button onClick={handleLogout} className="w-full text-emerald-500 font-bold uppercase text-[11px] tracking-[0.3em] mt-8 italic py-3 border-t border-white/5 hover:text-emerald-300 transition-colors">
          ✕ Cerrar Sesión
        </button>
      </div>

      <style jsx global>{`
        @keyframes pulse-very-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.15; } }
        .animate-pulse-very-slow { animation: pulse-very-slow 6s ease-in-out infinite; }
      `}</style>
    </main>
  );
}

declare global { interface Window { inactividadEmpleadoTimeout: any; } }