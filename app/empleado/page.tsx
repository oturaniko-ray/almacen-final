'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 50; 

export default function EmpleadoPage() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState('');
  const [ubicacionOk, setUbicacionOk] = useState(false);
  const [distancia, setDistancia] = useState<number | null>(null);
  const [estaActivo, setEstaActivo] = useState<boolean>(true);
  const [cargando, setCargando] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const sessionData = localStorage.getItem('user_session');
    if (!sessionData) { router.replace('/'); return; }
    const currentUser = JSON.parse(sessionData);
    setUser(currentUser);

    const verificarEstado = async () => {
      const { data } = await supabase.from('empleados').select('activo').eq('id', currentUser.id).single();
      if (data) setEstaActivo(data.activo);
      setCargando(false);
    };
    verificarEstado();

    const watchId = navigator.geolocation.watchPosition((pos) => {
      const R = 6371e3;
      const φ1 = pos.coords.latitude * Math.PI/180;
      const φ2 = ALMACEN_LAT * Math.PI/180;
      const Δφ = (ALMACEN_LAT - pos.coords.latitude) * Math.PI/180;
      const Δλ = (ALMACEN_LON - pos.coords.longitude) * Math.PI/180;
      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      setDistancia(Math.round(d));
      setUbicacionOk(d <= RADIO_MAXIMO_METROS);
    }, null, { enableHighAccuracy: true });

    const interval = setInterval(() => {
      if (estaActivo) setToken(btoa(JSON.stringify({ id: currentUser.id, ts: Date.now() })));
    }, 2000);

    return () => { navigator.geolocation.clearWatch(watchId); clearInterval(interval); };
  }, [estaActivo, router]);

  if (!estaActivo && !cargando) {
    return (
      <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-8 text-white font-sans text-center">
        <div className="bg-red-600 p-12 rounded-[45px] shadow-2xl animate-pulse border-4 border-white max-w-md">
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-4">ACCESO <span className="text-white">DENEGADO</span></h1>
          <p className="font-black uppercase text-xs tracking-widest">SU USUARIO ESTÁ <span className="bg-white text-red-600 px-2">INACTIVO</span></p>
          <button onClick={() => { localStorage.removeItem('user_session'); router.replace('/'); }} className="mt-8 bg-white text-red-600 px-8 py-3 rounded-2xl font-black uppercase text-xs">SALIR</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-black uppercase tracking-tighter">ACCESO <span className="text-blue-500">PERSONAL</span></h1>
        <p className="text-blue-500 font-black text-[10px] uppercase tracking-[0.3em] mt-2">{user?.nombre}</p>
      </header>

      <div className={`p-8 rounded-[45px] border-2 transition-all ${ubicacionOk ? 'border-blue-500 bg-blue-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
        {!ubicacionOk ? (
          <div className="py-12 text-center">
            <p className="text-xs font-black uppercase text-red-500 tracking-widest">FUERA DE RANGO</p>
            <p className="text-[10px] text-slate-500 mt-2 uppercase">DISTANCIA: {distancia ?? '--'}M</p>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-[30px] shadow-2xl">
            {token && <QRCodeSVG value={token} size={220} level="H" />}
          </div>
        )}
      </div>
      <button onClick={() => router.push('/')} className="mt-12 text-[10px] font-black uppercase text-slate-500 tracking-widest hover:text-white transition-all">← VOLVER</button>
    </main>
  );
}