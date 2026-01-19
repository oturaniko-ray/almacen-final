'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function SupervisorPage() {
  const [authorized, setAuthorized] = useState(false);
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pin, setPin] = useState('');
  const [cedulaManual, setCedulaManual] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const router = useRouter();

  // --- SONIDOS ---
  const playSound = (type: 'success' | 'error') => {
    const audio = new Audio(type === 'success' 
      ? 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' 
      : 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
    audio.play().catch(() => {});
  };

  // --- SEGURIDAD SESIÓN ---
  const verificarSesion = useCallback(async () => {
    const sessionStr = localStorage.getItem('user_session');
    if (!sessionStr) return;
    const localUser = JSON.parse(sessionStr);
    const { data } = await supabase.from('empleados').select('session_id').eq('id', localUser.id).single();
    if (data?.session_id !== localUser.session_id) {
      alert("⚠️ Sesión abierta en otro dispositivo.");
      localStorage.clear();
      router.push('/');
    }
  }, [router]);

  useEffect(() => {
    const userStr = localStorage.getItem('user_session');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.rol === 'supervisor' || user.rol === 'admin') {
        setAuthorized(true);
        verificarSesion();
      } else router.push('/');
    } else router.push('/');
  }, [router, verificarSesion]);

  // --- LÓGICA CÁMARA ---
  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current.stop();
      scannerRef.current = null;
    }
  };

  useEffect(() => {
    if (modo === 'camara' && direccion && !qrData) {
      const scanner = new Html5Qrcode("reader");
      scannerRef.current = scanner;
      scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async (text) => {
          setQrData(text);
          await stopScanner();
        },
        () => {}
      ).catch(e => console.error(e));
    }
    return () => { if (scannerRef.current) stopScanner(); };
  }, [modo, direccion, qrData]);

  // --- LÓGICA USB (ALFANUMÉRICA) ---
  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        // Eliminar Shift y otros modificadores, mantener letras y números
        const clean = buffer.replace(/[^a-zA-Z0-9|{}:,"-]/g, "").trim();
        if (clean.length > 1) setQrData(clean);
        buffer = "";
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  // --- REGISTRO FINAL ---
  const registrar = async () => {
    // 1. Obtener ID Bruto
    const inputBruto = modo === 'manual' ? cedulaManual : qrData;
    
    // 2. Limpieza Alfanumérica Extrema
    let idFinal = inputBruto.trim();
    if (idFinal.includes('|')) idFinal = idFinal.split('|')[0].trim();
    if (idFinal.startsWith('{')) {
        try { idFinal = JSON.parse(idFinal).id.toString(); } catch (e) {}
    }
    
    // Limpieza de caracteres no deseados que envían los lectores
    idFinal = idFinal.replace(/[^a-zA-Z0-9-]/g, "");
    const pinLimpio = pin.trim();

    if (!idFinal || !pinLimpio) {
      playSound('error');
      alert("Faltan datos (ID o PIN)");
      return;
    }

    // 3. Consulta a DB
    const { data: emp, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('cedula_id', idFinal)
      .eq('pin_seguridad', pinLimpio)
      .eq('activo', true)
      .single();

    if (error || !emp) {
      playSound('error');
      alert(`❌ No encontrado. ID: ${idFinal}`); // Mostramos qué ID se buscó para debug
      setPin('');
      return;
    }

    // 4. Capturar Supervisor de forma segura
    const sessionData = localStorage.getItem('user_session');
    const supervisorNombre = sessionData ? JSON.parse(sessionData).nombre : 'SISTEMA';

    // 5. Insertar
    const { error: insError } = await supabase.from('registros_acceso').insert([{
      empleado_id: emp.id,
      nombre_empleado: emp.nombre,
      tipo_movimiento: direccion,
      fecha_hora: new Date().toISOString(),
      detalles: `Hardware: ${modo.toUpperCase()} - Por: ${supervisorNombre}`
    }]);

    if (insError) {
      alert("Error de conexión al guardar");
      return;
    }

    playSound('success');
    alert(`✅ Registrado: ${emp.nombre}`);
    resetear();
  };

  const resetear = async () => {
    await stopScanner();
    setQrData(''); setPin(''); setCedulaManual(''); setModo('menu'); setDireccion(null);
  };

  const volverAtras = async () => {
    if (qrData || cedulaManual) {
      setQrData(''); setCedulaManual(''); setPin('');
    } else if (direccion) {
      await stopScanner();
      setDireccion(null);
    } else {
      setModo('menu');
    }
  };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white font-sans">
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 w-full max-w-sm shadow-2xl relative">
        
        {modo !== 'menu' && (
          <button onClick={volverAtras} className="absolute top-4 left-4 bg-slate-800 text-slate-400 px-3 py-1 rounded-lg text-[10px] font-bold z-50 border border-slate-700">
            ← VOLVER
          </button>
        )}

        <h1 className="text-center font-bold mb-6 mt-4 text-blue-500 uppercase tracking-widest text-xs">Modo Supervisor</h1>

        {modo === 'menu' ? (
          <div className="grid gap-3 animate-in fade-in duration-300">
            <button onClick={() => setModo('usb')} className="p-4 bg-slate-800 rounded-xl hover:bg-blue-600 text-left font-bold">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="p-4 bg-slate-800 rounded-xl hover:bg-emerald-600 text-left font-bold">📱 Cámara</button>
            <button onClick={() => setModo('manual')} className="p-4 bg-slate-800 rounded-xl hover:bg-amber-600 text-left font-bold">✏️ Manual</button>
          </div>
        ) : !direccion ? (
          <div className="grid grid-cols-2 gap-4 pt-4 animate-in slide-in-from-right-4">
            <button onClick={() => setDireccion('entrada')} className="py-10 bg-emerald-600/10 border-2 border-emerald-500/30 rounded-2xl text-emerald-500 font-black">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="py-10 bg-red-600/10 border-2 border-red-500/30 rounded-2xl text-red-500 font-black">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in">
            <div className={`text-center py-1 rounded-full text-[9px] font-black tracking-widest ${direccion === 'entrada' ? 'bg-emerald-500' : 'bg-red-500'}`}>
              MARCANDO {direccion.toUpperCase()}
            </div>
            
            {!qrData && modo === 'camara' && <div id="reader" className="rounded-2xl overflow-hidden bg-black border-2 border-emerald-500/50 min-h-[250px]"></div>}
            {!qrData && modo === 'usb' && <div className="py-16 text-center text-blue-400 text-xs font-bold animate-pulse">LECTOR USB ACTIVO...</div>}

            {(qrData || modo === 'manual') && (
              <div className="space-y-4 pt-2">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <p className="text-[9px] text-slate-500 uppercase font-bold">ID Detectado:</p>
                  <p className="font-mono text-sm text-blue-400 truncate">
                    {modo === 'manual' ? 'ENTRADA MANUAL' : qrData.replace(/[^a-zA-Z0-9-|]/g, "")}
                  </p>
                </div>
                
                {modo === 'manual' && (
                  <input type="text" placeholder="ID Alfanumérico" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-700 text-center font-bold outline-none" 
                    value={cedulaManual} onChange={e => setCedulaManual(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && document.getElementById('pinInput')?.focus()} />
                )}

                <input id="pinInput" type="text" placeholder="PIN ALFANUMÉRICO" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-700 text-center text-2xl focus:border-blue-500 outline-none font-black" 
                  value={pin} onChange={e => setPin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && registrar()} autoFocus />
                
                <button onClick={registrar} className="w-full bg-blue-600 py-4 rounded-xl font-black uppercase">Confirmar Registro</button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}