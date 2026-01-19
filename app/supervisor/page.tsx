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

  // EFECTOS DE SONIDO
  const playSound = (type: 'success' | 'error') => {
    const audio = new Audio(type === 'success' 
      ? 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' 
      : 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
    audio.play().catch(() => {}); // Evitar error si el navegador bloquea audio sin interacción
  };

  // VALIDACIÓN DE SESIÓN ÚNICA
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
    const user = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (user.rol === 'supervisor' || user.rol === 'admin') {
      setAuthorized(true);
      verificarSesion();
    } else router.push('/');
  }, [router, verificarSesion]);

  // --- LÓGICA DE LA CÁMARA (CORREGIDA PARA REINICIO) ---
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
        async (decodedText) => {
          setQrData(decodedText);
          await stopScanner(); // Detener inmediatamente al leer
        },
        () => {} // Silenciar errores de lectura vacía
      ).catch(err => console.error("Error al iniciar cámara:", err));
    }
    
    return () => { 
      // Limpieza al desmontar o cambiar modo
      if (scannerRef.current) stopScanner();
    };
  }, [modo, direccion, qrData]);

  // --- ESCÁNER USB ---
  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const clean = buffer.replace(/Shift|Dead|Control|Alt|CapsLock/gi, "");
        if (clean.length > 2) setQrData(clean);
        buffer = "";
      } else if (e.key.length === 1) buffer += e.key;
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  const registrar = async () => {
    const id = modo === 'manual' ? cedulaManual : qrData.split('|')[0];
    const session = JSON.parse(localStorage.getItem('user_session') || '{}');
    
    const { data: emp, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('cedula_id', id)
      .eq('pin_seguridad', pin)
      .eq('activo', true)
      .single();
    
    if (error || !emp) {
      playSound('error');
      alert("❌ Datos incorrectos o usuario inactivo");
      setPin(''); // Limpiar PIN para obligar reintento
      return;
    }

    await supabase.from('registros_acceso').insert([{
      empleado_id: emp.id,
      nombre_empleado: emp.nombre,
      tipo_movimiento: direccion,
      fecha_hora: new Date().toISOString(),
      detalles: `Modo: ${modo.toUpperCase()} - Por: ${session.nombre}`
    }]);

    playSound('success');
    alert(`✅ ${direccion?.toUpperCase()} exitosa`);
    resetear();
  };

  const resetear = async () => {
    await stopScanner();
    setQrData('');
    setPin('');
    setCedulaManual('');
    setModo('menu');
    setDireccion(null);
  };

  const volverAtras = async () => {
    if (qrData) {
      setQrData('');
      setPin('');
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
          <button onClick={volverAtras} className="absolute top-4 left-4 text-slate-500 hover:text-white text-xs">
            ← Volver
          </button>
        )}

        <h1 className="text-center font-bold mb-6 text-blue-500 uppercase tracking-widest">Supervisor</h1>

        {modo === 'menu' ? (
          <div className="grid gap-3">
            <button onClick={() => setModo('usb')} className="p-4 bg-slate-800 rounded-xl hover:bg-blue-600 transition-all text-left flex items-center gap-3">
              <span>🔌</span> Escáner USB
            </button>
            <button onClick={() => setModo('camara')} className="p-4 bg-slate-800 rounded-xl hover:bg-emerald-600 transition-all text-left flex items-center gap-3">
              <span>📱</span> Cámara Móvil
            </button>
            <button onClick={() => setModo('manual')} className="p-4 bg-slate-800 rounded-xl hover:bg-amber-600 transition-all text-left flex items-center gap-3">
              <span>✏️</span> Ingreso Manual
            </button>
          </div>
        ) : !direccion ? (
          <div className="grid grid-cols-2 gap-4 pt-4 animate-in fade-in zoom-in duration-200">
            <button onClick={() => setDireccion('entrada')} className="py-8 bg-emerald-600/20 border border-emerald-500 rounded-2xl text-emerald-500 font-bold hover:bg-emerald-500 hover:text-white transition-all">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="py-8 bg-red-600/20 border border-red-500 rounded-2xl text-red-500 font-bold hover:bg-red-500 hover:text-white transition-all">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`text-center py-1 rounded text-[10px] font-bold ${direccion === 'entrada' ? 'bg-emerald-500' : 'bg-red-500'}`}>
              MODO {direccion.toUpperCase()}
            </div>
            
            {!qrData && modo === 'camara' && (
              <div id="reader" className="rounded-xl overflow-hidden bg-black border-2 border-emerald-500 shadow-xl min-h-[250px]"></div>
            )}

            {!qrData && modo === 'usb' && (
              <div className="py-12 text-center animate-pulse text-blue-400 text-sm">Esperando lectura USB...</div>
            )}

            {(qrData || modo === 'manual') && (
              <div className="space-y-4 animate-in slide-in-from-bottom-2">
                {qrData && <div className="p-2 bg-black/50 rounded border border-slate-800 text-[10px] truncate text-center font-mono text-slate-400">{qrData}</div>}
                
                {modo === 'manual' && (
                  <input 
                    type="text" 
                    placeholder="Cédula" 
                    className="w-full p-4 bg-slate-950 rounded-xl border border-slate-700 text-center" 
                    value={cedulaManual} 
                    onChange={e => setCedulaManual(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && document.getElementById('pinInput')?.focus()}
                  />
                )}

                <input 
                  id="pinInput"
                  type="password" 
                  placeholder="PIN" 
                  className="w-full p-4 bg-slate-950 rounded-xl border border-slate-700 text-center text-3xl outline-none focus:border-blue-500" 
                  value={pin} 
                  onChange={e => setPin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && registrar()}
                  autoFocus 
                />
                
                <button onClick={registrar} className="w-full bg-blue-600 py-4 rounded-xl font-bold shadow-lg uppercase">Confirmar Registro</button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}