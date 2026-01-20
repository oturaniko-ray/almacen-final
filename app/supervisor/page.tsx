'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function SupervisorPage() {
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pinSupervisor, setPinSupervisor] = useState('');
  const [animar, setAnimar] = useState(false);
  const [coordenadas, setCoordenadas] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const sessionStr = localStorage.getItem('user_session');
    if (!sessionStr) router.push('/');
  }, [router]);

  useEffect(() => {
    if (direccion) {
      navigator.geolocation.getCurrentPosition(
        (p) => setCoordenadas(`${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`),
        () => setCoordenadas('GPS Denegado'),
        { enableHighAccuracy: true }
      );
    }
  }, [direccion]);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current.stop();
      scannerRef.current = null;
    }
  };

  const handleVolver = async () => {
    setQrData(''); setPinSupervisor(''); setAnimar(false);
    if (direccion) { await stopScanner(); setDireccion(null); }
    else if (modo !== 'menu') { await stopScanner(); setModo('menu'); }
    else { router.push('/'); }
  };

  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const limpio = buffer.replace(/(ScrollLock|AltGraph|Control|Shift|CapsLock|Alt|Meta|Tab)/gi, "").trim();
        if (limpio) {
          setAnimar(true);
          setTimeout(() => { 
            setQrData(limpio); 
            setAnimar(false); 
            setTimeout(() => pinRef.current?.focus(), 150); 
          }, 800);
        }
        buffer = "";
      } else if (e.key.length === 1) { buffer += e.key; }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  useEffect(() => {
    let isMounted = true;
    const startCamera = async () => {
      if (modo === 'camara' && direccion && !qrData) {
        await new Promise(r => setTimeout(r, 1000));
        if (!isMounted) return;
        try {
          const scanner = new Html5Qrcode("reader");
          scannerRef.current = scanner;
          await scanner.start(
            { facingMode: "environment" },
            { fps: 15, qrbox: { width: 250, height: 250 } },
            (text) => {
              setAnimar(true);
              setQrData(text);
              stopScanner();
              setTimeout(() => { setAnimar(false); pinRef.current?.focus(); }, 800);
            },
            () => {}
          );
        } catch (err) { console.error("Error Cámara:", err); }
      }
    };
    startCamera();
    return () => { isMounted = false; stopScanner(); };
  }, [modo, direccion, qrData]);

  const registrar = async () => {
    if (!qrData || !pinSupervisor) return;
    const idLimpio = qrData.split('|')[0].trim();
    const session = JSON.parse(localStorage.getItem('user_session') || '{}');

    const { data: emp } = await supabase.from('empleados').select('*').eq('documento_id', idLimpio).single();
    if (!emp || !emp.activo) { alert("Empleado no válido"); return; }

    const { data: sup } = await supabase.from('empleados').select('*').eq('id', session.id).eq('pin_seguridad', pinSupervisor.trim()).single();
    if (!sup) { alert("PIN INCORRECTO"); setPinSupervisor(''); return; }

    const { error } = await supabase.from('registros_acceso').insert([{
      empleado_id: emp.id,
      nombre_empleado: emp.nombre,
      tipo_movimiento: direccion,
      detalles: `${modo.toUpperCase()} - AUTORIZÓ: ${sup.nombre}`,
      coordenadas: coordenadas
    }]);

    if (!error) {
      await supabase.from('empleados').update({ en_almacen: direccion === 'entrada' }).eq('id', emp.id);
      alert("✅ REGISTRO EXITOSO");
      handleVolver();
    } else {
      alert("Error al registrar: " + error.message);
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      {animar && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-black italic uppercase tracking-widest animate-pulse">Procesando...</p>
        </div>
      )}

      <button onClick={handleVolver} className="absolute top-8 left-8 bg-[#1e293b] px-6 py-3 rounded-xl font-bold border border-white/5 uppercase text-[10px] tracking-widest">← Volver</button>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 text-center shadow-2xl relative">
        <h1 className="text-2xl font-black uppercase italic tracking-tighter mb-10">Control de Almacén</h1>

        {modo === 'menu' ? (
          <div className="space-y-4">
            <button onClick={() => setModo('usb')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl hover:bg-blue-600 transition-all">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl hover:bg-emerald-600 transition-all">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl hover:bg-amber-600 transition-all">🖋️ Ingreso Manual</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-500 rounded-[30px] font-black text-4xl shadow-xl hover:scale-105 transition-transform">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-500 rounded-[30px] font-black text-4xl shadow-xl hover:scale-105 transition-transform">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div id="reader" className={`w-full rounded-3xl overflow-hidden bg-black ${modo !== 'camara' || qrData ? 'hidden' : 'block'}`} style={{ minHeight: '300px' }}></div>
            
            <div className="bg-[#050a14] p-6 rounded-[30px] border border-white/5">
              <p className="text-[10px] text-slate-500 font-black uppercase mb-2">ID Detectado</p>
              {modo === 'manual' ? (
                <input type="text" className="w-full bg-transparent text-white font-bold text-2xl outline-none text-center" value={qrData} onChange={(e)=>setQrData(e.target.value)} placeholder="00000000" autoFocus />
              ) : (
                <p className="text-blue-400 font-mono font-bold text-xl break-all">{qrData || "Esperando lectura..."}</p>
              )}
            </div>
            
            <div className="text-left space-y-2">
              <p className="text-[10px] text-amber-500 font-black uppercase ml-4 text-center">PIN Autorización Supervisor</p>
              <input ref={pinRef} type="password" placeholder="****" className="w-full py-6 bg-[#050a14] rounded-[30px] text-white text-center text-4xl font-black outline-none border-2 border-amber-500/20 focus:border-amber-500" value={pinSupervisor} onChange={(e) => setPinSupervisor(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && registrar()} />
            </div>

            <button onClick={registrar} className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl hover:bg-blue-500 transition-all uppercase italic">Confirmar Acceso</button>
          </div>
        )}
      </div>
    </main>
  );
}