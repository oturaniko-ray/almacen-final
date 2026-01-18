'use client';
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { checkGeofence } from '../utils/geofence';

export default function Home() {
  const [inRange, setInRange] = useState(false);
  const [coords, setCoords] = useState({ lat: 0, lng: 0 });

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition((pos) => {
      const isInside = checkGeofence(pos.coords.latitude, pos.coords.longitude);
      setInRange(isInside);
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
      <h1 className="text-2xl font-bold mb-6 text-blue-500">ACCESO EMPLEADO</h1>
      
      {!inRange ? (
        <div className="bg-red-900/20 border border-red-500 p-6 rounded-2xl">
          <p className="text-red-400 font-bold underline">FUERA DE RANGO</p>
          <p className="text-xs mt-2 text-slate-400">Debes estar en el almacén para generar el QR.</p>
          <p className="text-[10px] mt-1 font-mono">{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</p>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-2xl shadow-[0_0_50px_rgba(59,130,246,0.5)]">
          <QRCodeSVG value={`EMPLEADO_VALOR_UNICO_${new Date().getTime()}`} size={200} />
          <p className="text-slate-900 mt-4 font-bold text-sm text-emerald-600">UBICACIÓN VALIDADA ✅</p>
        </div>
      )}
    </main>
  );
}