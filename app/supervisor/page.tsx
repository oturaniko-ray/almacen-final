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
  const [documentoManual, setDocumentoManual] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const router = useRouter();

  const playSound = (type: 'success' | 'error') => {
    const audio = new Audio(type === 'success' 
      ? 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' 
      : 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
    audio.play().catch(() => {});
  };

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
      scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (text) => {
        setQrData(text);
        await stopScanner();
      }, () => {}).catch(e => console.error(e));
    }
    return () => { if (scannerRef.current) stopScanner(); };
  }, [modo, direccion, qrData]);

  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const clean = buffer.replace(/[^a-zA-Z0-9|{}:,"-]/g, "").trim();
        if (clean.length > 1) setQrData(clean);
        buffer = "";
      } else if (e.key.length === 1) buffer += e.key;
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  const registrar = async () => {
    // CAPTURA CORRECTA DEL ID SEGÚN EL MODO
    const inputBruto = modo === 'manual' ? documentoManual : qrData;
    let idLimpio = inputBruto.trim();
    if (idLimpio.includes('|')) idLimpio = idLimpio.split('|')[0].trim();
    
    // Filtro para asegurar que sea alfanumérico puro
    idLimpio = idLimpio.replace(/[^a-zA-Z0-9-]/g, "");
    const pinLimpio = pin.trim();

    const { data: emp, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('documento_id', idLimpio)
      .eq('pin_seguridad', pinLimpio)
      .eq('activo', true)
      .single();

    if (error || !emp) {
      playSound('error');
      alert(`❌ Datos incorrectos. Reintente.\nID: ${idLimpio}`);
      setPin(''); // Borrar buffer de PIN
      return;
    }

    const session = JSON.parse(localStorage.getItem('user_session') || '{}');
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
    setQrData(''); setPin(''); setDocumentoManual(''); setModo('menu'); setDireccion(null);
  };

  const volverAtras = async () => {
    if (qrData || documentoManual) {
      setQrData(''); setDocumentoManual(''); setPin('');
    } else if (direccion) {
      await stopScanner();
      setDireccion(null);
    } else {
      setModo('menu');
    }
  };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
      <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 w-full max-w-md relative shadow-2xl">
        
        {/* BOTÓN VOLVER RESTAURADO */}
        {modo !== 'menu' && (
          <button onClick={volverAtras} className="absolute top-6 left-6 text-xs text-slate-500 font-bold uppercase tracking-widest hover:text-white">
            ← Volver
          </button>
        )}

        <h1 className="text-2xl font-bold text-center mb-8 text-blue-500">SUPERVISOR</h1>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-6 bg-slate-800 hover:bg-blue-600 rounded-2xl transition-all font-bold text-left">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="p-6 bg-slate-800 hover:bg-emerald-600 rounded-2xl transition-all font-bold text-left">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="p-6 bg-slate-800 hover:bg-amber-600 rounded-2xl transition-all font-bold text-left">✏️ Ingreso Manual</button>
          </div>
        ) : !direccion ? (
          <div className="grid grid-cols-2 gap-4 pt-4">
            <button onClick={() => setDireccion('entrada')} className="py-12 bg-emerald-600/20 border-2 border-emerald-500 rounded-3xl font-black text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="py-12 bg-red-600/20 border-2 border-red-500 rounded-3xl font-black text-red-500 hover:bg-red-500 hover:text-white transition-all">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`text-center py-2 rounded-xl font-bold uppercase tracking-widest ${direccion === 'entrada' ? 'bg-emerald-500' : 'bg-red-500'}`}>
              {direccion}
            </div>

            {!qrData && modo === 'camara' && <div id="reader" className="rounded-2xl overflow-hidden border-2 border-slate-800"></div>}
            {!qrData && modo === 'usb' && <div className="py-12 text-center text-blue-500 font-bold animate-pulse">ESPERANDO LECTURA USB...</div>}

            {(qrData || modo === 'manual') && (
              <div className="space-y-4">
                {qrData && <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center font-mono text-sm text-blue-400 truncate">{qrData}</div>}
                
                {modo === 'manual' && (
                  <input type="text" placeholder="Documento ID" className="w-full p-5 bg-slate-950 rounded-2xl border border-slate-800 text-center font-bold" 
                    value={documentoManual} onChange={e => setDocumentoManual(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && document.getElementById('pinInput')?.focus()} />
                )}

                <input id="pinInput" type="text" placeholder="PIN" className="w-full p-5 bg-slate-950 rounded-2xl border border-slate-800 text-center text-3xl font-black" 
                  value={pin} onChange={e => setPin(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && registrar()} autoFocus />

                <button onClick={registrar} className="w-full bg-blue-600 py-5 rounded-2xl font-bold uppercase shadow-lg">Confirmar</button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}