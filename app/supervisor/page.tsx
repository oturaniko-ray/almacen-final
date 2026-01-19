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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const router = useRouter();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (user.rol === 'supervisor' || user.rol === 'admin') setAuthorized(true);
    else router.push('/');
  }, [router]);

  // --- ESCÁNER USB (CORREGIDO) ---
  useEffect(() => {
    if (modo !== 'usb') return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (buffer.length > 2) {
          // Limpieza de palabras de control pero sin romper el string
          const clean = buffer.replace(/Shift|Dead|Control|Alt|CapsLock|NumLock/gi, "");
          setQrData(clean);
        }
        buffer = "";
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo]);

  // --- CÁMARA (CORREGIDO) ---
  useEffect(() => {
    if (modo !== 'camara') return;
    const scanner = new Html5Qrcode("reader");
    scannerRef.current = scanner;
    scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => {
      setQrData(text); // Esto ahora activará el formulario de PIN
      scanner.stop();
    }, () => {});
    return () => { if (scannerRef.current?.isScanning) scannerRef.current.stop(); };
  }, [modo]);

  const registrar = async (id: string, p: string, tipo: string) => {
    const { data: emp, error } = await supabase.from('empleados').select('*').eq('cedula_id', id).eq('pin_seguridad', p).eq('activo', true).single();
    if (error || !emp) return alert("Datos incorrectos");

    await supabase.from('registros_acceso').insert([{
      empleado_id: emp.id, nombre_empleado: emp.nombre, tipo_movimiento: 'entrada',
      fecha_hora: new Date().toISOString(), detalles: `Modo: ${tipo}`
    }]);
    alert("✅ Registrado");
    resetear();
  };

  const handleValidar = () => {
    // Detectamos el formato y extraemos la cédula
    let idFinal = "";
    if (qrData.includes('|')) idFinal = qrData.split('|')[0];
    else if (qrData.includes('{')) {
      try { idFinal = JSON.parse(qrData).id; } catch { idFinal = ""; }
    } else idFinal = qrData; // Caso directo

    if (idFinal) registrar(idFinal, pin, modo.toUpperCase());
    else alert("Lectura fallida");
  };

  const resetear = () => { setQrData(''); setPin(''); setCedulaManual(''); setModo('menu'); };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 w-full max-w-sm shadow-2xl">
        <h1 className="text-center font-bold mb-6 text-blue-500">Panel Supervisor</h1>
        
        {modo === 'menu' ? (
          <div className="grid gap-3">
            <button onClick={() => setModo('usb')} className="p-4 bg-slate-800 rounded-xl hover:bg-blue-600 transition-all text-left">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="p-4 bg-slate-800 rounded-xl hover:bg-emerald-600 transition-all text-left">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="p-4 bg-slate-800 rounded-xl hover:bg-amber-600 transition-all text-left">✏️ Ingreso Manual</button>
          </div>
        ) : (
          <div className="space-y-4">
            <button onClick={resetear} className="text-xs text-slate-500 underline">← Volver</button>
            
            {modo === 'usb' && !qrData && <div className="py-10 text-center animate-pulse">Esperando lectura USB...</div>}
            {modo === 'camara' && !qrData && <div id="reader" className="rounded-xl overflow-hidden bg-black border-2 border-emerald-500"></div>}
            
            {qrData && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-500/10 border border-blue-500 rounded-xl text-[10px] truncate text-center font-mono">{qrData}</div>
                <input type="password" placeholder="PIN" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-700 text-center text-3xl outline-none focus:border-blue-500" value={pin} onChange={e => setPin(e.target.value)} autoFocus />
                <button onClick={handleValidar} className="w-full bg-blue-600 py-4 rounded-xl font-bold">REGISTRAR</button>
              </div>
            )}

            {modo === 'manual' && (
              <div className="space-y-3">
                <input type="text" placeholder="Cédula" className="w-full p-3 bg-slate-950 rounded-lg border border-slate-700" value={cedulaManual} onChange={e => setCedulaManual(e.target.value)} />
                <input type="password" placeholder="PIN" className="w-full p-3 bg-slate-950 rounded-lg border border-slate-700 text-center" value={pin} onChange={e => setPin(e.target.value)} />
                <button onClick={() => registrar(cedulaManual, pin, "MANUAL")} className="w-full bg-amber-600 py-3 rounded-lg font-bold">REGISTRAR</button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}