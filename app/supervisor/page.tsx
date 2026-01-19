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
    if (modo !== 'usb' || !direccion) return; 
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
      tipo_movimiento: direccion, 
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

  const volverAtras = () => {
    if (qrData) {
      setQrData(''); // Si ya leyó un QR, vuelve a esperar lectura
    } else if (direccion) {
      setDireccion(null); // Si eligió entrada/salida, vuelve a elegir método
    } else {
      setModo('menu'); // Vuelve al menú principal
    }
  };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white font-sans">
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 w-full max-w-sm shadow-2xl relative overflow-hidden">
        
        {/* BOTÓN VOLVER (Solo aparece si no estás en el menú principal) */}
        {modo !== 'menu' && (
          <button 
            onClick={volverAtras}
            className="absolute top-4 left-4 text-slate-500 hover:text-white flex items-center gap-1 text-xs transition-colors"
          >
            ← Volver
          </button>
        )}

        <h1 className="text-center font-bold mb-6 mt-2 text-blue-500 uppercase tracking-tighter">Panel Supervisor</h1>
        
        {/* PASO 1: SELECCIONAR MODO */}
        {modo === 'menu' && (
          <div className="grid gap-3 animate-in fade-in zoom-in duration-200">
            <button onClick={() => setModo('usb')} className="p-4 bg-slate-800 rounded-xl hover:bg-blue-600 transition-all text-left flex items-center gap-3">
              <span className="text-xl">🔌</span> Escáner USB
            </button>
            <button onClick={() => setModo('camara')} className="p-4 bg-slate-800 rounded-xl hover:bg-emerald-600 transition-all text-left flex items-center gap-3">
              <span className="text-xl">📱</span> Cámara Móvil
            </button>
            <button onClick={() => setModo('manual')} className="p-4 bg-slate-800 rounded-xl hover:bg-amber-600 transition-all text-left flex items-center gap-3">
              <span className="text-xl">✏️</span> Ingreso Manual
            </button>
            <button onClick={() => router.push('/')} className="mt-4 p-3 text-slate-500 text-xs border border-slate-800 rounded-xl hover:bg-slate-800 transition-all">
              Ir al Menú de Roles
            </button>
          </div>
        )}

        {/* PASO 2: SELECCIONAR ENTRADA O SALIDA */}
        {modo !== 'menu' && !direccion && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-center text-sm font-bold text-slate-400 uppercase mt-4">¿Qué desea registrar?</h2>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setDireccion('entrada')} className="py-8 bg-emerald-600/20 border border-emerald-500 rounded-2xl text-emerald-500 font-bold hover:bg-emerald-500 hover:text-white transition-all">
                ENTRADA
              </button>
              <button onClick={() => setDireccion('salida')} className="py-8 bg-red-600/20 border border-red-500 rounded-2xl text-red-500 font-bold hover:bg-red-500 hover:text-white transition-all">
                SALIDA
              </button>
            </div>
            <p className="text-center text-[10px] text-slate-600 italic">Método seleccionado: {modo.toUpperCase()}</p>
          </div>
        )}

        {/* PASO 3: LECTURA Y PIN */}
        {direccion && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
            <header className="flex justify-center items-center border-b border-slate-800 pb-2">
              <span className={`text-[10px] font-bold px-4 py-1 rounded-full ${direccion === 'entrada' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                REGISTRANDO {direccion.toUpperCase()}
              </span>
            </header>
            
            {!qrData && modo === 'usb' && (
              <div className="py-12 flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-blue-400 font-medium animate-pulse">Esperando lectura del escáner...</p>
              </div>
            )}
            
            {!qrData && modo === 'camara' && (
              <div className="relative">
                <div id="reader" className="rounded-xl overflow-hidden bg-black border-2 border-emerald-500 shadow-lg shadow-emerald-900/20"></div>
                <p className="text-[10px] text-center mt-2 text-slate-500">Apunte al código QR del empleado</p>
              </div>
            )}
            
            {(qrData || modo === 'manual') && (
              <div className="space-y-4">
                {qrData && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[10px] truncate text-center font-mono text-slate-400">
                    Lectura detectada: {qrData}
                  </div>
                )}
                
                {modo === 'manual' && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase font-bold ml-1">Documento de Identidad</label>
                    <input type="text" placeholder="Número de Cédula" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-700 text-center text-lg focus:border-blue-500 outline-none transition-all" value={cedulaManual} onChange={e => setCedulaManual(e.target.value)} />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold ml-1">Pin de Seguridad</label>
                  <input type="password" placeholder="••••" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-700 text-center text-3xl outline-none focus:border-blue-500 transition-all" value={pin} onChange={e => setPin(e.target.value)} autoFocus />
                </div>
                
                <button 
                  onClick={() => modo === 'manual' ? registrar(cedulaManual, pin) : handleValidar()} 
                  className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all active:scale-95 ${direccion === 'entrada' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40' : 'bg-red-600 hover:bg-red-500 shadow-red-900/40'}`}
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