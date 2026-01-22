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
  const [pinAdminManual, setPinAdminManual] = useState('');
  const [pinSupervisor, setPinSupervisor] = useState('');
  const [animar, setAnimar] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const resetearTodo = async () => {
    if (scannerRef.current?.isScanning) await scannerRef.current.stop();
    setQrData(''); setPinSupervisor(''); setPinEmpleadoManual(''); setPinAdminManual(''); setModo('menu'); setDireccion(null);
  };

  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (buffer.trim()) setQrData(buffer.trim());
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
          }, () => {});
        } catch (err) { console.error(err); }
      };
      setTimeout(iniciarCamara, 500); 
    }
    return () => { if (scannerRef.current?.isScanning) scannerRef.current.stop(); };
  }, [modo, direccion, qrData]);

  const registrarAcceso = async () => {
    const dirActual = direccion;
    if (!qrData || !dirActual || animar) return;

    setAnimar(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        let docId = qrData;

        // 🛡️ RUTINA DE TOKEN (Solo si no es manual)
        if (modo !== 'manual') {
          try {
            const decoded = atob(qrData).split('|');
            docId = decoded[0].trim().toUpperCase();
            const timestamp = parseInt(decoded[1]);
            // Validamos tiempo para seguridad de ubicación
            if (Date.now() - timestamp > TIEMPO_MAX_TOKEN_MS) throw new Error("TOKEN EXPIRADO");
          } catch (e: any) {
            throw new Error(e.message === "TOKEN EXPIRADO" ? e.message : "CÓDIGO QR NO VÁLIDO");
          }
        }

        // 1. BUSCAR EMPLEADO
        const { data: emp, error: empError } = await supabase
          .from('empleados')
          .select('*')
          .eq('documento_id', docId)
          .maybeSingle();

        if (empError) throw new Error("Error de conexión con la base de datos");
        if (!emp) throw new Error(`Empleado [${docId}] no registrado`);

        // 2. VALIDAR PIN DE AUTORIZACIÓN (Supervisor o Admin si es manual)
        const pinAValidar = modo === 'manual' ? pinAdminManual : pinSupervisor;
        const { data: autorizador } = await supabase
          .from('empleados')
          .select('*')
          .eq('pin_seguridad', pinAValidar)
          .maybeSingle();

        if (!autorizador) throw new Error("PIN de autorización incorrecto");
        if (modo === 'manual' && autorizador.rol !== 'administrador') throw new Error("Solo un administrador puede autorizar entrada manual");

        // 3. ACTUALIZAR ESTADO EN GESTIÓN DE PERSONAL
        const { error: updateError } = await supabase
          .from('empleados')
          .update({ en_almacen: dirActual === 'entrada' })
          .eq('id', emp.id);

        if (updateError) throw new Error("Error al actualizar estado de presencia");

        // 4. REGISTRAR EN HISTORIAL
        await supabase.from('registros_acceso').insert([{
          empleado_id: emp.id,
          nombre_empleado: emp.nombre,
          tipo_movimiento: dirActual,
          detalles: modo === 'manual' ? `MANUAL - Autoriza: ${autorizador.nombre}` : `SUPERVISOR: ${autorizador.nombre}`
        }]);

        alert(`✅ ${dirActual.toUpperCase()} REGISTRADA: ${emp.nombre}`);
        resetearTodo();

      } catch (err: any) { 
        alert(`❌ ERROR: ${err.message}`); 
      } finally { 
        setAnimar(false); 
      }
    }, () => {
      alert("Error: GPS es obligatorio para validar la ubicación");
      setAnimar(false);
    });
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative">
      {modo !== 'menu' && (
        <button onClick={() => setModo('menu')} className="absolute top-8 left-8 bg-[#1e293b] px-6 py-3 rounded-2xl font-black text-[10px] uppercase border border-white/5 tracking-widest">
          ← Volver
        </button>
      )}

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl">
        <h2 className="text-2xl font-black uppercase italic text-blue-500 mb-8 text-center tracking-tighter">Terminal Supervisor</h2>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-blue-500 transition-all">🔌 ESCÁNER USB</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-emerald-500 transition-all">📱 CÁMARA MÓVIL</button>
            <button onClick={() => setModo('manual')} className="p-8 bg-[#050a14] rounded-[30px] font-black text-lg border border-white/10 text-slate-400">🖋️ MANUAL</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl active:scale-95 transition-all">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl active:scale-95 transition-all">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`bg-[#050a14] p-6 rounded-[30px] border ${qrData ? 'border-emerald-500' : 'border-white/5'} h-32 flex flex-col items-center justify-center transition-all`}>
              {!qrData ? (
                modo === 'camara' ? <div id="reader" className="w-full h-full"></div> : <p className="text-blue-400 font-black animate-pulse uppercase text-[10px]">Esperando Lectura...</p>
              ) : (
                <div className="text-center text-emerald-500 font-black">✔ Lectura capturada</div>
              )}
            </div>

            <div className="space-y-4">
              {modo === 'manual' && (
                <input type="text" placeholder="DOCUMENTO ID" className="w-full py-4 bg-[#050a14] rounded-[25px] text-center text-xl border border-white/10 outline-none" value={qrData} onChange={(e) => setQrData(e.target.value)} />
              )}
              <input 
                type="password" 
                placeholder={modo === 'manual' ? "PIN ADMINISTRADOR" : "PIN SUPERVISOR"} 
                className="w-full py-6 bg-[#050a14] rounded-[30px] text-center text-3xl font-black border-2 border-blue-500/20 focus:border-blue-500 outline-none transition-all" 
                value={modo === 'manual' ? pinAdminManual : pinSupervisor} 
                onChange={(e) => modo === 'manual' ? setPinAdminManual(e.target.value) : setPinSupervisor(e.target.value)}
              />
            </div>

            <button onClick={registrarAcceso} disabled={animar || !qrData} className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl uppercase italic shadow-lg">
              {animar ? 'PROCESANDO...' : 'Confirmar Operación'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}