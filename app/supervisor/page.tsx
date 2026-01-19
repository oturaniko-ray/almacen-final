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
      alert("Sesión iniciada en otro dispositivo.");
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
        if (clean.length > 0) setQrData(clean);
        buffer = "";
      } else if (e.key.length === 1) buffer += e.key;
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  const registrar = async () => {
    // CORRECCIÓN DE LA CAPTURA DEL ID
    let rawValue = modo === 'manual' ? documentoManual : qrData;
    
    // Si por alguna razón el valor es undefined o nulo, detener
    if (!rawValue) {
        playSound('error');
        alert("No se ha detectado ninguna identificación.");
        return;
    }

    let idLimpio = rawValue.trim();
    if (idLimpio.includes('|')) idLimpio = idLimpio.split('|')[0].trim();
    
    // Limpieza alfanumérica
    idLimpio = idLimpio.replace(/[^a-zA-Z0-9-]/g, "");

    const pinLimpio = pin.trim();

    if (!idLimpio || !pinLimpio) {
      playSound('error');
      alert("Complete Documento y PIN");
      return;
    }

    const { data: emp, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('documento_id', idLimpio) // NOMBRE DE COLUMNA CORRECTO
      .eq('pin_seguridad', pinLimpio)
      .eq('activo', true)
      .single();

    if (error || !emp) {
      playSound('error');
      alert(`❌ Datos incorrectos. Buscando ID: ${idLimpio}`);
      setPin('');
      return;
    }

    const sessionData = localStorage.getItem('user_session');
    const supervisorNombre = sessionData ? JSON.parse(sessionData).nombre : 'SISTEMA';

    const { error: insError } = await supabase.from('registros_acceso').insert([{
      empleado_id: emp.id,
      nombre_empleado: emp.nombre,
      tipo_movimiento: direccion,
      fecha_hora: new Date().toISOString(),
      detalles: `Hardware: ${modo.toUpperCase()} - Supervisor: ${supervisorNombre}`
    }]);

    if (insError) {
      alert("Error al guardar el acceso");
      return;
    }

    playSound('success');
    alert(`✅ ${direccion?.toUpperCase()} Exitosa: ${emp.nombre}`);
    resetear();
  };

  const resetear = async () => {
    await stopScanner();
    setQrData(''); setPin(''); setDocumentoManual(''); setModo('menu'); setDireccion(null);
  };

  const volverAtras = async () => {
    if (qrData || documentoManual) { setQrData(''); setDocumentoManual(''); setPin(''); }
    else if (direccion) { await stopScanner(); setDireccion(null); }
    else setModo('menu');
  };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 w-full max-w-sm shadow-2xl relative">
        {modo !== 'menu' && (
          <button onClick={volverAtras} className="absolute top-4 left-4 bg-slate-800 text-slate-400 px-3 py-1 rounded-lg text-[10px] font-bold z-50 border border-slate-700">← VOLVER</button>
        )}
        <h1 className="text-center font-bold mb-6 mt-4 text-blue-500 uppercase tracking-widest text-[10px]">Security Panel</h1>

        {modo === 'menu' ? (
          <div className="grid gap-3">
            <button onClick={() => setModo('usb')} className="p-4 bg-slate-800 rounded-2xl hover:bg-blue-600 text-left font-bold transition-all border border-slate-700/50">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="p-4 bg-slate-800 rounded-2xl hover:bg-emerald-600 text-left font-bold transition-all border border-slate-700/50">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="p-4 bg-slate-800 rounded-2xl hover:bg-amber-600 text-left font-bold transition-all border border-slate-700/50">✏️ Ingreso Manual</button>
          </div>
        ) : !direccion ? (
          <div className="grid grid-cols-2 gap-4 pt-4">
            <button onClick={() => setDireccion('entrada')} className="py-12 bg-emerald-600/10 border-2 border-emerald-500/30 rounded-3xl text-emerald-500 font-black hover:bg-emerald-500 hover:text-white transition-all">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="py-12 bg-red-600/10 border-2 border-red-500/30 rounded-3xl text-red-500 font-black hover:bg-red-500 hover:text-white transition-all">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`text-center py-1 rounded-full text-[9px] font-black tracking-widest ${direccion === 'entrada' ? 'bg-emerald-500' : 'bg-red-500'}`}>
              REGISTRANDO {direccion.toUpperCase()}
            </div>
            
            {!qrData && modo === 'camara' && <div id="reader" className="rounded-2xl overflow-hidden bg-black border-2 border-emerald-500/50 min-h-[250px]"></div>}
            {!qrData && modo === 'usb' && (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-blue-400 text-[10px] font-black animate-pulse uppercase">Listo para Escaneo</p>
              </div>
            )}

            {(qrData || modo === 'manual') && (
              <div className="space-y-4 pt-2">
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <p className="text-[9px] text-slate-600 font-bold uppercase mb-1">Identificación:</p>
                  <p className="font-mono text-xs text-blue-400 truncate font-bold">
                    {modo === 'manual' ? 'ENTRADA POR TECLADO' : qrData}
                  </p>
                </div>
                
                {modo === 'manual' && (
                  <input type="text" placeholder="Documento ID" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-700 text-center font-bold focus:border-blue-500 outline-none" 
                    value={documentoManual} onChange={e => setDocumentoManual(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && document.getElementById('pinInput')?.focus()} />
                )}

                <input id="pinInput" type="text" placeholder="PIN DE SEGURIDAD" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-700 text-center text-2xl font-black focus:border-blue-500 outline-none" 
                  value={pin} onChange={e => setPin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && registrar()} autoFocus />
                
                <button onClick={registrar} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-black uppercase shadow-lg transition-all active:scale-95">Validar y Registrar</button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}