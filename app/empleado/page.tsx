'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// MANTENEMOS EXACTAMENTE LA MISMA FUNCIÓN DE CÁLCULO DE DISTANCIA
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

// Función para obtener el rol (consistente con login)
const obtenerRol = (nivel: number) => {
  if (nivel <= 2) return 'Empleado';
  if (nivel === 3) return 'Supervisor';
  if (nivel === 4) return 'Administrador';
  if (nivel === 5) return 'Gerente';
  if (nivel === 6 || nivel === 7) return 'Director';
  if (nivel === 8) return 'Configuración Maestra';
  return 'Usuario';
};

export default function EmpleadoPage() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState('');
  const [ubicacionOk, setUbicacionOk] = useState(false);
  const [errorGps, setErrorGps] = useState('');
  const [distancia, setDistancia] = useState<number | null>(null);
  const [mensajeFlash, setMensajeFlash] = useState<{ texto: string; tipo: 'success' | 'error' | 'info' | null }>({ texto: '', tipo: null });
  const [cargandoGPS, setCargandoGPS] = useState(false);
  const [config, setConfig] = useState<any>({ 
    empresa_nombre: '', 
    almacen_lat: 0, 
    almacen_lon: 0, 
    radio_maximo: 50, 
    timer_inactividad: 120000, 
    time_token: 5000 
  });

  const router = useRouter();
  const tiempoRef = useRef<NodeJS.Timeout | null>(null);

  // --- ARQUITECTURA DE SEGURIDAD: CONTROL DE INACTIVIDAD MEJORADO ---
  useEffect(() => {
    const tiempoLimite = parseInt(config.timer_inactividad) || 120000;
    
    const reiniciarTemporizador = () => {
      if (tiempoRef.current) clearTimeout(tiempoRef.current);
      tiempoRef.current = setTimeout(() => {
        handleLogout();
        mostrarNotificacion("Sesión cerrada por inactividad", 'error');
      }, tiempoLimite);
    };

    const eventos = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    eventos.forEach(evento => document.addEventListener(evento, reiniciarTemporizador));
    
    reiniciarTemporizador();

    return () => {
      eventos.forEach(evento => document.removeEventListener(evento, reiniciarTemporizador));
      if (tiempoRef.current) clearTimeout(tiempoRef.current);
    };
  }, [config.timer_inactividad]);

  // --- CARGA INICIAL - ACCESO PERMITIDO PARA TODOS LOS NIVELES ---
  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { 
      router.push('/'); 
      return; 
    }
    
    const userData = JSON.parse(sessionData);
    setUser(userData);

    // **MODIFICACIÓN: PERMITIR ACCESO A TODOS LOS NIVELES (1-8)**
    // No hay validación de nivel, todos pueden acceder

    const fetchConfig = async () => {
      try {
        const { data, error } = await supabase.from('sistema_config').select('clave, valor');
        if (error) throw error;
        
        if (data) {
          const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
          setConfig({
            empresa_nombre: cfgMap.empresa_nombre || 'SISTEMA DE CONTROL',
            almacen_lat: parseFloat(cfgMap.almacen_lat || cfgMap.gps_latitud) || 0,
            almacen_lon: parseFloat(cfgMap.almacen_lon || cfgMap.gps_longitud) || 0,
            radio_maximo: parseInt(cfgMap.radio_maximo) || 50,
            timer_inactividad: parseInt(cfgMap.timer_inactividad) || 120000,
            time_token: parseInt(cfgMap.time_token) || 5000
          });
        }
      } catch (error) {
        console.error('Error cargando configuración:', error);
        mostrarNotificacion("Error de configuración del sistema", 'error');
      }
    };
    fetchConfig();
  }, [router]);

  // --- ACTUALIZACIÓN GPS CON MANEJO DE ERRORES MEJORADO ---
  const actualizarGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setErrorGps("GPS no soportado en este dispositivo");
      setUbicacionOk(false);
      mostrarNotificacion("GPS no disponible", 'error');
      return;
    }

    setCargandoGPS(true);
    setErrorGps('');
    mostrarNotificacion("Obteniendo ubicación GPS...", 'info');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const d = calcularDistancia(pos.coords.latitude, pos.coords.longitude, config.almacen_lat, config.almacen_lon);
        const distanciaRedondeada = Math.round(d);
        setDistancia(distanciaRedondeada);
        
        if (d <= config.radio_maximo) { 
          setUbicacionOk(true); 
          setErrorGps('');
          mostrarNotificacion(`Ubicación validada (${distanciaRedondeada}m)`, 'success');
        } else { 
          setUbicacionOk(false); 
          setErrorGps(`Fuera del radio permitido (${distanciaRedondeada}m)`);
          mostrarNotificacion(`Fuera del área (${distanciaRedondeada}m)`, 'error');
        }
        setCargandoGPS(false);
      },
      (err) => { 
        let mensajeError = "Error de señal GPS";
        switch(err.code) {
          case err.PERMISSION_DENIED:
            mensajeError = "Permiso de GPS denegado";
            break;
          case err.POSITION_UNAVAILABLE:
            mensajeError = "Ubicación no disponible";
            break;
          case err.TIMEOUT:
            mensajeError = "Timeout de GPS";
            break;
        }
        setErrorGps(mensajeError); 
        setUbicacionOk(false); 
        mostrarNotificacion(mensajeError, 'error');
        setCargandoGPS(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [config]);

  // --- INICIALIZAR GPS CUANDO CONFIG ESTÉ LISTA ---
  useEffect(() => {
    if (config.almacen_lat !== 0 && user) {
      actualizarGPS();
    }
  }, [config, user, actualizarGPS]);

  // --- GENERACIÓN DE TOKEN QR (LÓGICA ORIGINAL PRESERVADA) ---
  useEffect(() => {
    if (ubicacionOk && user) {
      const generateToken = () => {
        // FORMATO ORIGINAL: documento_id|timestamp
        const rawToken = `${user.documento_id}|${Date.now()}`;
        setToken(btoa(rawToken));
      };
      
      generateToken(); // Generación inmediata
      const interval = setInterval(generateToken, config.time_token);
      
      return () => clearInterval(interval);
    }
  }, [ubicacionOk, user, config.time_token]);

  // --- MANEJO DE NOTIFICACIONES ---
  const mostrarNotificacion = (texto: string, tipo: 'success' | 'error' | 'info') => {
    setMensajeFlash({ texto, tipo });
    setTimeout(() => setMensajeFlash({ texto: '', tipo: null }), 3000);
  };

  // --- LOGOUT SEGURO ---
  const handleLogout = () => {
    if (tiempoRef.current) clearTimeout(tiempoRef.current);
    localStorage.clear();
    router.push('/');
  };

  // --- TÍTULO BICOLOR (CONSISTENTE CON LOGIN) ---
  const renderBicolorTitle = (text: string) => {
    const words = (text || 'SISTEMA DE CONTROL').split(' ');
    const lastWord = words.pop();
    const firstPart = words.join(' ');
    return (
      <h1 className="text-xl font-black italic uppercase tracking-tight leading-none">
        <span className="text-white">{firstPart} </span>
        <span className="text-blue-600">{lastWord}</span>
      </h1>
    );
  };

  // --- FUNCIÓN PARA REFRESCAR GPS CADA 30 SEGUNDOS ---
  useEffect(() => {
    if (ubicacionOk) {
      const intervaloGPS = setInterval(() => {
        actualizarGPS();
      }, 30000); // Refrescar cada 30 segundos
      
      return () => clearInterval(intervaloGPS);
    }
  }, [ubicacionOk, actualizarGPS]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* Notificación Flash Mejorada */}
      {mensajeFlash.tipo && (
        <div className={`fixed top-6 z-50 px-6 py-3 rounded-lg font-bold text-sm shadow-2xl border backdrop-blur-sm transition-all duration-300 ${
          mensajeFlash.tipo === 'success' 
            ? 'bg-green-500/10 border-green-500/30 text-green-300' 
            : mensajeFlash.tipo === 'error'
            ? 'bg-red-500/10 border-red-500/30 text-red-300'
            : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {mensajeFlash.tipo === 'success' ? '✓' : mensajeFlash.tipo === 'error' ? '✗' : '📍'}
            </span>
            <span className="font-semibold">{mensajeFlash.texto}</span>
          </div>
        </div>
      )}

      {/* Encabezado - CONSISTENTE CON LOGINPAGE */}
      <div className="w-full max-w-md bg-gray-900/80 p-6 rounded-xl border border-gray-800/50 mb-4 text-center backdrop-blur-sm">
        {renderBicolorTitle(config.empresa_nombre)}
        
        <p className="text-white font-bold text-[15px] uppercase tracking-wider mt-2">
          VALIDACIÓN DE ACCESO - GENERADOR QR
        </p>

        {user && (
          <div className="mt-3 pt-3 border-t border-gray-800/50">
            {/* **MISMO FORMATO QUE LOGINPAGE: Nombre • Rol (Nivel) */}
            <p className="text-xs font-medium text-gray-300">
              <span className="text-white font-bold text-sm">{user.nombre}</span>
              <span className="text-gray-400 mx-2">•</span>
              <span className="text-cyan-300">{obtenerRol(user.nivel_acceso)}</span>
              <span className="text-gray-400 ml-2">({user.nivel_acceso})</span>
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              Documento: <span className="text-gray-300">{user.documento_id}</span>
            </p>
          </div>
        )}
      </div>
      
      {/* Contenedor Principal - Estados GPS */}
      <div className="w-full max-w-md bg-gray-900/80 p-6 rounded-xl border border-gray-800/50 shadow-lg backdrop-blur-sm">
        
        {/* Estado: GPS no disponible o fuera de rango */}
        {!ubicacionOk ? (
          <div className="space-y-4">
            <div className="w-full py-8 bg-gradient-to-b from-gray-900/50 to-gray-950/30 rounded-lg border border-gray-700/50 text-center">
              <span className="text-5xl block mb-4 opacity-80">📍</span>
              
              <div className="space-y-3">
                <div>
                  <p className="text-rose-400 font-black text-sm uppercase tracking-wider">ACCESO DENEGADO</p>
                  <p className="text-rose-300/70 text-xs mt-1">{errorGps || "Calculando posición GPS..."}</p>
                </div>
                
                {distancia !== null && (
                  <div className="mt-4 bg-gray-900/50 p-3 rounded-lg border border-gray-700/30">
                    <div className="flex justify-between items-center">
                      <div className="text-left">
                        <p className="text-gray-400 text-xs uppercase">Distancia actual</p>
                        <p className="text-white font-bold text-lg">{distancia}m</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-xs uppercase">Radio máximo</p>
                        <p className="text-emerald-400 font-bold text-lg">{config.radio_maximo}m</p>
                      </div>
                    </div>
                    <div className="mt-2 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-rose-500 to-rose-600 transition-all duration-500"
                        style={{ 
                          width: `${Math.min(100, (distancia || 0) / config.radio_maximo * 100)}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <button 
              onClick={actualizarGPS}
              disabled={cargandoGPS}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed p-3 rounded-lg text-white font-bold uppercase tracking-wider text-sm transition-all duration-200 shadow-md flex items-center justify-center gap-2"
            >
              {cargandoGPS ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>OBTENIENDO GPS...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>REINTENTAR VERIFICACIÓN GPS</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Estado: GPS válido - Mostrar QR */
          <div className="space-y-6">
            {/* Encabezado QR */}
            <div className="text-center">
              <p className="text-sm font-bold uppercase tracking-widest text-emerald-400">
                TOKEN DE ACCESO ACTIVO
              </p>
              <p className="text-xs text-gray-400 mt-1">Actualiza cada {config.time_token / 1000}s</p>
            </div>
            
            {/* QR Container - Tocar para actualizar GPS */}
            <div 
              onClick={actualizarGPS}
              className="bg-gradient-to-b from-white to-gray-50 p-6 rounded-2xl border-2 border-emerald-500/20 shadow-2xl shadow-emerald-500/10 transition-all duration-300 hover:shadow-emerald-500/20 hover:border-emerald-500/40 active:scale-[0.98] cursor-pointer group relative"
            >
              {/* Indicador de click */}
              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-emerald-500 text-white text-[10px] px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Tocar para actualizar GPS
              </div>
              
              <div className="flex flex-col items-center">
                {token ? (
                  <QRCodeSVG 
                    value={token} 
                    size={200} 
                    level="H"
                    includeMargin={true}
                    bgColor="#ffffff"
                    fgColor="#111827"
                  />
                ) : (
                  <div className="w-[200px] h-[200px] bg-gray-200 rounded-lg flex items-center justify-center">
                    <svg className="animate-spin h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
                
                {/* Estado del token */}
                <div className="mt-4 text-center space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    <p className="text-emerald-500 font-black text-xs uppercase tracking-wide">
                      TOKEN ACTIVO Y VALIDADO
                    </p>
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  </div>
                  <p className="text-gray-600 text-[10px]">
                    Generado: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Información de distancia y estado */}
            <div className="space-y-4">
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/30">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-gray-900/30 rounded-lg">
                    <p className="text-gray-400 text-xs uppercase font-bold">DISTANCIA ACTUAL</p>
                    <p className="text-white font-bold text-xl">{distancia}m</p>
                  </div>
                  <div className="text-center p-3 bg-gray-900/30 rounded-lg">
                    <p className="text-gray-400 text-xs uppercase font-bold">RADIO PERMITIDO</p>
                    <p className="text-emerald-400 font-bold text-xl">{config.radio_maximo}m</p>
                  </div>
                </div>
                
                {/* Barra de progreso visual */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>0m</span>
                    <span>{Math.round(config.radio_maximo / 2)}m</span>
                    <span>{config.radio_maximo}m</span>
                  </div>
                  <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-rose-500 transition-all duration-500"
                      style={{ 
                        width: `${Math.min(100, (distancia || 0) / config.radio_maximo * 100)}%` 
                      }}
                    ></div>
                  </div>
                  <div className="text-center mt-2">
                    <p className="text-gray-400 text-[10px]">
                      {distancia && distancia <= config.radio_maximo 
                        ? `Dentro del área permitida (${config.radio_maximo - (distancia || 0)}m de margen)`
                        : `Fuera del área (${(distancia || 0) - config.radio_maximo}m excedido)`
                      }
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Instrucciones */}
              <div className="text-center p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                <p className="text-blue-400 text-[11px] font-bold uppercase tracking-wider">
                  INSTRUCCIONES PARA TODOS LOS NIVELES
                </p>
                <p className="text-gray-400 text-[10px] mt-1">
                  • Este sistema registra todos los accesos al almacén para reportes
                  • Muestre el código QR al lector para validar su entrada
                  • El token se regenera automáticamente para mayor seguridad
                  • Toque el QR para forzar actualización de GPS si es necesario
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Pie de página y logout */}
        <div className="text-center pt-6 border-t border-gray-800/50">
          <p className="text-xs text-gray-500 italic mb-4">
            @Copyright RayPérez 2026 • Sistema de registro de accesos por GPS
          </p>
          
          <button 
            onClick={handleLogout}
            className="w-full text-gray-400 hover:text-white font-medium text-xs tracking-wide py-2 transition-colors duration-200 flex items-center justify-center gap-2 hover:bg-gray-800/30 rounded-lg"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            CERRAR SESIÓN
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .animate-pulse {
          animation: pulse 1.5s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
}