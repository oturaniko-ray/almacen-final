'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 CONSTANTES
const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 80; 
const TIEMPO_MAX_TOKEN_MS = 120000;

export default function SupervisorPage() {
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pinEmpleadoManual, setPinEmpleadoManual] = useState('');
  const [pinSupervisor, setPinSupervisor] = useState('');
  const [animar, setAnimar] = useState(false);
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
      setDireccion(null); setQrData(''); setPinSupervisor(''); setPinEmpleadoManual('');
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
    setQrData(''); setPinSupervisor(''); setPinEmpleadoManual(''); setModo('menu'); setDireccion(null);
  };

  const reintentarLectura = () => {
    setQrData('');
    setPinSupervisor('');
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
          await scanner.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: 250 }, 
            (text) => {
              setQrData(text);
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
        
        // 1. BUSCAR EMPLEADO
        const { data: emp } = await supabase
          .from('empleados')
          .select('*')
          .or(`documento_id.eq.${docIdOrEmail},email.eq.${docIdOrEmail}`)
          .maybeSingle();

        if (!emp) throw new Error("Empleado no encontrado");

        // 2. VALIDAR PIN EMPLEADO SI ES MANUAL
        if (modo === 'manual') {
          if (emp.pin_seguridad !== pinEmpleadoManual) throw new Error("PIN del Empleado incorrecto");
        }

        // 3. VALIDAR PIN SUPERVISOR Y OBTENER SU NOMBRE
        const { data: sup } = await supabase
          .from('empleados')
          .select('nombre, rol')
          .eq('pin_seguridad', pinSupervisor)
          .in('rol', ['supervisor', 'admin', 'administrador'])
          .maybeSingle();

        if (!sup) throw new Error("Autorización denegada: PIN de Supervisor inválido");

        // 4. ACTUALIZAR ESTADO
        await supabase.from('empleados').update({ en_almacen: direccion === 'entrada' }).eq('id', emp.id);
        
        // 5. REGISTRAR CON NOMBRE DEL SUPERVISOR Y ETIQUETA ADMINISTRADOR
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
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
      
      <style jsx global>{`
        @keyframes laser { 0% { top: 0%; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes checkPop { 0% { transform: scale(0); } 80% { transform: scale(1.2); } 100% { transform: scale(1); } }
        .animate-laser { animation: laser 2s infinite linear; }
        .animate-blink { animation: blink 1s infinite ease-in-out; }
        .animate-check { animation: checkPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      `}</style>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl relative z-10">
        <h2 className="text-2xl font-black uppercase italic text-blue-500 mb-8 text-center tracking-tighter">Lectura del QR</h2>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-blue-500 transition-all uppercase tracking-widest">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-emerald-500 transition-all uppercase tracking-widest">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-slate-400 transition-all uppercase tracking-widest">🖋️ Entrada Manual</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-xl">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl shadow-xl">SALIDA</button>
            <button onClick={volverAtras} className="mt-4 text-slate-500 font-bold uppercase text-[10px] tracking-widest hover:text-white transition-colors">← Cambiar Modo</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`bg-[#050a14] p-6 rounded-[30px] border transition-all duration-500 ${qrData ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'border-white/5'} relative overflow-hidden h-32 flex flex-col items-center justify-center`}>
              {!qrData ? (
                <>
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest animate-blink">Esperando Lectura</p>
                  {(modo === 'usb' || modo === 'camara') && <div className="absolute inset-x-0 h-[2px] bg-red-600 shadow-[0_0_10px_red] animate-laser z-20"></div>}
                  {modo === 'camara' && <div id="reader" className="w-full h-full rounded-2xl overflow-hidden"></div>}
                  {modo === 'manual' && (
                    <input 
                      type="text" 
                      autoFocus 
                      maxLength={20}
                      className="bg-transparent border-b border-blue-500/50 text-center text-xl font-bold outline-none w-full px-4" 
                      placeholder="ID o Correo" 
                      value={qrData} 
                      onChange={(e) => setQrData(e.target.value)} 
                    />
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center animate-check">
                  <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center mb-1 shadow-[0_0_15px_#10b981]">
                    <span className="text-white text-xl">✔</span>
                  </div>
                  <p className="text-emerald-500 font-black text-[9px] uppercase tracking-[0.2em]">Identificado</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {modo === 'manual' && qrData && (
                <div className="space-y-2 text-center">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">1. PIN de Empleado</p>
                  <input 
                    type="password" 
                    placeholder="PIN Personal"
                    className="w-full py-4 bg-[#050a14] rounded-[25px] text-center text-2xl font-black border border-white/5 focus:border-blue-500 outline-none transition-all"
                    value={pinEmpleadoManual}
                    onChange={(e) => setPinEmpleadoManual(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2 text-center">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {modo === 'manual' ? '2. PIN Autorización Supervisor' : 'Confirmación de Supervisor'}
                </p>
                <input 
                  ref={pinRef}
                  type="password" 
                  placeholder="PIN"
                  className="w-full py-5 bg-[#050a14] rounded-[25px] text-center text-3xl font-black border-2 border-blue-500/10 focus:border-blue-500 transition-all outline-none"
                  value={pinSupervisor}
                  onChange={(e) => setPinSupervisor(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') registrarAcceso(); }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <button 
                onClick={registrarAcceso} 
                disabled={animar || !qrData || !pinSupervisor || (modo === 'manual' && !pinEmpleadoManual)}
                className={`w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl uppercase italic shadow-lg disabled:opacity-30 transition-all ${qrData && pinSupervisor && !animar ? 'animate-blink' : ''}`}
              >
                {animar ? 'PROCESANDO...' : 'Confirmar Entrada/Salida'}
              </button>
              
              <button onClick={volverAtras} className="text-slate-600 font-bold uppercase text-[9px] tracking-[0.3em] hover:text-white transition-colors">
                ✕ Cancelar Operación
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
