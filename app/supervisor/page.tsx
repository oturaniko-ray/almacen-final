'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function SupervisorPage() {
  const [modo, setModo] = useState<'menu' | 'usb' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pin, setPin] = useState('');
  const router = useRouter();

  // --- FILTRO DE HARDWARE (Elimina ScrollLock, AltGraph, etc.) ---
  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      // Ignorar teclas de control
      if (e.key.length > 1 && e.key !== 'Enter') return; 
      
      if (e.key === 'Enter') {
        // Limpieza profunda antes de asignar
        const limpio = buffer.replace(/ScrollLock|AltGraph|Control|Shift|Dead/gi, "").trim();
        setQrData(limpio);
        buffer = "";
      } else {
        buffer += e.key;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  const registrar = async () => {
    // 1. Extraer ID real (antes del pipe |)
    const [idLimpio, timestampQr] = qrData.split('|');
    
    // 2. Validar Seguridad Dinámica (margen de 2 minutos para evitar desfases de reloj)
    const now = Math.floor(Date.now() / 60000);
    if (timestampQr && Math.abs(now - parseInt(timestampQr)) > 2) {
      alert("❌ QR EXPIRADO. Pida al empleado que refresque su pantalla.");
      setQrData('');
      return;
    }

    const { data: emp, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('documento_id', idLimpio)
      .eq('pin_seguridad', pin.trim())
      .single();

    if (error || !emp) {
      alert(`❌ DATOS INCORRECTOS\nID: ${idLimpio}`);
      setPin('');
      return;
    }

    await supabase.from('registros_acceso').insert([{
      empleado_id: emp.id,
      nombre_empleado: emp.nombre,
      tipo_movimiento: direccion,
      detalles: `Seguridad Dinámica OK - Modo: ${modo.toUpperCase()}`
    }]);

    alert("✅ REGISTRO EXITOSO");
    setQrData(''); setPin(''); setModo('menu'); setDireccion(null);
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6">
      
      {/* BOTÓN VOLVER - AFUERA DEL CONTENEDOR */}
      <button 
        onClick={() => { if(direccion) setDireccion(null); else setModo('menu'); }}
        className="absolute top-8 left-8 bg-[#1e293b] px-6 py-3 rounded-lg font-bold text-white border border-white/10"
      >
        ← VOLVER
      </button>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg shadow-2xl border border-white/5 text-center">
        <h1 className="text-3xl font-black mb-12 text-[#3b82f6] uppercase tracking-widest">Supervisor</h1>

        {modo === 'menu' ? (
          <div className="space-y-4">
            <button onClick={() => setModo('usb')} className="w-full p-8 bg-[#1e293b] rounded-[25px] text-white font-bold text-xl flex items-center gap-4">🔌 Escáner USB</button>
            <button onClick={() => setModo('manual')} className="w-full p-8 bg-[#1e293b] rounded-[25px] text-white font-bold text-xl flex items-center gap-4">🖋️ Ingreso Manual</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-4">
            <button onClick={() => setDireccion('entrada')} className="w-full py-10 bg-[#10b981] rounded-[30px] text-white font-black text-2xl">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-10 bg-[#ef4444] rounded-[30px] text-white font-black text-2xl">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-[#050a14] p-6 rounded-[25px] border border-white/5">
              <p className="text-blue-400 font-mono font-bold">{qrData || "ESPERANDO LECTURA..."}</p>
            </div>
            <input 
              type="password" 
              placeholder="PIN DE SEGURIDAD" 
              className="w-full py-8 bg-[#050a14] rounded-[30px] text-white text-center text-4xl font-black outline-none border-2 border-transparent focus:border-[#3b82f6]"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && registrar()}
            />
            <button onClick={registrar} className="w-full py-6 bg-[#2563eb] rounded-[30px] text-white font-black text-xl">CONFIRMAR</button>
          </div>
        )}
      </div>
    </main>
  );
}