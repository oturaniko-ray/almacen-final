'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
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
  const [gps, setGps] = useState({ lat: 0, lon: 0 });
  const [config, setConfig] = useState({ lat: 0, lon: 0, radio: 100, qr_exp: 30000 });
  const [direccion, setDireccion] = useState<'entrada' | 'salida' | null>(null);
  const [modo, setModo] = useState<'qr' | 'manual'>('qr');
  const [qrData, setQrData] = useState<string | null>(null);
  const [pinEmpleado, setPinEmpleado] = useState('');
  const [pinAutorizador, setPinAutorizador] = useState('');
  const [lecturaLista, setLecturaLista] = useState(false);
  const [animar, setAnimar] = useState(false);
  
  // Estado para el emergente ámbar solicitado
  const [alertaGps, setAlertaGps] = useState<{ visible: boolean; metros: number }>({ visible: false, metros: 0 });

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.push('/'); return; }
    setUser(JSON.parse(sessionData));

    const loadConfig = async () => {
      const { data } = await supabase.from('sistema_config').select('clave, valor');
      if (data) {
        const m = data.reduce((acc: any, item: any) => ({ ...acc, [item.clave]: item.valor }), {});
        setConfig({
          lat: parseFloat(m.almacen_lat) || 0,
          lon: parseFloat(m.almacen_lon) || 0,
          radio: parseInt(m.radio_maximo) || 100,
          qr_exp: parseInt(m.timer_token) || 30000
        });
      }
    };
    loadConfig();

    const watchId = navigator.geolocation.watchPosition((pos) => {
      setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    }, null, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [router]);

  const resetLectura = useCallback(() => {
    if (scannerRef.current?.isScanning) {
      scannerRef.current.stop().catch(() => {});
    }
    setQrData(null);
    setPinEmpleado('');
    setPinAutorizador('');
    setLecturaLista(false);
    setModo('qr');
  }, []);

  // Función para manejar el fuera de rango
  const manejarFueraDeRango = (distancia: number) => {
    setAlertaGps({ visible: true, metros: Math.round(distancia) });
    setDireccion(null);
    resetLectura();
    setTimeout(() => setAlertaGps({ visible: false, metros: 0 }), 2000);
  };

  // Validar radio antes de entrar al menú QR
  const checkRadioAntesDeEntrar = (dir: 'entrada' | 'salida') => {
    const dist = calcularDistancia(gps.lat, gps.lon, config.lat, config.lon);
    if (dist > config.radio) {
      manejarFueraDeRango(dist);
      return;
    }
    setDireccion(dir);
  };

  const registrarAcceso = async () => {
    // Validar radio antes de procesar la lectura (borra buffer si sale del rango)
    const dist = calcularDistancia(gps.lat, gps.lon, config.lat, config.lon);
    if (dist > config.radio) {
      manejarFueraDeRango(dist);
      return;
    }

    if ((modo === 'qr' && !qrData) || !pinAutorizador) return;
    setAnimar(true);

    try {
      const { data: sup } = await supabase.from('empleados').select('id').eq('documento_id', user.documento_id).eq('pin', pinAutorizador).single();
      if (!sup) throw new Error("PIN SUPERVISOR INCORRECTO");

      let empIdFinal = '';
      if (modo === 'qr' && qrData) {
        const [empId, timestamp] = qrData.split('|');
        if (Date.now() - parseInt(timestamp) > config.qr_exp) throw new Error("QR EXPIRADO");
        empIdFinal = empId;
      } else {
        const { data: emp } = await supabase.from('empleados').select('id').eq('documento_id', qrData).eq('pin', pinEmpleado).single();
        if (!emp) throw new Error("DATOS DE EMPLEADO INCORRECTOS");
        empIdFinal = emp.id;
      }

      const { error } = await supabase.rpc('registrar_jornada_v2', {
        p_empleado_id: empIdFinal,
        p_supervisor_id: user.id,
        p_tipo: direccion,
        p_lat: gps.lat,
        p_lon: gps.lon
      });

      if (error) throw error;
      alert("REGISTRO EXITOSO");
      setDireccion(null);
      resetLectura();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAnimar(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050a14] text-white p-4 font-sans">
      
      {/* EMERGENTE ÁMBAR SOLICITADO */}
      {alertaGps.visible && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <div className="bg-amber-500 text-black p-8 rounded-[30px] border-4 border-white shadow-2xl animate-in zoom-in duration-200">
            <p className="text-xl font-black uppercase italic text-center leading-none">
              Supervisor fuera de rango: ({alertaGps.metros}m)
            </p>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto pt-10">
        {!direccion ? (
          <div className="flex flex-col gap-4">
            <button onClick={() => checkRadioAntesDeEntrar('entrada')} className="w-full bg-emerald-600 p-8 rounded-3xl font-black text-2xl italic active:scale-95 transition-all shadow-lg">REGISTRAR ENTRADA</button>
            <button onClick={() => checkRadioAntesDeEntrar('salida')} className="w-full bg-rose-600 p-8 rounded-3xl font-black text-2xl italic active:scale-95 transition-all shadow-lg">REGISTRAR SALIDA</button>
            <button onClick={() => router.push('/reportes')} className="mt-4 text-slate-500 font-bold uppercase text-[10px] text-center tracking-widest">← VOLVER</button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="bg-black rounded-3xl overflow-hidden aspect-square border-2 border-white/10 relative">
               <div id="reader" className="w-full h-full"></div>
               {qrData && <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center border-4 border-emerald-500 animate-pulse"><span className="bg-emerald-500 text-white px-4 py-1 rounded-full font-black text-[10px]">CAPTURA EXITOSA</span></div>}
            </div>

            <input type="password" placeholder="PIN SUPERVISOR" className="w-full py-4 bg-[#050a14] rounded-2xl text-center text-xl font-black border-4 border-blue-600 text-white outline-none" value={pinAutorizador} onChange={e => setPinAutorizador(e.target.value)} />
            
            <button onClick={registrarAcceso} className="w-full py-6 bg-blue-600 rounded-2xl font-black text-xl uppercase italic active:scale-95">
              {animar ? '...' : 'CONFIRMAR'}
            </button>
            
            <button onClick={() => { setDireccion(null); resetLectura(); }} className="w-full text-center text-slate-500 font-bold uppercase text-[9px] tracking-widest italic">← CANCELAR</button>
          </div>
        )}
      </div>
    </main>
  );
}