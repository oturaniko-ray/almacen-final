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
  const [pin, setPin] = useState('');
  const [pinSupervisor, setPinSupervisor] = useState('');
  const [animar, setAnimar] = useState(false);
  const [coordenadas, setCoordenadas] = useState('');
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 1. VALIDACIÓN DE SESIÓN ÚNICA Y ROL
  const validarSesionUnica = useCallback(async () => {
    const sessionStr = localStorage.getItem('user_session');
    if (!sessionStr) { router.push('/'); return; }
    const session = JSON.parse(sessionStr);
    const { data: dbUser } = await supabase.from('empleados').select('session_token, activo, rol').eq('id', session.id).single();

    if (!dbUser || dbUser.session_token !== session.session_token || !dbUser.activo || dbUser.rol !== 'supervisor') {
      localStorage.clear();
      router.push('/');
    }
  }, [router]);

  useEffect(() => {
    validarSesionUnica();
    const interval = setInterval(validarSesionUnica, 15000);
    return () => clearInterval(interval);
  }, [validarSesionUnica]);

  // 2. GEOLOCALIZACIÓN
  useEffect(() => {
    if (direccion) {
      navigator.geolocation.getCurrentPosition(
        (p) => setCoordenadas(`${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`),
        () => setCoordenadas('GPS Denegado'),
        { enableHighAccuracy: true }
      );
    }
  }, [direccion]);

  // 3. CONTROL DE CÁMARA
  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error("Error al detener cámara:", err);
      }
    }
  };

  const handleVolver = async () => {
    setQrData(''); setPin(''); setPinSupervisor('');
    if (direccion) { 
      await stopScanner();
      setDireccion(null); 
    } else if (modo !== 'menu') { 
      await stopScanner();
      setModo('menu'); 
    } else { 
      router.push('/'); 
    }
  };

  // 4. LÓGICA USB (CON LIMPIEZA DE CARACTERES BASURA)
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
          }, 500);
        }
        buffer = "";
      } else if (e.key.length === 1) { buffer += e.key; }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  // 5. LÓGICA CÁMARA (CORREGIDA PARA TURBOPACK)
  useEffect(() => {
    let isMounted = true;
    const startCamera = async () => {
      if (modo === 'camara' && direccion && !qrData) {
        await new Promise(r => setTimeout(r, 800)); 
        if (!isMounted) return;
        try {
          const scanner = new Html5Qrcode("reader");
          scannerRef.current = scanner;
          await scanner.start(
            { facingMode: "environment" }, 
            { fps: 20, qrbox: { width: 250, height: 250 } }, 
            (text) => {
              setQrData(text);
              stopScanner();
              setTimeout(() => pinRef.current?.focus(), 250);
            },
            () => {}
          );
        } catch (err) {
          console.error("Error cámara:", err);
        }
      }
    };
    startCamera();
    return () => { isMounted = false; stopScanner(); };
  }, [modo, direccion, qrData]);

  // 6. FUNCIÓN DE REGISTRO
  const registrar = async () => {
    if (intentosFallidos >= 3) {
      alert("❌ ACCESO BLOQUEADO POR SEGURIDAD: Demasiados intentos fallidos.");
      return;
    }

    const idLimpio = qrData.split('|')[0].trim();
    const supSession = JSON.parse(localStorage.getItem('user_session') || '{}');

    const { data: emp } = await supabase.from('empleados').select('*').eq('documento_id', idLimpio).single();

    if (!emp || !emp.activo || emp.pin_seguridad !== pin.trim()) {
      alert("❌ DATOS DE EMPLEADO INCORRECTOS");
      setPin(''); 
      return;
    }

    if (modo === 'manual') {
      const { data: sup } = await supabase.from('empleados').select('*').eq('id', supSession.id).eq('pin_seguridad', pinSupervisor.trim()).single();
      if (!sup) {
        const nuevosIntentos = intentosFallidos + 1;
        setIntentosFallidos(nuevosIntentos);
        alert(`❌ PIN SUPERVISOR INCORRECTO. Intento ${nuevosIntentos} de 3.`);
        setPinSupervisor(''); 
        return;
      }
    }

    const { error: regError } = await supabase.from('registros_acceso').insert([{
      empleado_id: emp.id, 
      nombre_empleado: emp.nombre, 
      tipo_movimiento: direccion,
      detalles: `${modo.toUpperCase()} - POR: ${supSession.nombre}`,
      coordenadas: coordenadas 
    }]);

    if (!regError) {
      await supabase.from('empleados').update({ en_almacen: direccion === 'entrada' }).eq('id', emp.id);
      setQrData(''); setPin(''); setPinSupervisor(''); setModo('menu'); setDireccion(null);
      alert("✅ REGISTRO EXITOSO");
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans text-center">
      <style>{` @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } } .animate-blink { animation: blink 1s infinite; } `}</style>
      
      <button onClick={handleVolver} className="absolute top-8 left-8 bg-[#1e293b] px-6 py-3 rounded-xl font-bold border border-white/10 uppercase text-xs">← Volver</button>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="mb-10">
          <h1 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tighter">Entrada / Salida del Almacén</h1>
          <p className="text-blue-500 font-bold text-xs uppercase animate-blink mt-2">Toma de Datos</p>
        </div>

        {modo === 'menu' ? (
          <div className="space-y-4">
            <button onClick={() => setModo('usb')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl hover:bg-blue-600 transition-all">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl hover:bg-emerald-600 transition-all">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl hover:bg-amber-600 transition-all">🖋️ Ingreso Manual</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-500 rounded-[30px] font-black text-4xl shadow-xl">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-500 rounded-[30px] font-black text-4xl shadow-xl">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            {modo === 'camara' && !qrData && (
              <div id="reader" className="w-full rounded-3xl overflow-hidden bg-black border border-blue-500/30" style={{ minHeight: '300px' }}></div>
            )}
            
            <div className="bg-[#050a14] p-6 rounded-[30px] border border-white/5">
              {modo === 'manual' ? (
                <input type="text" className="w-full bg-transparent text-white font-bold text-2xl outline-none text-center" value={qrData} onChange={(e)=>setQrData(e.target.value)} placeholder="ID Empleado" autoFocus />
              ) : (
                <p className="text-blue-400 font-mono font-bold text-xl break-all">{qrData || "Esperando lectura..."}</p>
              )}
            </div>
            
            <div className="space-y-4 text-left">
              <p className="text-[10px] text-slate-500 font-bold uppercase ml-2 text-center">PIN Empleado</p>
              <input ref={pinRef} type="password" placeholder="****" className="w-full py-5 bg-[#050a14] rounded-2xl text-white text-center text-4xl font-black outline-none border-2 border-transparent focus:border-blue-500" value={pin} onChange={(e) => setPin(e.target.value)} />
              
              {modo === 'manual' && (
                <>
                  <p className="text-[10px] text-amber-500 font-bold uppercase ml-2 text-center">PIN Supervisor</p>
                  <input type="password" placeholder="****" className="w-full py-5 bg-[#050a14] rounded-2xl text-white text-center text-4xl font-black outline-none border-2 border-amber-500/30 focus:border-amber-500" value={pinSupervisor} onChange={(e) => setPinSupervisor(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && registrar()} />
                </>
              )}
            </div>

            <button onClick={registrar} className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl hover:bg-blue-500 transition-all uppercase italic">Confirmar Registro</button>
          </div>
        )}
      </div>
    </main>
  );
}