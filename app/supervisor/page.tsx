'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function SupervisorPage() {
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pin, setPin] = useState('');
  const [documentoManual, setDocumentoManual] = useState('');
  const router = useRouter();

  const playSound = (type: 'success' | 'error') => {
    const audio = new Audio(type === 'success' 
      ? 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' 
      : 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
    audio.play().catch(() => {});
  };

  // Lector USB con Filtro Anti-Errores
  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.length > 1 && e.key !== 'Enter') return; 
      if (e.key === 'Enter') {
        const limpio = buffer.replace(/ScrollLock|AltGraph|Control|Shift/gi, "").trim();
        if (limpio) setQrData(limpio);
        buffer = "";
      } else { buffer += e.key; }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  const registrar = async () => {
    const dataCapturada = modo === 'manual' ? documentoManual : qrData;
    const [idLimpio, timeBlock] = dataCapturada.split('|');
    
    // Validar Seguridad Dinámica (margen de 2 min)
    const currentTime = Math.floor(Date.now() / 60000);
    if (timeBlock && Math.abs(currentTime - parseInt(timeBlock)) > 2) {
      playSound('error');
      alert("❌ QR EXPIRADO. Refresque la pantalla del empleado.");
      setQrData(''); return;
    }

    const { data: emp, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('documento_id', idLimpio.trim())
      .eq('pin_seguridad', pin.trim())
      .single();

    if (error || !emp) {
      playSound('error');
      alert(`❌ DATOS INCORRECTOS: ${idLimpio}`);
      setPin(''); return;
    }

    await supabase.from('registros_acceso').insert([{
      empleado_id: emp.id,
      nombre_empleado: emp.nombre,
      tipo_movimiento: direccion,
      detalles: `Modo: ${modo.toUpperCase()} - Seguridad OK`
    }]);

    playSound('success');
    alert("✅ REGISTRO EXITOSO");
    setQrData(''); setPin(''); setDocumentoManual(''); setModo('menu'); setDireccion(null);
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6">
      <button 
        onClick={() => { if(direccion) setDireccion(null); else setModo('menu'); }}
        className="absolute top-8 left-8 bg-[#1e293b] px-6 py-3 rounded-lg font-bold text-white border border-white/10 transition-all"
      >
        ← VOLVER
      </button>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg shadow-2xl border border-white/5 text-center">
        <h1 className="text-3xl font-black mb-12 text-[#3b82f6] uppercase tracking-widest">Supervisor</h1>

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
          <div className="flex flex-col gap-4">
            <button onClick={() => setDireccion('entrada')} className="w-full py-10 bg-[#10b981] rounded-[30px] text-white font-black text-2xl shadow-lg">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-10 bg-[#ef4444] rounded-[30px] text-white font-black text-2xl shadow-lg">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-[#050a14] p-6 rounded-[25px] border border-white/5 min-h-[100px] flex items-center justify-center">
              {modo === 'manual' ? (
                <input type="text" placeholder="ID DOCUMENTO" className="bg-transparent text-center text-white font-bold text-xl outline-none" value={documentoManual} onChange={(e) => setDocumentoManual(e.target.value)} autoFocus />
              ) : (
                <p className="text-[#3b82f6] font-mono font-bold text-xl">{qrData || "ESPERANDO LECTURA..."}</p>
              )}
            </div>
            <input type="password" placeholder="PIN" className="w-full py-8 bg-[#050a14] rounded-[30px] text-white text-center text-4xl font-black outline-none border-2 border-transparent focus:border-[#3b82f6]" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && registrar()} />
            <button onClick={registrar} className="w-full py-6 bg-[#2563eb] rounded-[30px] text-white font-black text-xl hover:bg-[#3b82f6] transition-all">CONFIRMAR</button>
          </div>
        )}
      </div>
    </main>
  );
}