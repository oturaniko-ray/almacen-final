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
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  };

  const limpiarYReiniciar = async () => {
    if (scannerRef.current?.isScanning) await scannerRef.current.stop();
    setQrData(''); setPinSupervisor(''); setPinEmpleadoManual(''); setPinAdminManual('');
    setAnimar(false); setDireccion(null); 
  };

  // Escáner USB con limpieza de tiempo real
  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (buffer.trim()) {
          // Filtramos inmediatamente: Solo permitimos Alfanuméricos
          const clean = buffer.replace(/[^a-zA-Z0-9|]/g, "");
          setQrData(clean);
          setTimeout(() => pinRef.current?.focus(), 50);
        }
        buffer = "";
      } else if (e.key.length === 1) { buffer += e.key; }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, qrData]);

  const registrarAcceso = async () => {
    const esManual = modo === 'manual';
    const pinAValidar = esManual ? pinAdminManual : pinSupervisor;
    
    // 🛡️ LIMPIEZA DE HIERRO: Solo deja letras y números
    let idFinal = qrData.replace(/[^a-zA-Z0-9|]/g, "").trim();

    // Si detectamos formato Base64/Pipe, decodificamos
    if (!esManual && (idFinal.includes('|') || idFinal.length > 20)) {
      try {
        const raw = atob(idFinal);
        idFinal = raw.split('|')[0].replace(/[^a-zA-Z0-9]/g, "").trim();
      } catch (e) {
        // Si falla el atob, nos quedamos con el idFinal limpio original
      }
    }

    if (!idFinal || !pinAValidar || animar) return;
    setAnimar(true);

    const geoPromise = new Promise((res) => navigator.geolocation.getCurrentPosition(res, () => res(null), { timeout: 4000 }));

    try {
      const [pos, authRes] = await Promise.all([
        geoPromise as Promise<GeolocationPosition | null>,
        supabase.from('empleados').select('*').eq('pin_seguridad', pinAValidar).maybeSingle()
      ]);

      // Búsqueda insensible a mayúsculas/minúsculas
      const { data: empData } = await supabase
        .from('empleados')
        .select('*')
        .ilike('documento_id', idFinal)
        .maybeSingle();

      if (!pos) throw new Error("GPS Apagado o bloqueado");
      const d = calcularDistancia(pos.coords.latitude, pos.coords.longitude, ALMACEN_LAT, ALMACEN_LON);
      if (d > RADIO_MAXIMO_METROS) throw new Error(`Estás fuera del almacén (${Math.round(d)}m)`);

      if (!empData) throw new Error(`Empleado ID [${idFinal}] no existe`);
      if (esManual && empData.pin_seguridad !== pinEmpleadoManual) throw new Error("PIN empleado incorrecto");
      if (!authRes.data) throw new Error("PIN Autorización inválido");

      await Promise.all([
        supabase.from('empleados').update({ en_almacen: direccion === 'entrada' }).eq('id', empData.id),
        supabase.from('registros_acceso').insert([{
          empleado_id: empData.id,
          nombre_empleado: empData.nombre,
          tipo_movimiento: direccion,
          detalles: esManual ? `Manual - Admin: ${authRes.data.nombre}` : `Sup: ${authRes.data.nombre}`
        }])
      ]);

      alert(`✅ REGISTRADO: ${empData.nombre}`);
      await limpiarYReiniciar();
    } catch (err: any) {
      alert(`❌ ${err.message}`);
      setAnimar(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative">
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl">
        <h2 className="text-2xl font-black uppercase italic text-blue-500 mb-10 text-center">Control de Acceso</h2>

        {!direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-lg">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl shadow-lg">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`bg-[#050a14] p-6 rounded-[30px] border ${qrData ? 'border-emerald-500' : 'border-white/5'} h-32 flex items-center justify-center text-center`}>
              {!qrData ? (
                <p className="text-blue-500 font-black animate-pulse uppercase">ESCANEE EL CÓDIGO O ID</p>
              ) : (
                <div>
                  <div className="text-emerald-500 text-3xl mb-1">✔</div>
                  <p className="text-emerald-500 font-black text-xs uppercase">Capturado</p>
                </div>
              )}
            </div>

            <input 
              ref={pinRef}
              type="password" 
              placeholder="PIN AUTORIZACIÓN" 
              className="w-full py-6 bg-[#050a14] rounded-[30px] text-center text-4xl font-black border-2 border-blue-500/20 focus:border-blue-500 outline-none"
              value={pinSupervisor}
              onChange={(e) => setPinSupervisor(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') registrarAcceso(); }}
            />

            <button 
              onClick={registrarAcceso} 
              disabled={animar || !qrData || !pinSupervisor}
              className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl uppercase shadow-xl disabled:opacity-30"
            >
              {animar ? 'VERIFICANDO...' : 'CONFIRMAR'}
            </button>
            
            <button onClick={() => setDireccion(null)} className="w-full text-slate-500 font-bold uppercase text-[10px]">Cancelar</button>
          </div>
        )}
      </div>
    </main>
  );
}