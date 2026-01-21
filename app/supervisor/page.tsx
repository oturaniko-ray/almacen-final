'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 80; 

export default function SupervisorPage() {
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pinEmpleadoManual, setPinEmpleadoManual] = useState('');
  const [pinAdminManual, setPinAdminManual] = useState('');
  const [pinSupervisor, setPinSupervisor] = useState('');
  const [animar, setAnimar] = useState(false);
  const [mostrarWarning, setMostrarWarning] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  // Limpieza total y retorno al menú de dirección
  const volverADireccionYLimpiar = async () => {
    if (scannerRef.current?.isScanning) await scannerRef.current.stop();
    setQrData('');
    setPinSupervisor('');
    setPinEmpleadoManual('');
    setPinAdminManual('');
    setAnimar(false);
    // Mantiene el modo (USB/Cámara/Manual) pero pide elegir Entrada/Salida de nuevo
    setDireccion(null); 
  };

  const volverAtras = async () => {
    if (mostrarWarning) {
      setMostrarWarning(false);
      setModo('menu');
    } else if (direccion) {
      volverADireccionYLimpiar();
    } else if (modo === 'menu') {
      router.push('/');
    } else {
      setModo('menu');
    }
  };

  // Escucha de tecla Enter para Warning
  useEffect(() => {
    if (!mostrarWarning) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Enter') setMostrarWarning(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [mostrarWarning]);

  // Lógica Escáner USB
  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData || mostrarWarning) return;
    let buffer = "";
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (buffer.trim()) {
          setQrData(buffer.trim());
          setTimeout(() => pinRef.current?.focus(), 100);
        }
        buffer = "";
      } else if (e.key.length === 1) { buffer += e.key; }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [modo, direccion, qrData, mostrarWarning]);

  const registrarAcceso = async () => {
    const esManual = modo === 'manual';
    const pinAValidar = esManual ? pinAdminManual : pinSupervisor;
    const idLimpio = qrData.trim().toUpperCase(); // Normalización para evitar el error de registro

    if (!idLimpio || !pinAValidar || animar) return;
    setAnimar(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        // Corrección de búsqueda: Trim y UpperCase para asegurar match
        const { data: emp, error: empErr } = await supabase
          .from('empleados')
          .select('*')
          .eq('documento_id', idLimpio)
          .maybeSingle();

        if (!emp) throw new Error(`Empleado con ID ${idLimpio} no encontrado`);
        if (esManual && emp.pin_seguridad !== pinEmpleadoManual) throw new Error("PIN de empleado incorrecto");

        const { data: autorizador } = await supabase.from('empleados').select('*').eq('pin_seguridad', pinAValidar).maybeSingle();
        if (!autorizador) throw new Error("PIN de autorización incorrecto");
        if (esManual && autorizador.rol !== 'administrador') throw new Error("Acceso manual requiere Administrador");

        await supabase.from('empleados').update({ en_almacen: direccion === 'entrada' }).eq('id', emp.id);
        
        await supabase.from('registros_acceso').insert([{
          empleado_id: emp.id,
          nombre_empleado: emp.nombre,
          tipo_movimiento: direccion,
          detalles: esManual ? `ACCESO MANUAL - Admin: ${autorizador.nombre}` : `SUPERVISOR: ${autorizador.nombre} (${modo})`
        }]);

        alert(`OPERACIÓN EXITOSA: ${emp.nombre}`);
        volverADireccionYLimpiar();
      } catch (err: any) {
        alert(`ERROR: ${err.message}`);
        volverADireccionYLimpiar(); // Limpia buffer incluso en error
      }
    }, () => {
      alert("GPS Requerido");
      setAnimar(false);
    });
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative">
      <style jsx global>{`
        @keyframes laser { 0% { top: 0%; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes warningBlink { 0%, 100% { border-color: #facc15; background-color: rgba(250,204,21,0.2); } 50% { border-color: transparent; background-color: transparent; } }
        @keyframes textBlink { 0%, 100% { color: #facc15; } 50% { color: #854d0e; } }
      `}</style>

      {mostrarWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <div className="bg-[#1a1a1a] p-10 rounded-[40px] border-8 animate-[warningBlink_0.8s_infinite] max-w-md text-center">
            <p className="font-black text-2xl uppercase italic animate-[textBlink_0.8s_infinite]">
              Acceso Manual:<br/>Requiere Validación de Administrador
            </p>
            <div className="mt-8 py-2 px-6 bg-yellow-400 text-black rounded-full font-black text-[10px]">PRESIONE ENTER</div>
          </div>
        </div>
      )}

      <button onClick={volverAtras} className="absolute top-8 left-8 bg-[#1e293b] px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest z-50 hover:bg-red-600 transition-all">
        ← Volver
      </button>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl">
        <h2 className="text-2xl font-black uppercase italic text-blue-500 mb-8 text-center">Gestión de Acceso</h2>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-blue-500 transition-all">🔌 ESCÁNER USB</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-emerald-500 transition-all">📱 CÁMARA QR</button>
            <button onClick={() => { setModo('manual'); setMostrarWarning(true); }} className="p-8 bg-[#050a14] rounded-[30px] font-black text-[12px] border border-white/10 text-slate-400 uppercase tracking-widest italic">🖋️ Entrada Manual</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-xl active:scale-95 transition-transform">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl shadow-xl active:scale-95 transition-transform">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`bg-[#050a14] p-6 rounded-[30px] border transition-all ${qrData ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'border-white/5'} h-32 flex flex-col items-center justify-center overflow-hidden relative`}>
              {!qrData ? (
                <>
                  {modo !== 'manual' && <div className="absolute inset-x-0 h-[3px] bg-red-600 shadow-[0_0_15px_red] animate-[laser_2s_infinite_linear]"></div>}
                  {modo === 'manual' ? (
                    <input 
                      type="text" 
                      placeholder="ID EMPLEADO (MÁX 15)" 
                      maxLength={15}
                      className="w-full bg-transparent text-center text-xl font-bold text-blue-400 outline-none uppercase" 
                      value={qrData} 
                      onChange={(e) => setQrData(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))} 
                    />
                  ) : <p className="text-blue-500 font-black animate-pulse uppercase tracking-tighter">Esperando Lectura...</p>}
                </>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center mb-1">✔</div>
                  <p className="text-emerald-500 font-black text-[10px] uppercase">ID Detectado</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {modo === 'manual' && (
                <input type="password" placeholder="PIN EMPLEADO" className="w-full py-4 bg-[#050a14] rounded-[25px] text-center text-xl border border-white/10 outline-none" value={pinEmpleadoManual} onChange={(e) => setPinEmpleadoManual(e.target.value)} />
              )}
              <input ref={pinRef} type="password" placeholder={modo === 'manual' ? "PIN ADMINISTRADOR" : "PIN SUPERVISOR"} className="w-full py-6 bg-[#050a14] rounded-[30px] text-center text-4xl font-black border-2 border-blue-500/20 focus:border-blue-500 outline-none" value={modo === 'manual' ? pinAdminManual : pinSupervisor} onChange={(e) => modo === 'manual' ? setPinAdminManual(e.target.value) : setPinSupervisor(e.target.value)} />
            </div>

            <button ref={confirmBtnRef} onClick={registrarAcceso} disabled={animar || !qrData || (modo === 'manual' ? !pinAdminManual : !pinSupervisor)} className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl uppercase italic shadow-lg disabled:opacity-50">
              {animar ? 'VERIFICANDO...' : 'CONFIRMAR ACCESO'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}