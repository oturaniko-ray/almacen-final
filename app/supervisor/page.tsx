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

  // --- SONIDOS ---
  const playSound = (type: 'success' | 'error') => {
    const audio = new Audio(type === 'success' 
      ? 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' 
      : 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
    audio.play().catch(() => {});
  };

  // --- SEGURIDAD ---
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (user.rol === 'supervisor' || user.rol === 'admin') setAuthorized(true);
    else router.push('/');
  }, [router]);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current.stop();
      scannerRef.current = null;
    }
  };

  // --- LÓGICA LECTOR USB (FILTRADA) ---
  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      // IGNORAR TECLAS DE CONTROL (Shift, Alt, Dead, etc.)
      if (e.key.length > 1 && e.key !== 'Enter' && e.key !== 'Backspace') return;
      
      if (e.key === 'Enter') {
        if (buffer.length > 0) setQrData(buffer.trim());
        buffer = "";
      } else if (e.key === 'Backspace') {
        buffer = buffer.slice(0, -1);
      } else {
        buffer += e.key;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  // --- REGISTRO ---
  const registrar = async () => {
    const inputId = modo === 'manual' ? documentoManual : qrData;
    let idLimpio = inputId.trim();
    if (idLimpio.includes('|')) idLimpio = idLimpio.split('|')[0].trim();
    
    // Limpieza final de caracteres extraños del lector
    idLimpio = idLimpio.replace(/Shift|Dead|AltGraph|Control/g, "");

    const { data: emp, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('documento_id', idLimpio)
      .eq('pin_seguridad', pin.trim())
      .eq('activo', true)
      .single();

    if (error || !emp) {
      playSound('error');
      alert(`QR No Válido o Datos Incorrectos.\nContenido leído: ${idLimpio}`);
      setPin('');
      return;
    }

    const session = JSON.parse(localStorage.getItem('user_session') || '{}');
    await supabase.from('registros_acceso').insert([{
      empleado_id: emp.id,
      nombre_empleado: emp.nombre,
      tipo_movimiento: direccion,
      fecha_hora: new Date().toISOString(),
      detalles: `Hardware: ${modo.toUpperCase()} - Supervisor: ${session.nombre || 'SISTEMA'}`
    }]);

    playSound('success');
    alert(`✅ ${direccion?.toUpperCase()} REGISTRADA: ${emp.nombre}`);
    resetear();
  };

  const resetear = async () => {
    await stopScanner();
    setQrData(''); setPin(''); setDocumentoManual(''); setModo('menu'); setDireccion(null);
  };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-6 font-sans">
      <div className="bg-[#111827] p-10 rounded-[40px] w-full max-w-lg shadow-2xl border border-white/5 relative">
        
        {/* BOTÓN VOLVER (Como en tu imagen) */}
        {modo !== 'menu' && (
          <button 
            onClick={() => { if(direccion) setDireccion(null); else setModo('menu'); stopScanner(); setQrData(''); }}
            className="absolute top-8 left-8 text-slate-500 font-bold text-sm tracking-widest flex items-center gap-2 hover:text-white transition-colors"
          >
            ← VOLVER
          </button>
        )}

        <h1 className="text-3xl font-black text-center mb-12 text-[#3b82f6] tracking-widest">SUPERVISOR</h1>

        {modo === 'menu' ? (
          <div className="space-y-4">
            <button onClick={() => setModo('usb')} className="w-full p-8 bg-[#1f2937] hover:bg-[#3b82f6] rounded-3xl transition-all flex items-center gap-4 text-white font-bold text-xl group">
              <span>🔌</span> Escáner USB
            </button>
            <button onClick={() => setModo('camara')} className="w-full p-8 bg-[#1f2937] hover:bg-[#10b981] rounded-3xl transition-all flex items-center gap-4 text-white font-bold text-xl group">
              <span>📱</span> Cámara Móvil
            </button>
            <button onClick={() => setModo('manual')} className="w-full p-8 bg-[#1f2937] hover:bg-[#f59e0b] rounded-3xl transition-all flex items-center gap-4 text-white font-bold text-xl group">
              <span>🖊️</span> Ingreso Manual
            </button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6 pt-4">
            <button onClick={() => setDireccion('entrada')} className="w-full py-10 bg-[#10b981] rounded-[30px] text-white font-black text-2xl shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95 transition-all">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-10 bg-[#ef4444] rounded-[30px] text-white font-black text-2xl shadow-[0_0_20px_rgba(239,68,68,0.3)] active:scale-95 transition-all">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className={`text-center py-4 rounded-3xl text-white font-black text-xl tracking-widest shadow-lg ${direccion === 'entrada' ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`}>
              {direccion.toUpperCase()}
            </div>

            <div className="bg-[#0a0f1e] p-6 rounded-3xl border border-white/5 min-h-[100px] flex items-center justify-center">
              {qrData ? (
                <p className="text-[#3b82f6] font-mono font-bold text-lg break-all text-center">{qrData}</p>
              ) : modo === 'camara' ? (
                <div id="reader" className="w-full rounded-2xl overflow-hidden"></div>
              ) : modo === 'manual' ? (
                <input 
                  type="text" 
                  placeholder="DOCUMENTO ID" 
                  className="bg-transparent w-full text-center text-white font-bold text-xl outline-none"
                  value={documentoManual}
                  onChange={(e) => setDocumentoManual(e.target.value)}
                  autoFocus
                />
              ) : (
                <p className="text-slate-500 font-bold animate-pulse uppercase tracking-tighter">Esperando Lectura USB...</p>
              )}
            </div>

            <div className="relative group">
              <input 
                id="pinInput"
                type="password" 
                placeholder="PIN" 
                className="w-full py-8 bg-[#0a0f1e] rounded-[30px] border-2 border-transparent focus:border-[#3b82f6] text-white text-center text-4xl font-black outline-none transition-all placeholder:text-slate-700"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && registrar()}
              />
            </div>

            <button 
              onClick={registrar}
              className="w-full py-6 bg-[#3b82f6] rounded-[30px] text-white font-black text-xl shadow-xl hover:bg-[#2563eb] active:scale-95 transition-all uppercase"
            >
              Confirmar
            </button>
          </div>
        )}
      </div>
    </main>
  );
}