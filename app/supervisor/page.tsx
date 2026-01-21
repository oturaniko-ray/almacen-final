'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 COORDENADAS RESTAURADAS (Tu ubicación exacta)
const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 80; // Margen de error/tolerancia

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

  // Función de Haversine para calcular distancia entre puntos
  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Radio de la tierra en metros
    const phi1 = lat1 * Math.PI/180;
    const phi2 = lat2 * Math.PI/180;
    const delPhi = (lat2-lat1) * Math.PI/180;
    const delLon = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(delPhi/2) * Math.sin(delPhi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(delLon/2) * Math.sin(delLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const volverADireccionYLimpiar = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
      scannerRef.current = null;
    }
    setQrData(''); setPinSupervisor(''); setPinEmpleadoManual(''); setPinAdminManual('');
    setAnimar(false); setDireccion(null); 
  };

  const volverAtras = async () => {
    if (mostrarWarning) { setMostrarWarning(false); setModo('menu'); }
    else if (direccion) { volverADireccionYLimpiar(); }
    else if (modo === 'menu') { router.push('/'); }
    else { setModo('menu'); }
  };

  // Cámara Móvil
  useEffect(() => {
    if (modo === 'camara' && direccion && !qrData && !mostrarWarning) {
      const startCamera = async () => {
        try {
          await new Promise(r => setTimeout(r, 300));
          const scanner = new Html5Qrcode("reader");
          scannerRef.current = scanner;
          await scanner.start({ facingMode: "environment" }, { fps: 20, qrbox: 250 }, (text) => {
            setQrData(text.trim());
            scanner.stop();
            setTimeout(() => pinRef.current?.focus(), 100);
          }, () => {});
        } catch (err) { console.error(err); }
      };
      startCamera();
    }
    return () => { if (scannerRef.current?.isScanning) scannerRef.current.stop(); };
  }, [modo, direccion, qrData, mostrarWarning]);

  // Escáner USB
  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData || mostrarWarning) return;
    let usbBuffer = "";
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (usbBuffer.trim()) { setQrData(usbBuffer.trim()); setTimeout(() => pinRef.current?.focus(), 50); }
        usbBuffer = "";
      } else if (e.key.length === 1) { usbBuffer += e.key; }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [modo, direccion, qrData, mostrarWarning]);

  const registrarAcceso = async () => {
    const esManual = modo === 'manual';
    const pinAValidar = esManual ? pinAdminManual : pinSupervisor;
    let idFinal = qrData.trim();

    if (!esManual && idFinal) {
      try {
        if (idFinal.includes('|') || idFinal.length > 20) {
          idFinal = atob(idFinal).split('|')[0];
        }
      } catch (e) {}
    }

    if (!idFinal || !pinAValidar || animar) return;
    setAnimar(true);

    // ⚡ PROCESO PARALELO: GPS + BASE DE DATOS
    const geoPromise = new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { 
        enableHighAccuracy: true, 
        timeout: 4000 
      });
    });

    try {
      const [pos, empRes, authRes] = await Promise.all([
        geoPromise as Promise<GeolocationPosition | null>,
        supabase.from('empleados').select('id, nombre, pin_seguridad').eq('documento_id', idFinal.toUpperCase()).maybeSingle(),
        supabase.from('empleados').select('nombre, rol').eq('pin_seguridad', pinAValidar).maybeSingle()
      ]);

      // 1. VALIDACIÓN DE UBICACIÓN (Punto crítico solicitado)
      if (!pos) throw new Error("No se pudo obtener la ubicación. Active el GPS.");
      const distancia = calcularDistancia(pos.coords.latitude, pos.coords.longitude, ALMACEN_LAT, ALMACEN_LON);
      if (distancia > RADIO_MAXIMO_METROS) {
        throw new Error(`Fuera de rango (${Math.round(distancia)}m). Debe estar en el almacén.`);
      }

      // 2. VALIDACIÓN DE DATOS
      if (!empRes.data) throw new Error(`Empleado ${idFinal} no registrado`);
      if (esManual && empRes.data.pin_seguridad !== pinEmpleadoManual) throw new Error("PIN empleado incorrecto");
      if (!authRes.data) throw new Error("PIN de autorización inválido");
      if (esManual && authRes.data.rol !== 'administrador') throw new Error("Acceso manual requiere Administrador");

      // 3. REGISTRO
      await Promise.all([
        supabase.from('empleados').update({ en_almacen: direccion === 'entrada' }).eq('id', empRes.data.id),
        supabase.from('registros_acceso').insert([{
          empleado_id: empRes.data.id,
          nombre_empleado: empRes.data.nombre,
          tipo_movimiento: direccion,
          detalles: esManual ? `MANUAL - Admin: ${authRes.data.nombre}` : `SUP: ${authRes.data.nombre} (${modo})`
        }])
      ]);

      alert(`✅ REGISTRADO: ${empRes.data.nombre}`);
      await volverADireccionYLimpiar();
    } catch (err: any) {
      alert(`❌ ${err.message}`);
      setAnimar(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative">
      <style jsx global>{`
        @keyframes laser { 0% { top: 0%; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
        @keyframes warningBlink { 0%, 100% { border-color: #facc15; background-color: rgba(250,204,21,0.2); } 50% { border-color: transparent; background-color: transparent; } }
        @keyframes textBlink { 0%, 100% { color: #facc15; } 50% { color: #854d0e; } }
      `}</style>

      {mostrarWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <div className="bg-[#1a1a1a] p-10 rounded-[40px] border-8 animate-[warningBlink_0.8s_infinite] max-w-md text-center">
            <p className="font-black text-2xl uppercase italic animate-[textBlink_0.8s_infinite]">
              Acceso Manual:<br/>Requiere Validación de Administrador
            </p>
            <div className="mt-8 py-2 px-6 bg-yellow-400 text-black rounded-full font-black text-[10px]">PRESIONE ENTER</div>
          </div>
        </div>
      )}

      <button onClick={volverAtras} className="absolute top-8 left-8 bg-[#1e293b] px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest z-50 hover:bg-red-600 transition-all shadow-lg">
        ← Volver
      </button>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl">
        <h2 className="text-2xl font-black uppercase italic text-blue-500 mb-8 text-center tracking-tighter">Gestión de Acceso</h2>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-blue-500 transition-all uppercase text-center">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-emerald-500 transition-all uppercase text-center">📱 Cámara Móvil</button>
            <button onClick={() => { setModo('manual'); setMostrarWarning(true); }} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-yellow-500 transition-all uppercase text-center">🖋️ Entrada Manual</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-xl active:scale-95 transition-transform">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl shadow-xl active:scale-95 transition-transform">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`bg-[#050a14] p-6 rounded-[30px] border transition-all ${qrData ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'border-white/5'} h-32 flex flex-col items-center justify-center overflow-hidden relative`}>
              {!qrData ? (
                <>
                  {modo !== 'manual' && <div className="absolute inset-x-0 h-[3px] bg-red-600 shadow-[0_0_15px_red] animate-[laser_2s_infinite_linear]"></div>}
                  {modo === 'camara' && <div id="reader" className="w-full h-full rounded-2xl"></div>}
                  {modo === 'manual' && (
                    <input type="text" placeholder="ID EMPLEADO" maxLength={15} className="w-full bg-transparent text-center text-xl font-bold text-blue-400 outline-none uppercase" value={qrData} onChange={(e) => setQrData(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
                  )}
                  {modo === 'usb' && <p className="text-blue-500 font-black animate-pulse uppercase text-center">Esperando Escaneo...</p>}
                </>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center mb-1">✔</div>
                  <p className="text-emerald-500 font-black text-[10px] uppercase">Lectura Correcta</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {modo === 'manual' && (
                <input type="password" placeholder="PIN EMPLEADO" className="w-full py-4 bg-[#050a14] rounded-[25px] text-center text-xl border border-white/10 outline-none" value={pinEmpleadoManual} onChange={(e) => setPinEmpleadoManual(e.target.value)} />
              )}
              <input ref={pinRef} type="password" placeholder={modo === 'manual' ? "PIN ADMINISTRADOR" : "PIN SUPERVISOR"} className="w-full py-6 bg-[#050a14] rounded-[30px] text-center text-3xl font-black border-2 border-blue-500/20 focus:border-blue-500 outline-none" value={modo === 'manual' ? pinAdminManual : pinSupervisor} onChange={(e) => modo === 'manual' ? setPinAdminManual(e.target.value) : setPinSupervisor(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') registrarAcceso(); }} />
            </div>

            <button onClick={registrarAcceso} disabled={animar || !qrData || (modo === 'manual' ? !pinAdminManual : !pinSupervisor)} className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl uppercase italic shadow-lg disabled:opacity-50">
              {animar ? 'VERIFICANDO...' : 'CONFIRMAR ACCESO'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}