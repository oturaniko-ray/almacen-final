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
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))); 
  };

  useEffect(() => {
    const sessionStr = localStorage.getItem('user_session');
    if (!sessionStr) {
      router.push('/');
      return;
    }
    const session = JSON.parse(sessionStr);
    setUser(session);

    const generarQR = () => {
      if (!navigator.geolocation) {
        setErrorGeo("GPS no soportado");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = calcularDistancia(pos.coords.latitude, pos.coords.longitude, ALMACEN_LAT, ALMACEN_LON);
          
          if (dist <= RADIO_MAXIMO_METROS) {
            setErrorGeo('');
            // FORMATO ESTÁNDAR: CEDULA|TIMESTAMP
            const ts = new Date().getTime();
            setQrValue(`${session.cedula_id}|${ts}`);
          } else {
            setQrValue('');
            setErrorGeo(`Fuera de rango (${Math.round(dist)}m)`);
          }
          setCargando(false);
        },
        () => {
          setErrorGeo("Active el GPS para generar su acceso");
          setCargando(false);
        },
        { enableHighAccuracy: true }
      );
    };

    generarQR();
    const interval = setInterval(generarQR, 30000); 
    return () => clearInterval(interval);
  }, [router]);

  if (!user) return null;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{user.nombre}</h1>
        <p className="text-slate-500 text-sm">ID: {user.cedula_id}</p>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-2xl">
        {cargando ? (
          <div className="w-48 h-48 flex items-center justify-center text-slate-900">Cargando GPS...</div>
        ) : errorGeo ? (
          <div className="w-48 h-48 flex items-center justify-center text-red-600 font-bold p-4 text-xs">{errorGeo}</div>
        ) : (
          <QRCodeSVG value={qrValue} size={200} level="M" />
        )}
      </div>

      <p className="mt-6 text-slate-500 text-[10px] uppercase tracking-widest">
        El código se actualiza automáticamente
      </p>

      <button onClick={() => { localStorage.clear(); router.push('/'); }} className="mt-10 text-slate-600 text-sm underline">Cerrar Sesión</button>
    </main>
  );
}