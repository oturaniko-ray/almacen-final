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
        timer_token: parseInt(cfgMap.timer_token) || 120000,
        timer_inactividad: parseInt(cfgMap.timer_inactividad) || 120000
      });
    }
  };

  useEffect(() => {
    if (modo !== 'usb' || !direccion || lecturaLista) return;
    let buffer = "";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'Enter') {
        if (buffer.length > 2) {
          setQrData(buffer);
          setLecturaLista(true);
          setTimeout(() => pinRef.current?.focus(), 250);
        }
        buffer = "";
      } else if (e.key.length === 1) buffer += e.key;
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modo, direccion, lecturaLista]);

  const resetFormulario = () => {
    setQrData('');
    setPinAutorizador('');
    setPinEmpleadoManual('');
    setLecturaLista(false);
    setAnimar(false);
  };

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);

    // Timeout de seguridad: Si en 6 segundos el GPS no responde, abortamos
    const gpsTimeout = setTimeout(() => {
      if (animar) {
        alert("❌ Error: Tiempo de espera de GPS agotado.");
        setAnimar(false);
      }
    }, 6000);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      clearTimeout(gpsTimeout);
      try {
        const d = calcularDistancia(pos.coords.latitude, pos.coords.longitude, config.almacen_lat, config.almacen_lon);
        if (Math.round(d) > config.radio_maximo) throw new Error(`Fuera de rango (${Math.round(d)}m)`);

        let idFinal = qrData.trim();
        if (modo !== 'manual') {
          try {
            const decoded = atob(idFinal).split('|');
            if (decoded.length === 2) {
              if (Date.now() - parseInt(decoded[1]) > config.timer_token) throw new Error("TOKEN EXPIRADO");
              idFinal = decoded[0];
            }
          } catch (e) {}
        }

        const { data: emp } = await supabase.from('empleados').select('*').or(`documento_id.eq.${idFinal},email.eq.${idFinal}`).maybeSingle();
        if (!emp || !emp.activo) throw new Error("Empleado no válido");
        
        const { data: aut } = await supabase.from('empleados').select('nombre').eq('pin_seguridad', pinAutorizador).in('rol', ['supervisor', 'admin', 'administrador']).maybeSingle();
        if (!aut) throw new Error("PIN Supervisor inválido");

        const { data: jActiva } = await supabase.from('jornadas').select('*').eq('empleado_id', emp.id).is('hora_salida', null).maybeSingle();

        if (direccion === 'entrada') {
          if (jActiva) throw new Error("Ya tiene entrada activa");
          const { error: insErr } = await supabase.from('jornadas').insert([{ 
            empleado_id: emp.id, 
            nombre_empleado: emp.nombre, 
            hora_entrada: new Date().toISOString(), 
            estado: 'activo' 
          }]);
          if (insErr) throw insErr;
          await supabase.from('empleados').update({ en_almacen: true }).eq('id', emp.id);
        } else {
          if (!jActiva) throw new Error("No hay entrada activa");
          const ahora = new Date();
          const horas = (ahora.getTime() - new Date(jActiva.hora_entrada).getTime()) / 3600000;
          const { error: updErr } = await supabase.from('jornadas').update({ 
            hora_salida: ahora.toISOString(), 
            horas_trabajadas: horas, 
            estado: 'finalizado', 
            editado_por: `Sup: ${aut.nombre}` 
          }).eq('id', jActiva.id);
          if (updErr) throw updErr;
          await supabase.from('empleados').update({ en_almacen: false }).eq('id', emp.id);
        }

        alert(`✅ Éxito: ${emp.nombre}`);
        resetFormulario();
      } catch (err: any) { 
        alert(`❌ ${err.message}`); 
        setAnimar(false); 
      }
    }, (err) => {
      clearTimeout(gpsTimeout);
      alert("❌ Error GPS: No se pudo obtener la ubicación.");
      setAnimar(false);
    }, { enableHighAccuracy: true, timeout: 5000 });
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
            <div className="mt-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user.nombre} <span className="text-blue-500">[{user.rol}]</span></p>
            </div>
          )}
        </div>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 uppercase">🔌 Escáner USB</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 uppercase">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="p-8 bg-[#1e293b] rounded-[30px] font-black text-lg border border-white/5 uppercase">🖋️ Manual</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-4">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-xl uppercase">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl shadow-xl uppercase">SALIDA</button>
            <button onClick={() => setModo('menu')} className="mt-4 text-slate-500 font-bold text-[10px] uppercase text-center tracking-widest">← Cambiar Modo</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`bg-[#050a14] p-6 rounded-[30px] border transition-all ${lecturaLista ? 'border-emerald-500' : 'border-white/5'} relative overflow-hidden h-64 flex flex-col items-center justify-center`}>
              {!lecturaLista ? (
                <>
                  <div className="absolute inset-x-0 h-[2px] bg-red-600 shadow-[0_0_10px_red] animate-laser z-20"></div>
                  <p className="text-[11px] font-black text-blue-500 uppercase animate-pulse">Esperando Lectura...</p>
                </>
              ) : (
                <div className="text-center">
                  <p className="text-emerald-500 font-black text-xl uppercase italic">Identificado ✅</p>
                  <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Ingrese PIN de Supervisor</p>
                </div>
              )}
            </div>

            {lecturaLista && (
              <input ref={pinRef} type="password" placeholder="PIN Autorizador" className="w-full py-5 bg-[#050a14] rounded-[25px] text-center text-4xl font-black border-2 border-blue-500/20 text-white outline-none focus:border-blue-500 shadow-2xl transition-all" value={pinAutorizador} onChange={(e) => setPinAutorizador(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') registrarAcceso(); }} />
            )}
            
            <button onClick={registrarAcceso} disabled={animar || !qrData || !pinAutorizador} className="w-full py-6 bg-blue-600 rounded-[30px] font-black text-xl uppercase italic shadow-lg disabled:opacity-30 active:scale-95 transition-all">
              {animar ? 'PROCESANDO...' : 'Confirmar Registro'}
            </button>
            <button onClick={resetFormulario} className="w-full text-center text-slate-600 font-bold uppercase text-[9px] tracking-widest">✕ CANCELAR</button>
          </div>
        )}
      </div>
    </main>
  );
}