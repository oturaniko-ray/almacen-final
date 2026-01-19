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

  // --- SONIDOS ---
  const playSound = (type: 'success' | 'error') => {
    const audio = new Audio(type === 'success' 
      ? 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' 
      : 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
    audio.play().catch(() => {});
  };

  // --- SEGURIDAD SESIÓN ---
  const verificarSesion = useCallback(async () => {
    const sessionStr = localStorage.getItem('user_session');
    if (!sessionStr) return;
    const localUser = JSON.parse(sessionStr);
    const { data } = await supabase.from('empleados').select('session_id').eq('id', localUser.id).single();
    if (data?.session_id !== localUser.session_id) {
      alert("⚠️ Sesión activa en otro dispositivo.");
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

  // --- LÓGICA CÁMARA ---
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
      scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async (text) => {
          setQrData(text);
          await stopScanner();
        },
        () => {}
      ).catch(e => console.error(e));
    }
    return () => { if (scannerRef.current) stopScanner(); };
  }, [modo, direccion, qrData]);

  // --- LÓGICA USB ---
  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        // Limpieza agresiva de caracteres de control de Windows/Lectores
        const clean = buffer.replace(/Shift|Control|Alt|CapsLock|Dead|Meta/g, "").trim();
        if (clean.length > 1) setQrData(clean);
        buffer = "";
      } else if (e.key.length === 1) buffer += e.key;
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  // --- PROCESAMIENTO DE REGISTRO (CORREGIDO) ---
  const registrar = async () => {
    // 1. Obtener el ID bruto
    const rawInput = modo === 'manual' ? cedulaManual : qrData;
    
    // 2. Limpiar el ID de formatos QR (ID|Nombre o JSON)
    let idParaConsultar = rawInput.trim();
    if (idParaConsultar.includes('|')) {
      idParaConsultar = idParaConsultar.split('|')[0].trim();
    } else if (idParaConsultar.startsWith('{')) {
      try { idParaConsultar = JSON.parse(idParaConsultar).id.toString(); } catch (e) {}
    }

    // 3. Validar que tengamos datos
    const pinLimpio = pin.trim();
    if (!idParaConsultar || !pinLimpio) {
      playSound('error');
      alert("Por favor, ingrese ID y PIN");
      return;
    }

    // 4. CONSULTA A SUPABASE (Usamos .ilike para ser insensibles a mayúsculas/minúsculas en texto)
    const { data: emp, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('cedula_id', idParaConsultar)
      .eq('pin_seguridad', pinLimpio)
      .eq('activo', true)
      .single();

    if (error || !emp) {
      console.log("Error de validación:", error);
      playSound('error');
      alert("❌ Datos incorrectos o usuario inactivo");
      setPin(''); // Limpiar buffer de PIN para reintento inmediato
      return;
    }

    // 5. INSERTAR REGISTRO
    const session = JSON.parse(localStorage.getItem('user_session') || '{}');
    const { error: insertError } = await supabase.from('registros_acceso').insert([{
      empleado_id: emp.id,
      nombre_empleado: emp.nombre,
      tipo_movimiento: direccion,
      fecha_hora: new Date().toISOString(),
      detalles: `Modo: ${modo.toUpperCase()} - Supervisor: ${session.nombre}`
    }]);

    if (insertError) {
      alert("Error al guardar el registro");
      return;
    }

    playSound('success');
    alert(`✅ ${direccion?.toUpperCase()} registrada: ${emp.nombre}`);
    resetear();
  };

  const resetear = async () => {
    await stopScanner();
    setQrData(''); setPin(''); setCedulaManual(''); setModo('menu'); setDireccion(null);
  };

  const volverAtras = async () => {
    if (qrData || cedulaManual) {
      setQrData(''); setCedulaManual(''); setPin('');
    } else if (direccion) {
      await stopScanner();
      setDireccion(null);
    } else {
      setModo('menu');
    }
  };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white font-sans">
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 w-full max-w-sm shadow-2xl relative">
        
        {/* BOTÓN VOLVER (Corregido y siempre accesible fuera del menú) */}
        {modo !== 'menu' && (
          <button 
            onClick={volverAtras} 
            className="absolute top-4 left-4 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded-lg text-[10px] font-bold z-50 border border-slate-700 transition-all"
          >
            ← VOLVER
          </button>
        )}

        <h1 className="text-center font-bold mb-6 mt-4 text-blue-500 uppercase tracking-widest text-sm">Panel Supervisor</h1>

        {modo === 'menu' ? (
          <div className="grid gap-3 animate-in fade-in duration-300">
            <button onClick={() => setModo('usb')} className="p-4 bg-slate-800 rounded-xl hover:bg-blue-600 text-left flex items-center justify-between group transition-all">
              <span className="font-bold">🔌 Escáner USB</span>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </button>
            <button onClick={() => setModo('camara')} className="p-4 bg-slate-800 rounded-xl hover:bg-emerald-600 text-left flex items-center justify-between group transition-all">
              <span className="font-bold">📱 Cámara Móvil</span>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </button>
            <button onClick={() => setModo('manual')} className="p-4 bg-slate-800 rounded-xl hover:bg-amber-600 text-left flex items-center justify-between group transition-all">
              <span className="font-bold">✏️ Ingreso Manual</span>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </button>
            <button onClick={() => router.push('/')} className="mt-4 text-slate-600 text-[9px] text-center uppercase tracking-tighter hover:text-slate-400">Cambiar de Perfil / Salir</button>
          </div>
        ) : !direccion ? (
          <div className="grid grid-cols-2 gap-4 pt-4 animate-in slide-in-from-right-4 duration-300">
            <button onClick={() => setDireccion('entrada')} className="py-10 bg-emerald-600/10 border-2 border-emerald-500/30 rounded-2xl text-emerald-500 font-black hover:bg-emerald-500 hover:text-white transition-all text-sm">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="py-10 bg-red-600/10 border-2 border-red-500/30 rounded-2xl text-red-500 font-black hover:bg-red-500 hover:text-white transition-all text-sm">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className={`text-center py-1 rounded-full text-[9px] font-black tracking-widest ${direccion === 'entrada' ? 'bg-emerald-500' : 'bg-red-500'}`}>
              MODO {direccion.toUpperCase()}
            </div>
            
            {!qrData && modo === 'camara' && (
              <div id="reader" className="rounded-2xl overflow-hidden bg-black border-2 border-emerald-500/50 min-h-[250px] shadow-2xl"></div>
            )}

            {!qrData && modo === 'usb' && (
              <div className="py-16 text-center">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-blue-400 text-xs font-bold animate-pulse">ESPERANDO LECTURA USB...</p>
              </div>
            )}

            {(qrData || modo === 'manual') && (
              <div className="space-y-4 pt-2">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">Identificación Detectada:</p>
                  <p className="font-mono text-sm text-blue-400 truncate">{modo === 'manual' ? 'MODO MANUAL' : qrData}</p>
                </div>
                
                {modo === 'manual' && (
                  <input 
                    type="text" 
                    placeholder="Número de Cédula" 
                    className="w-full p-4 bg-slate-950 rounded-xl border border-slate-700 text-center font-bold focus:border-blue-500 outline-none transition-all" 
                    value={cedulaManual} 
                    onChange={e => setCedulaManual(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && document.getElementById('pinInput')?.focus()}
                  />
                )}

                <input 
                  id="pinInput"
                  type="password" 
                  placeholder="PIN DE SEGURIDAD" 
                  className="w-full p-4 bg-slate-950 rounded-xl border border-slate-700 text-center text-3xl focus:border-blue-500 outline-none font-black" 
                  value={pin} 
                  onChange={e => setPin(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && registrar()}
                  autoFocus 
                />
                
                <button 
                  onClick={registrar} 
                  className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-black uppercase shadow-lg active:scale-95 transition-all"
                >
                  Confirmar {direccion.toUpperCase()}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}