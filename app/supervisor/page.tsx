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
    audio.play();
  };

  // VALIDACIÓN DE SESIÓN ÚNICA
  const verificarSesion = useCallback(async () => {
    const localUser = JSON.parse(localStorage.getItem('user_session') || '{}');
    const { data } = await supabase.from('empleados').select('session_id').eq('id', localUser.id).single();
    if (data?.session_id !== localUser.session_id) {
      alert("⚠️ Se ha iniciado sesión en otro dispositivo. Cerrando esta sesión.");
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

  // --- ESCÁNER USB CON LIMPIEZA ---
  useEffect(() => {
    if (modo !== 'usb' || !direccion) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const clean = buffer.replace(/Shift|Dead|Control|Alt|CapsLock/gi, "");
        if (clean.length > 2) setQrData(clean);
        buffer = ""; // LIMPIEZA DE BUFFER TRAS ENTER
      } else if (e.key.length === 1) buffer += e.key;
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion]);

  const registrar = async (id: string, p: string) => {
    const session = JSON.parse(localStorage.getItem('user_session') || '{}');
    const { data: emp, error } = await supabase.from('empleados').select('*').eq('cedula_id', id).eq('pin_seguridad', p).eq('activo', true).single();
    
    if (error || !emp) {
      playSound('error');
      alert("❌ Datos incorrectos. Reintente.");
      setPin(''); setCedulaManual(''); // OBLIGA A REINGRESAR
      return;
    }

    await supabase.from('registros_acceso').insert([{
      empleado_id: emp.id, nombre_empleado: emp.nombre, tipo_movimiento: direccion,
      fecha_hora: new Date().toISOString(), detalles: `Modo: ${modo.toUpperCase()} - Por: ${session.nombre}`
    }]);

    playSound('success');
    alert(`✅ ${direccion?.toUpperCase()} exitosa`);
    resetear();
  };

  const resetear = () => {
    setQrData(''); setPin(''); setCedulaManual(''); setModo('menu'); setDireccion(null);
  };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 w-full max-w-sm relative">
        {modo !== 'menu' && <button onClick={resetear} className="absolute top-4 left-4 text-xs text-slate-500">← Volver</button>}
        <h1 className="text-center font-bold mb-6 text-blue-500 uppercase">Supervisor</h1>

        {modo === 'menu' ? (
          <div className="grid gap-3">
            <button onClick={() => setModo('usb')} className="p-4 bg-slate-800 rounded-xl hover:bg-blue-600 text-left">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="p-4 bg-slate-800 rounded-xl hover:bg-emerald-600 text-left">📱 Cámara</button>
            <button onClick={() => setModo('manual')} className="p-4 bg-slate-800 rounded-xl hover:bg-amber-600 text-left">✏️ Manual</button>
          </div>
        ) : !direccion ? (
          <div className="grid grid-cols-2 gap-4 pt-4">
            <button onClick={() => setDireccion('entrada')} className="py-8 bg-emerald-600/20 border border-emerald-500 rounded-2xl font-bold">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="py-8 bg-red-600/20 border border-red-500 rounded-2xl font-bold">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`text-center py-1 rounded text-[10px] font-bold ${direccion === 'entrada' ? 'bg-emerald-500' : 'bg-red-500'}`}>{direccion.toUpperCase()}</div>
            {qrData && <div className="p-2 bg-black rounded text-[10px] truncate text-center font-mono">{qrData}</div>}
            
            {modo === 'manual' && (
              <input type="text" placeholder="Cédula" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-700 text-center" 
                value={cedulaManual} onChange={e => setCedulaManual(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && document.getElementById('pinInput')?.focus()} />
            )}

            <input id="pinInput" type="password" placeholder="PIN" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-700 text-center text-3xl" 
              value={pin} onChange={e => setPin(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && (modo === 'manual' ? registrar(cedulaManual, pin) : registrar(qrData.split('|')[0], pin))} autoFocus />

            <button onClick={() => registrar(modo === 'manual' ? cedulaManual : qrData.split('|')[0], pin)} className="w-full bg-blue-600 py-4 rounded-xl font-bold">CONFIRMAR (ENTER)</button>
          </div>
        )}
      </div>
    </main>
  );
}