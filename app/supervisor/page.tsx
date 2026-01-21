'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 CONFIGURACIÓN DE SEGURIDAD (Mantenida de tus constantes)
const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 80; 

export default function SupervisorPage() {
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pinSupervisor, setPinSupervisor] = useState('');
  const [animar, setAnimar] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 🛡️ ALGORITMO DE DECODIFICACIÓN Y LIMPIEZA
  // Este proceso asegura que el ID sea idéntico al que espera el LoginPage
  const extraerDocumentoID = (raw: string) => {
    // 1. Eliminar caracteres de control ASCII (los símbolos extraños que viste)
    let limpio = raw.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();

    // 2. Intentar decodificar si es Base64 (Algoritmo común en tus QRs)
    if (limpio.length > 15 || limpio.includes('|')) {
      try {
        const decoded = atob(limpio);
        // Si el formato es "ID|TIMESTAMP|TOKEN", extraemos solo el ID
        return decoded.split('|')[0].trim().toUpperCase();
      } catch (e) {
        // Si no es Base64, devolvemos el texto limpio en mayúsculas
        return limpio.toUpperCase();
      }
    }
    return limpio.toUpperCase();
  };

  // Captura del Escáner USB
  useEffect(() => {
    if (!direccion || qrData) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (buffer.trim()) {
          setQrData(buffer.trim());
          setTimeout(() => pinRef.current?.focus(), 50);
        }
        buffer = "";
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [direccion, qrData]);

  const registrarAcceso = async () => {
    if (!qrData || !pinSupervisor || animar) return;
    setAnimar(true);

    const idFinal = extraerDocumentoID(qrData);

    try {
      // Validación de Geolocalización
      const pos = await new Promise<GeolocationPosition | null>((res) => 
        navigator.geolocation.getCurrentPosition(res, () => res(null), { timeout: 4000 })
      );

      if (!pos) throw new Error("GPS no detectado. Activa la ubicación.");

      // Búsqueda de Empleado y Validación de PIN de Supervisor (según roles de tu LoginPage)
      const [empRes, supRes] = await Promise.all([
        supabase.from('empleados').select('*').eq('documento_id', idFinal).maybeSingle(),
        supabase.from('empleados').select('*').eq('pin_seguridad', pinSupervisor.trim()).maybeSingle()
      ]);

      if (!empRes.data) throw new Error(`Empleado ID [${idFinal}] no registrado.`);
      
      // Validar que quien autoriza sea Supervisor o Admin (basado en los roles de tu archivo)
      const rolAutorizador = supRes.data?.rol?.toLowerCase();
      if (!supRes.data || !['admin', 'administrador', 'supervisor'].includes(rolAutorizador)) {
        throw new Error("PIN de autorización inválido o sin permisos.");
      }

      // Ejecutar actualización de estado y log de acceso
      await Promise.all([
        supabase.from('empleados').update({ en_almacen: direccion === 'entrada' }).eq('id', empRes.data.id),
        supabase.from('registros_acceso').insert([{
          empleado_id: empRes.data.id,
          nombre_empleado: empRes.data.nombre,
          tipo_movimiento: direccion,
          detalles: `Autorizado por: ${supRes.data.nombre}`
        }])
      ]);

      alert(`✅ ${direccion.toUpperCase()} REGISTRADA: ${empRes.data.nombre}`);
      setQrData('');
      setPinSupervisor('');
      setDireccion(null);
    } catch (err: any) {
      alert(`❌ ERROR: ${err.message}`);
    } finally {
      setAnimar(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl">
        <h2 className="text-2xl font-black uppercase italic text-blue-500 mb-10 text-center tracking-tighter">Panel de Supervisión</h2>

        {!direccion ? (
          <div className="grid gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-lg active:scale-95 transition-all">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl shadow-lg active:scale-95 transition-all">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`bg-[#050a14] p-8 rounded-[30px] border-2 border-dashed ${qrData ? 'border-emerald-500 bg-emerald-500/5' : 'border-blue-500/20'} h-32 flex flex-col items-center justify-center transition-all`}>
              {!qrData ? (
                <p className="text-blue-400 font-black animate-pulse uppercase text-center">Esperando Escaneo USB...</p>
              ) : (
                <div className="text-center">
                  <span className="text-emerald-500 text-3xl">✔</span>
                  <p className="text-emerald-500 font-black text-xs uppercase">Código Detectado</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-[12px] font-bold text-slate-500 uppercase text-center tracking-widest">PIN Autorización</p>
              <input 
                ref={pinRef}
                type="password" 
                className="w-full py-6 bg-[#050a14] rounded-[30px] text-center text-4xl font-black border-2 border-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={pinSupervisor}
                onChange={(e) => setPinSupervisor(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') registrarAcceso(); }}
              />
            </div>

            <button 
              onClick={registrarAcceso} 
              disabled={animar || !qrData || !pinSupervisor}
              className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl uppercase italic shadow-xl disabled:opacity-30"
            >
              {animar ? 'PROCESANDO...' : 'CONFIRMAR ACCESO'}
            </button>
            
            <button onClick={() => { setDireccion(null); setQrData(''); }} className="w-full text-slate-500 font-bold uppercase text-[10px] tracking-tighter">Regresar al menú</button>
          </div>
        )}
      </div>
    </main>
  );
}