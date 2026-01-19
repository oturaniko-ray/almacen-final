'use client'; // 👈 Esta línea corrige tu error de Turbopack

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

  // 📏 Fórmula Haversine para calcular distancia entre dos puntos GPS
  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Radio de la Tierra en metros
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
  };

  useEffect(() => {
    // 1. Verificar sesión del usuario
    const sessionStr = localStorage.getItem('user_session');
    if (!sessionStr) {
      router.push('/');
      return;
    }
    const session = JSON.parse(sessionStr);
    setUser(session);

    // 2. Función para generar QR validando ubicación
    const generarQRProtegido = () => {
      if (!navigator.geolocation) {
        setErrorGeo("El GPS no es compatible con este dispositivo.");
        setCargando(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = calcularDistancia(
            pos.coords.latitude, 
            pos.coords.longitude, 
            ALMACEN_LAT, 
            ALMACEN_LON
          );
          
          if (dist <= RADIO_MAXIMO_METROS) {
            setErrorGeo('');
            // Creamos el JSON con ID y Fecha/Hora actual
            const data = { 
              id: session.cedula_id, 
              t: new Date().toISOString() 
            };
            setQrValue(JSON.stringify(data));
          } else {
            setQrValue('');
            setErrorGeo(`Estás muy lejos (${Math.round(dist)}m). Debes estar en el almacén.`);
          }
          setCargando(false);
        },
        (error) => {
          setErrorGeo("Permiso de GPS denegado. Es obligatorio para marcar.");
          setCargando(false);
        },
        { enableHighAccuracy: true } // Forzar precisión alta
      );
    };

    // Ejecutar inmediatamente y luego cada 30 segundos
    generarQRProtegido();
    const interval = setInterval(generarQRProtegido, 30000); 

    return () => clearInterval(interval);
  }, [router]);

  if (!user) return null;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center font-sans">
      <header className="mb-8">
        <div className="bg-blue-500/10 text-blue-500 text-xs font-bold px-3 py-1 rounded-full inline-block mb-2 uppercase tracking-widest">
          Área de Empleado
        </div>
        <h1 className="text-3xl font-bold">{user.nombre}</h1>
        <p className="text-slate-500 text-sm">ID: {user.cedula_id}</p>
      </header>

      {/* CONTENEDOR DEL QR / ESTADOS */}
      <div className="w-full max-w-sm">
        {cargando ? (
          <div className="bg-slate-900 border border-slate-800 p-12 rounded-3xl animate-pulse">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-slate-400">Validando ubicación...</p>
          </div>
        ) : errorGeo ? (
          <div className="bg-red-500/10 border border-red-500/50 p-8 rounded-3xl">
            <span className="text-5xl">📍</span>
            <h2 className="text-red-500 font-bold mt-4">Acceso Bloqueado</h2>
            <p className="text-red-400/80 text-sm mt-2">{errorGeo}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-6 bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-xl font-bold transition-all text-sm"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(59,130,246,0.3)]">
            <QRCodeSVG value={qrValue} size={220} level="H" includeMargin={false} />
            <div className="mt-6 border-t border-slate-100 pt-4">
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                Expira en 30 segundos
              </p>
            </div>
          </div>
        )}
      </div>

      <footer className="mt-12 space-y-6">
        <p className="text-slate-500 text-xs max-w-[250px] mx-auto leading-relaxed italic">
          "La seguridad es responsabilidad de todos. El uso de este QR es personal e intransferible."
        </p>
        
        <button 
          onClick={() => { localStorage.clear(); router.push('/'); }}
          className="text-slate-600 hover:text-red-400 text-sm font-medium transition-colors flex items-center justify-center gap-2 mx-auto"
        >
          <span>Cerrar Sesión</span>
        </button>
      </footer>
    </main>
  );
}