'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const TIEMPO_MAX_TOKEN_MS = 120000;

export default function SupervisorPage() {
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pinEmpleadoManual, setPinEmpleadoManual] = useState('');
  const [pinSupervisor, setPinSupervisor] = useState('');
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const volverAtras = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
        scannerRef.current = null;
      }
    } catch (e) { console.warn("Error deteniendo cámara:", e); }
    if (direccion) {
      setDireccion(null); setQrData(''); setPinSupervisor(''); setPinEmpleadoManual(''); setLecturaLista(false);
    } else if (modo !== 'menu') { 
      setModo('menu'); 
    }
  };

  const resetearTodo = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
        scannerRef.current = null;
      }
    } catch (e) { console.warn(e); }
    setQrData(''); setPinSupervisor(''); setPinEmpleadoManual(''); setModo('menu'); setDireccion(null); setLecturaLista(false);
  };

  // Lógica USB corregida para procesar Base64
  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (buffer.trim()) {
          setQrData(buffer.trim());
          setLecturaLista(true);
          setTimeout(() => pinRef.current?.focus(), 100);
        }
        buffer = "";
      } else if (e.key.length === 1) { buffer += e.key; }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  // Lógica Cámara corregida
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
              setLecturaLista(true);
              scanner.stop().then(() => { scannerRef.current = null; });
              setTimeout(() => pinRef.current?.focus(), 200);
            }, 
            () => {}
          );
        } catch (err) { console.error("Error cámara:", err); }
      };
      setTimeout(iniciarCamara, 300); 
    }
    return () => { if (scannerRef.current?.isScanning) scannerRef.current.stop().catch(() => {}); };
  }, [modo, direccion, qrData]);

  const registrarAcceso = async () => {
    if (!qrData || !pinSupervisor || animar) return;
    setAnimar(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        let docIdOrEmail = qrData.trim();
        
        // Decodificación de seguridad (Base64)
        try {
          const decoded = atob(docIdOrEmail).split('|');
          if (decoded.length === 2) {
            docIdOrEmail = decoded[0];
            if (Date.now() - parseInt(decoded[1]) > TIEMPO_MAX_TOKEN_MS) throw new Error("TOKEN EXPIRADO");
          }
        } catch (e) {}

        const { data: emp } = await supabase
          .from('empleados')
          .select('*')
          .or(`documento_id.eq.${docIdOrEmail},email.eq.${docIdOrEmail}`)
          .maybeSingle();

        if (!emp) throw new Error("Empleado no encontrado");

        if (modo === 'manual') {
          if (emp.pin_seguridad !== pinEmpleadoManual) throw new Error("PIN del Empleado incorrecto");
        }

        const { data: sup } = await supabase
          .from('empleados')
          .select('nombre, rol')
          .eq('pin_seguridad', pinSupervisor)
          .in('rol', ['supervisor', 'admin', 'administrador'])
          .maybeSingle();

        if (!sup) throw new Error("Autorización denegada: PIN de Administrador inválido");

        await supabase.from('empleados').update({ en_almacen: direccion === 'entrada' }).eq('id', emp.id);
        
        await supabase.from('registros_acceso').insert([{
          empleado_id: emp.id,
          nombre_empleado: emp.nombre,
          tipo_movimiento: direccion,
          detalles: `ADMINISTRADOR - Autoriza: ${sup.nombre} (${modo})`
        }]);

        alert(`✅ Operación Exitosa: ${emp.nombre}`);
        resetearTodo();
      } catch (err: any) { 
        alert(`❌ ${err.message}`); 
        setPinSupervisor('');
        if (modo === 'manual') setPinEmpleadoManual('');
      } finally { 
        setAnimar(false); 
      }
    }, () => alert("GPS Obligatorio"));
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white relative">
      <style jsx global>{`
        @keyframes laser { 0% { top: 0%; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-laser { animation: laser 2s infinite linear; }
        .animate-blink { animation: blink 1s infinite ease-in-out; }
      `}</style>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl z-10">
        <h2 className="text-2xl font-black uppercase italic text-blue-500 mb-6 text-center italic tracking-tighter">Acceso de Supervisión</h2>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black border border-white/5 hover:border-blue-500 transition-all uppercase tracking-widest">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black border border-white/5 hover:border-emerald-500 transition-all uppercase tracking-widest">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="p-8 bg-[#1e293b] rounded-[30px] font-black border border-white/5 hover:border-amber-400 transition-all uppercase tracking-widest">🖋️ Entrada Manual</button>
            <button onClick={() => router.push('/')} className="mt-4 text-slate-500 font-bold uppercase text-[10px] text-center">← Volver al inicio</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-xl">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl shadow-xl">SALIDA</button>
            <button onClick={volverAtras} className="mt-4 text-slate-500 font-bold uppercase text-center">← Volver</button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Aviso Amarillo Parpadeante para Modo Manual */}
            {modo === 'manual' && !lecturaLista && (
              <div className="bg-amber-400/20 border border-amber-400 p-4 rounded-2xl animate-blink">
                <p className="text-amber-400 font-black text-center text-xs uppercase leading-tight">
                  ⚠️ Solo algún administrador podrá dar permisos de acceso en esta opción
                </p>
              </div>
            )}

            <div className={`bg-[#050a14] p-6 rounded-[30px] border transition-all duration-500 ${lecturaLista ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'border-white/5'} relative h-32 flex items-center justify-center`}>
              {!lecturaLista ? (
                <>
                  {modo === 'manual' ? (
                    <input 
                      type="text" autoFocus className="bg-transparent border-b border-blue-500 text-center text-xl font-bold outline-none w-full" 
                      placeholder="Correo o Documento" value={qrData} onChange={(e) => setQrData(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setLecturaLista(true); }}
                    />
                  ) : (
                    <div className="text-center">
                      <p className="text-[10px] font-black text-slate-500 uppercase animate-blink">Esperando Lectura</p>
                      <div className="absolute inset-x-0 h-[2px] bg-red-600 shadow-[0_0_10px_red] animate-laser"></div>
                      {modo === 'camara' && <div id="reader" className="w-full h-full rounded-2xl overflow-hidden mt-2"></div>}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center">
                  <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-2">✔</div>
                  <p className="text-emerald-500 font-black text-[9px] uppercase">Identificado</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {modo === 'manual' && lecturaLista && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase text-center">1. PIN de Empleado</p>
                  <input 
                    type="password" placeholder="PIN Personal"
                    className="w-full py-4 bg-[#050a14] rounded-2xl text-center text-2xl font-black border border-white/5 focus:border-blue-500 outline-none"
                    value={pinEmpleadoManual} onChange={(e) => setPinEmpleadoManual(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-500 uppercase text-center">
                  {modo === 'manual' ? '2. PIN Administrador' : 'PIN Supervisor'}
                </p>
                <input 
                  ref={pinRef} type="password" placeholder="PIN"
                  className="w-full py-4 bg-[#050a14] rounded-2xl text-center text-2xl font-black border border-white/5 focus:border-blue-500 outline-none"
                  value={pinSupervisor} onChange={(e) => setPinSupervisor(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') registrarAcceso(); }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <button onClick={registrarAcceso} disabled={animar || !qrData || !pinSupervisor}
                className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl uppercase shadow-lg disabled:opacity-30">
                {animar ? 'PROCESANDO...' : 'Confirmar'}
              </button>
              <button onClick={volverAtras} className="text-slate-600 font-bold uppercase text-[9px] text-center">✕ Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}