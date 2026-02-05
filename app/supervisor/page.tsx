'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

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

export default function SupervisorPage() {
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState(''); 
  const [pinAutorizador, setPinAutorizador] = useState(''); 
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'success' | 'error' | 'warning' | null }>({ texto: '', tipo: null });
  const [supervisorSesion, setSupervisorSesion] = useState<any>(null);
  const [config, setConfig] = useState<any>({ timer_inactividad: 120000, qr_expiracion: 30000 });
  
  // Estados de Telemetría GPS
  const [distanciaActual, setDistanciaActual] = useState<number | null>(null);
  const [gpsCoords, setGpsCoords] = useState({ lat: 0, lon: 0 });

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinAutRef = useRef<HTMLInputElement>(null);
  const inputUsbRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const showNotification = (texto: string, tipo: 'success' | 'error' | 'warning') => {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: '', tipo: null }), 3000);
  };

  // --- NAVEGACIÓN Y LIMPIEZA ---
  const volverMenuPrincipal = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
      scannerRef.current = null;
    }
    setModo('menu');
    setDireccion(null);
    setQrData('');
    setLecturaLista(false);
    setPinAutorizador('');
  };

  const volverPasoAnterior = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
      scannerRef.current = null;
    }
    setDireccion(null);
    setQrData('');
    setLecturaLista(false);
  };

  // --- CONTROL DE GPS Y CONFIG ---
  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    setSupervisorSesion(JSON.parse(sessionData));

    const fetchConfig = async () => {
      const { data } = await supabase.from('sistema_config').select('clave, valor');
      if (data) {
        const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        setConfig({
          lat: parseFloat(cfgMap.latitud_almacen),
          lon: parseFloat(cfgMap.longitud_almacen),
          radio: parseFloat(cfgMap.radio_permitido) || 100,
          timer: parseInt(cfgMap.timer_inactividad) || 120000,
          qr_exp: parseInt(cfgMap.qr_expiracion) || 30000
        });
      }
    };
    fetchConfig();

    const watchId = navigator.geolocation.watchPosition((pos) => {
      setGpsCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [router]);

  useEffect(() => {
    if (config.lat && gpsCoords.lat !== 0) {
      const d = calcularDistancia(gpsCoords.lat, gpsCoords.lon, config.lat, config.lon);
      setDistanciaActual(Math.round(d));
    }
  }, [gpsCoords, config]);

  // --- ACTIVACIÓN DE CÁMARA CUANDO HAY DIRECCIÓN ---
  useEffect(() => {
    if (modo === 'camara' && direccion && !lecturaLista) {
      const iniciarCamara = async () => {
        try {
          const scanner = new Html5Qrcode("reader");
          scannerRef.current = scanner;
          await scanner.start(
            { facingMode: "environment" },
            { fps: 20, qrbox: 250 },
            (decoded) => {
              const doc = procesarLectura(decoded);
              if (doc) {
                setQrData(doc);
                setLecturaLista(true);
                scanner.stop();
                setTimeout(() => pinAutRef.current?.focus(), 300);
              }
            },
            () => {}
          );
        } catch (err) {
          console.error("Error cámara:", err);
          showNotification("NO SE PUDO ACTIVAR LA CÁMARA", "error");
        }
      };
      iniciarCamara();
    }
  }, [modo, direccion, lecturaLista]);

  const procesarLectura = (texto: string) => {
    try {
      const decoded = atob(texto);
      if (decoded.includes('|')) {
        const [docId, timestamp] = decoded.split('|');
        if (Date.now() - parseInt(timestamp) > config.qr_exp) {
          showNotification("CÓDIGO QR EXPIRADO", 'error');
          return '';
        }
        return docId;
      }
      return texto;
    } catch { return texto; }
  };

  const registrarAcceso = async () => {
    if (distanciaActual! > config.radio) {
      showNotification("FUERA DE RANGO: ACÉRQUESE AL ALMACÉN", "error");
      return;
    }
    setAnimar(true);
    const ahora = new Date().toISOString();

    try {
      const { data: emp } = await supabase.from('empleados').select('*').or(`documento_id.eq."${qrData}",email.eq."${qrData}"`).maybeSingle();
      if (!emp) throw new Error("Empleado no encontrado");
      if (!emp.activo) {
        showNotification("EMPLEADO NO REGISTRADO COMO ACTIVO", 'warning');
        setTimeout(() => volverMenuPrincipal(), 3000);
        return;
      }

      const { data: aut } = await supabase.from('empleados').select('nombre').eq('pin_seguridad', String(pinAutorizador)).in('rol', ['supervisor', 'admin', 'Administrador']).maybeSingle();
      if (!aut) throw new Error("PIN AUTORIZADOR INVÁLIDO");

      const firma = `Autoriza ${aut.nombre} - ${modo.toUpperCase()}`;

      if (direccion === 'entrada') {
        await supabase.from('jornadas').insert([{ empleado_id: emp.id, nombre_empleado: emp.nombre, hora_entrada: ahora, autoriza_entrada: firma, estado: 'activo' }]);
        await supabase.from('empleados').update({ en_almacen: true, ultimo_ingreso: ahora }).eq('id', emp.id);
      } else {
        const { data: j } = await supabase.from('jornadas').select('*').eq('empleado_id', emp.id).is('hora_salida', null).maybeSingle();
        if (!j) throw new Error("No hay entrada activa");
        const horas = parseFloat(((Date.now() - new Date(j.hora_entrada).getTime()) / 3600000).toFixed(2));
        await supabase.from('jornadas').update({ hora_salida: ahora, horas_trabajadas: horas, autoriza_salida: firma, estado: 'finalizado' }).eq('id', j.id);
        await supabase.from('empleados').update({ en_almacen: false, ultima_salida: ahora }).eq('id', emp.id);
      }

      showNotification("REGISTRO EXITOSO ✅", 'success');
      setTimeout(() => volverMenuPrincipal(), 1500);
    } catch (err: any) {
      showNotification(err.message, 'error');
      setQrData('');
      setLecturaLista(false);
      setPinAutorizador('');
    } finally { setAnimar(false); }
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {mensaje.tipo && (
        <div className={`fixed top-10 z-[100] px-8 py-4 rounded-2xl font-black shadow-2xl animate-bounce ${
          mensaje.tipo === 'success' ? 'bg-emerald-500 text-white' : 
          mensaje.tipo === 'warning' ? 'bg-amber-500 text-black' : 'bg-rose-600 text-white'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {/* MEMBRETE */}
      <div className="w-full max-w-sm bg-[#1a1a1a] p-8 rounded-[30px] border border-white/5 mb-4 text-center">
        <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white">PANEL DE LECTURA <span className="text-blue-700">QR</span></h1>
        {modo !== 'menu' && (
          <p className="text-blue-500 font-bold text-[11px] uppercase tracking-widest mt-1">
            {modo === 'usb' ? 'Lectura del QR por Scanner' : modo === 'camara' ? 'Lectura de QR por móvil' : 'Acceso Manual'}
          </p>
        )}
        {supervisorSesion && (
          <div className="pt-3 mt-3 border-t border-white/10 flex flex-col items-center">
            <span className="text-base text-white uppercase font-bold">{supervisorSesion.nombre}</span>
            <span className="text-[10px] text-white/40 uppercase font-black tracking-widest">NIVEL ACCESO: {supervisorSesion.nivel_acceso}</span>
          </div>
        )}
      </div>

      <div className="w-full max-w-sm bg-[#111111] p-8 rounded-[40px] border border-white/5 shadow-2xl relative">
        {modo === 'menu' ? (
          <div className="grid gap-4 w-full">
            <div className="text-center mb-2">
              <p className="text-[13px] font-bold uppercase tracking-[0.4em] text-white animate-pulse">Opciones</p>
            </div>
            <button onClick={() => setModo('usb')} className="w-full bg-blue-600 p-7 rounded-2xl text-white font-black uppercase italic text-base active:scale-95 transition-all">🔌 SCANNER USB</button>
            <button onClick={() => setModo('camara')} className="w-full bg-emerald-600 p-7 rounded-2xl text-white font-black uppercase italic text-base active:scale-95 transition-all">📱 CÁMARA MÓVIL</button>
            <button onClick={() => setModo('manual')} className="w-full bg-white/5 p-7 rounded-2xl text-white font-black uppercase italic text-base border border-white/10 active:scale-95 transition-all">🖋️ MANUAL</button>
            <button onClick={() => router.push('/')} className="mt-4 text-emerald-500 font-bold uppercase text-[10px] tracking-widest text-center italic">← Volver al menú anterior</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-4 w-full">
            <button onClick={() => setDireccion('entrada')} className="w-full py-8 bg-emerald-600 rounded-[30px] font-black text-4xl italic active:scale-95 transition-all">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-8 bg-red-600 rounded-[30px] font-black text-4xl italic active:scale-95 transition-all">SALIDA</button>
            <button onClick={volverMenuPrincipal} className="mt-4 text-slate-500 font-bold text-[10px] uppercase text-center tracking-widest">← VOLVER AL MENÚ ANTERIOR</button>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            {/* TELEMETRÍA GPS VISIBLE */}
            <div className="flex justify-between items-center px-4 py-2 bg-black/50 rounded-xl border border-white/5">
              <span className="text-[8px] text-white/40 font-bold uppercase">Distancia: <span className={distanciaActual! <= config.radio ? "text-emerald-500" : "text-rose-500"}>{distanciaActual}m</span></span>
              <span className="text-[8px] text-white/40 font-bold uppercase">GPS: {gpsCoords.lat.toFixed(4)}, {gpsCoords.lon.toFixed(4)}</span>
            </div>

            <div className={`bg-[#050a14] p-4 rounded-[30px] border-2 ${lecturaLista ? 'border-emerald-500' : 'border-white/10'} h-60 flex items-center justify-center relative overflow-hidden`}>
                {!lecturaLista ? (
                  <>
                    {modo === 'camara' && <div id="reader" className="w-full h-full"></div>}
                    {modo === 'usb' && <input autoFocus className="bg-transparent text-center text-lg font-black text-blue-500 outline-none w-full" placeholder="ESPERANDO SCANNER..." onChange={e => { const doc = procesarLectura(e.target.value); if(doc) { setQrData(doc); setLecturaLista(true); } }} />}
                    {modo === 'manual' && <input autoFocus className="bg-transparent text-center text-2xl font-black text-white outline-none w-full uppercase" placeholder="DOCUMENTO ID" onChange={e => setQrData(e.target.value)} onKeyDown={e => e.key === 'Enter' && setLecturaLista(true)} />}
                    <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_15px_red] animate-scan-laser"></div>
                  </>
                ) : <p className="text-emerald-500 font-black text-2xl uppercase italic animate-pulse">ID CAPTURADO ✅</p>}
            </div>

            {lecturaLista && <input ref={pinAutRef} type="password" placeholder="PIN AUTORIZADOR" className="w-full py-5 bg-[#050a14] rounded-2xl text-center text-3xl font-black border-4 border-blue-600 text-white outline-none" onChange={e => setPinAutorizador(e.target.value)} onKeyDown={e => e.key === 'Enter' && registrarAcceso()} autoFocus />}
            
            <button onClick={registrarAcceso} className="w-full py-6 bg-blue-600 rounded-2xl font-black text-xl uppercase italic shadow-2xl">{animar ? '...' : 'CONFIRMAR'}</button>
            <button onClick={volverPasoAnterior} className="w-full text-center text-slate-500 font-bold uppercase text-[9px] tracking-widest italic">← VOLVER AL MENÚ ANTERIOR</button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes scan-laser { 0%, 100% { top: 0%; } 50% { top: 100%; } }
        .animate-scan-laser { animation: scan-laser 2s infinite linear; }
      `}</style>
    </main>
  );
}