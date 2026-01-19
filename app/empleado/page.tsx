'use client';
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRouter } from 'next/navigation';

// 📍 COORDENADAS DEL ALMACÉN (Mantenidas según tu archivo)
const ALMACEN_LAT = 40.59665469156573; 
const ALMACEN_LON = -3.5953966013026935;
const RADIO_MAXIMO_METROS = 50; 

export default function EmpleadoPage() {
  const [user, setUser] = useState<any>(null);
  const [qrValue, setQrValue] = useState('');
  const [errorGeo, setErrorGeo] = useState('');
  const [cargando, setCargando] = useState(true);
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
            // SEGURIDAD DINÁMICA: Bloque de 60 segundos
            const identificador = session.documento_id || session.id;
            const timeBlock = Math.floor(Date.now() / 60000); 
            setQrValue(`${identificador}|${timeBlock}`);
          } else {
            setErrorGeo(`Fuera de rango (${Math.round(dist)}m)`);
            playSound('error');
          }
          setCargando(false);
        },
        () => { 
          setErrorGeo("Activa el GPS"); 
          playSound('error');
          setCargando(false); 
        },
        { enableHighAccuracy: true }
      );
    };

    generarQR();
    const interval = setInterval(generarQR, 30000); // Refresca cada 30 segundos
    return () => clearInterval(interval);
  }, [router]);

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-4 text-white">
      {/* Botón Volver Externo */}
      <button 
        onClick={() => router.push('/')}
        className="absolute top-8 left-8 bg-[#1e293b] hover:bg-[#2d3a4f] px-6 py-3 rounded-lg font-bold text-sm text-white border border-white/10 transition-all"
      >
        ← VOLVER
      </button>

      <div className="bg-[#0f172a] p-8 rounded-[40px] w-full max-w-[320px] shadow-2xl border border-white/5 text-center">
        <h1 className="text-xl font-black mb-1 text-blue-500 uppercase">{user.nombre}</h1>
        <p className="text-slate-500 text-[10px] mb-6 font-bold tracking-widest uppercase">Carnet de Empleado</p>

        <div className="bg-white p-4 rounded-[30px] inline-block mb-6 border-4 border-[#1e293b] shadow-inner">
          {cargando ? (
            <div className="w-[160px] h-[160px] flex items-center justify-center">
              <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : errorGeo ? (
            <div className="w-[160px] h-[160px] flex items-center justify-center text-red-600 text-[10px] font-black uppercase px-2">{errorGeo}</div>
          ) : (
            <QRCodeSVG value={qrValue} size={160} level="H" />
          )}
        </div>

        <div className="bg-[#050a14] py-3 px-4 rounded-xl border border-white/5">
          <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mb-1">Documento ID</p>
          <p className="text-lg font-mono font-bold text-blue-400">{user.documento_id || user.id}</p>
        </div>
      </div>
    </main>
  );
}