'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { getCurrentLocation, getAddressFromCoordinates, LocationData } from '@/lib/locationService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Función para formatear rol
const formatearRol = (rol: string): string => {
  if (!rol) return 'EMPLEADO';
  const rolLower = rol.toLowerCase();
  switch (rolLower) {
    case 'admin':
    case 'administrador':
      return 'ADMINISTRADOR';
    case 'supervisor':
      return 'SUPERVISOR';
    case 'tecnico':
      return 'TÉCNICO';
    case 'empleado':
      return 'EMPLEADO';
    default:
      return rol.toUpperCase();
  }
};

// ----- MEMBRETE SUPERIOR -----
const MemebreteSuperior = ({ usuario }: { usuario?: any }) => (
  <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-4 text-center shadow-2xl mx-auto">
    <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
      <span className="text-white">GESTOR DE </span>
      <span className="text-blue-700">ACCESO</span>
    </h1>
    {usuario && (
      <div className="mt-2">
        <span className="text-sm text-white normal-case">{usuario.nombre}</span>
        <span className="text-sm text-white mx-2">•</span>
        <span className="text-sm text-blue-500 normal-case">
          {formatearRol(usuario.rol)}
        </span>
        <span className="text-sm text-white ml-2">({usuario.nivel_acceso})</span>
      </div>
    )}
  </div>
);

// ----- FOOTER (CERRAR SESIÓN) -----
const Footer = ({ router }: { router: any }) => (
  <div className="w-full max-w-sm mt-8 pt-4 text-center">
    <p className="text-[9px] text-white/40 uppercase tracking-widest mb-4">
      @Copyright 2026
    </p>
    <button
      onClick={() => {
        localStorage.clear();
        router.push('/');
      }}
      className="text-emerald-500 font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 mx-auto active:scale-95 transition-transform"
    >
      <span className="text-lg">🏠</span> CERRAR SESIÓN
    </button>
  </div>
);

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
    time_token: 5000,
  });
  const [tiempoRestante, setTiempoRestante] = useState<number>(0);
  const [ubicacionActual, setUbicacionActual] = useState<LocationData | null>(null);

  const ultimaActividadRef = useRef<number>(Date.now());
  const router = useRouter();

  // Control de inactividad
  useEffect(() => {
    const tiempoLimite = parseInt(config.timer_inactividad) || 120000;
    const reiniciarTemporizador = () => {
      ultimaActividadRef.current = Date.now();
      clearTimeout(window.inactividadEmpleadoTimeout);
      window.inactividadEmpleadoTimeout = setTimeout(() => {
        localStorage.clear();
        router.push('/');
      }, tiempoLimite);
    };
    const eventos = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    eventos.forEach((e) => document.addEventListener(e, reiniciarTemporizador));
    reiniciarTemporizador();
    return () => {
      eventos.forEach((e) => document.removeEventListener(e, reiniciarTemporizador));
      clearTimeout(window.inactividadEmpleadoTimeout);
    };
  }, [config.timer_inactividad, router]);

  // Contador regresivo
  useEffect(() => {
    if (!ubicacionOk) return;
    const interval = setInterval(() => {
      const tiempoTranscurrido = Date.now() - ultimaActividadRef.current;
      const tiempoLimite = parseInt(config.timer_inactividad) || 120000;
      const restante = Math.max(0, tiempoLimite - tiempoTranscurrido);
      setTiempoRestante(Math.floor(restante / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [ubicacionOk, config.timer_inactividad]);

  // Cargar sesión y configuración
  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) {
      router.push('/');
      return;
    }
    const userData = JSON.parse(sessionData);
    setUser(userData);

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
          time_token: parseInt(cfgMap.time_token) || 5000,
        });
      }
    };
    fetchConfig();
  }, [router]);

  // ✅ NUEVA FUNCIÓN DE GPS MEJORADA
  const actualizarGPS = useCallback(async () => {
    setMensajeFlash('Actualizando GPS...');
    
    try {
      const location = await getCurrentLocation();
      
      if (location) {
        setUbicacionActual(location);
        
        const d = calcularDistancia(
          location.lat,
          location.lng,
          config.almacen_lat,
          config.almacen_lon
        );
        
        setDistancia(Math.round(d));
        
        if (d <= config.radio_maximo) {
          setUbicacionOk(true);
          setErrorGps('');
          ultimaActividadRef.current = Date.now();
          
          // Obtener dirección para mostrar
          const address = await getAddressFromCoordinates(location.lat, location.lng);
          if (address) {
            setMensajeFlash(`✅ Ubicación válida: ${address.split(',')[0]}`);
          } else {
            setMensajeFlash('✅ Ubicación válida');
          }
        } else {
          setUbicacionOk(false);
          setErrorGps(`Fuera de rango (${Math.round(d)}m)`);
          setMensajeFlash(`❌ Fuera de rango: ${Math.round(d)}m`);
        }
      } else {
        setErrorGps('No se pudo obtener ubicación');
        setUbicacionOk(false);
      }
    } catch (error) {
      console.error('Error en actualizarGPS:', error);
      setErrorGps('Error de señal GPS');
      setUbicacionOk(false);
    }
    
    setTimeout(() => setMensajeFlash(''), 3000);
  }, [config]);

  // Cargar GPS al inicio
  useEffect(() => {
    if (config.almacen_lat === 0) return;
    actualizarGPS();
    
    // Actualizar cada 30 segundos mientras la app está abierta
    const interval = setInterval(actualizarGPS, 30000);
    return () => clearInterval(interval);
  }, [config, actualizarGPS]);

  // Generar QR con prefijo P
  useEffect(() => {
    if (ubicacionOk && user) {
      const generateToken = () => {
        const rawToken = `P|${user.documento_id}|${Date.now()}`;
        setToken(btoa(rawToken));
      };
      generateToken();
      const interval = setInterval(generateToken, config.time_token);
      return () => clearInterval(interval);
    }
  }, [ubicacionOk, user, config.time_token]);

  const formatTiempoRestante = (segundos: number) => {
    const minutos = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${minutos}:${segs < 10 ? '0' : ''}${segs}`;
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans">
      {mensajeFlash && (
        <div className="fixed top-10 z-50 px-8 py-3 bg-blue-600 text-white rounded-full font-bold shadow-2xl animate-pulse text-xs uppercase tracking-widest">
          📡 {mensajeFlash}
        </div>
      )}

      <div className="w-full max-w-sm flex flex-col items-center">
        <MemebreteSuperior usuario={user} />

        <div className="w-full bg-[#111111] p-8 rounded-[35px] border border-white/5 shadow-2xl flex flex-col items-center">
          {!ubicacionOk ? (
            <div className="w-full py-10 bg-rose-500/10 rounded-[30px] border border-rose-500/20 text-center">
              <span className="text-4xl block mb-3">📍</span>
              <p className="text-rose-500 font-black text-xs uppercase mb-1">Acceso Denegado</p>
              <p className="text-white/40 text-[9px] uppercase italic">
                {errorGps || 'Calculando posición...'}
              </p>
              {distancia !== null && (
                <p className="text-white/20 text-[8px] mt-4 uppercase">Distancia actual: {distancia}m</p>
              )}
              {ubicacionActual?.source && (
                <p className="text-blue-500/50 text-[7px] mt-2 uppercase">
                  Fuente: {ubicacionActual.source === 'gps' ? 'GPS' : ubicacionActual.source === 'ip' ? 'IP' : 'Caché'}
                </p>
              )}
              <button
                onClick={actualizarGPS}
                className="mt-4 text-[10px] text-blue-500 underline uppercase font-bold tracking-widest"
              >
                Reintentar GPS
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center w-full group" onClick={actualizarGPS}>
              <div className="text-center mb-4">
                <p className="text-[18px] font-bold uppercase tracking-[0.4em] text-white animate-pulse-very-slow">
                  Mi QR
                </p>
                {ubicacionActual?.address && (
                  <p className="text-[8px] text-blue-500/70 mt-1 truncate max-w-[250px]">
                    📍 {ubicacionActual.address.split(',')[0]}
                  </p>
                )}
              </div>
              <div className="bg-white p-6 rounded-[40px] shadow-[0_0_60px_rgba(59,130,246,0.15)] mb-6 transition-transform active:scale-90 cursor-pointer">
                {token && <QRCodeSVG value={token} size={200} level="H" />}
              </div>
              <div className="text-center space-y-1">
                <p className="text-emerald-500 font-black text-[10px] uppercase tracking-wide">
                  Tiempo restante: {formatTiempoRestante(tiempoRestante)}
                </p>
                <p className="text-white/20 text-[7px] uppercase mt-3 tracking-[0.2em]">
                  Toca el QR para actualizar GPS
                </p>
              </div>
            </div>
          )}
        </div>

        <Footer router={router} />
      </div>

      <style jsx global>{`
        @keyframes pulse-very-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.15; }
        }
        .animate-pulse-very-slow {
          animation: pulse-very-slow 6s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
}

declare global {
  interface Window {
    inactividadEmpleadoTimeout: any;
  }
}