'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 COORDENADAS DEL ALMACÉN (Ajustar según ubicación real)
const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 80; 
const TIEMPO_MAX_TOKEN_MS = 120000;

export default function SupervisorPage() {
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pinEmpleadoManual, setPinEmpleadoManual] = useState('');
  const [pinAutorizador, setPinAutorizador] = useState(''); 
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Función para calcular distancia entre dos puntos (Fórmula Haversine)
  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const resetearTodo = async () => {
    try { if (scannerRef.current?.isScanning) await scannerRef.current.stop(); } catch (e) {}
    setQrData('');
    setPinEmpleadoManual('');
    setPinAutorizador('');
    setModo('menu');
    setDireccion(null);
    setLecturaLista(false);
  };

  const resetParaNuevaLectura = () => {
    setQrData('');
    setPinEmpleadoManual('');
    setPinAutorizador('');
    setLecturaLista(false);
    setAnimar(false);
    if (modo === 'manual') setTimeout(() => docInputRef.current?.focus(), 100);
    if (modo === 'camara') iniciarCamara();
  };

  const iniciarCamara = async () => {
    if (scannerRef.current?.isScanning) return;
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
        }, 
        () => {}
      );
    } catch (err) { console.error("Error cámara:", err); }
  };

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);

    // 📍 VALIDACIÓN GEOGRÁFICA
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const distancia = calcularDistancia(pos.coords.latitude, pos.coords.longitude, ALMACEN_LAT, ALMACEN_LON);
      
      try {
        if (distancia > RADIO_MAXIMO_METROS) {
          throw new Error(`FUERA DE RANGO: Estás a ${Math.round(distancia)}m. El límite son ${RADIO_MAXIMO_METROS}m.`);
        }

        let docIdOrEmail = qrData.trim();
        
        // Procesar Token QR si no es manual
        if (modo !== 'manual') {
          try {
            const decoded = atob(docIdOrEmail).split('|');
            if (decoded.length === 2) {
              docIdOrEmail = decoded[0];
              if (Date.now() - parseInt(decoded[1]) > TIEMPO_MAX_TOKEN_MS) throw new Error("QR EXPIRADO");
            }
          } catch (e) {}
        }

        // 1. Buscar Empleado
        const { data: emp } = await supabase
          .from('empleados')
          .select('*')
          .or(`documento_id.eq.${docIdOrEmail},email.eq.${docIdOrEmail}`)
          .maybeSingle();

        if (!emp) throw new Error("Empleado no encontrado");
        if (emp.pin_seguridad !== pinEmpleadoManual) throw new Error("PIN del Empleado incorrecto");

        // 2. Validar Autorizador (Supervisor/Admin)
        const { data: autorizador } = await supabase
          .from('empleados')
          .select('nombre, rol')
          .eq('pin_seguridad', pinAutorizador)
          .in('rol', ['supervisor', 'admin', 'administrador'])
          .maybeSingle();

        if (!autorizador) throw new Error("PIN de Autorización inválido");

        // 3. Ejecutar Registro
        await supabase.from('empleados').update({ en_almacen: direccion === 'entrada' }).eq('id', emp.id);
        
        await supabase.from('registros_acceso').insert([{
          empleado_id: emp.id,
          nombre_empleado: emp.nombre,
          tipo_movimiento: direccion,
          detalles: `MODO ${modo.toUpperCase()} - Autoriza ${autorizador.rol}: ${autorizador.nombre} (Dist: ${Math.round(distancia)}m)`
        }]);

        alert(`✅ ${direccion?.toUpperCase()} ÉXITOSA: ${emp.nombre}`);
        resetParaNuevaLectura();
        
      } catch (err: any) { 
        alert(`❌ ${err.message}`); 
        setPinAutorizador('');
        setAnimar(false);
      }
    }, (err) => {
      alert("Error de GPS: Asegúrate de tener la ubicación activada.");
      setAnimar(false);
    }, { enableHighAccuracy: true });
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl">
        <h2 className="text-2xl font-black uppercase italic text-blue-500 mb-6 text-center tracking-tighter">
          {!direccion ? "Panel de Supervisión" : `REGISTRO DE ${direccion.toUpperCase()}`}
        </h2>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black border border-white/5 hover:border-blue-500 transition-all uppercase">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black border border-white/5 hover:border-emerald-500 transition-all uppercase">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="p-8 bg-[#1e293b] rounded-[30px] font-black border border-white/5 hover:border-amber-400 transition-all uppercase">🖋️ Entrada Manual</button>
            <button onClick={() => router.push('/')} className="mt-4 text-slate-500 font-bold uppercase text-[10px] text-center">← Volver al inicio</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-xl">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl shadow-xl">SALIDA</button>
            <button onClick={resetearTodo} className="mt-4 text-slate-500 font-bold uppercase text-center">← Cancelar</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`bg-[#050a14] p-6 rounded-[30px] border ${lecturaLista ? 'border-emerald-500' : 'border-white/5'} relative h-40 flex items-center justify-center`}>
              {!lecturaLista ? (
                <>
                  {modo === 'manual' ? (
                    <div className="w-full text-center">
                      <p className="text-[10px] font-black text-amber-500 uppercase mb-2">Documento de Identidad</p>
                      <input 
                        ref={docInputRef} type="text" autoFocus
                        className="bg-transparent border-b-2 border-amber-500 text-center text-xl font-bold outline-none w-full" 
                        value={qrData} onChange={(e) => setQrData(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setLecturaLista(true); }}
                      />
                    </div>
                  ) : (
                    <div className="text-center w-full h-full">
                      {modo === 'camara' && <div id="reader" className="w-full h-full rounded-2xl overflow-hidden"></div>}
                      {modo === 'usb' && <p className="text-blue-500 font-black animate-pulse">ESCANEE CÓDIGO QR</p>}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center">
                  <p className="text-emerald-500 font-black">DATOS CAPTURADOS ✔</p>
                  <p className="text-[10px] text-slate-500 mt-2">{qrData}</p>
                </div>
              )}
            </div>

            {lecturaLista && (
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase text-center mb-1">1. PIN del Empleado</p>
                  <input 
                    type="password" placeholder="PIN Personal"
                    className="w-full py-4 bg-[#050a14] rounded-2xl text-center text-2xl font-black border border-white/5 outline-none focus:border-blue-500"
                    value={pinEmpleadoManual} onChange={(e) => setPinEmpleadoManual(e.target.value)}
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase text-center mb-1">2. PIN del Supervisor</p>
                  <input 
                    ref={pinRef} type="password" placeholder="PIN Autorización"
                    className="w-full py-4 bg-[#050a14] rounded-2xl text-center text-2xl font-black border border-white/5 outline-none focus:border-blue-500"
                    value={pinAutorizador} onChange={(e) => setPinAutorizador(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') registrarAcceso(); }}
                  />
                </div>
                <button onClick={registrarAcceso} disabled={animar || !pinAutorizador || !pinEmpleadoManual}
                  className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl uppercase shadow-lg disabled:opacity-30">
                  {animar ? 'VALIDANDO...' : 'CONFIRMAR'}
                </button>
              </div>
            )}
            
            <button onClick={resetearTodo} className="w-full text-slate-600 font-bold uppercase text-[9px] text-center">✕ Cancelar Operación</button>
          </div>
        )}
      </div>
    </main>
  );
}