'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 COORDENADAS RESTAURADAS
const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 80; 
const TIEMPO_MAX_TOKEN_MS = 120000;

export default function SupervisorPage() {
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pinSupervisor, setPinSupervisor] = useState('');
  const [animar, setAnimar] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  const volverAtras = async () => {
    if (direccion) {
      setDireccion(null); setQrData(''); setPinSupervisor('');
      if (scannerRef.current?.isScanning) await scannerRef.current.stop();
    } else if (modo !== 'menu') { 
      setModo('menu'); 
    }
  };

  const resetearTodo = async () => {
    if (scannerRef.current) {
      if (scannerRef.current.isScanning) await scannerRef.current.stop();
      scannerRef.current = null;
    }
    setQrData(''); setPinSupervisor(''); setModo('menu'); setDireccion(null);
  };

  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (buffer.trim()) {
          setQrData(buffer.trim());
          setTimeout(() => pinRef.current?.focus(), 100);
        }
        buffer = "";
      } else if (e.key.length === 1) { buffer += e.key; }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  useEffect(() => {
    if (modo === 'camara' && direccion && !qrData) {
      const iniciarCamara = async () => {
        try {
          const scanner = new Html5Qrcode("reader");
          scannerRef.current = scanner;
          await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text) => {
            setQrData(text);
            scanner.stop();
            setTimeout(() => pinRef.current?.focus(), 100);
          }, () => {});
        } catch (err) { console.error(err); }
      };
      setTimeout(iniciarCamara, 500); 
    }
    return () => { if (scannerRef.current?.isScanning) scannerRef.current.stop(); };
  }, [modo, direccion, qrData]);

  const registrarAcceso = async () => {
    if (!qrData || !pinSupervisor || animar) return;
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

        // 🟢 CORRECCIÓN: Actualización de estado en almacén
        await supabase.from('empleados').update({ en_almacen: direccion === 'entrada' }).eq('id', emp.id);
        
        // Registro en historial
        await supabase.from('registros_acceso').insert([{
          empleado_id: emp.id,
          nombre_empleado: emp.nombre,
          tipo_movimiento: direccion,
          detalles: `SUPERVISOR: ${sup.nombre} (${modo})`
        }]);

        alert(`Operación Exitosa: ${emp.nombre}`);
        resetearTodo();
      } catch (err: any) { alert(err.message); } finally { setAnimar(false); }
    }, () => alert("GPS Obligatorio"));
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
      
      <style jsx global>{`
        @keyframes laser { 0% { top: 0%; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes checkPop { 0% { transform: scale(0); } 80% { transform: scale(1.2); } 100% { transform: scale(1); } }
        .animate-laser { animation: laser 2s infinite linear; }
        .animate-blink { animation: blink 1.5s infinite ease-in-out; }
        .animate-check { animation: checkPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      `}</style>
      
      {/* BOTÓN VOLVER (Visible en cualquier pantalla que no sea el menú inicial) */}
      {modo !== 'menu' && (
        <button 
          onClick={volverAtras} 
          className="absolute top-8 left-8 bg-[#1e293b] px-6 py-3 rounded-2xl font-black text-[10px] uppercase border border-white/5 tracking-widest z-50 hover:bg-slate-700 transition-colors"
        >
          ← Volver
        </button>
      )}

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl relative z-10">
        <h2 className="text-2xl font-black uppercase italic text-blue-500 mb-8 text-center tracking-tighter">Lectura de Código QR</h2>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-blue-500 transition-all">🔌 ESCÁNER USB / ÓPTICO</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-emerald-500 transition-all">📱 CÁMARA MÓVIL (QR)</button>
            <button onClick={() => setModo('manual')} className="p-8 bg-[#050a14] rounded-[30px] font-black text-lg border border-white/10 hover:bg-slate-800 transition-all text-slate-400 italic uppercase tracking-widest text-[12px]">🖋️ Entrada Manual</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-xl shadow-emerald-900/20">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl shadow-xl shadow-red-900/20">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`bg-[#050a14] p-6 rounded-[30px] border transition-all duration-500 ${qrData ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'border-white/5'} relative overflow-hidden h-32 flex flex-col items-center justify-center`}>
              {!qrData ? (
                <>
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Esperando Lectura</p>
                  {modo === 'usb' && <div className="absolute inset-x-0 h-[3px] bg-red-600 shadow-[0_0_15px_red] animate-laser z-20"></div>}
                  {modo === 'camara' && <div id="reader" className="w-full h-full rounded-2xl"></div>}
                </>
              ) : (
                <div className="flex flex-col items-center animate-check">
                  <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mb-2 shadow-[0_0_20px_#10b981]">
                    <span className="text-white text-2xl">✔</span>
                  </div>
                  <p className="text-emerald-500 font-black text-[10px] uppercase tracking-[0.3em]">Lectura Exitosa</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-[13px] font-black text-slate-400 uppercase tracking-widest text-center animate-blink">PIN AUTORIZACIÓN</p>
              <input 
                ref={pinRef}
                type="password" 
                className="w-full py-6 bg-[#050a14] rounded-[30px] text-center text-4xl font-black border-2 border-blue-500/20 focus:border-blue-500 transition-all outline-none"
                value={pinSupervisor}
                onChange={(e) => setPinSupervisor(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmBtnRef.current?.focus(); }}
              />
            </div>

            <button 
              ref={confirmBtnRef}
              onClick={registrarAcceso} 
              disabled={animar || !qrData || !pinSupervisor}
              onKeyDown={(e) => { if (e.key === 'Enter') registrarAcceso(); }}
              className={`w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl uppercase italic shadow-lg disabled:opacity-50 transition-all ${pinSupervisor && !animar ? 'animate-blink' : ''}`}
            >
              {animar ? 'PROCESANDO...' : 'Confirmar Entrada/Salida'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}