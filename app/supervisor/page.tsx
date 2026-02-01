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
  const [config, setConfig] = useState<any>({ almacen_lat: 0, almacen_lon: 0, radio_maximo: 0 });
  
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
        radio_maximo: parseInt(cfgMap.radio_maximo) || 0
      });
    }
  };

  useEffect(() => {
    if (gpsReal.lat !== 0 && config.almacen_lat !== 0) {
      const d = calcularDistancia(gpsReal.lat, gpsReal.lon, config.almacen_lat, config.almacen_lon);
      setDistanciaAlmacen(Math.round(d));
    }
  }, [gpsReal, config]);

  const resetLectura = useCallback(async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
      scannerRef.current = null;
    }
    setQrData('');
    setLecturaLista(false);
    setAnimar(false);
    // Si es modo cámara, reiniciamos automáticamente el escáner
    if (modo === 'camara') iniciarCamara();
  }, [modo]);

  const iniciarCamara = async () => {
    try {
      setTimeout(async () => {
        const scanner = new Html5Qrcode("reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 20, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            setQrData(decodedText);
            setLecturaLista(true);
            scanner.stop();
            setTimeout(() => pinRef.current?.focus(), 300);
          },
          () => {}
        );
      }, 500);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (modo === 'camara' && direccion && !lecturaLista) {
      iniciarCamara();
    }
    return () => { if (scannerRef.current?.isScanning) scannerRef.current.stop(); };
  }, [modo, direccion, lecturaLista]);

  const registrarAcceso = async () => {
    if (!qrData || !pinAutorizador || animar) return;
    setAnimar(true);

    try {
      if (distanciaAlmacen && distanciaAlmacen > config.radio_maximo) {
        throw new Error(`FUERA DE RANGO: ${distanciaAlmacen}m`);
      }

      const { data: emp } = await supabase.from('empleados').select('*').or(`documento_id.eq.${qrData},email.eq.${qrData}`).maybeSingle();
      if (!emp || !emp.activo) throw new Error("Empleado no registrado o inactivo");
      
      const { data: aut } = await supabase.from('empleados').select('nombre').eq('pin_seguridad', pinAutorizador).in('rol', ['supervisor', 'admin', 'administrador']).maybeSingle();
      if (!aut) throw new Error("PIN de Supervisor incorrecto");

      const { data: jActiva } = await supabase.from('jornadas').select('*').eq('empleado_id', emp.id).is('hora_salida', null).maybeSingle();

      if (direccion === 'entrada') {
        if (jActiva) throw new Error("Ya tiene una entrada activa");
        await supabase.from('jornadas').insert([{ 
          empleado_id: emp.id, nombre_empleado: emp.nombre, documento_id: emp.documento_id,
          hora_entrada: new Date().toISOString(), estado: 'activo' 
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
          hora_salida: ahora.toISOString(), horas_trabajadas: `${h}:${m}:${s}`, 
          estado: 'finalizado', editado_por: `Sup: ${aut.nombre}` 
        }).eq('id', jActiva.id);
        await supabase.from('empleados').update({ en_almacen: false }).eq('id', emp.id);
      }

      alert(`✅ Éxito: ${emp.nombre}`);
      setPinAutorizador('');
      resetLectura();
    } catch (err: any) { 
      alert(`❌ Error: ${err.message}`); 
      setAnimar(false);
      // En caso de error, volvemos a permitir la lectura
      setLecturaLista(false);
      setQrData('');
      if (modo === 'camara') iniciarCamara();
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-lg border border-white/5 shadow-2xl relative overflow-hidden">
        
        {/* INDICADORES GPS Y DISTANCIA */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-black uppercase italic text-blue-500 tracking-tighter">Panel Supervisor</h2>
          <div className="mt-2 bg-black/20 py-2 px-4 rounded-2xl inline-block border border-white/5">
             <p className="text-[9px] font-bold text-blue-500 uppercase italic">
                🛰️ {gpsReal.lat.toFixed(6)}, {gpsReal.lon.toFixed(6)} | <span className="text-white">{distanciaAlmacen ?? '--'}m al Almacén</span>
              </p>
          </div>
        </div>

        {modo === 'menu' ? (
          <div className="grid gap-4">
            <button onClick={() => setModo('usb')} className="p-8 bg-[#1e293b] rounded-[30px] font-black uppercase border border-white/5 hover:bg-blue-600 transition-all">🔌 Scanner / USB</button>
            <button onClick={() => setModo('camara')} className="p-8 bg-[#1e293b] rounded-[30px] font-black uppercase border border-white/5 hover:bg-emerald-600 transition-all">📱 Cámara Móvil</button>
            <button onClick={() => setModo('manual')} className="p-8 bg-[#1e293b] rounded-[30px] font-black uppercase border border-white/5 hover:bg-slate-700 transition-all">🖋️ Manual</button>
            <button onClick={() => router.push('/')} className="mt-4 text-slate-600 font-bold uppercase text-[9px] text-center tracking-widest">← Salir</button>
          </div>
        ) : !direccion ? (
          <div className="flex flex-col gap-4">
            <button onClick={() => setDireccion('entrada')} className="w-full py-12 bg-emerald-600 rounded-[35px] font-black text-4xl shadow-xl uppercase italic">ENTRADA</button>
            <button onClick={() => setDireccion('salida')} className="w-full py-12 bg-red-600 rounded-[35px] font-black text-4xl shadow-xl uppercase italic">SALIDA</button>
            <button onClick={() => setModo('menu')} className="mt-6 text-slate-500 font-bold text-[10px] uppercase text-center tracking-widest cursor-pointer">← Cambiar Modo</button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* VISOR DE LECTURA CON EFECTO LÁSER */}
            <div className={`bg-[#050a14] p-4 rounded-[30px] border transition-all ${lecturaLista ? 'border-emerald-500' : 'border-white/5'} relative overflow-hidden h-64 flex items-center justify-center`}>
              {!lecturaLista ? (
                <>
                  {modo === 'camara' && <div id="reader" className="w-full h-full rounded-2xl overflow-hidden"></div>}
                  {modo === 'usb' && <div className="text-center"><p className="text-blue-500 font-black animate-pulse">ESPERANDO SCANNER...</p><input type="text" className="opacity-0 absolute" autoFocus onChange={(e) => { setQrData(e.target.value); setLecturaLista(true); setTimeout(() => pinRef.current?.focus(), 300); }} /></div>}
                  {modo === 'manual' && <input type="text" placeholder="ID EMPLEADO" className="bg-transparent text-center text-2xl font-black uppercase outline-none" autoFocus onKeyDown={(e) => { if(e.key === 'Enter') { setQrData(e.currentTarget.value); setLecturaLista(true); setTimeout(() => pinRef.current?.focus(), 300); }}} />}
                  {/* EFECTO LÁSER ROJO */}
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-red-500 shadow-[0_0_15px_red] animate-scan-laser z-20"></div>
                </>
              ) : (
                <div className="text-center">
                  <p className="text-emerald-500 font-black text-xl uppercase italic">ID Detectado ✅</p>
                  <p className="text-[10px] text-slate-500 mt-2">{qrData}</p>
                </div>
              )}
            </div>

            {/* PIN Y CONFIRMACIÓN */}
            {lecturaLista && (
              <input 
                ref={pinRef} 
                type="password" 
                placeholder="PIN SUPERVISOR" 
                className="w-full py-5 bg-[#050a14] rounded-2xl text-center text-4xl font-black border-2 border-blue-500 text-white outline-none" 
                value={pinAutorizador} 
                onChange={e => setPinAutorizador(e.target.value)} 
                onKeyDown={(e) => { if(e.key === 'Enter') registrarAcceso(); }}
              />
            )}

            <button onClick={registrarAcceso} disabled={animar || !qrData || !pinAutorizador} className="w-full py-6 bg-blue-600 rounded-3xl font-black uppercase italic shadow-lg hover:bg-blue-500 transition-all disabled:opacity-30">
              {animar ? 'REGISTRANDO...' : 'Confirmar Registro'}
            </button>
            <button onClick={resetLectura} className="w-full text-center text-slate-600 font-bold uppercase text-[9px] tracking-widest">✕ Cancelar Lectura</button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes scan-laser {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        .animate-scan-laser {
          animation: scan-laser 2s infinite linear;
        }
      `}</style>
    </main>
  );
}