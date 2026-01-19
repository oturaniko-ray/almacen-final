'use client';
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRouter } from 'next/navigation';

// 📍 COORDENADAS MANTENIDAS (Exactamente las de tu archivo original)
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

    // Definimos la función de generación
    const generarQR = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = calcularDistancia(pos.coords.latitude, pos.coords.longitude, ALMACEN_LAT, ALMACEN_LON);
          
          if (dist <= RADIO_MAXIMO_METROS) {
            setErrorGeo('');
            
            // CORRECCIÓN CLAVE: 
            // Verificamos si existe documento_id, de lo contrario usamos el id del empleado.
            const identificador = session.documento_id || session.id;
            
            if (!identificador) {
              setErrorGeo("Error: ID de empleado no encontrado");
            } else {
              // El valor del QR será solo el ID para evitar el "undefined|"
              setQrValue(`${identificador}`);
            }
          } else {
            setErrorGeo(`Fuera de rango (${Math.round(dist)}m)`);
          }
          setCargando(false);
        },
        () => { 
          setErrorGeo("Por favor activa el GPS"); 
          setCargando(false); 
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    generarQR();
    // Refrescar QR y ubicación cada 30 segundos
    const interval = setInterval(generarQR, 30000);
    return () => clearInterval(interval);
  }, [router]);

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#050a14] flex flex-col items-center justify-center p-6 text-white font-sans">
      
      {/* Botón Volver (Mismo estilo que pediste para Supervisor) */}
      <button 
        onClick={() => router.push('/')}
        className="absolute top-8 left-8 bg-[#1e293b] hover:bg-[#2d3a4f] px-6 py-3 rounded-lg font-bold text-sm text-white border border-white/10 shadow-lg transition-all"
      >
        ← VOLVER
      </button>

      <div className="bg-[#0f172a] p-10 rounded-[45px] w-full max-w-sm shadow-2xl border border-white/5 text-center">
        <h1 className="text-2xl font-black mb-2 text-[#3b82f6] uppercase tracking-tighter">Mi Carnet</h1>
        <p className="text-slate-500 text-sm mb-8 font-bold uppercase">{user.nombre}</p>

        <div className="bg-white p-6 rounded-[35px] inline-block mb-8 shadow-inner border-8 border-[#1e293b]">
          {cargando ? (
            <div className="w-[200px] h-[200px] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : errorGeo ? (
            <div className="w-[200px] h-[200px] flex items-center justify-center">
              <p className="text-red-600 text-xs font-black uppercase px-4">{errorGeo}</p>
            </div>
          ) : (
            <QRCodeSVG value={qrValue} size={200} level="H" />
          )}
        </div>

        <div className="bg-[#050a14] py-4 px-6 rounded-2xl border border-white/5">
          <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-1">ID Verificado</p>
          <p className="text-lg font-mono font-bold text-blue-400">
            {user.documento_id || "SINFOTO"}
          </p>
        </div>
      </div>

      <button 
        onClick={() => { localStorage.clear(); router.push('/'); }} 
        className="mt-12 text-slate-600 hover:text-red-500 font-bold text-xs uppercase tracking-widest transition-colors"
      >
        Cerrar Sesión
      </button>
    </main>
  );
}