'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ------------------------------------------------------------
// COMPONENTES VISUALES INTERNOS – ESTILO UNIFICADO EXACTO
// ------------------------------------------------------------

// ----- MEMBRETE SUPERIOR -----
const MemebreteSuperior = ({
  titulo,
  subtitulo,
  usuario,
  conAnimacion = false,
  mostrarUsuario = true
}: {
  titulo: string;
  subtitulo: string;
  usuario?: any;
  conAnimacion?: boolean;
  mostrarUsuario?: boolean;
}) => {
  const renderTituloBicolor = (texto: string) => {
    const palabras = texto.split(' ');
    const ultimaPalabra = palabras.pop();
    const primerasPalabras = palabras.join(' ');
    return (
      <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-2">
        <span className="text-white">{primerasPalabras} </span>
        <span className="text-blue-700">{ultimaPalabra}</span>
      </h1>
    );
  };

  return (
    <div className="w-full max-w-sm bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 mb-4 text-center shadow-2xl">
      {renderTituloBicolor(titulo)}
      <p className={`text-white font-bold text-[17px] uppercase tracking-widest mb-3 ${conAnimacion ? 'animate-pulse-slow' : ''}`}>
        {subtitulo}
      </p>
      {mostrarUsuario && usuario && (
        <div className="mt-2 pt-2 border-t border-white/10">
          <span className="text-sm text-white normal-case">{usuario.nombre}</span>
          <span className="text-sm text-white mx-2">•</span>
          <span className="text-sm text-blue-500 normal-case">
            {usuario.rol === 'admin' || usuario.rol === 'Administrador'
              ? 'Administración'
              : usuario.rol?.toUpperCase() || 'Supervisor'}
          </span>
          <span className="text-sm text-white ml-2">({usuario.nivel_acceso})</span>
        </div>
      )}
    </div>
  );
};

// ----- BOTÓN DE OPCIÓN CON DESCRIPCIÓN (CÍRCULO + EMOJI + TEXTO + DESCRIPCIÓN) -----
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

// ----- BOTÓN DE ACCIÓN (CONFIRMAR / CANCELAR) -----
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

// ----- NOTIFICACIÓN DE SISTEMA -----
const NotificacionSistema = ({
  mensaje,
  tipo,
  visible,
  duracion = 3000,
  onCerrar
}: {
  mensaje: string;
  tipo: 'exito' | 'error' | 'advertencia' | 'info' | null;
  visible: boolean;
  duracion?: number;
  onCerrar?: () => void;
}) => {
  const [mostrar, setMostrar] = useState(visible);

  useEffect(() => {
    setMostrar(visible);
    if (visible && duracion > 0) {
      const timer = setTimeout(() => {
        setMostrar(false);
        onCerrar?.();
      }, duracion);
      return () => clearTimeout(timer);
    }
  }, [visible, duracion, onCerrar]);

  if (!mostrar) return null;

  const colores = {
    exito: 'bg-emerald-500 border-emerald-400',
    error: 'bg-rose-500 border-rose-400',
    advertencia: 'bg-amber-500 border-amber-400',
    info: 'bg-blue-500 border-blue-400',
  };
  const iconos = {
    exito: '✅',
    error: '❌',
    advertencia: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-xl
        font-bold text-sm shadow-2xl animate-flash-fast max-w-[90%] text-center
        border-2 ${colores[tipo!]} text-white flex items-center gap-3`}
    >
      <span className="text-lg">{iconos[tipo!]}</span>
      <span>{mensaje}</span>
    </div>
  );
};

// ----- CAMPO DE ENTRADA (con opción mayusculas) -----
const CampoEntrada = React.forwardRef<HTMLInputElement, {
  tipo?: 'text' | 'password' | 'email' | 'number' | 'date';
  placeholder?: string;
  valor: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
  disabled?: boolean;
  textoCentrado?: boolean;
  mayusculas?: boolean;
  className?: string;
}>(({
  tipo = 'text',
  placeholder = '',
  valor,
  onChange,
  onEnter,
  autoFocus = false,
  disabled = false,
  textoCentrado = true,
  mayusculas = false,
  className = ''
}, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newVal = e.target.value;
    if (mayusculas) {
      newVal = newVal.toUpperCase();
    }
    // Llamar al onChange original con el valor modificado
    onChange({
      ...e,
      target: { ...e.target, value: newVal }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onEnter) onEnter();
  };

  return (
    <input
      ref={ref}
      type={tipo}
      placeholder={placeholder}
      value={valor}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      autoFocus={autoFocus}
      disabled={disabled}
      className={`w-full bg-white/5 border border-white/10 p-3 rounded-xl 
        text-[11px] font-bold text-white outline-none transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${textoCentrado ? 'text-center' : ''} 
        ${mayusculas ? 'uppercase' : ''}
        ${tipo === 'password' ? 'tracking-[0.4em]' : ''}
        focus:border-blue-500/50 hover:border-white/20
        ${className}`}
    />
  );
});
CampoEntrada.displayName = 'CampoEntrada';

// ----- CONTENEDOR PRINCIPAL -----
const ContenedorPrincipal = ({
  children,
  maxWidth = 'sm',
  padding = 'md',
  className = ''
}: {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) => {
  const ancho = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full'
  };
  const espaciado = {
    sm: 'p-4',
    md: 'p-8',
    lg: 'p-10',
    xl: 'p-12'
  };
  return (
    <div className={`w-full ${ancho[maxWidth]} bg-[#111111] ${espaciado[padding]} 
      rounded-[35px] border border-white/5 shadow-2xl ${className}`}>
      {children}
    </div>
  );
};

// ----- FOOTER (SIN LÍNEA SUPERIOR) -----
const Footer = ({ router }: { router: any }) => (
  <div className="w-full max-w-sm mt-8 pt-4 text-center">
    <p className="text-[9px] text-white/40 uppercase tracking-widest mb-4">
      @Copyright 2026
    </p>
    <button
      onClick={() => router.push('/')}
      className="text-blue-500 font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 mx-auto active:scale-95 transition-transform"
    >
      <span className="text-lg">←</span> VOLVER AL SELECTOR
    </button>
  </div>
);

// ------------------------------------------------------------
// FUNCIÓN AUXILIAR: Calcular distancia GPS
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

// ------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------------------
export default function SupervisorPage() {
  // Estados de UI
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pinEmpleado, setPinEmpleado] = useState('');
  const [pinAutorizador, setPinAutorizador] = useState('');
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = useState(false);
  const [notificacion, setNotificacion] = useState<{
    mensaje: string;
    tipo: 'exito' | 'error' | 'advertencia' | 'info' | null;
  }>({ mensaje: '', tipo: null });

  // Estados para modo manual (flujo secuencial)
  const [pasoManual, setPasoManual] = useState<0 | 1 | 2 | 3>(0);
  const enterListenerRef = useRef<((e: KeyboardEvent) => void) | null>(null);

  // Estados de datos
  const [user, setUser] = useState<any>(null);
  const [config, setConfig] = useState<any>({
    lat: 0,
    lon: 0,
    radio: 100,
    qr_exp: 30000,
    timer_inactividad: 120000
  });
  const [gps, setGps] = useState({ lat: 0, lon: 0, dist: 999999 });

  // Refs
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const timerInactividadRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const documentoRef = useRef<HTMLInputElement>(null);
  const pinEmpleadoRef = useRef<HTMLInputElement>(null);
  const pinSupervisorRef = useRef<HTMLInputElement>(null);

  // --------------------------------------------------------
  // 1. CONTROL DE INACTIVIDAD
  // --------------------------------------------------------
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

  // --------------------------------------------------------
  // 2. CARGA INICIAL
  // --------------------------------------------------------
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
        const m = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
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

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGps((prev) => ({ ...prev, lat: pos.coords.latitude, lon: pos.coords.longitude }));
      },
      null,
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [router]);

  useEffect(() => {
    if (config.lat !== 0 && gps.lat !== 0) {
      const d = calcularDistancia(gps.lat, gps.lon, config.lat, config.lon);
      setGps((prev) => ({ ...prev, dist: Math.round(d) }));
    }
  }, [gps.lat, gps.lon, config]);

  // --------------------------------------------------------
  // 3. PROCESAMIENTO DEL QR (solo usb/cámara)
  // --------------------------------------------------------
  const procesarQR = (texto: string): string => {
    console.log('🔵 TEXTO QR CRUDO:', texto);
    if (!texto || texto.trim() === '') return '';
    const cleanText = texto.replace(/[\n\r]/g, '').trim();
    try {
      const decoded = atob(cleanText);
      if (decoded.includes('|')) {
        const [docId, timestamp] = decoded.split('|');
        const tiempoExpiracion = parseInt(timestamp);
        if (isNaN(tiempoExpiracion)) {
          mostrarNotificacion('QR INVÁLIDO', 'error');
          return '';
        }
        if (Date.now() - tiempoExpiracion > config.qr_exp) {
          mostrarNotificacion('QR EXPIRADO', 'error');
          return '';
        }
        return docId.trim();
      }
      return cleanText;
    } catch {
      return cleanText;
    }
  };

  // --------------------------------------------------------
  // 4. ESCÁNER DE CÁMARA
  // --------------------------------------------------------
  useEffect(() => {
    if (modo === 'camara' && direccion && !lecturaLista) {
      const scanner = new Html5Qrcode('reader');
      scannerRef.current = scanner;
      scanner
        .start(
          { facingMode: 'environment' },
          { fps: 20, qrbox: { width: 250, height: 250 } },
          (decoded) => {
            const doc = procesarQR(decoded);
            if (doc) {
              setQrData(doc);
              setLecturaLista(true);
              scanner.stop();
            }
          },
          () => {}
        )
        .catch(() => {});
      return () => {
        if (scannerRef.current?.isScanning) scannerRef.current.stop();
      };
    }
  }, [modo, direccion, lecturaLista, config.qr_exp]);

  // --------------------------------------------------------
  // 5. MODO MANUAL
  // --------------------------------------------------------
  const iniciarModoManual = () => {
    setModo('manual');
    setPasoManual(0);
    setQrData('');
    setPinEmpleado('');
    setPinAutorizador('');
    setLecturaLista(false);
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

  // --------------------------------------------------------
  // 6. REGISTRAR ACCESO (EMPLEADOS)
  // --------------------------------------------------------
  const registrarAcceso = async () => {
    if (gps.dist > config.radio) {
      mostrarNotificacion(`FUERA DE RANGO: ${gps.dist}m`, 'error');
      setTimeout(resetLectura, 2000);
      return;
    }

    setAnimar(true);
    const ahora = new Date().toISOString();
    const inputBusqueda = qrData.trim();

    if (!inputBusqueda) {
      mostrarNotificacion('ERROR: DOCUMENTO VACÍO', 'error');
      setAnimar(false);
      setTimeout(resetLectura, 2000);
      return;
    }

    const { data: emp, error: empErr } = await supabase
      .from('empleados')
      .select('id, nombre, pin_seguridad, activo, documento_id, email')
      .or(`documento_id.ilike.%${inputBusqueda}%,email.ilike.%${inputBusqueda.toLowerCase()}%`)
      .maybeSingle();

    if (empErr) {
      mostrarNotificacion(`ERROR DB: ${empErr.message}`, 'error');
      setAnimar(false);
      setTimeout(resetLectura, 2000);
      return;
    }
    if (!emp) {
      mostrarNotificacion('ID NO REGISTRADO', 'error');
      setAnimar(false);
      setTimeout(resetLectura, 2000);
      return;
    }
    if (!emp.documento_id) {
      mostrarNotificacion('EMPLEADO SIN DOCUMENTO ID', 'error');
      setAnimar(false);
      setTimeout(resetLectura, 2000);
      return;
    }
    if (!emp.activo) {
      mostrarNotificacion('EMPLEADO INACTIVO', 'error');
      setAnimar(false);
      setTimeout(resetLectura, 2000);
      return;
    }
    if (modo === 'manual' && String(emp.pin_seguridad) !== String(pinEmpleado)) {
      mostrarNotificacion('PIN TRABAJADOR INCORRECTO', 'error');
      setAnimar(false);
      return;
    }

    const { data: aut, error: autErr } = await supabase
      .from('empleados')
      .select('nombre')
      .eq('pin_seguridad', String(pinAutorizador))
      .in('rol', ['supervisor', 'admin', 'Administrador'])
      .maybeSingle();

    if (autErr || !aut) {
      mostrarNotificacion('PIN SUPERVISOR INVÁLIDO', 'error');
      setAnimar(false);
      return;
    }

    const firma = `Autoriza ${aut.nombre} - ${modo.toUpperCase()}`;

    if (direccion === 'entrada') {
      const { data: jornadaActiva } = await supabase
        .from('jornadas')
        .select('id')
        .eq('empleado_id', emp.id)
        .is('hora_salida', null)
        .maybeSingle();
      if (jornadaActiva) {
        mostrarNotificacion('YA TIENE UNA ENTRADA ACTIVA', 'advertencia');
        setAnimar(false);
        setTimeout(resetLectura, 2000);
        return;
      }
      const { error: insErr } = await supabase.from('jornadas').insert([{
        empleado_id: emp.id,
        nombre_empleado: emp.nombre,
        hora_entrada: ahora,
        autoriza_entrada: firma,
        estado: 'activo',
      }]);
      if (insErr) {
        mostrarNotificacion(`FALLO AL GRABAR: ${insErr.message}`, 'error');
        setAnimar(false);
        setTimeout(resetLectura, 2000);
        return;
      }
      await supabase.from('empleados').update({ en_almacen: true, ultimo_ingreso: ahora }).eq('id', emp.id);
      mostrarNotificacion('ENTRADA REGISTRADA ✅', 'exito');
    } else {
      const { data: j } = await supabase
        .from('jornadas')
        .select('*')
        .eq('empleado_id', emp.id)
        .is('hora_salida', null)
        .order('hora_entrada', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!j) {
        mostrarNotificacion('SIN ENTRADA ACTIVA', 'error');
        setAnimar(false);
        setTimeout(resetLectura, 2000);
        return;
      }
      const horas = parseFloat(((Date.now() - new Date(j.hora_entrada).getTime()) / 3600000).toFixed(2));
      const { error: updErr } = await supabase.from('jornadas').update({
        hora_salida: ahora,
        horas_trabajadas: horas,
        autoriza_salida: firma,
        estado: 'finalizado',
      }).eq('id', j.id);
      if (updErr) {
        mostrarNotificacion(`FALLO SALIDA: ${updErr.message}`, 'error');
        setAnimar(false);
        setTimeout(resetLectura, 2000);
        return;
      }
      await supabase.from('empleados').update({ en_almacen: false, ultima_salida: ahora }).eq('id', emp.id);
      mostrarNotificacion('SALIDA REGISTRADA ✅', 'exito');
    }

    setTimeout(() => {
      resetLectura();
      if (modo === 'manual') {
        setPasoManual(1);
        setQrData('');
        setPinEmpleado('');
        setPinAutorizador('');
        setTimeout(() => documentoRef.current?.focus(), 100);
      }
    }, 2000);
    setAnimar(false);
  };

  // --------------------------------------------------------
  // 7. AUXILIARES
  // --------------------------------------------------------
  const resetLectura = () => {
    setQrData('');
    setLecturaLista(false);
    setPinEmpleado('');
    setPinAutorizador('');
  };

  const mostrarNotificacion = (mensaje: string, tipo: 'exito' | 'error' | 'advertencia' | 'info') => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => setNotificacion({ mensaje: '', tipo: null }), 6000);
  };

  const volverAtras = () => {
    setDireccion(null);
    resetLectura();
    setPasoManual(0);
    if (modo === 'camara' || modo === 'usb') {
      setModo('menu');
    }
  };

  // --------------------------------------------------------
  // 8. RENDERIZADO
  // --------------------------------------------------------
  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      <NotificacionSistema
        mensaje={notificacion.mensaje}
        tipo={notificacion.tipo}
        visible={!!notificacion.tipo}
      />

      <MemebreteSuperior
        titulo="GESTOR DE ACCESO"
        subtitulo={
          modo === 'menu' 
            ? 'SELECCIONE MÉTODO' 
            : direccion 
            ? `${direccion.toUpperCase()}` 
            : 'ELIJA DIRECCIÓN'
        }
        usuario={user}
        conAnimacion={false}
        mostrarUsuario={!!user}
      />

      <ContenedorPrincipal>
        {modo === 'menu' ? (
          // --- MENÚ PRINCIPAL CON DESCRIPCIONES ---
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
            <Footer router={router} />
          </div>
        ) : !direccion ? (
          // --- SELECCIÓN ENTRADA/SALIDA CON DESCRIPCIONES ---
          <div className="flex flex-col gap-3 w-full">
            <BotonOpcion
              texto="ENTRADA"
              descripcion="Registrar llegada de empleado"
              icono="🟢"
              onClick={() => setDireccion('entrada')}
              color="bg-emerald-600"
            />
            <BotonOpcion
              texto="SALIDA"
              descripcion="Registrar salida de empleado"
              icono="🔴"
              onClick={() => setDireccion('salida')}
              color="bg-rose-600"
            />
            <button
              onClick={() => {
                setModo('menu');
                setDireccion(null);
                resetLectura();
                setPasoManual(0);
              }}
              className="mt-2 text-slate-500 font-bold uppercase text-[10px] tracking-widest text-center hover:text-white transition-colors"
            >
              ← VOLVER ATRÁS
            </button>
          </div>
        ) : (
          // --- PANTALLA DE LECTURA / CAPTURA ---
          <div className="space-y-4 w-full">
            
            {/* GPS */}
            <div className="px-3 py-2 bg-black/50 rounded-xl border border-white/5 text-center">
              <p className="text-[8.5px] font-mono text-white/50 tracking-tighter">
                LAT: {gps.lat.toFixed(6)} | LON: {gps.lon.toFixed(6)} |{' '}
                <span className={gps.dist <= config.radio ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
                  {gps.dist} MTS
                </span>
              </p>
            </div>

            {/* --- MODO USB / CÁMARA --- */}
            {(modo === 'usb' || modo === 'camara') && (
              <>
                <div className={`bg-[#050a14] p-4 rounded-[30px] border-2 ${lecturaLista ? 'border-emerald-500' : 'border-white/10'} h-48 flex items-center justify-center relative overflow-hidden`}>
                  {!lecturaLista ? (
                    <>
                      {modo === 'camara' && <div id="reader" className="w-full h-full" />}
                      {modo === 'usb' && (
                        <input
                          autoFocus
                          className="bg-transparent text-center text-lg font-black text-blue-500 outline-none w-full uppercase placeholder:text-white/30"
                          placeholder="ESPERANDO QR..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const d = procesarQR((e.target as any).value);
                              if (d) {
                                setQrData(d);
                                setLecturaLista(true);
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
                    tipo="password"
                    placeholder="PIN SUPERVISOR"
                    valor={pinAutorizador}
                    onChange={(e) => setPinAutorizador(e.target.value)}
                    onEnter={registrarAcceso}
                    autoFocus
                    mayusculas={true}   // ← Forzar mayúsculas
                  />
                )}

                <div className="flex flex-col gap-2">
                  <BotonAccion
                    texto={animar ? 'PROCESANDO...' : 'CONFIRMAR REGISTRO'}
                    icono="✅"
                    onClick={registrarAcceso}
                    disabled={animar}
                    loading={animar}
                  />
                  <BotonAccion
                    texto="CANCELAR"
                    icono="✕"
                    onClick={volverAtras}
                    color="bg-slate-600"
                  />
                </div>
              </>
            )}

            {/* --- MODO MANUAL --- */}
            {modo === 'manual' && (
              <>
                {pasoManual === 0 && (
                  <div className="bg-amber-500/20 border-2 border-amber-500 p-6 rounded-2xl text-center animate-pulse">
                    <span className="text-amber-500 text-2xl block mb-2">⚠️</span>
                    <p className="text-amber-500 font-black text-[13px] uppercase tracking-widest">
                      Este proceso requiere la validación de un Administrador
                    </p>
                    <p className="text-amber-400/80 text-[10px] uppercase tracking-wider mt-4">
                      Presione ENTER para continuar
                    </p>
                  </div>
                )}

                {pasoManual === 1 && (
                  <CampoEntrada
                    ref={documentoRef}
                    tipo="text"
                    placeholder="DOCUMENTO / CORREO"
                    valor={qrData}
                    onChange={(e) => setQrData(e.target.value)}
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
                    onChange={(e) => setPinEmpleado(e.target.value)}
                    onEnter={() => {
                      if (pinEmpleado.trim()) {
                        setPasoManual(3);
                        setTimeout(() => pinSupervisorRef.current?.focus(), 100);
                      }
                    }}
                    autoFocus
                    textoCentrado
                    mayusculas={true}   // ← Forzar mayúsculas
                  />
                )}

                {pasoManual === 3 && (
                  <CampoEntrada
                    ref={pinSupervisorRef}
                    tipo="password"
                    placeholder="PIN SUPERVISOR"
                    valor={pinAutorizador}
                    onChange={(e) => setPinAutorizador(e.target.value)}
                    onEnter={() => {
                      if (pinAutorizador.trim()) {
                        registrarAcceso();
                      }
                    }}
                    autoFocus
                    textoCentrado
                    mayusculas={true}   // ← Forzar mayúsculas
                  />
                )}

                <div className="flex flex-col gap-2">
                  {pasoManual > 0 && (
                    <BotonAccion
                      texto="CANCELAR"
                      icono="✕"
                      onClick={volverAtras}
                      color="bg-slate-600"
                    />
                  )}
                  <button
                    onClick={volverAtras}
                    className="w-full text-center text-slate-500 font-bold uppercase text-[9px] tracking-widest hover:text-white transition-colors"
                  >
                    ← VOLVER ATRÁS
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </ContenedorPrincipal>
    </main>
  );
}