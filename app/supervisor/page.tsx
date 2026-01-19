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
  const [documentoManual, setDocumentoManual] = useState('');
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const router = useRouter();

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

  // --- LÓGICA DE CAPTURA USB CORREGIDA ---
  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;

    let keyboardBuffer = "";
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar teclas de función y control que bloqueaban la lectura
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;

      if (e.key === 'Enter') {
        if (keyboardBuffer.length > 0) {
          // Limpieza de caracteres no deseados
          const cleanId = keyboardBuffer.trim().replace(/[^a-zA-Z0-9-]/g, "");
          setQrData(cleanId);
          keyboardBuffer = "";
        }
      } else {
        keyboardBuffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modo, direccion, qrData]);

  // --- LÓGICA DE CÁMARA CORREGIDA ---
  useEffect(() => {
    if (modo === 'camara' && direccion && !qrData) {
      const scanner = new Html5Qrcode("reader");
      scannerRef.current = scanner;
      scanner.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 250, height: 250 } },
        (text) => {
          setQrData(text.trim());
          stopScanner();
        },
        () => {}
      ).catch(err => console.error("Error cámara:", err));
    }
    return () => { if (scannerRef.current) stopScanner(); };
  }, [modo, direccion, qrData]);

  const registrar = async () => {
    setLoading(true);
    const idFinal = modo === 'manual' ? documentoManual.trim() : qrData.trim();

    if (!idFinal || !pin) {
      alert("Por favor ingrese ID y PIN");
      setLoading(false);
      return;
    }

    const { data: emp, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('documento_id', idFinal)
      .eq('pin_seguridad', pin.trim())
      .eq('activo', true)
      .single();

    if (error || !emp) {
      alert(`❌ DATOS INCORRECTOS\nID intentado: ${idFinal}`);
      setPin('');
      setLoading(false);
      return;
    }

    const session = JSON.parse(localStorage.getItem('user_session') || '{}');
    await supabase.from('registros_acceso').insert([{
      empleado_id: emp.id,
      nombre_empleado: emp.nombre,
      tipo_movimiento: direccion,
      fecha_hora: new Date().toISOString(),
      detalles: `Modo: ${modo.toUpperCase()} - Supervisor: ${session.nombre}`
    }]);

    alert(`✅ REGISTRO EXITOSO: ${emp.nombre}`);
    resetear();
    setLoading(false);
  };

  const resetear = () => {
    stopScanner();
    setQrData(''); setPin(''); setDocumentoManual(''); setModo('menu'); setDireccion(null);
  };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 font-sans">
      
      {/* BOTÓN VOLVER - AFUERA COMO EN LA IMAGEN */}
      <button 
        onClick={() => { if(direccion) setDireccion(null); else if(modo !== 'menu') setModo('menu'); else router.push('/'); }}
        className="absolute top-8 left-8 bg-[#1e293b] hover:bg-[#2d3a4f] px-6 py-3 rounded-lg font-bold text-sm text-white border border-white/10 transition-all"
      >
        ← VOLVER
      </button>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg shadow-2xl border border-white/5 text-center">
        <h1 className="text-3xl font-black mb-12 text-[#3b82f6] tracking-widest uppercase">Supervisor</h1>

        {modo === 'menu' ? (
          <div className="space-y-4">
            <button onClick={() => setModo('usb')} className="w-full p-8 bg-[#1e293b] hover:bg-[#2d3a4f] rounded-[25px] flex items-center gap-5 text-white font-bold text-xl transition-all">
              <span>🔌</span> Escáner USB
            </button>
            <button onClick={() => setModo('camara')} className="w-full p-8 bg-[#1e293b] hover:bg-[#2d3a4f] rounded-[25px] flex items-center gap-5 text-white font-bold text-xl transition-all">
              <span>📱</span> Cámara Móvil
            </button>
            <button onClick={() => setModo('manual')} className="w-full p-8 bg-[#1e293b] hover:bg-[#2d3a4f] rounded-[25px] flex items-center gap-5 text-white font-bold text-xl transition-all">
              <span>🖊️</span> Ingreso Manual
            </button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6 pt-4">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-[#10b981] rounded-[30px] text-white font-black text-2xl shadow-lg">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-[#ef4444] rounded-[30px] text-white font-black text-2xl shadow-lg">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`py-4 rounded-[25px] text-white font-black text-xl ${direccion === 'entrada' ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`}>
              {direccion.toUpperCase()}
            </div>

            <div className="bg-[#050a14] p-6 rounded-[25px] border border-white/5 min-h-[120px] flex items-center justify-center">
              {qrData ? (
                <div className="animate-in zoom-in duration-300">
                  <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">ID Detectado</p>
                  <p className="text-[#3b82f6] font-mono font-bold text-2xl">{qrData}</p>
                </div>
              ) : modo === 'camara' ? (
                <div id="reader" className="w-full rounded-2xl overflow-hidden"></div>
              ) : modo === 'manual' ? (
                <input 
                  type="text" 
                  placeholder="ID DOCUMENTO" 
                  className="bg-transparent w-full text-center text-white font-bold text-xl outline-none"
                  value={documentoManual}
                  onChange={(e) => setDocumentoManual(e.target.value)}
                  autoFocus
                />
              ) : (
                <div className="text-center">
                  <div className="w-6 h-6 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-slate-600 font-bold text-sm uppercase">Esperando hardware...</p>
                </div>
              )}
            </div>

            <input 
              type="password" 
              placeholder="PIN DE SEGURIDAD" 
              className="w-full py-8 bg-[#050a14] rounded-[30px] text-white text-center text-4xl font-black outline-none border-2 border-transparent focus:border-[#3b82f6] transition-all"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && registrar()}
            />

            <button 
              disabled={loading}
              onClick={registrar}
              className="w-full py-6 bg-[#2563eb] rounded-[30px] text-white font-black text-xl hover:bg-[#3b82f6] transition-all disabled:opacity-50"
            >
              {loading ? 'VALIDANDO...' : 'CONFIRMAR'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}