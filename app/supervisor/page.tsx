'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function SupervisorPage() {
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pin, setPin] = useState('');
  const [documentoManual, setDocumentoManual] = useState('');
  const [animar, setAnimar] = useState(false);
  const [coordenadas, setCoordenadas] = useState(''); // PUNTO 5: Estado para GPS
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const playSound = (t: 'success' | 'error') => {
    const a = new Audio(t === 'success' ? 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' : 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
    a.play().catch(() => {});
  };

  // PUNTO 5: Captura coordenadas en cuanto se elige dirección
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
    if (qrData || documentoManual) { setQrData(''); setDocumentoManual(''); setPin(''); }
    else if (direccion) { setDireccion(null); await stopScanner(); }
    else if (modo !== 'menu') { setModo('menu'); await stopScanner(); }
    else { router.push('/'); }
  };

  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.length > 1 && e.key !== 'Enter') return;
      if (e.key === 'Enter') {
        const limpio = buffer.replace(/ScrollLock|AltGraph|Control|Shift/gi, "").trim();
        if (limpio) {
          setAnimar(true);
          setTimeout(() => { setQrData(limpio); setAnimar(false); setTimeout(() => pinRef.current?.focus(), 100); }, 600);
        }
        buffer = "";
      } else { buffer += e.key; }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  // PUNTO 4: Fix de Cámara (Agregado delay de procesamiento)
  useEffect(() => {
    let isMounted = true;
    if (modo === 'camara' && direccion && !qrData) {
      setTimeout(() => {
        const scanner = new Html5Qrcode("reader");
        scannerRef.current = scanner;
        scanner.start({ facingMode: "environment" }, { fps: 24, qrbox: { width: 250, height: 250 } }, 
        (text) => {
          if (isMounted) {
            setAnimar(true); setQrData(text); setAnimar(false);
            stopScanner();
            setTimeout(() => pinRef.current?.focus(), 200);
          }
        }, () => {}).catch(console.error);
      }, 500);
    }
    return () => { isMounted = false; stopScanner(); };
  }, [modo, direccion, qrData]);

  const registrar = async () => {
    const idCapturado = modo === 'manual' ? documentoManual : qrData;
    const [idLimpio] = idCapturado.split('|');
    const supSession = JSON.parse(localStorage.getItem('user_session') || '{}');
    
    // PUNTO 1: Leer BD antes de validar para tener datos frescos
    const { data: emp, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('documento_id', idLimpio.trim())
      .single();

    if (error || !emp || !emp.activo || emp.pin_seguridad !== pin.trim()) {
      playSound('error'); 
      alert(!emp ? "❌ ID NO ENCONTRADO" : !emp.activo ? "❌ EMPLEADO INACTIVO" : "❌ PIN INCORRECTO"); 
      setPin(''); return;
    }

    // PUNTO 5: Guardar con coordenadas en la BD
    const { error: regError } = await supabase.from('registros_acceso').insert([{
      empleado_id: emp.id, 
      nombre_empleado: emp.nombre, 
      tipo_movimiento: direccion,
      detalles: `${modo.toUpperCase()} - POR: ${supSession.nombre || 'SISTEMA'}`,
      coordenadas: coordenadas // GUARDADO GPS
    }]);

    if (!regError) {
      // PUNTO 1: Refrescar estado del empleado en BD
      await supabase.from('empleados').update({ en_almacen: direccion === 'entrada' }).eq('id', emp.id);
      playSound('success'); 
      setQrData(''); setPin(''); setDocumentoManual(''); setModo('menu'); setDireccion(null);
      alert(`✅ REGISTRO EXITOSO (${direccion.toUpperCase()})`);
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <style>{`
        @keyframes glow { 0%, 100% { text-shadow: 0 0 5px #3b82f6; opacity: 1; } 50% { text-shadow: 0 0 20px #3b82f6; opacity: 0.7; } }
        .animate-glow { animation: glow 1.5s infinite; }
      `}</style>
      <button onClick={handleVolver} className="absolute top-8 left-8 bg-[#1e293b] px-6 py-3 rounded-xl font-bold border border-white/10 shadow-lg">← VOLVER</button>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 text-center shadow-2xl relative overflow-hidden">
        {animar && <div className="absolute inset-0 bg-blue-600/20 z-50 flex items-center justify-center backdrop-blur-sm animate-pulse"><span className="font-black text-2xl italic tracking-widest">VALIDANDO...</span></div>}

        <h1 className="text-3xl font-black mb-12 text-blue-500 uppercase tracking-widest italic">Supervisor</h1>

        {modo === 'menu' ? (
          <div className="space-y-4">
            <button onClick={() => setModo('usb')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl flex items-center gap-4 hover:bg-blue-600 transition-all">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl flex items-center gap-4 hover:bg-emerald-600 transition-all">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl flex items-center gap-4 hover:bg-amber-600 transition-all">🖋️ Ingreso Manual</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-500 rounded-[30px] font-black text-3xl shadow-lg">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-500 rounded-[30px] font-black text-3xl shadow-lg">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div id="reader" className={`w-full rounded-3xl overflow-hidden bg-black mb-4 ${modo !== 'camara' ? 'hidden' : 'block'}`} style={{ minHeight: '300px' }}></div>
            
            <div className="bg-[#050a14] p-8 rounded-[30px] border border-white/5 flex flex-col items-center">
              {!qrData && modo !== 'manual' && <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>}
              {modo === 'manual' ? (
                <input type="text" placeholder="DOCUMENTO ID" className="bg-transparent text-center text-white font-bold text-2xl outline-none w-full" value={documentoManual} onChange={(e) => setDocumentoManual(e.target.value)} autoFocus />
              ) : (
                <p className={`text-blue-400 font-mono font-bold text-2xl uppercase ${!qrData ? 'animate-glow' : ''}`}>{qrData.split('|')[0] || "Esperando QR"}</p>
              )}
            </div>
            
            <div className="space-y-1">
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">PIN DE SEGURIDAD</p>
              <input ref={pinRef} type="password" placeholder="****" className="w-full py-6 bg-[#050a14] rounded-[30px] text-white text-center text-5xl font-black outline-none border-2 border-transparent focus:border-blue-500" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && registrar()} />
            </div>
            <button onClick={registrar} className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl hover:bg-blue-500 transition-all uppercase italic">Confirmar</button>
          </div>
        )}
      </div>
    </main>
  );
}