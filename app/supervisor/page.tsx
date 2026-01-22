'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 CONSTANTES DE CONFIGURACIÓN
const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 80; 
const TIEMPO_MAX_TOKEN_MS = 120000;
const TIEMPO_ESPERA_LECTURA = 60000; // 1 Minuto

export default function SupervisorPage() {
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pinEmpleadoManual, setPinEmpleadoManual] = useState('');
  const [pinSupervisor, setPinSupervisor] = useState('');
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = useState(false);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinSupRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // --- GESTIÓN DE TIEMPO DE ESPERA (1 MINUTO) ---
  const iniciarTemporizador = () => {
    limpiarTemporizador();
    timeoutRef.current = setTimeout(() => {
      alert("Tiempo de espera agotado");
      volverAtras();
    }, TIEMPO_ESPERA_LECTURA);
  };

  const limpiarTemporizador = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const volverAtras = async () => {
    limpiarTemporizador();
    try { if (scannerRef.current?.isScanning) await scannerRef.current.stop(); } catch (e) {}
    setQrData(''); setPinEmpleadoManual(''); setPinSupervisor(''); setLecturaLista(false);
    if (direccion) setDireccion(null); else setModo('menu');
  };

  // --- LÓGICA DE GEOLOCALIZACIÓN ---
  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // --- ESCÁNER USB ---
  useEffect(() => {
    if (modo !== 'usb' || !direccion || lecturaLista) return;
    iniciarTemporizador();
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (buffer.trim()) {
          limpiarTemporizador();
          setQrData(buffer.trim());
          setLecturaLista(true);
        }
        buffer = "";
      } else if (e.key.length === 1) buffer += e.key;
    };
    window.addEventListener('keydown', handleKey);
    return () => { window.removeEventListener('keydown', handleKey); limpiarTemporizador(); };
  }, [modo, direccion, lecturaLista]);

  // --- CÁMARA MÓVIL ---
  useEffect(() => {
    if (modo === 'camara' && direccion && !lecturaLista) {
      iniciarTemporizador();
      const iniciarCamara = async () => {
        try {
          const scanner = new Html5Qrcode("reader");
          scannerRef.current = scanner;
          await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, 
            (text) => {
              limpiarTemporizador();
              setQrData(text);
              setLecturaLista(true);
              scanner.stop();
            }, () => {});
        } catch (err) { console.error(err); }
      };
      setTimeout(iniciarCamara, 300);
    }
    return () => { limpiarTemporizador(); };
  }, [modo, direccion, lecturaLista]);

  // --- REGISTRO FINAL ---
  const registrarAcceso = async () => {
    if (!qrData || !pinSupervisor || animar) return;
    if (modo === 'manual' && !pinEmpleadoManual) return;
    setAnimar(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const distancia = calcularDistancia(pos.coords.latitude, pos.coords.longitude, ALMACEN_LAT, ALMACEN_LON);
      
      try {
        if (distancia > RADIO_MAXIMO_METROS) throw new Error(`Fuera de rango (${Math.round(distancia)}m)`);

        let docId = qrData.trim();
        if (modo !== 'manual') {
          try {
            const decoded = atob(docId).split('|');
            if (decoded.length === 2) {
              docId = decoded[0];
              if (Date.now() - parseInt(decoded[1]) > TIEMPO_MAX_TOKEN_MS) throw new Error("QR Expirado");
            }
          } catch (e) {}
        }

        // 1. Buscar Empleado
        const { data: emp } = await supabase.from('empleados').select('*')
          .or(`documento_id.eq.${docId},email.eq.${docId}`).maybeSingle();

        if (!emp) throw new Error("Empleado no encontrado");

        // 2. Validación de PIN (Empleado solo en MANUAL)
        if (modo === 'manual' && emp.pin_seguridad !== pinEmpleadoManual) {
          throw new Error("PIN del Empleado incorrecto");
        }

        // 3. Validar Supervisor
        const { data: sup } = await supabase.from('empleados').select('nombre, rol')
          .eq('pin_seguridad', pinSupervisor).in('rol', ['supervisor', 'admin', 'administrador']).maybeSingle();

        if (!sup) throw new Error("Autorización denegada: PIN de Supervisor inválido");

        // 4. Ejecutar cambios
        await supabase.from('empleados').update({ en_almacen: direccion === 'entrada' }).eq('id', emp.id);
        await supabase.from('registros_acceso').insert([{
          empleado_id: emp.id, nombre_empleado: emp.nombre, tipo_movimiento: direccion,
          detalles: `MODO: ${modo.toUpperCase()} | Autoriza: ${sup.nombre}`
        }]);

        alert(`✅ ${direccion?.toUpperCase()} EXITOSA: ${emp.nombre}`);
        volverAtras();
      } catch (err: any) {
        alert(`❌ ${err.message}`);
        setPinSupervisor('');
      } finally { setAnimar(false); }
    }, () => { alert("GPS requerido para validar acceso"); setAnimar(false); });
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative">
      <style jsx global>{`
        @keyframes laser { 0% { top: 0%; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
        .animate-laser { animation: laser 2s infinite linear; }
        .animate-blink { animation: blink 1s infinite alternate; }
        @keyframes blink { from { opacity: 1; } to { opacity: 0.3; } }
      `}</style>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl">
        <h2 className="text-2xl font-black uppercase italic text-blue-500 mb-6 text-center tracking-tighter">Toma de Datos QR</h2>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black border border-white/5 hover:border-blue-500 transition-all uppercase">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black border border-white/5 hover:border-emerald-500 transition-all uppercase">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="p-8 bg-[#1e293b] rounded-[30px] font-black border border-white/5 hover:border-amber-400 transition-all uppercase">🖋️ Entrada Manual</button>
            <button onClick={() => router.push('/')} className="mt-4 text-slate-500 font-bold uppercase text-[10px] text-center tracking-widest hover:text-white">← Volver al inicio</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6 text-center">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Seleccione tipo de registro ({modo.toUpperCase()})</p>
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-xl hover:scale-[1.02] transition-transform">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl shadow-xl hover:scale-[1.02] transition-transform">SALIDA</button>
            <button onClick={volverAtras} className="mt-4 text-slate-500 font-bold uppercase hover:text-white transition-colors">← Cancelar modo</button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* --- ZONA DE IDENTIFICACIÓN --- */}
            <div className={`bg-[#050a14] p-6 rounded-[30px] border transition-all ${lecturaLista || modo === 'manual' ? 'border-emerald-500' : 'border-white/5'} relative h-40 flex items-center justify-center overflow-hidden`}>
              {modo === 'manual' ? (
                <div className="w-full text-center">
                  <p className="text-[10px] font-black text-blue-500 uppercase mb-2">Documento o Email</p>
                  <input type="text" autoFocus className="bg-transparent border-b-2 border-blue-500 text-center text-xl font-bold outline-none w-full" value={qrData} onChange={(e) => setQrData(e.target.value)} />
                </div>
              ) : !lecturaLista ? (
                <div className="text-center w-full h-full flex flex-col items-center justify-center">
                  <p className="text-[10px] font-black text-slate-500 animate-blink uppercase">Esperando Escaneo...</p>
                  <div className="absolute inset-x-0 h-[2px] bg-red-600 shadow-[0_0_10px_red] animate-laser"></div>
                  {modo === 'camara' && <div id="reader" className="w-full h-full mt-2 rounded-xl"></div>}
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-emerald-500 font-black">QR CAPTURADO ✔</p>
                  <p className="text-[10px] text-slate-500 mt-2 truncate max-w-[200px]">{qrData}</p>
                </div>
              )}
            </div>

            {/* --- CAMPOS DE VALIDACIÓN --- */}
            {(lecturaLista || modo === 'manual') && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                
                {/* PIN EMPLEADO: SOLO EN MODO MANUAL */}
                {modo === 'manual' && (
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase text-center mb-1">1. PIN del Empleado</p>
                    <input type="password" placeholder="PIN Personal" className="w-full py-4 bg-[#050a14] rounded-2xl text-center text-2xl font-black border border-white/5 outline-none focus:border-blue-500" value={pinEmpleadoManual} onChange={(e) => setPinEmpleadoManual(e.target.value)} />
                  </div>
                )}

                {/* PIN SUPERVISOR: SIEMPRE REQUERIDO */}
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase text-center mb-1">
                    {modo === 'manual' ? '2. PIN Autorización Supervisor' : 'PIN de Autorización'}
                  </p>
                  <input ref={pinSupRef} type="password" placeholder="PIN Seguridad" className="w-full py-4 bg-[#050a14] rounded-2xl text-center text-2xl font-black border border-white/5 outline-none focus:border-emerald-500" value={pinSupervisor} onChange={(e) => setPinSupervisor(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && registrarAcceso()} />
                </div>

                <button onClick={registrarAcceso} disabled={animar || !qrData || !pinSupervisor || (modo === 'manual' && !pinEmpleadoManual)} className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl uppercase shadow-lg disabled:opacity-30 transition-all active:scale-95">
                  {animar ? 'PROCESANDO...' : 'REGISTRAR'}
                </button>
              </div>
            )}
            
            <button onClick={volverAtras} className="w-full text-slate-600 font-bold uppercase text-[9px] text-center hover:text-white transition-colors">✕ Cancelar Operación</button>
          </div>
        )}
      </div>
    </main>
  );
}