'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dPhi = (lat2 - lat1) * Math.PI / 180;
  const dLambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dLambda/2) * Math.sin(dLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function SupervisorPage() {
  const [user, setUser] = useState<any>(null);
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pinAutorizador, setPinAutorizador] = useState(''); 
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = useState(false);
  const [gpsReal, setGpsReal] = useState({ lat: 0, lon: 0 });
  const [config, setConfig] = useState<any>({ almacen_lat: 0, almacen_lon: 0, radio_maximo: 0 });
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    setUser(JSON.parse(sessionData));
    const watchId = navigator.geolocation.watchPosition((pos) => setGpsReal({ lat: pos.coords.latitude, lon: pos.coords.longitude }));
    return () => navigator.geolocation.clearWatch(watchId);
  }, [router]);

  const resetFormulario = useCallback(async () => {
    if (scannerRef.current?.isScanning) await scannerRef.current.stop();
    setQrData(''); setPinAutorizador(''); setLecturaLista(false); setAnimar(false);
    setDireccion(null); setModo('menu');
  }, []);

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);
    try {
      const { data: emp } = await supabase.from('empleados').select('*').or(`documento_id.eq.${qrData},email.eq.${qrData}`).maybeSingle();
      if (!emp) throw new Error("Empleado no encontrado");
      
      const { data: aut } = await supabase.from('empleados').select('nombre').eq('pin_seguridad', pinAutorizador).in('rol', ['supervisor', 'admin', 'administrador']).maybeSingle();
      if (!aut) throw new Error("PIN de Supervisor incorrecto");

      const { data: jActiva } = await supabase.from('jornadas').select('*').eq('empleado_id', emp.id).is('hora_salida', null).maybeSingle();

      if (direccion === 'entrada') {
        if (jActiva) throw new Error("Ya tiene una entrada activa");
        await supabase.from('jornadas').insert([{ 
          empleado_id: emp.id, 
          nombre_empleado: emp.nombre, 
          documento_id: emp.documento_id,
          hora_entrada: new Date().toISOString(), 
          estado: 'activo' 
        }]);
        await supabase.from('empleados').update({ en_almacen: true }).eq('id', emp.id);
      } else {
        if (!jActiva) throw new Error("No existe una entrada previa");
        const ahora = new Date();
        const diffMs = ahora.getTime() - new Date(jActiva.hora_entrada).getTime();
        const h = Math.floor(diffMs / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diffMs % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0');

        await supabase.from('jornadas').update({ 
          hora_salida: ahora.toISOString(), 
          horas_trabajadas: `${h}:${m}:${s}`, 
          estado: 'finalizado', 
          editado_por: `Sup: ${aut.nombre}` 
        }).eq('id', jActiva.id);
        await supabase.from('empleados').update({ en_almacen: false }).eq('id', emp.id);
      }
      alert(`✅ Registro exitoso: ${emp.nombre}`);
      resetFormulario();
    } catch (e: any) { 
      alert("❌ " + e.message); 
      setAnimar(false); 
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl text-center">
        <h2 className="text-2xl font-black uppercase italic text-blue-500 mb-6 tracking-tighter">Panel Supervisor</h2>
        
        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('manual')} className="p-8 bg-[#1e293b] rounded-[30px] font-black uppercase border border-white/5 hover:bg-slate-700 transition-all">🖋️ Entrada Manual / USB</button>
            <button onClick={() => router.push('/')} className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-4">← Salir al Menú</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-4">
            <button onClick={() => setDireccion('entrada')} className="py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-xl italic">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="py-12 bg-red-600 rounded-[35px] font-black text-4xl shadow-xl italic">SALIDA</button>
            <button onClick={() => setModo('menu')} className="mt-4 text-[10px] text-slate-500 uppercase font-black">← Volver</button>
          </div>
        ) : (
          <div className="space-y-6">
            <input 
              type="text" 
              placeholder="ID EMPLEADO / ESCÁNER" 
              className="w-full py-5 bg-[#050a14] rounded-2xl text-center text-xl font-black border border-white/10 outline-none focus:border-blue-500" 
              value={qrData} 
              onChange={e => setQrData(e.target.value)}
              autoFocus
            />
            <input 
              ref={pinRef} 
              type="password" 
              placeholder="PIN SUPERVISOR" 
              className="w-full py-5 bg-[#050a14] rounded-2xl text-center text-4xl font-black border-2 border-blue-500 outline-none" 
              value={pinAutorizador} 
              onChange={e => setPinAutorizador(e.target.value)} 
            />
            <button 
              onClick={registrarAcceso} 
              disabled={animar || !qrData || !pinAutorizador}
              className="w-full py-6 bg-blue-600 rounded-3xl font-black uppercase italic shadow-lg hover:bg-blue-500 transition-all disabled:opacity-50"
            >
              {animar ? 'PROCESANDO...' : 'Confirmar Registro'}
            </button>
            <button onClick={resetFormulario} className="text-[10px] text-slate-500 uppercase font-black tracking-widest">✕ Cancelar</button>
          </div>
        )}
      </div>
    </main>
  );
}