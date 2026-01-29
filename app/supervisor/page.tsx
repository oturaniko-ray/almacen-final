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
  const [config, setConfig] = useState<any>({ 
    almacen_lat: 0, 
    almacen_lon: 0,
    radio_maximo: 0,
    timer_token: 120000,
    timer_inactividad: 120000 
  });
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const wakeLockRef = useRef<any>(null);
  const timerInactividadRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    const currentUser = JSON.parse(sessionData);
    if (Number(currentUser.nivel_acceso) < 3) { router.push('/'); return; }
    setUser(currentUser);
    fetchConfig();
  }, [router]);

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

  const volverAtras = useCallback(async () => {
    try { if (scannerRef.current?.isScanning) await scannerRef.current.stop(); } catch (e) {}
    scannerRef.current = null;
    setDireccion(null); setQrData(''); setPinAutorizador(''); setPinEmpleadoManual(''); setLecturaLista(false); setModo('menu');
  }, []);

  // Timer de Inactividad
  useEffect(() => {
    const resetTimer = () => {
      if (timerInactividadRef.current) clearTimeout(timerInactividadRef.current);
      if (modo !== 'menu') {
        timerInactividadRef.current = setTimeout(() => volverAtras(), config.timer_inactividad);
      }
    };
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    resetTimer();
    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      if (timerInactividadRef.current) clearTimeout(timerInactividadRef.current);
    };
  }, [modo, config.timer_inactividad, volverAtras]);

  // Wake Lock USB
  useEffect(() => {
    if (modo === 'usb' && 'wakeLock' in navigator) {
      const req = async () => { try { wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch (e) {} };
      req();
    }
    return () => { wakeLockRef.current?.release(); wakeLockRef.current = null; };
  }, [modo]);

  function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3;
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dPhi = (lat2 - lat1) * Math.PI / 180;
    const dLambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dLambda/2) * Math.sin(dLambda/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Captura Global USB
  useEffect(() => {
    if (modo !== 'usb' || !direccion || qrData) return;
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
  }, [modo, direccion, qrData]);

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const d = calcularDistancia(pos.coords.latitude, pos.coords.longitude, config.almacen_lat, config.almacen_lon);
        const dEntera = Math.round(d);

        if (dEntera > config.radio_maximo) {
          throw new Error(`FUERA DE RANGO: Estás a ${dEntera}m. El máximo permitido es ${config.radio_maximo}m.`);
        }

        let idFinal = qrData.trim();
        if (modo !== 'manual') {
          try {
            const decoded = atob(idFinal).split('|');
            if (decoded.length === 2) {
              if (Date.now() - parseInt(decoded[1]) > config.timer_token) throw new Error("TOKEN EXPIRADO");
              idFinal = decoded[0];
            }
          } catch (e: any) { if (e.message === "TOKEN EXPIRADO") throw e; }
        }

        const { data: emp } = await supabase.from('empleados').select('*').or(`documento_id.eq.${idFinal},email.eq.${idFinal}`).maybeSingle();
        if (!emp || !emp.activo) throw new Error("Empleado no encontrado o inactivo");
        if (modo === 'manual' && emp.pin_seguridad !== pinEmpleadoManual) throw new Error("PIN Empleado incorrecto");
        
        const { data: aut } = await supabase.from('empleados').select('nombre, nivel_acceso').eq('pin_seguridad', pinAutorizador).maybeSingle();
        if (!aut || Number(aut.nivel_acceso) < 3) throw new Error("PIN Autorizador inválido");

        const { data: jActiva } = await supabase.from('jornadas').select('*').eq('empleado_id', emp.id).is('hora_salida', null).maybeSingle();

        if (direccion === 'entrada') {
          if (jActiva) throw new Error("Ya tiene una entrada activa.");
          await supabase.from('jornadas').insert([{ empleado_id: emp.id, nombre_empleado: emp.nombre, hora_entrada: new Date().toISOString(), estado: 'activo' }]);
          await supabase.from('empleados').update({ en_almacen: true, ultimo_ingreso: new Date().toISOString() }).eq('id', emp.id);
        } else {
          if (!jActiva) throw new Error("No hay entrada previa.");
          const ahora = new Date();
          const horas = (ahora.getTime() - new Date(jActiva.hora_entrada).getTime()) / 3600000;
          await supabase.from('jornadas').update({ hora_salida: ahora.toISOString(), horas_trabajadas: horas, estado: 'finalizado', editado_por: `Sup: ${aut.nombre}` }).eq('id', jActiva.id);
          await supabase.from('empleados').update({ en_almacen: false, ultima_salida: ahora.toISOString() }).eq('id', emp.id);
        }

        alert(`✅ Éxito: ${emp.nombre} (${dEntera}m)`);
        volverAtras();
      } catch (err: any) { alert(`❌ ${err.message}`); setAnimar(false); }
    }, () => { alert("Error GPS"); setAnimar(false); }, { enableHighAccuracy: true, maximumAge: 0 });
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl relative z-10">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-black uppercase italic text-blue-500 tracking-tighter leading-none">Supervisor Hub</h2>
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full italic">Rango: {config.radio_maximo}m</span>
        </div>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-blue-500 transition-all uppercase italic">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-emerald-500 transition-all uppercase italic">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 hover:border-slate-400 transition-all uppercase italic">🖋️ Entrada Manual</button>
            <button onClick={() => router.push('/')} className="mt-6 text-slate-600 font-bold uppercase text-[10px] tracking-widest text-center">← Volver al Inicio</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-xl italic tracking-tighter">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl shadow-xl italic tracking-tighter">SALIDA</button>
            <button onClick={volverAtras} className="mt-4 text-slate-500 font-bold uppercase text-[10px] tracking-widest text-center">← Cambiar Modo</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`bg-[#050a14] p-6 rounded-[30px] border transition-all ${lecturaLista ? 'border-emerald-500' : 'border-white/5'} relative h-32 flex flex-col items-center justify-center`}>
              {!lecturaLista ? (
                <>
                  <div className="absolute inset-x-0 h-[2px] bg-red-600 shadow-[0_0_10px_red] animate-pulse"></div>
                  {modo === 'camara' && <div id="reader" className="w-full h-full"></div>}
                  {modo === 'usb' && <p className="text-[10px] font-black text-slate-500 uppercase">Esperando Escaneo USB...</p>}
                </>
              ) : <p className="text-emerald-500 font-black text-[10px] uppercase">Identificado ✅</p>}
            </div>
            {modo === 'manual' && (
              <div className="space-y-4">
                <input ref={docInputRef} type="text" autoFocus className="w-full py-4 bg-[#050a14] rounded-[20px] text-center text-xl font-bold border border-white/10" placeholder="ID Empleado" value={qrData} onChange={(e) => setQrData(e.target.value)} />
                <input type="password" placeholder="PIN Personal" className="w-full py-4 bg-[#050a14] rounded-[20px] text-center text-xl font-black border border-white/10" value={pinEmpleadoManual} onChange={(e) => setPinEmpleadoManual(e.target.value)} />
              </div>
            )}
            {(lecturaLista || modo === 'manual') && (
              <input ref={pinRef} type="password" placeholder="PIN Autorizador" className="w-full py-5 bg-[#050a14] rounded-[25px] text-center text-3xl font-black border-2 border-blue-500/20 outline-none" value={pinAutorizador} onChange={(e) => setPinAutorizador(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') registrarAcceso(); }} />
            )}
            <button onClick={registrarAcceso} disabled={animar || !qrData || !pinAutorizador} className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl uppercase italic shadow-lg disabled:opacity-30">{animar ? 'PROCESANDO...' : 'Registrar'}</button>
            <button onClick={volverAtras} className="w-full text-center text-slate-600 font-bold uppercase text-[9px] tracking-widest">✕ Cancelar</button>
          </div>
        )}
      </div>
    </main>
  );
}