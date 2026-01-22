'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 CONFIGURACIÓN (Manteniendo tus constantes)
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
  const router = useRouter();

  const resetearTodo = async () => {
    if (scannerRef.current) {
      if (scannerRef.current.isScanning) await scannerRef.current.stop();
      scannerRef.current = null;
    }
    setQrData(''); 
    setPinSupervisor(''); 
    setModo('menu'); 
    setDireccion(null);
  };

  // 🛡️ PROCESADOR DE ID (Lógica de limpieza + Decodificación de tu archivo)
  const procesarIdentificador = (raw: string) => {
    // 1. Limpieza de ruidos del escáner (caracteres ASCII invisibles)
    let limpio = raw.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
    
    // 2. Intentar decodificar según tu lógica de Token | Timestamp
    try {
      const decoded = atob(limpio).split('|');
      if (decoded.length >= 2) {
        const timestamp = parseInt(decoded[1]);
        if (Date.now() - timestamp > TIEMPO_MAX_TOKEN_MS) {
          throw new Error("TOKEN EXPIRADO");
        }
        return decoded[0].trim().toUpperCase(); // Retorna el ID del token
      }
    } catch (e) {
      // Si no es Base64 o falla, devolvemos el ID limpio tal cual (para escáneres USB planos)
    }
    return limpio.toUpperCase();
  };

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
      setTimeout(iniciarCamara, 500); 
    }
    return () => { if (scannerRef.current?.isScanning) scannerRef.current.stop(); };
  }, [modo, direccion, qrData]);

  const registrarAcceso = async () => {
    if (!qrData || !pinSupervisor || !direccion) return;
    setAnimar(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        // Usamos el procesador para limpiar el ID antes de ir a Supabase
        const docId = procesarIdentificador(qrData);

        // 1. Buscar al empleado
        const { data: emp } = await supabase.from('empleados').select('*').eq('documento_id', docId).maybeSingle();
        if (!emp) throw new Error(`Empleado [${docId}] no registrado`);

        // 2. Validar sesión del supervisor (tu lógica original)
        const session = JSON.parse(localStorage.getItem('user_session') || '{}');
        if (!session.id) throw new Error("Sesión de supervisor no encontrada");

        const { data: sup } = await supabase.from('empleados')
          .select('*')
          .eq('id', session.id)
          .eq('pin_seguridad', pinSupervisor)
          .maybeSingle();

        if (!sup) throw new Error("PIN de Supervisor Incorrecto");

        // 3. ACTUALIZACIÓN DE ESTADO (Corrección falla Gestión de Personal)
        const { error: updateError } = await supabase
          .from('empleados')
          .update({ en_almacen: direccion === 'entrada' })
          .eq('id', emp.id);
        
        if (updateError) throw new Error("Fallo al actualizar presencia en base de datos");
        
        // 4. REGISTRO EN HISTORIAL
        await supabase.from('registros_acceso').insert([{
          empleado_id: emp.id,
          nombre_empleado: emp.nombre,
          tipo_movimiento: direccion,
          detalles: `SUPERVISOR: ${sup.nombre} (${modo})`
        }]);

        alert(`✅ Registro Exitoso: ${emp.nombre} está ahora ${direccion === 'entrada' ? 'PRESENTE' : 'AUSENTE'}`);
        resetearTodo();

      } catch (err: any) { 
        alert(`❌ ERROR: ${err.message}`); 
      } finally { 
        setAnimar(false); 
      }
    }, () => {
      alert("Error: El GPS es obligatorio para registrar el acceso.");
      setAnimar(false);
    });
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative">
      
      {modo !== 'menu' && (
        <div className="absolute top-8 left-8">
          <button onClick={resetearTodo} className="bg-[#1e293b] px-6 py-3 rounded-2xl font-black text-[10px] uppercase border border-white/5 tracking-widest hover:bg-red-600 transition-all">
            ← Volver al Menú
          </button>
        </div>
      )}

      {modo === 'menu' && (
        <div className="absolute top-8 left-8">
          <button onClick={() => router.push('/')} className="bg-blue-600/20 text-blue-400 px-6 py-3 rounded-2xl font-black text-[10px] uppercase border border-blue-500/20 tracking-widest hover:bg-blue-600 hover:text-white transition-all">
            🏠 Inicio
          </button>
        </div>
      )}

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl">
        <h2 className="text-2xl font-black uppercase italic text-blue-500 mb-8 text-center tracking-tighter">Terminal Supervisor</h2>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-blue-500 transition-all">🔌 ESCÁNER USB / ÓPTICO</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-emerald-500 transition-all">📱 CÁMARA MÓVIL (QR)</button>
            <button onClick={() => setModo('manual')} className="p-8 bg-[#050a14] rounded-[30px] font-black text-lg border border-white/10 hover:bg-slate-800 transition-all text-slate-400">🖋️ ENTRADA MANUAL</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-xl transition-transform active:scale-95">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl shadow-xl transition-transform active:scale-95">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-[#050a14] p-6 rounded-[30px] border border-white/5">
              <p className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest text-center">Identificación</p>
              {modo === 'camara' && !qrData ? (
                <div id="reader" className="w-full aspect-square overflow-hidden rounded-2xl"></div>
              ) : (
                <input 
                  type="text" 
                  className="w-full bg-transparent text-center text-xl font-bold text-blue-400 outline-none uppercase"
                  value={qrData}
                  placeholder="ID / CÓDIGO"
                  onChange={(e) => setQrData(e.target.value)}
                  readOnly={modo === 'usb'}
                />
              )}
            </div>

            <input 
              type="password" 
              placeholder="PIN AUTORIZACIÓN" 
              className="w-full py-6 bg-[#050a14] rounded-[30px] text-center text-3xl font-black border-2 border-blue-500/20 focus:border-blue-500 outline-none"
              value={pinSupervisor}
              onChange={(e) => setPinSupervisor(e.target.value)}
            />

            <button 
              onClick={registrarAcceso} 
              disabled={animar || !qrData || !pinSupervisor}
              className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl uppercase italic shadow-lg disabled:opacity-50"
            >
              {animar ? 'PROCESANDO...' : 'CONFIRMAR OPERACIÓN'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}