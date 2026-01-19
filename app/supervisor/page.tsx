'use client';
import { useState, useEffect, useRef } from 'react';
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

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (user.rol === 'supervisor' || user.rol === 'admin') setAuthorized(true);
    else router.push('/');
  }, [router]);

  // --- LÓGICA ESCÁNER USB ---
  useEffect(() => {
    if (modo !== 'usb' || !direccion) return; // Solo escucha si ya eligió dirección
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (buffer.length > 2) {
          const clean = buffer.replace(/Shift|Dead|Control|Alt|CapsLock|NumLock/gi, "");
          setQrData(clean);
        }
        buffer = "";
      } else if (e.key.length === 1) buffer += e.key;
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion]);

  // --- LÓGICA CÁMARA ---
  useEffect(() => {
    if (modo !== 'camara' || !direccion) return;
    const scanner = new Html5Qrcode("reader");
    scannerRef.current = scanner;
    scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => {
      setQrData(text);
      scanner.stop();
    }, () => {});
    return () => { if (scannerRef.current?.isScanning) scannerRef.current.stop(); };
  }, [modo, direccion]);

  const registrar = async (id: string, p: string) => {
    const session = JSON.parse(localStorage.getItem('user_session') || '{}');
    const { data: emp, error } = await supabase.from('empleados').select('*').eq('cedula_id', id).eq('pin_seguridad', p).eq('activo', true).single();
    
    if (error || !emp) return alert("❌ Datos incorrectos o empleado inactivo");

    await supabase.from('registros_acceso').insert([{
      empleado_id: emp.id,
      nombre_empleado: emp.nombre,
      tipo_movimiento: direccion, // 'entrada' o 'salida'
      fecha_hora: new Date().toISOString(),
      detalles: `Modo: ${modo.toUpperCase()} - Por: ${session.nombre}`
    }]);

    alert(`✅ ${direccion?.toUpperCase()} exitosa: ${emp.nombre}`);
    resetear();
  };

  const handleValidar = () => {
    let idFinal = "";
    if (qrData.includes('|')) idFinal = qrData.split('|')[0];
    else if (qrData.includes('{')) {
      try { idFinal = JSON.parse(qrData).id; } catch { idFinal = ""; }
    } else idFinal = qrData;

    if (idFinal) registrar(idFinal, pin);
    else alert("Lectura fallida");
  };

  const resetear = () => {
    setQrData(''); setPin(''); setCedulaManual(''); setModo('menu'); setDireccion(null);
  };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white font-sans">
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 w-full max-w-sm shadow-2xl">
        <h1 className="text-center font-bold mb-6 text-blue-500 uppercase tracking-tighter">Panel Supervisor</h1>
        
        {/* PASO 1: SELECCIONAR MODO */}
        {modo === 'menu' && (
          <div className="grid gap-3">
            <button onClick={() => setModo('usb')} className="p-4 bg-slate-800 rounded-xl hover:bg-blue-600 transition-all text-left flex items-center gap-3">
              <span className="text-xl">🔌</span> Escáner USB
            </button>
            <button onClick={() => setModo('camara')} className="p-4 bg-slate-800 rounded-xl hover:bg-emerald-600 transition-all text-left flex items-center gap-3">
              <span className="text-xl">📱</span> Cámara Móvil
            </button>
            <button onClick={() => setModo('manual')} className="p-4 bg-slate-800 rounded-xl hover:bg-amber-600 transition-all text-left flex items-center gap-3">
              <span className="text-xl">✏️</span> Ingreso Manual
            </button>
          </div>
        )}

        {/* PASO 2: SELECCIONAR ENTRADA O SALIDA */}
        {modo !== 'menu' && !direccion && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <button onClick={resetear} className="text-xs text-slate-500 underline">← Cambiar método</button>
            <h2 className="text-center text-sm font-bold text-slate-400 uppercase">¿Qué desea registrar?</h2>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setDireccion('entrada')} className="py-8 bg-emerald-600/20 border border-emerald-500 rounded-2xl text-emerald-500 font-bold hover:bg-emerald-500 hover:text-white transition-all">
                ENTRADA
              </button>
              <button onClick={() => setDireccion('salida')} className="py-8 bg-red-600/20 border border-red-500 rounded-2xl text-red-500 font-bold hover:bg-red-500 hover:text-white transition-all">
                SALIDA
              </button>
            </div>
          </div>
        )}

        {/* PASO 3: LECTURA Y PIN */}
        {direccion && (
          <div className="space-y-4 animate-in slide-in-from-bottom-2">
            <header className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className={`text-[10px] font-bold px-2 py-1 rounded ${direccion === 'entrada' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                MODO {direccion.toUpperCase()}
              </span>
              <button onClick={resetear} className="text-xs text-slate-500">Cancelar</button>
            </header>
            
            {!qrData && modo === 'usb' && <div className="py-10 text-center animate-pulse text-blue-400">Acerque el escáner...</div>}
            {!qrData && modo === 'camara' && <div id="reader" className="rounded-xl overflow-hidden bg-black border-2 border-emerald-500"></div>}
            
            {/* Si ya hay lectura o es manual */}
            {(qrData || modo === 'manual') && (
              <div className="space-y-4">
                {qrData && <div className="p-2 bg-slate-950 rounded border border-slate-800 text-[10px] truncate text-center font-mono text-slate-500">{qrData}</div>}
                
                {modo === 'manual' && (
                  <input type="text" placeholder="Cédula Empleado" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-700 text-center" value={cedulaManual} onChange={e => setCedulaManual(e.target.value)} />
                )}

                <input type="password" placeholder="PIN SEGURIDAD" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-700 text-center text-3xl outline-none focus:border-blue-500" value={pin} onChange={e => setPin(e.target.value)} autoFocus />
                
                <button 
                  onClick={() => modo === 'manual' ? registrar(cedulaManual, pin) : handleValidar()} 
                  className={`w-full py-4 rounded-xl font-bold shadow-lg ${direccion === 'entrada' ? 'bg-emerald-600 shadow-emerald-900/40' : 'bg-red-600 shadow-red-900/40'}`}
                >
                  CONFIRMAR {direccion.toUpperCase()}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}