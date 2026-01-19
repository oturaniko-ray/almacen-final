'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

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
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const router = useRouter();
  
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (user.rol === 'supervisor' || user.rol === 'admin') {
      setAuthorized(true);
    } else {
      router.push('/');
    }
  }, [router]);

  // --- LÓGICA ESCÁNER USB ---
  useEffect(() => {
    if (modo !== 'usb') return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        // Limpiamos el buffer de posibles caracteres de control del escáner
        const cleanData = buffer.trim().replace(/[\x00-\x1F\x7F-\x9F]/g, "");
        if (cleanData.length > 5) {
          setQrData(cleanData);
        }
        buffer = "";
      } else {
        buffer += e.key;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo]);

  // --- LÓGICA CÁMARA MÓVIL ---
  useEffect(() => {
    if (modo !== 'camara') return;

    const startCamera = async () => {
      try {
        const scanner = new Html5Qrcode("reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: cameraFacing },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            setQrData(decodedText);
            scanner.stop();
          },
          () => {}
        );
      } catch (err) {
        console.error("Error cámara:", err);
      }
    };

    startCamera();
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop();
      }
    };
  }, [modo, cameraFacing]);

  const toggleCamera = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
    }
    setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment');
  };

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
        alert("❌ Error: Datos incorrectos o empleado inactivo.");
        return;
      }

      await supabase.from('registros_acceso').insert([{
        empleado_id: emp.id,
        nombre_empleado: emp.nombre,
        tipo_movimiento: 'entrada',
        fecha_hora: new Date().toISOString(),
        detalles: `MODO: ${tipo} - Por: ${userSession.nombre}`
      }]);

      alert(`✅ Registrado: ${emp.nombre}`);
      resetearTodo();
    } catch (err) {
      alert("Error de conexión");
    }
  };

 const procesarQR = () => {
  try {
    console.log("Datos recibidos del escáner:", qrData);

    // 1. LIMPIEZA AGRESIVA
    // Filtramos palabras de control que el driver del teclado inyecta por error de idioma
    let rawData = qrData
      .replace(/Shift|Dead|Control|Alt|CapsLock|NumLock|Enter/gi, "") 
      .replace(/\s/g, ""); // Eliminamos espacios en blanco accidentales

    // 2. EXTRACCIÓN DEL JSON
    // Buscamos la primera '{' y la última '}' por si hay basura alrededor
    const inicio = rawData.indexOf('{');
    const fin = rawData.lastIndexOf('}');
    
    if (inicio === -1 || fin === -1) {
      throw new Error("No se encontró un formato de código válido.");
    }
    
    const jsonLimpio = rawData.substring(inicio, fin + 1);
    
    // 3. VALIDACIÓN Y PARSEO
    const data = JSON.parse(jsonLimpio);
    
    // Verificamos que tenga los campos necesarios
    if (!data.id || !data.t) {
      throw new Error("El código no contiene la información requerida.");
    }

    // Validación de tiempo (5 minutos de margen)
    const diferencia = (new Date().getTime() - new Date(data.t).getTime()) / 1000;
    if (diferencia > 300) { 
      alert("❌ El código QR ha expirado. Por favor, genere uno nuevo.");
      setQrData('');
      return;
    }

    registrarAcceso(data.id, pin, "QR_USB_FIXED");

  } catch (e: any) {
    alert(`❌ Error de Lectura Física\n\nDetalle: ${e.message}\n\nSugerencia: Cambie el idioma de su teclado a 'Estados Unidos' o use la cámara del móvil.`);
    setQrData('');
  }
};

  const resetearTodo = () => {
    setQrData('');
    setPin('');
    setCedulaManual('');
    setModo('menu');
  };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white font-sans">
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 w-full max-w-md shadow-2xl relative overflow-hidden">
        
        {modo === 'menu' ? (
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-center mb-6 text-blue-500">Seleccione Método</h1>
            <button onClick={() => setModo('usb')} className="w-full p-6 bg-slate-800 rounded-2xl flex items-center gap-4 hover:bg-blue-600 transition-all border border-slate-700">
              <span className="text-3xl">🔌</span>
              <div className="text-left"><p className="font-bold">Escáner USB</p><p className="text-xs text-slate-400">Windows / Laptop</p></div>
            </button>
            <button onClick={() => setModo('camara')} className="w-full p-6 bg-slate-800 rounded-2xl flex items-center gap-4 hover:bg-emerald-600 transition-all border border-slate-700">
              <span className="text-3xl">📱</span>
              <div className="text-left"><p className="font-bold">Cámara Móvil</p><p className="text-xs text-slate-400">Android / iOS</p></div>
            </button>
            <button onClick={() => setModo('manual')} className="w-full p-6 bg-slate-800 rounded-2xl flex items-center gap-4 hover:bg-amber-600 transition-all border border-slate-700">
              <span className="text-3xl">✏️</span>
              <div className="text-left"><p className="font-bold">Manual</p><p className="text-xs text-slate-400">Escritura directa</p></div>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <header className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h2 className="font-bold uppercase text-xs text-slate-400 tracking-widest">{modo} activo</h2>
              <button onClick={resetearTodo} className="text-red-400 text-xs font-bold">CANCELAR</button>
            </header>

            {modo === 'usb' && !qrData && (
              <div className="py-12 text-center animate-pulse text-blue-400">
                <div className="text-5xl mb-4">⌨️</div>
                Esperando disparo del escáner...
              </div>
            )}

            {modo === 'camara' && !qrData && (
              <div className="space-y-4">
                <div id="reader" className="rounded-2xl overflow-hidden border-2 border-emerald-500 bg-black"></div>
                <button onClick={toggleCamera} className="w-full py-2 bg-slate-800 rounded-lg text-xs font-bold">
                  🔄 Cambiar a Cámara {cameraFacing === 'environment' ? 'Frontal' : 'Trasera'}
                </button>
              </div>
            )}

            {qrData && (
              <div className="space-y-4 animate-in zoom-in duration-300">
                <div className="p-4 bg-blue-500/10 border border-blue-500 rounded-xl text-center">
                   <p className="text-[10px] text-blue-400 font-bold uppercase">Código detectado</p>
                   <p className="text-xs truncate">{qrData}</p>
                </div>
                <input 
                  type="password" 
                  placeholder="PIN DE SEGURIDAD" 
                  className="w-full p-4 bg-slate-950 rounded-xl border border-slate-700 text-center text-3xl outline-none focus:border-blue-500"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  autoFocus 
                />
                <button onClick={procesarQR} className="w-full bg-blue-600 py-4 rounded-xl font-bold shadow-lg shadow-blue-900/40">
                  CONFIRMAR ENTRADA
                </button>
              </div>
            )}

            {modo === 'manual' && (
              <div className="space-y-4">
                <input type="text" placeholder="ID / CÉDULA" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-700" value={cedulaManual} onChange={e => setCedulaManual(e.target.value)} />
                <input type="password" placeholder="PIN" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-700 text-center" value={pin} onChange={e => setPin(e.target.value)} />
                <button onClick={() => registrarAcceso(cedulaManual, pin, "MANUAL")} className="w-full bg-amber-600 py-4 rounded-xl font-bold">REGISTRAR</button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}