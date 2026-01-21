'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 CONFIGURACIÓN DE SEGURIDAD
const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 80; 

export default function SupervisorPage() {
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pinEmpleadoManual, setPinEmpleadoManual] = useState('');
  const [pinAdminManual, setPinAdminManual] = useState('');
  const [pinSupervisor, setPinSupervisor] = useState('');
  const [animar, setAnimar] = useState(false);
  const [mostrarWarning, setMostrarWarning] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Utilidad para calcular distancia real
  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  };

  const limpiarYReiniciar = async () => {
    if (scannerRef.current?.isScanning) await scannerRef.current.stop();
    setQrData('');
    setPinSupervisor('');
    setPinEmpleadoManual('');
    setPinAdminManual('');
    setAnimar(false);
    setDireccion(null); 
  };

  const volverAtras = () => {
    if (mostrarWarning) { setMostrarWarning(false); setModo('menu'); }
    else if (direccion) { limpiarYReiniciar(); }
    else if (modo === 'menu') { router.push('/'); }
    else { setModo('menu'); }
  };

  // Cámara Móvil
  useEffect(() => {
    if (modo === 'camara' && direccion && !qrData && !mostrarWarning) {
      const initCam = async () => {
        try {
          await new Promise(r => setTimeout(r, 400));
          const scanner = new Html5Qrcode("reader");
          scannerRef.current = scanner;
          await scanner.start({ facingMode: "environment" }, { fps: 20, qrbox: 250 }, (text) => {
            setQrData(text.trim());
            scanner.stop();
            setTimeout(() => pinRef.current?.focus(), 100);
          }, () => {});
        } catch (e) { console.error(e); }
      };
      initCam();
    }
    return () => { if (scannerRef.current?.isScanning) scannerRef.current.stop(); };
  }, [modo, direccion, qrData, mostrarWarning]);

  // Escáner USB
  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData || mostrarWarning) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (buffer.trim()) {
          setQrData(buffer.trim());
          setTimeout(() => pinRef.current?.focus(), 50);
        }
        buffer = "";
      } else if (e.key.length === 1) { buffer += e.key; }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData, mostrarWarning]);

  const registrarAcceso = async () => {
    const esManual = modo === 'manual';
    const pinAValidar = esManual ? pinAdminManual : pinSupervisor;
    
    // 🔍 PROCESAMIENTO CRÍTICO DEL ID
    let idLimpio = qrData.trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, ""); // Quitar caracteres invisibles

    if (!esManual) {
      try {
        // Si parece Base64 (largo o con caracteres especiales de B64), decodificamos
        if (idLimpio.length > 15 || idLimpio.includes('|')) {
          const raw = atob(idLimpio);
          idLimpio = raw.split('|')[0].trim();
        }
      } catch (e) {
        // Si no es Base64, idLimpio se queda como estaba
      }
    }

    if (!idLimpio || !pinAValidar || animar) return;
    setAnimar(true);

    // Obtener GPS y Datos en paralelo
    const geoPromise = new Promise((res) => navigator.geolocation.getCurrentPosition(res, () => res(null), { timeout: 4000 }));

    try {
      const [pos, empRes, authRes] = await Promise.all([
        geoPromise as Promise<GeolocationPosition | null>,
        supabase.from('empleados').select('*').eq('documento_id', idLimpio.toUpperCase()).maybeSingle(),
        supabase.from('empleados').select('*').eq('pin_seguridad', pinAValidar).maybeSingle()
      ]);

      // VALIDACIONES
      if (!pos) throw new Error("GPS Requerido");
      const d = calcularDistancia(pos.coords.latitude, pos.coords.longitude, ALMACEN_LAT, ALMACEN_LON);
      if (d > RADIO_MAXIMO_METROS) throw new Error(`Fuera de rango (${Math.round(d)}m)`);

      if (!empRes.data) throw new Error(`Empleado ID [${idLimpio}] no encontrado en la base de datos`);
      if (esManual && empRes.data.pin_seguridad !== pinEmpleadoManual) throw new Error("PIN de empleado incorrecto");
      
      if (!authRes.data) throw new Error("PIN de autorización no válido");
      if (esManual && authRes.data.rol !== 'administrador') throw new Error("Se requiere PIN de Administrador");

      // EJECUCIÓN
      await Promise.all([
        supabase.from('empleados').update({ en_almacen: direccion === 'entrada' }).eq('id', empRes.data.id),
        supabase.from('registros_acceso').insert([{
          empleado_id: empRes.data.id,
          nombre_empleado: empRes.data.nombre,
          tipo_movimiento: direccion,
          detalles: esManual ? `MANUAL - Admin: ${authRes.data.nombre}` : `SUP: ${authRes.data.nombre} (${modo})`
        }])
      ]);

      alert(`✅ ACCESO REGISTRADO: ${empRes.data.nombre}`);
      await limpiarYReiniciar();
    } catch (err: any) {
      alert(`❌ ERROR: ${err.message}`);
      setAnimar(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative">
      <style jsx global>{`
        @keyframes laser { 0% { top: 0%; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
        @keyframes warningBlink { 0%, 100% { border-color: #facc15; background-color: rgba(250,204,21,0.2); } 50% { border-color: transparent; background-color: transparent; } }
      `}</style>

      {mostrarWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] p-10 rounded-[40px] border-4 animate-[warningBlink_1s_infinite] text-center max-w-sm">
            <p className="text-xl font-black uppercase text-yellow-500">ENTRADA MANUAL<br/><span className="text-sm font-normal text-white">Requiere PIN de Administrador</span></p>
            <button onClick={() => setMostrarWarning(false)} className="mt-6 px-8 py-2 bg-yellow-500 text-black font-bold rounded-full text-xs">ENTENDIDO</button>
          </div>
        </div>
      )}

      <button onClick={volverAtras} className="absolute top-8 left-8 bg-[#1e293b] px-5 py-2 rounded-xl font-bold text-[10px] uppercase">← Volver</button>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl">
        <h2 className="text-2xl font-black uppercase italic text-blue-500 mb-10 text-center italic tracking-tighter">Panel de Supervisión</h2>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-blue-500 transition-all uppercase">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-emerald-500 transition-all uppercase">📱 Cámara Móvil</button>
            <button onClick={() => { setModo('manual'); setMostrarWarning(true); }} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-yellow-500 transition-all uppercase">🖋️ Entrada Manual</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-lg active:scale-95 transition-all">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl shadow-lg active:scale-95 transition-all">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`bg-[#050a14] p-6 rounded-[30px] border transition-all ${qrData ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'border-white/5'} h-32 flex flex-col items-center justify-center relative`}>
              {!qrData ? (
                <>
                  {modo !== 'manual' && <div className="absolute inset-x-0 h-[2px] bg-red-500 shadow-[0_0_10px_red] animate-[laser_2s_infinite]"></div>}
                  {modo === 'camara' && <div id="reader" className="w-full h-full rounded-2xl"></div>}
                  {modo === 'manual' && (
                    <input type="text" placeholder="DOCUMENTO ID" className="w-full bg-transparent text-center text-2xl font-black text-blue-400 outline-none uppercase" value={qrData} onChange={(e) => setQrData(e.target.value.toUpperCase())} />
                  )}
                  {modo === 'usb' && <p className="text-blue-500 font-black animate-pulse text-xs uppercase">Esperando lectura de escáner...</p>}
                </>
              ) : (
                <div className="text-center">
                  <div className="text-emerald-500 text-3xl mb-1">✔</div>
                  <p className="text-emerald-500 font-black text-[10px] uppercase">Lectura capturada</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {modo === 'manual' && (
                <input type="password" placeholder="PIN EMPLEADO" className="w-full py-4 bg-[#050a14] rounded-[25px] text-center text-xl border border-white/5 outline-none" value={pinEmpleadoManual} onChange={(e) => setPinEmpleadoManual(e.target.value)} />
              )}
              <input ref={pinRef} type="password" placeholder={modo === 'manual' ? "PIN ADMINISTRADOR" : "PIN AUTORIZACIÓN"} className="w-full py-6 bg-[#050a14] rounded-[30px] text-center text-3xl font-black border-2 border-blue-500/20 focus:border-blue-500 outline-none transition-all" value={modo === 'manual' ? pinAdminManual : pinSupervisor} onChange={(e) => modo === 'manual' ? setPinAdminManual(e.target.value) : setPinSupervisor(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') registrarAcceso(); }} />
            </div>

            <button onClick={registrarAcceso} disabled={animar || !qrData || (modo === 'manual' ? !pinAdminManual : !pinSupervisor)} className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl uppercase italic shadow-xl disabled:opacity-30">
              {animar ? 'PROCESANDO...' : 'CONFIRMAR ACCESO'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}