'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5QrcodeScanner } from 'html5-qrcode';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SupervisorPage() {
  const [authorized, setAuthorized] = useState(false);
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [qrData, setQrData] = useState('');
  const [pin, setPin] = useState('');
  const [cedulaManual, setCedulaManual] = useState('');
  const [msg, setMsg] = useState({ texto: '', color: '' });
  const router = useRouter();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (user.rol === 'supervisor' || user.rol === 'admin') {
      setAuthorized(true);
    } else {
      router.push('/');
    }
  }, [router]);

  // EFECTO PARA ESCÁNER USB (LECTURA DE TECLADO)
  useEffect(() => {
    if (modo !== 'usb') return;

    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (buffer.length > 5) {
          setQrData(buffer);
          setMsg({ texto: "Lectura USB Exitosa. Ingrese PIN.", color: "text-blue-400" });
        }
        buffer = "";
      } else {
        buffer += e.key;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo]);

  // EFECTO PARA CÁMARA
  useEffect(() => {
    if (modo !== 'camara') return;

    const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
    scanner.render((decodedText) => {
      setQrData(decodedText);
      setMsg({ texto: "QR Capturado. Ingrese PIN.", color: "text-blue-400" });
      scanner.clear();
    }, () => {});

    return () => { scanner.clear(); };
  }, [modo]);

  const registrarAcceso = async (idEmpleado: string, pinEmpleado: string, tipo: string) => {
    const userSession = JSON.parse(localStorage.getItem('user_session') || '{}');
    
    try {
      const { data: emp, error } = await supabase
        .from('empleados')
        .select('*')
        .eq('cedula_id', idEmpleado)
        .eq('pin_seguridad', pinEmpleado)
        .eq('activo', true)
        .single();

      if (error || !emp) {
        alert("❌ Cédula o PIN incorrectos");
        return;
      }

      await supabase.from('registros_acceso').insert([{
        empleado_id: emp.id,
        nombre_empleado: emp.nombre,
        tipo_movimiento: 'entrada',
        fecha_hora: new Date().toISOString(),
        detalles: `MODO: ${tipo} - Por: ${userSession.nombre}`
      }]);

      alert(`✅ Acceso registrado: ${emp.nombre}`);
      resetearTodo();
    } catch (err) {
      alert("Error de conexión");
    }
  };

  const resetearTodo = () => {
    setQrData('');
    setPin('');
    setCedulaManual('');
    setModo('menu');
    setMsg({ texto: '', color: '' });
  };

  const procesarQR = () => {
    try {
      const data = JSON.parse(qrData);
      registrarAcceso(data.id, pin, "QR/DISPOSITIVO");
    } catch {
      alert("QR no válido");
    }
  };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
      <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 w-full max-w-md shadow-2xl">
        <h1 className="text-xl font-bold mb-8 text-center text-blue-500">Panel de Acceso</h1>

        {/* --- MENÚ DE OPCIONES --- */}
        {modo === 'menu' && (
          <div className="grid grid-cols-1 gap-4 animate-in fade-in duration-500">
            <button onClick={() => setModo('usb')} className="p-6 bg-slate-800 hover:bg-blue-600 rounded-2xl flex items-center gap-4 transition-all">
              <span className="text-2xl">⌨️</span>
              <div className="text-left"><p className="font-bold">Puerto USB</p><p className="text-xs text-slate-400">Escáner de mano</p></div>
            </button>
            <button onClick={() => setModo('camara')} className="p-6 bg-slate-800 hover:bg-emerald-600 rounded-2xl flex items-center gap-4 transition-all">
              <span className="text-2xl">📷</span>
              <div className="text-left"><p className="font-bold">Cámara Móvil</p><p className="text-xs text-slate-400">Escaneo visual</p></div>
            </button>
            <button onClick={() => setModo('manual')} className="p-6 bg-slate-800 hover:bg-amber-600 rounded-2xl flex items-center gap-4 transition-all">
              <span className="text-2xl">✏️</span>
              <div className="text-left"><p className="font-bold">Ingreso Manual</p><p className="text-xs text-slate-400">Fallo de hardware</p></div>
            </button>
          </div>
        )}

        {/* --- INTERFAZ USB --- */}
        {modo === 'usb' && (
          <div className="text-center space-y-6">
            <div className="animate-pulse py-10">🔌 Conecte el escáner y dispare al código...</div>
            {qrData && (
              <div className="space-y-4">
                <input type="password" placeholder="PIN" className="w-full p-4 bg-slate-950 rounded-xl border border-blue-500 text-center text-3xl" value={pin} onChange={e => setPin(e.target.value)} autoFocus />
                <button onClick={procesarQR} className="w-full bg-blue-600 py-4 rounded-xl font-bold">Validar</button>
              </div>
            )}
            <button onClick={resetearTodo} className="text-slate-500 underline text-sm">Volver al Menú</button>
          </div>
        )}

        {/* --- INTERFAZ CÁMARA --- */}
        {modo === 'camara' && (
          <div className="text-center space-y-4">
            <div id="reader" className="overflow-hidden rounded-xl border-2 border-emerald-500"></div>
            {qrData && (
              <div className="space-y-4">
                <input type="password" placeholder="PIN" className="w-full p-4 bg-slate-950 rounded-xl border border-emerald-500 text-center text-3xl" value={pin} onChange={e => setPin(e.target.value)} autoFocus />
                <button onClick={procesarQR} className="w-full bg-emerald-600 py-4 rounded-xl font-bold">Validar</button>
              </div>
            )}
            <button onClick={resetearTodo} className="text-slate-500 underline text-sm">Volver al Menú</button>
          </div>
        )}

        {/* --- INTERFAZ MANUAL --- */}
        {modo === 'manual' && (
          <div className="space-y-4">
            <h2 className="text-amber-500 font-bold text-center">Registro de Emergencia</h2>
            <input type="text" placeholder="Cédula" className="w-full p-4 bg-slate-950 rounded-xl border border-amber-500" value={cedulaManual} onChange={e => setCedulaManual(e.target.value)} />
            <input type="password" placeholder="PIN" className="w-full p-4 bg-slate-950 rounded-xl border border-amber-500 text-center" value={pin} onChange={e => setPin(e.target.value)} />
            <button onClick={() => registrarAcceso(cedulaManual, pin, "MANUAL")} className="w-full bg-amber-600 py-4 rounded-xl font-bold">Forzar Registro</button>
            <button onClick={resetearTodo} className="w-full text-slate-500 text-sm">Volver al Menú</button>
          </div>
        )}
      </div>

      <button onClick={() => { localStorage.clear(); router.push('/'); }} className="mt-8 text-slate-600 text-xs">Cerrar Sesión</button>
    </main>
  );
}