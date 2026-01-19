'use client';
import { useState, useEffect, useCallback } from 'react';
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
  const router = useRouter();

  // VALIDAR SESIÓN ÚNICA CADA 15 SEGUNDOS
  const validarSesion = useCallback(async (userId: string, currentToken: string) => {
    const { data } = await supabase.from('empleados').select('session_token, activo').eq('id', userId).single();
    if (data && (data.session_token !== currentToken || !data.activo)) {
      alert("⚠️ Tu sesión ha sido cerrada desde otro dispositivo.");
      localStorage.clear();
      window.location.href = '/';
    }
  }, []);

  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  useEffect(() => {
    const sessionStr = localStorage.getItem('user_session');
    if (!sessionStr) { router.push('/'); return; }
    const session = JSON.parse(sessionStr);
    setUser(session);

    const generarQR = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          validarSesion(session.id, session.session_token); // Validar sesión al generar QR
          const dist = calcularDistancia(pos.coords.latitude, pos.coords.longitude, ALMACEN_LAT, ALMACEN_LON);
          if (dist <= RADIO_MAXIMO_METROS) {
            setErrorGeo('');
            setQrValue(`${session.documento_id}|${new Date().getTime()}`);
          } else {
            setErrorGeo(`Fuera de rango (${Math.round(dist)}m)`);
          }
          setCargando(false);
        },
        () => { setErrorGeo("Error de GPS"); setCargando(false); },
        { enableHighAccuracy: true }
      );
    };

    generarQR();
    const interval = setInterval(generarQR, 30000);
    return () => clearInterval(interval);
  }, [router, validarSesion]);

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="bg-[#0f172a] p-10 rounded-[45px] border border-white/5 w-full max-w-sm text-center shadow-2xl">
        <h1 className="text-2xl font-black mb-2 italic uppercase">{user.nombre}</h1>
        <p className="text-slate-500 text-[10px] mb-8 uppercase tracking-widest">Código de Acceso Personal</p>
        
        <div className="bg-white p-6 rounded-[35px] shadow-inner mb-8 inline-block">
          {cargando ? (
            <div className="w-48 h-48 flex items-center justify-center text-black font-bold animate-pulse">Generando...</div>
          ) : qrValue ? (
            <QRCodeSVG value={qrValue} size={200} level="H" />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center text-red-500 font-bold px-4">{errorGeo}</div>
          )}
        </div>

        <div className="space-y-4">
          <div className="py-3 px-6 bg-[#050a14] rounded-2xl border border-white/5">
            <p className="text-[9px] text-slate-500 uppercase font-black">ID de Empleado</p>
            <p className="font-mono font-bold text-blue-400 tracking-tighter">{user.documento_id}</p>
          </div>
          <button onClick={() => { localStorage.clear(); window.location.href='/'; }} className="text-slate-500 text-xs font-bold hover:text-white uppercase transition-colors pt-4">Cerrar Sesión</button>
        </div>
      </div>
    </main>
  );
}