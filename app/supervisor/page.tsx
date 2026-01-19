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
  const [intentosFallidos, setIntentosFallidos] = useState(0); // PUNTO: Bloqueo de intentos
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // VALIDACIÓN DE SESIÓN ÚNICA
  const validarSesion = useCallback(async () => {
    const sessionStr = localStorage.getItem('user_session');
    if (!sessionStr) { router.push('/'); return; }
    
    const session = JSON.parse(sessionStr);
    const { data: dbUser } = await supabase.from('empleados').select('session_token, activo').eq('id', session.id).single();

    // Si el token en BD es diferente al de este PC o el usuario fue desactivado -> Cerrar Sesión
    if (!dbUser || dbUser.session_token !== session.session_token || !dbUser.activo) {
      alert("⚠️ Sesión cerrada: Se inició sesión en otro dispositivo o acceso denegado.");
      localStorage.clear();
      router.push('/');
    }
  }, [router]);

  useEffect(() => {
    validarSesion();
    const interval = setInterval(validarSesion, 10000); // Valida cada 10 seg
    return () => clearInterval(interval);
  }, [validarSesion]);

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

  const registrar = async () => {
    if (intentosFallidos >= 3) {
      alert("❌ ACCESO BLOQUEADO: Demasiados intentos fallidos. Contacte al administrador.");
      return;
    }

    const idCapturado = modo === 'manual' ? qrData : qrData; // Simplificado para el ejemplo
    const [idLimpio] = idCapturado.split('|');
    const supSession = JSON.parse(localStorage.getItem('user_session') || '{}');

    // 1. Validar Empleado
    const { data: emp } = await supabase.from('empleados').select('*').eq('documento_id', idLimpio.trim()).single();

    if (!emp || !emp.activo || emp.pin_seguridad !== pin.trim()) {
      playSound('error');
      alert("❌ DATOS DE EMPLEADO INCORRECTOS");
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
        setPinSupervisor('');
        return;
      }
    }

    // 3. Registro Exitoso
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
      setIntentosFallidos(0); // Resetear fallos al tener éxito
      setQrData(''); setPin(''); setPinSupervisor(''); setModo('menu'); setDireccion(null);
      alert("✅ REGISTRO COMPLETADO");
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

      <button onClick={handleVolver} className="absolute top-8 left-8 bg-[#1e293b] px-6 py-3 rounded-xl font-bold border border-white/10">← VOLVER</button>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 text-center shadow-2xl relative overflow-hidden">
        <div className="mb-12">
          <h1 className="text-2xl md:text-3xl font-black text-white uppercase italic">Entrada / Salida del Almacén</h1>
          <p className="text-blue-500 font-bold text-xs uppercase tracking-[0.3em] animate-blink mt-2">Toma de Datos</p>
        </div>

        {modo === 'menu' ? (
          <div className="space-y-4">
            <button onClick={() => setModo('usb')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl hover:bg-blue-600">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl hover:bg-emerald-600">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl hover:bg-amber-600">🖋️ Ingreso Manual</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-500 rounded-[30px] font-black text-4xl shadow-lg">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-500 rounded-[30px] font-black text-4xl shadow-lg">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6 text-left">
            {/* Si es manual, mostrar campo de ID */}
            {modo === 'manual' && (
              <div className="space-y-1">
                <p className="text-[10px] text-slate-500 font-bold uppercase ml-2">Documento ID</p>
                <input type="text" className="w-full p-6 bg-[#050a14] rounded-2xl text-white font-bold text-2xl outline-none border border-white/10" value={qrData} onChange={(e)=>setQrData(e.target.value)} placeholder="0000000000" />
              </div>
            )}

            <div className="space-y-1">
              <p className="text-[10px] text-slate-500 font-bold uppercase ml-2">PIN Empleado</p>
              <input ref={pinRef} type="password" placeholder="****" className="w-full py-6 bg-[#050a14] rounded-[30px] text-white text-center text-4xl font-black outline-none border-2 border-transparent focus:border-blue-500" value={pin} onChange={(e) => setPin(e.target.value)} />
            </div>

            {modo === 'manual' && (
              <div className="space-y-1">
                <p className="text-[10px] text-amber-500 font-bold uppercase ml-2">PIN Supervisor {intentosFallidos > 0 && `(${3 - intentosFallidos} restantes)`}</p>
                <input type="password" placeholder="****" className="w-full py-6 bg-[#050a14] rounded-[30px] text-white text-center text-4xl font-black outline-none border-2 border-amber-500/30 focus:border-amber-500" value={pinSupervisor} onChange={(e) => setPinSupervisor(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && registrar()} />
              </div>
            )}

            <button onClick={registrar} className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl hover:bg-blue-500 transition-all uppercase italic">Confirmar Registro</button>
          </div>
        )}
      </div>
    </main>
  );
}