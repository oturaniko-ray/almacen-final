'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function SupervisorPage() {
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pin, setPin] = useState('');
  const [documentoManual, setDocumentoManual] = useState('');
  const [animar, setAnimar] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const router = useRouter();

  const playSound = (t: 'success' | 'error') => {
    const a = new Audio(t === 'success' ? 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' : 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
    a.play().catch(() => {});
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current.stop();
      scannerRef.current = null;
    }
  };

  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.length > 1 && e.key !== 'Enter') return;
      if (e.key === 'Enter') {
        const limpio = buffer.replace(/ScrollLock|AltGraph|Control|Shift/gi, "").trim();
        if (limpio) {
          setAnimar(true);
          setTimeout(() => { setQrData(limpio); setAnimar(false); }, 600);
        }
        buffer = ""; // RESET BUFFER PARA SIGUIENTE LECTURA
      } else { buffer += e.key; }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  useEffect(() => {
    if (modo === 'camara' && direccion && !qrData) {
      const scanner = new Html5Qrcode("reader");
      scannerRef.current = scanner;
      scanner.start({ facingMode: "environment" }, { fps: 15, qrbox: 250 }, (text) => {
        setAnimar(true);
        setTimeout(() => { setQrData(text); setAnimar(false); stopScanner(); }, 600);
      }, () => {}).catch(console.error);
    }
    return () => { stopScanner(); };
  }, [modo, direccion, qrData]);

  const registrar = async () => {
    const idCapturado = modo === 'manual' ? documentoManual : qrData;
    const [idLimpio, timeBlock] = idCapturado.split('|');
    const currentTime = Math.floor(Date.now() / 60000);
    
    if (timeBlock && Math.abs(currentTime - parseInt(timeBlock)) > 2) {
      playSound('error'); alert("❌ QR CADUCADO"); setQrData(''); return;
    }

    const { data: emp, error } = await supabase.from('empleados').select('*').eq('documento_id', idLimpio.trim()).eq('pin_seguridad', pin.trim()).single();

    if (error || !emp) {
      playSound('error'); alert("❌ DATOS INCORRECTOS"); setPin(''); return;
    }

    const { error: regError } = await supabase.from('registros_acceso').insert([{
      empleado_id: emp.id, nombre_empleado: emp.nombre, tipo_movimiento: direccion,
      detalles: `Modo: ${modo.toUpperCase()} - Autorizado`
    }]);

    if (!regError) {
      await supabase.from('empleados').update({ en_almacen: direccion === 'entrada' }).eq('id', emp.id);
      playSound('success');
      alert("✅ REGISTRO EXITOSO");
      setQrData(''); setPin(''); setDocumentoManual(''); setModo('menu'); setDireccion(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white">
      <button onClick={() => { if(direccion) setDireccion(null); else setModo('menu'); stopScanner(); }} className="absolute top-8 left-8 bg-[#1e293b] px-6 py-3 rounded-xl font-bold border border-white/10 shadow-lg transition-all">← VOLVER</button>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 text-center shadow-2xl relative overflow-hidden">
        {animar && <div className="absolute inset-0 bg-blue-600/20 z-50 flex items-center justify-center backdrop-blur-sm animate-pulse"><div className="w-full h-1 bg-blue-400 absolute animate-bounce"></div><span className="font-black text-2xl tracking-tighter italic">LECTURA EXITOSA</span></div>}

        <h1 className="text-3xl font-black mb-12 text-[#3b82f6] uppercase tracking-widest">Supervisor</h1>

        {modo === 'menu' ? (
          <div className="space-y-4">
            <button onClick={() => setModo('usb')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl flex items-center gap-4 hover:bg-blue-600 transition-all"><span>🔌</span> Escáner USB</button>
            <button onClick={() => setModo('camara')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl flex items-center gap-4 hover:bg-emerald-600 transition-all"><span>📱</span> Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl flex items-center gap-4 hover:bg-amber-600 transition-all"><span>🖋️</span> Ingreso Manual</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-[#10b981] rounded-[30px] font-black text-3xl shadow-lg active:scale-95 transition-all">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-[#ef4444] rounded-[30px] font-black text-3xl shadow-lg active:scale-95 transition-all">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div id="reader" className={`w-full rounded-2xl overflow-hidden mb-4 ${modo !== 'camara' ? 'hidden' : 'block'}`}></div>
            <div className="bg-[#050a14] p-8 rounded-[30px] border border-white/5">
              {modo === 'manual' ? (
                <input type="text" placeholder="ID DOCUMENTO" className="bg-transparent text-center text-white font-bold text-xl outline-none w-full" value={documentoManual} onChange={(e) => setDocumentoManual(e.target.value)} autoFocus />
              ) : (
                <p className="text-[#3b82f6] font-mono font-bold text-xl">{qrData || "ESPERANDO LECTURA..."}</p>
              )}
            </div>
            <input type="password" placeholder="PIN" className="w-full py-8 bg-[#050a14] rounded-[30px] text-white text-center text-5xl font-black outline-none border-2 border-transparent focus:border-[#3b82f6] transition-all" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && registrar()} />
            <button onClick={registrar} className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl hover:bg-blue-500 transition-all">CONFIRMAR</button>
          </div>
        )}
      </div>
    </main>
  );
}