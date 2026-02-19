'use client';
import React, { useState, useEffect, useRef, useCallback, ChangeEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { getCurrentLocation, getAddressFromCoordinates, LocationData } from '@/lib/locationService';
import { 
  CampoEntrada, 
  ContenedorPrincipal,
  NotificacionSistema,
  ModalFlotaSalida
} from '../components';

// ------------------------------------------------------------
// FUNCIÓN AUXILIAR
// ------------------------------------------------------------
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

const formatearRol = (rol: string): string => {
  if (!rol) return 'SUPERVISOR';
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
const MemebreteSuperior = ({ usuario }: { usuario?: any }) => {
  const titulo = "LECTOR QR";
  const palabras = titulo.split(' ');
  const ultimaPalabra = palabras.pop();
  const primerasPalabras = palabras.join(' ');

  return (
    <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 text-center shadow-2xl mx-auto">
      <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
        <span className="text-white">{primerasPalabras} </span>
        <span className="text-blue-700">{ultimaPalabra}</span>
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
};

// ----- BOTÓN DE OPCIÓN -----
const BotonOpcion = ({
  texto,
  descripcion,
  icono,
  onClick,
  color,
}: {
  texto: string;
  descripcion: string;
  icono: string;
  onClick: () => void;
  color: string;
}) => {
  return (
    <button
      onClick={onClick}
      className={`w-full ${color} p-3 rounded-xl border border-white/5 
        active:scale-95 transition-transform shadow-lg 
        flex flex-col items-center justify-center gap-1`}
    >
      <div className="w-12 h-12 rounded-full bg-black/30 border border-white/20 flex items-center justify-center">
        <span className="text-2xl">{icono}</span>
      </div>
      <span className="text-white font-bold uppercase text-[11px] tracking-wider">
        {texto}
      </span>
      <span className="text-white/60 text-[9px] uppercase font-bold tracking-widest leading-relaxed">
        {descripcion}
      </span>
    </button>
  );
};

// ----- BOTÓN DE ACCIÓN -----
const BotonAccion = ({
  texto,
  icono,
  onClick,
  disabled = false,
  loading = false,
  color = 'bg-blue-600'
}: {
  texto: string;
  icono?: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  color?: string;
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full ${color} p-3 rounded-xl border border-white/5
        active:scale-95 transition-transform shadow-lg 
        flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed
        text-white font-bold uppercase text-[11px] tracking-wider`}
    >
      {icono && <span className="text-lg">{icono}</span>}
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="w-2 h-2 bg-white rounded-full animate-pulse delay-150" />
          <span className="w-2 h-2 bg-white rounded-full animate-pulse delay-300" />
        </span>
      ) : (
        texto
      )}
    </button>
  );
};

// ------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------------------
export default function SupervisorPage() {
  // Estados de UI
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [qrInfo, setQrInfo] = useState<{ tipo: string; docId: string; timestamp: number } | null>(null);
  const [pinEmpleado, setPinEmpleado] = useState('');
  const [pinAutorizador, setPinAutorizador] = useState('');
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = useState(false);
  const [notificacion, setNotificacion] = useState<{
    mensaje: string;
    tipo: 'exito' | 'error' | 'advertencia' | 'info' | null;
  }>({ mensaje: '', tipo: null });
  const [flotaSalida, setFlotaSalida] = useState<{ activo: boolean; cant_carga: number; observacion: string }>({
    activo: false,
    cant_carga: 0,
    observacion: '',
  });
  const [pasoManual, setPasoManual] = useState<0 | 1 | 2 | 3>(0);
  const [user, setUser] = useState<any>(null);
  const [config, setConfig] = useState<any>({
    lat: 0,
    lon: 0,
    radio: 100,
    qr_exp: 30000,
    timer_inactividad: 120000
  });
  const [gps, setGps] = useState({ lat: 0, lon: 0, dist: 999999 });
  const [ubicacionActual, setUbicacionActual] = useState<LocationData | null>(null);
  const [errorGps, setErrorGps] = useState<string>('');

  // Estados para modal de flota
  const [modalFlotaVisible, setModalFlotaVisible] = useState(false);
  const [flotaTempData, setFlotaTempData] = useState<{ cant_carga: number; observacion: string }>({
    cant_carga: 0,
    observacion: '',
  });
  const [registroPendiente, setRegistroPendiente] = useState<any>(null);

  const enterListenerRef = useRef<((e: KeyboardEvent) => void) | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const timerInactividadRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const documentoRef = useRef<HTMLInputElement>(null);
  const pinEmpleadoRef = useRef<HTMLInputElement>(null);
  const pinSupervisorRef = useRef<HTMLInputElement>(null);
  const usbInputRef = useRef<HTMLInputElement>(null); // Referencia para el input USB
  const cargaRef = useRef<HTMLInputElement>(null);

  // Control de inactividad
  const resetTimerInactividad = useCallback(() => {
    if (timerInactividadRef.current) clearTimeout(timerInactividadRef.current);
    const tiempoLimite = Number(config.timer_inactividad) || 120000;
    timerInactividadRef.current = setTimeout(() => {
      if (scannerRef.current?.isScanning) scannerRef.current.stop();
      localStorage.clear();
      router.push('/');
    }, tiempoLimite);
  }, [config.timer_inactividad, router]);

  useEffect(() => {
    const eventos = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    const reset = () => resetTimerInactividad();
    eventos.forEach((e) => document.addEventListener(e, reset));
    resetTimerInactividad();
    return () => {
      eventos.forEach((e) => document.removeEventListener(e, reset));
      if (timerInactividadRef.current) clearTimeout(timerInactividadRef.current);
    };
  }, [resetTimerInactividad]);

  // Función para actualizar GPS
  const actualizarGPS = useCallback(async () => {
    try {
      const location = await getCurrentLocation();
      
      if (location) {
        setUbicacionActual(location);
        setGps(prev => ({ ...prev, lat: location.lat, lon: location.lng }));
        
        const d = calcularDistancia(
          location.lat,
          location.lng,
          config.lat,
          config.lon
        );
        
        setGps(prev => ({ ...prev, dist: Math.round(d) }));
        setErrorGps('');
      } else {
        setErrorGps('No se pudo obtener ubicación');
      }
    } catch (error) {
      console.error('Error en actualizarGPS:', error);
      setErrorGps('Error de señal GPS');
    }
  }, [config.lat, config.lon]);

  // Carga inicial
  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) {
      router.push('/');
      return;
    }
    setUser(JSON.parse(sessionData));

    const loadConfig = async () => {
      const { data } = await supabase.from('sistema_config').select('clave, valor');
      if (data) {
        const m = (data as any[]).reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        const parsedLat = parseFloat(String(m.almacen_lat).replace(/[^\d.-]/g, ''));
        const parsedLon = parseFloat(String(m.almacen_lon).replace(/[^\d.-]/g, ''));
        const parsedTimer = parseInt(m.timer_inactividad, 10);
        setConfig({
          lat: isNaN(parsedLat) ? 0 : parsedLat,
          lon: isNaN(parsedLon) ? 0 : parsedLon,
          radio: parseInt(m.radio_permitido) || 100,
          qr_exp: parseInt(m.qr_expiracion) || 30000,
          timer_inactividad: isNaN(parsedTimer) ? 120000 : parsedTimer,
        });
      }
    };
    loadConfig();

    actualizarGPS();
    const interval = setInterval(actualizarGPS, 30000);
    return () => clearInterval(interval);
  }, [router, actualizarGPS]);

  useEffect(() => {
    if (config.lat !== 0 && gps.lat !== 0) {
      const d = calcularDistancia(gps.lat, gps.lon, config.lat, config.lon);
      setGps((prev) => ({ ...prev, dist: Math.round(d) }));
    }
  }, [gps.lat, gps.lon, config]);

  // VERSIÓN MEJORADA DE PROCESAR QR
  const procesarQR = (texto: string): { tipo: string; docId: string; timestamp: number } | null => {
    if (!texto || texto.trim() === '') return null;
    
    // Limpiar el texto de caracteres extraños
    const cleanText = texto.replace(/[\n\r\t\s]/g, '').trim();
    
    console.log('🔍 Procesando QR:', { original: texto, limpio: cleanText });
    
    try {
      // Intentar decodificar Base64
      let decoded: string;
      try {
        decoded = atob(cleanText);
      } catch {
        // Si falla, intentar decodificar con manejo de caracteres especiales
        decoded = atob(decodeURIComponent(escape(cleanText)));
      }
      
      console.log('📝 QR decodificado:', decoded);
      
      // Dividir por el separador |
      const partes = decoded.split('|');
      console.log('🔪 Partes:', partes);
      
      if (partes.length === 3) {
        const [tipo, docId, timestamp] = partes;
        const ts = parseInt(timestamp, 10);
        
        if (isNaN(ts)) {
          console.error('❌ Timestamp inválido:', timestamp);
          mostrarNotificacion('QR INVÁLIDO (timestamp)', 'error');
          return null;
        }
        
        // Verificar expiración
        const tiempoExpiracion = Number(config.qr_exp) || 30000;
        if (Date.now() - ts > tiempoExpiracion) {
          mostrarNotificacion('QR EXPIRADO', 'error');
          return null;
        }
        
        // Verificar que el tipo sea válido (P o F)
        if (tipo !== 'P' && tipo !== 'F') {
          mostrarNotificacion('TIPO DE QR INVÁLIDO', 'error');
          return null;
        }
        
        console.log('✅ QR válido:', { tipo, docId, ts });
        return { tipo, docId, timestamp: ts };
      }
      
      console.error('❌ Formato QR inválido. Partes:', partes.length);
      mostrarNotificacion('QR INVÁLIDO (formato)', 'error');
      return null;
      
    } catch (error) {
      console.error('❌ Error procesando QR:', error);
      mostrarNotificacion('QR INVÁLIDO', 'error');
      return null;
    }
  };

  // Escáner de cámara
  useEffect(() => {
    if (modo === 'camara' && direccion && !lecturaLista) {
      const scanner = new Html5Qrcode('reader');
      scannerRef.current = scanner;
      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 20, qrbox: { width: 250, height: 250 } },
          (decoded) => {
            console.log('📷 QR detectado (raw):', decoded);
            console.log('📷 QR length:', decoded.length);
            console.log('📷 QR char codes:', Array.from(decoded).map(c => c.charCodeAt(0)));
            
            const info = procesarQR(decoded);
            console.log('📷 QR procesado:', info);
            
            if (info) {
              setQrInfo(info);
              setQrData(info.docId);
              setLecturaLista(true);
              setPinAutorizador('');
              scanner.stop();
            }
          },
          (errorMessage) => {
            if (!errorMessage.includes('No MultiFormat Readers')) {
              console.log('Error de escaneo:', errorMessage);
            }
          }
        )
        .catch((error) => {
          console.error('Error al iniciar escáner:', error);
        });
        
      return () => {
        if (scannerRef.current?.isScanning) {
          scannerRef.current.stop().catch(() => {});
        }
      };
    }
  }, [modo, direccion, lecturaLista, config.qr_exp]);

  // Modo manual
  const iniciarModoManual = () => {
    setModo('manual');
    setPasoManual(0);
    setQrData('');
    setQrInfo(null);
    setPinEmpleado('');
    setPinAutorizador('');
    setLecturaLista(false);
    setFlotaSalida({ activo: false, cant_carga: 0, observacion: '' });
  };

  useEffect(() => {
    if (modo !== 'manual' || direccion === null || pasoManual !== 0) {
      if (enterListenerRef.current) {
        document.removeEventListener('keydown', enterListenerRef.current);
        enterListenerRef.current = null;
      }
    }
  }, [modo, direccion, pasoManual]);

  useEffect(() => {
    if (modo === 'manual' && direccion && pasoManual === 0) {
      const handleEnter = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          setPasoManual(1);
          setTimeout(() => documentoRef.current?.focus(), 100);
        }
      };
      enterListenerRef.current = handleEnter;
      document.addEventListener('keydown', handleEnter);
      return () => {
        if (enterListenerRef.current) {
          document.removeEventListener('keydown', enterListenerRef.current);
          enterListenerRef.current = null;
        }
      };
    }
  }, [modo, direccion, pasoManual]);

  useEffect(() => {
    if (modo !== 'manual' || !direccion) setPasoManual(0);
  }, [modo, direccion]);

  // Función de reseteo por modo
  const resetearPorModo = (modoActual: 'usb' | 'camara' | 'manual', errorTipo?: string) => {
    setAnimar(false);
    
    if (modoActual === 'usb' || modoActual === 'camara') {
      setLecturaLista(false);
      setQrData('');
      setQrInfo(null);
      setPinAutorizador('');
      
      if (errorTipo === 'pin_supervisor') {
        setTimeout(() => {
          const pinInput = document.querySelector('input[placeholder="PIN SUPERVISOR"]') as HTMLInputElement;
          if (pinInput) pinInput.focus();
        }, 100);
      } else {
        setTimeout(() => {
          if (modoActual === 'usb' && usbInputRef.current) {
            usbInputRef.current.value = '';
            usbInputRef.current.focus();
          }
        }, 500);
      }
    } else if (modoActual === 'manual') {
      if (errorTipo === 'pin_trabajador') {
        setPasoManual(2);
        setPinEmpleado('');
        setTimeout(() => pinEmpleadoRef.current?.focus(), 100);
      } else if (errorTipo === 'pin_administrador') {
        setPasoManual(3);
        setPinAutorizador('');
        setTimeout(() => pinSupervisorRef.current?.focus(), 100);
      } else {
        setPasoManual(1);
        setQrData('');
        setPinEmpleado('');
        setPinAutorizador('');
        setTimeout(() => documentoRef.current?.focus(), 100);
      }
    }
  };

  // Mostrar notificación
  const mostrarNotificacion = (mensaje: string, tipo: 'exito' | 'error' | 'advertencia' | 'info') => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => setNotificacion({ mensaje: '', tipo: null }), 6000);
  };

  // Navegación
  const volverUnNivel = () => {
    console.log('Nivel actual:', { modo, direccion, lecturaLista, pasoManual, modalFlotaVisible });
    
    if (modalFlotaVisible) {
      setModalFlotaVisible(false);
      setFlotaTempData({ cant_carga: 0, observacion: '' });
      setRegistroPendiente(null);
      return;
    }
    
    if (modo === 'manual') {
      if (pasoManual === 3) {
        setPasoManual(2);
        setPinAutorizador('');
        return;
      }
      if (pasoManual === 2) {
        setPasoManual(1);
        setPinEmpleado('');
        return;
      }
      if (pasoManual === 1) {
        setPasoManual(0);
        setQrData('');
        return;
      }
      if (pasoManual === 0) {
        router.push('/selector');
        return;
      }
    }
    
    if (lecturaLista || (modo === 'usb' && qrData)) {
      setLecturaLista(false);
      setQrData('');
      setQrInfo(null);
      setPinAutorizador('');
      
      if (modo === 'usb') {
        const inputElement = usbInputRef.current;
        setTimeout(() => {
          if (inputElement) {
            inputElement.value = '';
            inputElement.focus();
          }
        }, 100);
      }
      return;
    }
    
    if (modo !== 'menu') {
      setModo('menu');
      setDireccion(null);
      return;
    }
    
    router.push('/selector');
  };

  const volverAlSelector = () => {
    if (scannerRef.current?.isScanning) scannerRef.current.stop();
    setModo('menu');
    setDireccion(null);
    setQrData('');
    setQrInfo(null);
    setPinEmpleado('');
    setPinAutorizador('');
    setFlotaSalida({ activo: false, cant_carga: 0, observacion: '' });
    setPasoManual(0);
    setLecturaLista(false);
    setModalFlotaVisible(false);
    setRegistroPendiente(null);
    router.push('/');
  };

  // Funciones para modal de flota
  const confirmarSalidaFlota = () => {
    setFlotaSalida({ 
      activo: true, 
      cant_carga: flotaTempData.cant_carga, 
      observacion: flotaTempData.observacion 
    });
    setModalFlotaVisible(false);
    registrarAccesoConDatosFlota();
  };

  const cancelarSalidaFlota = () => {
    setModalFlotaVisible(false);
    setFlotaTempData({ cant_carga: 0, observacion: '' });
    setRegistroPendiente(null);
    setAnimar(false);
    setLecturaLista(false);
    setQrData('');
    setQrInfo(null);
    setPinAutorizador('');
    
    if (modo === 'usb') {
      const inputElement = usbInputRef.current;
      setTimeout(() => {
        if (inputElement) {
          inputElement.value = '';
          inputElement.focus();
        }
      }, 100);
    }
  };

  const registrarAccesoConDatosFlota = async () => {
    if (!registroPendiente) return;
    
    setAnimar(true);
    const ahora = new Date().toISOString();
    const { registro, autorizador } = registroPendiente;

    try {
      const { data: accesoActivo } = await supabase
        .from('flota_accesos')
        .select('*')
        .eq('perfil_id', registro.id)
        .is('hora_salida', null)
        .order('hora_llegada', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!accesoActivo) throw new Error('No hay acceso activo');

      const { error: updErr } = await (supabase as any)
        .from('flota_accesos')
        .update({
          hora_salida: ahora,
          cant_carga: flotaSalida.cant_carga,
          observacion: flotaSalida.observacion,
          estado: 'despachado',
        })
        .eq('id', (accesoActivo as any).id);

      if (updErr) throw updErr;

      mostrarNotificacion('SALIDA DE FLOTA REGISTRADA ✅', 'exito');
      setFlotaSalida({ activo: false, cant_carga: 0, observacion: '' });
      setRegistroPendiente(null);

      const inputElement = modo === 'usb' ? usbInputRef.current : null;
      setTimeout(() => {
        setLecturaLista(false);
        setQrData('');
        setQrInfo(null);
        setPinAutorizador('');
        
        if (inputElement) {
          inputElement.value = '';
          inputElement.focus();
        }
      }, 2000);

    } catch (e: any) {
      console.error('Error inesperado:', e);
      mostrarNotificacion(`ERROR: ${e.message}`, 'error');
      
      setLecturaLista(false);
      setQrData('');
      setQrInfo(null);
      setPinAutorizador('');
      
      resetearPorModo(modo as 'usb' | 'camara' | 'manual');
    } finally {
      setAnimar(false);
    }
  };

  // Registrar acceso
  const registrarAcceso = async () => {
    if (gps.dist > config.radio) {
      mostrarNotificacion(`FUERA DE RANGO: ${gps.dist}m`, 'error');
      resetearPorModo(modo as 'usb' | 'camara' | 'manual');
      return;
    }

    setAnimar(true);

    const ahora = new Date().toISOString();
    const inputBusqueda = qrData.trim();

    if (!inputBusqueda) {
      mostrarNotificacion('ERROR: DOCUMENTO VACÍO', 'error');
      resetearPorModo(modo as 'usb' | 'camara' | 'manual');
      return;
    }

    let tipo = '';
    if (modo === 'manual') {
      tipo = 'desconocido';
    } else {
      if (qrInfo) {
        tipo = qrInfo.tipo;
      } else {
        mostrarNotificacion('ERROR: Información de QR no disponible', 'error');
        setAnimar(false);
        resetearPorModo(modo as 'usb' | 'camara' | 'manual');
        return;
      }
    }

    let registro = null;

    if (modo === 'manual') {
      const { data: emp } = await supabase
        .from('empleados')
        .select('id, nombre, pin_seguridad, activo, documento_id, email')
        .or(`documento_id.ilike.%${inputBusqueda}%,email.ilike.%${inputBusqueda.toLowerCase()}%`)
        .maybeSingle();
      
      if (emp && typeof emp === 'object') {
        registro = { ...(emp as any), tipo: 'empleado' };
      } else {
        const { data: flota } = await supabase
          .from('flota_perfil')
          .select('*')
          .eq('documento_id', inputBusqueda)
          .maybeSingle();
        
        if (flota && typeof flota === 'object') {
          registro = { ...(flota as any), tipo: 'flota' };
        }
      }
    } else {
      if (tipo === 'P') {
        const { data: emp, error: empErr } = await supabase
          .from('empleados')
          .select('id, nombre, pin_seguridad, activo, documento_id, email')
          .or(`documento_id.ilike.%${inputBusqueda}%,email.ilike.%${inputBusqueda.toLowerCase()}%`)
          .maybeSingle();
        if (empErr) {
          mostrarNotificacion(`ERROR DB: ${empErr.message}`, 'error');
          setAnimar(false);
          resetearPorModo(modo as 'usb' | 'camara' | 'manual');
          return;
        }
        if (emp && typeof emp === 'object') {
          registro = { ...(emp as any), tipo: 'empleado' };
        }
      } else if (tipo === 'F') {
        const { data: flota, error: flotaErr } = await supabase
          .from('flota_perfil')
          .select('*')
          .eq('documento_id', inputBusqueda)
          .maybeSingle();
        if (flotaErr) {
          mostrarNotificacion(`ERROR DB: ${flotaErr.message}`, 'error');
          setAnimar(false);
          resetearPorModo(modo as 'usb' | 'camara' | 'manual');
          return;
        }
        if (flota && typeof flota === 'object') {
          registro = { ...(flota as any), tipo: 'flota' };
        }
      }
    }

    if (!registro) {
      mostrarNotificacion('ID NO REGISTRADO', 'error');
      setAnimar(false);
      resetearPorModo(modo as 'usb' | 'camara' | 'manual');
      return;
    }

    if (registro.tipo === 'empleado' && !registro.documento_id) {
      mostrarNotificacion('EMPLEADO SIN DOCUMENTO ID', 'error');
      setAnimar(false);
      resetearPorModo(modo as 'usb' | 'camara' | 'manual');
      return;
    }
    if (registro.tipo === 'empleado' && !registro.activo) {
      mostrarNotificacion('EMPLEADO INACTIVO', 'error');
      setAnimar(false);
      resetearPorModo(modo as 'usb' | 'camara' | 'manual');
      return;
    }
    if (registro.tipo === 'flota' && !registro.activo) {
      mostrarNotificacion('PERFIL DE FLOTA INACTIVO', 'error');
      setAnimar(false);
      resetearPorModo(modo as 'usb' | 'camara' | 'manual');
      return;
    }

    if (modo === 'manual') {
      if (registro.tipo === 'empleado' && String(registro.pin_seguridad) !== String(pinEmpleado)) {
        mostrarNotificacion('PIN TRABAJADOR INCORRECTO', 'error');
        setAnimar(false);
        resetearPorModo('manual', 'pin_trabajador');
        return;
      }
      if (registro.tipo === 'flota' && String(registro.pin_secreto) !== String(pinEmpleado)) {
        mostrarNotificacion('PIN CHOFER INCORRECTO', 'error');
        setAnimar(false);
        resetearPorModo('manual', 'pin_trabajador');
        return;
      }
    }

    let autorizador = null;
    let errorAutorizador = null;

    if (modo === 'manual') {
      const result = await supabase
        .from('empleados')
        .select('nombre, rol, nivel_acceso')
        .eq('pin_seguridad', String(pinAutorizador))
        .gte('nivel_acceso', 4)
        .maybeSingle();
      
      autorizador = result.data;
      errorAutorizador = result.error;
      
      if (errorAutorizador || !autorizador) {
        mostrarNotificacion('PIN DE ADMINISTRADOR INVÁLIDO (SE REQUIERE NIVEL ≥ 4)', 'error');
        setAnimar(false);
        resetearPorModo('manual', 'pin_administrador');
        return;
      }
    } else {
      const sessionData = localStorage.getItem('user_session');
      if (!sessionData) {
        mostrarNotificacion('SESIÓN NO VÁLIDA', 'error');
        setAnimar(false);
        resetearPorModo(modo as 'usb' | 'camara', 'pin_supervisor');
        return;
      }

      const usuarioLogueado = JSON.parse(sessionData);
      
      if (usuarioLogueado.nivel_acceso < 3) {
        mostrarNotificacion('SE REQUIERE NIVEL DE ACCESO ≥ 3', 'error');
        setAnimar(false);
        resetearPorModo(modo as 'usb' | 'camara', 'pin_supervisor');
        return;
      }

      const result = await supabase
        .from('empleados')
        .select('nombre, rol, nivel_acceso')
        .eq('id', usuarioLogueado.id)
        .eq('pin_seguridad', String(pinAutorizador))
        .maybeSingle();
      
      autorizador = result.data;
      errorAutorizador = result.error;
      
      if (errorAutorizador || !autorizador) {
        mostrarNotificacion('PIN INCORRECTO', 'error');
        setAnimar(false);
        resetearPorModo(modo as 'usb' | 'camara', 'pin_supervisor');
        return;
      }
    }

    if (!autorizador || typeof autorizador !== 'object' || !('nombre' in (autorizador as any))) {
      mostrarNotificacion('ERROR: Datos de autorización inválidos', 'error');
      setAnimar(false);
      resetearPorModo(modo as 'usb' | 'camara' | 'manual');
      return;
    }

    const firma = `Autoriza ${(autorizador as any).nombre} - ${modo.toUpperCase()}`;

    // Validación de duplicidad
    if (registro.tipo === 'empleado') {
      if (direccion === 'entrada') {
        const { data: jornadaActiva } = await supabase
          .from('jornadas')
          .select('id')
          .eq('empleado_id', registro.id)
          .is('hora_salida', null)
          .maybeSingle();
        if (jornadaActiva) {
          mostrarNotificacion('YA TIENE UNA ENTRADA ACTIVA', 'advertencia');
          setAnimar(false);
          resetearPorModo(modo as 'usb' | 'camara' | 'manual');
          return;
        }
      } else {
        const { data: jornadaActiva } = await supabase
          .from('jornadas')
          .select('id')
          .eq('empleado_id', registro.id)
          .is('hora_salida', null)
          .maybeSingle();
        if (!jornadaActiva) {
          mostrarNotificacion('NO HAY ENTRADA REGISTRADA', 'advertencia');
          setAnimar(false);
          resetearPorModo(modo as 'usb' | 'camara' | 'manual');
          return;
        }
      }
    } else if (registro.tipo === 'flota') {
      if (direccion === 'entrada') {
        const { data: accesoActivo } = await supabase
          .from('flota_accesos')
          .select('id')
          .eq('perfil_id', registro.id)
          .is('hora_salida', null)
          .maybeSingle();
        if (accesoActivo) {
          mostrarNotificacion('YA TIENE UNA ENTRADA ACTIVA (FLOTA)', 'advertencia');
          setAnimar(false);
          resetearPorModo(modo as 'usb' | 'camara' | 'manual');
          return;
        }
      } else {
        const { data: accesoActivo } = await supabase
          .from('flota_accesos')
          .select('id')
          .eq('perfil_id', registro.id)
          .is('hora_salida', null)
          .maybeSingle();
        if (!accesoActivo) {
          mostrarNotificacion('NO HAY ENTRADA REGISTRADA (FLOTA)', 'advertencia');
          setAnimar(false);
          resetearPorModo(modo as 'usb' | 'camara' | 'manual');
          return;
        }
      }
    }

    try {
      if (registro.tipo === 'empleado') {
        if (direccion === 'entrada') {
          const { error: insErr } = await (supabase as any)
            .from('jornadas')
            .insert([{
              empleado_id: registro.id,
              nombre_empleado: registro.nombre,
              hora_entrada: ahora,
              autoriza_entrada: firma,
              estado: 'activo',
            }]);
          if (insErr) throw insErr;
          
          await (supabase as any)
            .from('empleados')
            .update({ en_almacen: true, ultimo_ingreso: ahora })
            .eq('id', registro.id);
            
          mostrarNotificacion('ENTRADA REGISTRADA ✅', 'exito');
        } else {
          const { data: j } = await supabase
            .from('jornadas')
            .select('*')
            .eq('empleado_id', registro.id)
            .is('hora_salida', null)
            .order('hora_entrada', { ascending: false })
            .limit(1)
            .maybeSingle();
            
          if (!j) throw new Error('No se encontró entrada activa');
          
          if (j && typeof j === 'object' && 'hora_entrada' in (j as any)) {
            const horas = parseFloat(((Date.now() - new Date((j as any).hora_entrada).getTime()) / 3600000).toFixed(2));
            
            const { error: updErr } = await (supabase as any)
              .from('jornadas')
              .update({
                hora_salida: ahora,
                horas_trabajadas: horas,
                autoriza_salida: firma,
                estado: 'finalizado',
              })
              .eq('id', (j as any).id);
              
            if (updErr) throw updErr;
            
            await (supabase as any)
              .from('empleados')
              .update({ en_almacen: false, ultima_salida: ahora })
              .eq('id', registro.id);
              
            mostrarNotificacion('SALIDA REGISTRADA ✅', 'exito');
          } else {
            throw new Error('Datos de jornada inválidos');
          }
        }

        const inputElement = modo === 'usb' ? usbInputRef.current : null;
        setTimeout(() => {
          setLecturaLista(false);
          setQrData('');
          setQrInfo(null);
          setPinAutorizador('');
          
          if (inputElement) {
            inputElement.value = '';
            inputElement.focus();
          }
        }, 2000);

      } else {
        if (direccion === 'entrada') {
          const { error: insErr } = await (supabase as any)
            .from('flota_accesos')
            .insert([{
              perfil_id: registro.id,
              nombre_completo: registro.nombre_completo,
              documento_id: registro.documento_id,
              cant_choferes: registro.cant_choferes,
              hora_llegada: ahora,
              estado: 'en_patio',
              autorizado_por: (autorizador as any).nombre,
            }]);
            
          if (insErr) throw insErr;
          mostrarNotificacion('ENTRADA DE FLOTA REGISTRADA ✅', 'exito');

          const inputElement = modo === 'usb' ? usbInputRef.current : null;
          setTimeout(() => {
            setLecturaLista(false);
            setQrData('');
            setQrInfo(null);
            setPinAutorizador('');
            
            if (inputElement) {
              inputElement.value = '';
              inputElement.focus();
            }
          }, 2000);
        } else {
          setRegistroPendiente({ registro, autorizador, firma });
          setModalFlotaVisible(true);
          setFlotaTempData({ cant_carga: 0, observacion: '' });
          setAnimar(false);
          return;
        }
      }
    } catch (e: any) {
      console.error('Error inesperado:', e);
      mostrarNotificacion(`ERROR: ${e.message}`, 'error');
      
      setLecturaLista(false);
      setQrData('');
      setQrInfo(null);
      setPinAutorizador('');
      
      resetearPorModo(modo as 'usb' | 'camara' | 'manual');
    } finally {
      setAnimar(false);
    }
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      <NotificacionSistema
        mensaje={notificacion.mensaje}
        tipo={notificacion.tipo}
        visible={!!notificacion.tipo}
        duracion={3000}
        onCerrar={() => setNotificacion({ mensaje: '', tipo: null })}
      />

      <MemebreteSuperior usuario={user} />

      <ContenedorPrincipal>
        {modo === 'menu' ? (
          <div className="grid gap-3 w-full">
            <BotonOpcion
              texto="SCANNER USB"
              descripcion="Lectura mediante escáner conectado"
              icono="🔌"
              onClick={() => setModo('usb')}
              color="bg-blue-600"
            />
            <BotonOpcion
              texto="CÁMARA MÓVIL"
              descripcion="Lectura con cámara del dispositivo"
              icono="📱"
              onClick={() => setModo('camara')}
              color="bg-emerald-600"
            />
            <BotonOpcion
              texto="MANUAL"
              descripcion="Ingreso manual de datos"
              icono="🖋️"
              onClick={iniciarModoManual}
              color="bg-slate-700"
            />
            <div className="flex flex-col gap-2 mt-4">
              <button
                onClick={volverUnNivel}
                className="text-slate-500 font-bold uppercase text-[10px] tracking-widest text-center hover:text-white transition-colors"
              >
                ← VOLVER AL SELECTOR
              </button>
              <button
                onClick={volverAlSelector}
                className="text-blue-500 font-black uppercase text-[10px] tracking-[0.2em] text-center hover:text-blue-400 transition-colors"
              >
                ← SALIR
              </button>
            </div>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-3 w-full">
            <BotonOpcion
              texto="ENTRADA"
              descripcion="Registrar llegada"
              icono="🟢"
              onClick={() => setDireccion('entrada')}
              color="bg-emerald-600"
            />
            <BotonOpcion
              texto="SALIDA"
              descripcion="Registrar salida"
              icono="🔴"
              onClick={() => setDireccion('salida')}
              color="bg-rose-600"
            />
            <div className="flex flex-col gap-2 mt-4">
              <button
                onClick={volverUnNivel}
                className="text-slate-500 font-bold uppercase text-[10px] tracking-widest text-center hover:text-white transition-colors"
              >
                ← VOLVER ATRÁS
              </button>
              <button
                onClick={volverAlSelector}
                className="text-blue-500 font-black uppercase text-[10px] tracking-[0.2em] text-center hover:text-blue-400 transition-colors"
              >
                ← VOLVER AL SELECTOR
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            
            <div className="px-3 py-2 bg-black/50 rounded-xl border border-white/5 text-center">
              <p className="text-[8.5px] font-mono text-white/50 tracking-tighter">
                LAT: {gps.lat.toFixed(6)} | LON: {gps.lon.toFixed(6)} |{' '}
                <span className={gps.dist <= config.radio ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
                  {gps.dist} MTS
                </span>
              </p>
              {ubicacionActual?.source && (
                <p className="text-[7px] text-blue-500/50 mt-1">
                  Fuente: {ubicacionActual.source === 'gps' ? 'GPS' : ubicacionActual.source === 'ip' ? 'IP' : 'Caché'}
                </p>
              )}
              {errorGps && (
                <p className="text-[7px] text-rose-500/50 mt-1">{errorGps}</p>
              )}
            </div>

            {(modo === 'usb' || modo === 'camara') && (
              <>
                <div className={`bg-[#050a14] p-4 rounded-[30px] border-2 ${lecturaLista ? 'border-emerald-500' : 'border-white/10'} h-48 flex items-center justify-center relative overflow-hidden`}>
                  {!lecturaLista ? (
                    <>
                      {modo === 'camara' && <div id="reader" className="w-full h-full" />}
                      {modo === 'usb' && (
                        <input
                          ref={usbInputRef}
                          autoFocus
                          className="bg-transparent text-center text-lg font-black text-blue-500 outline-none w-full uppercase placeholder:text-white/30"
                          placeholder="ESPERANDO QR..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const inputValue = (e.target as HTMLInputElement).value;
                              console.log('📟 USB input value:', inputValue);
                              const info = procesarQR(inputValue);
                              if (info) {
                                setQrInfo(info);
                                setQrData(info.docId);
                                setLecturaLista(true);
                                setPinAutorizador('');
                              } else {
                                (e.target as HTMLInputElement).value = '';
                              }
                            }
                          }}
                        />
                      )}
                      <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_15px_red] animate-scan-laser" />
                    </>
                  ) : (
                    <p className="text-emerald-500 font-black text-2xl uppercase italic animate-bounce">OK ✅</p>
                  )}
                </div>

                {(lecturaLista || (modo === 'usb' && qrData)) && (
                  <CampoEntrada
                    ref={pinSupervisorRef}
                    tipo="password"
                    placeholder="PIN SUPERVISOR"
                    valor={pinAutorizador}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPinAutorizador(e.target.value)}
                    onEnter={registrarAcceso}
                    autoFocus
                    mayusculas
                  />
                )}

                <div className="flex flex-col gap-2">
                  <BotonAccion
                    texto={animar ? 'PROCESANDO...' : 'CONFIRMAR REGISTRO'}
                    icono="✅"
                    onClick={registrarAcceso}
                    disabled={animar || (!lecturaLista && modo !== 'usb')}
                    loading={animar}
                  />
                  <BotonAccion
                    texto="CANCELAR"
                    icono="✕"
                    onClick={volverUnNivel}
                    color="bg-slate-600"
                  />
                </div>
              </>
            )}

            {modo === 'manual' && (
              <>
                {pasoManual === 0 && (
                  <div className="bg-amber-500/20 border-2 border-amber-500 p-6 rounded-2xl text-center animate-pulse">
                    <span className="text-amber-500 text-2xl block mb-2">⚠️</span>
                    <p className="text-amber-500 font-black text-[13px] uppercase tracking-widest">
                      Este proceso requiere la validación de un Administrador (Nivel ≥ 4)
                    </p>
                    <p className="text-amber-400/80 text-[10px] uppercase tracking-wider mt-4">
                      Presione ENTER para continuar
                    </p>
                    <button
                      onClick={volverUnNivel}
                      className="mt-4 text-amber-500 font-bold uppercase text-[9px] tracking-widest hover:text-amber-400 transition-colors"
                    >
                      ← CANCELAR
                    </button>
                  </div>
                )}

                {pasoManual === 1 && (
                  <CampoEntrada
                    ref={documentoRef}
                    tipo="text"
                    placeholder="DOCUMENTO / CORREO"
                    valor={qrData}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setQrData(e.target.value)}
                    onEnter={() => {
                      if (qrData.trim()) {
                        setPasoManual(2);
                        setTimeout(() => pinEmpleadoRef.current?.focus(), 100);
                      }
                    }}
                    autoFocus
                    textoCentrado
                    mayusculas
                  />
                )}

                {pasoManual === 2 && (
                  <CampoEntrada
                    ref={pinEmpleadoRef}
                    tipo="password"
                    placeholder="PIN TRABAJADOR"
                    valor={pinEmpleado}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPinEmpleado(e.target.value)}
                    onEnter={() => {
                      if (pinEmpleado.trim()) {
                        setPasoManual(3);
                        setTimeout(() => pinSupervisorRef.current?.focus(), 100);
                      }
                    }}
                    autoFocus
                    textoCentrado
                    mayusculas
                  />
                )}

                {pasoManual === 3 && (
                  <CampoEntrada
                    ref={pinSupervisorRef}
                    tipo="password"
                    placeholder="PIN ADMINISTRADOR"
                    valor={pinAutorizador}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPinAutorizador(e.target.value)}
                    onEnter={() => {
                      if (pinAutorizador.trim()) {
                        registrarAcceso();
                      }
                    }}
                    autoFocus
                    textoCentrado
                    mayusculas
                  />
                )}

                {pasoManual > 0 && pasoManual < 3 && (
                  <button
                    onClick={volverUnNivel}
                    className="w-full text-center text-slate-500 font-bold uppercase text-[9px] tracking-widest hover:text-white transition-colors mt-2"
                  >
                    ← CANCELAR
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </ContenedorPrincipal>

      <ModalFlotaSalida
        visible={modalFlotaVisible}
        onConfirmar={confirmarSalidaFlota}
        onCancelar={cancelarSalidaFlota}
        cantCarga={flotaTempData.cant_carga}
        setCantCarga={(valor) => setFlotaTempData(prev => ({ ...prev, cant_carga: valor }))}
        observacion={flotaTempData.observacion}
        setObservacion={(valor) => setFlotaTempData(prev => ({ ...prev, observacion: valor }))}
        loading={animar}
      />

      <style jsx global>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        @keyframes flash-fast {
          0%, 100% { opacity: 1; }
          10%, 30%, 50% { opacity: 0; }
          20%, 40%, 60% { opacity: 1; }
        }
        .animate-flash-fast {
          animation: flash-fast 2s ease-in-out;
        }
        @keyframes scan-laser {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        .animate-scan-laser {
          animation: scan-laser 2s linear infinite;
        }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-bounce { animation: bounce 1s infinite; }
        @keyframes modal-appear {
          0% { opacity: 0; transform: scale(0.9) translateY(20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modal-appear {
          animation: modal-appear 0.3s ease-out;
        }
      `}</style>
    </main>
  );
}