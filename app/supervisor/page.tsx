'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function SupervisorPage() {
  const [authorized, setAuthorized] = useState(false);
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [qrData, setQrData] = useState('');
  const [pin, setPin] = useState('');
  const [cedulaManual, setCedulaManual] = useState('');
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const router = useRouter();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (user.rol === 'supervisor' || user.rol === 'admin') setAuthorized(true);
    else router.push('/');
  }, [router]);

  // --- ESCÁNER USB ---
  useEffect(() => {
    if (modo !== 'usb') return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        // Limpieza de caracteres de control y basura como "Shift" o "Dead"
        const clean = buffer.replace(/Shift|Dead|Control|Alt|CapsLock|NumLock|Enter/gi, "").trim();
        if (clean.length > 3) setQrData(clean);
        buffer = "";
      } else if (e.key.length === 1) buffer += e.key;
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo]);

  // --- CÁMARA ---
  useEffect(() => {
    if (modo !== 'camara') return;
    const startCam = async () => {
      const scanner = new Html5Qrcode("reader");
      scannerRef.current = scanner;
      try {
        await scanner.start({ facingMode: cameraFacing }, { fps: 10, qrbox: 250 }, (text) => {
          setQrData(text);
          scanner.stop();
        }, () => {});
      } catch (e) { console.error(e); }
    };
    startCam();
    return () => { if (scannerRef.current?.isScanning) scannerRef.current.stop(); };
  }, [modo, cameraFacing]);

  const procesarRegistro = async (id: string, p: string, tipo: string) => {
    const session = JSON.parse(localStorage.getItem('user_session') || '{}');
    const { data: emp, error } = await supabase.from('empleados')
      .select('*').eq('cedula_id', id).eq('pin_seguridad', p).eq('activo', true).single();

    if (error || !emp) {
      alert("❌ Cédula o PIN incorrectos");
      return;
    }

    await supabase.from('registros_acceso').insert([{
      empleado_id: emp.id,
      nombre_empleado: emp.nombre,
      tipo_movimiento: 'entrada',
      fecha_hora: new Date().toISOString(),
      detalles: `Modo: ${tipo} - Por: ${session.nombre}`
    }]);

    alert(`✅ Bienvenido: ${emp.nombre}`);
    resetear();
  };

  const handleValidarLectura = () => {
    // 1. Limpieza final de seguridad
    const dataLimpia = qrData.replace(/Shift|Dead|Control|Alt/gi, "").trim();

    // 2. Intentar formato Estándar (ID|TS)
    if (dataLimpia.includes('|')) {
      const [id, ts] = dataLimpia.split('|');
      procesarRegistro(id, pin, "USB_ESTANDAR");
    } 
    // 3. Intentar formato JSON (Compatibilidad)
    else if (dataLimpia.includes('{')) {
      try {
        const inicio = dataLimpia.indexOf('{');
        const fin = dataLimpia.lastIndexOf('}');
        const obj = JSON.parse(dataLimpia.substring(inicio, fin + 1));
        procesarRegistro(obj.id, pin, "USB_JSON");
      } catch { alert("Error de formato en QR"); }
    } else {
      alert("Lectura no reconocida. Verifique su escáner.");
    }
  };

  const resetear = () => { setQrData(''); setPin(''); setCedulaManual(''); setModo('menu'); };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 w-full max-w-sm shadow-2xl">
        <h1 className="text-xl font-bold mb-6 text-center text-blue-500">Panel Supervisor</h1>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-5 bg-slate-800 rounded-2xl flex items-center gap-4 hover:bg-blue-600 transition-all">
              <span className="text-2xl">🔌</span> <div className="text-left"><p className="font-bold">Escáner USB</p></div>
            </button>
            <button onClick={() => setModo('camara')} className="p-5 bg-slate-800 rounded-2xl flex items-center gap-4 hover:bg-emerald-600 transition-all">
              <span className="text-2xl">📱</span> <div className="text-left"><p className="font-bold">Cámara Móvil</p></div>
            </button>
            <button onClick={() => setModo('manual')} className="p-5 bg-slate-800 rounded-2xl flex items-center gap-4 hover:bg-amber-600 transition-all">
              <span className="text-2xl">✏️</span> <div className="text-left"><p className="font-bold">Manual</p></div>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button onClick={resetear} className="text-xs text-slate-500 underline mb-2">← Volver al Menú</button>
            
            {modo === 'camara' && !qrData && <div id="reader" className="rounded-xl overflow-hidden bg-black border-2 border-emerald-500"></div>}
            
            {qrData && (
              <div className="animate-in zoom-in duration-300 space-y-4">
                <div className="p-3 bg-blue-500/10 border border-blue-500 rounded-xl text-[10px] truncate text-center">{qrData}</div>
                <input type="password" placeholder="INGRESE PIN" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-700 text-center text-3xl outline-none focus:border-blue-500" value={pin} onChange={e => setPin(e.target.value)} autoFocus />
                <button onClick={handleValidarLectura} className="w-full bg-blue-600 py-4 rounded-xl font-bold">REGISTRAR ENTRADA</button>
              </div>
            )}

            {modo === 'manual' && (
              <div className="space-y-3">
                <input type="text" placeholder="CÉDULA" className="w-full p-3 bg-slate-950 rounded-lg border border-slate-700" value={cedulaManual} onChange={e => setCedulaManual(e.target.value)} />
                <input type="password" placeholder="PIN" className="w-full p-3 bg-slate-950 rounded-lg border border-slate-700 text-center" value={pin} onChange={e => setPin(e.target.value)} />
                <button onClick={() => procesarRegistro(cedulaManual, pin, "MANUAL")} className="w-full bg-amber-600 py-3 rounded-lg font-bold">REGISTRAR</button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}