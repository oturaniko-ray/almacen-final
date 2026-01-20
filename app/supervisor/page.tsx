'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 📍 COORDENADAS DEL ALMACÉN (Ajusta estas a tu ubicación real)
const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 50; // Radio de tolerancia
const TIEMPO_MAX_TOKEN_MS = 120000;

export default function SupervisorPage() {
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pinSupervisor, setPinSupervisor] = useState('');
  const [animar, setAnimar] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleVolverAlMenu = () => router.push('/'); // Vuelve al selector de roles

  const handleVolverAtras = async () => {
    if (scannerRef.current) {
      try { if (scannerRef.current.isScanning) await scannerRef.current.stop(); } catch (e) {}
      scannerRef.current = null;
    }
    setQrData(''); setPinSupervisor(''); setAnimar(false);
    if (direccion) setDireccion(null); else if (modo !== 'menu') setModo('menu');
  };

  const registrar = async () => {
    if (!qrData || !pinSupervisor) return;
    setAnimar(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        let documentoId = qrData;
        try {
          const decoded = atob(qrData).split('|');
          if (decoded.length === 2) {
            documentoId = decoded[0];
            if (Date.now() - parseInt(decoded[1]) > TIEMPO_MAX_TOKEN_MS) throw new Error("TOKEN EXPIRADO");
          }
        } catch (e) {}

        const { data: emp } = await supabase.from('empleados').select('*').eq('documento_id', documentoId).maybeSingle();
        if (!emp) throw new Error("Empleado no encontrado.");

        const session = JSON.parse(localStorage.getItem('user_session') || '{}');
        const { data: sup } = await supabase.from('empleados').select('*').eq('id', session.id).eq('pin_seguridad', pinSupervisor.trim()).maybeSingle();
        if (!sup) throw new Error("PIN Incorrecto.");

        // ACTUALIZACIÓN CRÍTICA PARA GESTIÓN DE PERSONAL
        const estatusNuevo = (direccion === 'entrada');
        const { error: errUpdate } = await supabase
          .from('empleados')
          .update({ en_almacen: estatusNuevo })
          .eq('id', emp.id);

        if (errUpdate) throw new Error("Error al actualizar estatus visual.");

        await supabase.from('registros_acceso').insert([{
          empleado_id: emp.id,
          nombre_empleado: emp.nombre,
          tipo_movimiento: direccion,
          detalles: `AUTORIZÓ: ${sup.nombre}`
        }]);

        alert(`REGISTRO EXITOSO: ${emp.nombre}`);
        handleVolverAtras();
      } catch (error: any) {
        alert(error.message);
      } finally {
        setAnimar(false);
      }
    });
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="absolute top-8 left-8 flex gap-2 z-50">
        <button onClick={handleVolverAtras} className="bg-[#1e293b] px-4 py-3 rounded-xl font-bold uppercase text-[10px] border border-white/5">← Atrás</button>
        <button onClick={handleVolverAlMenu} className="bg-blue-600/20 text-blue-400 px-4 py-3 rounded-xl font-bold uppercase text-[10px] border border-blue-500/20">🏠 Menú Principal</button>
      </div>
      
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 text-center shadow-2xl relative overflow-hidden">
        <h1 className="text-2xl font-black uppercase italic tracking-tighter mb-10 text-blue-500">Supervisor</h1>
        {modo === 'menu' ? (
          <div className="space-y-4">
            <button onClick={() => setModo('usb')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl hover:bg-blue-600 border border-white/5">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="w-full p-8 bg-[#1e293b] rounded-[25px] font-bold text-xl hover:bg-emerald-600 border border-white/5">📱 Cámara Móvil</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[30px] font-black text-4xl">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[30px] font-black text-4xl">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            {modo === 'camara' && !qrData && <div id="reader" className="w-full aspect-square bg-black rounded-3xl overflow-hidden border border-white/10"></div>}
            <input ref={pinRef} type="password" placeholder="PIN SUPERVISOR" className="w-full py-6 bg-[#050a14] rounded-[30px] text-white text-center text-3xl font-black outline-none border-2 border-blue-500/20" value={pinSupervisor} onChange={(e) => setPinSupervisor(e.target.value)} />
            <button onClick={registrar} className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl uppercase italic">Confirmar</button>
          </div>
        )}
      </div>
    </main>
  );
}