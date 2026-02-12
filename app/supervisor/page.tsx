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

// ----- MEMBRETE SUPERIOR (EXACTO A LA CAPTURA) -----
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
      {renderTituloBicolor('GESTOR DE ACCESO')}
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

// ----- BOTÓN DE OPCIÓN (CÍRCULO + EMOJI GRANDE, CENTRADO) -----
const BotonOpcion = ({
  texto,
  icono,
  onClick,
  color,
}: {
  texto: string;
  icono: string;
  onClick: () => void;
  color: string;
}) => {
  return (
    <button
      onClick={onClick}
      className={`w-full ${color} p-4 rounded-xl border border-white/5 
        active:scale-95 transition-transform shadow-lg 
        flex flex-col items-center justify-center gap-2`}
    >
      <div className="w-14 h-14 rounded-full bg-black/30 border border-white/20 flex items-center justify-center">
        <span className="text-3xl">{icono}</span>
      </div>
      <span className="text-white font-bold uppercase text-[11px] tracking-wider">
        {texto}
      </span>
    </button>
  );
};

// ----- BOTÓN DE ACCIÓN (para CONFIRMAR, usa mismo estilo pero sin círculo) -----
const BotonAccion = ({
  texto,
  icono,
  onClick,
  disabled = false,
  loading = false,
}: {
  texto: string;
  icono?: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full bg-blue-600 p-4 rounded-xl border border-white/5
        active:scale-95 transition-transform shadow-lg 
        flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed
        text-white font-bold uppercase text-[11px] tracking-wider`}
    >
      {icono && <span className="text-2xl">{icono}</span>}
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

// ----- NOTIFICACIÓN DE SISTEMA (sin cambios) -----
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

// ----- CAMPO DE ENTRADA (sin cambios) -----
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
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onEnter) onEnter();
  };

  return (
    <input
      ref={ref}
      type={tipo}
      placeholder={placeholder}
      value={valor}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      autoFocus={autoFocus}
      disabled={disabled}
      className={`w-full bg-white/5 border border-white/10 p-4 rounded-xl 
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

// ----- CONTENEDOR PRINCIPAL (sin cambios) -----
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

// ----- FOOTER (VOLVER AL SELECTOR, azul, sin cerrar sesión) -----
const Footer = ({ router }: { router: any }) => (
  <div className="w-full max-w-sm mt-8 pt-4 border-t border-white/5 text-center">
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

  // Estado para modo manual: advertencia de administrador
  const [manualAprobado, setManualAprobado] = useState(false);

  // Estados de datos
  const [user, setUser] = useState<any>(null);
  const [config, setConfig] = useState<any>({ lat: 0, lon: 0, radio: 100, qr_exp: 30000 });
  const [gps, setGps] = useState({ lat: 0, lon: 0, dist: 999999 });

  // Refs
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const timerInactividadRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const warningRef = useRef<HTMLInputElement>(null);

  // --------------------------------------------------------
  // 1. CONTROL DE INACTIVIDAD
  // --------------------------------------------------------
  const resetTimerInactividad = useCallback(() => {
    if (timerInactividadRef.current) clearTimeout(timerInactividadRef.current);
    timerInactividadRef.current = setTimeout(() => {
      if (scannerRef.current?.isScanning) scannerRef.current.stop();
      localStorage.clear();
      router.push('/');
    }, 90000);
  }, [router]);

  useEffect(() => {
    const eventos = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    const reset = () => resetTimerInactividad();
    eventos.forEach((e) => document.addEventListener(e, reset));
    resetTimerInactividad();
    return () => eventos.forEach((e) => document.removeEventListener(e, reset));
  }, [resetTimerInactividad]);

  // --------------------------------------------------------
  // 2. CARGA INICIAL: sesión, configuración, GPS
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
        setConfig({
          lat: isNaN(parsedLat) ? 0 : parsedLat,
          lon: isNaN(parsedLon) ? 0 : parsedLon,
          radio: parseInt(m.radio_permitido) || 100,
          qr_exp: parseInt(m.qr_expiracion) || 30000,
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
  // 3. PROCESAMIENTO DEL QR (DECODIFICAR BASE64)
  // --------------------------------------------------------
  const procesarQR = (texto: string): string => {
    console.log('🔵 TEXTO QR CRUDO:', texto);
    
    if (!texto || texto.trim() === '') {
      console.warn('⚠️ QR vacío');
      return '';
    }

    const cleanText = texto.replace(/[\n\r]/g, '').trim();
    console.log('🟡 TEXTO LIMPIO:', cleanText);

    try {
      const decoded = atob(cleanText);
      console.log('🟢 DECODIFICADO (base64):', decoded);

      if (decoded.includes('|')) {
        const [docId, timestamp] = decoded.split('|');
        console.log('📄 DOCUMENTO ID EXTRAÍDO:', docId);
        console.log('⏱️ TIMESTAMP:', timestamp);

        const tiempoActual = Date.now();
        const tiempoExpiracion = parseInt(timestamp);
        
        if (isNaN(tiempoExpiracion)) {
          console.error('❌ TIMESTAMP INVÁLIDO');
          mostrarNotificacion('QR INVÁLIDO (timestamp corrupto)', 'error');
          return '';
        }

        if (tiempoActual - tiempoExpiracion > config.qr_exp) {
          console.warn(`⌛ QR EXPIRADO: ${(tiempoActual - tiempoExpiracion) / 1000} segundos`);
          mostrarNotificacion('QR EXPIRADO', 'error');
          return '';
        }

        return docId.trim();
      }
      
      console.warn('⚠️ QR no contiene el separador "|", se usa el texto completo');
      return cleanText;
    } catch (error) {
      console.error('❌ ERROR al decodificar base64:', error);
      return cleanText;
    }
  };

  // --------------------------------------------------------
  // 4. INICIO DEL ESCÁNER DE CÁMARA
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
            console.log('📷 QR detectado por cámara:', decoded);
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
  // 5. FUNCIÓN PRINCIPAL: REGISTRAR ACCESO
  //    🔍 AHORA CON VALIDACIÓN DE DUPLICIDAD DE ENTRADA/SALIDA
  // --------------------------------------------------------
  const registrarAcceso = async () => {
    // Validar GPS
    if (gps.dist > config.radio) {
      mostrarNotificacion(`FUERA DE RANGO: ${gps.dist}m`, 'error');
      setTimeout(resetLectura, 2000);
      return;
    }

    setAnimar(true);

    const ahora = new Date().toISOString();
    let inputBusqueda = qrData.trim();

    console.log('🔎 BUSCANDO EMPLEADO CON:', inputBusqueda);

    if (!inputBusqueda) {
      mostrarNotificacion('ERROR: QR VACÍO', 'error');
      setAnimar(false);
      setTimeout(resetLectura, 2000);
      return;
    }

    // --- VALIDACIÓN 1: Buscar empleado por documento_id o email ---
    const { data: emp, error: empErr } = await supabase
      .from('empleados')
      .select('id, nombre, pin_seguridad, activo, documento_id, email')
      .or(
        `documento_id.ilike.%${inputBusqueda}%,email.ilike.%${inputBusqueda.toLowerCase()}%`
      )
      .maybeSingle();

    console.log('📦 RESULTADO BÚSQUEDA:', emp);
    console.log('❌ ERROR DB:', empErr);

    if (empErr) {
      console.error('Error en consulta:', empErr);
      mostrarNotificacion(`ERROR EN BASE DE DATOS: ${empErr.message}`, 'error');
      setAnimar(false);
      setTimeout(resetLectura, 2000);
      return;
    }

    if (!emp) {
      console.warn('⚠️ Empleado no encontrado');
      mostrarNotificacion('ID NO REGISTRADO', 'error');
      setAnimar(false);
      setTimeout(resetLectura, 2000);
      return;
    }

    if (!emp.documento_id) {
      console.error('❌ Empleado sin documento_id:', emp);
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

    // --- VALIDACIÓN 2: PIN del trabajador (solo en modo manual) ---
    if (modo === 'manual') {
      if (String(emp.pin_seguridad) !== String(pinEmpleado)) {
        mostrarNotificacion('PIN TRABAJADOR INCORRECTO', 'error');
        setAnimar(false);
        return;
      }
    }

    // --- VALIDACIÓN 3: PIN del supervisor ---
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

    // 🟢 VALIDACIÓN DE DUPLICIDAD DE ENTRADA/SALIDA
    if (direccion === 'entrada') {
      // Verificar si ya tiene una entrada activa
      const { data: jornadaActiva, error: actErr } = await supabase
        .from('jornadas')
        .select('id')
        .eq('empleado_id', emp.id)
        .is('hora_salida', null)
        .maybeSingle();

      if (actErr) {
        console.error('Error al verificar jornada activa:', actErr);
        mostrarNotificacion('ERROR AL VERIFICAR ESTADO', 'error');
        setAnimar(false);
        return;
      }

      if (jornadaActiva) {
        mostrarNotificacion('YA TIENE UNA ENTRADA ACTIVA', 'advertencia');
        setAnimar(false);
        setTimeout(resetLectura, 2000);
        return;
      }
    } else { // salida
      // Verificar que exista una entrada activa
      const { data: jornadaActiva, error: actErr } = await supabase
        .from('jornadas')
        .select('id, hora_entrada')
        .eq('empleado_id', emp.id)
        .is('hora_salida', null)
        .maybeSingle();

      if (actErr) {
        console.error('Error al verificar jornada activa:', actErr);
        mostrarNotificacion('ERROR AL VERIFICAR ESTADO', 'error');
        setAnimar(false);
        return;
      }

      if (!jornadaActiva) {
        mostrarNotificacion('NO HAY ENTRADA REGISTRADA', 'advertencia');
        setAnimar(false);
        setTimeout(resetLectura, 2000);
        return;
      }
    }

    const firma = `Autoriza ${aut.nombre} - ${modo.toUpperCase()}`;

    try {
      if (direccion === 'entrada') {
        // --- REGISTRAR ENTRADA ---
        const { error: insErr } = await supabase.from('jornadas').insert([
          {
            empleado_id: emp.id,
            nombre_empleado: emp.nombre,
            hora_entrada: ahora,
            autoriza_entrada: firma,
            estado: 'activo',
          },
        ]);

        if (insErr) {
          console.error('Error al insertar jornada:', insErr);
          mostrarNotificacion(`FALLO AL GRABAR: ${insErr.message}`, 'error');
          setAnimar(false);
          setTimeout(resetLectura, 2000);
          return;
        }

        await supabase
          .from('empleados')
          .update({ en_almacen: true, ultimo_ingreso: ahora })
          .eq('id', emp.id);

        mostrarNotificacion('ENTRADA REGISTRADA ✅', 'exito');
      } else {
        // --- REGISTRAR SALIDA ---
        const { data: j, error: jErr } = await supabase
          .from('jornadas')
          .select('*')
          .eq('empleado_id', emp.id)
          .is('hora_salida', null)
          .order('hora_entrada', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (jErr || !j) {
          mostrarNotificacion('SIN ENTRADA ACTIVA', 'error');
          setAnimar(false);
          setTimeout(resetLectura, 2000);
          return;
        }

        const horas = parseFloat(
          ((Date.now() - new Date(j.hora_entrada).getTime()) / 3600000).toFixed(2)
        );

        const { error: updErr } = await supabase
          .from('jornadas')
          .update({
            hora_salida: ahora,
            horas_trabajadas: horas,
            autoriza_salida: firma,
            estado: 'finalizado',
          })
          .eq('id', j.id);

        if (updErr) {
          mostrarNotificacion(`FALLO SALIDA: ${updErr.message}`, 'error');
          setAnimar(false);
          setTimeout(resetLectura, 2000);
          return;
        }

        await supabase
          .from('empleados')
          .update({ en_almacen: false, ultima_salida: ahora })
          .eq('id', emp.id);

        mostrarNotificacion('SALIDA REGISTRADA ✅', 'exito');
      }

      // ✅ FLUJO CONTINUO: Solo limpia los campos, NO cambia modo ni dirección
      setTimeout(() => {
        resetLectura();
      }, 2000);
    } catch (e: any) {
      console.error('Error inesperado:', e);
      mostrarNotificacion(`ERROR INESPERADO: ${e.message}`, 'error');
      setTimeout(resetLectura, 2000);
    } finally {
      setAnimar(false);
    }
  };

  // --------------------------------------------------------
  // 6. FUNCIONES AUXILIARES
  // --------------------------------------------------------
  const resetLectura = () => {
    setQrData('');
    setLecturaLista(false);
    setPinEmpleado('');
    setPinAutorizador('');
  };

  const mostrarNotificacion = (
    mensaje: string,
    tipo: 'exito' | 'error' | 'advertencia' | 'info'
  ) => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => setNotificacion({ mensaje: '', tipo: null }), 6000);
  };

  // --------------------------------------------------------
  // 7. RENDERIZADO
  // --------------------------------------------------------
  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      <NotificacionSistema
        mensaje={notificacion.mensaje}
        tipo={notificacion.tipo}
        visible={!!notificacion.tipo}
      />

      <MemebreteSuperior
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
          // --- MENÚ PRINCIPAL (botones con círculo) ---
          <div className="grid gap-4 w-full">
            <BotonOpcion
              texto="SCANNER USB"
              icono="💻​"
              onClick={() => setModo('usb')}
              color="bg-blue-600"
            />
            <BotonOpcion
              texto="CÁMARA MÓVIL"
              icono="📱"
              onClick={() => setModo('camara')}
              color="bg-emerald-600"
            />
            <BotonOpcion
              texto="MANUAL"
              icono="✍🏻"
              onClick={() => {
                setModo('manual');
                setManualAprobado(false);
              }}
              color="bg-slate-700"
            />
            <Footer router={router} />
          </div>
        ) : !direccion ? (
          // --- SELECCIÓN ENTRADA/SALIDA (botones con círculo) ---
          <div className="flex flex-col gap-4 w-full">
            <BotonOpcion
              texto="ENTRADA"
              icono="🟢"
              onClick={() => setDireccion('entrada')}
              color="bg-emerald-600"
            />
            <BotonOpcion
              texto="SALIDA"
              icono="🔴"
              onClick={() => setDireccion('salida')}
              color="bg-rose-600"
            />
            <button
              onClick={() => {
                setModo('menu');
                setDireccion(null);
                resetLectura();
                setManualAprobado(false);
              }}
              className="mt-4 text-slate-500 font-bold uppercase text-[10px] tracking-widest text-center hover:text-white transition-colors"
            >
              ← VOLVER ATRÁS
            </button>
          </div>
        ) : (
          // --- PANTALLA DE LECTURA / CAPTURA (sin cambios en la lógica) ---
          <div className="space-y-4 w-full">
            
            <div className="px-3 py-2 bg-black/50 rounded-xl border border-white/5 text-center">
              <p className="text-[8.5px] font-mono text-white/50 tracking-tighter">
                LAT: {gps.lat.toFixed(6)} | LON: {gps.lon.toFixed(6)} |{' '}
                <span
                  className={
                    gps.dist <= config.radio
                      ? 'text-emerald-500 font-bold'
                      : 'text-rose-500 font-bold'
                  }
                >
                  {gps.dist} MTS
                </span>
              </p>
            </div>

            {/* 🟨 MODO MANUAL: ADVERTENCIA OBLIGATORIA */}
            {modo === 'manual' && !manualAprobado ? (
              <div className="space-y-4">
                <div className="bg-amber-500/20 border-2 border-amber-500 p-6 rounded-2xl text-center animate-pulse">
                  <span className="text-amber-500 text-2xl block mb-2">⚠️</span>
                  <p className="text-amber-500 font-black text-[13px] uppercase tracking-widest">
                    Este proceso requiere la validación de un Administrador
                  </p>
                </div>
                <input
                  ref={warningRef}
                  type="text"
                  placeholder="Presione ENTER para continuar"
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-center text-[11px] font-bold text-white outline-none focus:border-amber-500/50 uppercase"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setManualAprobado(true);
                    }
                  }}
                  autoFocus
                />
              </div>
            ) : (
              /* --- LECTURA NORMAL (USB/CÁMARA) O MANUAL APROBADO --- */
              <>
                <div
                  className={`bg-[#050a14] p-4 rounded-[30px] border-2 ${
                    lecturaLista ? 'border-emerald-500' : 'border-white/10'
                  } h-60 flex items-center justify-center relative overflow-hidden`}
                >
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
                      {modo === 'manual' && (
                        <CampoEntrada
                          tipo="text"
                          placeholder="DOCUMENTO / CORREO"
                          valor={qrData}
                          onChange={(e) => setQrData(e.target.value)}
                          autoFocus
                          textoCentrado={true}
                          mayusculas={true}
                        />
                      )}
                      {modo !== 'manual' && (
                        <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_15px_red] animate-scan-laser" />
                      )}
                    </>
                  ) : (
                    <p className="text-emerald-500 font-black text-2xl uppercase italic animate-bounce">
                      OK ✅
                    </p>
                  )}
                </div>

                {modo === 'manual' && !lecturaLista && (
                  <CampoEntrada
                    tipo="password"
                    placeholder="PIN TRABAJADOR"
                    valor={pinEmpleado}
                    onChange={(e) => setPinEmpleado(e.target.value)}
                  />
                )}

                {(lecturaLista || (modo === 'manual' && qrData && pinEmpleado)) && (
                  <CampoEntrada
                    tipo="password"
                    placeholder="PIN SUPERVISOR"
                    valor={pinAutorizador}
                    onChange={(e) => setPinAutorizador(e.target.value)}
                    onEnter={registrarAcceso}
                    autoFocus
                  />
                )}

                <BotonAccion
                  texto={animar ? 'PROCESANDO...' : 'CONFIRMAR REGISTRO'}
                  icono="✅"
                  onClick={registrarAcceso}
                  disabled={animar}
                  loading={animar}
                />
              </>
            )}

            <button
              onClick={() => {
                setDireccion(null);
                resetLectura();
                setManualAprobado(false);
              }}
              className="w-full text-center text-slate-500 font-bold uppercase text-[9px] tracking-widest hover:text-white transition-colors"
            >
              ← VOLVER ATRÁS
            </button>
          </div>
        )}
      </ContenedorPrincipal>

      {/* Estilos globales */}
      <style jsx global>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
        @keyframes flash-fast { 0%, 100% { opacity: 1; } 10%, 30%, 50% { opacity: 0; } 20%, 40%, 60% { opacity: 1; } }
        .animate-flash-fast { animation: flash-fast 2s ease-in-out; }
        @keyframes scan-laser { 0%, 100% { top: 0%; } 50% { top: 100%; } }
        .animate-scan-laser { animation: scan-laser 2s infinite linear; }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-bounce { animation: bounce 1s infinite; }
      `}</style>
    </main>
  );
}