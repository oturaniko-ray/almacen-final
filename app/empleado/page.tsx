'use client';
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRouter } from 'next/navigation';

// 📍 COORDENADAS MANTENIDAS
const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 50; 

export default function EmpleadoPage() {
  const [user, setUser] = useState<any>(null);
  const [qrValue, setQrValue] = useState('');
  const [errorGeo, setErrorGeo] = useState('');
  const [cargando, setCargando] = useState(true);
  const router = useRouter();

  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  };

  useEffect(() => {
    const sessionStr = localStorage.getItem('user_session');
    if (!sessionStr) { router.push('/'); return; }
    const session = JSON.parse(sessionStr);
    setUser(session);

    const generarQR = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = calcularDistancia(pos.coords.latitude, pos.coords.longitude, ALMACEN_LAT, ALMACEN_LON);
          
          if (dist <= RADIO_MAXIMO_METROS) {
            setErrorGeo('');
            // CORRECCIÓN: Usar documento_id o id para evitar el 'undefined'
            const idReal = session.documento_id || session.id;
            // SEGURIDAD DINÁMICA: Timestamp cada minuto (truncamos los segundos)
            const timestamp = Math.floor(Date.now() / 60000); 
            setQrValue(`${idReal}|${timestamp}`);
          } else {
            setErrorGeo(`Fuera de rango (${Math.round(dist)}m)`);
          }
          setCargando(false);
        },
        () => { setErrorGeo("GPS Desactivado"); setCargando(false); },
        { enableHighAccuracy: true }
      );
    };

    generarQR();
    const interval = setInterval(generarQR, 10000); // Re-revisa cada 10 seg por si se mueve
    return () => clearInterval(interval);
  }, [router]);

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      <button onClick={() => router.push('/')} className="absolute top-8 left-8 bg-[#1e293b] px-6 py-3 rounded-lg font-bold text-sm border border-white/10 hover:bg-[#2d3a4f]">← VOLVER</button>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-sm shadow-2xl border border-white/5 text-center">
        <h1 className="text-2xl font-black mb-1 text-[#3b82f6] uppercase">Mi Carnet</h1>
        <p className="text-slate-500 text-xs mb-8 font-bold">{user.nombre}</p>

        <div className="bg-white p-6 rounded-[35px] inline-block mb-8 border-8 border-[#1e293b]">
          {errorGeo ? (
            <div className="w-[200px] h-[200px] flex items-center justify-center text-red-600 text-[10px] font-black uppercase text-center px-4">{errorGeo}</div>
          ) : (
            <QRCodeSVG value={qrValue} size={200} level="H" />
          )}
        </div>
        <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">ID: {user.documento_id || user.id}</p>
      </div>
    </main>
  );
}