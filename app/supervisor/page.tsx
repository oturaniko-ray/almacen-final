'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 COORDENADAS DEL ALMACÉN (Ajusta estas a tu ubicación real)
const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 50; // Radio de tolerancia


export default function SupervisorPage() {
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pinSupervisor, setPinSupervisor] = useState('');
  const [animar, setAnimar] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  };

  const handleVolver = async () => {
    if (scannerRef.current) {
      try { if (scannerRef.current.isScanning) await scannerRef.current.stop(); } catch (e) {}
      scannerRef.current = null;
    }
    setQrData(''); setPinSupervisor(''); setAnimar(false);
    if (direccion) setDireccion(null); else if (modo !== 'menu') setModo('menu'); else router.push('/');
  };

  // LECTURA USB
  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const limpio = buffer.replace(/(ScrollLock|AltGraph|Control|Shift|CapsLock|Alt|Meta|Tab)/gi, "").trim();
        if (limpio) { setQrData(limpio); setTimeout(() => pinRef.current?.focus(), 200); }
        buffer = "";
      } else if (e.key.length === 1) buffer += e.key;
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  // CÁMARA CON ANIMACIÓN LÁSER
  useEffect(() => {
    let isMounted = true;
    if (modo === 'camara' && direccion && !qrData) {
      const iniciarScanner = async () => {
        await new Promise(r => setTimeout(r, 1000));
        if (!isMounted || !document.getElementById("reader")) return;
        const scanner = new Html5Qrcode("reader");
        scannerRef.current = scanner;
        try {
          await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
            (decodedText) => {
              setQrData(decodedText);
              scanner.stop().catch(() => {});
              setTimeout(() => pinRef.current?.focus(), 300);
            }, () => {});
        } catch (err) { console.error(err); }
      };
      iniciarScanner();
    }
    return () => { isMounted = false; if (scannerRef.current?.isScanning) scannerRef.current.stop().catch(() => {}); };
  }, [modo, direccion, qrData]);

  const registrar = async () => {
    if (!qrData || !pinSupervisor) return;
    setAnimar(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const dSup = calcularDistancia(pos.coords.latitude, pos.coords.longitude, ALMACEN_LAT, ALMACEN_LON);
        if (dSup > RADIO_MAXIMO_METROS) throw new Error(`Supervisor fuera de rango (${Math.round(dSup)}m)`);

        let documentoId = qrData;
        try {
          const decoded = atob(qrData).split('|');
          if (decoded.length === 2) documentoId = decoded[0];
        } catch (e) {}

        // 1. Validar Empleado Escaneado
        const { data: emp, error: errEmp } = await supabase.from('empleados').select('*').eq('documento_id', documentoId).maybeSingle();
        if (errEmp || !emp) throw new Error("Empleado no encontrado.");
        if (!emp.activo) throw new Error("Empleado inactivo.");

        // 2. Validar Supervisor (en la misma tabla empleados)
        const session = JSON.parse(localStorage.getItem('user_session') || '{}');
        const { data: sup, error: errSup } = await supabase.from('empleados').select('*').eq('id', session.id).eq('pin_seguridad', pinSupervisor.trim()).maybeSingle();
        if (errSup || !sup) throw new Error("PIN de Supervisor incorrecto.");

        // 3. Insertar Movimiento
        const { error: errInsert } = await supabase.from('registros_acceso').insert([{
          empleado_id: emp.id,
          nombre_empleado: emp.nombre,
          tipo_movimiento: direccion,
          detalles: `${modo.toUpperCase()} - AUTORIZÓ: ${sup.nombre}`
        }]);
        if (errInsert) throw new Error("Error al registrar en historial.");

        // 4. Actualizar Estatus en_almacen
        const { error: errUpdate } = await supabase.from('empleados').update({ en_almacen: (direccion === 'entrada') }).eq('id', emp.id);
        if (errUpdate) throw new Error("Error al actualizar estatus visual.");

        alert(`REGISTRO DE ${direccion?.toUpperCase()} EXITOSO`);
        handleVolver();

      } catch (error: any) {
        alert(error.message);
      } finally {
        setAnimar(false);
      }
    }, () => {
      alert("Se requiere GPS activo.");
      setAnimar(false);
    });
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      {animar && <div className="fixed inset-0 z-[100] bg-slate-950/90 flex items-center justify-center font-black italic animate-pulse text-blue-500">PROCESANDO...</div>}
      <button onClick={handleVolver} className="absolute top-8 left-8 bg-[#1e293b] px-6 py-3 rounded-xl font-bold uppercase text-[10px] border border-white/5 z-50">← Volver</button>
      
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 text-center shadow-2xl relative overflow-hidden">
        <h1 className="text-2xl font-black uppercase italic tracking-tighter mb-10 text-blue-500">Supervisor</h1>
        
        {modo === 'menu' ? (
          <div className="space-y-4">
            <button onClick={() => setModo('usb')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl hover:bg-blue-600 border border-white/5 transition-all">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl hover:bg-emerald-600 border border-white/5 transition-all">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="w-full p-8 bg-slate-800 rounded-[25px] font-bold text-xl">🖋️ Manual</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[30px] font-black text-4xl shadow-xl hover:scale-105 transition-all">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[30px] font-black text-4xl shadow-xl hover:scale-105 transition-all">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            {modo === 'camara' && !qrData && (
              <div className="relative w-full aspect-square rounded-3xl overflow-hidden bg-black border-2 border-white/10 shadow-2xl">
                <div id="reader" className="w-full h-full"></div>
                <div className="absolute inset-0 pointer-events-none border-2 border-emerald-500/30 rounded-3xl">
                  <div className="w-full h-[2px] bg-emerald-500 shadow-[0_0_15px_#10b981] absolute top-0 animate-[scan_2s_linear_infinite]"></div>
                </div>
              </div>
            )}
            <div className="bg-[#050a14] p-6 rounded-[30px] border border-white/5 shadow-inner">
              <input type="text" className="bg-transparent text-blue-400 font-mono font-bold text-center w-full outline-none uppercase text-lg" 
                placeholder={qrData ? qrData : "Esperando Lectura de QR"} value={qrData} onChange={(e)=>setQrData(e.target.value)} autoFocus={modo === 'manual' || modo === 'usb'} />
            </div>
            <input ref={pinRef} type="password" placeholder="PIN AUTORIZACIÓN" className="w-full py-6 bg-[#050a14] rounded-[30px] text-white text-center text-3xl font-black outline-none border-2 border-blue-500/20 focus:border-blue-500 shadow-lg" value={pinSupervisor} onChange={(e) => setPinSupervisor(e.target.value)} />
            <button onClick={registrar} className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl hover:bg-blue-500 uppercase italic transition-all shadow-xl">Confirmar Registro</button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes scan { 0% { top: 0%; } 100% { top: 100%; } }
        #reader video { object-fit: cover !important; border-radius: 24px; }
      `}</style>
    </main>
  );
}
