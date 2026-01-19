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

  // VALIDACIÓN DE SESIÓN ÚNICA (Evita 2 PCs con misma cuenta)
  const validarSesionUnica = useCallback(async () => {
    const sessionStr = localStorage.getItem('user_session');
    if (!sessionStr) { router.push('/'); return; }
    
    const session = JSON.parse(sessionStr);
    const { data: dbUser } = await supabase.from('empleados').select('session_token, activo').eq('id', session.id).single();

    if (!dbUser || dbUser.session_token !== session.session_token || !dbUser.activo) {
      alert("⚠️ SESIÓN INVALIDADA: Se inició sesión en otro dispositivo o el usuario fue desactivado.");
      localStorage.clear();
      router.push('/');
    }
  }, [router]);

  useEffect(() => {
    validarSesionUnica();
    const interval = setInterval(validarSesionUnica, 10000);
    return () => clearInterval(interval);
  }, [validarSesionUnica]);

  const playSound = (t: 'success' | 'error') => {
    const a = new Audio(t === 'success' ? 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' : 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
    a.play().catch(() => {});
  };

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
    if (qrData || pin) { setQrData(''); setPin(''); setPinSupervisor(''); }
    else if (direccion) { setDireccion(null); await stopScanner(); }
    else if (modo !== 'menu') { setModo('menu'); await stopScanner(); }
    else { router.push('/'); }
  };

  // USB Lógica
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

  // Cámara Lógica
  useEffect(() => {
    let isMounted = true;
    if (modo === 'camara' && direccion && !qrData) {
      setTimeout(() => {
        const scanner = new Html5Qrcode("reader");
        scannerRef.current = scanner;
        scanner.start({ facingMode: "environment" }, { fps: 24, qrbox: 250 }, 
        (text) => {
          if (isMounted) {
            setAnimar(true); setQrData(text); setAnimar(false); stopScanner();
            setTimeout(() => pinRef.current?.focus(), 200);
          }
        }, () => {}).catch(console.error);
      }, 500);
    }
    return () => { isMounted = false; stopScanner(); };
  }, [modo, direccion, qrData]);

  const registrar = async () => {
    if (intentosFallidos >= 3) {
      alert("❌ ACCESO BLOQUEADO: Demasiados intentos fallidos del supervisor.");
      return;
    }

    const idCapturado = modo === 'manual' ? qrData : qrData;
    const [idLimpio] = idCapturado.split('|');
    const supSession = JSON.parse(localStorage.getItem('user_session') || '{}');
    const movimientoActual = direccion || 'movimiento';

    // 1. Refrescar datos y validar Empleado
    const { data: emp } = await supabase.from('empleados').select('*').eq('documento_id', idLimpio.trim()).single();

    if (!emp || !emp.activo || emp.pin_seguridad !== pin.trim()) {
      playSound('error');
      alert("❌ DATOS DE EMPLEADO INCORRECTOS O INACTIVO");
      setPin(''); return;
    }

    // 2. Validar Supervisor (Manual) + Bloqueo
    if (modo === 'manual') {
      const { data: sup } = await supabase.from('empleados').select('*').eq('id', supSession.id).eq('pin_seguridad', pinSupervisor.trim()).single();

      if (!sup) {
        const nuevosIntentos = intentosFallidos + 1;
        setIntentosFallidos(nuevosIntentos);
        playSound('error');
        alert(`❌ PIN SUPERVISOR INCORRECTO. Intento ${nuevosIntentos} de 3.`);
        setPinSupervisor(''); return;
      }
    }

    // 3. Insertar Registro
    const { error: regError } = await supabase.from('registros_acceso').insert([{
      empleado_id: emp.id, 
      nombre_empleado: emp.nombre, 
      tipo_movimiento: direccion,
      detalles: `${modo.toUpperCase()} - POR: ${supSession.nombre}`,
      coordenadas: coordenadas 
    }]);

    if (!regError) {
      await supabase.from('empleados').update({ en_almacen: direccion === 'entrada' }).eq('id', emp.id);
      playSound('success');
      setIntentosFallidos(0);
      setQrData(''); setPin(''); setPinSupervisor(''); setModo('menu'); setDireccion(null);
      alert(`✅ REGISTRO EXITOSO (${movimientoActual.toUpperCase()})`);
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <style>{`
        @keyframes glow { 0%, 100% { text-shadow: 0 0 5px #3b82f6; opacity: 1; } 50% { text-shadow: 0 0 20px #3b82f6; opacity: 0.7; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
        .animate-glow { animation: glow 1.5s infinite; }
        .animate-blink { animation: blink 1s infinite; }
      `}</style>

      <button onClick={handleVolver} className="absolute top-8 left-8 bg-[#1e293b] px-6 py-3 rounded-xl font-bold border border-white/10 shadow-lg transition-all hover:bg-slate-800 uppercase text-xs tracking-widest">← Volver</button>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 text-center shadow-2xl relative overflow-hidden">
        {animar && <div className="absolute inset-0 bg-blue-600/20 z-50 flex items-center justify-center backdrop-blur-sm animate-pulse font-black italic">PROCESANDO...</div>}

        <div className="mb-12">
          <h1 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tighter">Entrada / Salida del Almacén</h1>
          <p className="text-blue-500 font-bold text-xs uppercase tracking-[0.3em] animate-blink mt-2">Toma de Datos</p>
        </div>

        {modo === 'menu' ? (
          <div className="space-y-4">
            <button onClick={() => setModo('usb')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl flex items-center gap-4 hover:bg-blue-600 transition-all shadow-lg"><span>🔌</span> Escáner USB</button>
            <button onClick={() => setModo('camara')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl flex items-center gap-4 hover:bg-emerald-600 transition-all shadow-lg"><span>📱</span> Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl flex items-center gap-4 hover:bg-amber-600 transition-all shadow-lg"><span>🖋️</span> Ingreso Manual</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-500 rounded-[30px] font-black text-4xl shadow-xl hover:scale-[1.02] transition-transform">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-500 rounded-[30px] font-black text-4xl shadow-xl hover:scale-[1.02] transition-transform">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div id="reader" className={`w-full rounded-3xl overflow-hidden bg-black mb-4 ${modo !== 'camara' ? 'hidden' : 'block'}`} style={{ minHeight: '300px' }}></div>
            
            <div className="bg-[#050a14] p-6 rounded-[30px] border border-white/5">
              {modo === 'manual' ? (
                <div className="text-left space-y-1">
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest ml-2">ID Documento Empleado</p>
                  <input type="text" className="w-full p-4 bg-transparent text-white font-bold text-2xl outline-none text-center border-b border-white/10" value={qrData} onChange={(e)=>setQrData(e.target.value)} placeholder="000000000000" autoFocus />
                </div>
              ) : (
                <p className={`text-blue-400 font-mono font-bold text-2xl uppercase ${!qrData ? 'animate-glow' : ''}`}>{qrData.split('|')[0] || "Esperando Lectura"}</p>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="text-left space-y-1">
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest ml-2 text-center">PIN Empleado</p>
                <input ref={pinRef} type="password" placeholder="****" className="w-full py-6 bg-[#050a14] rounded-[30px] text-white text-center text-4xl font-black outline-none border-2 border-transparent focus:border-blue-500 transition-all" value={pin} onChange={(e) => setPin(e.target.value)} />
              </div>

              {modo === 'manual' && (
                <div className="text-left space-y-1">
                  <p className="text-[9px] text-amber-500 font-black uppercase tracking-widest ml-2 text-center">Autorización Supervisor (PIN)</p>
                  <input type="password" placeholder="****" className="w-full py-6 bg-[#050a14] rounded-[30px] text-white text-center text-4xl font-black outline-none border-2 border-amber-500/30 focus:border-amber-500 transition-all" value={pinSupervisor} onChange={(e) => setPinSupervisor(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && registrar()} />
                  {intentosFallidos > 0 && <p className="text-red-500 text-[10px] text-center font-bold">Intentos: {intentosFallidos} de 3</p>}
                </div>
              )}
            </div>
            
            <button onClick={registrar} className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl hover:bg-blue-500 transition-all uppercase italic shadow-lg">Confirmar Registro</button>
          </div>
        )}
      </div>
    </main>
  );
}