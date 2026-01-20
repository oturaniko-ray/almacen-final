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
    if (scannerRef.current) { try { await scannerRef.current.stop(); } catch(e){} scannerRef.current = null; }
    setQrData(''); setPinSupervisor(''); setAnimar(false);
    if (direccion) setDireccion(null); else if (modo !== 'menu') setModo('menu'); else router.push('/');
  };

  // 1. RESTAURACIÓN LECTURA USB
  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const limpio = buffer.replace(/(ScrollLock|AltGraph|Control|Shift|CapsLock|Alt|Meta|Tab)/gi, "").trim();
        if (limpio) { setQrData(limpio); setTimeout(() => pinRef.current?.focus(), 200); }
        buffer = "";
      } else if (e.key.length === 1) { buffer += e.key; }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  // 2. CORRECCIÓN ARRANQUE CÁMARA
  useEffect(() => {
    let isMounted = true;
    if (modo === 'camara' && direccion && !qrData) {
      const start = async () => {
        try {
          await new Promise(r => setTimeout(r, 800)); // Delay para asegurar montaje del div 'reader'
          if (!isMounted) return;
          const scanner = new Html5Qrcode("reader");
          scannerRef.current = scanner;
          await scanner.start(
            { facingMode: "environment" }, 
            { fps: 15, qrbox: 250 }, 
            (text) => {
              setQrData(text);
              scanner.stop().catch(() => {});
              setTimeout(() => pinRef.current?.focus(), 200);
            }, 
            () => {}
          );
        } catch (err) { console.error("Error cámara:", err); }
      };
      start();
    }
    return () => { isMounted = false; if (scannerRef.current) scannerRef.current.stop().catch(() => {}); };
  }, [modo, direccion, qrData]);

  const registrar = async () => {
    if (!qrData || !pinSupervisor) return;
    setAnimar(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const dSup = calcularDistancia(pos.coords.latitude, pos.coords.longitude, ALMACEN_LAT, ALMACEN_LON);
      if (dSup > RADIO_MAXIMO_METROS) {
        alert(`FUERA DE RANGO: Estás a ${Math.round(dSup)}m del almacén.`);
        setAnimar(false); return;
      }

      let documentoId = qrData;
      try {
        const decoded = atob(qrData).split('|');
        if (decoded.length === 2) {
          const tokenMinuto = parseInt(decoded[1]);
          const minutoActual = Math.floor(Date.now() / 60000);
          if (Math.abs(minutoActual - tokenMinuto) > 2) { // 2 min de gracia
            alert("TOKEN EXPIRADO"); setAnimar(false); return;
          }
          documentoId = decoded[0];
        }
      } catch (e) { /* No es Base64, usar qrData original */ }

      const session = JSON.parse(localStorage.getItem('user_session') || '{}');
      const { data: emp } = await supabase.from('empleados').select('*').eq('documento_id', documentoId).single();
      if (!emp || !emp.activo) { alert("Empleado no válido"); setAnimar(false); return; }

      const { data: sup } = await supabase.from('empleados').select('*').eq('id', session.id).eq('pin_seguridad', pinSupervisor.trim()).single();
      if (!sup) { alert("PIN INCORRECTO"); setAnimar(false); return; }

      const { error } = await supabase.from('registros_acceso').insert([{
        empleado_id: emp.id,
        nombre_empleado: emp.nombre,
        tipo_movimiento: direccion,
        detalles: `${modo.toUpperCase()} - AUTORIZÓ: ${sup.nombre}`
      }]);

      if (!error) {
        await supabase.from('empleados').update({ en_almacen: direccion === 'entrada' }).eq('id', emp.id);
        alert("REGISTRO EXITOSO"); handleVolver();
      }
      setAnimar(false);
    }, () => { alert("GPS REQUERIDO"); setAnimar(false); });
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      {animar && <div className="fixed inset-0 z-[100] bg-slate-950/90 flex items-center justify-center font-black animate-pulse">PROCESANDO SEGURIDAD...</div>}
      
      <button onClick={handleVolver} className="absolute top-8 left-8 bg-[#1e293b] px-6 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest border border-white/5">← Volver</button>
      
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 text-center shadow-2xl">
        <h1 className="text-2xl font-black uppercase italic tracking-tighter mb-10 text-blue-500">Supervisor</h1>
        
        {modo === 'menu' ? (
          <div className="space-y-4">
            <button onClick={() => setModo('usb')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl hover:bg-blue-600">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl hover:bg-emerald-600">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="w-full p-8 bg-slate-800 rounded-[25px] font-bold text-xl">🖋️ Manual</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-500 rounded-[30px] font-black text-4xl shadow-xl">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-500 rounded-[30px] font-black text-4xl shadow-xl">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            {modo === 'camara' && !qrData && (
              <div id="reader" className="w-full rounded-3xl overflow-hidden bg-black" style={{ minHeight: '300px' }}></div>
            )}
            
            <div className="bg-[#050a14] p-6 rounded-[30px] border border-white/5">
              <input 
                type="text" 
                className="bg-transparent text-blue-400 font-mono font-bold text-center w-full outline-none" 
                placeholder={modo === 'usb' ? 'ESCANEE AHORA...' : 'ESPERANDO TOKEN...'}
                value={qrData} 
                onChange={(e)=>setQrData(e.target.value)}
                autoFocus={modo === 'manual' || modo === 'usb'}
              />
            </div>

            <input 
              ref={pinRef} 
              type="password" 
              placeholder="PIN AUTORIZACIÓN" 
              className="w-full py-6 bg-[#050a14] rounded-[30px] text-white text-center text-3xl font-black outline-none border-2 border-blue-500/20 focus:border-blue-500" 
              value={pinSupervisor} 
              onChange={(e) => setPinSupervisor(e.target.value)} 
            />
            <button onClick={registrar} className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl hover:bg-blue-500 uppercase italic">Verificar</button>
          </div>
        )}
      </div>
    </main>
  );
}