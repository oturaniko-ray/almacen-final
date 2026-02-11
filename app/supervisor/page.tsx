'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  MemebreteSuperior, 
  BotonAcceso, 
  NotificacionSistema, 
  CampoEntrada, 
  ContenedorPrincipal 
} from '../configuracion/componentes';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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

  // Estados de datos
  const [user, setUser] = useState<any>(null);
  const [config, setConfig] = useState<any>({ lat: 0, lon: 0, radio: 100, qr_exp: 30000 });
  const [gps, setGps] = useState({ lat: 0, lon: 0, dist: 999999 });

  // Refs
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const timerInactividadRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

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
  // 3. PROCESAMIENTO DEL QR (decodificar base64)
  // --------------------------------------------------------
  const procesarQR = (texto: string): string => {
    const cleanText = texto.replace(/[\n\r]/g, '').trim();
    try {
      const decoded = atob(cleanText);
      if (decoded.includes('|')) {
        const [docId, timestamp] = decoded.split('|');
        if (Date.now() - parseInt(timestamp) > config.qr_exp) {
          mostrarNotificacion('QR EXPIRADO', 'error');
          return '';
        }
        return docId;
      }
      return cleanText;
    } catch {
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
    const inputBusqueda = qrData.trim();

    // --- VALIDACIÓN 1: Buscar empleado por documento_id o email ---
    // 🔴 CORREGIDO: Usar comillas simples para evitar error de sintaxis
    const { data: emp, error: empErr } = await supabase
      .from('empleados')
      .select('id, nombre, pin_seguridad, activo, documento_id, email')
      .or(
        `documento_id.eq.'${inputBusqueda}',email.eq.'${inputBusqueda.toLowerCase()}'`
      )
      .maybeSingle();

    if (empErr) {
      mostrarNotificacion(`ERROR EN BASE DE DATOS: ${empErr.message}`, 'error');
      setAnimar(false);
      return;
    }

    if (!emp) {
      mostrarNotificacion('ID NO REGISTRADO', 'error');
      setAnimar(false);
      setTimeout(resetLectura, 3000);
      return;
    }

    if (!emp.activo) {
      mostrarNotificacion('EMPLEADO INACTIVO', 'error');
      setAnimar(false);
      setTimeout(resetLectura, 3000);
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
          return;
        }

        // Actualizar estado del empleado
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
          return;
        }

        await supabase
          .from('empleados')
          .update({ en_almacen: false, ultima_salida: ahora })
          .eq('id', emp.id);

        mostrarNotificacion('SALIDA REGISTRADA ✅', 'exito');
      }

      // Limpiar campos y volver al menú
      setTimeout(() => {
        resetLectura();
        setDireccion(null);
        setModo('menu');
      }, 2000);
    } catch (e: any) {
      mostrarNotificacion(`ERROR INESPERADO: ${e.message}`, 'error');
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
  // 7. RENDERIZADO CON COMPONENTES UNIFICADOS
  // --------------------------------------------------------
  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* NOTIFICACIÓN GLOBAL */}
      <NotificacionSistema
        mensaje={notificacion.mensaje}
        tipo={notificacion.tipo || 'info'}
        visible={!!notificacion.tipo}
      />

      {/* MEMBRETE SUPERIOR - MISMO ESTILO QUE LOGIN Y EMPLEADO */}
      <MemebreteSuperior
        titulo={
          modo === 'menu'
            ? 'PANEL DE LECTURA QR'
            : modo === 'usb'
            ? 'LECTURA POR SCANNER'
            : modo === 'camara'
            ? 'LECTURA POR MÓVIL'
            : 'ACCESO MANUAL'
        }
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

      {/* CONTENEDOR PRINCIPAL - MISMO ESTILO QUE LOGIN Y EMPLEADO */}
      <ContenedorPrincipal>
        {modo === 'menu' ? (
          // ----------------------------------------------------
          // MENÚ PRINCIPAL: 3 BOTONES DE MÉTODO DE LECTURA
          // ----------------------------------------------------
          <div className="grid gap-4 w-full">
            <BotonAcceso
              texto="SCANNER USB"
              icono="🔌"
              tipo="primario"
              onClick={() => setModo('usb')}
            />
            <BotonAcceso
              texto="CÁMARA MÓVIL"
              icono="📱"
              tipo="exito"
              onClick={() => setModo('camara')}
            />
            <BotonAcceso
              texto="MANUAL"
              icono="🖋️"
              tipo="neutral"
              onClick={() => setModo('manual')}
            />
            <button
              onClick={() => router.push('/')}
              className="mt-4 text-emerald-500 font-bold uppercase text-[10px] tracking-widest text-center italic hover:text-emerald-400 transition-colors"
            >
              ← VOLVER AL SELECTOR
            </button>
          </div>
        ) : !direccion ? (
          // ----------------------------------------------------
          // SELECCIÓN: ENTRADA / SALIDA
          // ----------------------------------------------------
          <div className="flex flex-col gap-4 w-full">
            <BotonAcceso
              texto="ENTRADA"
              icono="🟢"
              tipo="exito"
              onClick={() => setDireccion('entrada')}
            />
            <BotonAcceso
              texto="SALIDA"
              icono="🔴"
              tipo="peligro"
              onClick={() => setDireccion('salida')}
            />
            <button
              onClick={() => {
                setModo('menu');
                setDireccion(null);
                resetLectura();
              }}
              className="mt-4 text-slate-500 font-bold text-[10px] uppercase text-center tracking-widest hover:text-white transition-colors"
            >
              ← VOLVER ATRÁS
            </button>
          </div>
        ) : (
          // ----------------------------------------------------
          // PANTALLA DE LECTURA / CAPTURA DE DATOS
          // ----------------------------------------------------
          <div className="space-y-4 w-full">
            
            {/* INFORMACIÓN GPS - ESTILO CONSISTENTE */}
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

            {/* ÁREA DE LECTURA QR O CAMPO MANUAL */}
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

            {/* CAMPO DE PIN TRABAJADOR (solo modo manual) */}
            {modo === 'manual' && !lecturaLista && (
              <CampoEntrada
                tipo="password"
                placeholder="PIN TRABAJADOR"
                valor={pinEmpleado}
                onChange={(e) => setPinEmpleado(e.target.value)}
              />
            )}

            {/* CAMPO DE PIN SUPERVISOR (aparece cuando ya se identificó al empleado) */}
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

            {/* BOTÓN CONFIRMAR - MISMO ESTILO EN TODO EL SISTEMA */}
            <BotonAcceso
              texto={animar ? 'PROCESANDO...' : 'CONFIRMAR REGISTRO'}
              icono="✅"
              tipo="primario"
              onClick={registrarAcceso}
              disabled={animar}
              loading={animar}
            />

            {/* BOTÓN VOLVER */}
            <button
              onClick={() => {
                setDireccion(null);
                resetLectura();
              }}
              className="w-full text-center text-slate-500 font-bold uppercase text-[9px] tracking-widest italic hover:text-white transition-colors"
            >
              ← VOLVER ATRÁS
            </button>
          </div>
        )}
      </ContenedorPrincipal>

      {/* ESTILOS GLOBALES PARA ANIMACIONES */}
      <style jsx global>{`
        @keyframes scan-laser {
          0%, 100% { top: 0%; }
          50% { top: 100%; }
        }
        .animate-scan-laser {
          animation: scan-laser 2s infinite linear;
        }
      `}</style>
    </main>
  );
}