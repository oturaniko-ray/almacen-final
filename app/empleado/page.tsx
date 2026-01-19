'use client';
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRouter } from 'next/navigation';

// 📍 COORDENADAS DEL ALMACÉN (Ajusta estas a tu ubicación real)
const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 50; // Radio de tolerancia


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
  }, [router]);

  if (!user) return null;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
      <h1 className="text-xl mb-4">{user.nombre}</h1>
      <div className="bg-white p-6 rounded-2xl shadow-xl">
        {errorGeo ? <p className="text-red-600 text-xs w-48 text-center">{errorGeo}</p> : <QRCodeSVG value={qrValue} size={200} />}
      </div>
      <button onClick={() => { localStorage.clear(); router.push('/'); }} className="mt-8 text-slate-500 text-sm">Salir</button>
    </main>
  );
}