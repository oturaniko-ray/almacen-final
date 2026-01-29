'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

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
  
  const [config, setConfig] = useState<any>({ 
    almacen_lat: 0, almacen_lon: 0, radio_maximo: 0,
    timer_token: 120000, timer_inactividad: 120000 
  });
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const resetLectura = useCallback(() => {
    setQrData('');
    setPinEmpleadoManual('');
    setPinAutorizador('');
    setLecturaLista(false);
    setAnimar(false);
    if (modo === 'manual') setTimeout(() => docInputRef.current?.focus(), 200);
  }, [modo]);

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    const currentUser = JSON.parse(sessionData);
    if (Number(currentUser.nivel_acceso) < 3) { router.push('/'); return; }
    setUser(currentUser);
    fetchConfig();

    const watchId = navigator.geolocation.watchPosition(
      (pos) => setGpsReal({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {}, { enableHighAccuracy: true, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [router]);

  useEffect(() => {
    if (modo === 'camara' && direccion && !lecturaLista) {
      const startCamera = async () => {
        try {
          if (!scannerRef.current) scannerRef.current = new Html5Qrcode("reader");
          await scannerRef.current.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 250 },
            (text) => {
              setQrData(text);
              setLecturaLista(true);
              scannerRef.current?.stop();
              setTimeout(() => pinRef.current?.focus(), 200);
            },
            () => {}
          );
        } catch (err) {}
      };
      startCamera();
    }
    return () => { if (scannerRef.current?.isScanning) scannerRef.current.stop().catch(() => {}); };
  }, [modo, direccion, lecturaLista]);

  const fetchConfig = async () => {
    const { data } = await supabase.from('sistema_config').select('clave, valor');
    if (data) {
      const cfgMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
      setConfig({
        almacen_lat: parseFloat(cfgMap.almacen_lat) || 0,
        almacen_lon: parseFloat(cfgMap.almacen_lon) || 0,
        radio_maximo: parseInt(cfgMap.radio_maximo) || 50,
        timer_token: parseInt(cfgMap.timer_token) || 120000,
        timer_inactividad: parseInt(cfgMap.timer_inactividad) || 120000
      });
    }
  };

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const R = 6371e3;
        const p1 = pos.coords.latitude * Math.PI / 180;
        const p2 = config.almacen_lat * Math.PI / 180;
        const dPhi = (config.almacen_lat - pos.coords.latitude) * Math.PI / 180;
        const dLambda = (config.almacen_lon - pos.coords.longitude) * Math.PI / 180;
        const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dLambda/2) * Math.sin(dLambda/2);
        const dEntera = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

        if (dEntera > config.radio_maximo) throw new Error(`Fuera de rango (${dEntera}m).`);

        let idFinal = qrData.trim();
        if (modo !== 'manual') {
          try {
            const decoded = atob(idFinal).split('|');
            if (decoded.length === 2 && (Date.now() - parseInt(decoded[1]) > config.timer_token)) throw new Error("TOKEN EXPIRADO");
            if (decoded.length === 2) idFinal = decoded[0];
          } catch (e) {}
        }

        const { data: emp } = await supabase.from('empleados').select('*').or(`documento_id.eq.${idFinal},email.eq.${idFinal}`).maybeSingle();
        if (!emp || !emp.activo) throw new Error("Empleado no válido");
        const { data: aut } = await supabase.from('empleados').select('nombre, nivel_acceso').eq('pin_seguridad', pinAutorizador).maybeSingle();
        if (!aut || Number(aut.nivel_acceso) < 3) throw new Error("PIN Supervisor inválido");

        const { data: jActiva } = await supabase.from('jornadas').select('*').eq('empleado_id', emp.id).is('hora_salida', null).maybeSingle();
        if (direccion === 'entrada') {
          if (jActiva) throw new Error("Ya tiene entrada activa");
          await supabase.from('jornadas').insert([{ empleado_id: emp.id, nombre_empleado: emp.nombre, hora_entrada: new Date().toISOString(), estado: 'activo' }]);
          await supabase.from('empleados').update({ en_almacen: true }).eq('id', emp.id);
        } else {
          if (!jActiva) throw new Error("No hay entrada activa");
          const ahora = new Date();
          const horas = (ahora.getTime() - new Date(jActiva.hora_entrada).getTime()) / 3600000;
          await supabase.from('jornadas').update({ hora_salida: ahora.toISOString(), horas_trabajadas: horas, estado: 'finalizado', editado_por: `Sup: ${aut.nombre}` }).eq('id', jActiva.id);
          await supabase.from('empleados').update({ en_almacen: false }).eq('id', emp.id);
        }
        alert(`✅ Éxito: ${emp.nombre} (${dEntera}m)`);
        resetLectura();
      } catch (err: any) { alert(`❌ ${err.message}`); resetLectura(); }
    }, () => { alert("Error GPS"); setAnimar(false); }, { enableHighAccuracy: true, maximumAge: 0 });
  };

  // Auto-validación cuando el PIN llega a 4 dígitos
  useEffect(() => {
    if (pinAutorizador.length === 4) registrarAcceso();
  }, [pinAutorizador]);

  // Lógica USB
  useEffect(() => {
    if (modo !== 'usb' || !direccion || lecturaLista) return;
    let buffer = "";
    const handleKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'Enter') {
        if (buffer.trim()) { setQrData(buffer.trim()); setLecturaLista(true); setTimeout(() => pinRef.current?.focus(), 100); }
        buffer = "";
      } else if (e.key.length === 1) buffer += e.key;
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [modo, direccion, lecturaLista]);

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
      <style jsx global>{` @keyframes laser { 0% { top: 0%; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } } .animate-laser { animation: laser 2s infinite linear; } `}</style>
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl relative z-10">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-black uppercase italic text-blue-500 tracking-tighter leading-none">Supervisor Hub</h2>
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full italic">Rango: {config.radio_maximo}m</span>
        </div>

        {modo === 'menu' ? (
          <div className="grid gap-4 text-center">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-blue-500 transition-all uppercase italic">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-emerald-500 transition-all uppercase italic">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-slate-400 transition-all uppercase italic">🖋️ Entrada Manual</button>
            <button onClick={() => router.push('/')} className="mt-6 text-slate-500 font-bold uppercase text-[10px] tracking-widest">← Volver al Inicio</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-xl italic">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl shadow-xl italic">SALIDA</button>
            <button onClick={() => setModo('menu')} className="mt-4 text-slate-500 font-bold uppercase text-[10px] tracking-widest text-center">← Cambiar Modo</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`bg-[#050a14] p-6 rounded-[30px] border transition-all ${lecturaLista ? 'border-emerald-500' : 'border-white/5'} relative overflow-hidden h-32 flex flex-col items-center justify-center`}>
              {!lecturaLista ? (
                <>
                  <div className="absolute inset-x-0 h-[2px] bg-red-600 shadow-[0_0_10px_red] animate-laser z-20"></div>
                  {modo === 'camara' && <div id="reader" className="w-full h-full"></div>}
                  {modo === 'usb' && <p className="text-[10px] font-black text-slate-500 uppercase">Esperando Escaneo USB...</p>}
                </>
              ) : <p className="text-emerald-500 font-black text-[9px] uppercase tracking-widest">Identificado ✅</p>}
            </div>
            <div className="text-center text-[8px] font-bold text-slate-500 uppercase tracking-widest -mt-4">GPS Actual: {gpsReal.lat.toFixed(6)} / {gpsReal.lon.toFixed(6)}</div>
            {modo === 'manual' && (
              <div className="space-y-4">
                <input ref={docInputRef} type="text" autoFocus className="w-full py-4 bg-[#050a14] rounded-[20px] text-center text-xl font-bold border border-white/10 outline-none text-white" placeholder="ID Empleado" value={qrData} onChange={(e) => setQrData(e.target.value)} />
                <input type="password" placeholder="PIN Personal" className="w-full py-4 bg-[#050a14] rounded-[20px] text-center text-xl font-black border border-white/10 outline-none text-white" value={pinEmpleadoManual} onChange={(e) => setPinEmpleadoManual(e.target.value)} />
              </div>
            )}
            {(lecturaLista || modo === 'manual') && (
              <input ref={pinRef} type="password" placeholder="PIN Supervisor" className="w-full py-5 bg-[#050a14] rounded-[25px] text-center text-3xl font-black border-2 border-blue-500/20 outline-none text-white" value={pinAutorizador} onChange={(e) => setPinAutorizador(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') registrarAcceso(); }} />
            )}
            <button onClick={registrarAcceso} disabled={animar || !qrData || !pinAutorizador} className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl uppercase italic shadow-lg disabled:opacity-30">{animar ? 'PROCESANDO...' : 'Registrar'}</button>
            <button onClick={resetLectura} className="w-full text-center text-slate-600 font-bold uppercase text-[9px] tracking-widest">✕ Nueva Lectura</button>
            <button onClick={() => setDireccion(null)} className="w-full text-center text-slate-500 font-bold uppercase text-[9px] tracking-widest">← Volver</button>
          </div>
        )}
      </div>
    </main>
  );
}