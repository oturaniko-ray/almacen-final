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
  const [distanciaAlmacen, setDistanciaAlmacen] = useState<number | null>(null);
  const [config, setConfig] = useState<any>({ almacen_lat: 0, almacen_lon: 0, radio_maximo: 0, timer_token: 120000 });
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    setUser(JSON.parse(sessionData));
    fetchConfig();
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGpsReal({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {}, { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const fetchConfig = async () => {
    const { data } = await supabase.from('sistema_config').select('clave, valor');
    if (data) {
      const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
      setConfig({
        almacen_lat: parseFloat(cfgMap.almacen_lat) || 0,
        almacen_lon: parseFloat(cfgMap.almacen_lon) || 0,
        radio_maximo: parseInt(cfgMap.radio_maximo) || 0,
        timer_token: parseInt(cfgMap.qr_expiracion) || 120000
      });
    }
  };

  useEffect(() => {
    if (gpsReal.lat !== 0 && config.almacen_lat !== 0) {
      const d = calcularDistancia(gpsReal.lat, gpsReal.lon, config.almacen_lat, config.almacen_lon);
      setDistanciaAlmacen(Math.round(d));
    }
  }, [gpsReal, config]);

  const resetFormulario = useCallback(async () => {
    if (scannerRef.current?.isScanning) { await scannerRef.current.stop(); scannerRef.current = null; }
    setQrData(''); setPinAutorizador(''); setLecturaLista(false); setAnimar(false);
  }, []);

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const d = calcularDistancia(pos.coords.latitude, pos.coords.longitude, config.almacen_lat, config.almacen_lon);
        if (Math.round(d) > config.radio_maximo) throw new Error(`Fuera de rango (${Math.round(d)}m)`);

        let idFinal = qrData.trim();
        const { data: emp } = await supabase.from('empleados').select('*').or(`documento_id.eq.${idFinal},email.eq.${idFinal}`).maybeSingle();
        if (!emp || !emp.activo) throw new Error("Empleado no registrado o inactivo");
        
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

        alert(`✅ Éxito: ${emp.nombre}`);
        await resetFormulario();
      } catch (err: any) { 
        alert(`❌ Error: ${err.message}`); 
        setAnimar(false);
      }
    }, () => { alert("Error GPS"); setAnimar(false); }, { enableHighAccuracy: true });
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl text-center">
        <h2 className="text-2xl font-black uppercase italic text-blue-500 mb-6">Panel Supervisor</h2>
        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black uppercase hover:bg-emerald-600 transition-all">📱 Cámara</button>
            <button onClick={() => setModo('manual')} className="p-8 bg-[#1e293b] rounded-[30px] font-black uppercase hover:bg-slate-700 transition-all">🖋️ Manual</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-4">
            <button onClick={() => setDireccion('entrada')} className="py-12 bg-emerald-600 rounded-[35px] font-black text-4xl italic shadow-xl">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="py-12 bg-red-600 rounded-[35px] font-black text-4xl italic shadow-xl">SALIDA</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Esperando PIN de Supervisor</p>
            </div>
            <input ref={pinRef} type="password" placeholder="PIN" className="w-full py-5 bg-[#050a14] rounded-2xl text-center text-4xl font-black border-2 border-blue-500" value={pinAutorizador} onChange={e => setPinAutorizador(e.target.value)} />
            <button onClick={registrarAcceso} disabled={animar} className="w-full py-6 bg-blue-600 rounded-3xl font-black uppercase italic shadow-lg">Confirmar</button>
            <button onClick={() => setModo('menu')} className="text-[10px] text-slate-500 uppercase tracking-widest">✕ Cancelar</button>
          </div>
        )}
      </div>
    </main>