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
  const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dLambda/2) * Math.sin(dLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function SupervisorPage() {
  const [user, setUser] = useState<any>(null);
  const [modo, setModo] = useState<'menu' | 'usb' | 'camara' | 'manual'>('menu');
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [qrData, setQrData] = useState('');
  const [pinEmpleadoManual, setPinEmpleadoManual] = useState('');
  const [pinAutorizador, setPinAutorizador] = useState(''); 
  const [animar, setAnimar] = useState(false);
  const [lecturaLista, setLecturaLista] = useState(false);
  const [gpsReal, setGpsReal] = useState({ lat: 0, lon: 0 });
  const [distanciaAlmacen, setDistanciaAlmacen] = useState<number | null>(null);
  
  const [config, setConfig] = useState<any>({ 
    almacen_lat: 0, almacen_lon: 0, radio_maximo: 0,
    timer_token: 120000, timer_inactividad: 120000 
  });
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const timerInactividadRef = useRef<NodeJS.Timeout | null>(null);
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
  }, [router]);

  const fetchConfig = async () => {
    const { data } = await supabase.from('sistema_config').select('clave, valor');
    if (data) {
      const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
      setConfig({
        almacen_lat: parseFloat(cfgMap.almacen_lat) || 0,
        almacen_lon: parseFloat(cfgMap.almacen_lon) || 0,
        radio_maximo: parseInt(cfgMap.radio_maximo) || 0,
        timer_token: parseInt(cfgMap.timer_token) || 120000,
        timer_inactividad: parseInt(cfgMap.timer_inactividad) || 120000
      });
    }
  };

  useEffect(() => {
    if (gpsReal.lat !== 0 && config.almacen_lat !== 0) {
      const d = calcularDistancia(gpsReal.lat, gpsReal.lon, config.almacen_lat, config.almacen_lon);
      setDistanciaAlmacen(Math.round(d));
    }
  }, [gpsReal, config]);

  const iniciarCamara = async () => {
    if (modo === 'camara' && direccion && !lecturaLista) {
      try {
        if (scannerRef.current) {
          if (scannerRef.current.isScanning) await scannerRef.current.stop();
          scannerRef.current = null;
        }
        const scanner = new Html5Qrcode("reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          (text) => {
            setQrData(text);
            setLecturaLista(true);
            scanner.stop();
            setTimeout(() => pinRef.current?.focus(), 200);
          },
          () => {}
        );
      } catch (err) { console.error(err); }
    }
  };

  useEffect(() => {
    if (modo === 'camara' && direccion) iniciarCamara();
  }, [modo, direccion]);

  const volverAtras = useCallback(async () => {
    if (scannerRef.current?.isScanning) await scannerRef.current.stop();
    if (direccion) {
      setDireccion(null); setQrData(''); setPinAutorizador(''); setPinEmpleadoManual(''); setLecturaLista(false); setAnimar(false);
    } else if (modo !== 'menu') { setModo('menu'); }
  }, [direccion, modo]);

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const d = calcularDistancia(pos.coords.latitude, pos.coords.longitude, config.almacen_lat, config.almacen_lon);
        if (Math.round(d) > config.radio_maximo) throw new Error(`Fuera de rango (${Math.round(d)}m)`);

        let idFinal = qrData.trim();
        if (modo !== 'manual') {
          try {
            const decoded = atob(idFinal).split('|');
            if (decoded.length === 2 && Date.now() - parseInt(decoded[1]) > config.timer_token) throw new Error("TOKEN EXPIRADO");
            if (decoded.length === 2) idFinal = decoded[0];
          } catch (e) {}
        }

        const { data: emp } = await supabase.from('empleados').select('*').or(`documento_id.eq.${idFinal},email.eq.${idFinal}`).maybeSingle();
        if (!emp || !emp.activo) throw new Error("Empleado no válido");
        
        const { data: aut } = await supabase.from('empleados').select('nombre').eq('pin_seguridad', pinAutorizador).in('rol', ['supervisor', 'admin', 'administrador']).maybeSingle();
        if (!aut) throw new Error("PIN Supervisor inválido");

        const { data: jActiva } = await supabase.from('jornadas').select('*').eq('empleado_id', emp.id).is('hora_salida', null).maybeSingle();

        if (direccion === 'entrada') {
          if (jActiva) throw new Error("Ya tiene entrada activa");
          await supabase.from('jornadas').insert([{ 
            empleado_id: emp.id, 
            nombre_empleado: emp.nombre, 
            hora_entrada: new Date().toISOString(), 
            estado: 'activo' 
          }]);
          await supabase.from('empleados').update({ en_almacen: true }).eq('id', emp.id);
        } else {
          if (!jActiva) throw new Error("No hay entrada activa");
          const ahora = new Date();
          const horas = (ahora.getTime() - new Date(jActiva.hora_entrada).getTime()) / 3600000;
          await supabase.from('jornadas').update({ 
            hora_salida: ahora.toISOString(), 
            horas_trabajadas: horas, 
            estado: 'finalizado', 
            editado_por: `Supervisor: ${aut.nombre}` 
          }).eq('id', jActiva.id);
          await supabase.from('empleados').update({ en_almacen: false }).eq('id', emp.id);
        }

        alert(`✅ Éxito: ${emp.nombre}`);
        setQrData(''); setPinEmpleadoManual(''); setPinAutorizador(''); setLecturaLista(false); setAnimar(false);
        if (modo === 'camara') iniciarCamara();
      } catch (err: any) { alert(`❌ ${err.message}`); setAnimar(false); }
    }, () => { alert("Error GPS"); setAnimar(false); }, { enableHighAccuracy: true, timeout: 5000 });
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
      <style jsx global>{`
        @keyframes laser { 0% { top: 0%; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
        .animate-laser { animation: laser 2s infinite linear; }
      `}</style>
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl relative z-10">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-black uppercase italic text-blue-500 tracking-tighter">Panel de Supervisión</h2>
          {user && (
            <div className="mt-2">
              <p className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">{user.nombre} : <span className="text-blue-400 italic">{user.rol} ({user.nivel_acceso})</span></p>
              <p className="text-[9px] font-black text-slate-500 uppercase mt-1">🛰️ GPS: {gpsReal.lat.toFixed(6)} | {distanciaAlmacen ?? '--'}m</p>
            </div>
          )}
        </div>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 uppercase">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 uppercase">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 uppercase">🖋️ Entrada Manual</button>
            <button onClick={() => router.push('/')} className="mt-6 text-slate-500 font-bold uppercase text-[11px] text-center">← Volver</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-xl">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl shadow-xl">SALIDA</button>
            <button onClick={volverAtras} className="mt-4 text-slate-500 font-bold text-[10px] uppercase text-center">← Cambiar Modo</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`bg-[#050a14] p-6 rounded-[30px] border transition-all ${lecturaLista ? 'border-emerald-500' : 'border-white/5'} relative overflow-hidden h-64 flex flex-col items-center justify-center shadow-inner`}>
              {!lecturaLista ? (
                <>
                  <div className="absolute inset-x-0 h-[2px] bg-red-600 shadow-[0_0_10px_red] animate-laser z-20"></div>
                  {modo === 'camara' && <div id="reader" className="w-full h-full rounded-2xl overflow-hidden"></div>}
                  {modo === 'usb' && <p className="text-[10px] font-black text-slate-500 uppercase animate-pulse">Esperando Escaneo USB...</p>}
                </>
              ) : <p className="text-emerald-500 font-black text-[11px] uppercase tracking-widest">Identificado ✅</p>}
            </div>
            {(lecturaLista || modo === 'manual') && (
              <div className="space-y-4">
                {modo === 'manual' && (
                  <input type="text" className="w-full py-4 bg-[#050a14] rounded-[20px] text-center text-xl font-bold border border-white/10 text-white outline-none" placeholder="ID Empleado" value={qrData} onChange={(e) => setQrData(e.target.value)} />
                )}
                <input ref={pinRef} type="password" placeholder="PIN Supervisor" className="w-full py-5 bg-[#050a14] rounded-[25px] text-center text-3xl font-black border-2 border-blue-500/20 text-white outline-none focus:border-blue-500" value={pinAutorizador} onChange={(e) => setPinAutorizador(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') registrarAcceso(); }} />
              </div>
            )}
            <button onClick={registrarAcceso} disabled={animar || !qrData || !pinAutorizador} className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl uppercase italic shadow-lg disabled:opacity-30">
              {animar ? 'PROCESANDO...' : 'Registrar Operación'}
            </button>
            <button onClick={volverAtras} className="w-full text-center text-slate-600 font-bold uppercase text-[9px] tracking-widest">✕ Cancelar</button>
          </div>
        )}
      </div>
    </main>
  );
}