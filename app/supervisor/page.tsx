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
      alert("⚠️ Sesión cerrada por ingreso en otro equipo.");
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
        if (clean.length > 1) setQrData(clean);
        buffer = "";
      } else if (e.key.length === 1) buffer += e.key;
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  const registrar = async () => {
    const inputBruto = modo === 'manual' ? documentoManual : qrData;
    let idLimpio = inputBruto.trim();
    if (idLimpio.includes('|')) idLimpio = idLimpio.split('|')[0].trim();
    idLimpio = idLimpio.replace(/[^a-zA-Z0-9-]/g, ""); // Filtro alfanumérico

    const pinLimpio = pin.trim();
    if (!idLimpio || !pinLimpio) { playSound('error'); return; }

    const { data: emp, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('documento_id', idLimpio) // NOMBRE DE CAMPO ACTUALIZADO
      .eq('pin_seguridad', pinLimpio)
      .eq('activo', true)
      .single();

    if (error || !emp) {
      playSound('error');
      alert(`❌ Error. Buscando ID: ${idLimpio}`);
      setPin('');
      return;
    }

    const sessionData = localStorage.getItem('user_session');
    const supervisorNombre = sessionData ? JSON.parse(sessionData).nombre : 'SISTEMA';

    await supabase.from('registros_acceso').insert([{
      empleado_id: emp.id,
      nombre_empleado: emp.nombre,
      tipo_movimiento: direccion,
      fecha_hora: new Date().toISOString(),
      detalles: `Modo: ${modo.toUpperCase()} - Por: ${supervisorNombre}`
    }]);

    playSound('success');
    alert(`✅ Registro OK: ${emp.nombre}`);
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
          <button onClick={volverAtras} className="absolute top-4 left-4 bg-slate-800 text-slate-400 px-3 py-1 rounded text-[10px] font-bold z-50 border border-slate-700">← VOLVER</button>
        )}
        <h1 className="text-center font-bold mb-6 mt-4 text-blue-500 uppercase tracking-widest text-xs">Supervisor de Acceso</h1>

        {modo === 'menu' ? (
          <div className="grid gap-3">
            <button onClick={() => setModo('usb')} className="p-4 bg-slate-800 rounded-xl hover:bg-blue-600 text-left font-bold">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="p-4 bg-slate-800 rounded-xl hover:bg-emerald-600 text-left font-bold">📱 Cámara</button>
            <button onClick={() => setModo('manual')} className="p-4 bg-slate-800 rounded-xl hover:bg-amber-600 text-left font-bold">✏️ Manual</button>
          </div>
        ) : !direccion ? (
          <div className="grid grid-cols-2 gap-4 pt-4">
            <button onClick={() => setDireccion('entrada')} className="py-10 bg-emerald-600/10 border-2 border-emerald-500/30 rounded-2xl text-emerald-500 font-black">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="py-10 bg-red-600/10 border-2 border-red-500/30 rounded-2xl text-red-500 font-black">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`text-center py-1 rounded-full text-[9px] font-black tracking-widest ${direccion === 'entrada' ? 'bg-emerald-500' : 'bg-red-500'}`}>MARCANDO {direccion.toUpperCase()}</div>
            {!qrData && modo === 'camara' && <div id="reader" className="rounded-2xl overflow-hidden bg-black border-2 border-emerald-500/50 min-h-[250px]"></div>}
            {!qrData && modo === 'usb' && <div className="py-16 text-center text-blue-400 text-xs font-bold animate-pulse">LECTOR USB ACTIVO...</div>}
            {(qrData || modo === 'manual') && (
              <div className="space-y-4 pt-2">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <p className="text-[9px] text-slate-500 font-bold uppercase">ID Leído:</p>
                  <p className="font-mono text-sm text-blue-400 truncate">{modo === 'manual' ? 'MODO MANUAL' : qrData}</p>
                </div>
                {modo === 'manual' && <input type="text" placeholder="ID (Letras y Números)" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-700 text-center font-bold" value={documentoManual} onChange={e => setDocumentoManual(e.target.value)} onKeyDown={e => e.key === 'Enter' && document.getElementById('pinInput')?.focus()} />}
                <input id="pinInput" type="text" placeholder="PIN ALFANUMÉRICO" className="w-full p-4 bg-slate-950 rounded-xl border border-slate-700 text-center text-2xl font-black" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && registrar()} autoFocus />
                <button onClick={registrar} className="w-full bg-blue-600 py-4 rounded-xl font-black uppercase">Confirmar Registro</button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}