'use client';
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 50; 

export default function EmpleadoPage() {
  const [user, setUser] = useState<any>(null);
  const [qrValue, setQrValue] = useState('');
  const [errorGeo, setErrorGeo] = useState('');
  const [cargando, setCargando] = useState(true);
  const [enAlmacen, setEnAlmacen] = useState(false);
  const router = useRouter();

  const playSound = (type: 'success' | 'error') => {
    const audio = new Audio(type === 'success' 
      ? 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' 
      : 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
    audio.play().catch(() => {});
  };

  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  };

  // Dentro del useEffect principal de app/empleado/page.tsx
useEffect(() => {
  const checkGlobalSession = async () => {
    const sessionStr = localStorage.getItem('user_session');
    if (!sessionStr) return;
    const session = JSON.parse(sessionStr);
    
    const { data } = await supabase.from('empleados').select('session_token').eq('id', session.id).single();
    if (data && data.session_token !== session.session_token) {
      alert("Sesión iniciada en otro dispositivo");
      localStorage.clear();
      window.location.href = '/';
    }
  };

  const interval = setInterval(checkGlobalSession, 15000);
  return () => clearInterval(interval);
}, []);

    const checkStatus = async () => {
      const { data } = await supabase.from('empleados').select('en_almacen').eq('id', session.id).single();
      if (data) setEnAlmacen(data.en_almacen);
    };

    const generarQR = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = calcularDistancia(pos.coords.latitude, pos.coords.longitude, ALMACEN_LAT, ALMACEN_LON);
          if (dist <= RADIO_MAXIMO_METROS) {
            setErrorGeo('');
            const idReal = session.documento_id || session.id;
            const timeBlock = Math.floor(Date.now() / 60000); 
            setQrValue(`${idReal}|${timeBlock}`);
          } else {
            setErrorGeo(`Fuera de rango (${Math.round(dist)}m)`);
            playSound('error');
          }
          setCargando(false);
        },
        () => { setErrorGeo("GPS Requerido"); playSound('error'); setCargando(false); },
        { enableHighAccuracy: true }
      );
    };

    generarQR();
    checkStatus();
    const interval = setInterval(() => { generarQR(); checkStatus(); }, 30000);
    return () => clearInterval(interval);
  }, [router]);

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-4 text-white font-sans">
      <button onClick={() => router.push('/')} className="absolute top-6 left-6 bg-[#1e293b] px-5 py-2 rounded-xl font-bold text-xs border border-white/10 shadow-lg">← VOLVER</button>

      <div className="bg-[#0f172a] p-8 rounded-[40px] w-full max-w-[310px] shadow-2xl border border-white/5 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className={`w-3 h-3 rounded-full ${enAlmacen ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500'}`}></div>
          <h1 className="text-lg font-black uppercase tracking-tighter">{user.nombre}</h1>
        </div>
        <p className="text-slate-500 text-[10px] mb-6 font-bold uppercase tracking-widest">
          {enAlmacen ? 'Dentro del Almacén' : 'Fuera del Almacén'}
        </p>

        <div className="bg-white p-4 rounded-[30px] inline-block mb-6 border-4 border-[#1e293b] shadow-inner">
          {cargando ? (
             <div className="w-[150px] h-[150px] flex items-center justify-center"><div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
          ) : errorGeo ? (
            <div className="w-[150px] h-[150px] flex items-center justify-center text-red-600 text-[10px] font-black px-4">{errorGeo}</div>
          ) : (
            <QRCodeSVG value={qrValue} size={150} level="H" />
          )}
        </div>

        <div className="bg-[#050a14] py-3 rounded-2xl border border-white/5">
          <p className="text-[9px] text-slate-600 font-bold mb-1 uppercase">ID Verificado</p>
          <p className="text-base font-mono font-bold text-blue-400">{user.documento_id}</p>
        </div>
      </div>
    </main>
  );
}