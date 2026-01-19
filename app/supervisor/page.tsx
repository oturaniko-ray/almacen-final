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

  const registrar = async () => {
    setLoading(true);
    const idCapturado = modo === 'manual' ? documentoManual : qrData;
    let idFinal = idCapturado.trim();

    const { data: emp, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('documento_id', idFinal)
      .eq('pin_seguridad', pin.trim())
      .eq('activo', true)
      .single();

    if (error || !emp) {
      alert(`Datos incorrectos.\nLeído: ${idFinal}`);
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

    alert(`✅ REGISTRO EXITOSO`);
    resetear();
    setLoading(false);
  };

  const resetear = () => {
    stopScanner();
    setQrData(''); setPin(''); setDocumentoManual(''); setModo('menu'); setDireccion(null);
  };

  // Función para el botón volver dinámico
  const manejarVolver = () => {
    if (direccion) {
      setDireccion(null);
      setQrData('');
      stopScanner();
    } else if (modo !== 'menu') {
      setModo('menu');
    } else {
      router.push('/'); // Si está en el menú principal de supervisor, vuelve al inicio
    }
  };

  if (!authorized) return null;

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 font-sans">
      
      {/* BOTÓN VOLVER - Exactamente como en tu imagen */}
      <button 
        onClick={manejarVolver}
        className="absolute top-8 left-8 bg-[#1e293b] hover:bg-[#2d3a4f] px-6 py-3 rounded-lg font-bold text-sm text-white flex items-center gap-2 border border-white/10 shadow-lg transition-all"
      >
        ← VOLVER
      </button>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg shadow-2xl border border-white/5 relative mt-10">
        <h1 className="text-3xl font-black text-center mb-12 text-[#3b82f6] tracking-[0.2em] uppercase">
          Supervisor
        </h1>

        {modo === 'menu' ? (
          <div className="space-y-5">
            <button onClick={() => setModo('usb')} className="w-full p-8 bg-[#1e293b] hover:bg-[#2d3a4f] rounded-[25px] flex items-center gap-5 text-white font-bold text-xl transition-all border border-white/5">
              <span>🔌</span> Escáner USB
            </button>
            <button onClick={() => setModo('camara')} className="w-full p-8 bg-[#1e293b] hover:bg-[#2d3a4f] rounded-[25px] flex items-center gap-5 text-white font-bold text-xl transition-all border border-white/5">
              <span>📱</span> Cámara Móvil
            </button>
            <button onClick={() => setModo('manual')} className="w-full p-8 bg-[#1e293b] hover:bg-[#2d3a4f] rounded-[25px] flex items-center gap-5 text-white font-bold text-xl transition-all border border-white/5">
              <span>🖋️</span> Ingreso Manual
            </button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6 pt-4">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-[#10b981] rounded-[30px] text-white font-black text-2xl tracking-widest shadow-lg active:scale-95 transition-all">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-[#ef4444] rounded-[30px] text-white font-black text-2xl tracking-widest shadow-lg active:scale-95 transition-all">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`text-center py-4 rounded-[25px] text-white font-black text-xl tracking-widest ${direccion === 'entrada' ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`}>
              {direccion.toUpperCase()}
            </div>

            <div className="bg-[#050a14] p-6 rounded-[25px] border border-white/5 flex items-center justify-center min-h-[100px]">
              {qrData ? (
                <p className="text-[#3b82f6] font-mono font-bold text-lg">{qrData}</p>
              ) : modo === 'manual' ? (
                <input 
                  type="text" 
                  placeholder="ID DOCUMENTO" 
                  className="bg-transparent w-full text-center text-white font-bold text-xl outline-none placeholder:text-slate-700"
                  value={documentoManual}
                  onChange={(e) => setDocumentoManual(e.target.value)}
                  autoFocus
                />
              ) : (
                <p className="text-slate-600 font-bold animate-pulse text-sm">ESPERANDO LECTURA...</p>
              )}
            </div>

            <input 
              type="password" 
              placeholder="PIN" 
              className="w-full py-8 bg-[#050a14] rounded-[30px] border-2 border-transparent focus:border-[#3b82f6] text-white text-center text-4xl font-black outline-none transition-all placeholder:text-slate-800"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && registrar()}
            />

            <button 
              disabled={loading}
              onClick={registrar}
              className="w-full py-6 bg-[#2563eb] rounded-[30px] text-white font-black text-xl shadow-xl hover:bg-[#3b82f6] transition-all disabled:opacity-50"
            >
              {loading ? 'PROCESANDO...' : 'CONFIRMAR'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}