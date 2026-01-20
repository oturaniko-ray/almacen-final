'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 COORDENADAS DEL ALMACÉN (Ajusta estas a tu ubicación real)
const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 80; // Radio de tolerancia
const TIEMPO_MAX_TOKEN_MS = 120000;

export default function SupervisorPage() {
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pinSupervisor, setPinSupervisor] = useState('');
  const [animar, setAnimar] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const router = useRouter();

  // NAVEGACIÓN
  const resetearTodo = async () => {
    if (scannerRef.current) {
      if (scannerRef.current.isScanning) await scannerRef.current.stop();
      scannerRef.current = null;
    }
    setQrData(''); setPinSupervisor(''); setModo('menu'); setDireccion(null);
  };

  // LÓGICA LECTOR USB (ÓPTICO)
  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (buffer.trim()) setQrData(buffer.trim());
        buffer = "";
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  // LÓGICA CÁMARA
  useEffect(() => {
    if (modo === 'camara' && direccion && !qrData) {
      const iniciarCamara = async () => {
        try {
          const scanner = new Html5Qrcode("reader");
          scannerRef.current = scanner;
          await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 250 },
            (text) => {
              setQrData(text);
              scanner.stop();
            },
            () => {}
          );
        } catch (err) { console.error("Error cámara:", err); }
      };
      setTimeout(iniciarCamara, 500); // Delay para asegurar que el div #reader exista
    }
    return () => { if (scannerRef.current?.isScanning) scannerRef.current.stop(); };
  }, [modo, direccion, qrData]);

  const registrarAcceso = async () => {
    if (!qrData || !pinSupervisor) return;
    setAnimar(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        let docId = qrData;
        try {
          const decoded = atob(qrData).split('|');
          if (decoded.length === 2) {
            docId = decoded[0];
            if (Date.now() - parseInt(decoded[1]) > TIEMPO_MAX_TOKEN_MS) throw new Error("TOKEN EXPIRADO");
          }
        } catch (e) {}

        const { data: emp } = await supabase.from('empleados').select('*').eq('documento_id', docId).maybeSingle();
        if (!emp) throw new Error("Empleado no registrado");

        const session = JSON.parse(localStorage.getItem('user_session') || '{}');
        const { data: sup } = await supabase.from('empleados').select('*').eq('id', session.id).eq('pin_seguridad', pinSupervisor).maybeSingle();
        if (!sup) throw new Error("PIN Incorrecto");

        await supabase.from('empleados').update({ en_almacen: direccion === 'entrada' }).eq('id', emp.id);
        await supabase.from('registros_acceso').insert([{
          empleado_id: emp.id,
          nombre_empleado: emp.nombre,
          tipo_movimiento: direccion,
          detalles: `SUPERVISOR: ${sup.nombre} (${modo})`
        }]);

        alert("Registro Exitoso");
        resetearTodo();
      } catch (err: any) { alert(err.message); } finally { setAnimar(false); }
    }, () => alert("GPS Obligatorio"));
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative">
      <div className="absolute top-8 left-8 flex gap-4">
        <button onClick={() => router.push('/')} className="bg-[#1e293b] px-6 py-3 rounded-2xl font-black text-[10px] uppercase border border-white/5 tracking-widest hover:bg-blue-600 transition-all">← Volver al Menú</button>
        {modo !== 'menu' && (
          <button onClick={resetearTodo} className="bg-red-600/20 text-red-500 px-6 py-3 rounded-2xl font-black text-[10px] uppercase border border-red-500/20 tracking-widest">Reiniciar</button>
        )}
      </div>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl">
        <h2 className="text-2xl font-black uppercase italic text-blue-500 mb-8 text-center tracking-tighter">Terminal Supervisor</h2>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-blue-500 transition-all">🔌 ESCÁNER USB / ÓPTICO</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-emerald-500 transition-all">📱 CÁMARA MÓVIL (QR)</button>
            <button onClick={() => setModo('manual')} className="p-8 bg-[#050a14] rounded-[30px] font-black text-lg border border-white/10 hover:bg-slate-800 transition-all text-slate-400">🖋️ ENTRADA MANUAL</button>
          </div>
        ) : !direccion ? (
          <div className="grid grid-cols-1 gap-6">
            <button onClick={() => setDireccion('entrada')} className="py-16 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-xl shadow-emerald-900/20">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="py-16 bg-red-600 rounded-[35px] font-black text-4xl shadow-xl shadow-red-900/20">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-[#050a14] p-6 rounded-[30px] border border-white/5">
              <p className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest text-center">Datos del Empleado</p>
              {modo === 'camara' && !qrData ? (
                <div id="reader" className="w-full aspect-square overflow-hidden rounded-2xl"></div>
              ) : (
                <input 
                  type="text" 
                  className="w-full bg-transparent text-center text-xl font-bold text-blue-400 outline-none"
                  value={qrData}
                  placeholder="ID / CÓDIGO"
                  onChange={(e) => setQrData(e.target.value)}
                  readOnly={modo === 'usb' && qrData !== ''}
                />
              )}
            </div>

            <input 
              type="password" 
              placeholder="PIN AUTORIZACIÓN" 
              className="w-full py-6 bg-[#050a14] rounded-[30px] text-center text-3xl font-black border-2 border-blue-500/20 focus:border-blue-500 transition-all outline-none"
              value={pinSupervisor}
              onChange={(e) => setPinSupervisor(e.target.value)}
            />

            <button 
              onClick={registrarAcceso} 
              disabled={animar || !qrData || !pinSupervisor}
              className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl uppercase italic shadow-lg disabled:opacity-50"
            >
              {animar ? 'REGISTRANDO...' : 'CONFIRMAR OPERACIÓN'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}